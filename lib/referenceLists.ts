import "server-only";
import { collectAliases, parsePointsFile } from "./decklist/lists";
import type { AliasList, PointsList } from "./decklist/types";
import {
  getList,
  getListTimes,
  recordAttempt,
  saveList,
  type StoredList,
} from "./queries/referenceLists";

const DAY_MS = 24 * 60 * 60 * 1000;
// a list whose refresh was tried this recently is left alone, on the assumption that it failed
const RETRY_AFTER_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 30_000;
// scryfall asks for a descriptive User-Agent and at most 10 requests a second
const SCRYFALL_HEADERS = {
  "User-Agent": "MoxKey-uploader/1.0",
  Accept: "application/json",
};
const SCRYFALL_DELAY_MS = 150;

type ListSpec<T> = {
  name: string;
  label: string;
  // how old the stored copy may get before it is refetched; null means it never expires
  maxAgeMs: number | null;
  // throws with a message fit to show an admin; a reply that looks wrong must throw, so it
  // never replaces a good copy
  fetchFresh: () => Promise<T>;
  size: (data: T) => number;
};

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// `source` is how the error names the other end, e.g. "Scryfall"
async function fetchChecked(
  source: string,
  url: string,
  headers?: HeadersInit,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new Error(`Could not reach ${source} (network error or timeout).`);
  }
  if (!response.ok) {
    throw new Error(
      `${source} answered with an error (HTTP ${response.status}).`,
    );
  }
  return response;
}

async function fetchScryfallJson(
  url: string,
): Promise<{ data?: unknown; has_more?: boolean; next_page?: string }> {
  const response = await fetchChecked("Scryfall", url, SCRYFALL_HEADERS);
  const body: unknown = await response.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    throw new Error("Scryfall's reply wasn't what was expected.");
  }
  return body;
}

function defineList<T>(spec: ListSpec<T>) {
  // the stored copy whatever its age; never waits on a remote server
  async function get(): Promise<StoredList<T> | null> {
    try {
      return await getList<T>(spec.name);
    } catch (error) {
      // the checks are optional, so pages still load if this fails (e.g. 003 not run yet)
      console.error(
        `Could not read the ${spec.label}: ${describeError(error)}`,
      );
      return null;
    }
  }

  async function fetchAndStore(): Promise<StoredList<T>> {
    const data = await spec.fetchFresh();
    await saveList(spec.name, data);
    return { data, fetchedAt: new Date() };
  }

  // True when there is no copy or it has expired, unless a refresh was tried within the last hour:
  // that attempt is assumed to have failed, so Scryfall or GitHub is not asked again yet.
  async function needsRefresh(): Promise<boolean> {
    try {
      const { fetchedAt, lastAttemptAt } = await getListTimes(spec.name);
      const stale =
        fetchedAt === null ||
        (spec.maxAgeMs !== null &&
          Date.now() - fetchedAt.getTime() >= spec.maxAgeMs);
      const triedRecently =
        lastAttemptAt !== null &&
        Date.now() - lastAttemptAt.getTime() < RETRY_AFTER_MS;
      return stale && !triedRecently;
    } catch (error) {
      console.error(
        `Could not check the ${spec.label}: ${describeError(error)}`,
      );
      return false;
    }
  }

  // visitors who arrive while a refresh is running wait on it rather than starting another
  let refreshing: Promise<StoredList<T> | null> | null = null;

  // fetches when there is no copy or it has expired; on failure keeps whatever is stored. The
  // attempt is recorded before fetching, so a failure (or a crash) leaves it on record.
  function refreshIfStale(): Promise<StoredList<T> | null> {
    refreshing ??= (async () => {
      try {
        if (!(await needsRefresh())) {
          return await get();
        }
        await recordAttempt(spec.name);
        return await fetchAndStore();
      } catch (error) {
        console.error(
          `Could not refresh the ${spec.label}: ${describeError(error)}`,
        );
        return await get();
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  // the admin button: ignores age, waits, and throws instead of hiding a failure
  async function refreshNow(): Promise<number> {
    return spec.size((await fetchAndStore()).data);
  }

  async function status(): Promise<{ count: number; fetchedAt: Date } | null> {
    const stored = await get();
    return stored
      ? { count: spec.size(stored.data), fetchedAt: stored.fetchedAt }
      : null;
  }

  return {
    name: spec.name,
    label: spec.label,
    get,
    needsRefresh,
    refreshIfStale,
    refreshNow,
    status,
  };
}

// the community's points list, kept on GitHub
const POINTS_URL =
  "https://raw.githubusercontent.com/Fryyyyy/decklist/master/js/cards/highlander.txt";
const MIN_PLAUSIBLE_POINTED_CARDS = 10;

export const pointsList = defineList<PointsList>({
  name: "points",
  label: "points list",
  maxAgeMs: DAY_MS,
  fetchFresh: async () => {
    const response = await fetchChecked("GitHub", POINTS_URL);
    const cards = parsePointsFile(await response.text());
    if (Object.keys(cards).length < MIN_PLAUSIBLE_POINTED_CARDS) {
      throw new Error(
        "The file had too few cards to be the points list. Nothing was changed.",
      );
    }
    return cards;
  },
  size: (cards) => Object.keys(cards).length,
});

// one request, about 35,000 names; far fewer means a bad response
const CARD_NAMES_URL = "https://api.scryfall.com/catalog/card-names";
const MIN_PLAUSIBLE_CARD_NAMES = 20_000;

export const cardNamesList = defineList<string[]>({
  name: "card_names",
  label: "card-name list",
  maxAgeMs: DAY_MS,
  fetchFresh: async () => {
    const { data } = await fetchScryfallJson(CARD_NAMES_URL);
    if (
      !Array.isArray(data) ||
      !data.every((name) => typeof name === "string")
    ) {
      throw new Error("Scryfall's reply wasn't a list of card names.");
    }
    if (data.length < MIN_PLAUSIBLE_CARD_NAMES) {
      throw new Error(
        `Scryfall sent only ${data.length} names, which is too few to be right. Nothing was changed.`,
      );
    }
    return data;
  },
  size: (names) => names.length,
});

// about 570 cards over a few pages; far fewer means a bad response
const RESERVED_SEARCH_URL =
  "https://api.scryfall.com/cards/search?q=is%3Areserved&unique=cards&order=name";
const MIN_PLAUSIBLE_RESERVED_CARDS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Cards are only added to the Reserved List in rare reprints, so it never expires: it is fetched
// when missing, and after that only from the admin page.
export const reservedList = defineList<string[]>({
  name: "reserved",
  label: "Reserved List",
  maxAgeMs: null,
  fetchFresh: async () => {
    const names = new Set<string>();
    let url: string | undefined = RESERVED_SEARCH_URL;
    while (url) {
      const page = await fetchScryfallJson(url);
      if (!Array.isArray(page.data)) {
        throw new Error("Scryfall's reply wasn't a list of cards.");
      }
      for (const card of page.data) {
        if (typeof card?.name !== "string") {
          throw new Error("Scryfall's reply wasn't a list of cards.");
        }
        names.add(card.name);
      }
      url = page.has_more ? page.next_page : undefined;
      if (url) {
        await sleep(SCRYFALL_DELAY_MS);
      }
    }
    if (names.size < MIN_PLAUSIBLE_RESERVED_CARDS) {
      throw new Error(
        `Scryfall sent only ${names.size} cards, which is too few to be right. Nothing was changed.`,
      );
    }
    return [...names];
  },
  size: (names) => names.length,
});

// Cards that go by another name, from two searches. A flavor name (e.g. the Marvel set's "Widow-Making
// Infiltrator" for Dauthi Voidwalker) is about 700 printings over a few pages. Some printings keep the
// other name as the English printed name instead (Secret Lair's "Negan, the Cold-Blooded" for Malik,
// Grim Manipulator), about 275 printings. New sets add more, so it refreshes daily.
const ALIAS_SEARCH_URLS = [
  "https://api.scryfall.com/cards/search?q=has%3Aflavor_name&unique=prints&include_extras=true&order=name",
  "https://api.scryfall.com/cards/search?q=lang%3Aen+has%3Aprinted_name&unique=prints&include_extras=true&order=name",
];
const MIN_PLAUSIBLE_ALIASES = 100;

export const cardAliasesList = defineList<AliasList>({
  name: "card_aliases",
  label: "flavor-name list",
  maxAgeMs: DAY_MS,
  fetchFresh: async () => {
    const aliases: AliasList = {};
    for (const searchUrl of ALIAS_SEARCH_URLS) {
      let url: string | undefined = searchUrl;
      while (url) {
        const page = await fetchScryfallJson(url);
        if (!Array.isArray(page.data)) {
          throw new Error("Scryfall's reply wasn't a list of cards.");
        }
        for (const card of page.data) {
          if (typeof card?.name !== "string") {
            throw new Error("Scryfall's reply wasn't a list of cards.");
          }
        }
        Object.assign(aliases, collectAliases(page.data));
        url = page.has_more ? page.next_page : undefined;
        if (url) {
          await sleep(SCRYFALL_DELAY_MS);
        }
      }
      await sleep(SCRYFALL_DELAY_MS);
    }
    if (Object.keys(aliases).length < MIN_PLAUSIBLE_ALIASES) {
      throw new Error(
        `Scryfall sent only ${Object.keys(aliases).length} flavor names, which is too few to be right. Nothing was changed.`,
      );
    }
    return aliases;
  },
  size: (aliases) => Object.keys(aliases).length,
});

// only a handful of cards have the companion ability; new ones come with new sets
const COMPANIONS_SEARCH_URL =
  "https://api.scryfall.com/cards/search?q=is%3Acompanion&unique=cards&order=name";
const MIN_PLAUSIBLE_COMPANIONS = 5;

export const companionsList = defineList<string[]>({
  name: "companions",
  label: "companion list",
  maxAgeMs: DAY_MS,
  fetchFresh: async () => {
    const names: string[] = [];
    let url: string | undefined = COMPANIONS_SEARCH_URL;
    while (url) {
      const page = await fetchScryfallJson(url);
      if (!Array.isArray(page.data)) {
        throw new Error("Scryfall's reply wasn't a list of cards.");
      }
      for (const card of page.data) {
        if (typeof card?.name !== "string") {
          throw new Error("Scryfall's reply wasn't a list of cards.");
        }
        names.push(card.name);
      }
      url = page.has_more ? page.next_page : undefined;
      if (url) {
        await sleep(SCRYFALL_DELAY_MS);
      }
    }
    if (names.length < MIN_PLAUSIBLE_COMPANIONS) {
      throw new Error(
        `Scryfall sent only ${names.length} companions, which is too few to be right. Nothing was changed.`,
      );
    }
    return names;
  },
  size: (names) => names.length,
});

// About 1,250 cards over 8 pages. A card counts as a land when its front face is one, so a
// spell that turns into a land on its back ("Agadeem's Awakening // Agadeem, the Undercrypt") is
// left out. Both the full name and the front face are kept, as a decklist may use either.
const LANDS_SEARCH_URL =
  "https://api.scryfall.com/cards/search?q=t%3Aland&unique=cards&order=name";
const MIN_PLAUSIBLE_LANDS = 800;

export const landsList = defineList<string[]>({
  name: "lands",
  label: "land list",
  maxAgeMs: DAY_MS,
  fetchFresh: async () => {
    const names = new Set<string>();
    let url: string | undefined = LANDS_SEARCH_URL;
    while (url) {
      const page = await fetchScryfallJson(url);
      if (!Array.isArray(page.data)) {
        throw new Error("Scryfall's reply wasn't a list of cards.");
      }
      for (const card of page.data) {
        if (
          typeof card?.name !== "string" ||
          typeof card?.type_line !== "string"
        ) {
          throw new Error("Scryfall's reply wasn't a list of cards.");
        }
        const frontTypeLine: string =
          card.card_faces?.[0]?.type_line ?? card.type_line;
        if (frontTypeLine.includes("Land")) {
          names.add(card.name);
          names.add(card.name.split(" // ")[0]);
        }
      }
      url = page.has_more ? page.next_page : undefined;
      if (url) {
        await sleep(SCRYFALL_DELAY_MS);
      }
    }
    if (names.size < MIN_PLAUSIBLE_LANDS) {
      throw new Error(
        `Scryfall sent only ${names.size} lands, which is too few to be right. Nothing was changed.`,
      );
    }
    return [...names];
  },
  size: (names) => names.length,
});

// the names of those among `lists` that are stale and due a refresh, for the page to hand to
// <RefreshingData>
export async function staleListNames(
  lists: { name: string; needsRefresh(): Promise<boolean> }[],
): Promise<string[]> {
  const due = await Promise.all(lists.map((list) => list.needsRefresh()));
  return lists.filter((_, i) => due[i]).map((list) => list.name);
}

export const referenceLists = [
  pointsList,
  cardNamesList,
  reservedList,
  cardAliasesList,
  companionsList,
  landsList,
];

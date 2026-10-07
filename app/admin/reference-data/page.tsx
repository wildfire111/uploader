import Link from "next/link";
import { requireAdmin } from "@/lib/guards";
import { formatTimestamp } from "@/lib/formatDate";
import { cardNamesList, pointsList, reservedList } from "@/lib/referenceLists";
import { RefreshButton } from "./RefreshButton";

// Shows what is stored right now, so it must never be served from a cache.
export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    list: cardNamesList,
    title: "Card names",
    noun: "names",
    about: "Every Magic card name, from Scryfall, used to flag a card that doesn't exist. It refreshes itself once it is a day old.",
  },
  {
    list: pointsList,
    title: "Points list",
    noun: "cards",
    about: "The community's points list, from GitHub, used for the points total. It refreshes itself once it is a day old.",
  },
  {
    list: reservedList,
    title: "Reserved List",
    noun: "cards",
    about: "Every Reserved List card, from Scryfall, used to limit a deck with any of them to 7 points. It is fetched once and never refreshes itself; update it here when new Reserved List cards are printed (rare).",
  },
];

export default async function AdminReferenceDataPage() {
  await requireAdmin();

  const statuses = await Promise.all(SECTIONS.map((section) => section.list.status()));

  return (
    <main className="mx-auto max-w-3xl">
      <p>
        <Link href="/">&larr; Events</Link>
      </p>
      <div className="page-header">
        <h1>Reference Data</h1>
      </div>
      <p>
        Lists the decklist checks use. Each is fetched the first time an event page is opened. The
        buttons wait while the list is fetched.
      </p>

      {SECTIONS.map((section, i) => {
        const status = statuses[i];
        return (
          <section key={section.list.name}>
            {i > 0 ? <hr className="my-8 border-t-2 border-muted" /> : null}
            <h2>{section.title}</h2>
            <p>
              {section.about}{" "}
              {status ? (
                <>
                  {status.count.toLocaleString("en-AU")} {section.noun}, last updated{" "}
                  {formatTimestamp(status.fetchedAt)}.
                </>
              ) : (
                <strong>Not loaded yet.</strong>
              )}
            </p>
            <RefreshButton name={section.list.name} noun={section.noun} />
          </section>
        );
      })}
    </main>
  );
}

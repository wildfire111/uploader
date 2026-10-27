"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { flushSync } from "react-dom";
import { shortenShareLinkAction } from "@/lib/actions/shareLink";
import { ConfirmDialog } from "./ConfirmDialog";
import { Grid } from "./Grid";
import { HiddenDialog } from "./HiddenDialog";
import {
  addMatchup,
  createPlan,
  insertMatchup,
  isBasicLand,
  MAX_SIZE,
  MIN_SIZE,
  removeMatchup,
  setDecklist,
  setSize,
  showAllColumns,
  showColumn,
  type Matchup,
  type Plan,
} from "./plan";
import { SavedPlansDialog } from "./SavedPlansDialog";
import { SavePrompt } from "./SavePrompt";
import {
  addSave,
  findSave,
  matchesSave,
  readSaves,
  removeSave,
  writeSaves,
  type SavedPlan,
} from "./saves";
import { decodeShare, encodeShare, parsePlan, planToJson } from "./share";
import styles from "./sideboard.module.css";

const STORAGE_KEY = "sideboard-plan";
const SHARE_PREFIX = "#plan=";
const UNDO_MS = 6000;
// the paper the grid is fitted to, in px: the printable area of A4 landscape with 10mm margins
const PAPER_WIDTH = 1046;
const PAPER_HEIGHT = 716;
// a short plan is blown up to fill the page, but not so far that it looks odd
const MAX_FIT_SCALE = 2;

type View = "edit" | "print";
type Message = { text: string; error?: boolean } | null;

function readStored(): Plan | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    const result = text === null ? null : parsePlan(text);
    return result?.ok ? result.plan : null;
  } catch {
    return null;
  }
}

// the list holds full names and front faces, so a decklist can use either
function isListedLand(landNames: Set<string> | null, name: string): boolean {
  return (
    landNames !== null &&
    (landNames.has(name) || landNames.has(name.split(" // ")[0].trim()))
  );
}

function isBlank(plan: Plan): boolean {
  return plan.deckText.trim() === "" && plan.matchups.length === 0;
}

export function SideboardClient({ landNames: landNameList }: { landNames: string[] | null }) {
  const [plan, setPlan] = useState<Plan>(createPlan);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("edit");
  const [fit, setFit] = useState(true);
  const [draft, setDraft] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [deckOpen, setDeckOpen] = useState<boolean | null>(null);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [saves, setSaves] = useState<SavedPlan[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);
  // a plan waiting to replace the current one, while the person decides whether to save that first
  const [pending, setPending] = useState<{ next: Plan; notice: string } | null>(null);
  const [replacing, setReplacing] = useState<{ name: string; andThen?: () => void } | null>(null);
  const [deleting, setDeleting] = useState<SavedPlan | null>(null);
  const landNames = useMemo(() => (landNameList ? new Set(landNameList) : null), [landNameList]);
  const [undo, setUndo] = useState<{ matchup: Matchup; index: number } | null>(
    null,
  );
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const messageTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const started = useRef(false);
  const viewBeforePrint = useRef<View>("edit");
  const paperRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // the saved plan, or the one in a share link when the person agrees to replace what they have
  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    void (async () => {
      const stored = readStored();
      let next = stored ?? createPlan();
      // a shared plan that has to wait while the person decides about the plan they already have
      let offered: Plan | null = null;
      if (window.location.hash.startsWith(SHARE_PREFIX)) {
        const result = await decodeShare(
          window.location.hash.slice(SHARE_PREFIX.length),
        );
        if (!result.ok) {
          flash("That share link doesn't hold a plan.", true);
        } else if (!stored || isBlank(stored) || matchesSave(readSaves(), stored)) {
          next = result.plan;
        } else {
          offered = result.plan;
        }
        history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      }
      setPlan(next);
      setDraft(next.deckText);
      setLoaded(true);
      if (offered) {
        setPending({ next: offered, notice: "Opened the shared plan." });
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, planToJson(plan));
    } catch {
      // private windows and blocked storage just mean the plan isn't remembered
    }
  }, [plan, loaded]);

  // scales the paper's contents to fill the page, or leaves them at the chosen size
  function fitToPage() {
    const inner = paperRef.current;
    if (!inner) {
      return;
    }
    const scale = fit
      ? Math.min(
          MAX_FIT_SCALE,
          PAPER_WIDTH / inner.offsetWidth,
          PAPER_HEIGHT / inner.offsetHeight,
        )
      : 1;
    inner.style.setProperty("--scale", String(scale));
  }

  useLayoutEffect(() => {
    if (view === "print") {
      fitToPage();
    }
  });

  // printing always gives the print view, whichever way printing was started
  useEffect(() => {
    function before() {
      viewBeforePrint.current = view;
      flushSync(() => setView("print"));
      fitToPage();
    }
    function after() {
      setView(viewBeforePrint.current);
    }
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  });

  function onDelete(matchup: Matchup, index: number) {
    setPlan((current) => removeMatchup(current, matchup.id));
    setUndo({ matchup, index });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }

  function undoDelete() {
    if (undo) {
      setPlan((current) => insertMatchup(current, undo.matchup, undo.index));
      setUndo(null);
    }
  }

  // a blank row, with the cursor in its name
  function addRow() {
    const id = crypto.randomUUID();
    setPlan((current) => addMatchup(current, "", id));
    setFocusId(id);
  }

  const clearFocus = useCallback(() => setFocusId(null), []);

  function replacePlan(next: Plan) {
    setPlan(next);
    setDraft(next.deckText);
  }

  // replaces the plan, offering first to save the current one unless some save already holds it
  function replaceWith(next: Plan, notice: string) {
    if (isBlank(plan) || matchesSave(readSaves(), plan)) {
      replacePlan(next);
      flash(notice);
    } else {
      setPending({ next, notice });
    }
  }

  function commitSave(name: string, andThen?: () => void) {
    if (!writeSaves(addSave(readSaves(), name, plan, Date.now()))) {
      flash("Couldn't save: this browser wouldn't store it. Export the plan instead.", true);
      return;
    }
    setSaves(readSaves());
    flash(`Saved “${name.trim()}”.`);
    andThen?.();
  }

  // saving over a name that is taken asks first
  function saveAs(name: string, andThen?: () => void) {
    if (findSave(readSaves(), name)) {
      setReplacing({ name, andThen });
    } else {
      commitSave(name, andThen);
    }
  }

  function deleteSave(save: SavedPlan) {
    if (writeSaves(removeSave(readSaves(), save.name))) {
      flash(`Deleted “${save.name}”.`);
    } else {
      flash("Couldn't delete that save.", true);
    }
    setSaves(readSaves());
  }

  // builds the grid from the decklist (a first paste or an update), and says how many lands it hid
  function applyDecklist() {
    const next = setDecklist(
      plan,
      draft,
      (name) => isBasicLand(name) || isListedLand(landNames, name),
    );
    const alreadyHidden = new Set(plan.hidden);
    const hiddenNow = next.hidden.filter((id) => !alreadyHidden.has(id)).length;
    setPlan(next);
    if (hiddenNow > 0) {
      flash(`${hiddenNow} ${hiddenNow === 1 ? "land" : "lands"} automatically hidden`);
    }
  }

  // a notice that goes by itself, unless something else has been said in the meantime
  function flash(text: string, error = false) {
    setMessage({ text, error });
    clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(
      () => setMessage((current) => (current?.text === text ? null : current)),
      UNDO_MS,
    );
  }

  // back to a blank page, as on the first visit
  function clearAll() {
    clearTimeout(undoTimer.current);
    clearTimeout(messageTimer.current);
    replacePlan(createPlan());
    setDeckOpen(null);
    setUndo(null);
    setShareUrl(null);
    setMessage(null);
    setClearing(false);
  }

  async function share() {
    const longUrl = `${window.location.origin}${window.location.pathname}${SHARE_PREFIX}${await encodeShare(plan)}`;
    flash("Making the share link…");
    const short = await shortenShareLinkAction(longUrl);
    const url = short.ok ? short.data : longUrl;
    // the full link still works when the shortener doesn't
    const suffix = short.ok ? "" : ` (${short.error} This is the full link.)`;
    try {
      await navigator.clipboard.writeText(url);
      setShareUrl(null);
      flash(`Share link copied.${suffix}`);
    } catch {
      // the link is shown only when it couldn't be copied
      setShareUrl(url);
      flash(`Copy the share link below.${suffix}`);
    }
  }

  function exportJson() {
    const url = URL.createObjectURL(
      new Blob([planToJson(plan)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "sideboard-plan.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const result = parsePlan(await file.text());
    if (result.ok) {
      replaceWith(result.plan, "Plan imported.");
    } else {
      flash(result.error, true);
    }
  }

  const hasColumns = plan.columns.length > 0;
  // open on its own until there is a grid, unless the button has been used
  const showDeck = deckOpen ?? !hasColumns;

  if (view === "print") {
    return (
      <div className={`${styles.page} ${styles.printView}`}>
        <div className={`${styles.toolbar} ${styles.noPrint}`}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setView("edit")}
          >
            ← Back to editing
          </button>
          <div
            className={styles.radios}
            role="radiogroup"
            aria-label="Print size"
          >
            <label>
              <input
                type="radio"
                name="size"
                checked={fit}
                onChange={() => setFit(true)}
              />
              Fit to page
            </label>
            <label>
              <input
                type="radio"
                name="size"
                checked={!fit}
                onChange={() => setFit(false)}
              />
              Use the column size
            </label>
          </div>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>
        <div className={styles.paper}>
          <div ref={paperRef} className={styles.paperInner}>
            <Grid
              plan={plan}
              printView
              onPlan={setPlan}
              onDelete={onDelete}
              onAdd={addRow}
              focusId={null}
              onFocused={clearFocus}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {message ? (
        <div
          className={`${styles.notice} ${styles.toast} ${message.error ? styles.error : ""}`}
          role="status"
        >
          {message.text}
        </div>
      ) : null}
      {shareUrl ? (
        <div className={`${styles.notice} ${styles.toast} ${styles.toastBottom}`}>
          <input
            className={styles.input}
            readOnly
            value={shareUrl}
            aria-label="Share link"
            onFocus={(event) => event.target.select()}
          />
          <button
            type="button"
            className={styles.btn}
            onClick={() => setShareUrl(null)}
          >
            Close
          </button>
        </div>
      ) : null}
      {undo ? (
        <div className={`${styles.notice} ${styles.toast} ${styles.toastBottom}`} role="status">
          Deleted “{undo.matchup.label}”
          <button type="button" className={styles.btn} onClick={undoDelete}>
            Undo
          </button>
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <h1 className={styles.title}>Sideboard guide</h1>
        <button
          type="button"
          className={styles.btn}
          aria-expanded={showDeck}
          onClick={() => setDeckOpen(!showDeck)}
        >
          {showDeck ? "Hide decklist" : "Decklist"}
        </button>
        {plan.hidden.length > 0 ? (
          <button
            type="button"
            className={styles.btn}
            onClick={() => setHiddenOpen(true)}
          >
            {plan.hidden.length} hidden
          </button>
        ) : null}
        <button
          type="button"
          className={styles.btn}
          onClick={() => setView("print")}
        >
          Print view
        </button>
        <button type="button" className={styles.btn} onClick={share}>
          Share link
        </button>
        <button type="button" className={styles.btn} onClick={() => setClearing(true)}>
          Clear all
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            setSaves(readSaves());
            setSavedOpen(true);
          }}
        >
          My plans
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={importJson}
        />
        <label className={styles.sizeLabel}>
          Column size
          <input
            type="range"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={plan.size}
            onChange={(event) =>
              setPlan((current) => setSize(current, Number(event.target.value)))
            }
          />
        </label>
      </div>

      {showDeck ? (
        <div className={styles.deck}>
          <textarea
            className={styles.textarea}
            value={draft}
            placeholder={
              "1 Lightning Bolt\n...\n\nSideboard\n1 Toxic Deluge\n..."
            }
            aria-label="Decklist"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className={styles.deckActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={applyDecklist}
            >
              {hasColumns ? "Update decklist" : "Build grid"}
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        message={
          clearing
            ? "Clear everything? This removes the decklist, every matchup and all ticks and hidden cards, and can't be undone. Save it under My plans or export it to a file first if you want a copy."
            : null
        }
        confirmLabel="Clear all"
        onConfirm={clearAll}
        onCancel={() => setClearing(false)}
      />

      <ConfirmDialog
        message={replacing ? `A plan called “${replacing.name}” is already saved. Replace it?` : null}
        confirmLabel="Replace"
        onConfirm={() => {
          const request = replacing;
          setReplacing(null);
          if (request) {
            commitSave(request.name, request.andThen);
          }
        }}
        onCancel={() => setReplacing(null)}
      />

      <ConfirmDialog
        message={deleting ? `Delete the saved plan “${deleting.name}”? This can't be undone.` : null}
        confirmLabel="Delete"
        onConfirm={() => {
          const save = deleting;
          setDeleting(null);
          if (save) {
            deleteSave(save);
          }
        }}
        onCancel={() => setDeleting(null)}
      />

      {savedOpen ? (
        <SavedPlansDialog
          saves={saves}
          onSave={(name) => saveAs(name)}
          onLoad={(save) => {
            setSavedOpen(false);
            replaceWith(save.plan, `Loaded “${save.name}”.`);
          }}
          onDelete={setDeleting}
          onExport={exportJson}
          onImport={() => {
            setSavedOpen(false);
            importRef.current?.click();
          }}
          onClose={() => setSavedOpen(false)}
        />
      ) : null}

      {pending ? (
        <SavePrompt
          onSave={(name) =>
            saveAs(name, () => {
              replacePlan(pending.next);
              flash(`Saved “${name.trim()}”. ${pending.notice}`);
              setPending(null);
            })
          }
          onDiscard={() => {
            replacePlan(pending.next);
            flash(pending.notice);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      ) : null}

      <HiddenDialog
        plan={plan}
        open={hiddenOpen}
        onClose={() => setHiddenOpen(false)}
        onShow={(id) => setPlan((current) => showColumn(current, id))}
        onShowAll={() => setPlan(showAllColumns)}
      />

      {hasColumns ? (
        <Grid
          plan={plan}
          printView={false}
          onPlan={setPlan}
          onDelete={onDelete}
          onAdd={addRow}
          focusId={focusId}
          onFocused={clearFocus}
        />
      ) : (
        <p className={styles.empty}>
          Paste a decklist and build the grid, then add the matchups you want to
          plan for.
        </p>
      )}
    </div>
  );
}

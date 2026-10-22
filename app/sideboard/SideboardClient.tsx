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
import { decodeShare, encodeShare, parsePlan, planToJson } from "./share";
import styles from "./sideboard.module.css";

const STORAGE_KEY = "sideboard-plan";
const SHARE_PREFIX = "#plan=";
const UNDO_MS = 6000;
// the paper the grid is fitted to, in px: a landscape page with margins, for the smaller of Letter and A4
const PAPER_WIDTH = 960;
const PAPER_HEIGHT = 690;
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
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const landNames = useMemo(() => (landNameList ? new Set(landNameList) : null), [landNameList]);
  const [undo, setUndo] = useState<{ matchup: Matchup; index: number } | null>(
    null,
  );
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
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
      if (window.location.hash.startsWith(SHARE_PREFIX)) {
        const result = await decodeShare(
          window.location.hash.slice(SHARE_PREFIX.length),
        );
        if (!result.ok) {
          setMessage({
            text: "That share link doesn't hold a plan.",
            error: true,
          });
        } else if (
          !stored ||
          isBlank(stored) ||
          window.confirm("Replace your saved plan with the shared one?")
        ) {
          next = result.plan;
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

  async function share() {
    const url = `${window.location.origin}${window.location.pathname}${SHARE_PREFIX}${await encodeShare(plan)}`;
    setShareUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      setMessage({ text: "Share link copied." });
    } catch {
      setMessage({ text: "Copy the share link below." });
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
      replacePlan(result.plan);
      setMessage({ text: "Plan imported." });
    } else {
      setMessage({ text: result.error, error: true });
    }
  }

  const hasColumns = plan.columns.length > 0;

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
      <details className={styles.deck} open={!hasColumns}>
        <summary>Decklist</summary>
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
            onClick={() =>
              setPlan((current) =>
                setDecklist(
                  current,
                  draft,
                  (name) => isBasicLand(name) || isListedLand(landNames, name),
                ),
              )
            }
          >
            {hasColumns ? "Update decklist" : "Build grid"}
          </button>
        </div>
      </details>

      {message ? (
        <div
          className={`${styles.notice} ${message.error ? styles.error : ""}`}
          role="status"
        >
          {message.text}
          <button
            type="button"
            className={styles.btn}
            onClick={() => setMessage(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {shareUrl ? (
        <div className={styles.notice}>
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
        <div className={styles.notice} role="status">
          Deleted “{undo.matchup.label}”
          <button type="button" className={styles.btn} onClick={undoDelete}>
            Undo
          </button>
        </div>
      ) : null}

      <div className={styles.toolbar}>
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
        <button type="button" className={styles.btn} onClick={exportJson}>
          Export
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => importRef.current?.click()}
        >
          Import
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={importJson}
        />
      </div>

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

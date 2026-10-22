"use client";

import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { countMatchup, printColumns } from "./counts";
import type { Column } from "./deck";
import { cycleCell, hideColumn, moveColumn, moveMatchup, renameMatchup, type Matchup, type Plan } from "./plan";
import styles from "./sideboard.module.css";

type Drag = { kind: "col" | "row"; id: string } | null;

// what `over` holds while a column is over the target for hiding it
const HIDE_ZONE = "hide-zone";

type Props = {
  plan: Plan;
  // the print view is the grid as it goes on paper: nothing to edit, and only the columns that are used
  printView: boolean;
  onPlan: (change: (plan: Plan) => Plan) => void;
  onDelete: (matchup: Matchup, index: number) => void;
  onAdd: () => void;
  // a matchup whose name should be typed into now, and the call that says it has been
  focusId: string | null;
  onFocused: () => void;
};

export function Grid({ plan, printView, onPlan, onDelete, onAdd, focusId, onFocused }: Props) {
  const [drag, setDrag] = useState<Drag>(null);
  const [over, setOver] = useState<string | null>(null);
  const nameInputs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    if (focusId) {
      nameInputs.current.get(focusId)?.focus();
      onFocused();
    }
  }, [focusId, onFocused]);

  const hidden = new Set(plan.hidden);
  const shown = printView ? printColumns(plan) : plan.columns.filter((column) => !hidden.has(column.id));
  const side = shown.filter((column) => column.board === "side");
  const main = shown.filter((column) => column.board === "main");
  const boardOf = new Map(plan.columns.map((column) => [column.id, column.board]));

  function startDrag(event: DragEvent, kind: "col" | "row", id: string) {
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
    setDrag({ kind, id });
  }

  function endDrag() {
    setDrag(null);
    setOver(null);
  }

  function overColumn(event: DragEvent, id: string) {
    if (drag?.kind === "col" && boardOf.get(drag.id) === boardOf.get(id)) {
      event.preventDefault();
      setOver(id);
    }
  }

  function dropColumn(id: string) {
    if (drag?.kind === "col") {
      const from = drag.id;
      onPlan((current) => moveColumn(current, from, id));
    }
    endDrag();
  }

  function dropRow(index: number) {
    if (drag?.kind === "row") {
      const from = drag.id;
      onPlan((current) => moveMatchup(current, from, index));
    }
    endDrag();
  }

  // each column's left edge is a line that runs up the header and turns to follow the labels
  function header(column: Column) {
    const editable = !printView;
    return (
      <th
        key={column.id}
        className={`${styles.edge} ${styles.col} ${column.board === "side" ? styles.side : ""} ${over === column.id ? styles.dropHere : ""}`}
        onDragOver={(event) => overColumn(event, column.id)}
        onDrop={() => dropColumn(column.id)}
      >
        <div className={styles.labelAnchor}>
          <div
            className={styles.label}
            title={column.name}
            draggable={editable}
            onDragStart={(event) => startDrag(event, "col", column.id)}
            onDragEnd={endDrag}
          >
            {column.name}
          </div>
        </div>
      </th>
    );
  }

  function cell(matchup: Matchup, column: Column) {
    const state = matchup.cells[column.id];
    return (
      <td key={column.id} className={`${styles.col} ${column.board === "side" ? styles.side : ""}`}>
        {printView ? (
          <div className={`${styles.cell} ${state ? styles[state] : ""}`}>
            <span className={styles.box}>{state ? "✓" : ""}</span>
          </div>
        ) : (
          <button
            type="button"
            className={`${styles.cell} ${state ? styles[state] : ""}`}
            role="checkbox"
            aria-checked={state === "in" ? true : state === "maybe" ? "mixed" : false}
            aria-label={`${matchup.label}: ${column.name}`}
            onClick={() => onPlan((current) => cycleCell(current, matchup.id, column.id))}
          >
            <span className={styles.box}>{state ? "✓" : ""}</span>
          </button>
        )}
      </td>
    );
  }

  const isLast = (index: number) => index === plan.matchups.length - 1;
  // a maindeck column being dragged can be dropped on a target to hide it
  const hidingColumn = drag?.kind === "col" && boardOf.get(drag.id) === "main";

  return (
    <div className={`${styles.scroller} ${printView ? styles.printView : ""}`} style={{ "--size": `${plan.size}px` } as CSSProperties}>
      <table className={styles.grid}>
        <thead>
          <tr className={styles.headRow}>
            <th className={styles.stickyA}>
              <div className={styles.headA}>
                <span>Matchup</span>
                <span>In / out</span>
              </div>
            </th>
            {side.map(header)}
            {side.length > 0 && main.length > 0 ? <th className={`${styles.divider} ${styles.edge}`} /> : null}
            {main.map(header)}
            <th className={`${styles.tail} ${styles.edge}`} />
          </tr>
        </thead>
        <tbody>
          {plan.matchups.map((matchup, index) => {
            const count = countMatchup(plan, matchup);
            const countCell = (
              <span className={`${styles.count} ${count.balanced ? "" : styles.unbalanced}`}>
                {count.in} / {count.out}
              </span>
            );
            return (
              <tr
                key={matchup.id}
                className={`${styles.row} ${drag?.kind === "row" && over === matchup.id ? styles.dropRow : ""}`}
                onDragOver={(event) => {
                  if (drag?.kind === "row") {
                    event.preventDefault();
                    setOver(matchup.id);
                  }
                }}
                onDrop={() => dropRow(index)}
              >
                <td className={styles.stickyA}>
                  {printView ? (
                    <div className={styles.rowEdit}>
                      <b className={styles.matchupLabel}>{matchup.label}</b>
                      {countCell}
                    </div>
                  ) : (
                    <div className={styles.rowEdit}>
                      <span
                        className={styles.handle}
                        draggable
                        title="Drag to reorder"
                        onDragStart={(event) => startDrag(event, "row", matchup.id)}
                        onDragEnd={endDrag}
                      >
                        ⠿
                      </span>
                      {/* the input is as wide as the name in it: the span's text is a copy that sets the width */}
                      <span className={styles.sizer} data-value={matchup.label}>
                        <input
                          className={styles.matchupName}
                          key={`label-${matchup.label}`}
                          ref={(input) => {
                            if (input) {
                              nameInputs.current.set(matchup.id, input);
                            } else {
                              nameInputs.current.delete(matchup.id);
                            }
                          }}
                          defaultValue={matchup.label}
                          placeholder="Name"
                          aria-label="Matchup name"
                          onInput={(event) => {
                            event.currentTarget.parentElement?.setAttribute("data-value", event.currentTarget.value);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              // naming the last row opens the next one, so a list can be typed in a run
                              if (isLast(index) && event.currentTarget.value.trim() !== "") {
                                const label = event.currentTarget.value;
                                onPlan((current) => renameMatchup(current, matchup.id, label));
                                onAdd();
                              } else {
                                event.currentTarget.blur();
                              }
                            } else if (event.key === "Escape") {
                              event.currentTarget.value = matchup.label;
                              event.currentTarget.blur();
                            }
                          }}
                          onBlur={(event) => {
                            const label = event.currentTarget.value;
                            onPlan((current) => renameMatchup(current, matchup.id, label));
                          }}
                        />
                      </span>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        aria-label={`Delete ${matchup.label}`}
                        title="Delete this matchup"
                        onClick={() => onDelete(matchup, index)}
                      >
                        ×
                      </button>
                      {countCell}
                    </div>
                  )}
                </td>
                {side.map((column) => cell(matchup, column))}
                {side.length > 0 && main.length > 0 ? <td className={styles.divider} /> : null}
                {main.map((column) => cell(matchup, column))}
                <td />
              </tr>
            );
          })}
        </tbody>
      </table>
      {hidingColumn ? (
        <div
          className={`${styles.hideZone} ${over === HIDE_ZONE ? styles.hideZoneOver : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(HIDE_ZONE);
          }}
          onDragLeave={() => setOver(null)}
          onDrop={() => {
            if (drag) {
              const id = drag.id;
              onPlan((current) => hideColumn(current, id));
            }
            endDrag();
          }}
        >
          Drop here to hide
        </div>
      ) : null}
      {printView ? null : (
        <div className={styles.addRow}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onAdd}>
            + Add matchup
          </button>
        </div>
      )}
    </div>
  );
}

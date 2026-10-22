"use client";

import { useState, type CSSProperties, type DragEvent } from "react";
import { countMatchup, printColumns } from "./counts";
import type { Column } from "./deck";
import { cycleCell, hideColumn, moveColumn, moveMatchup, renameMatchup, setNote, type Matchup, type Plan } from "./plan";
import styles from "./sideboard.module.css";

type Drag = { kind: "col" | "row"; id: string } | null;

type Props = {
  plan: Plan;
  // the print view is the grid as it goes on paper: nothing to edit, and only the columns that are used
  printView: boolean;
  onPlan: (change: (plan: Plan) => Plan) => void;
  onDelete: (matchup: Matchup, index: number) => void;
};

export function Grid({ plan, printView, onPlan, onDelete }: Props) {
  const [drag, setDrag] = useState<Drag>(null);
  const [over, setOver] = useState<string | null>(null);

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

  function header(column: Column) {
    const editable = !printView;
    return (
      <th
        key={column.id}
        className={`${styles.col} ${column.board === "side" ? styles.side : ""} ${over === column.id ? styles.dropHere : ""}`}
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
        {editable && column.board === "main" ? (
          <button
            type="button"
            className={styles.hideBtn}
            aria-label={`Hide ${column.name}`}
            title="Hide this card"
            onClick={() => onPlan((current) => hideColumn(current, column.id))}
          >
            ×
          </button>
        ) : null}
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

  return (
    <div className={`${styles.scroller} ${printView ? styles.printView : ""}`} style={{ "--size": `${plan.size}px` } as CSSProperties}>
      <table className={styles.grid}>
        <thead>
          <tr className={styles.headRow}>
            <th className={styles.stickyA}>Matchup</th>
            <th className={styles.stickyB}>In / out</th>
            {side.map(header)}
            {side.length > 0 && main.length > 0 ? <th className={styles.divider} /> : null}
            {main.map(header)}
            <th className={styles.tail} />
          </tr>
        </thead>
        <tbody>
          {plan.matchups.map((matchup, index) => {
            const count = countMatchup(plan, matchup);
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
                    <div className={styles.matchupText}>
                      <b>{matchup.label}</b>
                      {matchup.note ? <i>{matchup.note}</i> : null}
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
                      <input
                        className={styles.matchupName}
                        key={`label-${matchup.label}`}
                        defaultValue={matchup.label}
                        aria-label="Matchup name"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
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
                      <input
                        className={styles.matchupNote}
                        key={`note-${matchup.note}`}
                        defaultValue={matchup.note}
                        placeholder="note"
                        aria-label={`Note for ${matchup.label}`}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                        }}
                        onBlur={(event) => {
                          const note = event.currentTarget.value;
                          onPlan((current) => setNote(current, matchup.id, note));
                        }}
                      />
                      <button
                        type="button"
                        className={styles.iconBtn}
                        aria-label={`Delete ${matchup.label}`}
                        title="Delete this matchup"
                        onClick={() => onDelete(matchup, index)}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </td>
                <td className={`${styles.stickyB} ${styles.count} ${count.balanced ? "" : styles.unbalanced}`}>
                  {count.in} / {count.out}
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
    </div>
  );
}

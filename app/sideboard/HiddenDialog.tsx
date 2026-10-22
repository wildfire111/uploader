"use client";

import { useEffect, useRef } from "react";
import type { Plan } from "./plan";
import styles from "./sideboard.module.css";

// The hidden cards, each with a button to bring it back, and one to bring them all back.
export function HiddenDialog({
  plan,
  open,
  onClose,
  onShow,
  onShowAll,
}: {
  plan: Plan;
  open: boolean;
  onClose: () => void;
  onShow: (id: string) => void;
  onShowAll: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const hidden = new Set(plan.hidden);
  const cards = plan.columns.filter((column) => hidden.has(column.id));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && open && !dialog.open) {
      dialog.showModal();
    } else if (dialog && !open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // nothing left to list
  useEffect(() => {
    if (open && cards.length === 0) {
      onClose();
    }
  });

  // a card with several copies lists as one row per copy, numbered
  const copiesOf = new Map<string, number>();
  for (const column of plan.columns) {
    copiesOf.set(
      column.name,
      (copiesOf.get(column.name) ?? 0) + (column.board === "main" ? 1 : 0),
    );
  }
  const seen = new Map<string, number>();

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label="Hidden cards"
      onClose={onClose}
    >
      <div className={styles.dialogHead}>
        <strong>
          {cards.length} hidden {cards.length === 1 ? "card" : "cards"}
        </strong>
        <button type="button" className={styles.btn} onClick={onShowAll}>
          Unhide all
        </button>
        <button type="button" className={styles.btn} onClick={onClose}>
          Close
        </button>
      </div>
      <ul className={styles.hiddenList}>
        {cards.map((column) => {
          const copy = (seen.get(column.name) ?? 0) + 1;
          seen.set(column.name, copy);
          const label =
            (copiesOf.get(column.name) ?? 1) > 1
              ? `${column.name} (${copy})`
              : column.name;
          return (
            <li key={column.id}>
              <span>{label}</span>
              <button
                type="button"
                className={styles.btn}
                onClick={() => onShow(column.id)}
              >
                Unhide
              </button>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { noAutofill } from "./noAutofill";
import type { SavedPlan } from "./saves";
import styles from "./sideboard.module.css";

// The plans saved in this browser: a name box to save the current plan under, and each save with
// buttons to load or delete it. Mounted only while it is open, so the name box starts empty.
export function SavedPlansDialog({
  saves,
  onSave,
  onLoad,
  onDelete,
  onExport,
  onClose,
}: {
  saves: SavedPlan[];
  onSave: (name: string) => void;
  onLoad: (save: SavedPlan) => void;
  onDelete: (save: SavedPlan) => void;
  onExport: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  return (
    <dialog ref={dialogRef} className={`${styles.dialog} ${styles.dialogWide}`} aria-label="Saved plans" onClose={onClose}>
      <div className={styles.dialogHead}>
        <strong>Saved plans</strong>
        <button type="button" className={styles.btn} onClick={onClose}>
          Close
        </button>
      </div>
      <form
        className={styles.rowForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() !== "") {
            onSave(name);
          }
        }}
      >
        <input
          className={styles.input}
          style={{ flex: 1 }}
          value={name}
          placeholder="Name for the current plan"
          aria-label="Name for the current plan"
          onChange={(event) => setName(event.target.value)}
          {...noAutofill}
        />
        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={name.trim() === ""}>
          Save
        </button>
      </form>
      <p className={styles.savesNote}>
        Saved plans live in this browser only. Clearing site data deletes them, and so does a different browser or
        device. Export is the only permanent copy.{" "}
        <button type="button" className={styles.btn} onClick={onExport}>
          Export
        </button>
      </p>
      {saves.length === 0 ? (
        <p className={styles.empty}>Nothing saved yet.</p>
      ) : (
        <ul className={styles.hiddenList}>
          {saves.map((save) => (
            <li key={save.name}>
              <span>
                {save.name} <small className={styles.savesNote}>{new Date(save.savedAt).toLocaleDateString()}</small>
              </span>
              <span className={styles.dialogHead}>
                <button type="button" className={styles.btn} onClick={() => onLoad(save)}>
                  Load
                </button>
                <button type="button" className={styles.btn} onClick={() => onDelete(save)}>
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </dialog>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { noAutofill } from "./noAutofill";
import styles from "./sideboard.module.css";

// Offered before the current plan is replaced by another: save it under a name first, replace it
// without saving, or leave it alone. Mounted only while it is open, so the name box starts empty.
export function SavePrompt({
  onSave,
  onDiscard,
  onCancel,
}: {
  onSave: (name: string) => void;
  onDiscard: () => void;
  onCancel: () => void;
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
    <dialog ref={dialogRef} className={styles.dialog} aria-label="Save your plan first" onClose={onCancel}>
      <p>Save your current plan before it is replaced?</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() !== "") {
            onSave(name);
          }
        }}
      >
        <input
          className={styles.input}
          style={{ width: "100%" }}
          value={name}
          placeholder="Name for the current plan"
          aria-label="Name for the current plan"
          onChange={(event) => setName(event.target.value)}
          {...noAutofill}
        />
        <div className={styles.dialogHead} style={{ marginTop: 12, marginBottom: 0 }}>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={name.trim() === ""}>
            Save and continue
          </button>
          <button type="button" className={styles.btn} onClick={onDiscard}>
            Don’t save
          </button>
          <button type="button" className={styles.btn} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}

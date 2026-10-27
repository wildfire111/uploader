"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { NOTE_MAX } from "./plan";
import styles from "./sideboard.module.css";

// the print note's text starts at this size (px) and is shrunk to fit its box, down to the floor
const PRINT_START = 12;
const PRINT_FLOOR = (5 * 96) / 72;
const PRINT_STEP = 0.5;
const PRINT_LINE = 1.15;

type Props = {
  note: string | undefined;
  label: string;
  onNote: (note: string) => void;
};

// the notes cell on screen: an add button, then a clamped preview that opens as a box to type in.
// The full text is in the hover tooltip.
export function NoteEditor({ note, label, onNote }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <textarea
        className={`${styles.noteBox} ${styles.noteInput}`}
        autoFocus
        defaultValue={note ?? ""}
        maxLength={NOTE_MAX}
        aria-label={`Note for ${label || "this matchup"}`}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            // the draft is dropped: blur saves what is in the box, so put the saved note back first
            event.currentTarget.value = note ?? "";
            event.currentTarget.blur();
          }
        }}
        onBlur={(event) => {
          onNote(event.currentTarget.value);
          setEditing(false);
        }}
      />
    );
  }
  if (!note) {
    return (
      <button type="button" className={styles.noteAdd} onClick={() => setEditing(true)}>
        + Note
      </button>
    );
  }
  return (
    <div className={styles.noteTip} data-note={note}>
      <div
        className={`${styles.noteBox} ${styles.notePreview}`}
        role="button"
        tabIndex={0}
        aria-label={`Note for ${label || "this matchup"}: ${note}`}
        onClick={() => setEditing(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setEditing(true);
          }
        }}
      >
        {note}
      </div>
    </div>
  );
}

// the notes cell on paper: the text is made smaller until it fits the box, so the row stays its height.
// Below the floor what doesn't fit is cut with an ellipsis.
export function PrintNote({ note }: { note: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) {
      return;
    }
    const fit = () => {
      box.style.webkitLineClamp = "";
      box.style.display = "";
      let size = PRINT_START;
      box.style.fontSize = `${size}px`;
      while (size - PRINT_STEP >= PRINT_FLOOR && box.scrollHeight > box.clientHeight) {
        size -= PRINT_STEP;
        box.style.fontSize = `${size}px`;
      }
      if (box.scrollHeight > box.clientHeight) {
        box.style.display = "-webkit-box";
        box.style.webkitLineClamp = String(Math.max(1, Math.floor(box.clientHeight / (size * PRINT_LINE))));
      }
    };
    fit();
    // measured again once the page's font is in
    void document.fonts?.ready.then(fit);
  }, [note]);

  return (
    <div className={styles.noteTip} data-note={note}>
      <div ref={ref} className={`${styles.noteBox} ${styles.notePrint}`}>
        {note}
      </div>
    </div>
  );
}

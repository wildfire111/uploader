"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { NOTE_MAX } from "./plan";
import styles from "./sideboard.module.css";

// the print note's text starts at this size (px) and is shrunk to fit its box, down to the floor
const PRINT_START = 12;
const PRINT_FLOOR = (5 * 96) / 72;
const PRINT_STEP = 0.5;
const PRINT_LINE = 1.15;
// the box's padding top and bottom, which the text doesn't get
const PRINT_PAD = 4;

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
// A note that doesn't fit even at the floor is marked, and growNotes may give its row more height.
export function PrintNote({ note }: { note: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) {
      return;
    }
    const fit = () => {
      box.style.removeProperty("--grow");
      box.style.webkitLineClamp = "";
      box.style.display = "";
      delete box.dataset.floor;
      let size = PRINT_START;
      box.style.fontSize = `${size}px`;
      while (size - PRINT_STEP >= PRINT_FLOOR && box.scrollHeight > box.clientHeight) {
        size -= PRINT_STEP;
        box.style.fontSize = `${size}px`;
      }
      if (box.scrollHeight > box.clientHeight) {
        box.dataset.floor = String(size);
      }
    };
    fit();
    // measured again once the page's font is in, and the page is told so it can share out height again
    void document.fonts?.ready.then(() => {
      fit();
      box.dispatchEvent(new Event(NOTES_FITTED, { bubbles: true }));
    });
  }, [note]);

  return (
    <div className={styles.noteTip} data-note={note}>
      <div ref={ref} className={`${styles.noteBox} ${styles.notePrint}`}>
        {note}
      </div>
    </div>
  );
}

// sent up from a print note when it has been sized again after the fact
export const NOTES_FITTED = "notesfitted";

// Notes that are still too long at the smallest size get taller rows, up to `spare` px in all. The
// height goes a pixel at a time to the note with the most cut off, so the worst fitting ones are
// helped first. A note that gets less than it needs is cut off with an ellipsis.
export function growNotes(root: HTMLElement, spare: number) {
  const items = [...root.querySelectorAll<HTMLElement>("[data-floor]")].map((box) => {
    box.style.removeProperty("--grow");
    box.style.webkitLineClamp = "";
    box.style.display = "";
    const base = box.clientHeight;
    return { box, base, need: Math.max(0, box.scrollHeight - base), grow: 0, size: Number(box.dataset.floor) };
  });
  for (let left = spare; left > 0; left--) {
    let worst: (typeof items)[number] | null = null;
    for (const item of items) {
      if (item.need > item.grow && (!worst || item.need - item.grow > worst.need - worst.grow)) {
        worst = item;
      }
    }
    if (!worst) {
      break;
    }
    worst.grow++;
  }
  for (const { box, base, need, grow, size } of items) {
    box.style.setProperty("--grow", `${grow}px`);
    if (grow < need) {
      const lines = Math.floor((base + grow - PRINT_PAD) / (size * PRINT_LINE));
      box.style.display = "-webkit-box";
      box.style.webkitLineClamp = String(Math.max(1, lines));
    }
  }
}

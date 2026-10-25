"use client";

import { useDeferredValue, useLayoutEffect, useMemo, useRef } from "react";
import { markDecklistLines, type MarkedLine } from "@/lib/decklist/analyse";
import type { CheckLists } from "@/lib/decklist/types";

// the side-card count goes on the first divider, where the sideboard starts
function sideboardSize(lines: MarkedLine[]): number {
  return lines.reduce((sum, { card, board }) => (card && board === "side" ? sum + (card.companion ? 1 : card.quantity) : sum), 0);
}

function tagFor(line: MarkedLine, sideboardCount: number | null): string | undefined {
  if (line.role === "divider") {
    return sideboardCount === null ? undefined : `Sideboard · ${sideboardCount}`;
  }
  const parts = [line.companion && line.card ? "companion" : null, line.points ? `${line.points} pts` : null];
  return parts.filter(Boolean).join(" · ") || undefined;
}

function classNameFor(line: MarkedLine): string {
  const classes = ["dl-line"];
  if (line.role === "divider") {
    classes.push("dl-divider");
  } else if (line.role === "ignored") {
    classes.push("dl-ignored");
  }
  if (line.board === "side") {
    classes.push("dl-side");
  }
  if (line.unknown || line.reserved) {
    classes.push("dl-error");
  } else if (line.repeated) {
    classes.push("dl-repeated");
  }
  return classes.join(" ");
}

// The decklist text, line by line, shaded the way the parser read it: sideboard lines tinted, the
// line that starts the sideboard marked, lines it skipped dimmed, unknown and repeated cards
// flagged. The text is the user's own, unchanged, so this can sit exactly under a textarea.
export function DecklistView({
  raw,
  lists,
  typing = false,
}: {
  raw: string;
  lists: CheckLists;
  // the last line may be half typed, so it isn't checked yet
  typing?: boolean;
}) {
  const deferred = useDeferredValue(raw);
  const lines = useMemo(() => markDecklistLines(deferred, lists, !typing), [deferred, lists, typing]);
  const text = deferred.split(/\r?\n/);
  const firstDivider = lines.findIndex((line) => line.role === "divider");
  const count = sideboardSize(lines);

  return (
    <>
      {lines.map((line, index) => (
        <div
          key={index}
          className={classNameFor(line)}
          data-tag={tagFor(line, index === firstDivider ? count : null)}
        >
          {/* a zero-width space keeps an empty line its height */}
          {text[index]}
          {"​"}
        </div>
      ))}
    </>
  );
}

// A textarea with the DecklistView behind it. The textarea's own text is hidden and the view's is
// shown in its place, so the shading lines up with what is typed, wrapping and scrolling included.
export function DecklistEditor({
  value,
  lists,
  typing,
  ...textareaProps
}: {
  value: string;
  lists: CheckLists;
  typing: boolean;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value">) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const syncScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };
  useLayoutEffect(syncScroll, [value]);

  return (
    <div className="decklist-editor">
      <div className="decklist-backdrop" ref={backdropRef} aria-hidden>
        <DecklistView raw={value} lists={lists} typing={typing} />
      </div>
      <textarea {...textareaProps} ref={textareaRef} value={value} onScroll={syncScroll} />
    </div>
  );
}

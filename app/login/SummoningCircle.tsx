"use client";

import { Noto_Sans_Runic } from "next/font/google";
import { useState, type ReactNode } from "react";
import { requestMagicLink } from "@/lib/actions/auth";
import { SubmitButton } from "./SubmitButton";
import styles from "./circle.module.css";

const runeFace = Noto_Sans_Runic({ weight: "400", subsets: ["runic"] });

// the first twelve Elder Futhark runes, laid clockwise from the top
const RUNES = Array.from("ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ");
const SEGMENTS = RUNES.length;
const CENTRE = 300;
const RUNE_RADIUS = 205;
const ARC_RADIUS = 238;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// rounded, because the server and the browser disagree about the last digits of sin and cos
const round = (value: number) => Math.round(value * 100) / 100;

function polar(radius: number, degrees: number) {
  const angle = ((degrees - 90) * Math.PI) / 180;
  return { x: round(CENTRE + radius * Math.cos(angle)), y: round(CENTRE + radius * Math.sin(angle)) };
}

const ARCS = RUNES.map((_, i) => {
  const from = polar(ARC_RADIUS, i * 30 + 3);
  const to = polar(ARC_RADIUS, (i + 1) * 30 - 3);
  return `M${from.x} ${from.y} A${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${to.x} ${to.y}`;
});

const RUNE_POSITIONS = RUNES.map((_, i) => polar(RUNE_RADIUS, i * 30 + 15));

const TICKS = Array.from({ length: 72 }, (_, i) => {
  const outer = polar(270, i * 5);
  const inner = polar(i % 6 === 0 ? 256 : 263, i * 5);
  return { outer, inner };
});

// how many runes an address has earned: a few for the name, one for the @, a few for the
// domain, one for the dot and a few for the ending. A valid address completes the ring.
function earnedRunes(value: string): number {
  if (EMAIL.test(value)) return SEGMENTS;
  const at = value.indexOf("@");
  const local = at < 0 ? value : value.slice(0, at);
  const rest = at < 0 ? "" : value.slice(at + 1);
  const dot = rest.lastIndexOf(".");
  const domain = dot < 0 ? rest : rest.slice(0, dot);
  const ending = dot < 0 ? "" : rest.slice(dot + 1);

  let earned = Math.min(4, local.length);
  if (local.length > 0 && at >= 0) {
    earned += 1 + Math.min(3, domain.length);
    if (domain.length > 0 && dot >= 0) earned += 1 + Math.min(3, ending.length);
  }
  return Math.min(SEGMENTS - 1, earned);
}

export function SummoningCircle({ sent }: { sent: boolean }) {
  const [email, setEmail] = useState("");
  const [casting, setCasting] = useState(false);

  const valid = EMAIL.test(email);
  const lit = sent ? SEGMENTS : earnedRunes(email);
  const charged = sent || valid;

  const rootClass = [
    styles.circle,
    charged ? styles.charged : "",
    casting ? styles.casting : "",
    sent ? styles.sent : "",
  ].join(" ");

  let core: ReactNode;
  if (sent) {
    core = (
      <div>
        <h1>Log in</h1>
        <p className={styles.sentMessage}>Check your email for a login link.</p>
      </div>
    );
  } else {
    core = (
      <form action={requestMagicLink} onSubmit={() => setCasting(true)}>
        <h1>Log in</h1>
        <p className={styles.note}>Entry is by invitation only.</p>
        <label htmlFor="email">
          Email
          <input
            type="email"
            id="email"
            name="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <SubmitButton idleText="Send login link" pendingText="Sending…" />
        <span className="sr-only" aria-live="polite">
          {valid ? "That email address looks complete." : ""}
        </span>
      </form>
    );
  }

  return (
    <div className={rootClass}>
      <svg viewBox="0 0 600 600" aria-hidden="true">
        <g className={styles.spinSlow}>
          <circle cx={CENTRE} cy={CENTRE} r="292" className={styles.outerRing} />
          <circle cx={CENTRE} cy={CENTRE} r="284" className={styles.hairRing} />
          {TICKS.map((tick, i) => (
            <line key={i} x1={tick.outer.x} y1={tick.outer.y} x2={tick.inner.x} y2={tick.inner.y} className={styles.tick} />
          ))}
        </g>
        <circle cx={CENTRE} cy={CENTRE} r="250" className={styles.hairRing} />
        {ARCS.map((d, i) => (
          <path key={i} d={d} className={`${styles.segment} ${i < lit ? styles.lit : ""}`} />
        ))}
        {RUNES.map((rune, i) => (
          <g key={i} transform={`translate(${RUNE_POSITIONS[i].x} ${RUNE_POSITIONS[i].y})`}>
            <circle r="8" className={`${styles.spark} ${i < lit ? styles.lit : ""}`} />
            <text
              className={`${styles.rune} ${runeFace.className} ${i < lit ? styles.lit : ""}`}
              style={{ "--i": i } as React.CSSProperties}
            >
              {rune}
            </text>
          </g>
        ))}
        <g className={styles.spinReverse}>
          <circle cx={CENTRE} cy={CENTRE} r="176" className={styles.sigil} />
          <path d="M300 124 L452.3 388 L147.7 388 Z" className={styles.sigil} />
          <path d="M300 476 L147.7 212 L452.3 212 Z" className={styles.sigil} />
        </g>
        <circle cx={CENTRE} cy={CENTRE} r="152" className={styles.coreRing} />
        <circle cx={CENTRE} cy={CENTRE} r="152" className={styles.shock} />
        <circle cx={CENTRE} cy={CENTRE} r="152" className={`${styles.shock} ${styles.shockLate}`} />
      </svg>
      <div className={styles.core}>{core}</div>
    </div>
  );
}

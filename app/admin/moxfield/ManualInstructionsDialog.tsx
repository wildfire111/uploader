"use client";

import { useRef } from "react";

export function ManualInstructionsDialog({ exampleToken }: { exampleToken: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <p>
        <strong>Option B: copy the token by hand.</strong> If you don&apos;t want to add a
        bookmark, or it doesn&apos;t work, follow{" "}
        <button
          type="button"
          className="underline text-link hover:text-link-hover !border-0 !bg-transparent !p-0"
          onClick={() => dialogRef.current?.showModal()}
        >
          these instructions
        </button>{" "}
        and paste the token in the box below.
      </p>

      <dialog
        ref={dialogRef}
        className="m-auto max-w-[560px] rounded-md border border-line bg-panel p-5 text-ink backdrop:bg-black/60"
        onClick={(event) => {
          // a click on the backdrop lands on the dialog element itself
          if (event.target === dialogRef.current) {
            dialogRef.current.close();
          }
        }}
      >
        <h2>Get the token by hand</h2>
        <ol>
          <li>Log in at moxfield.com in your browser, as the account the decks should go to.</li>
          <li>Open DevTools (F12) and go to the Network tab, then reload the page.</li>
          <li>
            Click the request named <code>authenticated</code> (under <code>startup</code>) and
            open its Response tab.
          </li>
          <li>
            Inside the <code>refresh</code> object, copy the value of <code>refresh_token</code>{" "}
            (just the value, not the quotes).
          </li>
        </ol>
        <p>
          It looks like <code>{exampleToken}</code>: 36 letters, digits and dashes. Don&apos;t copy{" "}
          <code>access_token</code> by mistake — that one is much longer and starts with{" "}
          <code>eyJ</code>.
        </p>
        <button type="button" onClick={() => dialogRef.current?.close()}>
          Close
        </button>
      </dialog>
    </>
  );
}

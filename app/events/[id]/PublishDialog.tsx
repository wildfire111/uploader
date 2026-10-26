"use client";

import { useEffect, useRef } from "react";

// Asks before publishing, because a published deck can only be fixed on Moxfield afterwards.
// Closed when `open` is false.
export function PublishDialog({
  open,
  account,
  toPublish,
  alreadyPublished,
  problems,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  account: string | null;
  toPublish: number;
  alreadyPublished: number;
  problems: { code: string; problem: string; count: number }[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const noun = toPublish === 1 ? "list" : "lists";
  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="publish-dialog-title"
      onClose={onCancel}
    >
      <h2 id="publish-dialog-title">
        Publish {toPublish} {noun} to Moxfield?
      </h2>
      {account ? (
        <p>
          They go to the Moxfield account <strong>{account}</strong>.
        </p>
      ) : null}
      {alreadyPublished > 0 ? (
        <p className="text-muted">
          {alreadyPublished} already on Moxfield, left as they are.
        </p>
      ) : null}
      {problems.length > 0 ? (
        <div className="warning">
          <p className="m-0 font-semibold">Still flagged</p>
          <ul className="my-1">
            {problems.map(({ code, problem, count }) => (
              <li key={code}>
                {count} {count === 1 ? "entry" : "entries"} with {problem}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted">No warnings on these lists.</p>
      )}
      <p className="text-muted">
        Once a list is on Moxfield it can&rsquo;t be changed from here. Anything wrong has to be
        fixed on Moxfield.
      </p>
      <div className="button-row justify-end">
        <button type="button" onClick={onCancel} autoFocus>
          Cancel
        </button>
        <button type="button" data-variant="primary" onClick={onConfirm}>
          Publish {toPublish} {noun}
        </button>
      </div>
    </dialog>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { saveMoxfieldTokenAction } from "@/lib/actions/moxfield";
import { buildBookmarkletHref, parseTokenFragment, type TokenFragment } from "@/lib/moxfieldBookmarklet";

export function ConnectBookmarklet({
  userAgentSet,
  collapsed,
  children,
}: {
  userAgentSet: boolean;
  // true when an account is already connected: the steps hide behind a summary
  collapsed: boolean;
  children: ReactNode;
}) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [incoming, setIncoming] = useState<TokenFragment | null>(null);
  const [open, setOpen] = useState(!collapsed);

  useEffect(() => {
    // React refuses javascript: in an href prop, so it's set on the element directly
    linkRef.current?.setAttribute("href", buildBookmarkletHref(window.location.origin));

    const fragment = parseTokenFragment(window.location.hash);
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    if (fragment) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the fragment only exists in the browser
      setIncoming(fragment);
      setOpen(true);
    }
  }, []);

  const connectSteps = (
    <>
      <p>
        Publishing writes decks to whichever Moxfield account is connected, so connect the one
        the decks should go to.
      </p>
      {!userAgentSet ? (
        <p className="warning">
          <strong>Set the User-Agent first.</strong> Saving a token checks it with Moxfield,
          which needs the User-Agent above.
        </p>
      ) : null}
      <p>
        <strong>Option A (recommended): use a bookmark.</strong>
      </p>
      <ol>
        <li>
          Drag this to your bookmarks bar (once):{" "}
          {/* href is filled in by the effect above; the click handler stops a stray click here
              from running the bookmarklet on this page */}
          <a ref={linkRef} onClick={(event) => event.preventDefault()}>
            🔑 Send Moxfield token
          </a>
        </li>
        <li>Open moxfield.com and log in as the account the decks should go to.</li>
        <li>Click the bookmark. A new tab opens here asking you to confirm.</li>
      </ol>
      {children}
    </>
  );

  return (
    <>
      {incoming ? (
        <div className="warning">
          <p>
            Moxfield sent a token
            {incoming.userName ? (
              <>
                {" "}for the account <strong>{incoming.userName}</strong>
              </>
            ) : null}
            . Decks will be published to that account.
          </p>
          <form action={saveMoxfieldTokenAction}>
            <input type="hidden" name="refreshToken" value={incoming.refreshToken} />
            <div className="button-row">
              <button type="submit" data-variant="primary" disabled={!userAgentSet}>
                {userAgentSet
                  ? `Connect${incoming.userName ? ` ${incoming.userName}` : ""}`
                  : "Please set the User-Agent first"}
              </button>
              <button type="button" onClick={() => setIncoming(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {collapsed ? (
        <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
          <summary className="mb-3 cursor-pointer text-link hover:text-link-hover">
            Replace the connection
          </summary>
          {connectSteps}
        </details>
      ) : (
        connectSteps
      )}
    </>
  );
}

import Link from "next/link";
import { saveMoxfieldTokenAction, saveMoxfieldUserAgentAction } from "@/lib/actions/moxfield";
import { requireAdmin } from "@/lib/guards";
import { formatTimestamp } from "@/lib/formatDate";
import { getMoxfieldConnectionStatus } from "@/lib/moxfieldAuth";
import { getMoxfieldUserAgentStatus } from "@/lib/moxfieldUserAgent";
import { ConnectBookmarklet } from "./ConnectBookmarklet";
import { ManualInstructionsDialog } from "./ManualInstructionsDialog";

// Always checks with Moxfield, so this must never be served from a cache.
export const dynamic = "force-dynamic";

const EXAMPLE_USER_AGENT = "MoxKey; youraccount 0123456789ab";
const EXAMPLE_REFRESH_TOKEN = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

export default async function AdminMoxfieldPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdmin();

  const [status, userAgent, { error, saved }] = await Promise.all([
    getMoxfieldConnectionStatus(),
    getMoxfieldUserAgentStatus(),
    searchParams,
  ]);

  return (
    <main className="mx-auto max-w-3xl">
      <p>
        <Link href="/">&larr; Events</Link>
      </p>
      <div className="page-header">
        <h1>Moxfield Settings</h1>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {saved === "1" ? (
        <p className="success">Connected. Publishing can now use this token.</p>
      ) : null}
      {saved === "ua" ? <p className="success">User-Agent saved.</p> : null}

      <h2>User-Agent</h2>
      <p>
        Moxfield issued a special User-Agent that lets this tool through their firewall. It goes
        with the Moxfield account, so each account has its own — set the one for the account you
        connect below.
      </p>
      {userAgent.set ? (
        <p>
          <strong className="text-ok">
            <span aria-hidden="true">✓ </span>Set.
          </strong> Last changed by {userAgent.updatedBy}
          {userAgent.updatedAt ? ` on ${formatTimestamp(userAgent.updatedAt)}` : ""}. The value
          isn&apos;t shown again; paste a new one to replace it.
        </p>
      ) : (
        <p className="warning">
          <strong>Not set.</strong> Connecting Moxfield and publishing are blocked until an admin
          sets it below.
        </p>
      )}
      <form action={saveMoxfieldUserAgentAction}>
        <label htmlFor="userAgent">{userAgent.set ? "Replace the User-Agent" : "User-Agent"}</label>
        <input
          type="password"
          id="userAgent"
          name="userAgent"
          placeholder={EXAMPLE_USER_AGENT}
          autoComplete="off"
          spellCheck={false}
          required
        />
        <button type="submit" data-variant="primary">
          Save User-Agent
        </button>
      </form>
      <p>
        It looks something like <code>{EXAMPLE_USER_AGENT}</code>: a short line of text with
        spaces in it, copied exactly as Moxfield sent it. It can&apos;t be checked when you save.
        If it&apos;s wrong, the first publish fails with a block from Moxfield&apos;s firewall.
      </p>

      <hr className="my-8 border-t-2 border-muted" />

      <h2>Moxfield account</h2>
      {status.state === "connected" ? (
        <p>
          <strong className="text-ok">
            <span aria-hidden="true">✓ </span>Connected
            {status.moxfieldUsername ? ` to the Moxfield account ${status.moxfieldUsername}` : ""}.
          </strong>{" "}
          {status.moxfieldUsername ? "Decks are published to that account. " : ""}Last set by{" "}
          {status.updatedBy} on{" "}
          {status.updatedAt ? formatTimestamp(status.updatedAt) : "an unknown date"}.
        </p>
      ) : null}
      {status.state === "connected" ? (
        <p className="text-muted">
          You don&apos;t need to do this each time you use the tool. You only need to reconnect if
          this page says it needs reconnecting. That can happen if the token expires, or if logging
          in to Moxfield somewhere else replaces it.
        </p>
      ) : null}
      {status.state === "needs_reconnect" ? (
        <p className="error">
          <strong>Needs reconnecting.</strong> Moxfield no longer accepts the saved token
          (set by {status.updatedBy}). Publishing is stopped until an admin pastes a new one below.
        </p>
      ) : null}
      {status.state === "not_connected" ? (
        <p className="warning">
          <strong>Not connected.</strong> Publishing needs a Moxfield refresh token. Paste one
          below.
        </p>
      ) : null}
      {status.state === "unknown" ? (
        <p className="warning">
          <strong>Could not check the connection just now.</strong> {status.detail} This is usually
          temporary — reload in a minute. It doesn&apos;t mean the token is bad.
        </p>
      ) : null}

      <ConnectBookmarklet
        userAgentSet={userAgent.set}
        collapsed={status.state === "connected" || status.state === "unknown"}
      >
        <ManualInstructionsDialog exampleToken={EXAMPLE_REFRESH_TOKEN} />
        <p>
          Treat it like the account&apos;s password. It&apos;s checked with Moxfield when you
          save, and stored encrypted.
        </p>

        <form action={saveMoxfieldTokenAction}>
          <label htmlFor="refreshToken">Refresh token</label>
          <input
            type="password"
            id="refreshToken"
            name="refreshToken"
            placeholder={EXAMPLE_REFRESH_TOKEN}
            autoComplete="off"
            spellCheck={false}
            required
          />
          <button type="submit" data-variant="primary" disabled={!userAgent.set}>
            {userAgent.set ? "Check and save" : "Please set the User-Agent first"}
          </button>
        </form>
      </ConnectBookmarklet>
    </main>
  );
}

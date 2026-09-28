# Implementation Plan — Event Results Tool

## Context

`DESIGN.md` is a complete, prescriptive design for a small internal tool: volunteers enter Highlander tournament results and decklists, admins review and publish them to Moxfield. The repo is currently empty (just `DESIGN.md` and a generic `.gitignore`) — this is a greenfield build.

The goal of this plan is to break the design into phases that can be built and verified one at a time, each ending in something concretely testable (a passing test suite, a page that works in the browser, a flow that can be clicked through end to end). Business-rule code (placing suggestion, title format, permissions, email normalising) is built and unit-tested early, independent of the database or UI, exactly as `DESIGN.md`'s Testing section calls for. UI phases follow the page flow in `DESIGN.md` (`Login → Home → New → Event → Users`), but Admin Users is pulled forward because it's small and exercises the same patterns as the events list before tackling the big two-pane event page. Publishing is its own late phase since it depends on entries already existing and is the most fiddly piece (idempotency, rate limiting, partial failure).

**2026-09-23 revision:** `DESIGN.md` was updated to drop Supabase entirely. The database is now [Neon](https://neon.tech) (plain hosted Postgres, no bundled auth), and login is [Better Auth](https://www.better-auth.com)'s magic-link plugin running inside this Next.js app, sending mail itself via Nodemailer/Gmail SMTP instead of a dashboard-configured provider. This plan has been updated throughout — Phase 0 (accounts), Phase 1 (schema note), Phase 2 (`pg` instead of `postgres`), Phase 3 (rewritten for Better Auth), and Phase 9 (deployment) all changed. Phases 4-8 are unaffected: they only depend on `getCurrentUser()`'s shape (`{ email, isAdmin } | null`), which is unchanged.

**2026-09-23 revision 2:** `DESIGN.md`'s Publishing to Moxfield section was rewritten after directly investigating and verifying the real Moxfield API (see `scripts/moxfield_probe.py` and its findings, including a real, working reference implementation). The stub built in Phase 8 is superseded by a real client, authenticated via an admin-managed, encrypted refresh token rather than any stub/`VERCEL_ENV` switching. This adds a new **Phase 9 — Real Moxfield authentication and publishing** below; the old Phase 9 (Deployment) is renumbered to **Phase 10**.

Each phase below lists: what gets built, the key files, and a concrete way to verify it's done before moving on.

---

## Phase 0 — Project setup and external accounts

**Goal:** an empty Next.js + TypeScript app that runs locally, with all external accounts ready.

Manual steps (owner does these, not automatable):
1. Create two Neon projects (dev, prod), each in the AWS Asia Pacific (Sydney) region. For each: note the pooled connection string (the host with `-pooler` in its name), and confirm Neon's optional Data API is switched off (it's off by default — just confirm, since `DESIGN.md`'s Permissions section depends on the database having no public API).
2. Create the dedicated Gmail account + app password. Unlike the old Supabase design, nothing is configured in a provider dashboard — the app password goes straight into this app's own env vars, read by `lib/email.ts` (Nodemailer) in Phase 3.
3. Confirm Vercel project exists and is linked to this repo. Set its Function Region to Sydney (`syd1`) in Project Settings → Functions, so the server sits next to the Neon database.

Code steps:
1. Scaffold Next.js (App Router) with TypeScript, `strict: true`.
2. Add dependencies: `pg` (+ `@types/pg`), `better-auth`, `nodemailer` (+ `@types/nodemailer`). No ORM, no state library, no UI kit.
3. Fix `.gitignore`: add `node_modules`, `.next`, `.env.local` (generic template currently in the repo is Python-flavoured and missing these).
4. Create `.env.example` listing every variable name with empty values — `DATABASE_URL` (Neon, pooled), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, plus the Moxfield vars (note: no `NEXT_PUBLIC_` vars per Code style) — and a local `.env.local` (git-ignored) pointing at the dev Neon project.
5. Start the README with "how to run locally" and the environment variable list (fill in the rest as later phases add setup steps).

**Verify:** `npm run dev` serves the default page at `localhost:3000`; `npm run build` succeeds; `git status` shows `.env.local` is ignored.

---

## Phase 1 — Schema and pure business logic (with tests)

**Goal:** the database schema exists, and every pure business rule from `DESIGN.md` is implemented and unit-tested, before any UI or DB-connected code is written.

1. Write schema SQL files (`db/schema/001_init.sql` or similar, run in order, no migration framework): `allowed_users`, `events`, `entries`, with the exact columns and `CHECK` constraints listed in DESIGN.md's Data model section. Run this against the dev Neon project. (A second file, `002_better_auth.sql`, is generated in Phase 3 once Better Auth is configured — its `user`/`session`/`account`/`verification` tables need the auth config to exist first.)
2. Seed the first admin (a small documented `INSERT`, noted in the README).
3. Implement pure functions, each in its own clearly named file (per Code style: business rules stay separate from UI):
   - `lib/normaliseEmail.ts` — lowercase + trim.
   - `lib/placing.ts` — `suggestNextPlacing(entries)` implementing the 3-rule algorithm, and ordinal formatting (`01st`, `11th`, `22nd`, etc.) shared with title formatting.
   - `lib/title.ts` — `formatDeckTitle({ placing, playerName, deckName, eventName })`.
   - `lib/permissions.ts` — pure functions: `canEditEvent`, `canDeleteEvent`, `canEditEntry`/`canDeleteEntry` (always false if `moxfield_deck_id` set), `canPublish`, `canSubmit` (requires ≥1 entry), taking plain value objects (user email/isAdmin, event status/creator, entry state) so they need no DB.
4. Set up Vitest (`npm test` runs it once).
5. Write the tests DESIGN.md's Testing section specifies:
   - Placing: standard top-8 sequence, overridden `01st/04th` split filling next three, `09th/16th` range filling, first entry of empty event.
   - Title: ordinals `11th/12th/13th/21st/22nd`, single placings, shared ranges, the worked example.
   - Email: `  Jo@Example.com ` → `jo@example.com`.
   - Permissions: no-entries event can't submit/publish; entry in `draft` or `published` event can't publish even for an admin; edit/delete/publish matrix for creator/other-volunteer/admin across each status; `moxfield_deck_id` always locks an entry.

**Verify:** `npm test` — all tests pass, and reading the test file is a readable spec of each rule (this is also the deliverable DESIGN.md's Testing section asks for). Confirm schema applies cleanly to a fresh dev database with no errors.

---

## Phase 2 — Database access layer

**Goal:** a single, small, typed data-access module the rest of the app calls — no ORM, hand-written SQL.

1. `lib/db.ts`: create one shared `pg` `Pool`, reading `DATABASE_URL` from env, marked `import "server-only"`. This is the same pool Better Auth's Postgres adapter uses in Phase 3 (per `DESIGN.md`'s Code style: "one shared connection pool that Better Auth also uses"), so export the `Pool` instance itself, not just query helpers.
2. Plain row types: `Event`, `Entry`, `AllowedUser` (Code style: simple named types, no generics/`any`).
3. Query functions grouped by table (e.g. `lib/queries/events.ts`, `lib/queries/entries.ts`, `lib/queries/users.ts`) — small functions like `getEventsForUser`, `getEventById`, `createEvent`, `getEntriesForEvent`, `createEntry`, `updateEntry`, `deleteEntry`, `getAllowedUser`, etc. All parameterized, no string-built SQL.
4. A throwaway verification script or a temporary API route to confirm connectivity end to end.

**Verify:** a one-off script (deleted or kept under `scripts/` for reuse) connects, inserts a test row into a scratch/dev row, reads it back, deletes it, against the pooled Neon connection string.

---

## Phase 3 — Authentication (Better Auth magic link)

**Goal:** a user can log in via emailed magic link, sessions are verified server-side on every request, and the whitelist is enforced — with no separate auth service, since Better Auth runs inside this app and stores users/sessions in the same Neon database.

1. `lib/email.ts` (server-only) — `sendEmail({ to, subject, text })` via Nodemailer, using the Gmail SMTP account and app password from Phase 0's env vars. One function, so the provider can be swapped later by changing only this file.
2. `lib/auth.ts` (server-only) — the Better Auth instance:
   - Postgres adapter pointed at the shared `pg` `Pool` from Phase 2's `lib/db.ts` (not a separate connection).
   - Only the magic-link plugin enabled (no email/password, no social logins), plus `nextCookies()` so server actions can set/clear the session cookie.
   - `expiresIn: 15 * 60` (15 minutes) on the magic-link config.
   - `sendMagicLink({ email, url })` callback: normalises the email, checks `allowed_users`, and only if listed calls `sendEmail` with `url` in a plain-text message. **This is the real whitelist enforcement** — DESIGN.md is explicit that Better Auth's routes are mounted at `/api/auth/[...all]`, which anyone can call directly, so the check has to live here, not only in the login form.
3. Generate Better Auth's own schema: `npx @better-auth/cli generate`, save the output as `db/schema/002_better_auth.sql`, run it against the dev Neon project. This creates `user`, `session`, `account`, `verification` — tables the app's own code never queries directly.
4. Mount the routes: `app/api/auth/[...all]/route.ts` forwarding to Better Auth's Next.js handler.
5. `getCurrentUser()` in `lib/auth.ts` (or a small sibling file): calls `auth.api.getSession({ headers })`, normalises the email, looks it up in `allowed_users`, returns `{ email, isAdmin }` or `null`. Used by every page/route that needs the logged-in user — this is the shape Phases 4-8 depend on, unchanged from the original Supabase-based plan.
6. `/login` page: email field, posts to a server action that calls `auth.api.signInMagicLink`. Always shows "check your email" regardless of whitelist result (no user enumeration) — Better Auth calls `sendMagicLink` either way, and step 2's callback is what actually decides whether mail goes out.
7. No custom confirm route needed: the magic link points straight at Better Auth's own verify endpoint (`/api/auth/magic-link/verify?token=…&callbackURL=/`), mounted in step 4.
8. Logout: a small form (POST, not a link/GET — Next.js prefetch would otherwise log people out) in a shared header component, calling a server action that runs `auth.api.signOut`.
9. `BETTER_AUTH_URL` handling: set directly for local dev and Production; for Preview (which gets a new URL every deploy) fall back to `` `https://${process.env.VERCEL_URL}` `` in `lib/auth.ts`'s config.
10. A minimal shared layout/header (email + logout button) so later pages have somewhere to hang this.

**Verify:** manually log in with a whitelisted test email seeded in Phase 1, confirm the magic-link email arrives (via Nodemailer/Gmail) and clicking it lands logged-in on `/`. Try a non-whitelisted email — still shows "check your email" but no mail sends and no `user` row is created. Confirm removing a user from `allowed_users` while they're logged in blocks their next request. Confirm calling `/api/auth/sign-in/magic-link` directly (bypassing the `/login` form) still refuses non-whitelisted emails, proving the check is in `sendMagicLink`, not just the page.

---

## Phase 4 — Events list page (`/`)

**Goal:** the home page shows the right events to the right users, per the Permissions rules.

1. Query: `getEventsForUser(user)` — own events at any status, plus (if admin) others' `submitted`/`published` events; never other people's drafts. Include entry counts (`Decks` column) via a `COUNT` join.
2. Page renders the table from the wireframe: Name, Date, Decks, Status (mapped through the status→label table), Submitted by (admins only), with the Users link and "+ New event" button (Users link admin-only).
3. Row links to `/events/[id]` (page itself built in Phase 7 — a placeholder route is fine here).

**Verify:** log in as a volunteer — see own drafts/submitted/published only, no "Submitted by" column, no Users link. Log in as admin — also see other volunteers' submitted/published (not drafts), plus both extra columns/links. Confirm via direct DB inserts of test events across users/statuses that the filtering matches DESIGN.md's rules exactly.

---

## Phase 5 — New event page (`/events/new`)

**Goal:** create a draft event.

1. Form: event name, date, attendance (integer ≥ 1), all required. Client-side just prevents obviously-empty submits; real validation is server-side (the `CHECK` constraints plus a friendly error if attendance isn't a positive integer).
2. On save: insert as `draft` with `created_by` = current user's normalised email, redirect to `/events/[id]`.
3. No duplicate-name checking (deliberately, per DESIGN.md).

**Verify:** create an event, land on its (placeholder) detail page, confirm the row appears in `/` for its creator only. Try attendance `0` or blank fields — rejected with a clear message, no row created.

---

## Phase 6 — Admin users page (`/admin/users`)

**Goal:** admins manage the whitelist.

1. Route guard: non-admins get redirected/403'd (server-side check via `getCurrentUser()`, not just a hidden link).
2. List `allowed_users` with admin toggle.
3. Add email (optionally as admin) — normalise before insert, rely on the `CHECK (email = lower(email))` constraint as backstop.
4. Remove email; toggle `is_admin`.

**Verify:** as admin, add a new whitelisted email, confirm that email can now request a magic link at `/login` (ties back to Phase 3's whitelist check). Remove an email and confirm a logged-in session for that email is rejected on its next request (ties back to Phase 3's "checked every request" rule). As a non-admin, confirm `/admin/users` is inaccessible directly by URL.

---

## Phase 7 — Event detail page (`/events/[id]`)

The biggest page. Build it in the sub-steps below, each independently testable, since it's one page with a lot of interlocking state (edit-in-progress lock, fast entry flow, permissions).

### 7a — Read-only shell
- Header (name, date, attendance, status label), left pane entry list (placing, player, deck, truncated), right pane showing the selected entry's fields as plain text. First entry selected by default (or empty state if none).
- Permission check: `canEditEvent`/read-only from Phase 1's `lib/permissions.ts` decides whether any edit UI renders at all.
- **Verify:** open an event as a non-owning volunteer (or a submitted event as a volunteer) — see all data, no edit controls, no action button.

### 7b — Add entry (fast entry flow)
- "+ Add entry" opens a blank entry in the right pane with placing pre-filled via `suggestNextPlacing`; field order player → deck → decklist → Save & next, per the tabbing requirement.
- **Save & next** (and Ctrl/Cmd+Enter): saves via a server action/route, appends to the list, opens a fresh blank entry with the next suggestion.
- **Save & close**: saves, returns to no-entry-open state.
- **Cancel**: discards, no request sent except for already-saved entries.
- Both save buttons disabled until player/deck/decklist are non-empty.
- While a new entry is open: "+ Add entry" hidden, other entries not clickable, Submit for review disabled (shared "edit in progress" flag).
- **Verify:** enter a run of 8 entries hitting Ctrl+Enter each time, confirm placings auto-fill `01st, 02nd, 03rd/04th ×2, 05th/08th ×4` exactly per DESIGN.md's worked example, and confirm a mid-flow browser refresh loses only the currently-open unsaved entry.

### 7c — View/edit/delete an existing entry
- Selecting an entry shows its fields editable (if allowed). Save writes changes and keeps it selected; Cancel reverts; Delete entry removes it (with the same "can't touch a published entry" guard as everywhere else).
- Entries with `moxfield_deck_id` always render read-only with a ✓ mark, regardless of event status.
- Unsaved-changes lock: other entries not clickable, Submit/Publish disabled, until Save/Cancel.
- **Verify:** edit an entry, try clicking another entry before saving — blocked. Save, then confirm the change persisted. Attempt to edit/delete an entry with a (manually-set, for testing) `moxfield_deck_id` — blocked even for an admin on a submitted event.

### 7d — Event details edit
- "Edit details" makes name/date/attendance editable inline with Save/Cancel, same "nothing saves without Save" rule.
- Soft warning banner when entry count > attendance.
- **Verify:** edit attendance down below current entry count, see the warning appear; Cancel discards the edit.

### 7e — Delete event
- Button shown to creator (draft) or admin (submitted/published); confirm dialog; if any entry has a `moxfield_deck_id`, dialog text says so per DESIGN.md's exact wording. Cascade delete via FK.
- **Verify:** delete a draft as its creator, delete a submitted event as admin, confirm a volunteer cannot delete another volunteer's submitted event.

### 7f — Submit for review
- Action button per status/role (`Submit for review` for draft owner/admin; disabled per all the "edit in progress" / "no entries yet" rules, server-enforced too).
- On submit: status → `submitted`, redirect to `/` with no on-page confirmation there (the one-line message lives on `/` after redirect, per DESIGN.md).
- **Verify:** try submitting with zero entries — disabled client-side and rejected server-side if forced via direct API call. Submit a valid draft, confirm it becomes read-only for its creator and editable for admins.

---

## Phase 8 — Publishing to Moxfield (stub, superseded by Phase 9)

**Status:** built and verified as planned below. `lib/moxfield.ts`'s stub implementation is replaced in Phase 9 by a real client — everything else built here (the publish routes, claim-based idempotency, the browser-driven publish loop) stays as-is; Phase 9 only changes what happens inside `publishDeck` and adds a connection-management step before it can run.

**Goal:** the full publish flow works against a stub Moxfield client, with idempotency and partial-failure handling exactly as specified.

1. `lib/moxfield.ts`: `publishDeck({ title, decklist }) -> moxfieldDeckId`, `import "server-only"`. Stub behavior: dev/preview waits briefly and returns `stub-<random>`, with an env-var-triggered failure mode for testing retries; production (`VERCEL_ENV === "production"`) throws "Moxfield publishing not implemented yet". Self-paced via `MOXFIELD_DELAY_MS` (default 100) before each call, lives inside this module.
2. `POST /api/entries/[id]/publish`: admin-only, `submitted`-only event check, the exact claim `UPDATE ... RETURNING id` idempotency statement from DESIGN.md, calls `publishDeck`, saves `moxfield_deck_id`, clears `publish_claimed_at` on both success and failure paths. `maxDuration = 300`.
3. `POST /api/events/[id]/publish-complete`: admin-only, `submitted`-only, refuses unless every entry has a `moxfield_deck_id`, else sets `published`.
4. Publish button/browser loop on the event page: sequential (never parallel) per-entry calls in placing order skipping already-published entries, ✓-marking each as it completes, a "Publishing N of M…" counter, button disabled for the whole run, stop-and-show-error on any failure (with the specific "check Moxfield for a duplicate" wording on timeout/network errors), then the publish-complete call.

**Verify (all against the dev stub):**
- Publish a submitted event fully — every entry gets a `stub-*` id, event becomes `published`, list page updates.
- Trigger the stub's failure mode mid-run — loop stops, error shown, already-published entries keep their ✓, event stays `submitted`. Click Publish again — resumes from the first unpublished entry, doesn't touch the already-published ones.
- Simulate a double-submit (two tabs, or call the per-entry route twice quickly for the same entry) — second caller gets the "already being published" error, not a second Moxfield call.
- Confirm a non-admin or a `draft`/`published`-status event's publish routes are rejected server-side even if called directly.
- Confirm the production code path (`VERCEL_ENV=production`) throws the "not implemented" error rather than ever writing a stub id.

---

## Phase 9 — Real Moxfield authentication and publishing

**Status:** built and verified against a real Moxfield test account (2026-09-28) — connect/replace token, encrypted storage, concurrent-refresh safety, real publish, bad-card → pending deck reused on retry, corrupted token → reconnect message, title-length limit. Not exercised for real: a Moxfield 429, and the 404 fallback when a pending deck was deleted by hand (both coded; the second's status code is a guess).

**Goal:** `publishDeck` makes real Moxfield API calls, authenticated via an admin-managed, encrypted refresh token instead of the Phase 8 stub. Any admin can view the connection status and supply a new token via `/admin/moxfield`. A dead refresh token surfaces a clear "reconnect Moxfield" message instead of a generic publish failure, without disturbing the claim-based idempotency built in Phase 8.

1. Add `MOXFIELD_TOKEN_ENCRYPTION_KEY` (a random 32-byte key) to `.env.example`/`.env.local`. Dev and prod get different keys, since each already has its own database.
2. Schema addition (originally a separate `003_moxfield_connection.sql`; later collapsed into `db/schema/001_init.sql`, whose header explains): the `moxfield_connection` table (singleton row, `CHECK (id = 1)`) and `entries.moxfield_pending_deck_id` (nullable text). Run against the dev Neon project (prod follows in Phase 10). Add the pending ID to the `Entry` type and `lib/queries/entries.ts` (it does **not** feed `canEditEntry` — only `moxfield_deck_id` locks an entry).
3. `lib/moxfieldAuth.ts` (server-only):
   - `encrypt`/`decrypt` — AES-256-GCM via Node's built-in `crypto`, keyed by `MOXFIELD_TOKEN_ENCRYPTION_KEY`. No new dependency.
   - `refreshAccessToken(refreshToken)` — `POST https://api2.moxfield.com/v1/startup/authenticated` exactly as verified against `wildfire111/moxprint`'s real source: `Cookie: refresh_token=...` header, JSON body `{ ignoreCookie: false, isAppLogin: false }`, **no special `User-Agent` needed for this specific call** (confirmed working without one). Returns the new access token and the (possibly rotated) refresh token from the response's `refresh` object.
   - `getValidAccessToken()` — reads the singleton row; if the stored access token has more than a minute of validity left, decrypt and return it (no Moxfield call); otherwise calls `refreshAccessToken`, stores the new encrypted tokens + expiry, and returns the new access token. Throws a distinct `MoxfieldReauthRequiredError` if the refresh call itself fails.
   - `setMoxfieldRefreshToken(rawToken, adminEmail)` — validates immediately by calling `refreshAccessToken` before storing anything; throws with a clear message on failure, otherwise encrypts and upserts the row (`updated_by`, `updated_at` included).
   - `getMoxfieldConnectionStatus()` — for the admin page: `{ connected, updatedBy, updatedAt } | null`. Calls `getValidAccessToken()` under the hood, so checking status also opportunistically refreshes a soon-to-expire access token.
4. Rewrite `lib/moxfield.ts`'s `publishDeck` to follow `DESIGN.md`'s "Writing the deck to Moxfield" (all of it verified against the real API in the pre-alpha discovery):
   - Calls `getValidAccessToken()` first, and sends the admin-managed, database-stored User-Agent (`lib/moxfieldUserAgent.ts`, set under Moxfield Settings — no longer an env var) on every call.
   - If the entry has no pending deck: `POST /v3/decks` with `format: "highlanderAustralian"`, `visibility: "public"`, `name: <title>`; the route saves the returned `publicId` as `moxfield_pending_deck_id` immediately.
   - `PUT /v3/decks/{publicId}/bulk-edit` with `decklist_raw` unchanged as `mainboard` and `""` for every other board (safe only because the deck is new — `""` clears a board). No set codes.
   - Treat the response by `isSuccessful`, not the HTTP status (failures are HTTP 200). On `false`, throw an error whose message lists the offending lines from `errors.boards.mainboard` (`Line N: <errorMessage>`); the deck is unchanged, so the pending ID stays for the retry. On success, `moxfield_deck_id` is set, the pending ID cleared.
   - A 429 stops the run with a clear message; the 1 req/s rule applies to User-Agent-only calls only (the authenticated calls here are excluded — see `DESIGN.md`), so keep only `MOXFIELD_DELAY_MS` between them.
   - `MOXFIELD_SIMULATE_FAILURE` env var (non-production only) makes it throw before calling Moxfield at all, for exercising the retry-UI without touching the real connection.
   - Route changes (`app/api/entries/[id]/publish/route.ts`): read/save/clear the pending ID; the reauth and validation messages need no other route change, since any thrown error already becomes the JSON error response.
   - **Title length (2–100 characters, Moxfield's rule):** add a pure check to `lib/title.ts` (with tests) and apply it when an entry is saved (against its event's name) and when event details are saved (against the event's longest existing title), refusing with the number of characters over rather than truncating. The `MAX_*_LENGTH` caps in `lib/validation.ts` stay as coarse limits.
5. `/admin/moxfield` page + server actions (mirrors `/admin/users`'s pattern and permission check): shows connection status from `getMoxfieldConnectionStatus()`, a form (paste a refresh token → Save) wired to `setMoxfieldRefreshToken`, with the DevTools extraction steps (Network tab → `startup/authenticated` → Response tab → `refresh_token`) written directly into the page.
6. No changes needed to the per-entry publish route from Phase 8: a `MoxfieldReauthRequiredError` thrown by `publishDeck` is just another thrown error its existing `catch` block turns into a JSON error response — only the message text is new (pointing at `/admin/moxfield`).

**Verify:**
- With no connection set, `/admin/moxfield` shows "needs reconnecting"; pasting an invalid/expired token shows a clear validation error immediately, and nothing is stored.
- Paste a real refresh token for a dev/test Moxfield account — status flips to "connected", showing the admin's email and a timestamp.
- `select encrypted_refresh_token from moxfield_connection` in the dev database shows ciphertext, not a readable token.
- Publish a submitted event's entries for real — decks actually appear on the connected (dev/test) account in format `highlanderAustralian`, public, each with the correct title (per Deck title format) and the pasted decklist as its mainboard.
- Save an entry with a misspelled card and publish: the admin sees `Line N: Could not find card ...`, the entry is not marked published, a pending deck ID is stored, and after fixing the decklist the next Publish fills that **same** deck (no second deck appears on the account).
- Try a title over 100 characters: the entry/event save is refused with a message naming how far over it is; exactly 100 is accepted.
- Manually corrupt the stored value (e.g. `update moxfield_connection set encrypted_refresh_token = 'garbage'`) and attempt a publish — the entry publish fails with the specific reconnect message, not a generic error; the event stays `submitted`, and the claim (`publish_claimed_at`) is cleared exactly as any other publish failure already does (Phase 8).
- Reconnect with a fresh valid token and publish again — resumes normally, confirming Phase 8's idempotency and this new auth layer compose correctly.
- Confirm a non-admin is redirected away from `/admin/moxfield`, same as `/admin/users`.

---

## Phase 10 — Deployment, production setup, and final QA

**Goal:** the app is live on Vercel against the real production Neon project, with everything from the Secrets section respected.

1. Set all env vars in Vercel: Sensitive flag on secrets (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `GMAIL_APP_PASSWORD`, `MOXFIELD_TOKEN_ENCRYPTION_KEY`); a **different** `MOXFIELD_TOKEN_ENCRYPTION_KEY` for Production than Development/Preview (Phase 9); `BETTER_AUTH_URL` set for Production (Preview relies on its `VERCEL_URL` fallback from Phase 3); nothing `NEXT_PUBLIC_`. Confirm the project's Function Region is still set to Sydney (`syd1`, from Phase 0). Nothing Moxfield-related needs to be Production-only anymore — isolation now comes from the production database's `moxfield_connection` row being empty until an admin deliberately connects it (Phase 9, `DESIGN.md`'s Moxfield connection section).
2. Run both schema files (`001_init.sql`, `002_better_auth.sql`) against the production Neon project, confirm its Data API is off, seed its first admin — same checklist as dev (Phase 0/1/3/9), written once in the README and followed twice. No email template step — the magic-link email's wording lives in `lib/auth.ts`'s `sendMagicLink` callback, in code, not a provider dashboard.
3. Have an admin connect the production Moxfield account via `/admin/moxfield` on the deployed production app — this is the first real, live use of Phase 9's flow, and deliberately a manual, in-app step rather than anything scripted or env-var-based.
4. Finish the README: local run instructions, full env var list, first-admin seeding for both projects, and a short note on `/admin/moxfield` (who can use it, and that a dead connection there — not a code deploy — is how you fix "publishing stopped working").
5. Add `import "server-only"` audit: confirm `lib/moxfield.ts`, `lib/moxfieldAuth.ts`, `lib/db.ts`, `lib/auth.ts`, and `lib/email.ts` all have it, and that a deliberate bad import (browser component importing one of them) fails the build.
6. End-to-end QA pass on Preview deployment: full login → create → enter 9+ entries → submit → publish → delete cycle, once as a volunteer and once as an admin, confirming every permission rule in DESIGN.md's table holds on a deployed environment, not just locally. Preview publishes for real, but only ever to whatever (test) account is connected in the *development* database — confirm this is still the case before publishing anything from a Preview deployment.

**Verify:** Preview deployment builds and runs against the dev Neon project; a manual pass through the full lifecycle (login, create, enter, submit, publish, delete) succeeds for both roles; `npm test` and `npm run build` both pass in CI/locally as the final gate before calling the MVP done.

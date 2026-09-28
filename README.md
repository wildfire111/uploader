# Event Results Tool

Event and decklist entry tool for a 7 Point Highlander community. Volunteers enter tournament results; an admin reviews them and publishes each deck to Moxfield. See `DESIGN.md` for the full design and `PLAN.md` for the phased implementation plan.

## Running locally

```
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

Run the test suite (pure business-logic tests only, per `DESIGN.md`'s Testing section):

```
npm test
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values (see `PHASE0.md` for how to obtain the first five):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Postgres connection string from Neon (host contains `-pooler`). |
| `BETTER_AUTH_SECRET` | Signs Better Auth's session cookies. A random string — `openssl rand -base64 32` — no account needed. |
| `BETTER_AUTH_URL` | Base URL Better Auth uses to build magic links. Set for local dev and Production; Preview falls back to `VERCEL_URL` automatically. |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Dedicated Gmail account Nodemailer uses to send magic-link emails. |
| `MOXFIELD_TOKEN_ENCRYPTION_KEY` | Encrypts the Moxfield token stored in the database (AES-256-GCM). Generate with `openssl rand -base64 32`. **Use a different key for development and production.** If it is lost or changed, the stored token becomes unreadable and an admin has to reconnect (see below) — nothing else is lost. |
| `MOXFIELD_DELAY_MS` | Optional. Delay in ms before each Moxfield API call. Defaults to `1000`, to stay within Moxfield's one-request-per-second condition. Each entry makes about two calls, so a 100-entry event takes roughly 5 minutes to publish. |
| `MOXFIELD_SIMULATE_FAILURE` | Optional, development only (ignored when `VERCEL_ENV=production`). Any text makes every publish fail with that message before Moxfield is contacted, for testing the retry path. |

None of these use the `NEXT_PUBLIC_` prefix — this app has no browser-side configuration; login, database access, and email sending all happen on the server. The Moxfield account's token and the User-Agent Moxfield issued are **not** environment variables: an admin enters them under Moxfield Settings (below), and they are stored encrypted in the database.

## Two Neon projects

This app uses separate Neon projects for development and production, so test data never reaches the real database. Local development and Vercel Preview deployments use the development project; only the Vercel Production environment uses the production project. Each database holds its own Moxfield connection, so anything published from development or Preview goes to whatever Moxfield account was connected in the *development* database — use a personal test account there.

Both projects need the same schema run against them — see `PHASE0.md` for the full step-by-step (creating the project in the Sydney region, getting the pooled connection string, confirming the Data API is off).

## Database schema

Schema files live in `db/schema/`, run in order, with no migration framework. Apply them to a Neon project via its SQL editor (Neon console → project → SQL Editor → paste the file contents → Run). Both the dev and prod projects need the same files run against them.

- `001_init.sql` — the app's own tables, in their final shape: `allowed_users`, `events`, `entries` and `moxfield_connection` (the encrypted Moxfield token, account name and User-Agent).
- `002_better_auth.sql` — Better Auth's own tables (`user`, `session`, `account`, `verification`), generated with `npx @better-auth/cli generate`. The app's own code never queries these directly.

Run them in that order on a new database. `001` used to be split across several add-on files; it was collapsed into one while no real data existed anywhere, and the existing dev and prod databases were checked to match it exactly, so they need nothing run. **From the first real data onwards, don't edit `001`.** Add new numbered files (`003`, `004`, …) that only ever add to the schema.

## Seeding the first admin

There's no UI for this — the first admin is inserted directly, after which they can use `/admin/users` to add everyone else. Run this in the Neon SQL editor for each project, with the real email substituted:

```sql
insert into allowed_users (email, is_admin)
values ('your-email@example.com', true);
```

## Adding volunteers

Log in as an admin and open **Manage Users** (in the top bar). Add the person's email; tick **Admin** only for people who should publish to Moxfield and manage users. Only whitelisted emails can log in. An email address that isn't on the list still sees "Check your email" but is sent nothing. Removing someone locks them out on their next request.

## Connecting Moxfield

Publishing writes decks to the Moxfield account that an admin has connected — there is no other setting: it is whichever account the pasted token belongs to. The connected account's name is shown on `/admin/moxfield` and beside the Publish button, so check it before publishing. Any admin can do this at **Moxfield Settings** (in the top bar, `/admin/moxfield`); it needs to be done once per database, and again whenever Moxfield stops accepting the saved token.

0. **First, set the User-Agent** on the same page. It's the special value Moxfield issued for the account, and each account has its own, so it's set per database along with the token. Without it nothing can be sent to Moxfield. It can't be checked when saved; a wrong one shows up as Moxfield's firewall blocking the first request.
1. Log in at moxfield.com as the account the decks should be published to.
2. Open DevTools (F12) → Network tab, then reload the page.
3. Click the request named `authenticated` (under `startup`) and open its **Response** tab.
4. Inside the `refresh` object, copy the value of `refresh_token` (just the value).
5. Paste it into the form on `/admin/moxfield` and click **Check and save**.

The token is checked with Moxfield when you save — a bad paste is rejected on the spot and nothing is stored. Moxfield replaces the token each time it's used, so the copy you pasted stops working straight away; the app stores and keeps the current one itself. Treat the token like the account's password.

Decks are created **public** in the **Australian Highlander** format (`highlanderAustralian`), because the community's analysis scrapes them from Moxfield.

## When publishing stops working

| What the admin sees | What it means | Fix |
|---|---|---|
| "Moxfield needs to be reconnected…" | The saved token is missing, unreadable, or no longer accepted by Moxfield (for example it expired, or the encryption key changed). | Reconnect at `/admin/moxfield` (above). No redeploy needed; then click **Publish** again — it resumes where it stopped. |
| "Moxfield could not read the decklist — Line 3: Could not find card …" | Moxfield didn't recognise a card name in that entry. Nothing is lost: the deck Moxfield already created is kept for that entry. | Fix the decklist on the entry (admins can edit while the event is *Submitted for review*), then **Publish** again. It fills the same deck rather than creating another. |
| "Moxfield's User-Agent isn't set…" | No User-Agent is stored, or it can't be read (for example the encryption key changed). Nothing was sent to Moxfield. | Set it under Moxfield Settings. |
| Publishing fails with a message from Moxfield's firewall (Cloudflare) or HTTP 403 | The User-Agent is wrong, or it belongs to a different Moxfield account than the token. | Set the right one under Moxfield Settings. |
| "Moxfield is rate limiting requests…" | Moxfield's firewall said slow down. | Wait a minute and click **Publish** again. |
| "…Check Moxfield for a duplicate of this deck before retrying." | The request may or may not have reached Moxfield (timeout or network error). | Look at the Moxfield account for that deck before retrying. |
| "The deck title would be N characters over Moxfield's 100-character limit" | The title (placing, player, deck, event name) is too long for Moxfield. Raised when saving an entry or renaming an event. | Shorten the player, deck or event name. |

Moxfield's API has no delete-deck call, so a deck that was created but abandoned (for example, its entry was deleted after a failed publish) has to be deleted by hand on moxfield.com.

# Event Results Tool

Event and decklist entry tool for a 7 Point Highlander community. Volunteers enter tournament results; an admin reviews them and publishes each deck to Moxfield. See `DESIGN.md` for the full design.

## Running locally

```
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

Run the test suite (pure business-logic tests only, per the Testing section of `docs/archive/DESIGN.md`):

```
npm test
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values (see "One-time accounts and settings" below for the first five):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Postgres connection string from Neon (host contains `-pooler`). |
| `BETTER_AUTH_SECRET` | Signs Better Auth's session cookies. A random string — `openssl rand -base64 32` — no account needed. |
| `BETTER_AUTH_URL` | Base URL Better Auth uses to build magic links. Set for local dev and Production; Preview falls back to `VERCEL_URL` automatically. |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Dedicated Gmail account Nodemailer uses to send magic-link emails. |
| `MOXFIELD_TOKEN_ENCRYPTION_KEY` | Encrypts the Moxfield token stored in the database (AES-256-GCM). Generate with `openssl rand -base64 32`. **Use a different key for development and production.** If it is lost or changed, the stored token becomes unreadable and an admin has to reconnect (see below) — nothing else is lost. |
| `MOXFIELD_DELAY_MS` | Optional. Delay in ms before each Moxfield API call. Defaults to `1000`, to stay within Moxfield's one-request-per-second condition. Each entry makes about two calls (four when the deck has a companion), so a 100-entry event takes roughly 5 minutes to publish. |

None of these use the `NEXT_PUBLIC_` prefix — this app has no browser-side configuration; login, database access, and email sending all happen on the server. The Moxfield account's token and the User-Agent Moxfield issued are **not** environment variables: an admin enters them under Moxfield Settings (below), and they are stored encrypted in the database.

## Two Neon projects

This app uses separate Neon projects for development and production, so test data never reaches the real database. Local development and Vercel Preview deployments use the development project; only the Vercel Production environment uses the production project. Each database holds its own Moxfield connection, so anything published from development or Preview goes to whatever Moxfield account was connected in the *development* database — use a personal test account there.

Both projects need the same schema run against them (see "Database schema" below). Setting the projects up is covered in the next section.

## One-time accounts and settings

Done by hand once, since they need web consoles:

1. **Neon**: create two projects, one for development and one for production (not branches, so each gets its own free compute and nothing is copied from production), both in the **AWS Asia Pacific (Sydney)** region. For each, copy the **pooled** connection string (the host contains `-pooler`) into `DATABASE_URL`. Neon also has an optional Data API; leave it **off**, because this app's permissions rely on the database having no public API at all.
2. **Gmail**: create a dedicated Gmail account (not a personal one), turn on 2-Step Verification, then create an **App Password** (Google Account → Security → 2-Step Verification → App passwords). Put the address in `GMAIL_USER` and the 16-character password in `GMAIL_APP_PASSWORD`; Google only shows it once.
3. **Vercel**: make sure the project is linked to this repository, and set Project Settings → Functions → **Function Region** to **Sydney (syd1)** so the server sits next to the database. Production secrets go under Environment Variables, marked Sensitive.

The Moxfield API reference used while building the publishing code is archived at `docs/archive/moxfield_docs.json`.

## Database schema

Schema files live in `db/schema/`, run in order, with no migration framework. Apply them to a Neon project via its SQL editor (Neon console → project → SQL Editor → paste the file contents → Run). Both the dev and prod projects need the same files run against them.

- `001_init.sql` — the app's own tables, in their final shape: `allowed_users`, `events`, `entries` and `moxfield_connection` (the encrypted Moxfield token, account name and User-Agent).
- `002_better_auth.sql` — Better Auth's own tables (`user`, `session`, `account`, `verification`), generated with `npx @better-auth/cli generate`. The app's own code never queries these directly.
- `003_reference_lists.sql` — one row per list the decklist checks use (the points list from GitHub, every card name and every Reserved List card from Scryfall). The app fetches them itself: the first time an event page is opened, then the points list and card names again once a day old. The Reserved List is fetched once and only refreshed by an admin at **Reference Data** (top bar), where the other two can also be refreshed sooner. Until the table exists, event pages still work but show no list-based warnings.
- `004_reference_list_attempts.sql` — records when the app last tried to refresh each list, so one that is failing is not retried more than once an hour. **Run it before deploying this version**: the app reads the new column, and without it the lists read as missing.
- `005_metadata_unlocked.sql` — adds `events.metadata_unlocked`, set when an admin unlocks the details of an event that has lists on Moxfield. **Run it before deploying this version**: every event query reads the new column.

## Adding volunteers

Log in as an admin and open **Manage Users** (in the top bar). Add the person's email; new users are never admins, so use **Make admin** on their row only for people who should publish to Moxfield and manage users. Only whitelisted emails can log in. An email address that isn't on the list still sees "Check your email" but is sent nothing. Removing someone locks them out on their next request.

## Connecting Moxfield

Publishing writes decks to the Moxfield account that an admin has connected — there is no other setting: it is whichever account the pasted token belongs to. The connected account's name is shown on `/admin/moxfield` and beside the Publish button, so check it before publishing. Any admin can do this at **Moxfield Settings** (in the top bar, `/admin/moxfield`); it needs to be done once per database, and again whenever Moxfield stops accepting the saved token.

0. **First, set the User-Agent** on the same page. It's the special value Moxfield issued for the account, and each account has its own, so it's set per database along with the token. Without it nothing can be sent to Moxfield. It can't be checked when saved; a wrong one shows up as Moxfield's firewall blocking the first request.
1. On `/admin/moxfield`, drag the **Send Moxfield token** link to your bookmarks bar (once).
2. Log in at moxfield.com as the account the decks should be published to, and click the bookmark. A new tab opens on `/admin/moxfield` showing the account name.
3. Click **Connect**.

If the bookmark doesn't work (a browser or Moxfield change can block it), the page has a link to manual instructions: in DevTools (F12) → Network, click the `authenticated` request (under `startup`), copy `refresh_token` from the `refresh` object in its **Response** tab, paste it into the form and click **Check and save**.

The token is checked with Moxfield when you save — a bad paste is rejected on the spot and nothing is stored. Moxfield replaces the token each time it's used, so the copy you pasted stops working straight away; the app stores and keeps the current one itself. Treat the token like the account's password.

Decks are created **public** in the **Australian Highlander** format (`highlanderAustralian`), because the community's analysis scrapes them from Moxfield.

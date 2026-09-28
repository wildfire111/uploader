# Phase 0 — Manual setup

> **Updated 2026-09-23:** `DESIGN.md` dropped Supabase. The database is now [Neon](https://neon.tech) (plain hosted Postgres — no bundled auth, no dashboard SMTP config), and login is [Better Auth](https://www.better-auth.com)'s magic-link plugin running inside the app itself, sending mail directly via Nodemailer/Gmail. If you already started the old Supabase steps, you can stop — nothing there carries over. The Gmail account is still needed, just used differently (see step 2).

These are the accounts and settings that have to be created by hand, since nothing here can sign up for services or click through web consoles. Work through them in order — later steps depend on values from earlier ones. Once you're done, the code-side setup (Next.js scaffold, `.gitignore`, `.env.example`) can use the values you collect here.

Keep a scratch note (not in the repo) of the values marked **📋 save this** — you'll paste them into `.env.local` yourself at the end rather than pasting secrets into this chat.

---

## 1. Create the two Neon projects

You need **two separate projects**: one for development (and Vercel Preview deployments), one for production. This keeps test data and stub Moxfield IDs from ever touching the real database. `DESIGN.md` calls for separate projects rather than Neon's branching feature, so each gets its own free compute allowance and nothing is copied from production.

1. Go to [neon.tech](https://neon.tech) and sign in (or create an account).
2. Click **New project**.
3. Create the **dev** project:
   - Name: something like `results-tool-dev`.
   - Postgres version: latest default is fine.
   - Region: **AWS Asia Pacific (Sydney)** — this is deliberate, per `DESIGN.md`: the Vercel function region is also set to Sydney later, so the server sits next to the database.
4. Repeat step 3 for the **prod** project, named `results-tool-prod`.

For **each** project, once it's ready, collect this value:

- **Pooled connection string**: on the project dashboard, find the connection string and make sure you're copying the **pooled** one — the host name contains `-pooler` (e.g. `ep-xxx-pooler.ap-southeast-2.aws.neon.tech`). This matters because Vercel functions open many short-lived connections, and only the pooled endpoint handles that well. 📋 **save this as `DATABASE_URL`** (one for dev, one for prod).

## 2. Confirm Neon's Data API is off

`DESIGN.md`'s Permissions section relies on the database having **no public API at all** — every read and write goes through this app's own server, over a normal Postgres connection. Neon has an optional Data API (REST-style access to your tables) that must stay switched off.

For **each** project:
1. Check the project's settings for a "Data API" section.
2. It's **off by default** — just confirm it hasn't been enabled. If it has, turn it off.

## 3. Create the Gmail SMTP account

A dedicated Gmail account sends the magic-link emails. Unlike the old Supabase-based design, there's no dashboard SMTP configuration or email template to set up — the app password goes straight into this app's own environment variables, and Nodemailer sends mail directly from `lib/email.ts` (built in Phase 3). The email's wording lives in that file's code too.

1. Create a new Gmail account dedicated to this app (e.g. something like `yourclubresults@gmail.com`) — don't reuse a personal account.
2. Turn on **2-Step Verification** on that account (Google Account → Security → 2-Step Verification). This is required before Google will issue an app password.
3. Generate an **App Password**: Google Account → Security → 2-Step Verification → App passwords → create one named e.g. "Results Tool SMTP".
4. 📋 **Save the Gmail address as `GMAIL_USER`** and **the generated 16-character app password as `GMAIL_APP_PASSWORD`** — Google only shows the password once.

## 4. Confirm the Vercel project and set its region

`DESIGN.md` assumes existing Vercel hosting and domain, and asks for the function region to be set to Sydney so the server sits next to the Neon database.

1. Go to [vercel.com](https://vercel.com) and confirm a project already exists linked to this GitHub repo.
   - If it doesn't exist yet: **Add New → Project → Import** this repo. You don't need to configure environment variables yet — that happens in Phase 9 (and locally, we're using `.env.local` for now).
2. Set the region: Project Settings → Functions → **Function Region** → select **Sydney, Australia (syd1)**.

---

## What to bring back

Once you've done all of the above, you should have, for **each** of the two Neon projects:
- A `DATABASE_URL` (pooled connection string, host containing `-pooler`)

Plus, once (not per-project):
- `GMAIL_USER` and `GMAIL_APP_PASSWORD`

Tell me when you're ready and I'll scaffold the Next.js app, set up `.gitignore`, and create `.env.example` with the variable names — you'll then paste your dev project's values into your own `.env.local` (which stays out of git). Two more variables (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`) get filled in during Phase 3 — `BETTER_AUTH_SECRET` doesn't need an account, it's just a random string, so I can generate that one for you.

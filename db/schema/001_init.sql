-- app tables. run once per new database, then 002_better_auth.sql.
-- once there is real data, don't edit this file: add numbered files that only add to the schema.

create extension if not exists pgcrypto;

create table allowed_users (
  email    text primary key,
  is_admin boolean not null default false,

  check (email = lower(email))
);

create table events (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null, -- short event code, used in the deck title
  full_name          text not null, -- used in the deck description
  date               date not null,
  attendance         integer not null,
  status             text not null default 'draft',
  created_by         text not null, -- creator's email; plain text so removing a user keeps their events
  created_at         timestamptz not null default now(),
  moxfield_folder_id text, -- the event's Moxfield deck folder, created on first publish

  check (status in ('draft', 'submitted', 'published')),
  check (attendance >= 1),
  check (created_by = lower(created_by))
);

create table entries (
  id                       uuid primary key default gen_random_uuid(),
  event_id                 uuid not null references events (id) on delete cascade,
  placing_from             integer not null,
  placing_to               integer, -- set only for a shared range
  player_name              text not null,
  deck_name                text not null,
  decklist_raw             text not null, -- stored exactly as pasted
  moxfield_deck_id         text, -- set when published; locks the entry. Moxfield's short internal id, not the public URL id
  moxfield_pending_deck_id text, -- a partially-failed deck awaiting delete-then-recreate on retry
  publish_claimed_at       timestamptz, -- set while a publish is working on this entry
  created_at               timestamptz not null default now(), -- entry order within a shared range

  check (placing_from >= 1),
  check (placing_to > placing_from) -- passes when placing_to is null
);

-- entries are always fetched by event
create index entries_event_id_idx on entries (event_id);

-- single row: the moxfield tokens and user agent, encrypted
create table moxfield_connection (
  id                      integer primary key check (id = 1),
  encrypted_refresh_token text,
  encrypted_access_token  text,
  access_token_expires_at timestamptz,
  moxfield_username       text, -- the Moxfield account the token belongs to
  encrypted_user_agent    text,
  -- separate from updated_by, which belongs to the token
  user_agent_updated_by   text check (user_agent_updated_by = lower(user_agent_updated_by)),
  user_agent_updated_at   timestamptz,
  updated_by              text not null check (updated_by = lower(updated_by)),
  updated_at              timestamptz not null default now()
);

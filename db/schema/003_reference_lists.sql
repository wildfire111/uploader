-- lists the decklist checks use, fetched by the app from GitHub and Scryfall and refreshed
-- by it (see lib/referenceLists.ts). run once per database, after 001 and 002.

-- one row per list: "points" (card name -> points), "card_names" (every card name) and
-- "reserved" (every Reserved List card name)
create table reference_lists (
  name       text primary key,
  data       jsonb not null,
  fetched_at timestamptz not null default now()
);

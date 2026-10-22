-- remembers when the app last tried to refresh each list, so a failing refresh is not retried on
-- every page view (see lib/referenceLists.ts). run once per database, after 003.

-- a row can now exist before the list has ever been fetched, holding only the attempt
alter table reference_lists
  alter column data drop not null,
  alter column fetched_at drop not null,
  alter column fetched_at drop default,
  add column last_attempt_at timestamptz;

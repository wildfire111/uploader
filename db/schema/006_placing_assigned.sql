-- an imported list gets a placeholder placing until someone assigns the real one; existing and
-- hand-entered lists are placed from the start
alter table entries
  add column placing_assigned boolean not null default true;

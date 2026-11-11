-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists public.entries (
  id         bigint generated always as identity primary key,
  entry_date date    not null,
  kind       text    not null check (kind in ('in', 'out')),
  qty        numeric not null default 1 check (qty >= 0),
  item       text    not null,
  size       text,
  price      numeric not null check (price >= 0),
  total      numeric generated always as (round(qty * price, 2)) stored,
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz
);

create index if not exists entries_date_idx on public.entries (entry_date);

-- Record who changed a row and when.
create or replace function public.set_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_by := auth.jwt() ->> 'email';
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists entries_set_updated on public.entries;
create trigger entries_set_updated
  before update on public.entries
  for each row execute function public.set_updated();

-- Privacy: only signed-in company users can touch the data. Anonymous visitors get nothing.
alter table public.entries enable row level security;

drop policy if exists "signed-in read"   on public.entries;
drop policy if exists "signed-in insert" on public.entries;
drop policy if exists "signed-in update" on public.entries;
drop policy if exists "signed-in delete" on public.entries;

create policy "signed-in read"   on public.entries for select to authenticated using (true);
create policy "signed-in insert" on public.entries for insert to authenticated with check (true);
create policy "signed-in update" on public.entries for update to authenticated using (true) with check (true);
create policy "signed-in delete" on public.entries for delete to authenticated using (true);
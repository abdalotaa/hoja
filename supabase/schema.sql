-- Hoja: notes table with row-level security. Run once in Supabase → SQL Editor.

create table if not exists public.notes (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default '' check (char_length(title) <= 300),
  text        text not null default '' check (char_length(text) <= 60000),
  tone        text not null default 'none' check (tone in ('none', 'butter', 'mint', 'rust')),
  x           integer not null default 0,
  y           integer not null default 0,
  w           integer not null default 320,
  h           integer not null default 260,
  z           integer not null default 1,
  updated_at  bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists notes_user_idx on public.notes (user_id);

alter table public.notes enable row level security;

-- Each person can only see and change their own notes.
create policy "notes_select_own" on public.notes for select using (auth.uid() = user_id);
create policy "notes_insert_own" on public.notes for insert with check (auth.uid() = user_id);
create policy "notes_update_own" on public.notes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes_delete_own" on public.notes for delete using (auth.uid() = user_id);

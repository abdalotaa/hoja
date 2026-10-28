-- Hoja: full schema. Safe to run again at any time (idempotent). Run in Supabase → SQL Editor.

-- ───────── notes ─────────
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
alter table public.notes add column if not exists kind text not null default 'note';
alter table public.notes drop constraint if exists notes_kind_check;
alter table public.notes add constraint notes_kind_check check (kind in ('note', 'node'));
create index if not exists notes_user_idx on public.notes (user_id);

-- ───────── links between notes (no foreign keys on purpose: they sync independently) ─────────
create table if not exists public.links (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_id     uuid not null,
  to_id       uuid not null,
  updated_at  bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists links_user_idx on public.links (user_id);

-- ───────── flashcards ─────────
create table if not exists public.cards (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id     uuid,
  front       text not null check (char_length(front) <= 2000),
  back        text not null check (char_length(back) <= 4000),
  due         bigint not null default 0,
  interval    integer not null default 0,
  ease        real not null default 2.5,
  reps        integer not null default 0,
  updated_at  bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists cards_user_idx on public.cards (user_id, due);

-- ───────── read-only share links ─────────
create table if not exists public.shares (
  token       text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default '' check (char_length(title) <= 200),
  snapshot    jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists shares_user_idx on public.shares (user_id);

-- ───────── monthly AI usage per person ─────────
create table if not exists public.ai_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  month    text not null,
  count    integer not null default 0,
  primary key (user_id, month)
);

-- ───────── row-level security: everyone only touches their own rows ─────────
alter table public.notes    enable row level security;
alter table public.links    enable row level security;
alter table public.cards    enable row level security;
alter table public.shares   enable row level security;
alter table public.ai_usage enable row level security;

do $$
declare t text;
begin
  foreach t in array array['notes', 'links', 'cards', 'shares'] loop
    execute format('drop policy if exists "%1$s_select_own" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_insert_own" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_update_own" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_delete_own" on public.%1$s', t);
    execute format('create policy "%1$s_select_own" on public.%1$s for select using (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_insert_own" on public.%1$s for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_update_own" on public.%1$s for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_delete_own" on public.%1$s for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage for select using (auth.uid() = user_id);

-- Counts one AI use for the signed-in person this month. Returns the uses left, or -1 if the limit is reached.
create or replace function public.bump_ai_usage(max_per_month integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m text := to_char(now(), 'YYYY-MM');
  used integer;
begin
  if uid is null then
    return -1;
  end if;
  insert into public.ai_usage (user_id, month, count) values (uid, m, 0) on conflict do nothing;
  update public.ai_usage set count = count + 1
    where user_id = uid and month = m and count < max_per_month
    returning count into used;
  if used is null then
    return -1;
  end if;
  return max_per_month - used;
end;
$$;
revoke all on function public.bump_ai_usage(integer) from public, anon;
grant execute on function public.bump_ai_usage(integer) to authenticated;

-- Public read of one shared canvas by its secret token (anyone with the link).
create or replace function public.get_share(share_token text)
returns table (title text, snapshot jsonb)
language sql
security definer
set search_path = public
stable
as $$
  select s.title, s.snapshot from public.shares s where s.token = share_token;
$$;
grant execute on function public.get_share(text) to anon, authenticated;

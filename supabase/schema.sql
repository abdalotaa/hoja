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
alter table public.notes add constraint notes_kind_check check (kind in ('note', 'node', 'table'));
create index if not exists notes_user_idx on public.notes (user_id);

-- ───────── notebooks: each one is its own canvas of notes ─────────
create table if not exists public.notebooks (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null default '' check (char_length(name) <= 80),
  tone        text not null default 'none' check (tone in ('none', 'butter', 'mint', 'rust')),
  updated_at  bigint not null default (extract(epoch from now()) * 1000)::bigint,
  created_at  timestamptz not null default now()
);
create index if not exists notebooks_user_idx on public.notebooks (user_id);
alter table public.notes add column if not exists notebook_id uuid references public.notebooks (id) on delete set null;
create index if not exists notes_notebook_idx on public.notes (notebook_id);

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

-- ───────── calendar events added by hand ─────────
create table if not exists public.events (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) <= 200),
  date        text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  done        boolean not null default false,
  updated_at  bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists events_user_idx on public.events (user_id, date);

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
alter table public.notebooks enable row level security;
alter table public.links    enable row level security;
alter table public.cards    enable row level security;
alter table public.events   enable row level security;
alter table public.shares   enable row level security;
alter table public.ai_usage enable row level security;

do $$
declare t text;
begin
  foreach t in array array['notes', 'notebooks', 'links', 'cards', 'events', 'shares'] loop
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

-- ───────── super admin: who can open /admin ─────────
-- No policies on purpose: nobody reads this table from the app. Add yourself once, in the SQL Editor:
--   insert into public.admins (user_id) select id from auth.users where email = 'tu@correo.com' on conflict do nothing;
create table if not exists public.admins (
  user_id  uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ───────── suggestions sent from inside the app ─────────
create table if not exists public.suggestions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('idea', 'problema', 'otro')),
  message     text not null check (char_length(message) between 3 and 2000),
  status      text not null default 'nueva' check (status in ('nueva', 'vista', 'hecha')),
  created_at  timestamptz not null default now()
);
create index if not exists suggestions_created_idx on public.suggestions (created_at desc);
alter table public.suggestions enable row level security;
drop policy if exists "suggestions_select_own" on public.suggestions;
create policy "suggestions_select_own" on public.suggestions for select using (auth.uid() = user_id);

-- Sends one suggestion as the signed-in person: at most 10 per day. Returns false when refused.
create or replace function public.send_suggestion(p_kind text, p_message text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return false;
  end if;
  if (select count(*) from public.suggestions where user_id = uid and created_at > now() - interval '1 day') >= 10 then
    return false;
  end if;
  insert into public.suggestions (user_id, kind, message) values (uid, p_kind, left(trim(p_message), 2000));
  return true;
end;
$$;
revoke all on function public.send_suggestion(text, text) from public, anon;
grant execute on function public.send_suggestion(text, text) to authenticated;

-- Admin only: every suggestion with the sender's email.
create or replace function public.admin_suggestions(max_rows integer default 100)
returns table (id uuid, kind text, message text, status text, created_at timestamptz, email text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select s.id, s.kind, s.message, s.status, s.created_at, u.email::text
    from public.suggestions s join auth.users u on u.id = s.user_id
    order by s.created_at desc
    limit least(max_rows, 500);
end;
$$;
revoke all on function public.admin_suggestions(integer) from public, anon;
grant execute on function public.admin_suggestions(integer) to authenticated;

create or replace function public.admin_set_suggestion_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.suggestions set status = p_status where id = p_id;
end;
$$;
revoke all on function public.admin_set_suggestion_status(uuid, text) from public, anon;
grant execute on function public.admin_set_suggestion_status(uuid, text) to authenticated;

-- Admin only: the numbers behind /admin, as one JSON object. Counts only: no note contents are read.
create or replace function public.admin_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  tz text := 'America/Mexico_City';
  week_ms bigint := (extract(epoch from now() - interval '7 days') * 1000)::bigint;
  this_month text := to_char(now(), 'YYYY-MM');
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users', jsonb_build_object(
      'total', (select count(*) from auth.users),
      'last7', (select count(*) from auth.users where created_at > now() - interval '7 days'),
      'last30', (select count(*) from auth.users where created_at > now() - interval '30 days'),
      'withNotes', (select count(distinct user_id) from public.notes),
      'active7', (select count(distinct user_id) from public.notes where updated_at > week_ms)
    ),
    'content', jsonb_build_object(
      'notes', (select count(*) from public.notes where kind = 'note'),
      'tables', (select count(*) from public.notes where kind = 'table'),
      'nodes', (select count(*) from public.notes where kind = 'node'),
      'notebooks', (select count(*) from public.notebooks),
      'links', (select count(*) from public.links),
      'cards', (select count(*) from public.cards),
      'events', (select count(*) from public.events),
      'shares', (select count(*) from public.shares)
    ),
    'ai', jsonb_build_object(
      'uses', (select coalesce(sum(a.count), 0) from public.ai_usage a where a.month = this_month),
      'people', (select count(*) from public.ai_usage a where a.month = this_month and a.count > 0)
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'count', coalesce(c.n, 0)) order by d), '[]'::jsonb)
      from generate_series((now() at time zone tz)::date - 29, (now() at time zone tz)::date, interval '1 day') d
      left join (
        select (created_at at time zone tz)::date as day, count(*) as n from auth.users group by 1
      ) c on c.day = d::date
    ),
    'campaigns', (
      select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'count', t.n) order by t.n desc), '[]'::jsonb)
      from (
        select coalesce(nullif(raw_user_meta_data->>'utm_campaign', ''), 'sin campaña') as name, count(*) as n
        from auth.users group by 1
      ) t
    ),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'count', t.n) order by t.n desc), '[]'::jsonb)
      from (
        select coalesce(nullif(raw_user_meta_data->>'utm_source', ''), 'sin fuente') as name, count(*) as n
        from auth.users group by 1
      ) t
    ),
    'suggestions', jsonb_build_object(
      'nueva', (select count(*) from public.suggestions where status = 'nueva'),
      'vista', (select count(*) from public.suggestions where status = 'vista'),
      'hecha', (select count(*) from public.suggestions where status = 'hecha')
    )
  );
end;
$$;
revoke all on function public.admin_metrics() from public, anon;
grant execute on function public.admin_metrics() to authenticated;

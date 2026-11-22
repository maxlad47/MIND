-- MIND — schéma Postgres (Supabase). Exécuter dans l'éditeur SQL, ou `supabase db push`.
create extension if not exists pgcrypto;

create type public.app_role as enum ('coach', 'client');

-- Configuration : l'email du coach vit ici (un trigger Postgres ne lit pas les variables d'environnement).
create table public.app_config (key text primary key, value text not null);
insert into public.app_config (key, value) values ('coach_email', 'REMPLACER@VOTRE-EMAIL.COM') on conflict do nothing;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'client',
  first_name text not null default '',
  email text not null,
  reminder_time time not null default '18:00',
  theme text not null default 'auto',
  notifications boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- Inscription libre : le compte dont l'email = coach_email reçoit le rôle coach, tous les autres sont clients.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name, role)
  values (
    new.id, new.email, coalesce(new.raw_user_meta_data ->> 'first_name', split_part(new.email, '@', 1)),
    case when lower(new.email) = lower((select value from public.app_config where key = 'coach_email')) then 'coach'::public.app_role else 'client'::public.app_role end
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_coach() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
$$;

create table public.exercises (
  id text primary key, name text not null, muscle text not null, secondary text[] not null default '{}',
  pattern text not null, equipment text not null, level text not null, contra text[] not null default '{}',
  compound boolean not null default false, cue text not null default ''
);

create table public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  version int not null, data jsonb not null, created_at timestamptz not null default now(),
  unique (client_id, version)
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('muscu', 'course', 'mixte')),
  goal text not null, priority text not null,
  start_date date not null, race_date date, race_distance text, objective text, target_seconds int,
  status text not null default 'actif' check (status in ('actif', 'termine', 'archive')),
  split text, cycle int not null default 1, paces jsonb, warnings jsonb not null default '[]', questionnaire jsonb not null,
  created_at timestamptz not null default now()
);

create table public.program_weeks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  n int not null, start_date date not null, phase text not null, light boolean not null default false, note text,
  unique (program_id, n)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  week_id uuid not null references public.program_weeks (id) on delete cascade,
  planned_date date not null, slot text check (slot in ('am', 'pm')),
  sport text not null check (sport in ('muscu', 'course')), kind text not null, title text not null,
  status text not null default 'prevue' check (status in ('prevue', 'faite', 'manquee', 'sautee')),
  position int not null default 0, est_minutes int not null default 0, leg_load text, lighten boolean not null default false,
  feeling int, duration_min int, moved_from date, note text, done_at timestamptz
);

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  position int not null, sets int not null, rep_min int not null, rep_max int not null, rir int not null, rest_sec int not null, target_kg numeric
);

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  session_exercise_id uuid not null references public.session_exercises (id) on delete cascade,
  n int not null, kg numeric not null, reps int not null, rir int not null, logged_at timestamptz not null default now(),
  unique (session_exercise_id, n)
);

create table public.run_blocks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  position int not null, label text not null, meters int, seconds int, reps int, pace_sec numeric, rec_sec int, rec_label text,
  warmup text, cooldown text, total_km numeric
);

-- `source` prépare l'import Strava / Apple Santé / Garmin (V2).
create table public.run_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  km numeric not null, seconds int not null, feeling int, comment text,
  source text not null default 'manuel' check (source in ('manuel', 'strava', 'apple_sante', 'garmin')),
  external_id text, logged_at timestamptz not null default now()
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  day date not null default current_date, energy int not null, sleep int not null, soreness int not null,
  pain boolean not null default false, pain_zone text
);

create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  kg numeric not null, reps int not null, e1rm numeric not null, day date not null, session_id uuid references public.sessions (id) on delete set null
);

create table public.adaptations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  day date not null default current_date,
  kind text not null, text text not null,
  status text not null default 'applique' check (status in ('applique', 'propose', 'accepte', 'refuse', 'annule')),
  undo jsonb, payload jsonb
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  week_n int not null, summary text not null, source text not null default 'ia', created_at timestamptz not null default now(),
  unique (program_id, week_n)
);

create table public.edits_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  by_role public.app_role not null, by_name text not null, text text not null, created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  text text not null, created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null, body text not null, link text, read boolean not null default false, created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique, p256dh text not null, auth text not null, created_at timestamptz not null default now()
);

create index on public.sessions (client_id, planned_date);
create index on public.set_logs (client_id);
create index on public.comments (session_id);

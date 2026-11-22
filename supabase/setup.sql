-- MIND — installation Supabase (version synchronisation).
-- À coller en une fois dans Supabase > SQL Editor > New query, puis « Run ».
--
-- ÉTAPE UNIQUE À PERSONNALISER : remplace TON-EMAIL@exemple.com (ligne marquée « <<< ») par l'email
-- avec lequel TU créeras ton compte coach. Le compte qui s'inscrit avec cet email reçoit le rôle coach,
-- tous les autres sont des clients.

create type public.app_role as enum ('coach', 'client');

-- Configuration : l'email du coach vit ici (un trigger Postgres ne lit pas les variables d'environnement).
create table public.app_config (key text primary key, value text not null);
insert into public.app_config (key, value) values ('coach_email', 'TON-EMAIL@exemple.com'); -- <<< à remplacer

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

-- Toutes les données de l'app (questionnaires, programmes, séances saisies, commentaires, records…) :
-- un enregistrement JSON par élément, rattaché à un client.
create table public.records (
  id text primary key,
  client_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index records_client_idx on public.records (client_id);

-- Boîte de réception (notifications dans l'app) : n'importe qui peut déposer un message à un autre, seul le destinataire le lit.
create table public.inbox (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index inbox_user_idx on public.inbox (user_id);

-- Sécurité (RLS) : un client ne voit et ne modifie que ses données ; le coach voit et modifie tout.
alter table public.app_config enable row level security; -- aucune politique : inaccessible depuis l'API
alter table public.profiles enable row level security;
alter table public.records enable row level security;
alter table public.inbox enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or role = 'coach' or public.is_coach());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy profiles_update_coach on public.profiles for update to authenticated using (public.is_coach()) with check (true);

create policy records_rls on public.records for all to authenticated
  using (client_id = auth.uid() or public.is_coach())
  with check (client_id = auth.uid() or public.is_coach());

create policy inbox_insert on public.inbox for insert to authenticated with check (true);
create policy inbox_select on public.inbox for select to authenticated using (user_id = auth.uid());
create policy inbox_update on public.inbox for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy inbox_delete on public.inbox for delete to authenticated using (user_id = auth.uid());

-- Temps réel : le coach voit arriver les séances de ses clients, et inversement pour les commentaires.
alter publication supabase_realtime add table public.records, public.inbox, public.profiles;

-- MIND — Garmin (clé personnelle). À exécuter UNE FOIS dans Supabase > SQL Editor.
-- (Ne contient aucun secret. Le secret GARMIN_KEY_SECRET vit dans les secrets Supabase, pas ici.)

-- ============================================================ BLOC 1 : tables (à exécuter d'abord)

-- Clé Garmin de chaque utilisateur, CHIFFRÉE (AES-GCM) par l'Edge Function. Jamais lisible depuis l'app :
-- RLS activée, aucune politique, et tous les droits retirés aux rôles de l'API publique.
create table if not exists public.integrations (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  provider text not null default 'garmin_personal',
  key_enc text not null,
  token_enc text,                       -- jeton d'accès de 24 h, chiffré lui aussi
  token_exp bigint,                     -- fin de validité du jeton (ms epoch)
  expires_at date not null,             -- expiration de la clé (choisie à la création chez Garmin)
  last_sync timestamptz,
  status text not null default 'liee' check (status in ('liee', 'a_renouveler')),
  notified text[] not null default '{}',-- rappels d'expiration déjà envoyés (j10, j2)
  provider_user_id text,                -- accès officiel Starter : identifiant Garmin de l'utilisateur
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.integrations enable row level security;
revoke all on public.integrations from anon, authenticated;

-- Autorisation donnée par le coach (interrupteur de la fiche client). Lue seulement par l'Edge Function ;
-- le coach la modifie via l'action « allow » de garmin-personal-link (un client ne peut donc pas se l'accorder).
create table if not exists public.garmin_access (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  allowed boolean not null default false
);
alter table public.garmin_access enable row level security;
revoke all on public.garmin_access from anon, authenticated;

-- ============================================================ BLOC 2 : synchro automatique toutes les 30 minutes
-- À exécuter APRÈS le déploiement des fonctions, en remplaçant <PROJECT_REF> et <SERVICE_ROLE_KEY> (Settings > API).
-- Ne jamais mettre la clé service_role ailleurs que dans ce SQL (c'est la base qui appelle la fonction, pas le navigateur).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('mind-garmin-sync', '*/30 * * * *', $$
  select net.http_post(url := 'https://<PROJECT_REF>.supabase.co/functions/v1/garmin-personal-sync',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>', 'Content-Type', 'application/json'), body := '{}'::jsonb);
$$);

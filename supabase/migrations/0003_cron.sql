-- Tâches planifiées (à activer une fois les Edge Functions déployées).
-- Remplacez <PROJECT_REF> et <SERVICE_ROLE_KEY> (Settings → API). Ne jamais mettre cette clé dans le front.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Rappels de séance : toutes les heures, la fonction envoie les rappels dont l'heure correspond.
select cron.schedule('mind-reminders', '0 * * * *', $$
  select net.http_post(url := 'https://<PROJECT_REF>.supabase.co/functions/v1/daily-cron?task=reminders',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>', 'Content-Type', 'application/json'), body := '{}'::jsonb);
$$);

-- Analyse hebdomadaire : chaque dimanche à 19 h (UTC, à adapter).
select cron.schedule('mind-weekly-analysis', '0 19 * * 0', $$
  select net.http_post(url := 'https://<PROJECT_REF>.supabase.co/functions/v1/daily-cron?task=weekly',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>', 'Content-Type', 'application/json'), body := '{}'::jsonb);
$$);

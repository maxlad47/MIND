-- MIND — suppression d'un profil client par le coach. À exécuter UNE FOIS dans Supabase > SQL Editor (sans danger si relancé).
--
-- Supprimer le compte (auth.users) efface en cascade : profil, enregistrements (questionnaires, programmes, séances,
-- commentaires, records, santé…), boîte de réception, clé Garmin chiffrée et autorisation Garmin.
-- Seul le coach peut l'appeler, et jamais sur un compte coach (ni sur le sien).

create or replace function public.delete_client(target uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_coach() then
    raise exception 'Réservé au coach' using errcode = '42501';
  end if;
  if target = auth.uid() or exists (select 1 from public.profiles where id = target and role = 'coach') then
    raise exception 'Un compte coach ne peut pas être supprimé ici' using errcode = '42501';
  end if;
  -- notifications du coach qui pointent vers ce client (« Douleur signalée », « a répondu »…)
  delete from public.inbox where data ->> 'link' = '/coach/client/' || target::text;
  delete from auth.users where id = target;
  -- compte sans ligne auth (ne devrait pas arriver) : on efface quand même le profil
  delete from public.profiles where id = target;
end $$;

revoke all on function public.delete_client(uuid) from public, anon;
grant execute on function public.delete_client(uuid) to authenticated;

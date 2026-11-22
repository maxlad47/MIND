-- Sécurité : un client ne voit et ne modifie que ses données ; le coach voit et modifie tout.
alter table public.app_config enable row level security;
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;

-- Bibliothèque d'exercices : lecture pour tout utilisateur connecté, écriture réservée au coach.
create policy exercises_read on public.exercises for select to authenticated using (true);
create policy exercises_write on public.exercises for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- Profils : chacun lit/modifie le sien (sans pouvoir changer son rôle) ; le coach lit et modifie tous les profils.
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_coach());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy profiles_update_coach on public.profiles for update to authenticated using (public.is_coach()) with check (true);

-- app_config : aucune politique = inaccessible depuis l'API (lue uniquement par le trigger, en security definer).

do $$
declare t text;
begin
  foreach t in array array[
    'questionnaires', 'programs', 'program_weeks', 'sessions', 'session_exercises', 'set_logs', 'run_blocks', 'run_logs',
    'checkins', 'personal_records', 'adaptations', 'analyses', 'edits_history', 'comments'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (client_id = auth.uid() or public.is_coach()) with check (client_id = auth.uid() or public.is_coach())', t || '_rls', t);
  end loop;
end $$;

-- Commentaires : le coach écrit sur la séance d'un client, le client répond sur ses propres séances (déjà couvert par client_id).
alter table public.notifications enable row level security;
create policy notifications_rls on public.notifications for all to authenticated using (user_id = auth.uid()) with check (true);

alter table public.push_subscriptions enable row level security;
create policy push_rls on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

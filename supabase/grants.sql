-- À lancer une fois dans Supabase > SQL Editor (sans danger si déjà fait) :
-- donne aux utilisateurs connectés le droit d'utiliser les tables (les règles RLS restent en vigueur : chacun ne voit que ses données).
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.records, public.inbox to authenticated;
grant select, update on public.profiles to authenticated;

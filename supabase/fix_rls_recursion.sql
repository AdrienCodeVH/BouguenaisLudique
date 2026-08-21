-- Correctif à exécuter sur un projet Supabase déjà initialisé.
-- Il supprime la récursion des policies de public.profiles sans modifier les données.

begin;

create or replace function public.bl_current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid());
$$;

create or replace function public.bl_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

revoke all on function public.bl_current_user_role() from public;
revoke all on function public.bl_is_admin() from public;
grant execute on function public.bl_current_user_role() to anon, authenticated;
grant execute on function public.bl_is_admin() to anon, authenticated;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.bl_is_admin()
  );

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.bl_is_admin())
  with check (true);

drop policy if exists "profiles_update_self_no_role_change" on public.profiles;
create policy "profiles_update_self_no_role_change"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.bl_current_user_role()
  );

commit;

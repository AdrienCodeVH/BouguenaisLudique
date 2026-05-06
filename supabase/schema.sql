-- =============================================================================
-- À exécuter une fois dans Supabase → SQL Editor → Run
-- Crée public.profiles + RLS + trigger après chaque inscription (auth.users)
-- =============================================================================

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  role text not null default 'client'
    check (role in ('admin', 'employee', 'client')),
  created_at timestamptz default now()
);

-- Si la table existait déjà (ex: colonne role absente), on la rajoute.
alter table public.profiles
  add column if not exists role text not null default 'client';

-- Vérifie que la contrainte existe (redondant si déjà présente, mais safe).
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'employee', 'client'));

alter table public.profiles enable row level security;

-- =============================================================================
-- RLS : droits par rôle
-- - client : lit/édite uniquement son profil (et ne peut pas changer role)
-- - employee : pour le moment même droits que client (on pourra élargir plus tard)
-- - admin : lit / édite tous les profils, peut changer role
-- =============================================================================

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (true);

drop policy if exists "profiles_update_self_no_role_change" on public.profiles;
create policy "profiles_update_self_no_role_change"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (
      select old.role
      from public.profiles old
      where old.id = auth.uid()
    )
  );

-- Fonction : nouvelle ligne dans profiles à chaque nouveau compte
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), ''),
      'Joueur'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

-- Si cette ligne échoue, remplace « function » par « procedure » (anciennes versions PG).
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- =============================================================================
-- Bootstrap admin : promouvoir TON compte via ton e-mail
-- 1) Crée ton compte depuis la page /inscription
-- 2) Remplace l'e-mail ci-dessous puis exécute ce bloc complet
-- =============================================================================
insert into public.profiles (id, display_name, role)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(split_part(coalesce(u.email, ''), '@', 1)), ''),
    'Joueur'
  ),
  'client'
from auth.users u
where lower(u.email) = lower('ton-email-admin@exemple.com')
on conflict (id) do nothing;

update public.profiles p
set role = 'admin'
from auth.users u
where u.id = p.id
  and lower(u.email) = lower('ton-email-admin@exemple.com');

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

-- =============================================================================
-- Données administrables : baromètre du projet + produits
-- =============================================================================

create table if not exists public.project_barometer (
  id bigint primary key generated always as identity,
  current_orders integer not null default 50 check (current_orders >= 0),
  target_orders integer not null default 100 check (target_orders > 0),
  next_milestone text not null default 'remise en main propre & café offert',
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id bigint primary key generated always as identity,
  name text not null,
  category text not null,
  price_eur numeric(10,2) not null default 0 check (price_eur >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_threshold_rules (
  id bigint primary key generated always as identity,
  min_orders integer not null check (min_orders > 0),
  label text not null,
  scope text not null default 'global' check (scope in ('global', 'personal')),
  visibility text not null default 'admin' check (visibility in ('admin', 'public')),
  owner_user_id uuid references public.profiles(id) on delete set null,
  is_triggered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_barometer enable row level security;
alter table public.products enable row level security;
alter table public.admin_threshold_rules enable row level security;

drop policy if exists "project_barometer_select_public" on public.project_barometer;
create policy "project_barometer_select_public"
  on public.project_barometer for select
  using (true);

drop policy if exists "project_barometer_admin_write" on public.project_barometer;
create policy "project_barometer_admin_write"
  on public.project_barometer for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "products_select_public" on public.products;
create policy "products_select_public"
  on public.products for select
  using (true);

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write"
  on public.products for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "admin_threshold_rules_select_public_or_admin" on public.admin_threshold_rules;
create policy "admin_threshold_rules_select_public_or_admin"
  on public.admin_threshold_rules for select
  using (
    visibility = 'public'
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "admin_threshold_rules_admin_write" on public.admin_threshold_rules;
create policy "admin_threshold_rules_admin_write"
  on public.admin_threshold_rules for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

insert into public.project_barometer (id, current_orders, target_orders, next_milestone)
values (1, 50, 100, 'remise en main propre & café offert')
on conflict (id) do nothing;

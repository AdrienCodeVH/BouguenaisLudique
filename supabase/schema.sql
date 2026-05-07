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
  age_min integer check (age_min is null or age_min >= 0),
  age_max integer check (age_max is null or age_max >= 0),
  image_url text,
  video_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products
  add column if not exists age_min integer;

alter table public.products
  add column if not exists age_max integer;

alter table public.products
  add column if not exists image_url text;

alter table public.products
  add column if not exists video_url text;

alter table public.products
  drop constraint if exists products_age_min_check;

alter table public.products
  add constraint products_age_min_check
  check (age_min is null or age_min >= 0);

alter table public.products
  drop constraint if exists products_age_max_check;

alter table public.products
  add constraint products_age_max_check
  check (age_max is null or age_max >= 0);

alter table public.products
  drop constraint if exists products_age_range_check;

alter table public.products
  add constraint products_age_range_check
  check (age_min is null or age_max is null or age_max >= age_min);

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

create table if not exists public.user_orders (
  id bigint primary key generated always as identity,
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_count integer not null default 1 check (order_count > 0),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_barometer_templates (
  id bigint primary key generated always as identity,
  title text not null,
  description text,
  game_category text,
  progression_mode text not null default 'repeatable_reset'
    check (progression_mode in ('repeatable_reset', 'one_time_unlock')),
  target_value integer not null check (target_value > 0),
  reward_text text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.user_barometer_templates
  add column if not exists progression_mode text not null default 'repeatable_reset';

alter table public.user_barometer_templates
  drop constraint if exists user_barometer_templates_progression_mode_check;

alter table public.user_barometer_templates
  add constraint user_barometer_templates_progression_mode_check
  check (progression_mode in ('repeatable_reset', 'one_time_unlock'));

create table if not exists public.user_barometer_progress (
  id bigint primary key generated always as identity,
  template_id bigint not null references public.user_barometer_templates(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  current_value integer not null default 0 check (current_value >= 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  unlocked_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(template_id, user_id)
);

alter table public.user_barometer_progress
  add column if not exists completed_count integer not null default 0;

alter table public.user_barometer_progress
  add column if not exists unlocked_at timestamptz;

alter table public.user_barometer_progress
  drop constraint if exists user_barometer_progress_completed_count_check;

alter table public.user_barometer_progress
  add constraint user_barometer_progress_completed_count_check
  check (completed_count >= 0);

create or replace function public.sync_project_barometer_from_user_orders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  select coalesce(sum(order_count), 0)::integer
  into v_total
  from public.user_orders;

  update public.project_barometer
  set current_orders = v_total,
      updated_at = now()
  where id = 1;

  return null;
end;
$$;

drop trigger if exists sync_project_barometer_after_user_orders on public.user_orders;
create trigger sync_project_barometer_after_user_orders
  after insert or update or delete on public.user_orders
  for each statement
  execute function public.sync_project_barometer_from_user_orders();

alter table public.project_barometer enable row level security;
alter table public.products enable row level security;
alter table public.admin_threshold_rules enable row level security;
alter table public.user_orders enable row level security;
alter table public.user_barometer_templates enable row level security;
alter table public.user_barometer_progress enable row level security;

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

drop policy if exists "user_orders_select_self_or_admin" on public.user_orders;
create policy "user_orders_select_self_or_admin"
  on public.user_orders for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "user_orders_insert_self_or_admin" on public.user_orders;
create policy "user_orders_insert_self_or_admin"
  on public.user_orders for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "user_orders_admin_update_delete" on public.user_orders;
create policy "user_orders_admin_update_delete"
  on public.user_orders for all
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

drop policy if exists "user_barometer_templates_select_public" on public.user_barometer_templates;
create policy "user_barometer_templates_select_public"
  on public.user_barometer_templates for select
  using (true);

drop policy if exists "user_barometer_templates_admin_write" on public.user_barometer_templates;
create policy "user_barometer_templates_admin_write"
  on public.user_barometer_templates for all
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

drop policy if exists "user_barometer_progress_select_self_or_admin" on public.user_barometer_progress;
create policy "user_barometer_progress_select_self_or_admin"
  on public.user_barometer_progress for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "user_barometer_progress_insert_self_or_admin" on public.user_barometer_progress;
create policy "user_barometer_progress_insert_self_or_admin"
  on public.user_barometer_progress for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "user_barometer_progress_update_self_or_admin" on public.user_barometer_progress;
create policy "user_barometer_progress_update_self_or_admin"
  on public.user_barometer_progress for update
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

insert into public.project_barometer (id, current_orders, target_orders, next_milestone)
values (1, 50, 100, 'remise en main propre & café offert')
on conflict (id) do nothing;

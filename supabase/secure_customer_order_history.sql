-- Sécurise le compteur de commandes et expose un historique client en lecture seule.
-- Les anciennes lignes user_orders sont conservées mais ne comptent plus dans
-- le baromètre global et ne peuvent plus être créées par un client.

begin;

alter table public.order_requests
  add column if not exists linked_user_id uuid
  references public.profiles(id) on delete set null;

create index if not exists order_requests_linked_user_id_idx
  on public.order_requests (linked_user_id);

create or replace function public.bl_link_order_request_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select u.id
  into new.linked_user_id
  from auth.users u
  where lower(trim(u.email)) = lower(trim(new.customer_email))
  order by u.created_at asc
  limit 1;

  return new;
end;
$$;

drop trigger if exists link_order_request_user_from_email on public.order_requests;
create trigger link_order_request_user_from_email
  before insert or update of customer_email on public.order_requests
  for each row
  execute function public.bl_link_order_request_user();

-- Rattache les demandes historiques aux comptes déjà existants.
update public.order_requests o
set linked_user_id = u.id,
    updated_at = now()
from auth.users u
where o.linked_user_id is null
  and lower(trim(o.customer_email)) = lower(trim(u.email));

-- Rattache aussi les anciennes demandes lorsqu'un compte est créé plus tard.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
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

  update public.order_requests
  set linked_user_id = new.id,
      updated_at = now()
  where linked_user_id is null
    and lower(trim(customer_email)) = lower(trim(coalesce(new.email, '')));

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_new_user();

-- Supprime les deux chemins d'auto-crédit côté client.
drop policy if exists "user_orders_insert_self_or_admin" on public.user_orders;
drop policy if exists "user_barometer_progress_insert_self_or_admin"
  on public.user_barometer_progress;
drop policy if exists "user_barometer_progress_update_self_or_admin"
  on public.user_barometer_progress;

drop policy if exists "user_barometer_progress_admin_write"
  on public.user_barometer_progress;
create policy "user_barometer_progress_admin_write"
  on public.user_barometer_progress for all
  using (public.bl_is_admin())
  with check (public.bl_is_admin());

-- Le baromètre public ne dépend plus que des demandes validées par l'admin.
drop trigger if exists sync_project_barometer_after_user_orders on public.user_orders;
drop trigger if exists sync_project_barometer_after_order_requests
  on public.order_requests;
drop function if exists public.sync_project_barometer_from_user_orders();

create or replace function public.sync_project_barometer_from_confirmed_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  select coalesce(sum(o.confirmed_order_count), 0)::integer
  into v_total
  from public.order_requests o
  where o.status in ('validated', 'completed');

  update public.project_barometer
  set current_orders = v_total,
      updated_at = now()
  where id = 1;

  return null;
end;
$$;

create trigger sync_project_barometer_after_order_requests
  after insert or update or delete on public.order_requests
  for each statement
  execute function public.sync_project_barometer_from_confirmed_requests();

-- Le client passe par cette fonction : aucune note interne ni e-mail n'est exposé.
create or replace function public.bl_customer_order_history()
returns table (
  id bigint,
  product_name text,
  category text,
  status text,
  confirmed_order_count integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    o.product_name,
    o.category,
    o.status,
    o.confirmed_order_count,
    o.created_at,
    o.updated_at
  from public.order_requests o
  where o.linked_user_id = (select auth.uid())
  order by o.created_at desc;
$$;

revoke all on function public.bl_customer_order_history() from public, anon;
grant execute on function public.bl_customer_order_history() to authenticated;

update public.project_barometer
set current_orders = (
      select coalesce(sum(o.confirmed_order_count), 0)::integer
      from public.order_requests o
      where o.status in ('validated', 'completed')
    ),
    updated_at = now()
where id = 1;

notify pgrst, 'reload schema';

commit;

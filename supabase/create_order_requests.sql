-- Correctif à exécuter sur un projet Supabase où public.order_requests manque.
-- Crée la table, sa RLS et la synchronisation avec le baromètre global.

begin;

create table if not exists public.order_requests (
  id bigint primary key generated always as identity,
  customer_name text not null
    check (char_length(trim(customer_name)) between 2 and 80),
  customer_email text not null
    check (customer_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  category text not null
    check (category in ('tcg', 'jeux-societe', 'classiques-puzzle-echecs', 'idee-cadeau', 'autre')),
  product_name text not null
    check (char_length(trim(product_name)) between 2 and 140),
  player_age integer check (player_age is null or (player_age >= 0 and player_age <= 120)),
  budget_eur numeric(10,2) check (budget_eur is null or budget_eur > 0),
  details text not null
    check (char_length(trim(details)) between 20 and 1000),
  pickup_notes text check (pickup_notes is null or char_length(trim(pickup_notes)) <= 220),
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'validated', 'declined', 'completed')),
  confirmed_order_count integer not null default 0 check (confirmed_order_count >= 0),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.order_requests enable row level security;

drop policy if exists "order_requests_insert_public" on public.order_requests;
create policy "order_requests_insert_public"
  on public.order_requests for insert
  with check (
    status = 'new'
    and confirmed_order_count = 0
    and admin_notes is null
  );

drop policy if exists "order_requests_admin_manage" on public.order_requests;
create policy "order_requests_admin_manage"
  on public.order_requests for all
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

create or replace function public.sync_project_barometer_from_user_orders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  select (
    coalesce((select sum(order_count) from public.user_orders), 0)
    + coalesce((
      select sum(confirmed_order_count)
      from public.order_requests
      where status in ('validated', 'completed')
    ), 0)
  )::integer
  into v_total;

  update public.project_barometer
  set current_orders = v_total,
      updated_at = now()
  where id = 1;

  return null;
end;
$$;

drop trigger if exists sync_project_barometer_after_order_requests on public.order_requests;
create trigger sync_project_barometer_after_order_requests
  after insert or update or delete on public.order_requests
  for each statement
  execute function public.sync_project_barometer_from_user_orders();

notify pgrst, 'reload schema';

commit;

-- À exécuter après le déploiement et le test de submit-order-request.
-- Supprime le chemin d'insertion directe qui contournerait Turnstile.

begin;

alter table public.order_requests enable row level security;
drop policy if exists "order_requests_insert_public" on public.order_requests;

notify pgrst, 'reload schema';

commit;

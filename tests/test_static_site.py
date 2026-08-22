from html.parser import HTMLParser
from pathlib import Path
import re
import struct
import unittest
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]


def read_page(relative_path):
    return (ROOT / relative_path).read_text(encoding="utf-8")


class AnchorParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        href = dict(attrs).get("href")
        if href:
            self.hrefs.append(href)


class FormParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.current_form_id = None
        self.forms = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "form":
            self.current_form_id = attrs.get("id")
            if self.current_form_id:
                self.forms[self.current_form_id] = {"fields": {}, "buttons": []}
            return

        if not self.current_form_id:
            return

        if tag in {"input", "select", "textarea"}:
            name = attrs.get("name") or attrs.get("id")
            if name:
                self.forms[self.current_form_id]["fields"][name] = {"tag": tag, **attrs}
        elif tag == "button":
            self.forms[self.current_form_id]["buttons"].append(attrs)

    def handle_endtag(self, tag):
        if tag == "form":
            self.current_form_id = None


class StaticSiteOrderFlowTests(unittest.TestCase):
    def test_order_page_replaces_public_catalogue(self):
        page = read_page("pages/catalogue.html")

        self.assertIn("<title>Commander - Bouguenais Ludique</title>", page)
        self.assertIn("Commande d'abord", page)
        self.assertIn("Le catalogue ouvrira avec les premières commandes", page)
        self.assertIn("Pourquoi pas encore de catalogue ouvert ?", page)
        self.assertIn("Parcours de commande proposé", page)
        self.assertIn("Faire une demande de commande", page)

        self.assertNotIn("Produits disponibles", page)
        self.assertNotIn("catalogue-products-status", page)
        self.assertIn('id="order-request-auth-gate"', page)
        self.assertIn("Créez votre compte pour commander", page)
        self.assertIn('href="./inscription.html?next=order"', page)
        self.assertIn('href="./connexion.html?next=order"', page)
        self.assertIn('id="order-request-form"', page)
        self.assertIn('class="auth-form order-request-form" novalidate hidden', page)
        self.assertIn('src="../assets/js/order-request.js?v=', page)

    def test_order_request_form_fields_have_html_validation(self):
        page = read_page("pages/catalogue.html")
        parser = FormParser()
        parser.feed(page)
        form = parser.forms.get("order-request-form")
        self.assertIsNotNone(form)

        fields = form["fields"]
        expected_fields = {
            "category",
            "product_name",
            "player_age",
            "budget_eur",
            "details",
            "pickup_notes",
            "company_website",
            "consent",
        }
        self.assertTrue(expected_fields.issubset(fields.keys()))
        self.assertNotIn("customer_name", fields)
        self.assertNotIn("customer_email", fields)

        self.assertEqual(fields["category"].get("required"), None)
        self.assertEqual(fields["product_name"].get("minlength"), "2")
        self.assertEqual(fields["product_name"].get("maxlength"), "140")
        self.assertEqual(fields["player_age"].get("min"), "0")
        self.assertEqual(fields["player_age"].get("max"), "120")
        self.assertEqual(fields["budget_eur"].get("min"), "1")
        self.assertEqual(fields["budget_eur"].get("step"), "0.01")
        self.assertEqual(fields["details"].get("minlength"), "20")
        self.assertEqual(fields["details"].get("maxlength"), "1000")
        self.assertEqual(fields["pickup_notes"].get("maxlength"), "220")
        self.assertEqual(fields["consent"].get("type"), "checkbox")
        self.assertEqual(fields["consent"].get("required"), None)
        self.assertEqual(fields["company_website"].get("tabindex"), "-1")

        self.assertIn('id="order-request-turnstile"', page)
        self.assertIn("challenges.cloudflare.com/turnstile/v0/api.js", page)
        self.assertIn('href="./confidentialite.html"', page)
        self.assertIn("vous inscrivent à aucune newsletter", page)

    def test_legal_and_privacy_pages_cover_current_services(self):
        legal = read_page("pages/mentions-legales.html")
        privacy = read_page("pages/confidentialite.html")

        self.assertIn("Mentions légales", legal)
        self.assertIn("Projet en cours de création", legal)
        self.assertIn("8 rue de la Commune de Paris 1871", legal)
        self.assertIn("bouguenaisludique@gmail.com", legal)
        self.assertIn("GitHub, Inc.", legal)
        self.assertIn("Supabase", legal)
        self.assertIn("Cloudflare Turnstile", legal)
        self.assertIn("Resend", legal)
        self.assertIn("À compléter avant l'ouverture commerciale", legal)

        self.assertIn("Politique de confidentialité", privacy)
        self.assertIn("Mesures précontractuelles", privacy)
        self.assertIn("Aucun outil publicitaire", privacy)
        self.assertIn("réclamation à la CNIL", privacy)
        self.assertIn("https://supabase.com/privacy", privacy)
        self.assertIn("https://www.cloudflare.com/privacypolicy/", privacy)
        self.assertIn("https://resend.com/legal/privacy-policy", privacy)

    def test_every_page_exposes_legal_footer_links(self):
        for html_file in ROOT.glob("**/*.html"):
            with self.subTest(page=html_file.relative_to(ROOT)):
                page = html_file.read_text(encoding="utf-8")
                self.assertIn('class="footer-nav"', page)
                self.assertIn("mentions-legales.html", page)
                self.assertIn("confidentialite.html", page)

    def test_public_pages_have_canonical_and_social_metadata(self):
        public_pages = (
            "index.html",
            "pages/catalogue.html",
            "pages/contact.html",
            "pages/cartes-collection.html",
            "pages/jeux-societe.html",
            "pages/classiques-puzzle-echecs.html",
        )

        for relative_path in public_pages:
            with self.subTest(page=relative_path):
                page = read_page(relative_path)
                self.assertIn('rel="canonical"', page)
                self.assertIn('property="og:title"', page)
                self.assertIn('property="og:description"', page)
                self.assertIn('property="og:image"', page)
                self.assertIn('property="og:image:alt"', page)
                self.assertIn('name="twitter:card" content="summary_large_image"', page)
                self.assertIn("og-bouguenais-ludique.png", page)

    def test_social_preview_is_a_wide_png(self):
        image_path = ROOT / "assets/images/og-bouguenais-ludique.png"
        self.assertTrue(image_path.exists())
        self.assertGreater(image_path.stat().st_size, 100_000)

        with image_path.open("rb") as image:
            self.assertEqual(image.read(8), b"\x89PNG\r\n\x1a\n")
            image.read(8)
            width, height = struct.unpack(">II", image.read(8))

        self.assertGreaterEqual(width, 1200)
        self.assertGreaterEqual(height, 630)
        self.assertAlmostEqual(width / height, 1200 / 630, delta=0.02)

    def test_private_pages_are_not_indexable(self):
        private_pages = (
            "pages/connexion.html",
            "pages/inscription.html",
            "pages/commande-confirmee.html",
            "pages/mon-espace.html",
            "pages/admin.html",
            "pages/admin-barometre.html",
            "pages/admin-comptes.html",
            "pages/admin-demandes.html",
            "pages/admin-produits.html",
        )

        for relative_path in private_pages:
            with self.subTest(page=relative_path):
                self.assertIn(
                    '<meta name="robots" content="noindex, nofollow" />',
                    read_page(relative_path),
                )

    def test_robots_sitemap_and_404_are_ready_for_github_pages(self):
        robots = read_page("robots.txt")
        sitemap_path = ROOT / "sitemap.xml"
        error_page = read_page("404.html")

        self.assertIn("Sitemap: https://adriencodevh.github.io/BouguenaisLudique/sitemap.xml", robots)
        self.assertIn("Disallow: /BouguenaisLudique/pages/admin", robots)
        self.assertIn("Disallow: /BouguenaisLudique/pages/mon-espace.html", robots)

        root = ET.parse(sitemap_path).getroot()
        namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        locations = [node.text for node in root.findall("sm:url/sm:loc", namespace)]
        self.assertIn("https://adriencodevh.github.io/BouguenaisLudique/", locations)
        self.assertIn(
            "https://adriencodevh.github.io/BouguenaisLudique/pages/catalogue.html",
            locations,
        )
        self.assertNotIn(
            "https://adriencodevh.github.io/BouguenaisLudique/pages/admin.html",
            locations,
        )

        self.assertIn("Cette page a quitté la table", error_page)
        self.assertIn('<meta name="robots" content="noindex, follow" />', error_page)
        self.assertIn('href="./index.html"', error_page)

    def test_order_request_script_validates_and_submits_to_supabase(self):
        script = read_page("assets/js/order-request.js")

        self.assertIn("function validateOrderRequest(values)", script)
        self.assertIn("allowedCategories", script)
        self.assertIn("setCustomValidity", script)
        self.assertIn("reportValidity", script)
        self.assertIn("/functions/v1/submit-order-request", script)
        self.assertIn('method: "POST"', script)
        self.assertIn("Authorization: `Bearer ${authenticatedSession.accessToken}`", script)
        self.assertIn('window.BLAuthUi?.getStoredSession?.()', script)
        self.assertIn('window.location.href = "./commande-confirmee.html"', script)
        self.assertNotIn("customer_name: values.customer_name", script)
        self.assertNotIn("customer_email: values.customer_email", script)
        self.assertIn("turnstile_token", script)
        self.assertIn("company_website", script)
        self.assertIn("window.turnstile.reset", script)
        self.assertNotIn("/rest/v1/order_requests", script)
        self.assertIn("window.BLOrderRequest", script)

    def test_authentication_returns_to_the_order_flow(self):
        signup_script = read_page("assets/js/inscription.js")
        login_script = read_page("assets/js/connexion.js")

        for script in (signup_script, login_script):
            self.assertIn('get("next") === "order"', script)
            self.assertIn('"./catalogue.html?resume=order#demande-commande"', script)

        self.assertIn('"./connexion.html?next=order"', signup_script)
        self.assertIn('"./inscription.html?next=order"', login_script)

    def test_signup_confirmation_message_is_user_facing(self):
        page = read_page("pages/inscription.html")
        script = read_page("assets/js/inscription.js")

        self.assertIn("function getEmailConfirmationMessage()", script)
        self.assertIn("e-mail de confirmation", script)
        self.assertIn("reprendre ta demande", script)
        self.assertIn("courriers indésirables", script)
        self.assertNotIn("confirmation e-mail est activée sur Supabase", script)
        self.assertIn('src="../assets/js/inscription.js?v=20260822-3"', page)

    def test_order_confirmation_page_returns_home_automatically(self):
        page = read_page("pages/commande-confirmee.html")
        script = read_page("assets/js/order-confirmation.js")

        self.assertIn("Votre commande va être prise en charge", page)
        self.assertIn('id="confirmation-countdown"', page)
        self.assertIn('href="../index.html"', page)
        self.assertIn('src="../assets/js/order-confirmation.js?v=', page)
        self.assertIn("const redirectDelayMs = 8000", script)
        self.assertIn('window.location.replace("../index.html")', script)

    def test_order_requests_schema_and_policies_exist(self):
        schema = read_page("supabase/schema.sql")

        self.assertIn("create table if not exists public.order_requests", schema)
        self.assertIn("customer_email text not null", schema)
        self.assertIn("char_length(trim(customer_name)) between 2 and 80", schema)
        self.assertIn("category in ('tcg', 'jeux-societe', 'classiques-puzzle-echecs', 'idee-cadeau', 'autre')", schema)
        self.assertIn("player_age integer check", schema)
        self.assertIn("budget_eur numeric(10,2) check", schema)
        self.assertIn("status text not null default 'new'", schema)
        self.assertIn("alter table public.order_requests enable row level security", schema)
        self.assertIn('drop policy if exists "order_requests_insert_public"', schema)
        self.assertNotIn('create policy "order_requests_insert_public"', schema)
        self.assertIn('create policy "order_requests_admin_manage"', schema)

    def test_profiles_rls_uses_non_recursive_role_helpers(self):
        schema = read_page("supabase/schema.sql")
        migration = read_page("supabase/fix_rls_recursion.sql")

        for sql in (schema, migration):
            self.assertIn("create or replace function public.bl_current_user_role()", sql)
            self.assertIn("create or replace function public.bl_is_admin()", sql)
            self.assertIn("security definer", sql)
            self.assertIn("set search_path = ''", sql)
            self.assertIn("or public.bl_is_admin()", sql)
            self.assertIn("using (public.bl_is_admin())", sql)
            self.assertIn("and role = public.bl_current_user_role()", sql)

        recursive_self_lookup = """and role = (
      select old.role
      from public.profiles old"""
        self.assertNotIn(recursive_self_lookup, schema)
        self.assertNotIn(recursive_self_lookup, migration)

    def test_order_requests_recovery_migration_is_complete(self):
        migration = read_page("supabase/create_order_requests.sql")

        self.assertIn("create table if not exists public.order_requests", migration)
        self.assertIn("alter table public.order_requests enable row level security", migration)
        self.assertIn('drop policy if exists "order_requests_insert_public"', migration)
        self.assertNotIn('create policy "order_requests_insert_public"', migration)
        self.assertIn('create policy "order_requests_admin_manage"', migration)
        self.assertIn("create or replace function public.sync_project_barometer_from_confirmed_requests()", migration)
        self.assertNotIn("sum(order_count) from public.user_orders", migration)
        self.assertIn("create trigger sync_project_barometer_after_order_requests", migration)
        self.assertIn("notify pgrst, 'reload schema'", migration)

    def test_customer_order_history_migration_is_secure_and_preserves_legacy_rows(self):
        schema = read_page("supabase/schema.sql")
        migration = read_page("supabase/secure_customer_order_history.sql")

        for sql in (schema, migration):
            self.assertIn("linked_user_id uuid", sql)
            self.assertIn("create or replace function public.bl_link_order_request_user()", sql)
            self.assertIn("create or replace function public.bl_customer_order_history()", sql)
            self.assertIn("o.linked_user_id = (select auth.uid())", sql)
            self.assertIn("revoke all on function public.bl_customer_order_history() from public, anon", sql)
            self.assertIn("grant execute on function public.bl_customer_order_history() to authenticated", sql)
            self.assertIn('drop policy if exists "user_orders_insert_self_or_admin"', sql)
            self.assertNotIn('create policy "user_orders_insert_self_or_admin"', sql)
            self.assertNotIn('create policy "user_barometer_progress_insert_self_or_admin"', sql)
            self.assertNotIn('create policy "user_barometer_progress_update_self_or_admin"', sql)
            self.assertIn("create policy \"user_barometer_progress_admin_write\"", sql)

        self.assertNotIn("drop table public.user_orders", migration.lower())
        self.assertIn("update public.order_requests o", migration)
        self.assertIn("update public.order_requests\n  set linked_user_id = new.id", migration)

    def test_global_barometer_uses_only_admin_confirmed_requests(self):
        schema = read_page("supabase/schema.sql")
        migration = read_page("supabase/secure_customer_order_history.sql")

        for sql in (schema, migration):
            self.assertIn("sync_project_barometer_from_confirmed_requests", sql)
            self.assertIn("where o.status in ('validated', 'completed')", sql)
            self.assertNotIn("sum(order_count) from public.user_orders", sql)

    def test_order_request_submission_is_protected_server_side(self):
        function = read_page("supabase/functions/submit-order-request/index.ts")
        migration = read_page("supabase/secure_order_requests.sql")

        self.assertIn('withSupabase<Database>(', function)
        self.assertIn('auth: "user"', function)
        self.assertNotIn('auth: "publishable:*"', function)
        self.assertIn("context.userClaims?.id", function)
        self.assertIn("context.userClaims?.email", function)
        self.assertIn("getAuthenticatedCustomerName", function)
        self.assertIn("customer_name: authenticatedCustomerName", function)
        self.assertIn("customer_email: authenticatedEmail", function)
        self.assertIn('Authorization: `Bearer ${authenticatedSession.accessToken}`', read_page("assets/js/order-request.js"))
        self.assertIn("linked_user_id: authenticatedUserId", function)
        self.assertIn('.eq("linked_user_id", authenticatedUserId)', function)
        self.assertIn('"Access-Control-Allow-Headers": "apikey, authorization, content-type"', function)
        self.assertIn('Deno.env.get("TURNSTILE_SECRET_KEY")', function)
        self.assertIn("challenges.cloudflare.com/turnstile/v0/siteverify", function)
        self.assertIn('result.action === TURNSTILE_ACTION', function)
        self.assertIn("allowedHostnames.has", function)
        self.assertIn('.from("order_requests")', function)
        self.assertIn("DUPLICATE_WINDOW_MS", function)
        self.assertIn('drop policy if exists "order_requests_insert_public"', migration)

    def test_order_request_notification_function_is_secret_and_escapes_html(self):
        function = read_page("supabase/functions/notify-order-request/index.ts")

        self.assertIn('withSupabase({ auth: "secret:*" }, handler)', function)
        self.assertIn("function normalizeWebhookAuth(request: Request)", function)
        self.assertIn('headers.get("authorization")', function)
        self.assertIn('headers.set("apikey", secretKey)', function)
        self.assertIn("protectedHandler(normalizeWebhookAuth(request))", function)
        self.assertIn('Deno.env.get("RESEND_API_KEY")', function)
        self.assertIn('Deno.env.get("ORDER_NOTIFICATION_TO")', function)
        self.assertIn('fetch("https://api.resend.com/emails"', function)
        self.assertIn('candidate.type === "INSERT"', function)
        self.assertIn('candidate.table === "order_requests"', function)
        self.assertIn('candidate.schema === "public"', function)
        self.assertIn('record?.status === "new"', function)
        self.assertIn("function escapeHtml(value: unknown)", function)
        self.assertIn("function formatSubjectProduct(value: string)", function)
        self.assertIn("reply_to: order.customer_email", function)
        self.assertNotIn("re_xxxxxxxxx", function)

    def test_order_request_notification_setup_is_documented(self):
        documentation = read_page("supabase/functions/notify-order-request/README.md")

        self.assertIn("RESEND_API_KEY", documentation)
        self.assertIn("ORDER_NOTIFICATION_TO", documentation)
        self.assertIn("supabase functions deploy notify-order-request --no-verify-jwt", documentation)
        self.assertIn("public.order_requests", documentation)
        self.assertIn("`INSERT` uniquement", documentation)
        self.assertIn("Add auth header with service key", documentation)

    def test_admin_hub_links_to_order_requests_followup(self):
        page = read_page("pages/admin.html")
        script = read_page("assets/js/admin.js")

        self.assertIn('id="admin-services-nav"', page)
        self.assertIn('page: "admin-demandes.html"', script)
        self.assertIn("Demandes de commande", script)
        self.assertIn("Suivre les demandes", script)

    def test_admin_services_menu_is_shared_and_marks_current_section(self):
        script = read_page("assets/js/admin.js")
        styles = read_page("assets/css/style.css")
        admin_pages = [
            read_page("pages/admin.html"),
            read_page("pages/admin-comptes.html"),
            read_page("pages/admin-barometre.html"),
            read_page("pages/admin-produits.html"),
            read_page("pages/admin-demandes.html"),
        ]

        self.assertIn("function renderAdminServicesNav()", script)
        self.assertIn('aria-current="page"', script)
        self.assertIn("admin-shortcut-card--active", script)
        self.assertNotIn('<h2><a href="./admin.html">Services principaux</a></h2>', script)
        self.assertNotIn('content: "Section active"', styles)
        for target in (
            "admin-comptes.html",
            "admin-barometre.html",
            "admin-produits.html",
            "admin-demandes.html",
        ):
            self.assertIn(f'page: "{target}"', script)
        self.assertIn('.admin-shortcut-card[aria-current="page"]', styles)

        for page in admin_pages:
            self.assertIn('id="admin-services-nav"', page)
            self.assertIn('aria-label="Services principaux"', page)
            self.assertIn('href="../assets/css/style.css?v=20260822-3"', page)
            self.assertIn('src="../assets/js/admin.js?v=20260822-4"', page)

    def test_admin_order_requests_page_exposes_tracking_table(self):
        page = read_page("pages/admin-demandes.html")

        self.assertIn("Demandes de commande", page)
        self.assertIn('id="admin-requests-section"', page)
        self.assertIn('id="admin-requests-feedback"', page)
        self.assertIn('id="admin-requests-body"', page)
        self.assertIn('id="admin-request-search"', page)
        self.assertIn('id="admin-request-status-filter"', page)
        self.assertIn('id="admin-request-reset"', page)
        self.assertIn('id="admin-request-results-meta"', page)
        self.assertIn('id="admin-request-count-new"', page)
        self.assertIn('id="admin-request-count-progress"', page)
        self.assertIn('class="admin-table admin-request-table"', page)
        self.assertIn("Notes admin", page)
        self.assertIn("Statut", page)
        self.assertIn('src="../assets/js/admin.js?v=', page)

    def test_admin_script_manages_order_requests(self):
        script = read_page("assets/js/admin.js")

        self.assertIn("hasRequestsModule", script)
        self.assertIn("function renderOrderRequests(rows)", script)
        self.assertIn("function filterOrderRequests(rows)", script)
        self.assertIn("function applyOrderRequestFilters()", script)
        self.assertIn("function updateOrderRequestSummary(rows)", script)
        self.assertIn("async function loadOrderRequests()", script)
        self.assertIn("async function handleOrderRequestsClick(event)", script)
        self.assertIn("/rest/v1/order_requests?select=", script)
        self.assertIn("/rest/v1/order_requests?id=eq.", script)
        self.assertIn('method: "PATCH"', script)
        self.assertIn("escapeHtml(row.details)", script)
        self.assertIn("data-order-request-status", script)
        self.assertIn("data-order-request-notes", script)
        self.assertIn("admin-request-status-badge", script)
        self.assertIn("admin-request-account--", script)
        self.assertIn("linked_user_id", script)
        self.assertIn("admin-request-reply", script)
        self.assertIn('requestsSearch?.addEventListener("input"', script)
        self.assertIn('requestsStatusFilter?.addEventListener("change"', script)
        self.assertIn("currentOrderRequests", script)

    def test_admin_login_notice_is_recent_one_time_and_temporary(self):
        login_page = read_page("pages/connexion.html")
        login_script = read_page("assets/js/connexion.js")
        admin_script = read_page("assets/js/admin.js")
        admin_pages = [
            read_page("pages/admin.html"),
            read_page("pages/admin-comptes.html"),
            read_page("pages/admin-barometre.html"),
            read_page("pages/admin-produits.html"),
            read_page("pages/admin-demandes.html"),
        ]

        self.assertIn('sessionStorage.setItem("bl_recent_login_at", String(Date.now()))', login_script)
        self.assertIn("function showRecentLoginNotice()", admin_script)
        self.assertIn('sessionStorage.removeItem(recentLoginStorageKey)', admin_script)
        self.assertIn("recentLoginMaxAgeMs = 2 * 60 * 1000", admin_script)
        self.assertIn("loginNoticeDurationMs = 4000", admin_script)
        self.assertNotIn('setStatus("Connexion admin valide.", false);\n    if (servicesNav)', admin_script)
        self.assertIn('src="../assets/js/connexion.js?v=20260822-3"', login_page)
        for page in admin_pages:
            self.assertIn('src="../assets/js/admin.js?v=20260822-4"', page)

    def test_admin_order_requests_layout_is_responsive(self):
        styles = read_page("assets/css/style.css")

        self.assertIn(".admin-request-summary", styles)
        self.assertIn(".admin-request-toolbar", styles)
        self.assertIn(".admin-request-status-badge--new", styles)
        self.assertIn(".admin-request-status-badge--validated", styles)
        self.assertIn(".admin-request-table td::before", styles)
        self.assertIn("content: attr(data-label)", styles)

    def test_customer_space_is_a_read_only_order_history(self):
        page = read_page("pages/mon-espace.html")
        script = read_page("assets/js/mon-espace.js")

        self.assertIn("Mes commandes", page)
        self.assertIn('id="space-orders-body"', page)
        self.assertIn('id="space-orders-meta"', page)
        self.assertIn("Seules les quantités validées", page)
        self.assertNotIn('id="space-order-form"', page)
        self.assertNotIn("Ajouter des commandes", page)

        self.assertIn("/rest/v1/rpc/bl_customer_order_history", script)
        self.assertIn("function renderOrders(rows)", script)
        self.assertIn("confirmed_order_count", script)
        self.assertIn("Mon baromètre", page)
        self.assertIn('id="space-personal-track"', page)
        self.assertNotIn("Projet global", page)
        self.assertNotIn("space-global-count", page)
        self.assertNotIn("current_orders", script)
        self.assertNotIn("/rest/v1/user_orders", script)
        self.assertNotIn("/rest/v1/user_barometer_progress", script)
        self.assertNotIn("function handleSubmit", script)

    def test_homepage_barometer_is_private_and_personal(self):
        page = read_page("index.html")
        script = read_page("assets/js/script.js")
        styles = read_page("assets/css/style.css")

        self.assertIn('aria-label="Mon avancement personnel"', page)
        self.assertIn("Mon avancement", page)
        self.assertIn("les commandes\n                validées qui sont rattachées à votre compte", page)
        self.assertIn("async function loadPersonalBarometer()", script)
        self.assertIn("window.BLAuthUi?.getStoredSession?.()", script)
        self.assertIn("/rest/v1/rpc/bl_customer_order_history", script)
        self.assertIn("Authorization: `Bearer ${accessToken}`", script)
        self.assertIn("select=target_orders,next_milestone", script)
        self.assertNotIn("loadProjectBarometer", script)
        self.assertNotIn("admin_threshold_rules", script)
        self.assertIn(".project-barometer-card[hidden]", styles)

    def test_homepage_points_to_order_flow(self):
        page = read_page("index.html")

        self.assertIn('<a href="./pages/catalogue.html">Commander</a>', page)
        self.assertIn("avant d'ouvrir un catalogue plus large", page)
        self.assertIn(
            '<a class="btn btn-catalogue-cta" href="./pages/catalogue.html">Faire une demande</a>',
            page,
        )

    def test_contact_page_collects_order_request_details(self):
        page = read_page("pages/contact.html")

        self.assertIn('<a href="./catalogue.html">Commander</a>', page)
        self.assertIn("Pour une demande de commande", page)
        self.assertIn("le budget approximatif", page)
        self.assertIn("vos contraintes", page)

    def test_content_pages_return_to_request_flow(self):
        for relative_path in (
            "pages/cartes-collection.html",
            "pages/jeux-societe.html",
            "pages/classiques-puzzle-echecs.html",
        ):
            with self.subTest(page=relative_path):
                page = read_page(relative_path)

                self.assertIn('<a href="./catalogue.html">Commander</a>', page)
                self.assertIn("Faire une demande", page)
                self.assertNotIn("Retour au catalogue", page)

    def test_local_html_links_resolve(self):
        missing_links = []

        for html_file in ROOT.glob("**/*.html"):
            parser = AnchorParser()
            parser.feed(html_file.read_text(encoding="utf-8"))

            for href in parser.hrefs:
                if href.startswith(("http://", "https://", "mailto:", "#")):
                    continue

                local_href = href.split("#", 1)[0].split("?", 1)[0]
                if not local_href:
                    continue

                target = (html_file.parent / local_href).resolve()
                if not target.exists():
                    missing_links.append(f"{html_file.relative_to(ROOT)} -> {href}")

        self.assertEqual([], missing_links)

    def test_local_css_and_javascript_assets_are_versioned(self):
        unversioned_assets = []

        for html_file in ROOT.glob("**/*.html"):
            page = html_file.read_text(encoding="utf-8")
            matches = re.findall(
                r'(?:\./|\.\./)assets/(?:css|js)/[^"?]+\.(?:css|js)(?=")',
                page,
            )
            unversioned_assets.extend(
                f"{html_file.relative_to(ROOT)} -> {asset}" for asset in matches
            )

        self.assertEqual([], unversioned_assets)


if __name__ == "__main__":
    unittest.main()

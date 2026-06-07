from html.parser import HTMLParser
from pathlib import Path
import unittest


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
        self.assertIn('id="order-request-form"', page)
        self.assertIn('src="../assets/js/order-request.js"', page)

    def test_order_request_form_fields_have_html_validation(self):
        page = read_page("pages/catalogue.html")
        parser = FormParser()
        parser.feed(page)
        form = parser.forms.get("order-request-form")
        self.assertIsNotNone(form)

        fields = form["fields"]
        expected_fields = {
            "customer_name",
            "customer_email",
            "category",
            "product_name",
            "player_age",
            "budget_eur",
            "details",
            "pickup_notes",
            "consent",
        }
        self.assertTrue(expected_fields.issubset(fields.keys()))

        self.assertEqual(fields["customer_name"].get("required"), None)
        self.assertEqual(fields["customer_name"].get("minlength"), "2")
        self.assertEqual(fields["customer_name"].get("maxlength"), "80")
        self.assertEqual(fields["customer_email"].get("type"), "email")
        self.assertEqual(fields["customer_email"].get("required"), None)
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

    def test_order_request_script_validates_and_submits_to_supabase(self):
        script = read_page("assets/js/order-request.js")

        self.assertIn("function validateOrderRequest(values)", script)
        self.assertIn("allowedCategories", script)
        self.assertIn("setCustomValidity", script)
        self.assertIn("reportValidity", script)
        self.assertIn("/rest/v1/order_requests", script)
        self.assertIn('method: "POST"', script)
        self.assertIn('Prefer: "return=minimal"', script)
        self.assertIn("window.BLOrderRequest", script)

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
        self.assertIn('create policy "order_requests_insert_public"', schema)
        self.assertIn("status = 'new'", schema)
        self.assertIn("and admin_notes is null", schema)
        self.assertIn('create policy "order_requests_admin_manage"', schema)

    def test_admin_hub_links_to_order_requests_followup(self):
        page = read_page("pages/admin.html")

        self.assertIn('href="./admin-demandes.html"', page)
        self.assertIn("Demandes de commande", page)
        self.assertIn("Suivre les demandes", page)

    def test_admin_order_requests_page_exposes_tracking_table(self):
        page = read_page("pages/admin-demandes.html")

        self.assertIn("Demandes de commande", page)
        self.assertIn('id="admin-requests-section"', page)
        self.assertIn('id="admin-requests-feedback"', page)
        self.assertIn('id="admin-requests-body"', page)
        self.assertIn("Notes admin", page)
        self.assertIn("Statut", page)
        self.assertIn('src="../assets/js/admin.js"', page)

    def test_admin_script_manages_order_requests(self):
        script = read_page("assets/js/admin.js")

        self.assertIn("hasRequestsModule", script)
        self.assertIn("function renderOrderRequests(rows)", script)
        self.assertIn("async function loadOrderRequests()", script)
        self.assertIn("async function handleOrderRequestsClick(event)", script)
        self.assertIn("/rest/v1/order_requests?select=", script)
        self.assertIn("/rest/v1/order_requests?id=eq.", script)
        self.assertIn('method: "PATCH"', script)
        self.assertIn("escapeHtml(row.details)", script)
        self.assertIn("data-order-request-status", script)
        self.assertIn("data-order-request-notes", script)

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


if __name__ == "__main__":
    unittest.main()

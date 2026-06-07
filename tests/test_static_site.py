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
        self.assertNotIn("catalogue-products-grid", page)

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

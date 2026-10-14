#!/usr/bin/env python3
"""Guard against accidental removal of core WASSAFRICA homepage content and routes.

Uses only Python's standard library and checks the source files that render the
homepage, including the two small sections injected by brand-observer.js.
"""
from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECKS = 0


def check(condition: bool, message: str) -> None:
    global CHECKS
    CHECKS += 1
    if not condition:
        raise AssertionError(message)


class VisiblePage(HTMLParser):
    """Collect visible page copy, links, and image attributes (ignore code/style)."""

    IGNORED = {"script", "style", "noscript", "template"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.text_parts: list[str] = []
        self.hrefs: set[str] = set()
        self.images: list[dict[str, str | None]] = []
        self._ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        if tag in self.IGNORED:
            self._ignored_depth += 1
        if tag == "a" and attrs_dict.get("href"):
            self.hrefs.add(attrs_dict["href"] or "")
        if tag == "img":
            self.images.append(attrs_dict)

    def handle_endtag(self, tag: str) -> None:
        if tag in self.IGNORED and self._ignored_depth:
            self._ignored_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self._ignored_depth:
            self.text_parts.append(data)

    @property
    def visible_text(self) -> str:
        return re.sub(r"\s+", " ", " ".join(self.text_parts)).strip().casefold()


def read_required(relative_path: str) -> str:
    path = ROOT / relative_path
    check(path.is_file(), f"Required homepage dependency is missing: {relative_path}")
    return path.read_text(encoding="utf-8")


def main() -> int:
    home_html = read_required("launch-v2.html")
    observer_js = read_required("brand-observer.js")
    showcase_js = read_required("wa-showcase-demo.js")
    contact_js = read_required("wa-contact-suite.js")
    config_text = read_required("vercel.json")

    home = VisiblePage()
    home.feed(home_html)
    home_text = home.visible_text
    home_links = home.hrefs

    # The root URL must continue to serve the current, canonical homepage.
    config = json.loads(config_text)
    root_routes = [
        item for item in config.get("rewrites", [])
        if item.get("source") == "/"
    ]
    check(
        any(item.get("destination") == "/launch-v2.html" for item in root_routes),
        "The '/' route must rewrite to /launch-v2.html.",
    )

    # Core copy and content areas visible in the currently approved homepage.
    required_copy = [
        "L'AFRIQUE OUVERTE AU MONDE",
        "Trouve.",
        "Parle. Fais affaire.",
        "Présentez vos offres. Soyez trouvé. Entrez en contact. Vendez partout en Afrique et au-delà.",
        "Démonstration WASSAFRICA.",
        "Du profil à l’opportunité.",
        "Un parcours, pas une collection d'outils.",
        "Un même espace pour des réalités différentes.",
        "Ce que WASSAFRICA apporte.",
        "Votre activité mérite d’être visible.",
        "Découvrez les vitrines publiques",
        "Pourquoi l'utiliser ?",
        "Pour les personnes",
        "Pour les activités",
        "Pour les entreprises",
        "Une Afrique visible, connectée et ouverte.",
        "Votre identité. Vos relations. Vos opportunités.",
        "Construisons des parcours utiles ensemble.",
        "Être vrai avant d'être grand.",
    ]
    for phrase in required_copy:
        check(
            phrase.casefold() in home_text,
            f"Approved homepage copy/section is missing: {phrase}",
        )

    # Core navigation and conversion routes must remain on the homepage.
    required_routes = [
        "/inbox",
        "/universe",
        "/manifesto",
        "/groups?type=business",
        "/groups",
        "/marche",
        "/commerce",
        "/cart",
        "/smartlink",
        "/dashboard",
        "/auth?next=/smartlink",
        "/presentation",
        "/demo",
        "/market",
        "/market?type=vitrines",
        "/auth",
        "/partenaires",
        "/privacy",
        "/terms",
        "/seller-rules",
    ]
    for route in required_routes:
        check(route in home_links, f"Homepage link is missing: {route}")

    # Preserve the real, high-priority visual in the hero.
    hero_image = next(
        (
            attrs for attrs in home.images
            if attrs.get("alt") == "Visuel réel de la vitrine publique WASSAFRICA"
        ),
        None,
    )
    check(hero_image is not None, "The approved homepage hero image is missing.")
    check(
        bool(hero_image and hero_image.get("loading") == "eager"),
        "The hero image must remain eager-loaded.",
    )
    check(
        bool(hero_image and hero_image.get("fetchpriority") == "high"),
        "The hero image must retain high fetch priority.",
    )

    # Homepage sections injected at runtime are dependencies too; guard their
    # source copy, conversion links, and contact options against silent removal.
    check(
        "showcaseDemo()" in observer_js and "contactSuite()" in observer_js,
        "Homepage runtime must continue mounting the official showcase and contact sections.",
    )

    showcase_copy = [
        "WASSAFRICA est aussi une entreprise présente sur son propre marché.",
        "/wassafrica",
        "/demo",
        "/smartlink",
        "/market",
    ]
    for item in showcase_copy:
        check(item.casefold() in showcase_js.casefold(),
              f"Official WASSAFRICA showcase section is incomplete: {item}")

    contact_items = [
        "Contacter WASSAFRICA",
        "https://wa.me/22370498977",
        "https://wa.me/2290195388292",
        "https://wa.me/2290197174548",
        "mailto:neodigitalstartupacademy@gmail.com",
    ]
    for item in contact_items:
        check(item in contact_js, f"Homepage contact option is missing: {item}")

    print(f"PASS: {CHECKS} homepage non-regression checks.")
    print("Homepage content and routing baseline: launch-v2.html + runtime sections.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, OSError, json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)

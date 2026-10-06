"""Per-route SEO metadata and HTML injection.

The SPA serves the same index.html for every route, which means Google
indexes the static <title>/<meta description> for all URLs unless we
inject per-route tags server-side. This module owns the canonical SEO
table from the marketing brief and rewrites the index.html head before
returning it.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from html import escape
from pathlib import Path


SITE_BASE = "https://www.heyhavlo.com"


@dataclass(frozen=True)
class PageSeo:
    title: str
    description: str
    canonical_path: str

    @property
    def canonical_url(self) -> str:
        return f"{SITE_BASE}{self.canonical_path}"


# Source of truth: havlo_frontend/seo-pages.json, shared with the frontend
# build (havlo_frontend/scripts/prerender-seo.mjs writes each page's own
# HTML and the sitemap from it), so the two can't drift apart.
SEO_PAGES_FILE = Path(__file__).resolve().parents[1] / "havlo_frontend" / "seo-pages.json"


def _load_pages() -> dict[str, PageSeo]:
    data = json.loads(SEO_PAGES_FILE.read_text(encoding="utf-8"))
    return {
        page["path"]: PageSeo(title=page["title"], description=page["description"], canonical_path=page["path"])
        for page in data["pages"]
    }


PAGE_SEO: dict[str, PageSeo] = _load_pages()

# Old paths from the brief that should resolve to a new canonical page.
ALIASES: dict[str, str] = {
    "/about": "/about-us",
    "/contact": "/contact-us",
    "/buy-abroad": "/buy-property-abroad",
}


# Pages taken down: served as "not found" (HTTP 404) so search engines drop them.
REMOVED_PATHS: frozenset[str] = frozenset({
    "/sell-your-property", "/sell-your-property/report", "/sell-faster", "/marketing",
})


def is_removed(path: str) -> bool:
    path = "/" + (path or "").strip("/")
    return path.lower() in REMOVED_PATHS


def lookup(path: str) -> PageSeo:
    """Return the SEO block for a URL path. A page without its own entry gets
    the home page's wording but its own canonical address: pointing every
    page's canonical at "/" told search engines they were all copies of the
    home page."""
    if not path:
        path = "/"
    if not path.startswith("/"):
        path = "/" + path
    # Strip trailing slash except for root.
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/")
    if path in ALIASES:
        path = ALIASES[path]
    if path in PAGE_SEO:
        return PAGE_SEO[path]
    home = PAGE_SEO["/"]
    return PageSeo(title=home.title, description=home.description, canonical_path=path)


_TITLE_RE = re.compile(r"<title>.*?</title>", re.IGNORECASE | re.DOTALL)
_HEAD_CLOSE_RE = re.compile(r"</head>", re.IGNORECASE)
# Matches any of the existing meta/link tags we want to replace, so we don't
# leave duplicates behind that would confuse Google.
_TAGS_TO_STRIP = re.compile(
    r'<meta[^>]+(?:name|property)\s*=\s*"(?:description|og:title|og:description|og:url|twitter:title|twitter:description)"[^>]*/?>'
    r"|"
    r'<link[^>]+rel\s*=\s*"canonical"[^>]*/?>',
    re.IGNORECASE,
)


def inject(html: str, seo: PageSeo) -> str:
    """Rewrite <title>, description, OG, Twitter and canonical tags."""
    title = escape(seo.title, quote=True)
    desc = escape(seo.description, quote=True)
    url = escape(seo.canonical_url, quote=True)

    # Drop existing tags we are about to replace.
    html = _TAGS_TO_STRIP.sub("", html)

    # Replace <title>.
    new_title = f"<title>{title}</title>"
    if _TITLE_RE.search(html):
        html = _TITLE_RE.sub(new_title, html, count=1)
    else:
        html = _HEAD_CLOSE_RE.sub(new_title + "\n</head>", html, count=1)

    og_image = f"{SITE_BASE}/apple-touch-icon.png"
    block = (
        f'<meta name="description" content="{desc}" />\n'
        f'<link rel="canonical" href="{url}" />\n'
        f'<meta property="og:title" content="{title}" />\n'
        f'<meta property="og:description" content="{desc}" />\n'
        f'<meta property="og:type" content="website" />\n'
        f'<meta property="og:url" content="{url}" />\n'
        f'<meta property="og:image" content="{og_image}" />\n'
        f'<meta name="twitter:card" content="summary_large_image" />\n'
        f'<meta name="twitter:title" content="{title}" />\n'
        f'<meta name="twitter:description" content="{desc}" />\n'
        f'<meta name="twitter:image" content="{og_image}" />\n'
    )
    html = _HEAD_CLOSE_RE.sub(block + "</head>", html, count=1)
    return html

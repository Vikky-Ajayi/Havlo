"""Per-route SEO metadata and HTML injection.

The SPA serves the same index.html for every route, which means Google
indexes the static <title>/<meta description> for all URLs unless we
inject per-route tags server-side. This module owns the canonical SEO
table from the marketing brief and rewrites the index.html head before
returning it.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from html import escape


SITE_BASE = "https://www.heyhavlo.com"


@dataclass(frozen=True)
class PageSeo:
    title: str
    description: str
    canonical_path: str

    @property
    def canonical_url(self) -> str:
        return f"{SITE_BASE}{self.canonical_path}"


# Source of truth: HAVLO SEO TASK — Meta Data content (2026-04-24).
PAGE_SEO: dict[str, PageSeo] = {
    "/": PageSeo(
        title="Havlo - Buy, Sell & Manage International Property",
        description=(
            "Havlo helps you buy, sell, and manage properties across multiple "
            "countries. Get expert support, end-to-end guidance, and a "
            "seamless international real estate experience."
        ),
        canonical_path="/",
    ),
    "/about-us": PageSeo(
        title="About Us | Trusted Global Property Experts | Havlo",
        description=(
            "Havlo is a property exposure and advisory platform helping buyers "
            "discover and access real estate opportunities abroad with "
            "confidence. Learn about Havlo's mission, values, and expertise "
            "in international real estate."
        ),
        canonical_path="/about-us",
    ),
    "/contact-us": PageSeo(
        title="Contact Us | Speak to Global Property Experts | Havlo",
        description=(
            "Get in touch with Havlo for expert advice on buying, selling, or "
            "managing property abroad. Our team is ready to guide you at "
            "every step."
        ),
        canonical_path="/contact-us",
    ),
    "/buy-property-abroad": PageSeo(
        title="Buy Property Abroad with Confidence | Havlo",
        description=(
            "Buy property overseas with ease. Havlo provides expert guidance, "
            "legal support, and local insights to help you purchase "
            "international property safely and smoothly."
        ),
        canonical_path="/buy-property-abroad",
    ),
    "/property-matching": PageSeo(
        title="Property Matching - Find your Ideal Property with Budget | Havlo",
        description=(
            "Havlo offers reliable property matching services for "
            "international homeowners, find properties with your preferred "
            "location, type and budget. Our nominated agent finds the homes "
            "that fit you."
        ),
        canonical_path="/property-matching",
    ),
    "/sell-your-property": PageSeo(
        title="Sell Your Property Abroad with Ease | Havlo",
        description=(
            "Sell your property abroad with ease using Havlo. Reach qualified "
            "buyers, manage listings seamlessly, and close deals "
            "faster\u2014no stress, no hassle."
        ),
        canonical_path="/sell-your-property",
    ),
    "/property-audit": PageSeo(
        title="Property Audit Services to Help You Sell Faster | Havlo",
        description=(
            "Struggling to sell your property? Havlo's Property Audit "
            "analyzes pricing, presentation, and marketing to help you "
            "relaunch and attract the right buyers."
        ),
        canonical_path="/property-audit",
    ),
    "/elite-property": PageSeo(
        title="Elite Property | Sell to Global Investors | Havlo",
        description=(
            "Showcase your elite property to a curated network of "
            "ready-to-buy offshore investors. Havlo connects premium listings "
            "with qualified global buyers."
        ),
        canonical_path="/elite-property",
    ),
    "/buyer-network": PageSeo(
        title="Access a Global Buyer Network for Your Property | Havlo",
        description=(
            "Connect your property to a curated network of qualified global "
            "buyers with Havlo. Reach serious investors, increase visibility, "
            "and close deals faster."
        ),
        canonical_path="/buyer-network",
    ),
    "/faq": PageSeo(
        title="FAQs - International Property Buying with Havlo | Havlo",
        description=(
            "Find answers to common questions about buying, selling, and "
            "managing property abroad with Havlo. Clear guidance to help you "
            "make informed decisions."
        ),
        canonical_path="/faq",
    ),
    "/terms": PageSeo(
        title="Terms of Use | Havlo",
        description=(
            "Review Havlo's Terms of Use to understand our services, user "
            "responsibilities, and legal guidelines when using our website "
            "and property solutions."
        ),
        canonical_path="/terms",
    ),
    "/privacy-policy": PageSeo(
        title="Privacy Policy | Havlo",
        description=(
            "Learn how Havlo collects, uses, and protects your personal "
            "information. Your privacy and data security are important to us."
        ),
        canonical_path="/privacy-policy",
    ),
    "/cookie-policy": PageSeo(
        title="Cookie Policy | Havlo",
        description=(
            "Read Havlo's Cookie Policy to understand how cookies are used "
            "on our website to enhance user experience and improve site "
            "performance."
        ),
        canonical_path="/cookie-policy",
    ),
}

# Old paths from the brief that should resolve to a new canonical page.
ALIASES: dict[str, str] = {
    "/about": "/about-us",
    "/contact": "/contact-us",
    "/buy-abroad": "/buy-property-abroad",
    "/sell-faster": "/sell-your-property",
    "/marketing": "/sell-your-property",
}


def lookup(path: str) -> PageSeo:
    """Return the SEO block for a URL path, falling back to the home page."""
    if not path:
        path = "/"
    if not path.startswith("/"):
        path = "/" + path
    # Strip trailing slash except for root.
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/")
    if path in ALIASES:
        path = ALIASES[path]
    return PAGE_SEO.get(path, PAGE_SEO["/"])


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

    block = (
        f'<meta name="description" content="{desc}" />\n'
        f'<link rel="canonical" href="{url}" />\n'
        f'<meta property="og:title" content="{title}" />\n'
        f'<meta property="og:description" content="{desc}" />\n'
        f'<meta property="og:type" content="website" />\n'
        f'<meta property="og:url" content="{url}" />\n'
        f'<meta name="twitter:card" content="summary_large_image" />\n'
        f'<meta name="twitter:title" content="{title}" />\n'
        f'<meta name="twitter:description" content="{desc}" />\n'
    )
    html = _HEAD_CLOSE_RE.sub(block + "</head>", html, count=1)
    return html

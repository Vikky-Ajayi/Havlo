"""
Property listing scraper.
Fetches agent profile pages from listing platforms (Rightmove, Zoopla, OnTheMarket, etc.)
and extracts individual property listings with their details and images.
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-GB,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}


def _detect_platform(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if "rightmove" in host:
        return "rightmove"
    if "zoopla" in host:
        return "zoopla"
    if "onthemarket" in host:
        return "onthemarket"
    if "primelocation" in host:
        return "primelocation"
    return "generic"


async def _fetch(url: str) -> str:
    """HTTP GET with anti-bot headers."""
    async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=HEADERS) as client:
        r = await client.get(url)
        r.raise_for_status()
        return r.text


def _clean_price(raw: str) -> str:
    p = re.sub(r"\s+", " ", raw).strip()
    return p[:60]


def _scrape_rightmove(html: str, base_url: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    listings = []

    # Property cards are inside <li> elements with class "l-searchResult"
    cards = soup.select("li.l-searchResult, div[data-test='propertyCard']")
    if not cards:
        # Fallback: look for property-header links
        cards = soup.select("article.propertyCard")

    for card in cards[:20]:
        try:
            # Title / address
            title_el = (
                card.select_one("h2.propertyCard-title")
                or card.select_one(".propertyCard-address")
                or card.select_one("address")
            )
            title = title_el.get_text(strip=True) if title_el else ""

            # Price
            price_el = (
                card.select_one(".propertyCard-priceValue")
                or card.select_one("span[data-test='price']")
            )
            price = _clean_price(price_el.get_text(strip=True)) if price_el else ""

            # Description
            desc_el = card.select_one(".propertyCard-description")
            description = desc_el.get_text(strip=True)[:300] if desc_el else ""

            # Link
            link_el = card.select_one("a.propertyCard-link") or card.select_one("a[href*='/properties/']")
            link = ""
            if link_el and link_el.get("href"):
                href = link_el["href"]
                link = href if href.startswith("http") else urljoin("https://www.rightmove.co.uk", href)

            # Image
            img_el = card.select_one("img.propertyCard-img") or card.select_one("img[itemprop='image']") or card.select_one("img")
            image = ""
            if img_el:
                image = img_el.get("src") or img_el.get("data-src") or img_el.get("data-lazy-src") or ""

            # Bedrooms
            beds_el = card.select_one(".property-information span") or card.select_one("[class*='bed']")
            beds = beds_el.get_text(strip=True) if beds_el else ""

            if title or link:
                listings.append({
                    "title": title,
                    "price": price,
                    "description": description,
                    "url": link,
                    "image": image,
                    "bedrooms": beds,
                    "platform": "rightmove",
                })
        except Exception as e:
            logger.debug("Rightmove card parse error: %s", e)

    return listings


def _scrape_zoopla(html: str, base_url: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    listings = []

    cards = soup.select("article[data-testid='search-result'], li[data-testid='search-result']")
    if not cards:
        cards = soup.select("div[class*='listing-result'], article")

    for card in cards[:20]:
        try:
            title_el = card.select_one("h2, h3, [data-testid='listing-title']")
            title = title_el.get_text(strip=True) if title_el else ""

            price_el = card.select_one("[data-testid='price'], p[class*='price']")
            price = _clean_price(price_el.get_text(strip=True)) if price_el else ""

            link_el = card.select_one("a[href*='/for-sale/'], a[href*='/to-rent/']") or card.select_one("a")
            link = ""
            if link_el and link_el.get("href"):
                href = link_el["href"]
                link = href if href.startswith("http") else urljoin("https://www.zoopla.co.uk", href)

            img_el = card.select_one("img")
            image = ""
            if img_el:
                image = img_el.get("src") or img_el.get("data-src") or ""

            desc_el = card.select_one("p[class*='description'], [data-testid='listing-description']")
            description = desc_el.get_text(strip=True)[:300] if desc_el else ""

            if title or link:
                listings.append({
                    "title": title,
                    "price": price,
                    "description": description,
                    "url": link,
                    "image": image,
                    "bedrooms": "",
                    "platform": "zoopla",
                })
        except Exception as e:
            logger.debug("Zoopla card parse error: %s", e)

    return listings


def _scrape_generic(html: str, base_url: str, platform: str) -> list[dict]:
    """Generic scraper for other platforms."""
    soup = BeautifulSoup(html, "html.parser")
    listings = []
    domain = urlparse(base_url).netloc

    # Look for any structured property cards
    card_selectors = [
        "article",
        "li[class*='property']",
        "div[class*='property-card']",
        "div[class*='listing']",
        "div[class*='result']",
    ]

    cards = []
    for sel in card_selectors:
        cards = soup.select(sel)
        if len(cards) >= 2:
            break

    for card in cards[:20]:
        try:
            price_el = card.select_one("[class*='price'], [data-test*='price']")
            price = _clean_price(price_el.get_text(strip=True)) if price_el else ""
            if not price:
                continue

            title_el = card.select_one("h2, h3, h4, [class*='title'], [class*='address']")
            title = title_el.get_text(strip=True) if title_el else ""

            link_el = card.select_one("a")
            link = ""
            if link_el and link_el.get("href"):
                href = link_el["href"]
                link = href if href.startswith("http") else f"https://{domain}{href}"

            img_el = card.select_one("img")
            image = ""
            if img_el:
                image = img_el.get("src") or img_el.get("data-src") or ""

            desc_el = card.select_one("p, [class*='description']")
            description = desc_el.get_text(strip=True)[:300] if desc_el else ""

            if price:
                listings.append({
                    "title": title,
                    "price": price,
                    "description": description,
                    "url": link,
                    "image": image,
                    "bedrooms": "",
                    "platform": platform,
                })
        except Exception as e:
            logger.debug("Generic card parse error: %s", e)

    return listings


async def scrape_agent_listings(profile_url: str) -> list[dict]:
    """
    Given an agent profile URL on any listing platform,
    fetch and return a list of their property listings.
    Each listing dict contains: title, price, description, url, image, bedrooms, platform.
    """
    logger.info("Scraping agent listings from: %s", profile_url)

    try:
        html = await _fetch(profile_url)
    except httpx.HTTPStatusError as e:
        logger.error("HTTP error scraping %s: %s", profile_url, e)
        raise ValueError(f"Could not access the profile page (HTTP {e.response.status_code}). Please check the URL.")
    except Exception as e:
        logger.error("Error fetching %s: %s", profile_url, e)
        raise ValueError(f"Could not fetch the profile page: {e}")

    platform = _detect_platform(profile_url)
    logger.info("Detected platform: %s", platform)

    try:
        if platform == "rightmove":
            listings = _scrape_rightmove(html, profile_url)
        elif platform == "zoopla":
            listings = _scrape_zoopla(html, profile_url)
        else:
            listings = _scrape_generic(html, profile_url, platform)
    except Exception as e:
        logger.error("Scrape parse error for %s: %s", profile_url, e)
        listings = []

    logger.info("Scraped %d listings from %s", len(listings), profile_url)
    return listings

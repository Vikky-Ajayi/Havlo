// Country detection + persistence for the site's UK/international split.
//
// Auto-detection comes from Vercel's edge network via /api/geo (see
// havlo_frontend/api/geo.ts) — no third-party geo-IP service, no API key,
// no rate limit. That endpoint only resolves a real country on an actual
// Vercel deployment; in local dev (or if the fetch fails for any reason)
// detection is treated as "unknown" rather than guessing.
const COUNTRY_KEY = 'havlo-country';
const SOURCE_KEY = 'havlo-country-source';

export type CountrySource = 'auto' | 'manual';

export function getStoredCountry(): string | null {
  try {
    return window.localStorage.getItem(COUNTRY_KEY);
  } catch {
    return null;
  }
}

export function getStoredCountrySource(): CountrySource | null {
  try {
    return window.localStorage.getItem(SOURCE_KEY) as CountrySource | null;
  } catch {
    return null;
  }
}

export const COUNTRY_CHANGED_EVENT = 'havlo:country-changed';

export function setStoredCountry(iso: string, source: CountrySource): void {
  const upper = iso.toUpperCase();
  try {
    window.localStorage.setItem(COUNTRY_KEY, upper);
    window.localStorage.setItem(SOURCE_KEY, source);
  } catch {
    // Storage unavailable (private browsing, etc.) — the badge still works
    // for the current page load, it just won't remember the choice.
  }
  // The badge is mounted once in Layout and persists across route changes,
  // reading localStorage only on its own mount. A same-tab localStorage
  // write never fires the native "storage" event (that only fires in
  // *other* tabs), so without this, GeoHome's own auto-detected write —
  // which happens after the badge has already mounted and read the old
  // (empty) value — would never reach it. Broadcasting explicitly is what
  // keeps the badge's flag in sync the moment detection resolves.
  window.dispatchEvent(new CustomEvent(COUNTRY_CHANGED_EVENT, { detail: upper }));
}

export function isUK(iso: string | null | undefined): boolean {
  return (iso || '').toUpperCase() === 'GB';
}

// The buy-abroad pages are written for a Nigerian audience, so Nigeria is
// the only country sent there; everywhere else (the UK included) gets the
// stale-listings experience.
export function isBuyAbroadCountry(iso: string | null | undefined): boolean {
  return (iso || '').toUpperCase() === 'NG';
}

export function isBuyAbroadPath(pathname: string): boolean {
  return /^\/(buyabroad|buy-abroad|buy-property-abroad)(\/|$)/i.test(pathname);
}

// Where the country-switcher badge (and the "/" country redirect) sends
// you for a country.
export function experienceRouteFor(iso: string | null | undefined): string {
  return isBuyAbroadCountry(iso) ? '/buyabroad/uk' : '/stale-listings';
}

// Calls the Vercel edge function once. Resolves to an ISO 3166-1 alpha-2
// code (e.g. "GB") or null if it couldn't be determined (local dev, the
// function isn't deployed yet, or the request failed).
export async function detectCountryFromIP(): Promise<string | null> {
  try {
    const res = await fetch('/api/geo', { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { country?: string | null };
    const country = (data.country || '').trim();
    return country ? country.toUpperCase() : null;
  } catch {
    return null;
  }
}

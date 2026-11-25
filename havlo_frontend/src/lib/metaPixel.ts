export type MetaPixelEventName = 'Lead' | 'AddToCart' | 'Purchase' | 'PageView' | 'InitiateCheckout' | 'AddPaymentInfo';

type MetaPixelParams = Record<string, unknown>;

declare global {
  interface Window {
    fbq?: {
      (command: 'init', pixelId: string, userData?: MetaPixelParams): void;
      (command: 'track', eventName: MetaPixelEventName, params?: MetaPixelParams, options?: MetaPixelParams): void;
      (command: 'trackCustom', eventName: string, params?: MetaPixelParams, options?: MetaPixelParams): void;
    };
    _fbq?: unknown;
  }
}

export const META_PIXEL_ID = '2204792573402043';

export type StaleListingsPixelPlanId = 'property_sale_assessment' | 'quick_insight' | 'professional_review' | 'premium_strategy' | 'listing_recovery_assessment';

export const STALE_LISTINGS_PIXEL_PLANS: Record<
  StaleListingsPixelPlanId,
  { id: StaleListingsPixelPlanId; name: string; value: number; currency: 'GBP' }
> = {
  property_sale_assessment: {
    id: 'property_sale_assessment',
    name: 'Havlo Property Sale Assessment',
    value: 99,
    currency: 'GBP',
  },
  quick_insight: {
    id: 'quick_insight',
    name: 'Quick Insight',
    value: 79.99,
    currency: 'GBP',
  },
  professional_review: {
    id: 'professional_review',
    name: 'Professional Review',
    value: 299.99,
    currency: 'GBP',
  },
  premium_strategy: {
    id: 'premium_strategy',
    name: 'Premium Strategy',
    value: 1499.99,
    currency: 'GBP',
  },
  listing_recovery_assessment: {
    id: 'listing_recovery_assessment',
    name: 'Listing Recovery Assessment',
    value: 99,
    currency: 'GBP',
  },
};

export function getStaleListingsPixelPlan(planId: string | null | undefined) {
  return STALE_LISTINGS_PIXEL_PLANS[(planId || '') as StaleListingsPixelPlanId] || STALE_LISTINGS_PIXEL_PLANS.property_sale_assessment;
}

export function trackMetaPixelEvent(eventName: MetaPixelEventName, params: MetaPixelParams = {}, eventId?: string) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return false;

  try {
    if (eventId) {
      window.fbq('track', eventName, params, { eventID: eventId });
      return true;
    }
    window.fbq('track', eventName, params);
    return true;
  } catch {
    // Tracking must never block checkout or assessment progress.
    return false;
  }
}

export function staleListingsPlanParams(planId: string | null | undefined): MetaPixelParams {
  const plan = getStaleListingsPixelPlan(planId);
  return {
    content_name: plan.name,
    content_ids: [plan.id],
    content_type: 'product',
    content_category: 'stale_listings',
    value: plan.value,
    currency: plan.currency,
  };
}

/** A custom event (PropertyFound, ListingLinkError, ...). False when the pixel isn't loaded (no consent). */
export function trackMetaCustomEvent(eventName: string, params: MetaPixelParams = {}, eventId?: string) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return false;
  try {
    window.fbq('trackCustom', eventName, params, eventId ? { eventID: eventId } : undefined);
    return true;
  } catch {
    return false;
  }
}

// ── Advanced matching: the person's hashed contact details ─────────────────
// From the details form onwards (the tracking brief: "Attach contact details
// from Lead onwards"). Hashed here (SHA-256, Meta's normalisation) and kept
// for this browser tab only, so the pixel set up again after the SumUp
// payment page (index.html) carries them on the Purchase too.

const AM_KEY = 'havlo_meta_am';

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** "+44 07700 900123" -> "447700900123", as app/services/twilio_service.normalize_to_e164. */
export function normalisePhone(raw: string): string {
  const cleaned = (raw || '').trim().replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) return '';
  let rest = cleaned.slice(1);
  const m = rest.match(/^(\d{1,3})0(\d+)$/);
  if (m) rest = m[1] + m[2];
  return /^[1-9]\d{6,14}$/.test(rest) ? rest : '';
}

export async function setMetaUserData(details: { fullName?: string; email?: string; phone?: string; prospectId?: string }) {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return;
  try {
    const data: Record<string, string> = {};
    const email = (details.email || '').trim().toLowerCase();
    if (email.includes('@')) data.em = await sha256(email);
    const phone = normalisePhone(details.phone || '');
    if (phone) data.ph = await sha256(phone);
    const [first, ...rest] = (details.fullName || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (first) data.fn = await sha256(first);
    if (rest.length) data.ln = await sha256(rest.join(' '));
    if (details.prospectId) data.external_id = await sha256(details.prospectId.toLowerCase());
    if (!Object.keys(data).length) return;
    try {
      window.sessionStorage.setItem(AM_KEY, JSON.stringify(data));
    } catch {
      // Storage blocked: this page still gets them.
    }
    if (typeof window.fbq === 'function') window.fbq('init', META_PIXEL_ID, data);
  } catch {
    // Tracking must never block the form.
  }
}

// ── Click IDs (fbp, fbc) for the server's copy of each event ───────────────
// fbc ties a visit to the ad that was clicked. The pixel writes the _fbc
// cookie itself, but only once it loads (after consent), by which time the
// page may have dropped the fbclid from its address. So the landing address's
// fbclid is caught first thing (captureMetaClickId, main.tsx), held in memory,
// and kept in this browser only once cookies are accepted.

const FBC_KEY = 'havlo_fbc';
const FBC_DAYS = 90;
let landingFbc: string | null = null;

function cookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

export function captureMetaClickId(search: string = window.location.search) {
  try {
    const fbclid = new URLSearchParams(search).get('fbclid');
    if (fbclid) landingFbc = `fb.1.${Date.now()}.${fbclid.slice(0, 400)}`;
  } catch {
    // ignore
  }
}

/** Keep the landing fbc in this browser (call once cookies are accepted). */
export function keepMetaClickId() {
  if (!landingFbc) return;
  try {
    window.localStorage.setItem(FBC_KEY, JSON.stringify({ fbc: landingFbc, at: Date.now() }));
  } catch {
    // ignore
  }
}

export function getFbc(): string {
  const fromCookie = cookie('_fbc');
  if (fromCookie) return fromCookie;
  if (landingFbc) return landingFbc;
  try {
    const kept = JSON.parse(window.localStorage.getItem(FBC_KEY) || 'null') as { fbc: string; at: number } | null;
    if (kept && Date.now() - kept.at < FBC_DAYS * 86400000) return kept.fbc;
  } catch {
    // ignore
  }
  return '';
}

export function getFbp(): string {
  return cookie('_fbp');
}

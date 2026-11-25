import { API_BASE } from '../../lib/api';
import { metaTrackingAllowed } from '../../lib/consent';
import { getFbc, getFbp, trackMetaCustomEvent, trackMetaPixelEvent } from '../../lib/metaPixel';

// The /assess/seller journey's Meta events (the marketing team's tracking
// brief, Nov 2026), each sent from the pixel and from our server
// (app/services/meta_capi.py) under the same event_id, so Meta keeps one:
//
//   PageView > PropertyFound > AssessmentStarted > Lead (the marketing team's
//   own) > InitiateCheckout > AddPaymentInfo > Purchase
//
// plus ListingLinkError when the pasted link isn't accepted. Each fires once
// per property per browser tab, and only after the visitor has accepted
// cookies. The value and contact details the server sends come from the
// prospect, not from here.

export type MetaFunnelEvent = 'PropertyFound' | 'ListingLinkError' | 'AssessmentStarted' | 'InitiateCheckout' | 'AddPaymentInfo';

const STANDARD = new Set<MetaFunnelEvent>(['InitiateCheckout', 'AddPaymentInfo']);

function firstTime(key: string): boolean {
  try {
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, '1');
  } catch {
    // Storage blocked: send it this once.
  }
  return true;
}

/** The address without its query string, which can hold the report's access token. */
function pageAddress(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export function sendMetaFunnelEvent(
  name: MetaFunnelEvent,
  opts: { access?: { token?: string; code?: string }; propertyCode?: string; params?: Record<string, unknown>; errorType?: string } = {},
) {
  if (!metaTrackingAllowed()) return;
  const code = opts.propertyCode || opts.access?.code || '';
  // A bad link has no property: a fresh id each time. The rest, once per property.
  const eventId = name === 'ListingLinkError' || !code
    ? `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    : `${name}-${code}`;
  if (name !== 'ListingLinkError' && code && !firstTime(`meta_evt_${eventId}`)) return;

  const params = { ...(opts.params || {}), ...(opts.errorType ? { error_type: opts.errorType } : {}) };
  if (STANDARD.has(name)) trackMetaPixelEvent(name as 'InitiateCheckout' | 'AddPaymentInfo', params, eventId);
  else trackMetaCustomEvent(name, params, eventId);

  // keepalive: AddPaymentInfo is followed straight away by the move to SumUp.
  fetch(`${API_BASE}/stale-listings/meta/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      event_name: name, event_id: eventId, token: opts.access?.token, code: opts.access?.token ? undefined : code || undefined,
      fbp: getFbp() || undefined, fbc: getFbc() || undefined, source_url: pageAddress(), error_type: opts.errorType, consent: true,
    }),
  }).catch(() => { /* tracking never blocks the page */ });
}

/** error_type for ListingLinkError, from the API error (code "listing_link:<kind>", app/services/ads_funnel.ListingLinkError). */
export function listingErrorType(error: unknown): string {
  const e = error as { code?: string; status?: number };
  if (e?.code?.startsWith('listing_link:')) return e.code.slice('listing_link:'.length);
  if (e?.status && e.status >= 500) return 'server_error';
  if (e?.status) return 'other';
  return 'network_error';
}

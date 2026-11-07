// Google Tag Manager events for the seller page (/sell) and the Rightmove
// pages (/rm/...), whose containers index.html loads on those pages only.
// Every page of the Rightmove journey has an /rm/ address (/rm/complete,
// /rm/report, /rm/next-steps, /rm/dashboard/<token>;
// app/services/funnel_paths.py); index.html loads the Rightmove container on
// all of them, and the pages load it too when reached from elsewhere on the
// site. Each event goes on the dataLayer once per browser session and key,
// so reloads don't repeat it.

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export const SELL_GTM_ID = 'GTM-537H8B3L';
// One container for the Rightmove pages, sellers and agents alike (Nov 2026;
// it replaced GTM-KDC3P22M for sellers and GTM-MF4FWMML for agents).
export const RM_GTM_ID = 'GTM-PF7GK3B9';
export const BUY_ABROAD_LISTINGS_GTM_ID = 'GTM-WS22MXCM';
// The Meta2 offer page (/offer/...): its own container (GTM-MF4FWMML, Rightmove's
// agent container until Nov 2026). index.html has the same ID.
export const OFFER_GTM_ID = 'GTM-MF4FWMML';

/** Campaign funnels whose whole journey has its own directory and container
 * (app/services/funnel_paths.py): Rightmove (/rm/...) and the offer page (/offer/...). */
export type Journey = 'rm' | 'offer';
export const journeyGtmId = (journey: Journey): string => (journey === 'rm' ? RM_GTM_ID : OFFER_GTM_ID);

/** The Rightmove pages' container. Takes the audience so the callers needn't
 * change if sellers and agents are ever split again. */
export const rmGtmId = (_audience?: string | null): string => RM_GTM_ID;

/** Loads a Tag Manager container once. index.html already loads a page's
 * container when the visit starts there; this covers arriving on the page
 * from elsewhere on the site. It starts from the gtag('js', ...) index.html
 * puts on the dataLayer, so it isn't pushed again. */
export function loadGtmContainer(id: string): void {
  if (!id) return;
  const src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
  if (document.querySelector(`script[src="${src}"]`)) return;
  window.dataLayer = window.dataLayer || [];
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

export function pushGtmEventOnce(onceKey: string, event: string, params: Record<string, unknown>): void {
  const key = `gtm_${onceKey}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    // Storage unavailable: push it for this load anyway.
  }
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

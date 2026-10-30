// Google Tag Manager events for the seller page (/sell), whose container
// (GTM-537H8B3L) index.html loads on that page only. Each event goes on the
// dataLayer once per browser session and key, so reloads don't repeat it.

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export const SELL_GTM_ID = 'GTM-537H8B3L';
export const BUY_ABROAD_LISTINGS_GTM_ID = 'GTM-WS22MXCM';

/** Loads a Tag Manager container once. index.html already loads a page's
 * container when the visit starts there; this covers arriving on the page
 * from elsewhere on the site. It starts from the gtag('js', ...) index.html
 * puts on the dataLayer, so it isn't pushed again. */
export function loadGtmContainer(id: string): void {
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

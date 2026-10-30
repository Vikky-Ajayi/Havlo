// Google Tag Manager events for the seller page (/sell), whose container
// (GTM-537H8B3L) index.html loads on that page only. Each event goes on the
// dataLayer once per browser session and key, so reloads don't repeat it.

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export const SELL_GTM_ID = 'GTM-537H8B3L';

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

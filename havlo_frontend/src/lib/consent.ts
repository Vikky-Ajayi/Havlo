// Cookie consent for advertising and analytics (the marketing team's tracking
// brief, Nov 2026). The Meta Pixel and the Google tags (Ads, Analytics, the
// Tag Manager containers) in index.html load only once the visitor accepts the
// banner (components/CookieBanner.tsx), and nothing goes to Meta from our
// server for them before that either. Declining, or not answering, means none
// of it. Only on heyhavlo.com: local and preview builds never track.

const KEY = 'havlo_cookie_consent';
export type ConsentChoice = 'granted' | 'denied';

type MetaWindow = Window & {
  havloTrackingHost?: boolean;
  havloMetaHost?: boolean;
  havloLoadGoogleTags?: () => void;
  havloMetaPath?: (path: string) => boolean;
  havloLoadMetaPixel?: () => void;
};

export function getConsent(): ConsentChoice | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

/** Meta tracking may run here: heyhavlo.com, a page with the pixel, consent given. */
export function metaTrackingAllowed(path: string = window.location.pathname): boolean {
  const w = window as MetaWindow;
  return getConsent() === 'granted' && !!w.havloMetaHost && !!w.havloMetaPath?.(path);
}

/** Consent given on heyhavlo.com: Google tags may load, and Meta may get this
 * visit's purchase from our server (every page, not only the pixel's). */
export function trackingAllowed(): boolean {
  return getConsent() === 'granted' && !!(window as MetaWindow).havloTrackingHost;
}

/** Whether to ask: heyhavlo.com (every page has Google's tags), no answer yet. */
export function shouldAskConsent(_path?: string): boolean {
  return getConsent() === null && !!(window as MetaWindow).havloTrackingHost;
}

export function setConsent(choice: ConsentChoice) {
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    // Storage blocked: the choice holds for this page only.
  }
  if (choice === 'granted') {
    (window as MetaWindow).havloLoadGoogleTags?.();
    (window as MetaWindow).havloLoadMetaPixel?.();
  }
  window.dispatchEvent(new Event('havlo-consent'));
}

/** Ask again (the privacy policy's "Change cookie settings"). */
export function resetConsent() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('havlo-consent'));
}

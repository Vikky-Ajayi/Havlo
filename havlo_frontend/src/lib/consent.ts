// Cookie consent for the Meta Pixel (the marketing team's tracking brief, Nov
// 2026). The pixel in index.html loads only once the visitor accepts the
// banner (components/CookieBanner.tsx), and the /assess/seller funnel only
// sends its events to Meta, from the browser or the server, after that.
// Declining, or not answering, means no Meta tracking at all.

const KEY = 'havlo_cookie_consent';
export type ConsentChoice = 'granted' | 'denied';

type MetaWindow = Window & {
  havloMetaHost?: boolean;
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

/** Whether to ask: a page with the pixel on heyhavlo.com, no answer yet. */
export function shouldAskConsent(path: string): boolean {
  const w = window as MetaWindow;
  return getConsent() === null && !!w.havloMetaHost && !!w.havloMetaPath?.(path);
}

export function setConsent(choice: ConsentChoice) {
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    // Storage blocked: the choice holds for this page only.
  }
  if (choice === 'granted') {
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

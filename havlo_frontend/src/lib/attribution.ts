// Where a visitor came from: the UTM tags (utm_source, utm_medium,
// utm_campaign, utm_content, utm_term) of their first and latest tagged visit,
// kept in this browser and sent with the property submission, the details
// form and each checkout, so every lead and sale in the console shows whether
// it came from the ads, an email or a text (app/services/attribution.py).
//
// Ads carry the tags the marketing team sets; the funnel's emails and texts
// carry utm_source=email / sms. A visit without tags never overwrites one with
// them, so someone who comes back by typing the address still counts as
// coming from the email or ad that brought them.

export type UtmTouch = {
  source?: string; medium?: string; campaign?: string; content?: string; term?: string;
  landing?: string; referrer?: string; fbclid?: boolean; gclid?: boolean; at?: string;
};
export type Attribution = { first?: UtmTouch; last?: UtmTouch };

const FIRST_KEY = 'havlo_utm_first';
const LAST_KEY = 'havlo_utm_last';
const FIRST_DAYS = 90;
const LAST_DAYS = 30;
const KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const;

function read(key: string, maxDays: number): UtmTouch | undefined {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    const touch = JSON.parse(raw) as UtmTouch;
    if (touch.at && Date.now() - new Date(touch.at).getTime() > maxDays * 86400000) {
      window.localStorage.removeItem(key);
      return undefined;
    }
    return touch;
  } catch {
    return undefined;
  }
}

function write(key: string, touch: UtmTouch) {
  try {
    window.localStorage.setItem(key, JSON.stringify(touch));
  } catch {
    // Storage blocked (private mode): this visit just isn't remembered.
  }
}

/** Remember this visit's UTM tags, if it has any. Safe to call on every page. */
export function captureAttribution(search: string = window.location.search) {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return;
  }
  const touch: UtmTouch = {};
  KEYS.forEach((k) => {
    const v = params.get(`utm_${k}`);
    if (v && v.trim()) touch[k] = v.trim().slice(0, 120);
  });
  if (params.get('fbclid')) touch.fbclid = true;
  if (params.get('gclid')) touch.gclid = true;
  if (!Object.keys(touch).length) return;
  touch.landing = window.location.pathname.slice(0, 200);
  try {
    const ref = document.referrer ? new URL(document.referrer).hostname : '';
    if (ref && ref !== window.location.hostname) touch.referrer = ref;
  } catch {
    // no referrer
  }
  touch.at = new Date().toISOString();
  const last = read(LAST_KEY, LAST_DAYS);
  // The same visit seen twice (a re-render, a redirect keeping the query).
  if (last && KEYS.every((k) => last[k] === touch[k]) && last.landing === touch.landing
      && Date.now() - new Date(last.at || 0).getTime() < 30 * 60000) return;
  write(LAST_KEY, touch);
  if (!read(FIRST_KEY, FIRST_DAYS)) write(FIRST_KEY, touch);
}

/** The first and latest tagged visits, for the API; undefined when there are none. */
export function getAttribution(): Attribution | undefined {
  const first = read(FIRST_KEY, FIRST_DAYS);
  const last = read(LAST_KEY, LAST_DAYS);
  if (!first && !last) return undefined;
  return { first, last };
}

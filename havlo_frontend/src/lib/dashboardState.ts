/**
 * Local persistence for dashboard subscription state and listings.
 * Used by Sell faster — Relaunch and International Buyer Network dashboards
 * to remember whether the user has subscribed, skipped, or added listings.
 */

const SF_PLAN_KEY = 'havlo:sell_faster_plan';
const SF_SKIPPED_KEY = 'havlo:sell_faster_skipped';
const BN_PLAN_KEY = 'havlo:buyer_network_plan';
const BN_SKIPPED_KEY = 'havlo:buyer_network_skipped';
const BN_LISTINGS_KEY = 'havlo:buyer_network_listings';

// Dev-only: allow URL params to seed/clear dashboard state for preview screenshots.
// Examples:
//   ?_seed=sf-plan          → seed Sell Faster as subscribed (Launch)
//   ?_seed=sf-amplify       → seed Sell Faster Amplify
//   ?_seed=sf-skipped       → seed Sell Faster as skipped
//   ?_seed=bn-plan          → seed Buyer Network as subscribed (Starter) + 1 listing
//   ?_seed=bn-skipped       → seed Buyer Network as skipped
//   ?_seed=clear            → clear all dashboard state
if (import.meta.env.DEV && typeof window !== 'undefined') {
  try {
    const params = new URLSearchParams(window.location.search);
    const seed = params.get('_seed');
    if (seed) {
      const renews = (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d.toISOString();
      })();
      const clear = () => [SF_PLAN_KEY, SF_SKIPPED_KEY, BN_PLAN_KEY, BN_SKIPPED_KEY, BN_LISTINGS_KEY].forEach((k) => localStorage.removeItem(k));

      if (seed === 'clear') clear();
      if (seed === 'sf-plan') {
        clear();
        localStorage.setItem(SF_PLAN_KEY, JSON.stringify({
          id: 'launch', name: 'Launch', tag: 'LAUNCH PLAN',
          setupPrice: '£2,000', monthlyPrice: '£1,500', renewsAt: renews,
        }));
      }
      if (seed === 'sf-amplify') {
        clear();
        localStorage.setItem(SF_PLAN_KEY, JSON.stringify({
          id: 'amplify', name: 'Amplify', tag: 'AMPLIFY PLAN',
          setupPrice: '£3,500', monthlyPrice: '£2,500', renewsAt: renews,
        }));
      }
      if (seed === 'sf-skipped') {
        clear();
        localStorage.setItem(SF_SKIPPED_KEY, '1');
      }
      if (seed === 'bn-plan') {
        clear();
        localStorage.setItem(BN_PLAN_KEY, JSON.stringify({
          id: 'starter', name: 'STARTER', price: '£295', slots: 2, renewsAt: renews,
        }));
        localStorage.setItem(BN_LISTINGS_KEY, JSON.stringify([{
          id: 'lst_demo',
          title: '4-bed detached house',
          address: '12 Cheltenham Road, Bristol BS6 5RW',
          listedPrice: '£875,000',
          reach: 247, enquiries: 18, viewings: 4,
          campaignStartedAt: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
        }]));
      }
      if (seed === 'bn-skipped') {
        clear();
        localStorage.setItem(BN_SKIPPED_KEY, '1');
      }
      params.delete('_seed');
      const qs = params.toString();
      const newUrl = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
  } catch {
    /* ignore */
  }
}

export interface SellFasterPlanState {
  id: string;
  name: string;
  tag: string;
  setupPrice: string;
  monthlyPrice: string;
  renewsAt: string; // ISO date
}

export interface BuyerNetworkPlanState {
  id: string;
  name: string;
  price: string;
  slots: number;
  renewsAt: string; // ISO date
}

export interface BuyerNetworkListing {
  id: string;
  title: string;
  address: string;
  listedPrice: string;
  reach: number;
  enquiries: number;
  viewings: number;
  campaignStartedAt: string;
}

function safeRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ── Sell faster ─────────────────────────────────────────────────────────────
export function getSellFasterPlan(): SellFasterPlanState | null {
  return safeRead<SellFasterPlanState>(SF_PLAN_KEY);
}

export function setSellFasterPlan(plan: SellFasterPlanState): void {
  safeWrite(SF_PLAN_KEY, plan);
  safeRemove(SF_SKIPPED_KEY);
}

export function clearSellFasterPlan(): void {
  safeRemove(SF_PLAN_KEY);
}

export function getSellFasterSkipped(): boolean {
  try {
    return localStorage.getItem(SF_SKIPPED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSellFasterSkipped(value: boolean): void {
  try {
    if (value) localStorage.setItem(SF_SKIPPED_KEY, '1');
    else localStorage.removeItem(SF_SKIPPED_KEY);
  } catch {
    /* ignore */
  }
}

// ── Buyer network ───────────────────────────────────────────────────────────
export function getBuyerNetworkPlan(): BuyerNetworkPlanState | null {
  return safeRead<BuyerNetworkPlanState>(BN_PLAN_KEY);
}

export function setBuyerNetworkPlan(plan: BuyerNetworkPlanState): void {
  safeWrite(BN_PLAN_KEY, plan);
  safeRemove(BN_SKIPPED_KEY);
}

export function clearBuyerNetworkPlan(): void {
  safeRemove(BN_PLAN_KEY);
}

export function getBuyerNetworkSkipped(): boolean {
  try {
    return localStorage.getItem(BN_SKIPPED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setBuyerNetworkSkipped(value: boolean): void {
  try {
    if (value) localStorage.setItem(BN_SKIPPED_KEY, '1');
    else localStorage.removeItem(BN_SKIPPED_KEY);
  } catch {
    /* ignore */
  }
}

// ── Buyer network listings ──────────────────────────────────────────────────
export function getBuyerNetworkListings(): BuyerNetworkListing[] {
  return safeRead<BuyerNetworkListing[]>(BN_LISTINGS_KEY) ?? [];
}

export function setBuyerNetworkListings(listings: BuyerNetworkListing[]): void {
  safeWrite(BN_LISTINGS_KEY, listings);
}

export function addBuyerNetworkListing(listing: Omit<BuyerNetworkListing, 'id'>): BuyerNetworkListing {
  const existing = getBuyerNetworkListings();
  const created: BuyerNetworkListing = {
    id: `lst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ...listing,
  };
  setBuyerNetworkListings([...existing, created]);
  return created;
}

export function getBuyerNetworkSlotCapacity(planId: string | undefined): number {
  switch (planId) {
    case 'starter':
      return 2;
    case 'growth':
      return 5;
    case 'network':
      return 999;
    default:
      return 0;
  }
}

/** Renewal date one month from today, formatted like "24 May 2026". */
export function defaultRenewalDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

export function formatRenewalDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export type MetaPixelEventName = 'Lead' | 'AddToCart' | 'Purchase';

type MetaPixelParams = Record<string, unknown>;

declare global {
  interface Window {
    fbq?: (
      command: 'track',
      eventName: MetaPixelEventName,
      params?: MetaPixelParams,
      options?: MetaPixelParams
    ) => void;
  }
}

export type StaleListingsPixelPlanId = 'quick_insight' | 'professional_review' | 'premium_strategy';

export const STALE_LISTINGS_PIXEL_PLANS: Record<
  StaleListingsPixelPlanId,
  { id: StaleListingsPixelPlanId; name: string; value: number; currency: 'GBP' }
> = {
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
};

export function getStaleListingsPixelPlan(planId: string | null | undefined) {
  return STALE_LISTINGS_PIXEL_PLANS[(planId || '') as StaleListingsPixelPlanId] || STALE_LISTINGS_PIXEL_PLANS.professional_review;
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

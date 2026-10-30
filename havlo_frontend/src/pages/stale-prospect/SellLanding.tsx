import { StaleListingsLanding } from '../StaleListingsLanding';
import { StaleProspectWizard } from './StaleProspectWizard';

// The seller page, /sell: the Stale Listings landing page (without the
// property-code box), whose Rightmove-link box starts the instant funnel:
// We Found Your Property, the assessment, then payment, as on
// /assess/seller. Leads are tagged "sell_seller" (Seller page). It has its
// own Google Tag Manager container (GTM-537H8B3L, loaded by index.html on
// /sell only) and no Meta Pixel; the wizard tells Tag Manager about leads
// and card payments (lib/gtm.ts).
export const SellLanding = () => (
  <StaleProspectWizard ads="owner" channel="sell" landing={(start) => <StaleListingsLanding sell={start} />} />
);

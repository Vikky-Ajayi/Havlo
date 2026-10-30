import { usePageMeta } from '../../hooks/usePageMeta';
import { StaleProspectWizard } from './StaleProspectWizard';

// The seller page, /sell: laid out exactly like the Meta ads page
// (/assess/seller), the same listing-link form and steps. Leads are tagged
// "sell_seller" (Seller page). It has its own Google Tag Manager container
// (GTM-537H8B3L, loaded by index.html on /sell only) and no Meta Pixel; the
// wizard tells Tag Manager about leads and card payments (lib/gtm.ts).
export const SellLanding = () => {
  usePageMeta({
    title: 'Why Hasn’t My Property Sold? | Free Listing Assessment | Havlo',
    description:
      'Paste your Rightmove link and see what could be holding back your property’s sale: market positioning, listing presentation and buyer appeal, with changes that could help.',
  });
  return <StaleProspectWizard ads="owner" channel="sell" />;
};

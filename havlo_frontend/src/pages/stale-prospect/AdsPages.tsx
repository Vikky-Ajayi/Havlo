import { usePageMeta } from '../../hooks/usePageMeta';
import { StaleProspectWizard } from './StaleProspectWizard';

// Meta-ads landing pages. See AdsLanding.tsx for what differs from /check.
export const AdsSellerLanding = () => {
  usePageMeta({
    title: 'Why Hasn’t My Property Sold? | Free Listing Assessment | Havlo',
    description:
      'Paste your Rightmove link and see what could be holding back your property’s sale: market positioning, listing presentation and buyer appeal, with changes that could help.',
  });
  return <StaleProspectWizard ads="owner" />;
};

export const AdsAgentLanding = () => {
  usePageMeta({
    title: 'Slow-Moving Instruction? | Listing Assessment for Estate Agents | Havlo',
    description:
      'Paste the Rightmove link for a listing that’s taking longer than expected and see what’s worth reviewing before your next vendor conversation.',
  });
  return <StaleProspectWizard ads="agent" />;
};

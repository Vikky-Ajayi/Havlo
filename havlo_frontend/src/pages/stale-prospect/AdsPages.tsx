import { usePageMeta } from '../../hooks/usePageMeta';
import type { AdsChannel } from './api';
import { StaleProspectWizard } from './StaleProspectWizard';

// Ads landing pages. See AdsLanding.tsx for what differs from /check. The
// same pages run for Meta (/assess/...) and Google (/g/...);
// the channel only tags the leads (and where their emails link back to).
export const AdsSellerLanding = ({ channel = 'meta' }: { channel?: AdsChannel }) => {
  usePageMeta({
    title: 'Why Hasn’t My Property Sold? | Free Listing Assessment | Havlo',
    description:
      'Paste your Rightmove link and see what could be holding back your property’s sale: market positioning, listing presentation and buyer appeal, with changes that could help.',
  });
  return <StaleProspectWizard ads="owner" channel={channel} />;
};

export const AdsAgentLanding = ({ channel = 'meta' }: { channel?: AdsChannel }) => {
  usePageMeta({
    title: 'Slow-Moving Instruction? | Listing Assessment for Estate Agents | Havlo',
    description:
      'Paste the Rightmove link for a listing that’s taking longer than expected and see what’s worth reviewing before your next vendor conversation.',
  });
  return <StaleProspectWizard ads="agent" channel={channel} />;
};

export const GoogleAdsSellerLanding = () => <AdsSellerLanding channel="google" />;
export const GoogleAdsAgentLanding = () => <AdsAgentLanding channel="google" />;

// The analyst-review funnel (ReviewFunnel.tsx): the same listing-link
// landing page, then an analyst-reviewed report within 48 hours of payment.
export const ReviewSellerLanding = () => {
  usePageMeta({
    title: 'Why Hasn’t My Property Sold? | Analyst-Reviewed Property Report | Havlo',
    description:
      'Paste your Rightmove link for a free first scan. A Havlo property analyst then checks every point and sends you a clear report within 48 hours.',
  });
  return <StaleProspectWizard ads="owner" channel="review" />;
};

export const ReviewAgentLanding = () => {
  usePageMeta({
    title: 'Slow-Moving Instruction? | Analyst-Reviewed Listing Report | Havlo',
    description:
      'Paste the Rightmove link for a free first scan. A Havlo property analyst then reviews the listing and sends you a report for your vendor within 48 hours.',
  });
  return <StaleProspectWizard ads="agent" channel="review" />;
};

import { useEffect, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getProspectPreview, type AdsAudience, type AdsChannel } from './api';
import { Footer, Header, Spinner, StaleProspectWizard, WizardStyles } from './StaleProspectWizard';

// Ads landing pages. See AdsLanding.tsx for what differs from /check. The
// same pages run for Meta (/assess/...) and Google (/g/...);
// the channel only tags the leads (and where their emails link back to).
export const AdsSellerLanding = ({ channel = 'meta' }: { channel?: AdsChannel }) => {
  usePageMeta({
    title: 'Why Hasn’t My Property Sold? | Free Listing Assessment | Havlo',
    description:
      'Paste your Rightmove or Zoopla link and see what could be holding back your property’s sale: market positioning, listing presentation and buyer appeal, with changes that could help.',
  });
  return <StaleProspectWizard ads="owner" channel={channel} />;
};

export const AdsAgentLanding = ({ channel = 'meta' }: { channel?: AdsChannel }) => {
  usePageMeta({
    title: 'Slow-Moving Instruction? | Listing Assessment for Estate Agents | Havlo',
    description:
      'Paste the Rightmove or Zoopla link for a listing that’s taking longer than expected and see what’s worth reviewing before your next vendor conversation.',
  });
  return <StaleProspectWizard ads="agent" channel={channel} />;
};

// The Meta pages share one route, /assess/:page, so the "Your full assessment
// is ready" page has one address for owners and agents alike
// (/assess/complete) and the page keeps its place when it moves there after a
// promo-code unlock. /assess/seller and /assess/agent are the landing pages;
// /assess/complete is where payment ends, and is worked out from the
// property whose token is in the address.
// The /rm/ pages (rm/seller, rm/agent, rm/complete) are the same funnel with
// their own channel, so their leads are tagged rm_... and emails link back to /rm/.
// They also have /rm/report: the full report opened later (from the
// dashboard or an email), which /stale-listings/prospect/report is for
// everyone else. The rest of their journey is /rm/next-steps and
// /rm/dashboard/<token> (App.tsx).
export const MetaAdsFunnel = () => <AdsFunnel channel="meta" base="/assess" />;
export const RmAdsFunnel = () => <AdsFunnel channel="rm" base="/rm" />;

const AdsFunnel = ({ channel, base }: { channel: AdsChannel; base: string }) => {
  const { page } = useParams();
  const [params] = useSearchParams();
  const [audience, setAudience] = useState<AdsAudience | null>(
    page === 'agent' ? 'agent' : page === 'seller' ? 'owner' : null,
  );
  // Pages for a property already found, whose audience comes from its token.
  const forProperty = page === 'complete' || (channel === 'rm' && page === 'report');
  const known = page === 'seller' || page === 'agent' || forProperty;

  useEffect(() => {
    if (audience || !forProperty) return undefined;
    let cancelled = false;
    const token = params.get('token') || undefined;
    const code = params.get('code') || undefined;
    (token || code ? getProspectPreview({ token, code }) : Promise.reject(new Error('no property')))
      .then((p) => { if (!cancelled) setAudience(p.audience === 'agent' ? 'agent' : 'owner'); })
      .catch(() => { if (!cancelled) setAudience('owner'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!known) return <Navigate to={`${base}/seller`} replace />;
  if (!audience) {
    return (
      <div className="slw-page">
        <Header />
        <div className="slw-shell">
          <main className="slw-main">
            <section className="slw-finding"><Spinner /><p>Loading…</p></section>
          </main>
        </div>
        <Footer />
        <WizardStyles />
      </div>
    );
  }
  return audience === 'agent' ? <AdsAgentLanding channel={channel} /> : <AdsSellerLanding channel={channel} />;
};

// The Meta2 campaign page, /offer/seller: the /sell page (the Stale Listings
// landing page with its link box starting the funnel) at a limited-time £59
// instead of £99, leads tagged meta2_seller ("Meta2" in the console). Sellers
// only. Its whole journey stays under /offer/: /offer/complete after payment
// and /offer/report (both here, opened from the property's token), plus
// /offer/next-steps and /offer/dashboard/<token> (App.tsx;
// app/services/funnel_paths.py), with its own Tag Manager container and no
// Meta Pixel (index.html).
export const OfferFunnel = () => {
  const { page } = useParams();
  usePageMeta({
    title: 'Why Hasn’t My Property Sold? | Free Listing Assessment | Havlo',
    description:
      'Paste your Rightmove or Zoopla link and see what could be holding back your property’s sale, with recommendations you can use alongside your current estate agent.',
    canonical: 'https://www.heyhavlo.com/offer/seller',
  });
  if (page !== 'seller' && page !== 'complete' && page !== 'report') return <Navigate to="/offer/seller" replace />;
  // The Meta ads page's design ("Has Your Property Been on the Market Too
  // Long?", Nov 2026), with the offer page's own traits: the £59 price, the
  // recently-assessed strip, Meta2 tags and its own Tag Manager container
  // (StaleProspectWizard's `expert`, channel "meta2").
  return <StaleProspectWizard ads="owner" channel="meta2" />;
};

export const GoogleAdsSellerLanding = () => <AdsSellerLanding channel="google" />;
export const GoogleAdsAgentLanding = () => <AdsAgentLanding channel="google" />;

// The analyst-review funnel (ReviewFunnel.tsx): the same listing-link
// landing page, then an analyst-reviewed report within 48 hours of payment.
export const ReviewSellerLanding = () => {
  usePageMeta({
    title: 'Why Hasn’t My Property Sold? | Analyst-Reviewed Property Report | Havlo',
    description:
      'Paste your Rightmove or Zoopla link for a free first scan. A Havlo property analyst then checks every point and sends you a clear report within 48 hours.',
  });
  return <StaleProspectWizard ads="owner" channel="review" />;
};

export const ReviewAgentLanding = () => {
  usePageMeta({
    title: 'Slow-Moving Instruction? | Analyst-Reviewed Listing Report | Havlo',
    description:
      'Paste the Rightmove or Zoopla link for a free first scan. A Havlo property analyst then reviews the listing and sends you a report for your vendor within 48 hours.',
  });
  return <StaleProspectWizard ads="agent" channel="review" />;
};

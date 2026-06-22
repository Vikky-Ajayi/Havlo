import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StaleListingsLogo } from '../components/shared/StaleListingsLogo';
import { usePageMeta } from '../hooks/usePageMeta';

const isLikelyUrl = (value: string) => {
  const trimmed = value.trim();
  return /^(https?:\/\/)/i.test(trimmed) || /^(www\.)/i.test(trimmed) || /\.[a-z]{2,}(\/|$)/i.test(trimmed);
};

const quietCards = [
  ['Viewings slow down.', 'Buyer interest begins to fade, reducing opportunities to sell.'],
  ['Vendor confidence drops.', 'Sellers lose confidence in the process and question the current strategy.'],
  ['Price reductions stop working.', 'Lowering the price no longer generates the interest it once did.'],
  ['Competitors begin approaching your client.', 'Other agents see an opportunity to win over your client.'],
];

const steps = [
  ['1', 'Submit a Listing', 'Share a Rightmove, Zoopla or OnTheMarket link. Or upload your listing document directly.'],
  ['2', 'We Analyse 300+ Signals', 'Including Pricing, photography, description, competition, buyer appeal, positioning, and presentation, all benchmarked against current local market conditions.'],
  ['3', 'Receive Your Recovery Report', "A structured report showing what's holding the listing back, where buyer interest breaks down, and the highest-priority actions to take."],
];

const analysisCards = [
  ['Pricing intelligence', 'How the property is positioned against actively competing stock in the local market.'],
  ['Photography intelligence', 'Whether images are supporting or undermining buyer engagement at first glance.'],
  ['Description intelligence', 'How effectively the listing copy communicates value and differentiates the property.'],
  ['Positioning intelligence', 'Whether the property is being presented to the right buyer audience.'],
  ['Competition intelligence', 'How the listing compares against alternatives available to buyers right now.'],
  ['Marketing & Reach intelligence', 'Whether the listing is being promoted through the right channels and matching motivated buyers beyond the local market.'],
];

const quietIconPaths = [
  '/stale-agent-icons/quiet-viewings.png',
  '/stale-agent-icons/quiet-vendor.png',
  '/stale-agent-icons/quiet-price.png',
  '/stale-agent-icons/quiet-competitors.png',
];

const analysisIconPaths = [
  '/stale-agent-icons/analysis-pricing.png',
  '/stale-agent-icons/analysis-photography.png',
  '/stale-agent-icons/analysis-description.png',
  '/stale-agent-icons/analysis-positioning.png',
  '/stale-agent-icons/analysis-competition.png',
  '/stale-agent-icons/analysis-marketing.png',
];

const faqItems = [
  ['1. What is Havlo?', 'Havlo provides independent Listing Recovery Intelligence to help estate agents identify why listings have stalled and what actions are most likely to restore momentum.'],
  ['2. Which properties should I submit?', 'Properties that are:\n• 90+ days on market\n• Receiving low enquiry levels\n• At risk of withdrawal\n• Experiencing vendor frustration\n• Struggling despite price reductions'],
  ['3. Will you contact my vendor?', 'No. We work exclusively through the appointed estate agent.\nYour client relationship remains entirely yours.'],
  ['4. What does the assessment include?', 'Every assessment includes:\n• Pricing review\n• Photography review\n• Listing description review\n• Competition benchmarking\n• Buyer appeal analysis\n• Recovery recommendations'],
  ['5. How quickly will I receive the report?', 'Most reports are delivered within 24-72 hours.\nPriority turnaround is available for urgent instructions.'],
  ['6. Do you replace estate agents?', 'No. Havlo supports estate agents by providing independent listing intelligence and recovery recommendations.\nYou remain the appointed agent throughout.'],
  ['7. Can I submit multiple listings?', 'Yes. Many agencies use Havlo across several stale listings.\nAgency packages are available for regular users.'],
  ['8. How can Havlo help me retain instructions?', 'Our reports provide evidence-based recommendations that help support vendor conversations, improve confidence, and create a clear recovery plan for underperforming listings.'],
];

function TrustStars() {
  return (
    <span className="sla-stars" aria-label="Five star rating">
      {[0, 1, 2, 3, 4].map((star) => (
        <span key={star}>{'\u2605'}</span>
      ))}
    </span>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="sla-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function LineIcon({ index }: { index: number }) {
  return (
    <img className="sla-line-icon" src={quietIconPaths[index % quietIconPaths.length]} alt="" aria-hidden="true" />
  );
}

function SmallIcon({ index }: { index: number }) {
  return (
    <img className="sla-small-icon" src={analysisIconPaths[index % analysisIconPaths.length]} alt="" aria-hidden="true" />
  );
}

function ReportMockup() {
  const rows = [
    ['PRICING', 62],
    ['PHOTOGRAPHY', 47],
    ['DESCRIPTION', 52],
    ['COMPETITION', 51],
  ];

  return (
    <div className="sla-report-card" aria-label="Example recovery report">
      <div className="sla-report-score">
        <strong>42</strong><span>/100</span>
        <p>Overall Listing Score</p>
        <small>For agencies with multiple stale listings each month.</small>
      </div>
      <div className="sla-report-bars">
        {rows.map(([label, score]) => (
          <div key={label as string} className="sla-report-row">
            <span>{label}</span>
            <div><i style={{ width: `${score}%` }} /></div>
            <b>{score}/100</b>
          </div>
        ))}
      </div>
      <div className="sla-report-findings">
        <h4>KEY FINDINGS</h4>
        <ul>
          <li>Hero image is underperforming, not reflecting the property&apos;s strongest features.</li>
          <li>Description lacks differentiation from comparable listings in the area.</li>
          <li>Competing stock is positioned more effectively at a similar price point.</li>
          <li>Current pricing is creating buyer hesitation rather than urgency.</li>
        </ul>
      </div>
    </div>
  );
}

function PlanCard({
  title,
  price,
  subtitle,
  features,
  button,
  onClick,
}: {
  title: string;
  price: string;
  subtitle: string;
  features: string[];
  button: string;
  onClick: () => void;
}) {
  return (
    <article className="sla-plan-card">
      <div>
        <h3>{price}</h3>
        <strong>{title}</strong>
        <p>{subtitle}</p>
      </div>
      <ul>
        {features.map((feature) => <li key={feature}>{feature}</li>)}
      </ul>
      <button type="button" onClick={onClick}>{button}</button>
    </article>
  );
}

export function StaleListingsAgents() {
  usePageMeta({
    title: 'Listing Recovery for Estate Agents | Stale Listings by Havlo',
    description: 'Independent listing recovery intelligence for estate agents with stalled, low-enquiry or at-risk instructions.',
    canonical: 'https://www.heyhavlo.com/stale-listings/agents',
  });

  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [faqExpanded, setFaqExpanded] = useState(false);
  const [listingInput, setListingInput] = useState('');
  const [error, setError] = useState('');

  const startListing = (event?: FormEvent) => {
    event?.preventDefault();
    const value = listingInput.trim();
    if (!value) {
      setError('Enter a property address or listing URL.');
      return;
    }

    const params = new URLSearchParams();
    if (isLikelyUrl(value)) {
      params.set('url', value);
      sessionStorage.setItem('sl_listing_url', value);
      sessionStorage.removeItem('sl_address');
    } else {
      params.set('address', value);
      sessionStorage.setItem('sl_address', value);
      sessionStorage.removeItem('sl_listing_url');
    }
    sessionStorage.setItem('sl_agent_flow', 'true');
    navigate(`/stale-listings/questions?${params.toString()}`);
  };

  const startBlank = () => {
    sessionStorage.setItem('sl_agent_flow', 'true');
    navigate('/stale-listings/questions');
  };

  const visibleFaqs = faqExpanded ? faqItems : faqItems.slice(0, 5);

  return (
    <div className="sla-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Inter+Tight:wght@500;600;700&family=Libre+Franklin:wght@500&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');

        @font-face {
          font-family: 'Right Grotesk Compact Black';
          src: url('/fonts/RightGrotesk-CompactBlack.woff2') format('woff2');
          font-weight: 900;
          font-style: normal;
          font-display: swap;
        }

        .sla-page {
          --sla-black: #1f1f1e;
          --sla-purple: #a409d2;
          --sla-muted: #333e48;
          width: 100%;
          min-height: 100vh;
          overflow-x: hidden;
          background: #fff;
          color: var(--sla-black);
          font-family: Inter, Arial, sans-serif;
        }

        .sla-page *,
        .sla-page *::before,
        .sla-page *::after {
          box-sizing: border-box;
          min-width: 0;
        }

        .sla-shell {
          width: min(100% - 48px, 1240px);
          margin: 0 auto;
        }

        .sla-page h1,
        .sla-page h2,
        .sla-page h3 {
          font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif;
          color: var(--sla-black);
        }

        .sla-header {
          position: sticky;
          top: 0;
          z-index: 20;
          background: rgba(255,255,255,0.96);
          border-bottom: 1px solid rgba(0,0,0,0.06);
          backdrop-filter: blur(14px);
        }

        .sla-header-inner {
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sla-logo {
          width: 215px;
          height: auto;
          display: block;
        }

        .sla-nav {
          display: flex;
          gap: 40px;
          align-items: center;
          font-size: 16px;
          font-weight: 600;
          line-height: 1.5;
          letter-spacing: -0.32px;
        }

        .sla-nav a,
        .sla-mobile-menu a,
        .sla-footer a {
          color: inherit;
          text-decoration: none;
        }

        .sla-menu-button {
          display: none;
          width: 42px;
          height: 42px;
          border: 0;
          background: transparent;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 5px;
          cursor: pointer;
        }

        .sla-menu-button span,
        .sla-menu-button::before,
        .sla-menu-button::after {
          content: '';
          width: 25px;
          height: 2px;
          border-radius: 99px;
          background: #111;
        }

        .sla-mobile-menu {
          display: none;
          padding: 0 24px 22px;
          flex-direction: column;
          gap: 16px;
          font-size: 18px;
          font-weight: 800;
        }

        .sla-hero {
          position: relative;
          overflow: hidden;
          background: #fff;
        }

        .sla-hero::before {
          content: '';
          position: absolute;
          width: 895px;
          height: 736px;
          left: calc(50% - 720px);
          top: -205px;
          border-radius: 999px;
          background: #ffb0e6;
          filter: blur(213px);
        }

        .sla-hero-inner {
          position: relative;
          z-index: 1;
          min-height: 806px;
          display: grid;
          grid-template-columns: 657px 582px;
          justify-content: space-between;
          align-items: start;
          padding-top: 92px;
          padding-bottom: 60px;
        }

        .sla-hero-copy h1 {
          width: 657px;
          max-width: 100%;
          margin: 0 0 28px;
          font-size: 56px;
          font-weight: 800;
          line-height: 1.2;
          letter-spacing: -1.68px;
        }

        .sla-purple {
          color: var(--sla-purple);
        }

        .sla-hero-copy p {
          max-width: 657px;
          margin: 0 0 28px;
          color: #000;
          font-size: 16px;
          font-weight: 400;
          line-height: 1.5;
          letter-spacing: -0.32px;
        }

        .sla-submit-form {
          width: 570px;
          height: 56px;
          margin: 48px 0 24px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
          padding: 4px 4px 4px 16px;
          border-radius: 12px;
          border-bottom: 1px solid rgba(0,0,0,0.05);
          background: #eef0f2;
        }

        .sla-input-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 48px;
          color: #666;
        }

        .sla-input-wrap svg {
          width: 22px;
          height: 22px;
          flex: 0 0 auto;
        }

        .sla-input-wrap input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #111;
          font-family: 'Libre Franklin', Inter, Arial, sans-serif;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: -0.42px;
        }

        .sla-input-wrap input::placeholder {
          color: #666;
          opacity: 1;
        }

        .sla-submit-form button,
        .sla-plan-card button,
        .sla-faq-toggle {
          border: 0;
          background: #000;
          color: #fff;
          cursor: pointer;
        }

        .sla-submit-form button {
          min-width: 166px;
          height: 48px;
          padding: 0 20px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          line-height: 1.5;
          letter-spacing: -0.32px;
        }

        .sla-form-error {
          margin: -12px 0 18px;
          color: #a00000;
          font-size: 13px;
          font-weight: 700;
        }

        .sla-trust-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          color: #040504;
        }

        .sla-trust-row strong {
          font-size: 20px;
          font-weight: 500;
          line-height: 1.1;
          letter-spacing: -0.4px;
        }

        .sla-trust-row > span:last-child {
          color: #000;
          font-size: 16px;
          font-weight: 700;
          line-height: 1.5;
          letter-spacing: -0.32px;
        }

        .sla-stars {
          display: inline-flex;
          gap: 2.5px;
        }

        .sla-stars span {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          background: #00b67a;
          color: #fff;
          font-size: 21px;
          line-height: 1;
        }

        .sla-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 23px;
          max-width: 650px;
          margin-top: 48px;
        }

        .sla-metric strong {
          display: block;
          font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif;
          font-size: 20px;
          font-weight: 600;
          line-height: 1.2;
          letter-spacing: -0.6px;
        }

        .sla-metric span {
          display: block;
          margin-top: 20px;
          color: #000;
          font-size: 14px;
          font-weight: 400;
          line-height: 1.5;
          letter-spacing: -0.28px;
        }

        .sla-hero-visual {
          width: 582px;
          height: 568px;
          display: flex;
          align-items: flex-start;
          justify-content: center;
        }

        .sla-hero-visual img {
          width: 582px;
          height: auto;
          object-fit: contain;
          display: block;
        }

        .sla-section {
          padding: 80px 0;
          background: #fff;
        }

        .sla-section h2 {
          width: 650px;
          max-width: 100%;
          margin: 0 0 78px;
          font-size: 48px;
          font-weight: 600;
          line-height: 1.2;
          letter-spacing: -1.44px;
        }

        .sla-quiet-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 32px;
          margin-bottom: 78px;
        }

        .sla-line-icon {
          width: 40px;
          height: 40px;
          object-fit: contain;
          display: block;
        }

        .sla-quiet-card h3 {
          margin: 50px 0 24px;
          font-size: 24px;
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: -0.72px;
        }

        .sla-quiet-card p,
        .sla-section-intro {
          margin: 0;
          font-size: 20px;
          font-weight: 400;
          line-height: 1.5;
          letter-spacing: -0.6px;
        }

        .sla-section-intro {
          color: var(--sla-muted);
          font-weight: 500;
        }

        .sla-steps {
          padding-top: 40px;
        }

        .sla-steps .sla-section h2,
        .sla-steps h2 {
          margin-bottom: 32px;
        }

        .sla-steps-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 32px;
        }

        .sla-step-card {
          min-height: 355px;
          padding: 32px;
          border: 1px solid rgba(0,0,0,0.05);
          border-radius: 24px;
          background: #eff0f2;
          overflow: hidden;
        }

        .sla-step-card span {
          display: block;
          margin-bottom: 72px;
          color: var(--sla-purple);
          font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif;
          font-size: 40px;
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: -1.2px;
        }

        .sla-step-card h3 {
          margin: 0 0 32px;
          font-size: 24px;
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: -0.72px;
        }

        .sla-step-card p {
          margin: 0;
          color: #000;
          font-size: 20px;
          font-weight: 400;
          line-height: 1.5;
          letter-spacing: -0.6px;
        }

        .sla-dark {
          background: #060808;
          color: #fff;
        }

        .sla-dark .sla-shell {
          padding-top: 80px;
          padding-bottom: 80px;
        }

        .sla-dark h2 {
          width: auto;
          margin: 0 0 32px;
          color: #fff;
          font-family: Inter, Arial, sans-serif;
          font-size: 40px;
          font-weight: 600;
          line-height: 1;
          letter-spacing: -3.2px;
        }

        .sla-dark-sub {
          width: 574px;
          max-width: 100%;
          margin: 0 0 56px;
          color: #9b9fa4;
          font-size: 16px;
          font-weight: 500;
          letter-spacing: -0.48px;
        }

        .sla-analysis-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 24px;
        }

        .sla-analysis-card {
          min-height: 182px;
          padding: 20px;
          border: 1px solid #2b2e32;
          border-radius: 16px;
          background: #101518;
          overflow: hidden;
        }

        .sla-small-icon {
          width: 32px;
          height: 32px;
          margin-bottom: 50px;
          object-fit: contain;
          display: block;
        }

        .sla-analysis-card h3 {
          margin: 0 0 16px;
          color: #fff;
          font-family: Inter, Arial, sans-serif;
          font-size: 18px;
          font-weight: 600;
          line-height: 1;
          letter-spacing: -0.72px;
        }

        .sla-analysis-card p {
          margin: 0;
          color: #9b9fa4;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.25;
          letter-spacing: -0.42px;
        }

        .sla-recovery {
          display: grid;
          grid-template-columns: 457px 1fr;
          gap: 86px;
          align-items: flex-start;
        }

        .sla-recovery h2 {
          width: 403px;
          margin-bottom: 24px;
          font-size: 40px;
          font-weight: 700;
          letter-spacing: -1.2px;
        }

        .sla-agent-only {
          margin-bottom: 24px;
          color: #005128;
          font-size: 20px;
          font-weight: 700;
          line-height: 1.8;
          letter-spacing: -0.6px;
        }

        .sla-recovery ul,
        .sla-plan-card ul {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .sla-recovery li {
          position: relative;
          margin: 0;
          padding-left: 18px;
          color: #000;
          font-size: 20px;
          font-weight: 400;
          line-height: 1.8;
          letter-spacing: -0.6px;
        }

        .sla-recovery li::before,
        .sla-plan-card li::before {
          content: '•';
          position: absolute;
          left: 0;
          color: #149d4f;
          font-weight: 900;
        }

        .sla-report-visual-wrap {
          display: contents;
        }

        .sla-report-desktop-img {
          width: 686px;
          max-width: 100%;
          height: auto;
          display: block;
          border-radius: 12px;
        }

        .sla-report-mobile-img {
          display: none;
        }

        .sla-report-card {
          width: 686px;
          max-width: 100%;
          padding: 24px 32px;
          border-radius: 12px;
          background: #fff3e6;
        }

        .sla-report-score strong {
          color: #d96a00;
          font-size: 40px;
          font-weight: 800;
          line-height: 1;
        }

        .sla-report-score span {
          font-size: 16px;
          font-weight: 800;
        }

        .sla-report-score p {
          margin: 7px 0 2px;
          font-size: 14px;
          font-weight: 800;
        }

        .sla-report-score small {
          display: block;
          color: #4b4b4b;
          font-size: 12px;
        }

        .sla-report-bars {
          margin: 22px 0;
        }

        .sla-report-row {
          display: grid;
          grid-template-columns: 118px minmax(0, 1fr) 50px;
          align-items: center;
          gap: 14px;
          margin: 10px 0;
          font-size: 12px;
          font-weight: 800;
        }

        .sla-report-row div {
          height: 5px;
          border-radius: 999px;
          background: rgba(0,0,0,0.14);
          overflow: hidden;
        }

        .sla-report-row i {
          display: block;
          height: 100%;
          background: #f28a00;
        }

        .sla-report-findings h4 {
          margin: 0 0 14px;
          font-size: 14px;
          font-weight: 900;
        }

        .sla-report-findings ul {
          margin: 0;
          padding-left: 18px;
        }

        .sla-report-findings li {
          margin: 5px 0;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.45;
        }

        .sla-pricing {
          text-align: center;
        }

        .sla-pricing h2 {
          width: auto;
          margin: 0 0 12px;
          font-size: 40px;
          font-weight: 600;
          letter-spacing: -1.2px;
        }

        .sla-pricing > p {
          width: 494px;
          max-width: 100%;
          margin: 0 auto 32px;
          color: #fff;
          font-size: 16px;
          font-weight: 400;
          line-height: 1.5;
          letter-spacing: -0.32px;
        }

        .sla-plan-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 24px;
          text-align: left;
        }

        .sla-plan-card {
          min-height: 555px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 24px;
          border-radius: 32px;
          background: #fff;
          color: #000;
        }

        .sla-plan-card h3 {
          margin: 0;
          font-family: Inter, Arial, sans-serif;
          font-size: 40px;
          font-weight: 700;
          line-height: 1.5;
          letter-spacing: -1.2px;
        }

        .sla-plan-card strong {
          display: block;
          margin-bottom: 20px;
          font-size: 20px;
          font-weight: 600;
          line-height: 1.5;
          letter-spacing: -0.6px;
        }

        .sla-plan-card p {
          margin: 0 0 24px;
          font-size: 16px;
          font-weight: 400;
          line-height: 1.2;
          letter-spacing: -0.48px;
        }

        .sla-plan-card ul {
          padding-top: 16px;
          border-top: 1px solid rgba(0,0,0,0.1);
        }

        .sla-plan-card li {
          position: relative;
          margin: 0 0 16px;
          padding-left: 24px;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.2;
          letter-spacing: -0.42px;
        }

        .sla-plan-card button {
          width: 100%;
          height: 44px;
          margin-top: 32px;
          border-radius: 10px;
          font-family: 'Inter Tight', Inter, Arial, sans-serif;
          font-size: 16px;
          font-weight: 500;
          letter-spacing: -0.32px;
        }

        .sla-case-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 32px;
        }

        .sla-case-card {
          overflow: hidden;
          border: 1px solid rgba(0,0,0,0.05);
          border-radius: 12px;
          background: #fef3eb;
        }

        .sla-case-block {
          padding: 24px;
        }

        .sla-case-block--after {
          background: #f5fffc;
        }

        .sla-case-block h3 {
          margin: 0 0 20px;
          color: #d35506;
          font-size: 20px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: -0.6px;
        }

        .sla-case-block--after h3 {
          color: #005128;
        }

        .sla-case-block h4 {
          margin: 0 0 12px;
          font-size: 20px;
          font-weight: 700;
          line-height: 1.5;
          letter-spacing: -0.6px;
        }

        .sla-case-block ul {
          margin: 0 0 24px;
          padding-left: 18px;
        }

        .sla-case-block li,
        .sla-case-block p {
          margin: 5px 0;
          font-size: 18px;
          line-height: 1.5;
          letter-spacing: -0.54px;
        }

        .sla-faq {
          max-width: 1068px;
        }

        .sla-faq h2 {
          width: auto;
          margin-bottom: 42px;
          font-family: 'Right Grotesk Compact Black', 'Plus Jakarta Sans', Inter, Arial, sans-serif;
          font-size: 40px;
          line-height: 1.1;
          letter-spacing: -0.02em;
        }

        .sla-faq-item {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 30px;
          gap: 24px;
          padding: 24px 0;
          border-bottom: 1px solid rgba(0,0,0,0.1);
        }

        .sla-faq-item h3 {
          margin: 0 0 12px;
          font-size: 20px;
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: -0.6px;
        }

        .sla-faq-item p {
          margin: 0;
          white-space: pre-line;
          font-size: 18px;
          font-weight: 400;
          line-height: 1.5;
          letter-spacing: -0.54px;
        }

        .sla-faq-plus {
          font-size: 24px;
          line-height: 1;
          text-align: right;
        }

        .sla-faq-toggle {
          display: block;
          min-width: 112px;
          height: 44px;
          margin: 24px auto 0;
          padding: 8px 32px;
          border-radius: 0;
          font-family: 'Inter Tight', Inter, Arial, sans-serif;
          font-size: 16px;
          font-weight: 500;
        }

        .sla-footer {
          border-top: 1px solid rgba(0,0,0,0.08);
          padding: 28px 0;
          background: #fff;
        }

        .sla-footer-inner {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 24px;
          font-size: 11px;
          font-weight: 700;
        }

        .sla-footer-logo {
          width: 128px;
        }

        .sla-footer-links {
          justify-self: end;
          display: flex;
          gap: 38px;
        }

        @media (max-width: 1320px) {
          .sla-shell {
            width: min(100% - 64px, 1240px);
          }

          .sla-hero-inner {
            grid-template-columns: minmax(0, 1fr) 44vw;
            gap: 48px;
          }

          .sla-hero-visual {
            width: 44vw;
            height: auto;
          }

          .sla-hero-visual img {
            width: 100%;
            height: auto;
          }
        }

        @media (max-width: 980px) {
          .sla-hero-inner,
          .sla-recovery {
            grid-template-columns: 1fr;
          }

          .sla-hero-visual {
            width: min(100%, 582px);
            height: auto;
            aspect-ratio: auto;
          }

          .sla-hero-visual img {
            width: 100%;
            height: auto;
          }

          .sla-quiet-grid,
          .sla-analysis-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sla-plan-grid,
          .sla-case-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .sla-shell {
            width: min(100% - 32px, 1240px);
          }

          .sla-header-inner {
            height: 60px;
          }

          .sla-logo {
            width: 120px;
          }

          .sla-nav {
            display: none;
          }

          .sla-menu-button {
            display: flex;
            width: 36px;
            height: 36px;
          }

          .sla-menu-button span,
          .sla-menu-button::before,
          .sla-menu-button::after {
            width: 22px;
            height: 2px;
          }

          .sla-mobile-menu.is-open {
            display: flex;
          }

          .sla-hero::before {
            width: 360px;
            height: 420px;
            left: -115px;
            top: -72px;
            filter: blur(78px);
          }

          .sla-hero-inner {
            min-height: 0;
            padding-top: 32px;
            padding-bottom: 32px;
            gap: 28px;
          }

          .sla-hero-copy h1 {
            width: 100%;
            margin-bottom: 16px;
            font-size: 36px;
            line-height: 1.1;
            letter-spacing: -1.08px;
          }

          .sla-hero-copy p {
            margin-bottom: 12px;
            font-size: 16px;
            line-height: 1.5;
            letter-spacing: -0.48px;
          }

          .sla-submit-form {
            width: 100%;
            height: 52px;
            margin: 20px 0 16px;
            padding: 4px 4px 4px 12px;
            border-radius: 8px;
            grid-template-columns: minmax(0, 1fr) auto;
          }

          .sla-input-wrap {
            height: 44px;
            gap: 8px;
          }

          .sla-input-wrap svg {
            width: 18px;
            height: 18px;
          }

          .sla-input-wrap input {
            font-size: 14px;
            letter-spacing: -0.42px;
          }

          .sla-submit-form button {
            min-width: 130px;
            height: 44px;
            padding: 0 14px;
            border-radius: 8px;
            font-size: 14px;
            letter-spacing: -0.28px;
          }

          .sla-trust-row {
            gap: 8px;
          }

          .sla-trust-row strong {
            font-size: 16px;
          }

          .sla-trust-row > span:last-child {
            font-size: 14px;
            letter-spacing: -0.28px;
          }

          .sla-stars span {
            width: 24px;
            height: 24px;
            font-size: 17px;
          }

          .sla-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            margin-top: 28px;
          }

          .sla-metric strong {
            font-size: 16px;
            letter-spacing: -0.48px;
          }

          .sla-metric span {
            margin-top: 8px;
            font-size: 13px;
            line-height: 1.45;
            letter-spacing: -0.26px;
          }

          .sla-hero-visual {
            width: 100%;
            height: auto;
          }

          .sla-hero-visual img {
            width: 100%;
            height: auto;
          }

          .sla-section {
            padding: 48px 0;
          }

          .sla-section h2 {
            width: 100%;
            margin-bottom: 32px;
            font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif;
            font-size: 40px;
            font-weight: 600;
            line-height: 1.2;
            letter-spacing: -0.03em;
          }

          .sla-quiet-grid,
          .sla-steps-grid,
          .sla-analysis-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }

          .sla-quiet-grid {
            margin-bottom: 32px;
          }

          .sla-line-icon {
            width: 32px;
            height: 32px;
          }

          .sla-quiet-card h3 {
            margin: 24px 0 12px;
            font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif;
            font-size: 24px;
            font-weight: 700;
            line-height: 1.2;
            letter-spacing: -0.03em;
          }

          .sla-quiet-card p,
          .sla-section-intro {
            font-family: Inter, Arial, sans-serif;
            font-size: 20px;
            font-weight: 400;
            line-height: 1.5;
            letter-spacing: -0.03em;
          }

          .sla-steps {
            padding-top: 0;
          }

          .sla-step-card {
            min-height: 0;
            padding: 28px;
            border-radius: 16px;
          }

          .sla-step-card span {
            margin-bottom: 48px;
            font-size: 32px;
            letter-spacing: -0.96px;
          }

          .sla-step-card h3 {
            margin-bottom: 16px;
            font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif;
            font-size: 24px;
            font-weight: 700;
            line-height: 1.2;
            letter-spacing: -0.03em;
          }

          .sla-step-card p {
            font-family: Inter, Arial, sans-serif;
            font-size: 20px;
            font-weight: 400;
            line-height: 1.5;
            letter-spacing: -0.03em;
          }

          .sla-dark .sla-shell {
            padding-top: 48px;
            padding-bottom: 48px;
          }

          .sla-dark h2 {
            margin-bottom: 16px;
            font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif;
            font-size: 40px;
            font-weight: 600;
            line-height: 1.2;
            letter-spacing: -0.03em;
          }

          .sla-dark-sub {
            margin-bottom: 32px;
            font-family: Inter, Arial, sans-serif;
            font-size: 20px;
            font-weight: 400;
            letter-spacing: -0.03em;
          }

          .sla-analysis-card {
            min-height: 0;
            padding: 24px;
            border-radius: 16px;
          }

          .sla-small-icon {
            width: 28px;
            height: 28px;
            margin-bottom: 32px;
          }

          .sla-analysis-card h3 {
            margin-bottom: 12px;
            font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif;
            font-size: 24px;
            font-weight: 700;
            line-height: 1.2;
            letter-spacing: -0.03em;
          }

          .sla-analysis-card p {
            font-family: Inter, Arial, sans-serif;
            font-size: 20px;
            font-weight: 400;
            line-height: 1.5;
            letter-spacing: -0.03em;
          }

          .sla-recovery {
            gap: 32px;
          }

          .sla-recovery h2 {
            width: 100%;
            margin-bottom: 16px;
            font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif;
            font-size: 40px;
            font-weight: 600;
            line-height: 1.2;
            letter-spacing: -0.03em;
          }

          .sla-agent-only {
            margin-bottom: 16px;
            font-size: 18px;
          }

          .sla-recovery li {
            font-family: Inter, Arial, sans-serif;
            font-size: 20px;
            line-height: 1.6;
            letter-spacing: -0.03em;
          }

          .sla-report-visual-wrap {
            display: block;
            width: 100%;
          }

          .sla-report-desktop-img {
            display: none;
          }

          .sla-report-mobile-img {
            display: block;
            width: 100%;
            height: auto;
            border-radius: 16px;
          }

          .sla-pricing h2 {
            font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif;
            font-size: 40px;
            font-weight: 600;
            line-height: 1.2;
            letter-spacing: -0.03em;
          }

          .sla-pricing > p {
            font-family: Inter, Arial, sans-serif;
            font-size: 20px;
            font-weight: 400;
            line-height: 1.5;
            letter-spacing: -0.03em;
          }

          .sla-plan-card {
            min-height: 0;
            padding: 28px;
            border-radius: 20px;
          }

          .sla-plan-card h3 {
            font-size: 40px;
          }

          .sla-plan-card strong {
            font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif;
            font-size: 24px;
            font-weight: 700;
            line-height: 1.2;
            letter-spacing: -0.03em;
          }

          .sla-plan-card p,
          .sla-plan-card li {
            font-family: Inter, Arial, sans-serif;
            font-size: 20px;
            font-weight: 400;
            line-height: 1.5;
            letter-spacing: -0.03em;
          }

          .sla-case-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .sla-case-block {
            padding: 24px;
          }

          .sla-case-block h3 {
            font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif;
            font-size: 24px;
            font-weight: 700;
            line-height: 1.2;
            letter-spacing: -0.03em;
          }

          .sla-case-block h4 {
            font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif;
            font-size: 20px;
            font-weight: 600;
            line-height: 1.2;
            letter-spacing: -0.03em;
          }

          .sla-case-block li,
          .sla-case-block p {
            font-family: Inter, Arial, sans-serif;
            font-size: 20px;
            font-weight: 400;
            line-height: 1.5;
            letter-spacing: -0.03em;
          }

          .sla-faq h2 {
            font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif;
            font-size: 40px;
            font-weight: 600;
            line-height: 1.2;
            letter-spacing: -0.03em;
            margin-bottom: 24px;
          }

          .sla-faq-item {
            padding: 20px 0;
          }

          .sla-faq-item h3 {
            font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif;
            font-size: 24px;
            font-weight: 700;
            line-height: 1.2;
            letter-spacing: -0.03em;
          }

          .sla-faq-item p {
            font-family: Inter, Arial, sans-serif;
            font-size: 20px;
            font-weight: 400;
            line-height: 1.5;
            letter-spacing: -0.03em;
          }

          .sla-faq-toggle {
            min-width: 120px;
            height: 44px;
            font-size: 16px;
          }

          .sla-footer-inner {
            grid-template-columns: 1fr;
            justify-items: center;
            text-align: center;
          }

          .sla-footer-logo {
            width: 128px;
          }

          .sla-footer-links {
            justify-self: center;
            gap: 24px;
          }
        }
      `}</style>

      <header className="sla-header">
        <div className="sla-shell sla-header-inner">
          <a href="/stale-listings/agents" aria-label="Stale Listings agents home">
            <StaleListingsLogo className="sla-logo" />
          </a>
          <nav className="sla-nav" aria-label="Stale Listings agents navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#faq">Faq</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <button
            type="button"
            className="sla-menu-button"
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
          </button>
        </div>
        <nav className={`sla-mobile-menu${menuOpen ? ' is-open' : ''}`} aria-label="Mobile navigation">
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>Faq</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
        </nav>
      </header>

      <main>
        <section className="sla-hero">
          <div className="sla-shell sla-hero-inner">
            <div className="sla-hero-copy">
              <h1>Protect <span className="sla-purple">Stale Listings</span><br />Before You Lose The<br />Vendor</h1>
              <p>When a property stops generating enquiries, the risk isn&apos;t just a delayed sale. It&apos;s a withdrawn instruction, a frustrated vendor, and an opportunity for a competitor to step in.</p>
              <p>Havlo provides independent Listing Recovery Intelligence to help estate agents identify why a property has stalled and what actions are most likely to restore momentum.</p>

              <form className="sla-submit-form" onSubmit={startListing}>
                <label className="sla-input-wrap" aria-label="Property address or listing URL">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  </svg>
                  <input
                    value={listingInput}
                    onChange={(event) => {
                      setListingInput(event.target.value);
                      setError('');
                    }}
                    placeholder="Enter property address or listing url"
                  />
                </label>
                <button type="submit">Submit A Listing</button>
              </form>
              {error && <p className="sla-form-error">{error}</p>}

              <div className="sla-trust-row">
                <strong>Excellent</strong>
                <TrustStars />
                <span>Based on verified customer feedback</span>
              </div>
              <div className="sla-metrics">
                <Metric value="10K+" label="Listings Analysed" />
                <Metric value="91K+" label="Recommendations Generated" />
                <Metric value="100%" label="Agent Control" />
                <Metric value="Independent" label="Assessment Team" />
              </div>
            </div>
            <div className="sla-hero-visual" aria-hidden="true">
              <img src="/stale-hero-house.png" alt="" />
            </div>
          </div>
        </section>

        <section className="sla-section">
          <div className="sla-shell">
            <h2>Every agency has listings that go quiet.</h2>
            <div className="sla-quiet-grid">
              {quietCards.map(([title, copy], index) => (
                <article className="sla-quiet-card" key={title}>
                  <LineIcon index={index} />
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
            <p className="sla-section-intro">The longer a listing remains on the market, the harder it becomes to regain momentum. Havlo helps you understand exactly why a property has stalled before the instruction is lost.</p>
          </div>
        </section>

        <section className="sla-section sla-steps" id="how-it-works">
          <div className="sla-shell">
            <h2>How It Works</h2>
            <div className="sla-steps-grid">
              {steps.map(([number, title, copy]) => (
                <article className="sla-step-card" key={title}>
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sla-dark">
          <div className="sla-shell">
            <h2>What we Analyse</h2>
            <p className="sla-dark-sub">Five intelligence categories. One clear recovery plan.</p>
            <div className="sla-analysis-grid">
              {analysisCards.map(([title, copy], index) => (
                <article className="sla-analysis-card" key={title}>
                  <SmallIcon index={index} />
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sla-section">
          <div className="sla-shell sla-recovery">
            <div>
              <h2>What your Recovery Report looks like.</h2>
              <div className="sla-agent-only">For Estate Agents Only</div>
              <ul>
                <li>We never contact your vendor.</li>
                <li>We never market competing agency services.</li>
                <li>We never interfere with your client relationship.</li>
                <li>You remain the appointed agent throughout.</li>
                <li>Our role is to provide independent listing intelligence.</li>
              </ul>
            </div>
            <div className="sla-report-visual-wrap">
              <img className="sla-report-desktop-img" src="/stale-report-desktop.png" alt="Example recovery report" />
              <img className="sla-report-mobile-img" src="/stale-report-mobile.png" alt="Example recovery report" />
            </div>
          </div>
        </section>

        <section className="sla-dark" id="pricing">
          <div className="sla-shell sla-pricing">
            <h2>Start with a free assessment.</h2>
            <p>No commitment required for your first listing. See exactly what Havlo finds before deciding on a full report.</p>
            <div className="sla-plan-grid">
              <PlanCard
                price="£0"
                title="Free Trial Assessment"
                subtitle="For first-time agencies."
                features={['Listing review', 'Pricing analysis', 'Photography review', 'Market positioning assessment', 'Recovery recommendations']}
                button="Submit Free Listing"
                onClick={startBlank}
              />
              <PlanCard
                price="£149.99"
                title="Listing Recovery Assessment"
                subtitle="For individual stale listings."
                features={['Full Listing Recovery Report', 'Pricing review', 'Photography review', 'Listing copy review', 'Competitive analysis', 'Recovery recommendations', 'Delivered within 5 working day']}
                button="Submit Listing"
                onClick={startBlank}
              />
              <PlanCard
                price="Custom Pricing"
                title="Agency Plans"
                subtitle="For agencies with multiple stale listings each month."
                features={['Multiple monthly assessments', 'Priority turnaround', 'Quarterly portfolio reviews', 'Dedicated support contact']}
                button="Request Agency Pricing"
                onClick={() => navigate('/contact-us')}
              />
            </div>
          </div>
        </section>

        <section className="sla-section">
          <div className="sla-shell">
            <h2>Real listing recoveries.</h2>
            <div className="sla-case-grid">
              <article className="sla-case-card">
                <div className="sla-case-block">
                  <h3>Before</h3>
                  <h4>4 Bed Detached — Manchester</h4>
                  <ul>
                    <li>7 months on market</li>
                    <li>4 viewings total</li>
                    <li>No offers received</li>
                  </ul>
                  <h4>Havlo Findings</h4>
                  <p>Pricing positioned above competing stock</p>
                  <p>Hero image underperforming</p>
                  <p>Listing copy not differentiating</p>
                </div>
                <div className="sla-case-block sla-case-block--after">
                  <h3>After Implementation</h3>
                  <h4>4 Bed Detached — Manchester</h4>
                  <p>New photography</p>
                  <p>Revised pricing strategy</p>
                  <p>Relaunch campaign</p>
                  <p><strong>3 offers received within 28 days.</strong></p>
                </div>
              </article>
              <article className="sla-case-card">
                <div className="sla-case-block">
                  <h3>Before</h3>
                  <h4>3 Bed Semi — Leeds</h4>
                  <ul>
                    <li>5 months on market</li>
                    <li>Vendor considering switching agents</li>
                  </ul>
                </div>
                <div className="sla-case-block sla-case-block--after">
                  <h3>After Implementation</h3>
                  <p>Viewings increased 220%</p>
                  <p>Vendor retained</p>
                  <p>Sold subject to contract within 6 weeks</p>
                  <p><strong>Instruction saved. Vendor retained.</strong></p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="sla-section" id="faq">
          <div className="sla-shell sla-faq">
            <h2>Everthing you need to know</h2>
            {visibleFaqs.map(([question, answer]) => (
              <article className="sla-faq-item" key={question}>
                <div>
                  <h3>{question}</h3>
                  <p>{answer}</p>
                </div>
                <span className="sla-faq-plus">+</span>
              </article>
            ))}
            <button className="sla-faq-toggle" type="button" onClick={() => setFaqExpanded((expanded) => !expanded)}>
              {faqExpanded ? 'See Less' : 'Load more'}
            </button>
          </div>
        </section>
      </main>

      <footer className="sla-footer">
        <div className="sla-shell sla-footer-inner">
          <StaleListingsLogo className="sla-footer-logo" />
          <span>© 2026 StaleListings. All rights reserved.</span>
          <nav className="sla-footer-links" aria-label="Legal links">
            <a href="/privacy-policy">Privacy Policy</a>
            <a href="/terms-of-use">Terms</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

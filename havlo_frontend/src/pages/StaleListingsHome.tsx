import { CSSProperties, Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChartPie, CircleCheck, Eye } from 'lucide-react';
import { StaleListingsLogo } from '../components/shared/StaleListingsLogo';
import { Footer } from '../components/shared/Footer';
import { CountryBadge } from '../components/shared/CountryBadge';
import { useTypewriter } from '../hooks/useTypewriter';

// Typography follows /stale-listings/seller: Plus Jakarta Sans for headings
// and sub-headings, Inter for everything else. Sizes, weights, line breaks
// and spacing follow the Figma frame (1440 wide, 1140 content column).
//
// Copy blocks are written as arrays of the design's lines. On desktop each
// line is its own unbreakable row, so a block wraps exactly as in the design
// whatever the font rendering; below 1200px the rows flow back into normal
// wrapping text.
const Lines = ({ lines }: { lines: string[] }) => (
  <>
    {lines.map((line, i) => (
      <Fragment key={i}>
        <span className="slh-ln">{line}</span>
        {/* A line ending in a hyphen ("in-" / "house") rejoins without a space. */}
        {i < lines.length - 1 && !line.endsWith('-') && ' '}
      </Fragment>
    ))}
  </>
);

const pressLogos = [
  { alt: 'The Times', src: '/press-logos/the-times.svg' },
  { alt: 'The Guardian', src: '/press-logos/the-guardian.svg' },
  { alt: 'The Daily Telegraph', src: '/press-logos/the-telegraph.svg' },
  { alt: 'Daily Mail', src: '/press-logos/daily-mail.svg' },
  { alt: 'The Spectator', src: '/press-logos/the-spectator.svg' },
];

const brandLogos = [
  { alt: 'Knight Frank', src: '/brand-logos/knightfrank.svg' },
  { alt: 'United Kingdom Sothebys International Realty', src: '/brand-logos/sothebys.svg' },
  { alt: 'Savills', src: '/brand-logos/savills.svg', className: 'slh-logo-savills' },
  { alt: 'Fine and Country', src: '/brand-logos/finecountry.png' },
  { alt: 'Hamptons', src: '/brand-logos/hamptons.png', className: 'slh-logo-hamptons slh-invert' },
  { alt: 'Belvoir', src: '/brand-logos/belvoir.svg' },
  { alt: 'Yopa', src: '/brand-logos/yopa.svg', className: 'slh-invert' },
];

const BadgeCheckIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path opacity="0.2" d="M20.25 5.25V10.5C20.25 19.5 12 21.75 12 21.75C12 21.75 3.75 19.5 3.75 10.5V5.25C3.75 5.05109 3.82902 4.86032 3.96967 4.71967C4.11032 4.57902 4.30109 4.5 4.5 4.5H19.5C19.6989 4.5 19.8897 4.57902 20.0303 4.71967C20.171 4.86032 20.25 5.05109 20.25 5.25Z" fill="#A409D2"/>
    <path d="M19.5 3.75H4.5C4.10218 3.75 3.72064 3.90804 3.43934 4.18934C3.15804 4.47064 3 4.85218 3 5.25V10.5C3 15.4425 5.3925 18.4378 7.39969 20.0803C9.56156 21.8484 11.7122 22.4484 11.8059 22.4738C11.9348 22.5088 12.0708 22.5088 12.1997 22.4738C12.2934 22.4484 14.4413 21.8484 16.6059 20.0803C18.6075 18.4378 21 15.4425 21 10.5V5.25C21 4.85218 20.842 4.47064 20.5607 4.18934C20.2794 3.90804 19.8978 3.75 19.5 3.75ZM19.5 10.5C19.5 13.9753 18.2194 16.7962 15.6937 18.8831C14.5943 19.7885 13.344 20.493 12 20.9644C10.6736 20.5012 9.4387 19.8092 8.35125 18.9197C5.79563 16.8291 4.5 13.9969 4.5 10.5V5.25H19.5V10.5ZM7.71937 13.2806C7.57864 13.1399 7.49958 12.949 7.49958 12.75C7.49958 12.551 7.57864 12.3601 7.71937 12.2194C7.86011 12.0786 8.05098 11.9996 8.25 11.9996C8.44902 11.9996 8.63989 12.0786 8.78063 12.2194L10.5 13.9397L15.2194 9.21937C15.2891 9.14969 15.3718 9.09442 15.4628 9.0567C15.5539 9.01899 15.6515 8.99958 15.75 8.99958C15.8485 8.99958 15.9461 9.01899 16.0372 9.0567C16.1282 9.09442 16.2109 9.14969 16.2806 9.21937C16.3503 9.28906 16.4056 9.37178 16.4433 9.46283C16.481 9.55387 16.5004 9.65145 16.5004 9.75C16.5004 9.84855 16.481 9.94613 16.4433 10.0372C16.4056 10.1282 16.3503 10.2109 16.2806 10.2806L11.0306 15.5306C10.961 15.6004 10.8783 15.6557 10.7872 15.6934C10.6962 15.7312 10.5986 15.7506 10.5 15.7506C10.4014 15.7506 10.3038 15.7312 10.2128 15.6934C10.1217 15.6557 10.039 15.6004 9.96937 15.5306L7.71937 13.2806Z" fill="#A409D2"/>
  </svg>
);
const BadgeScoreIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path opacity="0.2" d="M19.5 3.75V19.5H14.25V3.75H19.5Z" fill="#A409D2"/>
    <path d="M21 18.75H20.25V3.75C20.25 3.55109 20.171 3.36032 20.0303 3.21967C19.8897 3.07902 19.6989 3 19.5 3H14.25C14.0511 3 13.8603 3.07902 13.7197 3.21967C13.579 3.36032 13.5 3.55109 13.5 3.75V7.5H9C8.80109 7.5 8.61032 7.57902 8.46967 7.71967C8.32902 7.86032 8.25 8.05109 8.25 8.25V12H4.5C4.30109 12 4.11032 12.079 3.96967 12.2197C3.82902 12.3603 3.75 12.5511 3.75 12.75V18.75H3C2.80109 18.75 2.61032 18.829 2.46967 18.9697C2.32902 19.1103 2.25 19.3011 2.25 19.5C2.25 19.6989 2.32902 19.8897 2.46967 20.0303C2.61032 20.171 2.80109 20.25 3 20.25H21C21.1989 20.25 21.3897 20.171 21.5303 20.0303C21.671 19.8897 21.75 19.6989 21.75 19.5C21.75 19.3011 21.671 19.1103 21.5303 18.9697C21.3897 18.829 21.1989 18.75 21 18.75ZM15 4.5H18.75V18.75H15V4.5ZM9.75 9H13.5V18.75H9.75V9ZM5.25 13.5H8.25V18.75H5.25V13.5Z" fill="#A409D2"/>
  </svg>
);
const BadgePlanIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path opacity="0.2" d="M21 12C21 13.78 20.4722 15.5201 19.4832 17.0001C18.4943 18.4802 17.0887 19.6337 15.4442 20.3149C13.7996 20.9961 11.99 21.1743 10.2442 20.8271C8.49836 20.4798 6.89472 19.6226 5.63604 18.364C4.37737 17.1053 3.5202 15.5016 3.17294 13.7558C2.82567 12.01 3.0039 10.2004 3.68509 8.55585C4.36628 6.91131 5.51983 5.50571 6.99987 4.51677C8.47991 3.52784 10.22 3 12 3C14.387 3 16.6761 3.94821 18.364 5.63604C20.0518 7.32387 21 9.61305 21 12Z" fill="#A409D2"/>
    <path d="M16.2806 9.21937C16.3504 9.28903 16.4057 9.37175 16.4434 9.46279C16.4812 9.55384 16.5006 9.65144 16.5006 9.75C16.5006 9.84856 16.4812 9.94616 16.4434 10.0372C16.4057 10.1283 16.3504 10.211 16.2806 10.2806L11.0306 15.5306C10.961 15.6004 10.8783 15.6557 10.7872 15.6934C10.6962 15.7312 10.5986 15.7506 10.5 15.7506C10.4014 15.7506 10.3038 15.7312 10.2128 15.6934C10.1218 15.6557 10.039 15.6004 9.96938 15.5306L7.71938 13.2806C7.57865 13.1399 7.49959 12.949 7.49959 12.75C7.49959 12.551 7.57865 12.3601 7.71938 12.2194C7.86011 12.0786 8.05098 11.9996 8.25 11.9996C8.44903 11.9996 8.6399 12.0786 8.78063 12.2194L10.5 13.9397L15.2194 9.21937C15.289 9.14964 15.3718 9.09432 15.4628 9.05658C15.5538 9.01884 15.6514 8.99941 15.75 8.99941C15.8486 8.99941 15.9462 9.01884 16.0372 9.05658C16.1283 9.09432 16.211 9.14964 16.2806 9.21937ZM21.75 12C21.75 13.9284 21.1782 15.8134 20.1068 17.4168C19.0355 19.0202 17.5127 20.2699 15.7312 21.0078C13.9496 21.7458 11.9892 21.9389 10.0979 21.5627C8.20656 21.1865 6.46928 20.2579 5.10571 18.8943C3.74215 17.5307 2.81355 15.7934 2.43735 13.9021C2.06114 12.0108 2.25422 10.0504 2.99218 8.26884C3.73013 6.48726 4.97982 4.96451 6.58319 3.89317C8.18657 2.82183 10.0716 2.25 12 2.25C14.585 2.25273 17.0634 3.28084 18.8913 5.10872C20.7192 6.93661 21.7473 9.41498 21.75 12ZM20.25 12C20.25 10.3683 19.7661 8.77325 18.8596 7.41655C17.9531 6.05984 16.6646 5.00242 15.1571 4.37799C13.6497 3.75357 11.9909 3.59019 10.3905 3.90852C8.79017 4.22685 7.32016 5.01259 6.16637 6.16637C5.01259 7.32015 4.22685 8.79016 3.90853 10.3905C3.5902 11.9908 3.75358 13.6496 4.378 15.1571C5.00242 16.6646 6.05984 17.9531 7.41655 18.8596C8.77326 19.7661 10.3683 20.25 12 20.25C14.1873 20.2475 16.2843 19.3775 17.8309 17.8309C19.3775 16.2843 20.2475 14.1873 20.25 12Z" fill="#A409D2"/>
  </svg>
);

const heroBadges = [
  { icon: BadgeCheckIcon, title: 'Human Verified', sub: 'Every listing reviewed' },
  { icon: BadgeScoreIcon, title: 'Proprietary scoring', sub: 'The Havlo Index' },
  { icon: BadgePlanIcon, title: 'Actionable plans', sub: 'Get listings moving again' },
];

const problemPoints = [
  ['The listing itself often isn’t the real problem — price', 'positioning, photo order, and description usually are.'],
  ['Agents rarely have time to re-audit every listing that’s gone', 'quiet — they’re managing new instructions.'],
  ['Sellers are told to “just wait” or “drop the price” — with no', 'real diagnosis of what’s actually wrong.'],
];

const methodSteps = [
  {
    title: 'Signal capture',
    icon: ChartPie,
    desc: [
      'We pull 40+ data points per listing — portal',
      'views, save-rate, price-drop history, days-on-',
      'market decay, comparable sold prices — and',
      'weight them against thousands of similar UK',
      'listings using the Havlo Index, our proprietary',
      'scoring model.',
    ],
  },
  {
    title: 'Human review, in-house metrics',
    icon: Eye,
    desc: [
      'A Havlo reviewer cross-references the Index',
      'score against listing-quality metrics we’ve',
      'developed in-house — built from patterns',
      'across every stale listing we’ve assessed — to',
      'confirm exactly what’s losing buyers and rule',
      'out the false positives an algorithm alone would',
      'flag.',
    ],
  },
  {
    title: 'The fix',
    icon: CircleCheck,
    desc: [
      'You get a short, prioritised report: the specific',
      'changes to make first, ranked by expected',
      'impact on the Index score — built to be',
      'implemented immediately, not filed away.',
    ],
  },
];

const platformItems = [
  { title: 'Portals & marketplaces', desc: ['— licence the Havlo Index as a stale-listing signal or feature layer on top of', 'your existing data.'] },
  { title: 'Estate agent groups', desc: ['— roll the assessment out across every branch’s book, not just the listings one', 'agent flags manually.'] },
  { title: 'Proptech & CRM platforms', desc: ['— integrate Index scoring and recommendations directly into the tools', 'agents already use.'] },
  { title: 'Lenders & surveyors', desc: ['— use listing-health scoring as an additional signal alongside valuation', 'data.'] },
];

const reviews = [
  {
    role: 'Independent agent',
    quote: ['“Had a listing sat at 11 weeks. The report', 'told us the price was fine — it was the lead', 'photo. Swapped it, had two viewings that', 'weekend.”'],
    tag: 'North West England',
  },
  {
    role: 'Seller',
    quote: ['“Didn’t expect a person to actually look at', 'our listing rather than just spitting out a', 'score. That’s the part that convinced us to', 'act on it.”'],
    tag: 'South East England',
  },
  {
    role: 'Independent agent',
    quote: ['“I’d been told to just drop the price twice.', 'Havlo’s plan was the first time anyone', 'actually looked at why buyers weren’t', 'booking viewings.”'],
    tag: 'Sold within 5 weeks of review',
  },
];

// The marquee renders the review set this many times and slides by one set
// per loop, so the strip never runs out of cards on wide screens.
const REVIEW_COPIES = 4;

const ReviewStars = () => (
  <svg width="138" height="26" viewBox="0 0 138 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Rated 5 out of 5">
    {[0, 28, 56, 84, 112].map((x) => (
      <g key={x} transform={`translate(${x} 0)`}>
        <rect width="26" height="26" fill="#00B67A" />
        <path d="M13 4.7l2 4.05 4.47.65-3.24 3.15.77 4.45L13 14.9l-4 2.1.77-4.45L6.53 9.4 11 8.75 13 4.7z" fill="#fff" />
      </g>
    ))}
  </svg>
);

const NOTICE_KEY = 'slh-country-notice-dismissed';

const CountryNotice = () => {
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(NOTICE_KEY) !== '1';
    } catch {
      return true;
    }
  });
  if (!open) return null;
  const dismiss = () => {
    setOpen(false);
    try {
      sessionStorage.setItem(NOTICE_KEY, '1');
    } catch {
      // Storage unavailable (private mode) — the notice just returns next visit.
    }
  };
  return (
    <div className="slh-notice">
      <div className="slh-wrap slh-notice-inner">
        <p>You are currently on the United Kingdom page. To view content specific to your location, select a different country or region.</p>
        <button type="button" onClick={dismiss} aria-label="Dismiss notice">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const navLinks = [
  { label: 'How it works', href: '#how' },
  { label: 'Methodology', href: '#methodology' },
  { label: 'Partnerships', to: '/stale-listings/partnerships' },
  { label: 'Reviews', href: '#reviews' },
];

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <>
      <header className="slh-header">
        <div className="slh-wrap slh-header-inner">
          <div className="slh-brand">
            <Link to="/stale-listings" className="slh-logo" aria-label="Stale Listings by Havlo">
              <StaleListingsLogo className="slh-logo-mark" />
            </Link>
            <CountryBadge variant="inline" />
          </div>
          <nav className="slh-nav" aria-label="Stale Listings">
            {navLinks.map(({ label, href, to }) => (to
              ? <Link key={label} to={to}>{label}</Link>
              : <a key={label} href={href}>{label}</a>))}
          </nav>
          <div className="slh-header-ctas">
            <Link className="slh-btn slh-btn--dark" to="/stale-listings/agents">Agents</Link>
            <Link className="slh-btn slh-btn--light" to="/stale-listings/seller">Sellers</Link>
          </div>
          <button type="button" className="slh-menu" aria-label="Open navigation menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <div className={`slh-drawer-backdrop${menuOpen ? ' is-open' : ''}`} onClick={close} aria-hidden="true" />
      <div className={`slh-drawer${menuOpen ? ' is-open' : ''}`} role="dialog" aria-modal="true" aria-label="Navigation menu" aria-hidden={!menuOpen}>
        <div className="slh-drawer-head">
          <StaleListingsLogo className="slh-logo-mark" />
          <button type="button" onClick={close} aria-label="Close menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="#1F1F1E" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav className="slh-drawer-nav" aria-label="Stale Listings">
          {navLinks.map(({ label, href, to }) => (to
            ? <Link key={label} to={to} onClick={close}>{label}</Link>
            : <a key={label} href={href} onClick={close}>{label}</a>))}
        </nav>
        <div className="slh-drawer-ctas">
          <Link className="slh-btn slh-btn--dark" to="/stale-listings/agents" onClick={close}>Get Started - Agents</Link>
          <Link className="slh-btn slh-btn--light" to="/stale-listings/seller" onClick={close}>Get Started - Sellers</Link>
        </div>
      </div>
    </>
  );
};

export const StaleListingsHome = () => {
  const typedTail = useTypewriter('a second look.');

  return (
    <div className="slh-page">
      <CountryNotice />
      <Header />

      <section className="slh-hero">
        <div className="slh-wrap slh-hero-inner">
          <div className="slh-hero-copy">
            <h1>
              Some <span className="slh-accent">listings</span> just<br />
              need{' '}
              <span className="slh-hero-typed-wrap">
                <span aria-hidden="true">
                  {typedTail}
                  <span className="slh-hero-cursor" />
                </span>
                <span className="sr-only">a second look.</span>
              </span>
            </h1>
            <p className="slh-hero-desc">
              <Lines lines={[
                'Havlo Stale Listings is a property intelligence built around the Havlo Index',
                '— a proprietary scoring model that works out why a listing isn’t selling,',
                'verified by human review, and turned into a plan to get it moving again',
              ]} />
            </p>
            <div className="slh-hero-actions">
              <Link className="slh-btn slh-btn--dark" to="/stale-listings/agents">Get Started - Agents</Link>
              <Link className="slh-btn slh-btn--light" to="/stale-listings/seller">Get Started - Sellers</Link>
            </div>
            <ul className="slh-badges">
              {heroBadges.map(({ icon: Icon, title, sub }) => (
                <li key={title}>
                  <Icon />
                  <span>
                    <span className="slh-badge-title">{title}</span>
                    <span className="slh-badge-sub">{sub}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="slh-hero-visual">
            <img src="/stale-home-customer.png" alt="Reassessed Stale Listing example: 14 Aldermoor Close, 148 days listed before, 19 days to offer after" width={540} height={540} />
          </div>
        </div>
      </section>

      <section className="slh-featured" aria-label="As featured in">
        <p className="slh-strip-label">As featured in</p>
        <div className="slh-strip slh-strip--press">
          <div className="slh-strip-track">
            {pressLogos.map((item) => <img key={item.alt} src={item.src} alt={item.alt} />)}
            {pressLogos.map((item) => <img key={`${item.alt}-dup`} className="slh-dup" src={item.src} alt="" aria-hidden="true" />)}
          </div>
        </div>
      </section>

      <section className="slh-brands" aria-label="Supported real estate brands">
        <p className="slh-strip-label">We’ve supported agents affiliated with leading real estate brands</p>
        <div className="slh-strip slh-strip--brands">
          <div className="slh-strip-track">
            {brandLogos.map((item) => <img key={item.alt} src={item.src} alt={item.alt} className={item.className} />)}
            {brandLogos.map((item) => <img key={`${item.alt}-dup`} src={item.src} alt="" aria-hidden="true" className={`slh-dup ${item.className ?? ''}`} />)}
          </div>
        </div>
      </section>

      <section id="how" className="slh-problem">
        <div className="slh-wrap slh-problem-inner">
          <div className="slh-problem-copy">
            <p className="slh-eyebrow slh-eyebrow--dark">The Problem</p>
            <h2 className="slh-h2 slh-h2--problem">
              <Lines lines={['The portals show buyers exactly how', 'long you’ve been stuck']} />
            </h2>
            <p className="slh-body">
              <Lines lines={[
                'Rightmove and Zoopla both display days-on-market by default.',
                'Once that number climbs, buyers start asking why — before',
                'they’ve even booked a viewing.',
              ]} />
            </p>
            <ul className="slh-problem-list">
              {problemPoints.map((point) => <li key={point[0]}><Lines lines={point} /></li>)}
            </ul>
          </div>
          <div className="slh-approach-frame">
            <div className="slh-approach">
              <span className="slh-pill"><i />Our approach</span>
              <h3>A proprietary model, not a public checklist.</h3>
              <p className="slh-approach-desc">
                <Lines lines={[
                  'Havlo scores every listing against the Havlo Index — a weighted model',
                  'we’ve built and refined in-house across every stale listing we’ve assessed.',
                  'It’s not a generic portal score anyone can look up: the weightings,',
                  'thresholds, and pattern library are ours, tuned on real UK sale outcomes. A',
                  'Havlo reviewer then checks the Index output against the actual listing and',
                  'turns it into a short, actionable plan.',
                ]} />
              </p>
              <div className="slh-approach-grid">
                <article>
                  <h4>Data intelligence</h4>
                  <p>
                    <Lines lines={[
                      'Comparable sales, portal',
                      'engagement, price-drop',
                      'history, and time-on-market',
                      'benchmarks, scored against',
                      'the Havlo Index rather than a',
                      'single public metric.',
                    ]} />
                  </p>
                </article>
                <article>
                  <h4>Human review</h4>
                  <p>
                    <Lines lines={[
                      'A reviewer cross-checks the',
                      'Index score using our own in-',
                      'house developed listing',
                      'metrics, then confirms the',
                      'actual, implementable fix —',
                      'not just a flag.',
                    ]} />
                  </p>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="methodology" className="slh-method">
        <div className="slh-wrap">
          <div className="slh-method-head">
            <p className="slh-eyebrow">Methodology</p>
            <h2 className="slh-h2">
              <Lines lines={['The Havlo Index: three passes, one', 'proprietary model']} />
            </h2>
            <p className="slh-body slh-method-head-desc">
              <Lines lines={[
                'Three interlocking stages — raw signal is weighted into a scored diagnosis',
                'by the Index, then stress-tested by human review before a plan ever reaches',
                'you. Replicating one stage without the other two just gets you a guess',
              ]} />
            </p>
          </div>
          <div className="slh-method-grid">
            {methodSteps.map(({ title, icon: Icon, desc }) => (
              <article key={title} className="slh-method-card">
                <Icon size={40} strokeWidth={1.75} color="#A409D2" aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p><Lines lines={desc} /></p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="slh-platforms">
        <div className="slh-wrap slh-platforms-inner">
          <div className="slh-platforms-copy">
            <p className="slh-eyebrow">For companies &amp; platforms</p>
            <h2 className="slh-h2">
              <Lines lines={['Havlo is a property intelligence', 'company, not a single-purpose', 'tool']} />
            </h2>
            <p className="slh-body">
              <Lines lines={['Havlo Stale Listing is a property', 'intelligence, not a single-purpose tool']} />
            </p>
            <Link className="slh-btn slh-btn--dark" to="/stale-listings/partnerships">Talk to Us about partnering</Link>
          </div>
          <ul className="slh-platform-list">
            {platformItems.map(({ title, desc }) => (
              <li key={title}>
                <h3>{title}</h3>
                <p><Lines lines={desc} /></p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="reviews" className="slh-reviews">
        <div className="slh-wrap">
          <p className="slh-eyebrow">Reviews</p>
          <h2 className="slh-h2">What agents and sellers say</h2>
        </div>
        <div className="slh-reviews-viewport">
          <div
            className="slh-reviews-track"
            style={{ '--slh-copies': REVIEW_COPIES, '--slh-reviews-duration': `${reviews.length * 10}s` } as CSSProperties}
          >
            {Array.from({ length: REVIEW_COPIES }, (_, copy) => reviews.map(({ role, quote, tag }) => (
              <article key={`${copy}-${quote[0]}`} className="slh-review" aria-hidden={copy > 0 || undefined}>
                <ReviewStars />
                <p className="slh-review-role">{role}</p>
                <p className="slh-review-quote"><Lines lines={quote} /></p>
                <p className="slh-review-tag">{tag}</p>
              </article>
            )))}
          </div>
        </div>
      </section>

      <section className="slh-cta">
        <span className="slh-pill slh-pill--light"><i />Ready when you are</span>
        <h2>Get your listing moving again</h2>
        <p>
          <Lines lines={[
            'Whether you’re managing 100 instructions or watching one listing go quiet, Havlo Stale',
            'Listings gives you a clear, specific reason it’s stuck — and what to do next.',
          ]} />
        </p>
        <div className="slh-cta-actions">
          <Link className="slh-btn slh-btn--white" to="/stale-listings/agents">Get Started - Agents</Link>
          <Link className="slh-btn slh-btn--outline" to="/stale-listings/seller">Get Started - Sellers</Link>
        </div>
      </section>

      <Footer />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        .slh-page{font-family:Inter,sans-serif;color:#1F1F1E;background:#fff;overflow-x:hidden}
        .slh-wrap{width:min(1140px,calc(100% - 48px));margin-inline:auto}
        .slh-ln{display:block;white-space:nowrap}
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

        .slh-btn{display:inline-flex;align-items:center;justify-content:center;height:42px;padding:0 22px;border-radius:8px;font-family:Inter,sans-serif;font-weight:500;font-size:14px;line-height:1;letter-spacing:-0.02em;text-decoration:none;white-space:nowrap;transition:background-color .2s,color .2s,border-color .2s}
        .slh-btn--dark{background:#000;color:#fff;border:1px solid #000}
        .slh-btn--dark:hover{background:#222}
        .slh-btn--light{background:#fff;color:#000;border:1px solid rgba(0,0,0,.1)}
        .slh-btn--light:hover{border-color:rgba(0,0,0,.25)}
        
        .slh-notice{background:#A409D2;color:#fff}
        .slh-notice-inner{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:94px}
        .slh-notice p{margin:0;font-family:Inter,sans-serif;font-weight:500;font-size:18px;line-height:1.5;letter-spacing:-0.02em}
        .slh-notice button{flex:none;display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:50%;background:rgba(255,255,255,.16);color:#fff;cursor:pointer}

        .slh-header{background:#fff;border-bottom:1px solid #F4F4F4}
        .slh-header-inner{height:80px;display:flex;align-items:center;justify-content:space-between;gap:24px}
        .slh-brand{display:flex;align-items:center;gap:16px}
        .slh-logo{display:inline-flex;align-items:center;text-decoration:none}
        .slh-logo-mark{height:50px!important;width:auto!important}
        .slh-nav{display:flex;align-items:center;gap:40px}
        .slh-nav a{font-family:Inter,sans-serif;font-weight:500;font-size:16px;line-height:1.5;letter-spacing:-0.02em;color:#000;opacity:.8;text-decoration:none;white-space:nowrap}
        .slh-nav a:hover{opacity:1}
        .slh-header-ctas{display:flex;align-items:center;gap:16px}
        .slh-menu{display:none;width:40px;height:40px;padding:8px;border:0;background:none;cursor:pointer}
        .slh-menu span{display:block;height:2px;margin:5px 0;border-radius:2px;background:#1F1F1E}
        .slh-drawer-backdrop{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:opacity .3s}
        .slh-drawer-backdrop.is-open{opacity:1;pointer-events:auto}
        .slh-drawer{position:fixed;top:0;right:0;bottom:0;z-index:100;width:280px;display:flex;flex-direction:column;padding:24px 24px 40px;background:#fff;box-shadow:-4px 0 24px rgba(0,0,0,.12);transform:translateX(100%);visibility:hidden;transition:transform .3s cubic-bezier(.4,0,.2,1),visibility .3s}
        .slh-drawer.is-open{transform:none;visibility:visible}
        .slh-drawer-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px}
        .slh-drawer-head .slh-logo-mark{height:40px!important}
        .slh-drawer-head button{display:flex;padding:4px;border:0;background:none;cursor:pointer}
        .slh-drawer-nav a{display:block;padding:16px 0;border-bottom:1px solid rgba(0,0,0,.08);font-family:Inter,sans-serif;font-weight:500;font-size:18px;letter-spacing:-0.02em;color:#1F1F1E;text-decoration:none}
        .slh-drawer-ctas{display:grid;gap:12px;margin-top:24px}

        .slh-hero{position:relative;overflow:hidden;background:#fff}
        .slh-hero::before{content:'';position:absolute;top:50%;left:calc(50% + 300px);width:1100px;height:900px;transform:translate(-50%,-50%);background:radial-gradient(closest-side,rgba(255,176,230,.5),rgba(255,176,230,.18) 55%,rgba(255,176,230,0));pointer-events:none}
        .slh-hero-inner{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 540px;align-items:center;gap:40px;padding:74px 0 80px}
        .slh-hero h1{margin:0;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:56px;line-height:110%;letter-spacing:-0.03em;color:#1F1F1E}
        .slh-accent{color:#6E0C8D}
        .slh-hero-typed-wrap{white-space:nowrap}
        .slh-hero-cursor{display:inline-block;width:3px;height:.85em;margin-left:2px;vertical-align:-0.08em;background:currentColor;animation:slh-cursor-blink .85s step-end infinite}
        @keyframes slh-cursor-blink{0%,100%{opacity:1}50%{opacity:0}}
        .slh-hero-copy{align-self:start;margin-top:64px}
        .slh-hero-desc{margin:24px 0 0;font-family:Inter,sans-serif;font-weight:400;font-size:16px;line-height:150%;letter-spacing:-0.02em;color:#1F1F1E}
        .slh-hero-actions{display:flex;flex-wrap:wrap;gap:16px;margin-top:50px}
        .slh-hero-actions .slh-btn{height:44px}
        .slh-badges{display:flex;gap:32px;margin:74px 0 0;padding:0;list-style:none}
        .slh-badges li{display:flex;align-items:flex-start;gap:12px}
        .slh-badges svg{flex:none}
        .slh-badge-title{display:block;font-family:Inter,sans-serif;font-weight:600;font-size:14px;line-height:140%;letter-spacing:-0.02em;color:#1F1F1E}
        .slh-badge-sub{display:block;margin-top:2px;font-family:Inter,sans-serif;font-weight:400;font-size:12px;line-height:140%;letter-spacing:-0.02em;color:#7B7D82}
        .slh-hero-visual img{display:block;width:540px;height:auto}

        .slh-strip-label{margin:0;text-align:center;font-family:Inter,sans-serif;font-weight:500;font-size:16px;line-height:150%;letter-spacing:-0.02em;text-transform:uppercase}
        .slh-strip{overflow:hidden}
        .slh-strip-track{display:flex;align-items:center}
        .slh-dup{display:none}
        @keyframes slh-strip-scroll{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}
        .slh-featured{background:#4E0363;padding:50px 0 54px}
        .slh-featured .slh-strip-label{color:#EED3F7}
        .slh-strip--press{width:min(1140px,calc(100% - 48px));margin:50px auto 0}
        .slh-strip--press .slh-strip-track{justify-content:space-between}
        .slh-strip--press img{height:32px;width:auto;filter:brightness(0) invert(1)}
        .slh-brands{padding:52px 0 0;background:#fff}
        .slh-brands .slh-strip-label{color:#5C5C5C}
        .slh-strip--brands{margin-top:49px}
        .slh-strip--brands .slh-strip-track{justify-content:center;height:54px}
        .slh-strip--brands img{flex:none;height:33px;width:auto;margin:0 27px;filter:grayscale(1);opacity:.75}
        .slh-strip--brands img.slh-logo-savills{height:54px;background:#FFE500}
        .slh-strip--brands img.slh-logo-hamptons{height:36px}
        .slh-strip--brands img.slh-invert{filter:grayscale(1) invert(1)}

        .slh-eyebrow{margin:0;font-family:Inter,sans-serif;font-weight:500;font-size:19px;line-height:150%;letter-spacing:-0.02em;color:#56606B}
        .slh-eyebrow--dark{color:#1F1F1E}
        .slh-h2{margin:24px 0 0;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:34px;line-height:44px;letter-spacing:-0.03em;color:#1F1F1E}
        .slh-h2--problem{font-size:28px;line-height:38px}
        .slh-body{margin:28px 0 0;font-family:Inter,sans-serif;font-weight:400;font-size:16px;line-height:150%;letter-spacing:-0.02em;color:#1F1F1E}

        .slh-problem{position:relative;isolation:isolate;padding-top:158px}
        .slh-problem-inner{display:grid;grid-template-columns:minmax(0,1fr) 556px;gap:64px;align-items:center}
        .slh-problem .slh-body{margin-top:25px}
        .slh-problem-list{list-style:none;margin:22px 0 0;padding:0;max-width:428px}
        .slh-problem-list li{position:relative;padding:23px 0 23px 36px;border-bottom:1px solid #F0F0F0;font-family:Inter,sans-serif;font-weight:400;font-size:14px;line-height:150%;letter-spacing:-0.02em;color:#333}
        .slh-problem-list li:last-child{border-bottom:0}
        .slh-problem-list li::before{content:'';position:absolute;left:2px;top:50%;width:8px;height:8px;margin-top:-4px;border-radius:50%;background:#A409D2}
        .slh-approach-frame{position:relative;height:556px;padding:16px;border-radius:36px;background:linear-gradient(135deg,#E6E1FB 0%,#F5E5F8 50%,#FFEFD6 100%)}
        .slh-approach-frame::before{content:'';position:absolute;inset:-160px;z-index:-1;background:radial-gradient(closest-side,rgba(255,176,230,.32),rgba(255,176,230,0));pointer-events:none}
        .slh-approach{display:flex;flex-direction:column;height:100%;border-radius:24px;background:#fff;padding:28px 24px 32px 31px}
        .slh-pill{display:inline-flex;align-self:flex-start;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;background:#FBEFFD;font-family:Inter,sans-serif;font-weight:500;font-size:14px;line-height:150%;letter-spacing:-0.02em;color:#A409D2}
        .slh-pill i{width:8px;height:8px;border-radius:50%;background:#A409D2}
        .slh-approach h3{margin:24px 0 0;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:20px;line-height:130%;letter-spacing:-0.02em;color:#1F1F1E}
        .slh-approach-desc{margin:8px 0 0;font-family:Inter,sans-serif;font-weight:400;font-size:14px;line-height:150%;letter-spacing:-0.02em;color:#555}
        .slh-approach-grid{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:32px}
        .slh-approach-grid article{padding:16px;border-radius:12px;background:#F7F5FA}
        .slh-approach-grid h4{margin:0;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:15px;line-height:150%;text-transform:uppercase;color:#A409D2}
        .slh-approach-grid p{margin:8px 0 0;font-family:Inter,sans-serif;font-weight:400;font-size:14px;line-height:150%;letter-spacing:-0.02em;color:#5F6170}

        .slh-method{padding-top:193px}
        .slh-method-head{display:grid;grid-template-columns:minmax(0,1fr) 559px;column-gap:24px;align-items:start}
        .slh-method-head .slh-eyebrow{grid-column:1/-1}
        .slh-method-head-desc{margin-top:40px;color:#1B1E2A}
        .slh-method-head .slh-h2{line-height:47px}
        .slh-method-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:73px}
        .slh-method-card{display:flex;flex-direction:column;justify-content:space-between;gap:32px;min-height:312px;padding:24px;border:1px solid #F7D9FF;border-radius:8px;background:#fff}
        .slh-method-card h3{margin:0;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:20px;line-height:130%;letter-spacing:-0.02em;color:#0C1228}
        .slh-method-card p{margin:20px 0 0;font-family:Inter,sans-serif;font-weight:400;font-size:14px;line-height:20px;letter-spacing:-0.02em;color:#6B6B6B}

        .slh-platforms{padding-top:204px}
        .slh-platforms-inner{display:grid;grid-template-columns:minmax(0,1fr) 578px;gap:48px;align-items:center}
        .slh-platforms-copy .slh-body{margin-top:26px}
        .slh-platforms-copy .slh-btn{margin-top:46px}
        .slh-platform-list{margin:0;padding:0 14px 24px 32px;list-style:none;border-radius:20px;background:#FAFAFA}
        .slh-platform-list li{position:relative;padding:23px 0 23px 35px}
        .slh-platform-list li+li::after{content:'';position:absolute;top:0;left:0;right:18px;height:1px;background:#EDEDED}
        .slh-platform-list li::before{content:'';position:absolute;left:1px;top:50%;width:8px;height:8px;margin-top:-4px;border-radius:50%;background:#A409D2}
        .slh-platform-list h3{margin:0;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:16px;line-height:150%;letter-spacing:-0.02em;color:#121212}
        .slh-platform-list p{margin:4px 0 0;font-family:Inter,sans-serif;font-weight:400;font-size:14px;line-height:150%;letter-spacing:-0.02em;color:#404040}

        .slh-reviews{padding-top:180px}
        .slh-reviews .slh-h2{margin-top:37px}
        .slh-reviews-viewport{margin-top:52px;overflow:hidden;padding-left:max(24px,calc((100% - 1140px) / 2))}
        .slh-reviews-track{display:flex;width:max-content;animation:slh-reviews-scroll var(--slh-reviews-duration,30s) linear infinite}
        .slh-reviews-viewport:hover .slh-reviews-track{animation-play-state:paused}
        @keyframes slh-reviews-scroll{from{transform:translate3d(0,0,0)}to{transform:translate3d(calc(-100% / var(--slh-copies)),0,0)}}
        .slh-review{flex:none;display:flex;flex-direction:column;width:374px;min-height:345px;margin-right:33px;padding:20px 20px 15px;border-radius:12px;background:#F2F3F7}
        .slh-review svg{flex:none}
        .slh-review-role{margin:12px 0 0;font-family:Inter,sans-serif;font-weight:600;font-size:16px;line-height:150%;letter-spacing:-0.02em;color:#191E32}
        .slh-review-quote{flex:1;margin:11px 0 0;font-family:Inter,sans-serif;font-weight:400;font-size:16px;line-height:150%;letter-spacing:-0.02em;color:#24262B}
        .slh-review-tag{margin:16px 0 0;font-family:Inter,sans-serif;font-weight:600;font-size:16px;line-height:150%;letter-spacing:-0.02em;color:#191E32}

        .slh-cta{width:min(1140px,calc(100% - 48px));min-height:318px;margin:161px auto 96px;padding:38px 24px 40px;border-radius:24px;background-color:#4E0363;background-image:url("/stale-cta-bg.png");background-size:cover;background-position:center;background-blend-mode:overlay;color:#fff;text-align:center}
        .slh-pill--light{padding-block:6px;background:#fff;color:#A409D2}
        .slh-cta h2{margin:21px 0 0;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:34px;line-height:120%;letter-spacing:-0.03em;color:#fff}
        .slh-cta p{margin:31px auto 0;font-family:Inter,sans-serif;font-weight:400;font-size:16px;line-height:21px;letter-spacing:-0.02em;color:rgba(255,255,255,.92)}
        .slh-cta-actions{display:flex;justify-content:center;gap:14px;margin-top:34px}
        .slh-cta-actions .slh-btn{height:40px}
        .slh-btn--white{background:#fff;color:#000;border:1px solid #fff}
        .slh-btn--white:hover{background:#F4E6F9}
        .slh-btn--outline{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.7)}
        .slh-btn--outline:hover{background:rgba(255,255,255,.08)}

        /* Logo row wider than the screen: let it scroll instead of overflowing. */
        @media(max-width:1379px){
          .slh-strip--brands .slh-dup{display:block}
          .slh-strip--brands .slh-strip-track{justify-content:flex-start;width:max-content;animation:slh-strip-scroll 32s linear infinite}
        }

        /* Narrower desktops and tablets: same layout, text wraps naturally. */
        @media(max-width:1199px){
          .slh-ln{display:inline;white-space:normal}
          .slh-hero-inner{grid-template-columns:minmax(0,1fr) minmax(320px,44%)}
          .slh-hero-copy{align-self:center;margin-top:0}
          .slh-hero h1{font-size:48px}
          .slh-hero-visual img{width:100%}
          .slh-problem-inner{grid-template-columns:minmax(0,1fr) minmax(360px,48%);gap:40px}
          .slh-approach-frame{height:auto}
          .slh-method-head{grid-template-columns:1fr 1fr}
          .slh-platforms-inner{grid-template-columns:minmax(0,1fr) minmax(360px,52%)}
          .slh-review-quote .slh-ln{display:block;white-space:nowrap}
        }
        @media(max-width:1024px){
          .slh-nav,.slh-header-ctas{display:none}
          .slh-menu{display:block}
          .slh-hero h1{font-size:40px}
          .slh-badges{flex-wrap:wrap;gap:16px 24px}
        }

        @media(max-width:899px){
          .slh-wrap,.slh-cta{width:calc(100% - 40px)}
          .slh-notice-inner{min-height:0;padding:10px 0;gap:12px}
          .slh-notice p{font-size:12px;line-height:150%}
          .slh-notice button{width:24px;height:24px}
          .slh-header-inner{height:72px}
          .slh-logo-mark{height:40px!important}
          .slh-brand{gap:10px}

          .slh-hero::before{left:50%;top:auto;bottom:-200px;width:700px;height:700px;transform:translateX(-50%)}
          .slh-hero-inner{display:block;padding:32px 0 56px}
          .slh-hero h1{font-size:36px;line-height:120%}
          .slh-hero-desc{margin-top:16px;font-size:14px}
          .slh-hero-actions{display:grid;gap:12px;margin-top:24px}
          .slh-hero-actions .slh-btn{height:44px}
          .slh-badges{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 16px;margin-top:28px}
          .slh-badges li{gap:8px}
          .slh-badges svg{width:20px;height:20px}
          .slh-hero-visual{margin-top:36px}
          .slh-hero-visual img{width:100%;max-width:540px;margin:0 auto}

          .slh-featured{padding:28px 0 26px}
          .slh-strip-label{font-size:12px}
          .slh-strip--press{width:100%;margin-top:20px}
          .slh-strip--press .slh-dup{display:block}
          .slh-strip--press .slh-strip-track{justify-content:flex-start;width:max-content;animation:slh-strip-scroll 20s linear infinite}
          .slh-strip--press img{flex:none;height:22px;margin-right:32px}
          .slh-brands{padding-top:28px}
          .slh-brands .slh-strip-label{width:calc(100% - 40px);max-width:320px;margin:0 auto}
          .slh-strip--brands{margin-top:20px}
          .slh-strip--brands .slh-strip-track{height:36px;animation-duration:24s}
          .slh-strip--brands img{height:22px;margin:0 16px}
          .slh-strip--brands img.slh-logo-savills{height:36px}
          .slh-strip--brands img.slh-logo-hamptons{height:24px}

          .slh-eyebrow{font-size:16px}
          .slh-h2,.slh-h2--problem{margin-top:16px;font-size:28px}
          .slh-body{margin-top:20px;font-size:14px}
          .slh-problem{padding-top:72px}
          .slh-problem-inner{display:block}
          .slh-problem-list{max-width:none}
          .slh-problem-list li{padding:20px 0 20px 28px;font-size:13px}
          .slh-approach-frame{margin-top:28px;padding:10px;border-radius:26px}
          .slh-approach{padding:20px;border-radius:18px}
          .slh-approach h3{margin-top:20px;font-size:18px}
          .slh-approach-desc{font-size:13px}
          .slh-approach-grid{grid-template-columns:1fr;gap:12px;margin-top:20px}
          .slh-approach-grid p{font-size:13px}

          .slh-method{padding-top:96px}
          .slh-method-head{display:block}
          .slh-method-head-desc{margin-top:16px}
          .slh-method-grid{grid-template-columns:1fr;gap:16px;margin-top:28px}
          .slh-method-card{min-height:0;gap:56px}
          .slh-method-card h3{font-size:18px}
          .slh-method-card p{margin-top:12px;font-size:13px}

          .slh-platforms{padding-top:96px}
          .slh-platforms-inner{display:block}
          .slh-platforms-copy .slh-btn{display:flex;width:100%;margin-top:24px;height:44px}
          .slh-platform-list{margin-top:28px;padding:4px 20px}
          .slh-platform-list li{padding:20px 0 20px 28px}
          .slh-platform-list h3{font-size:15px}
          .slh-platform-list p{font-size:13px}

          .slh-reviews{padding-top:96px}
          .slh-reviews .slh-h2{margin-top:16px}
          .slh-reviews-viewport{margin-top:24px;padding-left:20px}
          .slh-review-quote .slh-ln{display:inline;white-space:normal}
          .slh-review{width:290px;min-height:300px;margin-right:16px;padding:18px}
          .slh-review-quote{font-size:14px}

          .slh-cta{margin:72px auto 56px;padding:28px 16px;border-radius:20px}
          .slh-cta h2{font-size:28px}
          .slh-cta p{margin-top:16px;font-size:13px}
          .slh-cta-actions{flex-direction:column;gap:12px;margin-top:24px}
          .slh-cta-actions .slh-btn{width:100%;height:44px}
        }

        /* Reduced motion: no marquees — logo rows wrap, reviews scroll by hand. */
        @media(prefers-reduced-motion:reduce){
          .slh-strip-track,.slh-reviews-track{animation:none!important}
          .slh-strip .slh-dup,.slh-review[aria-hidden]{display:none!important}
          .slh-reviews-viewport{overflow-x:auto}
          .slh-hero-cursor{animation:none}
        }
        @media(prefers-reduced-motion:reduce) and (max-width:1379px){
          .slh-strip--brands .slh-strip-track{width:auto!important;height:auto!important;flex-wrap:wrap;justify-content:center!important;row-gap:16px}
        }
        @media(prefers-reduced-motion:reduce) and (max-width:899px){
          .slh-strip--press .slh-strip-track{width:auto!important;flex-wrap:wrap;justify-content:center!important;row-gap:16px}
        }
      `}</style>
    </div>
  );
};

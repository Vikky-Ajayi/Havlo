import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StaleListingsLogo } from '../components/shared/StaleListingsLogo';

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
  { alt: 'Savills', src: '/brand-logos/savills.svg' },
  { alt: 'Fine and Country', src: '/brand-logos/finecountry.png' },
  { alt: 'Hamptons', src: '/brand-logos/hamptons.png', invert: true },
  { alt: 'Belvoir', src: '/brand-logos/belvoir.svg' },
  { alt: 'Yopa', src: '/brand-logos/yopa.svg', invert: true },
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

const SignalIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 4.5a3.7 3.7 0 003.7 3.7A3.8 3.8 0 0119.5 12" stroke="#b400e7" strokeWidth="1.7" strokeLinecap="round"/>
    <path d="M12 19.5a3.7 3.7 0 00-3.7-3.7A3.8 3.8 0 014.5 12" stroke="#b400e7" strokeWidth="1.7" strokeLinecap="round"/>
    <circle cx="16" cy="12" r="1.6" fill="#b400e7"/>
    <circle cx="8" cy="12" r="1.6" fill="#b400e7"/>
  </svg>
);
const ReviewIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" stroke="#b400e7" strokeWidth="1.6" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="3" stroke="#b400e7" strokeWidth="1.6"/>
  </svg>
);
const FixIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9.25" stroke="#b400e7" strokeWidth="1.6"/>
    <path d="M8 12.3l2.6 2.6 5.4-5.8" stroke="#b400e7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const methodSteps = [
  {
    title: 'Signal capture',
    icon: SignalIcon,
    desc: "We pull 40+ data points per listing — portal views, save-rate, price-drop history, days-on-market decay, comparable sold prices — and weight them against thousands of similar UK listings using the Havlo Index, our proprietary scoring model.",
  },
  {
    title: 'Human review, in-house metrics',
    icon: ReviewIcon,
    desc: "A Havlo reviewer cross-references the Index score against listing-quality metrics we've developed in-house — built from patterns across every stale listing we've assessed — to confirm exactly what's losing buyers and rule out the false positives an algorithm alone would flag.",
  },
  {
    title: 'The fix',
    icon: FixIcon,
    desc: "You get a short, prioritised report: the specific changes to make first, ranked by expected impact on the Index score — built to be implemented immediately, not filed away.",
  },
];

const reviews = [
  { quote: "Had a listing sat at 11 weeks. The report told us the price was fine — it was the lead photo. Swapped it, had two viewings that weekend.", role: 'Independent agent', tag: 'North West England' },
  { quote: "Didn't expect a person to actually look at our listing rather than just spitting out a score. That's the part that convinced us to act on it.", role: 'Seller', tag: 'South East England' },
  { quote: "I'd been told to just drop the price twice. Havlo's plan was the first time anyone actually looked at why buyers weren't booking viewings.", role: 'Independent agent', tag: 'Sold within 5 weeks of review' },
];

const StarCell = ({ x }: { x: number }) => (
  <g transform={`translate(${x} 0)`}>
    <rect width="20" height="20" rx="3" fill="#00b67a"/>
    <path d="M10 3.6l1.53 3.1 3.42.5-2.47 2.4.58 3.4L10 11.4l-3.06 1.6.58-3.4-2.47-2.4 3.42-.5L10 3.6z" fill="#fff"/>
  </g>
);
const ReviewStars = () => (
  <svg width="112" height="20" viewBox="0 0 112 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    {[0, 23, 46, 69, 92].map((x) => <StarCell key={x} x={x} />)}
  </svg>
);

const platformItems = [
  { title: 'Portals & marketplaces', desc: 'licence the Havlo Index as a stale-listing signal or feature layer on top of your existing data.' },
  { title: 'Estate agent groups', desc: "roll the assessment out across every branch's book, not just the listings one agent flags manually." },
  { title: 'Proptech & CRM platforms', desc: 'integrate Index scoring and recommendations directly into the tools agents already use.' },
  { title: 'Lenders & surveyors', desc: 'use listing-health scoring as an additional signal alongside valuation data.' },
];

const Header = () => (
  <header className="slh-header">
    <Link to="/stale-listings" className="slh-logo" aria-label="Stale Listings by Havlo">
      <StaleListingsLogo className="slh-logo-mark" />
    </Link>
    <nav className="slh-nav">
      <a href="#how">How it works</a>
      <a href="#methodology">Methodology</a>
      <Link to="/stale-listings/partnerships">Partnerships</Link>
      <a href="#reviews">Reviews</a>
      <Link className="slh-nav-btn slh-nav-btn--dark" to="/stale-listings/agents">Agents</Link>
      <Link className="slh-nav-btn" to="/stale-listings/seller">Sellers</Link>
    </nav>
    <button className="slh-menu" aria-label="Open navigation menu">
      <span />
      <span />
      <span />
    </button>
  </header>
);

export const StaleListingsHome = () => {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const lookup = (event: FormEvent) => {
    event.preventDefault();
    const clean = code.trim().replace(/\D/g, '').slice(0, 4);
    if (clean.length === 4) navigate(`/stale-listings/prospect?code=${clean}`);
  };

  return (
    <div className="slh-page">
      <Header />

      <section className="slh-hero">
        <div className="slh-hero-copy">
          <h1>Some <span>listings</span> just need a second look.</h1>
          <p>Havlo Stale Listings is a property intelligence built around the Havlo Index, a proprietary scoring model that works out why a listing isn't selling, verified by human review, and turned into a plan to get it moving again.</p>
          <div className="slh-hero-actions">
            <Link to="/stale-listings/agents">Get Started - Agents</Link>
            <Link to="/stale-listings/seller">Get Started - Sellers</Link>
          </div>
          <form className="slh-code-form" onSubmit={lookup}>
            <label htmlFor="slh-code">Have a property ID?</label>
            <div>
              <input id="slh-code" inputMode="numeric" maxLength={4} value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter your 4-digit code" />
              <button type="submit">View assessment</button>
            </div>
          </form>
          <div className="slh-badges">
            {heroBadges.map(({ icon: Icon, title, sub }) => (
              <span key={title}><Icon /><b>{title}<small>{sub}</small></b></span>
            ))}
          </div>
        </div>
        <img className="slh-customer" src="/stale-home-customer.png" alt="Reassessed Stale Listing example" />
      </section>

      <section className="slh-featured" aria-label="As featured in">
        <p>AS FEATURED IN</p>
        <div className="slh-marquee">
          <div className="slh-marquee-track">
            {pressLogos.map((item) => <img key={item.alt} src={item.src} alt={item.alt} />)}
            {pressLogos.map((item) => <img key={`${item.alt}-dup`} className="slh-dup" src={item.src} alt="" aria-hidden="true" />)}
          </div>
        </div>
      </section>

      <section className="slh-brands" aria-label="Supported real estate brands">
        <p>WE'VE SUPPORTED AGENTS AFFILIATED WITH LEADING REAL ESTATE BRANDS</p>
        <div className="slh-marquee">
          <div className="slh-marquee-track">
            {brandLogos.map((item) => <img key={item.alt} src={item.src} alt={item.alt} className={item.invert ? 'slh-invert' : undefined} />)}
            {brandLogos.map((item) => <img key={`${item.alt}-dup`} src={item.src} alt="" aria-hidden="true" className={item.invert ? 'slh-dup slh-invert' : 'slh-dup'} />)}
          </div>
        </div>
      </section>

      <section className="slh-problem">
        <div className="slh-problem-copy">
          <small>The Problem</small>
          <h2>The portals show buyers exactly how long you've been stuck</h2>
          <p>Rightmove and Zoopla both display days-on-market by default. Once that number climbs, buyers start asking why — before they've even booked a viewing.</p>
          <ul>
            <li>The listing itself often isn't the real problem — price positioning, photo order, and description usually are.</li>
            <li>Agents rarely have time to re-audit every listing that's gone quiet — they're managing new instructions.</li>
            <li>Sellers are told to "just wait" or "drop the price" — with no real diagnosis of what's actually wrong.</li>
          </ul>
        </div>
        <div className="slh-approach">
          <span><i />Our approach</span>
          <h3>A proprietary model, not a public checklist.</h3>
          <p>Havlo scores every listing against the Havlo Index — a weighted model we've built and refined in-house across every stale listing we've assessed. It's not a generic portal score anyone can look up: the weightings, thresholds, and pattern library are ours, tuned on real UK sale outcomes. A Havlo reviewer then checks the Index output against the actual listing and turns it into a short, actionable plan.</p>
          <div>
            <article>
              <b>DATA INTELLIGENCE</b>
              <p>Comparable sales, portal engagement, price-drop history, and time-on-market benchmarks, scored against the Havlo Index rather than a single public metric.</p>
            </article>
            <article>
              <b>HUMAN REVIEW</b>
              <p>A reviewer cross-checks the Index score using our own in-house developed listing metrics, then confirms the actual, implementable fix — not just a flag.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="methodology" className="slh-method">
        <div className="slh-section-head">
          <small>Methodology</small>
          <h2>The Havlo Index: three passes, one proprietary model</h2>
          <p>Three interlocking stages — raw signal is weighted into a scored diagnosis by the Index, then stress-tested by human review before a plan ever reaches you. Replicating one stage without the other two just gets you a guess.</p>
        </div>
        <div className="slh-method-grid">
          {methodSteps.map(({ title, icon: Icon, desc }) => <article key={title}><span><Icon /></span><h3>{title}</h3><p>{desc}</p></article>)}
        </div>
      </section>

      <section className="slh-platforms">
        <div><small>For companies & platforms</small><h2>Havlo is a property intelligence company, not a single-purpose tool</h2><p>Havlo Stale Listing is a property intelligence, not a single-purpose tool</p><Link to="/stale-listings/partnerships">Talk to Us about partnering</Link></div>
        <ul>{platformItems.map(({ title, desc }) => <li key={title}><b>{title}</b><span>— {desc}</span></li>)}</ul>
      </section>

      <section id="reviews" className="slh-reviews">
        <small>Reviews</small>
        <h2>What agents and sellers say</h2>
        <div className="slh-marquee">
          <div className="slh-marquee-track">
            {reviews.map(({ quote, role, tag }) => <article key={quote}><ReviewStars /><b>{role}</b><p>"{quote}"</p><small>{tag}</small></article>)}
            {reviews.map(({ quote, role, tag }) => <article key={`${quote}-dup`} className="slh-dup" aria-hidden="true"><ReviewStars /><b>{role}</b><p>"{quote}"</p><small>{tag}</small></article>)}
          </div>
        </div>
      </section>

      <section className="slh-cta"><span><i />Ready when you are</span><h2>Get your listing moving again</h2><p>Whether you're managing 100 instructions or watching one listing go quiet, Havlo Stale Listings gives you a clear, specific reason it's stuck — and what to do next.</p><Link to="/stale-listings/agents">Get Started - Agents</Link><Link to="/stale-listings/seller">Get Started - Sellers</Link></section>

      <footer className="slh-footer">
        <Link to="/stale-listings" className="slh-logo" aria-label="Stale Listings by Havlo">
          <StaleListingsLogo className="slh-footer-logo" />
        </Link>
        <p>&copy; 2026 Havlo. UK property intelligence, in partnership with agents, sellers, and platforms.</p>
        <a href="mailto:partnerships@heyhavlo.com">partnerships@heyhavlo.com</a>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');
        .slh-page{font-family:'Inter','Plus Jakarta Sans',sans-serif;color:#090909;background:#fff}
        .slh-problem-copy small,.slh-method>.slh-section-head>small,.slh-platforms>div>small,.slh-reviews>small{font-family:'Instrument Sans',sans-serif;font-weight:600;font-size:20px;line-height:110%;letter-spacing:-0.05em}
        .slh-header{height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 11%;border-bottom:1px solid #eee;background:#fff}
        .slh-logo{display:inline-flex;align-items:center;color:#222;text-decoration:none}
        .slh-logo-mark{height:50px;width:auto;display:block}
        .slh-nav{display:flex;align-items:center;gap:34px;font-family:'Inter',sans-serif;font-weight:500;font-size:16px;line-height:150%;letter-spacing:-.02em;text-align:center}
        .slh-nav a{color:#111;text-decoration:none;white-space:nowrap}
        .slh-nav-btn{padding:12px 22px;border:1px solid #ddd;border-radius:8px}
        .slh-nav-btn--dark{background:#000!important;color:#fff!important}
        .slh-menu{display:none;width:36px;height:36px;background:none;border:0;padding:6px}
        .slh-menu span{display:block;height:2px;background:#111;margin:6px 0;border-radius:4px}
        .slh-hero{display:grid;grid-template-columns:minmax(0,1fr) 600px;gap:80px;align-items:center;padding:80px 11%;background:linear-gradient(110deg,#fff 30%,#fff1fb)}
        .slh-hero h1{font-family:'Right Grotesk','Arial Black','Inter',sans-serif;font-size:64px;line-height:1.1;font-weight:900;letter-spacing:-.02em;max-width:600px;margin:0}
        .slh-hero h1 span{color:#a900d8}
        .slh-hero-copy>p{max-width:610px;font-family:'Inter',sans-serif;font-weight:400;font-size:16px;line-height:150%;letter-spacing:-.02em;margin:12px 0 0}
        .slh-hero-actions{display:flex;gap:16px;margin:32px 0}
        .slh-hero-actions a,.slh-code-form button,.slh-platforms a,.slh-cta a{background:#000;color:#fff;text-decoration:none;border:0;border-radius:8px;padding:14px 22px;font-weight:850}
        .slh-hero-actions a+ a,.slh-cta a+ a{background:#fff;color:#000;border:1px solid #ddd}
        .slh-code-form{max-width:420px;margin-top:8px;padding-top:20px;border-top:1px solid rgba(9,9,9,.08)}
        .slh-code-form label{display:block;font-weight:700;font-size:12px;color:#6b6b70;letter-spacing:.01em;margin-bottom:8px}
        .slh-code-form div{display:flex;background:#f7f5f9;border:1px solid #ece7f2;border-radius:10px;padding:5px}
        .slh-code-form input{flex:1;border:0;background:transparent;padding:0 12px;font-size:14px;outline:0}
        .slh-code-form button{padding:9px 16px;font-size:13px;border-radius:7px;font-weight:800}
        .slh-badges{display:flex;gap:28px;margin-top:28px}
        .slh-badges span{display:flex;align-items:flex-start;gap:10px}
        .slh-badges b{font-weight:900;color:#a900d8;font-size:14px}
        .slh-badges small{display:block;color:#111;font-weight:500;font-size:11px;margin-top:3px}
        .slh-customer{width:600px;height:600px;object-fit:cover;filter:drop-shadow(0 18px 40px rgba(145,0,190,.18))}
        .slh-featured{background:#5d006c;color:#fff;text-align:center;padding:32px 8% 38px}
        .slh-featured p{margin:0 0 22px;font-size:11px;font-weight:800;letter-spacing:.08em;color:#f4d9fb}
        .slh-featured .slh-marquee-track{display:flex;align-items:center;justify-content:center;gap:58px}
        .slh-featured img{height:29px;max-width:190px;filter:brightness(0) invert(1)}
        .slh-brands{text-align:center;padding:36px 8%;background:#fff}
        .slh-brands p{font-size:12px;color:#9a9a9a;font-weight:800;letter-spacing:.12em;margin:0 0 26px}
        .slh-brands .slh-marquee-track{display:flex;align-items:center;justify-content:center;gap:48px;flex-wrap:wrap}
        .slh-brands img{max-height:46px;max-width:170px;filter:grayscale(1);opacity:.72}
        .slh-brands img.slh-invert{filter:grayscale(1) invert(1);opacity:.72}
        .slh-dup{display:none}
        @keyframes slh-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .slh-problem{display:grid;grid-template-columns:558px 558px;justify-content:center;gap:92px;align-items:center;background:radial-gradient(circle at 66% 44%,rgba(200,0,224,.62),transparent 44%),radial-gradient(circle at 70% 40%,rgba(255,255,255,.10),transparent 16%),#050507;color:#fff;padding:98px 11%}
        .slh-problem-copy small{color:#fff}
        .slh-method>.slh-section-head>small,.slh-platforms>div>small,.slh-reviews>small{color:#5b6472}
        .slh-problem h2{font-family:'Right Grotesk','Arial Black','Inter',sans-serif;font-size:42px;line-height:1.07;font-weight:900;letter-spacing:-.02em;max-width:530px;margin:26px 0 28px}
        .slh-problem-copy>p{max-width:575px;color:#fff;font-size:18px;line-height:1.5;margin:0 0 30px}
        .slh-problem ul{list-style:none;margin:0;padding:0;max-width:560px}
        .slh-problem li{position:relative;color:#fff;line-height:1.45;padding:26px 0 26px 38px;border-bottom:1px solid rgba(255,255,255,.12)}
        .slh-problem li:before{content:'';position:absolute;left:0;top:34px;width:10px;height:10px;border-radius:50%;background:#b400e7}
        .slh-approach{width:558px;height:558px;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;background:#fff;color:#111;border-radius:32px;padding:44px;box-shadow:0 0 0 14px rgba(237,231,255,.9),0 40px 100px rgba(196,0,224,.5)}
        .slh-approach span{display:inline-flex;align-items:center;gap:7px;background:#fff2ff;color:#7f008d;border-radius:999px;padding:8px 15px;font-size:15px;font-weight:600;flex-shrink:0}
        .slh-approach span i{width:10px;height:10px;background:#b400e7;border-radius:50%;display:inline-block}
        .slh-approach h3{font-size:24px;line-height:1.2;margin:22px 0 12px;flex-shrink:0}
        .slh-approach>p{color:#222;font-size:15.5px;line-height:1.52;margin:0;flex-shrink:0}
        .slh-approach div{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:24px;flex-shrink:0}
        .slh-approach article{background:#fbf0ff;border-radius:13px;padding:17px}
        .slh-approach b{display:block;color:#b400e7;font-size:16px;margin-bottom:8px}
        .slh-approach article p{color:#4f5667;font-size:13.5px;line-height:1.45;margin:0;font-weight:600}
        .slh-method{padding:86px 11%}
        .slh-section-head{display:grid;grid-template-columns:1fr 1fr;gap:14px 80px;align-items:end}
        .slh-section-head small{grid-column:1/-1}
        .slh-section-head h2,.slh-platforms h2,.slh-reviews h2{font-family:'Right Grotesk','Arial Black','Inter',sans-serif;font-size:34px;line-height:1.05;font-weight:900;letter-spacing:-.03em}
        .slh-section-head p{color:#3b4150;line-height:1.6}
        .slh-method-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:52px}
        .slh-method-grid article{border:1px solid #f3bfff;border-radius:12px;padding:28px;min-height:220px}
        .slh-method-grid span{display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:#f7ecff;margin-bottom:18px}
        .slh-method-grid p{color:#555}
        .slh-platforms{display:grid;grid-template-columns:1fr 1fr;gap:80px;padding:60px 11% 90px;align-items:center}
        .slh-platforms>div>small{display:block;margin:0 0 16px}
        .slh-platforms>div>h2{margin:0 0 20px}
        .slh-platforms>div>p{margin:0 0 32px;color:#333;font-size:16px;line-height:1.5}
        .slh-platforms ul{background:#fafafa;border-radius:20px;padding:24px;list-style:none}
        .slh-platforms li{position:relative;border-bottom:1px solid #e3e3e3;padding:20px 0 20px 22px}
        .slh-platforms li:last-child{border-bottom:0}
        .slh-platforms li:before{content:'';position:absolute;left:0;top:26px;width:7px;height:7px;border-radius:50%;background:#b400e7}
        .slh-platforms li b{display:block}
        .slh-platforms li span{display:block;color:#555;margin-top:6px}
        .slh-reviews{padding:70px 11%;overflow:hidden}
        .slh-reviews .slh-marquee{margin-top:30px}
        .slh-reviews .slh-marquee-track{display:grid;grid-template-columns:repeat(3,minmax(260px,1fr));gap:28px}
        .slh-reviews article{display:flex;flex-direction:column;background:#f4f6f8;border-radius:10px;padding:24px;min-height:308px}
        .slh-reviews article.slh-dup{display:none}
        .slh-reviews article b{display:block;margin-top:14px;font-size:15px}
        .slh-reviews article p{flex:1;margin:10px 0 0;line-height:1.5;color:#1c1c1c}
        .slh-reviews article small{display:block;margin-top:16px;font-weight:800;color:#12123a;font-size:13px}
        .slh-cta{margin:70px auto;max-width:1120px;background-color:#670075;background-image:url("/stale-cta-bg.png");background-blend-mode:overlay;background-size:cover;background-position:center;color:#fff;text-align:center;border-radius:22px;padding:46px 24px}
        .slh-cta h2{font-size:36px;margin:8px 0}
        .slh-cta p{max-width:620px;margin:0 auto 40px}
        .slh-cta span{display:inline-flex;align-items:center;gap:7px;background:#fff;color:#5c0067;border-radius:999px;padding:8px 16px;font-weight:700;font-size:13px}
        .slh-cta span i{width:8px;height:8px;background:#b400e7;border-radius:50%;display:inline-block}
        .slh-cta a{background:#fff;color:#3a0142;border:0}
        .slh-cta a+a{margin-left:16px;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.7)}
        .slh-footer{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:34px 11%;font-size:13px}
        .slh-footer-logo{height:42px;width:auto;display:block}
        .slh-footer a:last-child{color:#111;text-decoration:none;border:1px solid #ddd;border-radius:8px;padding:10px 14px}
        @media(max-width:1100px){.slh-hero,.slh-problem{grid-template-columns:1fr;gap:42px}.slh-customer{width:100%;height:auto;max-width:480px}.slh-featured div{gap:28px}.slh-featured img{height:23px}.slh-brands div{gap:30px}}
        @media(max-width:900px){.slh-header{padding:0 18px}.slh-logo-mark{height:34px}.slh-nav{display:none}.slh-menu{display:block}.slh-hero{display:flex;flex-direction:column;padding:34px 18px;gap:24px}.slh-hero h1{font-size:40px}.slh-hero-actions{display:grid;gap:10px}.slh-hero-actions a{text-align:center}.slh-badges{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.slh-badges span{gap:6px}.slh-badges svg{width:18px;height:18px;flex-shrink:0}.slh-badges b{font-size:12px}.slh-badges small{font-size:10px}.slh-code-form div{display:grid}.slh-code-form button{margin-top:8px}.slh-featured{overflow:hidden}.slh-marquee{overflow:hidden}.slh-dup{display:block}.slh-featured .slh-marquee-track{flex-wrap:nowrap;justify-content:flex-start;width:max-content;gap:32px;animation:slh-marquee 18s linear infinite}.slh-featured img{height:20px}.slh-brands .slh-marquee-track{flex-wrap:nowrap;justify-content:flex-start;width:max-content;gap:28px;animation:slh-marquee 22s linear infinite}.slh-brands img{max-height:32px;max-width:130px}.slh-problem,.slh-section-head,.slh-platforms{display:block;padding:52px 18px}.slh-problem h2,.slh-section-head h2,.slh-platforms h2,.slh-reviews h2,.slh-cta h2{font-size:28px}.slh-section-head h2{margin:20px 0 20px}.slh-problem-copy>p{font-size:16px}.slh-approach{width:100%;height:auto;margin-top:34px;padding:28px;border-radius:24px;box-shadow:0 0 0 9px rgba(237,231,255,.9),0 24px 60px rgba(196,0,224,.45)}.slh-approach div{grid-template-columns:1fr}.slh-method{padding:48px 18px}.slh-method-grid{grid-template-columns:1fr;margin-top:0}.slh-reviews{overflow:hidden}.slh-reviews article.slh-dup{display:flex}.slh-reviews .slh-marquee-track{display:flex;flex-wrap:nowrap;justify-content:flex-start;width:max-content;gap:16px;animation:slh-marquee 26s linear infinite}.slh-reviews article{flex:0 0 260px;width:260px;min-height:270px}.slh-platforms ul{margin-top:24px}.slh-cta{margin:42px 18px}.slh-cta a{display:block;width:100%;box-sizing:border-box;margin:12px auto 0}.slh-cta a+a{margin-left:auto}.slh-footer{display:grid;text-align:center;justify-items:center}}
      `}</style>
    </div>
  );
};

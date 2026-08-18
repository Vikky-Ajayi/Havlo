import { Link } from 'react-router-dom';
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

const workWith = [
  { title: 'Estate agent groups & chains', desc: "Roll the Index out across every branch's book at once — not just the listings one agent happens to flag manually." },
  { title: 'Property portals & marketplaces', desc: 'Licence Index scoring as a stale-listing signal, or offer it as a premium feature layer on top of listings you already host.' },
  { title: 'Proptech & CRM platforms', desc: 'Embed scoring and recommendations directly into the tools agents already use every day, instead of sending them elsewhere.' },
  { title: 'Lenders, surveyors & valuers', desc: 'Use listing-health scoring as an additional signal alongside valuation and risk data you already collect.' },
  { title: 'Housebuilders & developers', desc: 'Diagnose why show homes or unsold plots have stalled, using the same model built for the resale market.' },
  { title: 'Investment & asset managers', desc: 'Monitor listing performance across a portfolio and flag underperforming assets before they sit for months.' },
];

const steps = [
  { title: 'Integrate', desc: 'Connect via API, a scheduled data handoff, or a simple manual upload — start with whichever fits your stack, no major engineering lift required.' },
  { title: 'Brand it', desc: "Your logo, your colours, your domain on every score, report, and dashboard your customers see. The Havlo name doesn't have to appear anywhere." },
  { title: 'Scale it', desc: 'Roll the Index out across your full book, portfolio, or platform — priced to match your volume, with reporting cadence built around how you work.' },
];

const shapes = [
  { label: 'DATA LICENSING', title: 'API access to the Index', desc: 'Pull scores and diagnostics directly into your own systems, priced by volume or by seat.' },
  { label: 'WHITE-LABEL', title: 'Fully branded reporting', desc: 'We run the assessment; your brand delivers it. Your customers never see Havlo.' },
  { label: 'EMBEDDED FEATURE', title: 'Built into your platform', desc: 'Scoring and recommendations surface natively inside the CRM or portal your customers already use.' },
  { label: 'REFERRAL', title: 'Send us your stale listings', desc: 'Point your customers to Havlo directly and we handle delivery — a lighter-lift way to start.' },
];

export const StaleListingsPartnerships = () => (
  <div className="slp-page">
    <header className="slp-header">
      <Link className="slp-logo" to="/stale-listings"><StaleListingsLogo className="slp-logo-mark" /></Link>
      <nav><a href="#work">Who we work with</a><a href="#white">White-label</a><a href="#how">How it works</a><a className="dark" href="mailto:partnerships@heyhavlo.com">Make an Enquiry</a><a href="mailto:partnerships@heyhavlo.com">Book a Demo</a></nav>
      <button aria-label="Open navigation menu">☰</button>
    </header>

    <section className="slp-hero">
      <div>
        <span>Havlo for business</span>
        <h1>Property intelligence, built to plug into your business.</h1>
        <p>The Havlo Index — our proprietary stale-listing scoring model — is built to run inside other people's platforms, not just on our own site. Licence it, embed it, or put your name on it entirely.</p>
        <div><a href="mailto:partnerships@heyhavlo.com">Make an Enquiry</a><a href="mailto:partnerships@heyhavlo.com">Book a Demo</a></div>
      </div>
      <img src="/stale-partnership-network.png" alt="Havlo network" />
    </section>

    <section className="slp-trust">
      <p>ALREADY TRUSTED BY INDEPENDENT AGENTS INSIDE MAJOR UK ESTATE CHAINS</p>
      <div className="slp-marquee">
        <div className="slp-marquee-track">
          {brandLogos.map((item) => <img key={item.alt} src={item.src} alt={item.alt} className={item.invert ? 'slp-invert' : undefined} />)}
          {brandLogos.map((item) => <img key={`${item.alt}-dup`} src={item.src} alt="" aria-hidden="true" className={item.invert ? 'slp-dup slp-invert' : 'slp-dup'} />)}
        </div>
      </div>
    </section>

    <section className="slp-media">
      <p>AS FEATURED IN</p>
      <div className="slp-marquee">
        <div className="slp-marquee-track">
          {pressLogos.map((item) => <img key={item.alt} src={item.src} alt={item.alt} />)}
          {pressLogos.map((item) => <img key={`${item.alt}-dup`} className="slp-dup" src={item.src} alt="" aria-hidden="true" />)}
        </div>
      </div>
    </section>

    <section id="work" className="slp-work">
      <div className="slp-head">
        <div><small>Who we work with</small><h2>Every kind of real estate business runs into stale listings somewhere</h2></div>
        <p>The Havlo Index doesn't care whether the listing came from a single branch or a national portfolio. It's built to work at whatever scale your business operates at.</p>
      </div>
      <div className="slp-grid">
        {workWith.map(({ title, desc }, index) => (
          <article key={title}><span>{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{desc}</p></article>
        ))}
      </div>
    </section>

    <section id="white" className="slp-white">
      <small><i />White-label</small>
      <div><h2>Put your name on it — the Index runs underneath, invisibly</h2><p>Every report, score, and recommendation can be delivered under your brand, not ours. Your customers see your platform; Havlo just does the work behind it.</p></div>
      <div className="slp-steps">
        {steps.map(({ title, desc }, index) => (
          <article key={title}><span>Step 0{index + 1}</span><h3>{title}</h3><p>{desc}</p></article>
        ))}
      </div>
      <p className="slp-note">White-label terms depend on volume and integration depth — from a co-branded report template through to a fully embedded, API-only version customers never know isn't yours. We'll scope this with you directly on a call.</p>
    </section>

    <section id="how" className="slp-shapes">
      <div>
        <small>Ways to work together</small>
        <h2>A few common shapes this takes</h2>
        <p>Every partnership starts as a conversation, not a fixed package — but most land in one of these.</p>
      </div>
      <ul>
        {shapes.map(({ label, title, desc }) => (
          <li key={title}><span>•</span><div><b>{label}</b><h3>{title}</h3><p>{desc}</p></div></li>
        ))}
      </ul>
    </section>

    <section className="slp-cta">
      <span><i />Let's talk</span>
      <h2>Tell us about your business — we'll figure out the shape together</h2>
      <p>Whether you want a 20-minute walkthrough of the Index or you're ready to scope a white-label integration, this starts as a conversation.</p>
      <div className="slp-cta-actions"><a href="mailto:partnerships@heyhavlo.com">Book Demo</a><a href="mailto:partnerships@heyhavlo.com">Make an Inquiry</a></div>
      <small>Prefer email? Reach us directly at <a href="mailto:partnerships@heyhavlo.com">partnerships@heyhavlo.com</a></small>
    </section>

    <footer>
      <Link className="slp-logo" to="/stale-listings"><StaleListingsLogo className="slp-footer-logo" /></Link>
      <p>&copy; 2026 Havlo. UK property intelligence, in partnership with agents, sellers, and platforms.</p>
      <a href="mailto:partnerships@heyhavlo.com">partnerships@heyhavlo.com</a>
    </footer>

    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');
      .slp-page{font-family:'Inter','Plus Jakarta Sans',sans-serif;color:#0b0b0b;background:#fff}
      .slp-header{height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 11%;border-bottom:1px solid #eee}
      .slp-logo{display:inline-flex;align-items:center;text-decoration:none}
      .slp-logo-mark{height:50px;width:auto;display:block}
      .slp-footer-logo{height:42px;width:auto;display:block}
      .slp-header nav{display:flex;gap:32px;align-items:center;font-family:'Inter',sans-serif;font-weight:500;font-size:16px;line-height:150%;letter-spacing:-.02em}
      .slp-header a{color:#111;text-decoration:none}
      .slp-header nav a{padding:10px 14px;border-radius:8px}
      .slp-header .dark,.slp-hero a:first-child{background:#000;color:#fff}
      .slp-header button{display:none;background:0;border:0;font-size:24px}
      .slp-hero{display:grid;grid-template-columns:1fr 460px;gap:96px;align-items:center;padding:95px 11%;background:linear-gradient(105deg,#fff 34%,#ffeffc)}
      .slp-hero span{display:inline-block;background:#feeefe;color:#b100e6;font-weight:700;font-size:13px;border-radius:999px;padding:8px 14px}
      .slp-hero h1,.slp-work h2,.slp-white h2,.slp-shapes h2{font-family:'Right Grotesk','Arial Black','Inter',sans-serif;font-size:48px;line-height:1.02;letter-spacing:-.03em;font-weight:900;margin:16px 0}
      .slp-hero p,.slp-work p,.slp-shapes p{line-height:1.55;color:#222}
      .slp-hero p{margin:0 0 48px}
      .slp-hero a,.slp-cta-actions a{display:inline-block;text-decoration:none;color:#111;border:1px solid #ddd;border-radius:8px;padding:12px 18px;font-weight:800;margin-right:12px}
      .slp-hero img{width:100%;border-radius:22px}
      .slp-trust{text-align:center;padding:34px 8%;overflow:hidden}
      .slp-trust p{font-size:11px;color:#777;font-weight:900;letter-spacing:.08em;margin:0 0 22px}
      .slp-media{background:#000;color:#fff;text-align:center;padding:34px 8%;overflow:hidden}
      .slp-media p{font-size:11px;color:#bbb;font-weight:800;letter-spacing:.08em;margin:0 0 22px}
      .slp-marquee{overflow:hidden}
      .slp-marquee-track{display:flex;align-items:center;justify-content:center;gap:48px;flex-wrap:wrap}
      .slp-trust .slp-marquee-track img{max-height:46px;max-width:170px;filter:grayscale(1);opacity:.72}
      .slp-trust .slp-marquee-track img.slp-invert{filter:grayscale(1) invert(1);opacity:.72}
      .slp-media .slp-marquee-track{gap:58px;flex-wrap:nowrap}
      .slp-media .slp-marquee-track img{height:29px;max-width:190px;filter:brightness(0) invert(1)}
      .slp-dup{display:none}
      @keyframes slp-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
      .slp-work,.slp-shapes{padding:90px 11%}
      .slp-head{display:grid;grid-template-columns:1fr 1fr;gap:90px;align-items:end}
      .slp-head>div>small{font-family:'Instrument Sans',sans-serif;font-weight:600;font-size:20px;line-height:110%;letter-spacing:-.05em;color:#5b6472;display:block;margin-bottom:6px}
      .slp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:45px}
      .slp-grid article{border:1px solid #f0b8ee;border-radius:10px;padding:28px;min-height:190px}
      .slp-grid span{color:#8e98a8;font-weight:900;font-size:22px}
      .slp-grid h3{margin:14px 0 8px;font-size:18px}
      .slp-grid p{font-size:14px;color:#4b5563;line-height:1.5}
      .slp-white{position:relative;margin:50px 11%;background-color:#610073;color:#fff;border-radius:18px;padding:44px}
      .slp-white>small{display:inline-flex;align-items:center;gap:7px;background:#7a188a;color:#fff;font-family:'Inter',sans-serif;font-weight:600;font-size:14px;border-radius:999px;padding:8px 15px}
      .slp-white>small>i{width:8px;height:8px;background:#fff;border-radius:50%;display:inline-block}
      .slp-white>div:first-of-type{display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-top:20px}
      .slp-white h2{font-size:34px;margin:0 0 12px}
      .slp-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:34px}
      .slp-steps article{background:rgba(255,255,255,.12);border-radius:16px;padding:26px}
      .slp-steps span{font-weight:700;font-size:13px;opacity:.85}
      .slp-steps h3{margin:12px 0 10px;font-size:20px}
      .slp-steps p{font-size:14px;line-height:1.5;color:#f0dff5}
      .slp-note{border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:16px;margin-top:20px;font-size:14px;line-height:1.5;color:#f0dff5}
      .slp-shapes{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:start}
      .slp-shapes>div>small{font-family:'Instrument Sans',sans-serif;font-weight:600;font-size:20px;line-height:110%;letter-spacing:-.05em;color:#5b6472;display:block;margin-bottom:6px}
      .slp-shapes>div>h2{margin:0 0 16px}
      .slp-shapes>div>p{margin:0;max-width:420px}
      .slp-shapes ul{list-style:none;margin:0;padding:16px;background:#fafafa;border-radius:20px}
      .slp-shapes li{display:grid;grid-template-columns:20px 1fr;background:#fff;border-radius:14px;padding:22px;margin-bottom:14px}
      .slp-shapes li:last-child{margin-bottom:0}
      .slp-shapes li span{color:#b100e6;font-size:22px;line-height:1}
      .slp-shapes li b{display:block;color:#b100e6;font-weight:800;font-size:12px;letter-spacing:.06em;margin-bottom:6px}
      .slp-shapes li h3{margin:0 0 6px;font-size:17px}
      .slp-shapes li p{color:#555;margin:0;line-height:1.5}
      .slp-cta{position:relative;margin:70px auto;max-width:1120px;background-color:#050505;background-image:linear-gradient(rgba(5,5,5,.78),rgba(5,5,5,.78)),url("/stale-cta-bg.png");background-size:cover;background-position:center;color:#fff;text-align:center;border-radius:18px;padding:46px 24px}
      .slp-cta span{display:inline-flex;align-items:center;gap:7px;background:#fff;color:#b100e6;font-weight:700;font-size:13px;border-radius:999px;padding:8px 16px}
      .slp-cta span i{width:8px;height:8px;background:#b100e6;border-radius:50%;display:inline-block}
      .slp-cta h2{font-size:33px;max-width:760px;margin:16px auto}
      .slp-cta-actions{margin-top:8px}
      .slp-cta-actions a:first-of-type{background:#fff;color:#000}
      .slp-cta-actions a:last-of-type{color:#fff}
      .slp-cta>small{display:block;margin-top:20px;font-size:13px;color:#cfc7d2}
      .slp-cta>small a{color:#fff;text-decoration:underline}
      .slp-page footer{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:34px 11%;font-size:13px}
      .slp-page footer a:last-child{color:#111;text-decoration:none;border:1px solid #ddd;border-radius:8px;padding:10px 14px}
      @media(max-width:900px){
        .slp-header{padding:0 18px}
        .slp-logo-mark{height:34px}
        .slp-header nav{display:none}
        .slp-header button{display:block}
        .slp-hero{display:flex;flex-direction:column;padding:40px 18px;gap:26px}
        .slp-hero h1,.slp-work h2,.slp-shapes h2{font-size:35px}
        .slp-trust .slp-marquee-track,.slp-media .slp-marquee-track{flex-wrap:nowrap;justify-content:flex-start;width:max-content;animation:slp-marquee 22s linear infinite}
        .slp-dup{display:block}
        .slp-head,.slp-white>div:first-of-type{display:block}
        .slp-head>div>small{margin-bottom:10px}
        .slp-work,.slp-shapes{padding:52px 18px}
        .slp-shapes{display:block}
        .slp-shapes>div>p{max-width:100%}
        .slp-shapes ul{margin-top:24px}
        .slp-grid,.slp-steps{grid-template-columns:1fr}
        .slp-white{margin:28px 18px;padding:26px}
        .slp-white h2{font-size:28px}
        .slp-cta-actions a{display:block;width:100%;box-sizing:border-box;margin:10px 0 0}
        .slp-cta-actions a:first-of-type{margin-top:0}
        .slp-page footer{display:grid;text-align:center;justify-items:center}
        .slp-cta{margin:46px 18px}
      }
    `}</style>
  </div>
);

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
  { alt: 'Hamptons', src: '/brand-logos/hamptons.png' },
  { alt: 'Belvoir', src: '/brand-logos/belvoir.svg' },
  { alt: 'Yopa', src: '/brand-logos/yopa.svg' },
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
            <span>Human Verified<small>Every listing reviewed</small></span>
            <span>Proprietary scoring<small>The Havlo Index</small></span>
            <span>Actionable plans<small>Get listings moving again</small></span>
          </div>
        </div>
        <img className="slh-customer" src="/stale-home-customer.png" alt="Reassessed Stale Listing example" />
      </section>

      <section className="slh-featured" aria-label="As featured in">
        <p>AS FEATURED IN</p>
        <div>
          {pressLogos.map((item) => <img key={item.alt} src={item.src} alt={item.alt} />)}
        </div>
      </section>

      <section className="slh-brands" aria-label="Supported real estate brands">
        <p>WE'VE SUPPORTED AGENTS AFFILIATED WITH LEADING REAL ESTATE BRANDS</p>
        <div>
          {brandLogos.map((item) => <img key={item.alt} src={item.src} alt={item.alt} />)}
        </div>
      </section>

      <section className="slh-problem">
        <div className="slh-problem-copy">
          <small>The Problem</small>
          <h2>The portals show buyers exactly how long you've been stuck</h2>
          <p>Rightmove and Zoopla both display days-on-market by default. Once that number climbs, buyers start asking why before they've even booked a viewing.</p>
          <ul>
            <li>The listing itself often isn't the real problem, price positioning, photo order, and description usually are.</li>
            <li>Agents rarely have time to re-audit every listing that's gone quiet while they're managing new instructions.</li>
            <li>Sellers are told to "just wait" or "drop the price" with no real diagnosis of what's actually wrong.</li>
          </ul>
        </div>
        <div className="slh-approach">
          <span><i />Our approach</span>
          <h3>A proprietary model, not a public checklist.</h3>
          <p>Havlo scores every listing against the Havlo Index, a weighted model we've built and refined in-house across every stale listing we've assessed. It's not a generic portal score anyone can look up: the weightings, thresholds, and pattern library are ours, tuned on real UK sale outcomes. A Havlo reviewer then checks the Index output against the actual listing and turns it into a short, actionable plan.</p>
          <div>
            <article>
              <b>DATA INTELLIGENCE</b>
              <p>Comparable sales, portal engagement, price-drop history, and time-on-market benchmarks, scored against the Havlo Index rather than a single public metric.</p>
            </article>
            <article>
              <b>HUMAN REVIEW</b>
              <p>A reviewer cross-checks the Index score using our own in-house developed listing metrics, then confirms the actual, implementable fix, not just a flag.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="methodology" className="slh-method">
        <div className="slh-section-head">
          <small>Methodology</small>
          <h2>The Havlo Index: three passes, one proprietary model</h2>
          <p>Three interlocking stages: raw signal is weighted into a scored diagnosis, then stress-tested by human review before a plan reaches you.</p>
        </div>
        <div className="slh-method-grid">
          {['Signal capture', 'Human review, in-house metrics', 'The fix'].map((title) => <article key={title}><span>○</span><h3>{title}</h3><p>We combine portal context, comparable activity, buyer behaviour and human review into one practical recovery plan.</p></article>)}
        </div>
      </section>

      <section className="slh-platforms">
        <div><small>For companies & platforms</small><h2>Havlo is a property intelligence company, not a single-purpose tool</h2><p>Havlo Stale Listing is a property intelligence layer that can work with agents, portals, lenders and CRM platforms.</p><Link to="/stale-listings/partnerships">Talk to us about partnering</Link></div>
        <ul>{['Portals & marketplaces', 'Estate agent groups', 'Proptech & CRM platforms', 'Lenders & surveyors'].map((item) => <li key={item}><b>{item}</b><span>Use listing-health scoring as an additional signal alongside your existing data.</span></li>)}</ul>
      </section>

      <section id="reviews" className="slh-reviews">
        <small>Reviews</small>
        <h2>What agents and sellers say</h2>
        <div>{['Had a listing sat at 11 weeks. The report told us the price was fine, it was the lead photo.', "Didn't expect a person to actually look at our listing rather than just spitting out a score.", "The tool helped us tell vendors why buyers weren't booking viewings."].map((quote) => <article key={quote}><div>★★★★★</div><p>"{quote}"</p><b>Independent agent</b></article>)}</div>
      </section>

      <section className="slh-cta"><span>Ready when you are</span><h2>Get your listing moving again</h2><p>Whether you're managing 100 instructions or watching one listing go quiet, Havlo gives you a clear reason it's stuck and what to do next.</p><Link to="/stale-listings/agents">Get Started - Agents</Link><Link to="/stale-listings/seller">Get Started - Sellers</Link></section>

      <footer className="slh-footer">
        <Link to="/stale-listings" className="slh-logo" aria-label="Stale Listings by Havlo">
          <StaleListingsLogo className="slh-footer-logo" />
        </Link>
        <p>&copy; 2026 Havlo. UK property intelligence, in partnership with agents, sellers, and platforms.</p>
        <a href="mailto:partnerships@heyhavlo.com">partnerships@heyhavlo.com</a>
      </footer>

      <style>{`
        .slh-page{font-family:'Inter','Plus Jakarta Sans',sans-serif;color:#090909;background:#fff}
        .slh-header{height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 11%;border-bottom:1px solid #eee;background:#fff}
        .slh-logo{display:inline-flex;align-items:center;color:#222;text-decoration:none}
        .slh-logo-mark{height:42px;width:auto;display:block}
        .slh-nav{display:flex;align-items:center;gap:34px;font-family:'Inter',sans-serif;font-weight:500;font-size:16px;line-height:150%;letter-spacing:-.02em;text-align:center}
        .slh-nav a{color:#111;text-decoration:none;white-space:nowrap}
        .slh-nav-btn{padding:12px 22px;border:1px solid #ddd;border-radius:8px}
        .slh-nav-btn--dark{background:#000!important;color:#fff!important}
        .slh-menu{display:none;width:36px;height:36px;background:none;border:0;padding:6px}
        .slh-menu span{display:block;height:2px;background:#111;margin:6px 0;border-radius:4px}
        .slh-hero{display:grid;grid-template-columns:minmax(0,1fr) 430px;gap:80px;align-items:center;padding:80px 11%;background:linear-gradient(110deg,#fff 30%,#fff1fb)}
        .slh-hero h1{font-family:'Right Grotesk','Arial Black','Inter',sans-serif;font-size:64px;line-height:1.1;font-weight:900;letter-spacing:-.02em;max-width:600px;margin:0}
        .slh-hero h1 span{color:#a900d8}
        .slh-hero-copy>p{max-width:610px;font-family:'Inter',sans-serif;font-weight:400;font-size:16px;line-height:150%;letter-spacing:-.02em;margin:12px 0 0}
        .slh-hero-actions{display:flex;gap:16px;margin:32px 0}
        .slh-hero-actions a,.slh-code-form button,.slh-platforms a,.slh-cta a{background:#000;color:#fff;text-decoration:none;border:0;border-radius:8px;padding:14px 22px;font-weight:850}
        .slh-hero-actions a+ a,.slh-cta a+ a{background:#fff;color:#000;border:1px solid #ddd}
        .slh-code-form{max-width:560px}
        .slh-code-form label{font-weight:900;font-size:13px}
        .slh-code-form div{display:flex;margin-top:8px;background:#f4f4f6;border-radius:14px;padding:6px}
        .slh-code-form input{flex:1;border:0;background:transparent;padding:0 14px;font-size:16px;outline:0}
        .slh-badges{display:flex;gap:28px;margin-top:28px}
        .slh-badges span{font-weight:900;color:#a900d8}
        .slh-badges small{display:block;color:#111;font-size:11px;margin-top:3px}
        .slh-customer{width:100%;filter:drop-shadow(0 18px 40px rgba(145,0,190,.18))}
        .slh-featured{background:#5d006c;color:#fff;text-align:center;padding:32px 8% 38px}
        .slh-featured p{margin:0 0 22px;font-size:11px;font-weight:800;letter-spacing:.08em;color:#f4d9fb}
        .slh-featured div{display:flex;align-items:center;justify-content:center;gap:58px}
        .slh-featured img{height:29px;max-width:190px;filter:brightness(0) invert(1)}
        .slh-brands{text-align:center;padding:36px 8%;background:#fff}
        .slh-brands p{font-size:12px;color:#9a9a9a;font-weight:800;letter-spacing:.12em;margin:0 0 26px}
        .slh-brands div{display:flex;align-items:center;justify-content:center;gap:48px;flex-wrap:wrap}
        .slh-brands img{max-height:46px;max-width:170px;filter:grayscale(1);opacity:.72}
        .slh-problem{display:grid;grid-template-columns:minmax(0,1fr) 560px;gap:92px;align-items:center;background:radial-gradient(circle at 68% 45%,rgba(117,31,94,.58),transparent 30%),#050507;color:#fff;padding:98px 11%}
        .slh-problem-copy small,.slh-method small,.slh-platforms small,.slh-reviews small,.slh-cta span{color:#b400e7;font-weight:900}
        .slh-problem h2{font-family:'Right Grotesk','Arial Black','Inter',sans-serif;font-size:42px;line-height:1.07;font-weight:900;letter-spacing:-.02em;max-width:530px;margin:26px 0 28px}
        .slh-problem-copy>p{max-width:575px;color:#fff;font-size:18px;line-height:1.5;margin:0 0 30px}
        .slh-problem ul{list-style:none;margin:0;padding:0;max-width:560px}
        .slh-problem li{position:relative;color:#fff;line-height:1.45;padding:26px 0 26px 38px;border-bottom:1px solid rgba(255,255,255,.12)}
        .slh-problem li:before{content:'';position:absolute;left:0;top:34px;width:10px;height:10px;border-radius:50%;background:#b400e7}
        .slh-approach{background:#fff;color:#111;border-radius:32px;padding:48px;box-shadow:0 0 0 16px rgba(237,231,255,.92),0 0 70px rgba(180,0,220,.45),18px 18px 0 rgba(255,238,186,.72)}
        .slh-approach span{display:inline-flex;align-items:center;gap:7px;background:#fff2ff;color:#7f008d;border-radius:999px;padding:8px 14px;font-weight:600}
        .slh-approach span i{width:10px;height:10px;background:#b400e7;border-radius:50%;display:inline-block}
        .slh-approach h3{font-size:24px;line-height:1.2;margin:30px 0 12px}
        .slh-approach>p{color:#222;font-size:17px;line-height:1.55;margin:0}
        .slh-approach div{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:34px}
        .slh-approach article{background:#fbf0ff;border-radius:13px;padding:22px}
        .slh-approach b{display:block;color:#b400e7;font-size:18px;margin-bottom:10px}
        .slh-approach article p{color:#4f5667;line-height:1.45;margin:0;font-weight:600}
        .slh-method{padding:86px 11%}
        .slh-section-head{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:end}
        .slh-section-head small{grid-column:1/-1}
        .slh-section-head h2,.slh-platforms h2,.slh-reviews h2{font-family:'Right Grotesk','Arial Black','Inter',sans-serif;font-size:34px;line-height:1.05;font-weight:900;letter-spacing:-.03em}
        .slh-section-head p{color:#3b4150;line-height:1.6}
        .slh-method-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:52px}
        .slh-method-grid article{border:1px solid #f3bfff;border-radius:12px;padding:28px;min-height:220px}
        .slh-method-grid span{color:#b400e7;font-size:32px}
        .slh-method-grid p{color:#555}
        .slh-platforms{display:grid;grid-template-columns:1fr 1fr;gap:80px;padding:60px 11% 90px}
        .slh-platforms ul{background:#fafafa;border-radius:20px;padding:24px;list-style:none}
        .slh-platforms li{border-bottom:1px solid #ddd;padding:22px 0}
        .slh-platforms li span{display:block;color:#555;margin-top:8px}
        .slh-reviews{padding:70px 11%;overflow:hidden}
        .slh-reviews>div{display:grid;grid-template-columns:repeat(3,minmax(260px,1fr));gap:28px;margin-top:30px}
        .slh-reviews article{background:#f4f6f8;border-radius:10px;padding:24px;min-height:190px}
        .slh-reviews article div{color:#00b67a}
        .slh-cta{margin:70px auto;max-width:1120px;background:#670075;color:#fff;text-align:center;border-radius:22px;padding:46px 24px}
        .slh-cta h2{font-size:36px;margin:8px 0}
        .slh-cta p{max-width:620px;margin:0 auto 22px}
        .slh-footer{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:34px 11%;font-size:13px}
        .slh-footer-logo{height:42px;width:auto;display:block}
        .slh-footer a:last-child{color:#111;text-decoration:none;border:1px solid #ddd;border-radius:8px;padding:10px 14px}
        @media(max-width:1100px){.slh-hero,.slh-problem{grid-template-columns:1fr;gap:42px}.slh-customer{max-width:480px}.slh-featured div{gap:28px}.slh-featured img{height:23px}.slh-brands div{gap:30px}}
        @media(max-width:900px){.slh-header{padding:0 18px}.slh-logo-mark{height:34px}.slh-nav{display:none}.slh-menu{display:block}.slh-hero{display:flex;flex-direction:column;padding:34px 18px;gap:24px}.slh-hero h1{font-size:40px}.slh-hero-actions,.slh-badges{display:grid;gap:10px}.slh-code-form div{display:grid}.slh-code-form button{margin-top:8px}.slh-featured{overflow:hidden}.slh-featured div{display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:18px}.slh-featured img{height:20px;margin:auto}.slh-brands div{gap:24px}.slh-brands img{max-height:32px;max-width:130px}.slh-problem,.slh-section-head,.slh-platforms{display:block;padding:52px 18px}.slh-problem h2,.slh-section-head h2,.slh-platforms h2,.slh-reviews h2{font-size:30px}.slh-problem-copy>p{font-size:16px}.slh-approach{margin-top:34px;padding:28px;border-radius:24px;box-shadow:0 0 0 9px rgba(237,231,255,.92),0 0 38px rgba(180,0,220,.35),8px 8px 0 rgba(255,238,186,.72)}.slh-approach div{grid-template-columns:1fr}.slh-method{padding:48px 18px}.slh-method-grid,.slh-reviews>div{grid-template-columns:1fr}.slh-platforms ul{margin-top:24px}.slh-cta{margin:42px 18px}.slh-footer{display:grid;text-align:center;justify-items:center}}
      `}</style>
    </div>
  );
};

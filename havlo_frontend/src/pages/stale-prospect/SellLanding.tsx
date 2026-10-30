import type { ReactNode } from 'react';
import { usePageMeta } from '../../hooks/usePageMeta';
import { StaleProspectWizard } from './StaleProspectWizard';

// The seller page, /sell: a full landing page around the ads funnel's
// listing-link form, then the same steps as /assess/seller. Leads are tagged
// "sell_seller" (Seller page). It has its own Google Tag Manager container
// (GTM-537H8B3L, loaded by index.html on /sell only) and no Meta Pixel; the
// wizard tells Tag Manager about leads and card payments (lib/gtm.ts).

const DISCOVER = [
  'What’s weakening your buyer appeal',
  'How you compare to competing listings',
  'Why it may have remained unsold',
  'Changes that could improve its chances',
  'A practical 30-day action plan',
  'Works with your current estate agent',
];

const STEPS = [
  {
    title: 'Paste your Rightmove link',
    text: 'Copy the address of your listing from Rightmove and paste it in. No account needed to start.',
  },
  {
    title: 'See your free first scan',
    text: 'We read your listing, compare it with homes for sale nearby and recent sales, and show how many factors may be holding it back.',
  },
  {
    title: 'Get the full assessment',
    text: 'Unlock every finding with recommendations and a 30-day action plan. Make the changes yourself or share them with your agent.',
  },
];

const INCLUDED = [
  { title: 'Market & pricing', text: 'Comparable sales, your pricing position, local competition, area demand and buyer demographics.' },
  { title: 'Listing & buyer appeal', text: 'Listing performance, photography and description, and why buyers may be overlooking the property.' },
  { title: 'Property presentation', text: 'Human estate agent review, with home presentation and staging recommendations.' },
  { title: 'Action plan', text: 'The key issues slowing the sale, 3 to 5 recommendations, a marketing roadmap and a relaunch strategy.' },
];

const EXAMPLE_ROWS = [
  { label: 'Buyer Appeal', text: 'Lead photo and opening lines undersell the home' },
  { label: 'Pricing Position', text: 'Above most similar homes for sale nearby' },
  { label: 'Listing Presentation', text: '4 opportunities identified' },
  { label: 'Local Competition', text: 'Competing with 23 similar listings' },
];

const REVIEWS = [
  {
    quote:
      'After 3 months with barely any viewings, StaleListings helped us spot issues with our photos and pricing strategy. We updated the listing and received two offers within weeks.',
    name: 'Sarah M.',
  },
  {
    quote:
      'Our listing had gone stale after 10 weeks. StaleListings identified presentation and description issues our agent never mentioned. Viewings picked up almost immediately.',
    name: 'Emma L.',
  },
  {
    quote:
      'What I liked most was that we didn’t need to change agents. We simply used the recommendations alongside our current estate agent and improved the listing.',
    name: 'Michael T.',
  },
];

const FAQS = [
  {
    q: 'Do I need to switch estate agents?',
    a: 'No. The assessment is built to be used alongside your current agent. You can make the changes yourself or share the findings with them.',
  },
  {
    q: 'Where do I find my Rightmove link?',
    a: 'Open your property on Rightmove and copy the address from your browser bar or the Share button. It starts with rightmove.co.uk/properties/.',
  },
  {
    q: 'Is the first scan really free?',
    a: 'Yes. You see your property, how many factors we found and where they sit before you pay anything.',
  },
  {
    q: 'What do I get for £49?',
    a: 'Every finding with recommendations, your pricing position against nearby sales and listings, and a 30-day action plan you can share.',
  },
];

const Tick = ({ color = '#A409D2', size = 20 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="sell-tick">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/** Back up to the listing-link box in the hero, ready to paste. */
const goToForm = () => {
  const form = document.getElementById('listing-link');
  form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  form?.querySelector('input')?.focus({ preventScroll: true });
};

const SellLandingContent = ({ form }: { form: ReactNode }) => (
  <div className="sell">
    <section className="sell-hero">
      <div className="sell-wrap sell-hero-inner">
        <div className="sell-hero-text">
          <p className="sell-eyebrow">For homeowners whose property hasn&rsquo;t sold</p>
          <h1 className="sell-h1">
            Still on the Market? <span>Find Out What&rsquo;s Holding Your Sale Back.</span>
          </h1>
          <p className="sell-lead">
            Paste your Rightmove link. In under a minute you&rsquo;ll see what may be putting buyers off, how your home
            compares with the listings around it, and what you could change. No need to switch estate agent.
          </p>
          {form}
          <div className="sell-trust">
            <span className="sell-trust-item">
              <span className="sell-stars" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => <span key={i}>★</span>)}
              </span>
              <b>Excellent</b> on Trustpilot
            </span>
            <span className="sell-trust-item"><Tick color="#1A7F4B" size={16} />Free first scan</span>
            <span className="sell-trust-item"><Tick color="#1A7F4B" size={16} />Works with your current agent</span>
          </div>
        </div>
        <div className="sell-hero-media">
          <img src="/stale-hero-house.png" alt="Houses for sale on a residential street" />
          <div className="sell-hero-card">
            <div className="sell-hero-card-head">
              <b>We found 7 factors that may be affecting this sale</b>
              <span className="sell-example">Example</span>
            </div>
            <div className="sell-chips">
              <span>Buyer appeal</span>
              <span>Pricing position</span>
              <span>Listing presentation</span>
              <span>Local competition</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="sell-numbers" aria-label="Havlo in numbers">
      <div className="sell-wrap sell-numbers-grid">
        <div><b>10K+</b><span>Listings analysed</span></div>
        <div><b>91K+</b><span>Seller recommendations</span></div>
        <div><b>300+</b><span>Market signals checked</span></div>
        <div><b>&lt; 1 min</b><span>To your first scan</span></div>
      </div>
    </section>

    <section className="sell-section">
      <div className="sell-wrap sell-split">
        <div className="sell-split-text">
          <h2 className="sell-h2">Homes that sit too long lose buyer attention. Yours doesn&rsquo;t have to.</h2>
          <p className="sell-muted">
            Every week on the market makes a listing easier for buyers to scroll past. The assessment reads your listing the
            way a buyer and a local agent would, then shows you what to fix first.
          </p>
        </div>
        <ul className="sell-discover">
          {DISCOVER.map((item) => (
            <li key={item}><Tick />{item}</li>
          ))}
        </ul>
      </div>
    </section>

    <section className="sell-section sell-tint" id="how">
      <div className="sell-wrap sell-stack">
        <div className="sell-heading">
          <p className="sell-eyebrow">How it works</p>
          <h2 className="sell-h2">From your listing link to a plan in three steps</h2>
        </div>
        <ol className="sell-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="sell-step-num">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>

    <section className="sell-section">
      <div className="sell-wrap sell-split sell-split-center">
        <div className="sell-split-text">
          <p className="sell-eyebrow">Your first scan</p>
          <h2 className="sell-h2">See what we found before you pay anything</h2>
          <p className="sell-muted">
            The first scan shows your property, the number of factors we found and where they sit. Every line comes from
            your own listing and the homes buyers can see around it.
          </p>
        </div>
        <div className="sell-example-card">
          <div className="sell-example-head">
            <div>
              <b>Your property address</b>
              <span>£475,000 · 4 Bedrooms · 2 Bathrooms</span>
            </div>
            <span className="sell-example">Example</span>
          </div>
          <div className="sell-warning">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            <span>We found <b>7 factors</b> that may be affecting your sale</span>
          </div>
          <p className="sell-example-intro">Your assessment identified potential issues across:</p>
          <ul className="sell-example-list">
            {EXAMPLE_ROWS.map((row) => (
              <li key={row.label}><b>{row.label}</b> · {row.text}</li>
            ))}
          </ul>
          <button type="button" className="sell-btn sell-btn-block" onClick={goToForm}>Assess My Property &rarr;</button>
        </div>
      </div>
    </section>

    <section className="sell-section sell-grey" id="included">
      <div className="sell-wrap sell-stack">
        <div className="sell-heading">
          <p className="sell-eyebrow">The full assessment</p>
          <h2 className="sell-h2">Everything that affects how fast your home sells</h2>
        </div>
        <div className="sell-included">
          <div className="sell-included-grid">
            {INCLUDED.map((card) => (
              <div key={card.title} className="sell-included-card">
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </div>
            ))}
          </div>
          <aside className="sell-price" aria-label="Price">
            <div className="sell-price-top">
              <span>Havlo Property Sale Assessment</span>
              <b>£49</b>
              <span>One payment per property. The first scan is free.</span>
            </div>
            <ul>
              <li><Tick color="#E7B6F7" size={18} />Every finding, not just the headline</li>
              <li><Tick color="#E7B6F7" size={18} />A 30-day action plan</li>
              <li><Tick color="#E7B6F7" size={18} />Easy to share with your agent</li>
            </ul>
            <button type="button" className="sell-btn sell-btn-white" onClick={goToForm}>Start with a free scan</button>
          </aside>
        </div>
        <p className="sell-small">
          Built on the Havlo Index, a scoring model that works out why a listing isn&rsquo;t selling, checked by human review
          and turned into a plan to get it moving again.
        </p>
      </div>
    </section>

    <section className="sell-section">
      <div className="sell-wrap sell-stack">
        <h2 className="sell-h2">What sellers say</h2>
        <div className="sell-reviews">
          {REVIEWS.map((r) => (
            <figure key={r.name}>
              <blockquote>&ldquo;{r.quote}&rdquo;</blockquote>
              <figcaption>{r.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>

    <section className="sell-section sell-tint" id="faq">
      <div className="sell-wrap sell-narrow sell-stack">
        <h2 className="sell-h2">Questions sellers ask</h2>
        <div className="sell-faq">
          {FAQS.map((f, i) => (
            <details key={f.q} open={i === 0}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>

    <section className="sell-final">
      <div className="sell-wrap sell-narrow">
        <h2 className="sell-h2">Find out what&rsquo;s holding your sale back</h2>
        <p>Paste your Rightmove link and get your free first scan in under a minute.</p>
        <button type="button" className="sell-btn sell-btn-accent" onClick={goToForm}>Assess My Property</button>
      </div>
    </section>
    <SellStyles />
  </div>
);

export const SellLanding = () => {
  usePageMeta({
    title: 'Why Hasn’t My Property Sold? | Free Listing Scan for Homeowners | Havlo',
    description:
      'Paste your Rightmove link and see what may be holding back your sale: buyer appeal, pricing position, listing presentation and local competition, with a free first scan.',
  });
  return <StaleProspectWizard ads="owner" channel="sell" landing={(form) => <SellLandingContent form={form} />} />;
};

const SellStyles = () => (
  <style>{`
    .sell{font-family:'Inter',system-ui,sans-serif;color:#1F1F1E;line-height:1.5}
    .sell-wrap{max-width:1180px;margin:0 auto;padding-inline:20px;box-sizing:border-box}
    .sell-narrow{max-width:820px}
    .sell-eyebrow{margin:0;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#A409D2}
    .sell-h1{margin:0;font-family:'Plus Jakarta Sans','Inter',sans-serif;font-weight:800;font-size:56px;line-height:1.08;letter-spacing:-.03em;color:#1F1F1E;text-wrap:balance}
    .sell-h1 span{color:#A409D2}
    .sell-h2{margin:0;font-family:'Plus Jakarta Sans','Inter',sans-serif;font-weight:800;font-size:40px;line-height:1.15;letter-spacing:-.02em;text-wrap:balance}
    .sell-lead{margin:0;font-size:17px;line-height:1.55;color:#333E48;max-width:560px}
    .sell-muted{margin:0;color:#475467;max-width:460px}
    .sell-small{margin:0;font-size:13px;color:#6B7280;max-width:760px}
    .sell-tick{flex:none;margin-top:2px}
    .sell-section{padding-block:72px}
    .sell-tint{background:#FBF7FD}
    .sell-grey{background:#F8F9FB}
    .sell-stack{display:flex;flex-direction:column;gap:32px}
    .sell-heading{display:flex;flex-direction:column;gap:10px;max-width:680px}
    .sell-btn{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:12px;padding:15px 22px;font:inherit;font-size:16px;font-weight:700;cursor:pointer;background:#0B0B0B;color:#fff}
    .sell-btn:focus-visible{outline:3px solid #A409D2;outline-offset:2px}
    .sell-btn-block{width:100%}
    .sell-btn-white{background:#fff;color:#0B0B0B;width:100%}
    .sell-btn-accent{background:#A409D2;color:#fff;min-width:240px}

    .sell-hero{background:linear-gradient(180deg,#FCEFFA 0%,#FFFFFF 100%)}
    .sell-hero-inner{padding-block:56px 64px;display:flex;flex-wrap:wrap;gap:48px;align-items:center}
    .sell-hero-text{flex:1 1 480px;min-width:0;display:flex;flex-direction:column;gap:22px}
    .sell-hero-text .slw-ads-form-wrap{margin:0;max-width:600px;text-align:left}
    .sell-hero-text .slw-ads-reminder{margin-top:14px}
    .sell-trust{display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center;font-size:14px;color:#333E48}
    .sell-trust-item{display:inline-flex;align-items:center;gap:6px}
    .sell-trust-item b{color:#1F1F1E}
    .sell-stars{display:inline-flex;gap:2px;margin-right:2px}
    .sell-stars span{width:18px;height:18px;background:#00B67A;color:#fff;font-size:12px;display:inline-flex;align-items:center;justify-content:center}
    .sell-hero-media{flex:1 1 380px;min-width:0;position:relative}
    .sell-hero-media{padding-bottom:56px}
    .sell-hero-media img{display:block;width:100%;max-width:100%;height:auto}
    .sell-hero-card{position:absolute;left:24px;right:24px;bottom:0;background:#fff;border-radius:16px;padding:16px 18px;box-shadow:0 12px 32px rgba(31,31,30,.16);display:flex;flex-direction:column;gap:8px}
    .sell-hero-card-head{display:flex;justify-content:space-between;gap:12px;align-items:center}
    .sell-hero-card-head b{font-family:'Plus Jakarta Sans',sans-serif;font-size:16px}
    .sell-example{flex:none;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6B7280;background:#F2F4F7;padding:3px 8px;border-radius:999px}
    .sell-chips{display:flex;flex-wrap:wrap;gap:6px}
    .sell-chips span{font-size:12px;font-weight:600;color:#7A079C;background:#F6ECFB;padding:4px 10px;border-radius:999px}

    .sell-numbers{border-block:1px solid #EEF0F3}
    .sell-numbers-grid{padding-block:28px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}
    .sell-numbers-grid div{display:flex;flex-direction:column;gap:2px}
    .sell-numbers-grid b{font-family:'Plus Jakarta Sans',sans-serif;font-size:34px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
    .sell-numbers-grid span{font-size:14px;color:#475467}

    .sell-split{display:flex;flex-wrap:wrap;gap:40px 48px;align-items:flex-start}
    .sell-split-center{align-items:center}
    .sell-split-text{flex:1 1 360px;min-width:0;display:flex;flex-direction:column;gap:14px}
    .sell-discover{flex:1 1 480px;min-width:0;list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .sell-discover li{display:flex;gap:12px;align-items:flex-start;padding:16px;background:#F8F9FB;border-radius:12px;font-weight:600;color:#202124}

    .sell-steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
    .sell-steps li{background:#fff;border:1px solid #EADCF3;border-radius:18px;padding:26px;display:flex;flex-direction:column;gap:12px}
    .sell-steps h3{margin:0;font-family:'Plus Jakarta Sans',sans-serif;font-size:20px;font-weight:700}
    .sell-steps p{margin:0;color:#475467}
    .sell-step-num{width:40px;height:40px;border-radius:50%;background:#0B0B0B;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;display:inline-flex;align-items:center;justify-content:center}

    .sell-example-card{flex:1 1 520px;min-width:0;border:1px solid #E6E8EC;border-radius:20px;padding:24px;box-shadow:0 16px 40px rgba(31,31,30,.08);display:flex;flex-direction:column;gap:16px;background:#fff}
    .sell-example-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
    .sell-example-head div{display:flex;flex-direction:column;gap:4px;min-width:0}
    .sell-example-head b{font-family:'Plus Jakarta Sans',sans-serif;font-size:20px}
    .sell-example-head div span{font-weight:600;color:#202124}
    .sell-warning{display:flex;gap:10px;align-items:center;background:#FFF4E5;color:#8A4B00;border-radius:10px;padding:12px 14px;font-size:15px}
    .sell-warning svg{flex:none}
    .sell-example-intro{margin:0;font-size:15px;font-weight:600;color:#202124}
    .sell-example-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;font-size:15px;color:#475467}
    .sell-example-list li{background:#F8F9FB;border-radius:10px;padding:12px 14px}
    .sell-example-list b{color:#202124}

    .sell-included{display:flex;flex-wrap:wrap;gap:24px;align-items:stretch}
    .sell-included-grid{flex:999 1 560px;min-width:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    .sell-included-card{background:#fff;border-radius:16px;padding:22px;display:flex;flex-direction:column;gap:10px}
    .sell-included-card h3{margin:0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7A079C}
    .sell-included-card p{margin:0;color:#333E48;font-size:15px}
    .sell-price{flex:1 1 300px;min-width:0;background:#0B0B0B;color:#fff;border-radius:20px;padding:28px;display:flex;flex-direction:column;gap:16px;justify-content:space-between;box-sizing:border-box}
    .sell-price-top{display:flex;flex-direction:column;gap:8px}
    .sell-price-top span{font-size:14px;color:#C9CDD4}
    .sell-price-top b{font-family:'Plus Jakarta Sans',sans-serif;font-size:52px;font-weight:800;letter-spacing:-.03em;line-height:1}
    .sell-price ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;font-size:15px}
    .sell-price li{display:flex;gap:10px}

    .sell-reviews{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
    .sell-reviews figure{margin:0;border:1px solid #E6E8EC;border-radius:16px;padding:22px;display:flex;flex-direction:column;gap:14px;justify-content:space-between}
    .sell-reviews blockquote{margin:0;font-size:16px;color:#1F1F1E}
    .sell-reviews figcaption{font-size:14px;font-weight:600;color:#475467}

    .sell-faq{display:flex;flex-direction:column;gap:10px}
    .sell-faq details{background:#fff;border-radius:14px;padding:18px 20px}
    .sell-faq summary{font-weight:700;font-size:16px;color:#1F1F1E;cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:12px}
    .sell-faq summary::-webkit-details-marker{display:none}
    .sell-faq summary::after{content:'+';font-size:20px;line-height:1;color:#A409D2}
    .sell-faq details[open] summary::after{content:'−'}
    .sell-faq p{margin:10px 0 0;color:#475467}

    .sell-final{background:#0B0B0B;color:#fff;padding-block:72px;text-align:center}
    .sell-final .sell-wrap{display:flex;flex-direction:column;gap:20px;align-items:center}
    .sell-final .sell-h2{font-size:44px;color:#fff}
    .sell-final p{margin:0;color:#C9CDD4;max-width:520px}

    @media (max-width:1024px){
      .sell-h1{font-size:44px}
      .sell-h2{font-size:34px}
      .sell-numbers-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      .sell-steps,.sell-reviews{grid-template-columns:minmax(0,1fr)}
    }
    @media (max-width:640px){
      .sell-h1{font-size:34px;line-height:1.12}
      .sell-h2,.sell-final .sell-h2{font-size:28px}
      .sell-section,.sell-final{padding-block:52px}
      .sell-hero-inner{padding-block:32px 44px;gap:32px}
      .sell-discover,.sell-included-grid{grid-template-columns:minmax(0,1fr)}
      .sell-numbers-grid b{font-size:28px}
      .sell-btn-accent{width:100%;min-width:0}
    }
  `}</style>
);

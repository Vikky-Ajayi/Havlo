import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PURPLE = '#8B05D3';

function FAQItem({ q, a }: { q: string; a: string | React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid #E8E8E8' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: '100%', padding: '18px 0', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 15, color: '#1F1F1E', letterSpacing: '-0.2px', lineHeight: 1.4 }}>{q}</span>
        <span style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid #D0D0D0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#888', transition: 'transform 0.2s', transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}>
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14" /></svg>
        </span>
      </button>
      {open && (
        <div style={{ paddingBottom: 18 }}>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#555', lineHeight: 1.7 }}>{a}</div>
        </div>
      )}
    </div>
  );
}

const ALL_FAQS = [
  { q: '1. What is StaleListings.com?', a: 'StaleListings.com helps homeowners identify what may be slowing down their home sale, with personalised recommendations powered by property data and experienced local agent insights.' },
  {
    q: '2. Who is this for?',
    a: (<span>The platform is designed for:<br />• homeowners preparing to sell<br />• sellers already on the market<br />• homeowners whose listings have gone stale<br />• anyone wanting a second opinion on their sale strategy</span>),
  },
  { q: '3. How does it work?', a: 'Simply enter your property details or upload your listing link. We analyse your home and provide actionable recommendations to improve buyer appeal and selling potential.' },
  { q: '4. Do I need to switch estate agents?', a: 'No. Our recommendations are designed to work alongside your current estate agent.' },
  { q: '5. Can I use this before listing my home?', a: 'Yes. Many homeowners use StaleListings.com before going live to avoid common listing mistakes.' },
  { q: '6. How long does the report take?', a: 'Most reports are delivered within 6–12 hours.' },
  {
    q: '7. What kind of recommendations will I receive?',
    a: (<span>Recommendations may include:<br />• pricing insights<br />• photo improvements<br />• presentation tips<br />• listing description feedback<br />• buyer appeal suggestions<br />• market positioning recommendations</span>),
  },
  { q: '8. Is the analysis automated or reviewed by humans?', a: 'We combine data-driven analysis with experienced local property expertise.' },
  { q: '9. Will you contact my estate agent?', a: 'No, unless you specifically request it.' },
  { q: '10. What if my home is already listed?', a: "That's completely fine. The platform is specifically designed to help improve active listings." },
  { q: '11. Can this help if my home has been on the market for months?', a: 'Yes. Many sellers use StaleListings.com to identify overlooked issues affecting buyer interest.' },
  { q: '12. Do you guarantee my home will sell faster?', a: 'No platform can guarantee a sale, but our goal is to help you improve your home\'s appeal and reduce avoidable listing mistakes.' },
  { q: '13. What property websites do you support?', a: 'We currently support listings from major UK property portals including Rightmove and Zoopla.' },
  { q: '14. How detailed is the report?', a: 'Each report is personalised to your property and includes practical, actionable recommendations you can implement immediately.' },
  { q: '15. Is my information kept private?', a: 'Yes. Your property information and report details are kept confidential.' },
  { q: '16. Can I get another report after making changes?', a: 'Yes. You can request an updated analysis after implementing our recommendations.' },
  { q: '17. Do you work across the UK?', a: 'Yes. We support homeowners across the UK.' },
  { q: '18. Is this only for expensive homes?', a: 'No. Our insights are designed for properties across different budgets and markets.' },
  { q: '19. Why shouldn\'t I rely only on my estate agent?', a: 'Estate agents often manage multiple listings at once. StaleListings.com provides an additional layer of focused analysis to help uncover issues that may otherwise be overlooked.' },
  { q: '20. What makes StaleListings.com different?', a: 'We combine property data, buyer behaviour insights, and experienced local expertise to help homeowners make smarter selling decisions — without changing agents.' },
  { q: '21. Can estate agents use StaleListings.com?', a: 'Yes. Estate agents can use StaleListings.com to gain additional insights, strengthen listing performance, and provide more value to their clients. Our recommendations are designed to support agents, not replace them.' },
];

const TESTIMONIALS = [
  { text: 'After 3 months with barely any viewings, StaleListings helped us spot issues with our photos and pricing strategy. We updated the listing and received two offers within weeks', name: '— Sarah M.' },
  { text: 'Our estate agent was great, but having an extra layer of analysis made a huge difference. The recommendations were detailed, practical, and easy to implement.', name: '— James & Olivia R.' },
  { text: "We used StaleListings before putting our house on the market and avoided mistakes that probably would've cost us months. The report was incredibly helpful.", name: '— Daniel P.' },
  { text: 'The insights felt like having a second opinion from someone who actually understood buyer behaviour. Small changes made a surprisingly big impact.', name: '— Priya K.' },
  { text: 'Our listing had gone stale after 10 weeks. StaleListings identified presentation and description issues our agent never mentioned. Viewings picked up almost immediately', name: '— Emma L.' },
  { text: "What I liked most was that we didn't need to change agents. We simply used the recommendations alongside our current estate agent and improved the listing.", name: '— Michael T.' },
];

const PLANS = [
  {
    id: 'quick_insight',
    name: 'Quick Insight',
    price: '£79.99',
    label: null,
    tagline: 'Vendors wanting a fast professional opinion.',
    features: [
      'Data-driven property market analysis',
      'Human estate agent review',
      'Local comparable sales review',
      'Pricing position check',
      'Online listing performance review',
      'Summary report with key issues slowing the sale',
      '3–5 actionable recommendations',
      'Turnaround: 24–48 hours',
    ],
    iconBg: '#E8D5FF',
    iconColor: PURPLE,
  },
  {
    id: 'professional_review',
    name: 'Professional Review',
    price: '£299.99',
    label: 'Most Popular',
    tagline: 'Serious sellers wanting expert guidance to improve saleability.',
    preNote: 'Includes everything in Quick Insight, plus',
    features: [
      'Buyer appeal analysis',
      'Listing photography & description review',
      'Local competition benchmarking',
      '"Why buyers may be overlooking this property" section',
      'Recommended pricing strategy',
      'Priority turnaround',
      'Turnaround: 24 hours',
    ],
    iconBg: '#FFDCF6',
    iconColor: '#D400A8',
  },
  {
    id: 'premium_strategy',
    name: 'Premium Strategy',
    price: '£1,499.99',
    label: null,
    tagline: 'High-value homes or properties stuck on the market for months.',
    preNote: 'Includes everything in professional review plus:',
    features: [
      'Detailed property positioning strategy',
      'Multi-platform listing audit',
      'Area demand and buyer demographic analysis',
      'Home presentation/staging recommendations',
      'Marketing improvement roadmap',
      'Re-launch strategy',
      'Estate agent strategy review with improvement recommendations',
      'Follow-up review after changes are implemented',
      'Direct access for Q&A support for 14–30 days',
      '24 hours + follow-up support',
    ],
    iconBg: '#1F1F1E',
    iconColor: '#fff',
  },
];

const TrustpilotStars = () => (
  <div style={{ display: 'flex', gap: 3 }}>
    {[...Array(5)].map((_, i) => (
      <div key={i} style={{ width: 22, height: 22, background: '#00B67A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      </div>
    ))}
  </div>
);

const QuoteIcon = () => (
  <svg width="32" height="26" viewBox="0 0 32 26" fill="none">
    <path d="M0 26V15.6C0 6.93 4.09 1.73 12.27 0L13.71 2.83C10.22 3.78 8.18 5.97 7.56 9.44H14.22V26H0ZM17.78 26V15.6C17.78 6.93 21.87 1.73 30.04 0L31.49 2.83C28 3.78 25.96 5.97 25.33 9.44H32V26H17.78Z" fill={PURPLE} fillOpacity="0.18"/>
  </svg>
);

const HouseIcon = ({ color, bg }: { color: string; bg: string }) => (
  <div style={{ width: 56, height: 56, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M3.5 14V17.5C3.5 22.166 3.5 24.499 4.918 25.917C6.335 27.333 8.666 27.333 13.333 27.333H14.666C19.333 27.333 21.665 27.333 23.082 25.917C24.5 24.499 24.5 22.166 24.5 17.5V14C24.5 11.96 24.5 10.94 24.082 10.06C23.664 9.18 22.877 8.547 21.304 7.281L19.638 5.926C17.105 3.853 15.84 2.816 14.333 2.816C12.828 2.816 11.561 3.853 9.028 5.926L7.362 7.281C5.789 8.547 5.002 9.18 4.583 10.06C4.167 10.94 4.167 11.96 3.5 14Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);

export function StaleListingsLanding() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [showAllFaq, setShowAllFaq] = useState(false);

  const handleStart = () => {
    const params = new URLSearchParams();
    const v = input.trim();
    if (v) {
      if (v.startsWith('http') || v.includes('rightmove') || v.includes('zoopla') || v.includes('onthemarket')) {
        params.set('url', v);
      } else {
        params.set('address', v);
      }
    }
    navigate(`/stale-listings/questions${params.toString() ? '?' + params.toString() : ''}`);
  };

  const faqsToShow = showAllFaq ? ALL_FAQS : ALL_FAQS.slice(0, 5);

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#fff', minHeight: '100vh' }}>
      <style>{`
        @media (max-width: 768px) {
          .sl-nav-links { display: none !important; }
          .sl-hero-grid { flex-direction: column !important; }
          .sl-hero-image { display: none !important; }
          .sl-features-grid { grid-template-columns: 1fr !important; }
          .sl-steps-grid { grid-template-columns: 1fr !important; }
          .sl-testimonials-grid { grid-template-columns: 1fr !important; }
          .sl-faq-grid { grid-template-columns: 1fr !important; }
          .sl-pricing-grid { grid-template-columns: 1fr !important; }
          .sl-stats-row { flex-direction: column; gap: 24px !important; }
          .sl-hero-heading { font-size: 40px !important; }
          .sl-footer-inner { flex-direction: column; gap: 12px; }
        }
        @media (min-width: 769px) {
          .sl-mobile-nav-btn { display: none !important; }
        }
      `}</style>

      {/* NAVBAR */}
      <header style={{ background: '#fff', borderBottom: '1px solid #F0F0F0', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 20, color: '#1F1F1E', letterSpacing: '-0.5px', lineHeight: 1 }}>StaleListings</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#999', letterSpacing: 0.3 }}>By HAVLO</span>
          </div>
          <nav className="sl-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
            <a href="#how-it-works" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 14, color: '#1F1F1E', textDecoration: 'none' }}>How it works</a>
            <a href="#faq" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 14, color: '#1F1F1E', textDecoration: 'none' }}>Faq</a>
            <a href="#pricing" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 14, color: '#1F1F1E', textDecoration: 'none' }}>Pricing</a>
            <button onClick={handleStart} style={{ background: '#1F1F1E', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, padding: '10px 22px', borderRadius: 100, border: 'none', cursor: 'pointer', letterSpacing: '-0.2px' }}>
              Start Assessment
            </button>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section style={{ background: '#fff', overflow: 'hidden', position: 'relative', padding: '0 24px' }}>
        {/* Pink blob top right */}
        <div style={{ position: 'absolute', right: 0, top: 0, width: '55%', height: '100%', background: 'linear-gradient(135deg, #FDE8FF 0%, #FFB6F0 60%, #E8BAFF 100%)', borderRadius: '0 0 0 80px', zIndex: 0, pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', minHeight: 480, gap: 40, paddingTop: 48, paddingBottom: 48 }} className="sl-hero-grid">
          {/* Left */}
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <h1 className="sl-hero-heading" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 52, color: '#1F1F1E', lineHeight: 1.08, letterSpacing: '-2px', marginBottom: 18, marginTop: 0 }}>
              Don't Let Your Home Sit<br />on the Market
            </h1>
            <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 15, color: '#555', lineHeight: 1.65, letterSpacing: '-0.2px', marginBottom: 28, maxWidth: 500 }}>
              Whether you're preparing to sell or already on the market, get personalised insights combining data-driven analysis with experienced local agent expertise — all while working with your current agent, no switching required.
            </p>

            {/* Input bar */}
            <div style={{ display: 'flex', alignItems: 'center', background: '#F4F4F4', borderRadius: 10, padding: '5px 5px 5px 14px', maxWidth: 520, gap: 8, marginBottom: 12 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
                <path d="M3 12V14.5C3 17.8 3 19.45 4.025 20.475C5.05 21.5 6.7 21.5 10 21.5H14C17.3 21.5 18.95 21.5 19.975 20.475C21 19.45 21 17.8 21 14.5V12C21 10.31 21 9.47 20.644 8.74C20.288 8.01 19.625 7.5 18.298 6.464L16.298 4.909C14.233 3.303 13.201 2.5 12 2.5C10.799 2.5 9.767 3.303 7.702 4.909L5.702 6.464C4.375 7.5 3.712 8.01 3.356 8.74C3 9.47 3 10.31 3 12Z" stroke="#313131" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleStart()}
                placeholder="Enter property address or listing url"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#1F1F1E' }}
              />
              <button
                onClick={handleStart}
                style={{ background: '#1F1F1E', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, padding: '10px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Assess my home
              </button>
            </div>

            {/* Trustpilot row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
              <TrustpilotStars />
              <div>
                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, color: '#1F1F1E' }}>Excellent</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#888', marginLeft: 6 }}>Based on verified customer feedback</span>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }} className="sl-stats-row">
              {[
                { value: '10K+', label: 'Listings Analyzed' },
                { value: '91K+', label: 'Seller Recommendations' },
                { value: '250K+', label: 'Property Data Points' },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 26, color: '#1F1F1E', letterSpacing: '-1px', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#888', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: house image */}
          <div className="sl-hero-image" style={{ flex: '0 0 420px', height: 380, borderRadius: 20, overflow: 'hidden', position: 'relative' }}>
            <img
              src="https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=700&q=80"
              alt="Property"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </div>
      </section>

      {/* FEATURES BANNER */}
      <section style={{ padding: '48px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ background: '#F5F5F5', borderRadius: 24, padding: '48px 48px 40px' }}>
            <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 'clamp(24px, 3vw, 36px)', color: '#1F1F1E', letterSpacing: '-1px', lineHeight: 1.2, marginBottom: 48, maxWidth: 540, marginTop: 0 }}>
              Homes that sit too long lose buyer attention. Yours doesn't have to.
            </h2>
            <div className="sl-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 40 }}>
              {[
                { icon: '🏠', title: 'Spot What Buyers Notice', desc: 'Uncover the small issues that can reduce buyer interest and slow down your sale.' },
                { icon: '💡', title: 'Expert-Backed Selling Insights', desc: 'Combine data-driven analysis with experienced local property expertise.' },
                { icon: '🤝', title: 'Works With Your Current Agent', desc: 'Use our recommendations alongside your existing estate agent, no switching required.' },
              ].map((f, i) => (
                <div key={i}>
                  <div style={{ fontSize: 28, marginBottom: 16 }}>{f.icon}</div>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 18, color: '#1F1F1E', letterSpacing: '-0.4px', marginBottom: 10 }}>{f.title}</div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#666', lineHeight: 1.65 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ padding: '16px 24px 64px', background: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="sl-steps-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Step 1 */}
            <div style={{ background: '#F5F5F5', borderRadius: 24, padding: '40px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'inline-flex', background: '#000', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 11, padding: '4px 12px', borderRadius: 100, alignSelf: 'flex-start', letterSpacing: 0.3 }}>Step 1</div>
              <div>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 24, color: '#1F1F1E', letterSpacing: '-0.6px', lineHeight: 1.2, marginBottom: 10 }}>Tell Us About Your Home</div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#666', lineHeight: 1.65 }}>Enter your property details, upload your listing, or share your Rightmove/Zoopla link to start your analysis.</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Enter property address…', 'Paste Rightmove / Zoopla URL…', 'Upload listing document'].map((p, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #EBEBEB' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 12V14.5C3 17.8 3 19.45 4.025 20.475C5.05 21.5 6.7 21.5 10 21.5H14C17.3 21.5 18.95 21.5 19.975 20.475C21 19.45 21 17.8 21 14.5V12C21 10.31 21 9.47 20.644 8.74C20.288 8.01 19.625 7.5 18.298 6.464L16.298 4.909C14.233 3.303 13.201 2.5 12 2.5C10.799 2.5 9.767 3.303 7.702 4.909L5.702 6.464C4.375 7.5 3.712 8.01 3.356 8.74C3 9.47 3 10.31 3 12Z" stroke="#888" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#aaa' }}>{p}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ background: '#F5F5F5', borderRadius: 24, padding: '40px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'inline-flex', background: '#000', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 11, padding: '4px 12px', borderRadius: 100, alignSelf: 'flex-start', letterSpacing: 0.3 }}>Step 2</div>
              <div>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 24, color: '#1F1F1E', letterSpacing: '-0.6px', lineHeight: 1.2, marginBottom: 10 }}>Get personalized selling insights</div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#666', lineHeight: 1.65 }}>We analyse your home using property data, buyer trends, and experienced local agent expertise to uncover what could improve your sale.</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Property data', sub: 'Buyer trends' },
                  { label: 'Local agent expertise', sub: 'Listing comparison' },
                ].map((item, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', border: '1px solid #EBEBEB' }}>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: '#1F1F1E' }}>{item.label}</div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#aaa', marginTop: 2 }}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3 (spans full width on desktop) */}
            <div style={{ background: '#F5F5F5', borderRadius: 24, padding: '40px 36px', display: 'flex', flexDirection: 'column', gap: 24, gridColumn: '1 / -1' }}>
              <div style={{ display: 'inline-flex', background: '#000', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 11, padding: '4px 12px', borderRadius: 100, alignSelf: 'flex-start', letterSpacing: 0.3 }}>Step 3</div>
              <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 300px' }}>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 24, color: '#1F1F1E', letterSpacing: '-0.6px', lineHeight: 1.2, marginBottom: 10 }}>Improve your chances of a faster sale</div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#666', lineHeight: 1.65 }}>Receive your expert report within 6–12 hours, with actionable recommendations you can implement alongside your current estate agent.</div>
                </div>
                <div style={{ flex: '1 1 280px' }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: '#1F1F1E', marginBottom: 14 }}>YOUR REPORT INCLUDES:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {['Pricing insights', 'Photo improvements', 'Listing description feedback', 'Buyer appeal suggestions', 'Market positioning recommendations'].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#1F1F1E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#444' }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '48px 24px', background: '#F5F5F5' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 'clamp(22px, 3vw, 32px)', color: '#1F1F1E', letterSpacing: '-0.8px', marginBottom: 36, textAlign: 'left', marginTop: 0 }}>
            See why sellers trust our insights
          </h2>
          <div className="sl-testimonials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', border: '1px solid #EBEBEB' }}>
                <QuoteIcon />
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#444', lineHeight: 1.7, margin: '16px 0 20px', letterSpacing: '-0.1px' }}>"{t.text}"</p>
                <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, color: '#1F1F1E' }}>{t.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: '64px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 'clamp(22px, 3vw, 32px)', color: '#1F1F1E', letterSpacing: '-0.8px', marginBottom: 8, marginTop: 0 }}>
            Evertthing you need to know
          </h2>
          <div className="sl-faq-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 64px', marginTop: 32 }}>
            <div>
              {faqsToShow.slice(0, Math.ceil(faqsToShow.length / 2)).map((faq, i) => (
                <FAQItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
            <div>
              {faqsToShow.slice(Math.ceil(faqsToShow.length / 2)).map((faq, i) => (
                <FAQItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <button
              onClick={() => setShowAllFaq(!showAllFaq)}
              style={{ background: '#1F1F1E', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, padding: '12px 32px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
            >
              {showAllFaq ? 'See Less' : 'Load more'}
            </button>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: '64px 24px 80px', background: 'linear-gradient(180deg, #F9E8FF 0%, #FFD6F6 50%, #FFF0FD 100%)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#888', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>Find out why your property isn't selling and<br />what you can do to improve it.</p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#666', maxWidth: 540, margin: '0 auto 40px' }}>Get expert insights, market analysis, and professional recommendations designed to help position your property more effectively and attract the right buyers faster.</p>
          </div>

          <div className="sl-pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, maxWidth: 1080, margin: '0 auto' }}>
            {PLANS.map((plan, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 20, padding: '32px 28px', border: plan.label ? '2.5px solid #1F1F1E' : '1px solid #E8E8E8', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                {plan.label && (
                  <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#1F1F1E', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: 0.5, padding: '5px 16px', borderRadius: 100, whiteSpace: 'nowrap' }}>
                    {plan.label}
                  </div>
                )}
                <HouseIcon color={plan.iconColor} bg={plan.iconBg} />
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 18, color: '#1F1F1E', letterSpacing: '-0.4px', marginBottom: 4 }}>{plan.name}</div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 1.5 }}>{plan.tagline}</div>
                {plan.preNote && (
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#999', marginBottom: 12, fontStyle: 'italic' }}>{plan.preNote}</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, marginBottom: 24 }}>
                  {plan.features.map((f, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 13l4 4L19 7" stroke="#1F1F1E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#444', lineHeight: 1.45 }}>{f}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 22, color: '#1F1F1E', letterSpacing: '-0.5px', textAlign: 'center', marginBottom: 4 }}>{plan.price}</div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#999', textAlign: 'center', marginBottom: 16 }}>per report</div>
                <button
                  onClick={handleStart}
                  style={{ width: '100%', padding: '13px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, background: '#1F1F1E', color: '#fff' }}
                >
                  Start Assessment
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#1F1F1E', padding: '24px 24px' }}>
        <div className="sl-footer-inner" style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 16, color: '#fff', letterSpacing: '-0.4px' }}>StaleListings</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#666' }}>By HAVLO</span>
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#666' }}>© 2025 StaleListings. All rights reserved.</div>
          <div style={{ display: 'flex', gap: 20 }}>
            <a href="/privacy-policy" style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#666', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/terms" style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#666', textDecoration: 'none' }}>Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function FAQItem({ q, a }: { q: string; a: string | React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full py-5 text-left flex items-center justify-between gap-4"
      >
        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 16, color: '#1F1F1E', letterSpacing: '-0.3px' }}>{q}</span>
        <span style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#666', transition: 'transform 0.2s', transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14" /></svg>
        </span>
      </button>
      {open && (
        <div className="pb-5">
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#666', lineHeight: 1.65 }}>{a}</p>
        </div>
      )}
    </div>
  );
}

const SL_FAQS = [
  {
    q: '1. What is StaleListings.com?',
    a: 'StaleListings.com helps homeowners identify what may be slowing down their home sale, with personalised recommendations powered by property data and experienced local agent insights.',
  },
  {
    q: '2. Who is this for?',
    a: (
      <span>The platform is designed for:<br />• homeowners preparing to sell<br />• sellers already on the market<br />• homeowners whose listings have gone stale<br />• anyone wanting a second opinion on their sale strategy</span>
    ),
  },
  {
    q: '3. How does it work?',
    a: 'Simply enter your property details or upload your listing link. We analyse your home and provide actionable recommendations to improve buyer appeal and selling potential.',
  },
  {
    q: '4. Do I need to switch estate agents?',
    a: 'No. Our recommendations are designed to work alongside your current estate agent.',
  },
  {
    q: '5. Can I use this before listing my home?',
    a: 'Yes. Many homeowners use StaleListings.com before going live to avoid common listing mistakes.',
  },
];

const TESTIMONIALS = [
  { text: 'After 3 months with barely any viewings, StaleListings helped us spot issues with our photos and pricing strategy. We updated the listing and received two offers within weeks', name: '— Sarah M.' },
  { text: 'Our estate agent was great, but having an extra layer of analysis made a huge difference. The recommendations were detailed, practical, and easy to implement.', name: '— James & Olivia R.' },
  { text: "We used StaleListings before putting our house on the market and avoided mistakes that probably would've cost us months. The report was incredibly helpful.", name: '— Daniel P.' },
  { text: 'The insights felt like having a second opinion from someone who actually understood buyer behaviour. Small changes made a surprisingly big impact.', name: '— Priya K.' },
  { text: 'Our listing had gone stale after 10 weeks. StaleListings identified presentation and description issues our agent never mentioned. Viewings picked up almost immediately', name: '— Emma L.' },
  { text: "What I liked most was that we didn't need to change agents. We simply used the recommendations alongside our current estate agent and improved the listing.", name: '— Michael T.' },
];

const PurpleHouseIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
    <path d="M5 19.9825V24.1665C5 29.6662 5 32.416 6.70855 34.1247C8.41708 35.8332 11.1669 35.8332 16.6667 35.8332H23.3333C28.833 35.8332 31.5828 35.8332 33.2915 34.1247C35 32.416 35 29.6662 35 24.1665V19.9825C35 17.1803 35 15.7794 34.4068 14.5666C33.8137 13.3538 32.7078 12.4936 30.496 10.7734L27.1627 8.18075C23.7218 5.50459 22.0015 4.1665 20 4.1665C17.9985 4.1665 16.2782 5.50459 12.8374 8.18075L9.50402 10.7734C7.29222 12.4936 6.18632 13.3538 5.59317 14.5666C5 15.7794 5 17.1803 5 19.9825Z" stroke="#A409D2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M28.333 29.1667V22.5" stroke="#A409D2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PurpleLightbulbIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
    <path d="M10.149 24.9986C9.51836 23.5809 9.16675 22.0038 9.16675 20.3418C9.16675 14.1692 14.017 9.16528 20.0001 9.16528C25.9832 9.16528 30.8334 14.1692 30.8334 20.3418C30.8334 22.0038 30.4818 23.5809 29.8511 24.9986" stroke="#A409D2" strokeWidth="3" strokeLinecap="round"/>
    <path d="M20 3.33191V4.99858" stroke="#A409D2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M36.6667 19.9988H35" stroke="#A409D2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4.99992 19.9988H3.33325" stroke="#A409D2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M31.784 8.21313L30.6055 9.39165" stroke="#A409D2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.39458 9.39324L8.21606 8.21472" stroke="#A409D2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M24.1951 32.1759C25.8791 31.6313 26.5544 30.0899 26.7444 28.5396C26.8011 28.0764 26.4201 27.6923 25.9534 27.6923L14.1282 27.6926C13.6455 27.6926 13.2579 28.1023 13.3155 28.5814C13.5016 30.1288 13.9713 31.2591 15.7558 32.1759M24.1951 32.1759C24.1951 32.1759 16.0496 32.1759 15.7558 32.1759M24.1951 32.1759C23.9926 35.4176 23.0564 36.7014 20.0114 36.6654C16.7544 36.7256 16.0051 35.1388 15.7558 32.1759" stroke="#A409D2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PurpleHandshakeIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
    <path d="M36.6663 11.2498H32.0182C31.0163 11.2498 30.5153 11.2498 30.043 11.1068C29.5707 10.9638 29.1538 10.6859 28.3202 10.1302C27.0698 9.29655 25.6433 8.34559 24.9347 8.13104C24.2262 7.9165 23.4747 7.9165 21.9718 7.9165C19.9282 7.9165 18.6108 7.9165 17.692 8.2971C16.7732 8.6777 16.0506 9.40029 14.6055 10.8454L13.3337 12.1172C13.008 12.4429 12.8451 12.6058 12.7446 12.7665C12.3719 13.3625 12.4132 14.1283 12.8478 14.6807C12.9651 14.8297 13.1445 14.9741 13.5033 15.2629C14.8296 16.3302 16.7417 16.2237 17.9427 15.0155L19.9997 12.9463H21.6663L31.6663 23.0058C32.5868 23.9318 32.5868 25.433 31.6663 26.359C30.7458 27.285 29.2535 27.285 28.333 26.359L27.4997 25.5206M22.4997 27.1973L24.1663 28.8738C25.0868 29.7998 26.5792 29.7998 27.4997 28.8738C28.4202 27.948 28.4202 26.4466 27.4997 25.5206L22.4997 20.491M19.1663 23.864L22.4997 27.1973C23.4202 28.1231 23.4202 29.6245 22.4997 30.5505C21.5792 31.4763 20.0868 31.4763 19.1663 30.5505L16.6663 28.0355M3.33301 24.5831H3.86457C5.24647 24.5831 5.93744 24.5831 6.55692 24.8435C7.17641 25.104 7.65992 25.5975 8.62696 26.5846L13.333 31.3888C14.2535 32.3146 15.7459 32.3146 16.6663 31.3888C17.5868 30.4628 17.5868 28.9615 16.6663 28.0355L15.833 27.1973" stroke="#A409D2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M36.6667 24.5835H32.5" stroke="#A409D2" strokeWidth="3" strokeLinecap="round"/>
    <path d="M14.1663 11.25H3.33301" stroke="#A409D2" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

const TrustpilotStars = () => (
  <svg width="100" height="20" viewBox="0 0 160 30" fill="none">
    <rect width="30" height="30" fill="#00B67A"/>
    <rect x="32.5" width="30" height="30" fill="#00B67A"/>
    <rect x="65" width="30" height="30" fill="#00B67A"/>
    <rect x="97.5" width="30" height="30" fill="#00B67A"/>
    <rect x="130" width="30" height="30" fill="#00B67A"/>
    <path d="M15 20.2183L19.5625 19.062L21.4687 24.937L15 20.2183ZM25.5 12.6245H17.4688L15 5.06201L12.5312 12.6245H4.5L11 17.312L8.53125 24.8745L15.0312 20.187L19.0312 17.312L25.5 12.6245Z" fill="white"/>
    <path d="M47.5 20.2183L52.0625 19.062L53.9687 24.937L47.5 20.2183ZM58 12.6245H49.9687L47.5 5.06201L45.0313 12.6245H37L43.5 17.312L41.0312 24.8745L47.5312 20.187L51.5312 17.312L58 12.6245Z" fill="white"/>
    <path d="M80 20.2183L84.5625 19.062L86.4688 24.937L80 20.2183ZM90.5 12.6245H82.4687L80 5.06201L77.5313 12.6245H69.5L76 17.312L73.5313 24.8745L80.0313 20.187L84.0312 17.312L90.5 12.6245Z" fill="white"/>
    <path d="M112.5 20.2183L117.063 19.062L118.969 24.937L112.5 20.2183ZM123 12.6245H114.969L112.5 5.06201L110.031 12.6245H102L108.5 17.312L106.031 24.8745L112.531 20.187L116.531 17.312L123 12.6245Z" fill="white"/>
    <path d="M145 20.2183L149.563 19.062L151.469 24.937L145 20.2183ZM155.5 12.6245H147.469L145 5.06201L142.531 12.6245H134.5L141 17.312L138.531 24.8745L145.031 20.187L149.031 17.312L155.5 12.6245Z" fill="white"/>
  </svg>
);

const QuoteIcon = () => (
  <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
    <path d="M0 22V13.2C0 5.86667 3.46667 1.46667 10.4 0L11.6 2.4C8.66667 3.2 6.93333 5.06667 6.4 8H12V22H0ZM16 22V13.2C16 5.86667 19.4667 1.46667 26.4 0L27.6 2.4C24.6667 3.2 22.9333 5.06667 22.4 8H28V22H16Z" fill="#A409D2" fillOpacity="0.15"/>
  </svg>
);

const CheckIcon = ({ purple = false }: { purple?: boolean }) => (
  <svg className="flex-shrink-0 mt-0.5" width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M4 10L8 14L16 6" stroke={purple ? '#A409D2' : '#313131'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function StaleListingsLanding() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [faqCount, setFaqCount] = useState(3);

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

  const PLANS = [
    {
      id: 'quick_insight',
      name: 'Quick Insight',
      price: '£79.99',
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
      featured: false,
    },
    {
      id: 'professional_review',
      name: 'Professional Review',
      price: '£299.99',
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
      featured: false,
      bestValue: true,
    },
    {
      id: 'premium_strategy',
      name: 'Premium Strategy',
      price: '£1,499.99',
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
      featured: false,
    },
  ];

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#fff', minHeight: '100vh' }}>

      {/* NAVBAR */}
      <header style={{ background: '#fff', borderBottom: '1px solid #F4F4F4', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 24px', height: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 22, color: '#313131', letterSpacing: '-0.5px', lineHeight: 1 }}>StaleListings</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 11, color: '#888', letterSpacing: 0.2 }}>by HAVLO</span>
          </div>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <a href="#how-it-works" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 15, color: '#313131', textDecoration: 'none', opacity: 0.8 }}>How it works</a>
            <a href="#faq" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 15, color: '#313131', textDecoration: 'none', opacity: 0.8 }}>Faq</a>
            <a href="#pricing" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 15, color: '#313131', textDecoration: 'none', opacity: 0.8 }}>Pricing</a>
            <button onClick={handleStart} style={{ background: '#313131', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, padding: '12px 24px', borderRadius: 48, border: 'none', cursor: 'pointer', letterSpacing: '-0.2px' }}>
              Start Assessment
            </button>
          </nav>
        </div>
        {/* Mobile nav */}
        <style>{`
          @media (max-width: 768px) {
            .sl-desktop-nav { display: none !important; }
            .sl-mobile-btn { display: flex !important; }
          }
          @media (min-width: 769px) {
            .sl-mobile-btn { display: none !important; }
          }
        `}</style>
      </header>

      {/* HERO */}
      <section style={{ background: '#fff', overflow: 'hidden', position: 'relative', padding: '80px 24px 64px' }}>
        {/* Pink blur blob */}
        <div style={{ position: 'absolute', right: -200, top: -160, width: 700, height: 580, borderRadius: '50%', background: '#FFB0E6', filter: 'blur(180px)', opacity: 0.55, pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1240, margin: '0 auto', position: 'relative' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 'clamp(40px, 6vw, 72px)', color: '#1F1F1E', lineHeight: 1.08, letterSpacing: '-2px', marginBottom: 24, marginTop: 0 }}>
              Don't Let Your Home<br />Sit on the Market
            </h1>
            <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 18, color: '#444', lineHeight: 1.65, letterSpacing: '-0.3px', marginBottom: 40, maxWidth: 620, margin: '0 auto 40px' }}>
              Whether you're preparing to sell or already on the market, get personalised insights combining data-driven analysis with experienced local agent expertise to help your home sell faster — all while working with your current agent, no switching required.
            </p>

            {/* Input */}
            <div style={{ display: 'flex', alignItems: 'center', background: '#EEF0F2', borderRadius: 12, padding: '6px 6px 6px 16px', maxWidth: 620, margin: '0 auto 16px', gap: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
                <path d="M3 11.9896V14.5C3 17.7998 3 19.4497 4.02513 20.4749C5.05025 21.5 6.70017 21.5 10 21.5H14C17.2998 21.5 18.9497 21.5 19.9749 20.4749C21 19.4497 21 17.7998 21 14.5V11.9896C21 10.3083 21 9.46773 20.6441 8.74005C20.2882 8.01237 19.6247 7.49628 18.2976 6.46411L16.2976 4.90855C14.2331 3.30285 13.2009 2.5 12 2.5C10.7991 2.5 9.76689 3.30285 7.70242 4.90855L5.70241 6.46411C4.37533 7.49628 3.71179 8.01237 3.3559 8.74005C3 9.46773 3 10.3083 3 11.9896Z" stroke="#313131" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 17.5V13.5" stroke="#313131" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleStart()}
                placeholder="Enter property address or listing url"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#1F1F1E', letterSpacing: '-0.2px' }}
              />
              <button
                onClick={handleStart}
                style={{ background: '#313131', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, padding: '12px 22px', borderRadius: 8, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '-0.2px' }}
              >
                Assess my home
              </button>
            </div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#999', letterSpacing: '-0.1px' }}>Free to start · Paid reports from £79.99 · No commitment required</p>

            {/* Trustpilot */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 32 }}>
              <TrustpilotStars />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: '#1F1F1E' }}>Excellent</div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#666' }}>Based on verified customer feedback</div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap', marginTop: 64 }}>
            {[
              { value: '10K+', label: 'Listings Analyzed' },
              { value: '91K+', label: 'Seller Recommendations Generated' },
              { value: '250K+', label: 'Property Data Points Analyzed' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', minWidth: 140 }}>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, fontSize: 32, color: '#1F1F1E', letterSpacing: '-1px', lineHeight: 1.1 }}>{s.value}</div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#666', marginTop: 6, letterSpacing: '-0.1px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '40px 24px 64px', background: '#fff' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div style={{ background: '#EEF0F2', borderRadius: 32, padding: '56px 56px 48px', border: '1px solid rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 'clamp(26px, 3.5vw, 40px)', color: '#1F1F1E', letterSpacing: '-1px', lineHeight: 1.15, marginBottom: 48, maxWidth: 620 }}>
              Homes that sit too long lose buyer attention. Yours doesn't have to.
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 40 }}>
              {[
                {
                  icon: <PurpleHouseIcon />,
                  title: 'Spot What Buyers Notice',
                  desc: 'Uncover the small issues that can reduce buyer interest and slow down your sale.',
                },
                {
                  icon: <PurpleLightbulbIcon />,
                  title: 'Expert-Backed Selling Insights',
                  desc: 'Combine data-driven analysis with experienced local property expertise.',
                },
                {
                  icon: <PurpleHandshakeIcon />,
                  title: 'Works With Your Current Agent',
                  desc: 'Use our recommendations alongside your existing estate agent, no switching required.',
                },
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {f.icon}
                  <div>
                    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, fontSize: 22, color: '#1F1F1E', letterSpacing: '-0.5px', marginBottom: 12 }}>{f.title}</div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, color: '#444', lineHeight: 1.6, letterSpacing: '-0.2px' }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ padding: '24px 24px 64px', background: '#fff' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', gap: 20, flexWrap: 'wrap' }}>

          {/* Step 1 */}
          <div style={{ flex: '1 1 300px', background: '#EEF0F2', borderRadius: 32, padding: '48px 40px', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div>
              <div style={{ background: '#000', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 12, padding: '4px 12px', borderRadius: 20, display: 'inline-block', marginBottom: 20, letterSpacing: 0.3 }}>Step 1</div>
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, fontSize: 28, color: '#1F1F1E', letterSpacing: '-0.7px', lineHeight: 1.2 }}>Tell Us About Your Home</div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#666', marginTop: 12, lineHeight: 1.6 }}>Enter your property details, upload your listing, or share your Rightmove/Zoopla link to start your analysis.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['Enter property address…', 'Paste Rightmove / Zoopla URL…', 'Upload listing document'].map((p, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 12V14.5C3 17.8 3 19.45 4.025 20.475C5.05 21.5 6.7 21.5 10 21.5H14C17.3 21.5 18.95 21.5 19.975 20.475C21 19.45 21 17.8 21 14.5V12C21 10.31 21 9.47 20.644 8.74C20.288 8.01 19.625 7.5 18.298 6.464L16.298 4.909C14.233 3.303 13.201 2.5 12 2.5C10.799 2.5 9.767 3.303 7.702 4.909L5.702 6.464C4.375 7.5 3.712 8.01 3.356 8.74C3 9.47 3 10.31 3 12Z" stroke="#313131" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#888' }}>{p}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ flex: '1 1 300px', background: '#EEF0F2', borderRadius: 32, padding: '48px 40px', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div>
              <div style={{ background: '#000', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 12, padding: '4px 12px', borderRadius: 20, display: 'inline-block', marginBottom: 20, letterSpacing: 0.3 }}>Step 2</div>
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, fontSize: 28, color: '#1F1F1E', letterSpacing: '-0.7px', lineHeight: 1.2 }}>Get personalised selling insights</div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#666', marginTop: 12, lineHeight: 1.6 }}>We analyse your home using property data, buyer trends, and experienced local agent expertise to uncover what could improve your sale.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { title: 'Property data', sub: 'Pricing trends & comparables' },
                { title: 'Buyer trends', sub: 'What buyers are searching for' },
                { title: 'Local agent expertise', sub: 'Human insight, not just algorithms' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#A409D2', flexShrink: 0, marginTop: 5 }} />
                  <div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, color: '#1F1F1E' }}>{item.title}</div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#888', marginTop: 2 }}>{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ flex: '1 1 300px', background: '#EEF0F2', borderRadius: 32, padding: '48px 40px', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div>
              <div style={{ background: '#000', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 12, padding: '4px 12px', borderRadius: 20, display: 'inline-block', marginBottom: 20, letterSpacing: 0.3 }}>Step 3</div>
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, fontSize: 28, color: '#1F1F1E', letterSpacing: '-0.7px', lineHeight: 1.2 }}>Improve your chances of a faster sale</div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#666', marginTop: 12, lineHeight: 1.6 }}>Receive your expert report within 6–12 hours, with actionable recommendations you can implement alongside your current estate agent.</div>
            </div>
            <div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, color: '#1F1F1E', marginBottom: 14 }}>Your report includes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Pricing insights', 'Photo improvements', 'Listing description feedback', 'Buyer appeal suggestions', 'Market positioning recommendations'].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckIcon />
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#444' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '64px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div style={{ background: '#EEF0F2', borderRadius: 32, padding: '56px 48px', border: '1px solid rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 'clamp(24px, 3vw, 36px)', color: '#1F1F1E', letterSpacing: '-0.8px', marginBottom: 40, textAlign: 'center' }}>
              See why sellers trust our insights
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {TESTIMONIALS.map((t, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 20, padding: '28px 28px 24px', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <QuoteIcon />
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#444', lineHeight: 1.65, margin: '16px 0 20px', letterSpacing: '-0.2px' }}>"{t.text}"</p>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, color: '#1F1F1E' }}>{t.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: '64px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 'clamp(24px, 3vw, 36px)', color: '#1F1F1E', letterSpacing: '-0.8px', marginBottom: 8, textAlign: 'center' }}>
            Everything you need to know
          </h2>
          <div style={{ marginTop: 40 }}>
            {SL_FAQS.slice(0, faqCount).map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
          {faqCount < SL_FAQS.length && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button onClick={() => setFaqCount(SL_FAQS.length)} style={{ background: 'transparent', border: '1px solid rgba(0,0,0,0.2)', borderRadius: 48, padding: '10px 28px', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, color: '#313131', cursor: 'pointer' }}>
                Load more
              </button>
            </div>
          )}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: '64px 24px', background: '#EEF0F2' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 'clamp(24px, 3vw, 40px)', color: '#1F1F1E', letterSpacing: '-1px', marginBottom: 8 }}>
              Choose your assessment
            </h2>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, color: '#666', letterSpacing: '-0.2px' }}>One-time report. No subscriptions. No hidden fees.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
            {PLANS.map((plan, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 24, padding: '40px 36px', border: plan.bestValue ? '2px solid #A409D2' : '1px solid rgba(0,0,0,0.08)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                {plan.bestValue && (
                  <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#A409D2', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: 0.8, padding: '5px 16px', borderRadius: 20 }}>
                    BEST VALUE
                  </div>
                )}
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 22, color: '#1F1F1E', letterSpacing: '-0.5px', marginBottom: 8 }}>{plan.name}</div>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 32, color: '#1F1F1E', letterSpacing: '-1px', marginBottom: 12 }}>{plan.price}</div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#666', lineHeight: 1.5, marginBottom: 24 }}>{plan.tagline}</div>
                {plan.preNote && (
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#888', marginBottom: 16, fontStyle: 'italic' }}>{plan.preNote}</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, marginBottom: 28 }}>
                  {plan.features.map((f, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <CheckIcon purple={plan.bestValue} />
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#444', lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: '#313131', marginBottom: 16, textAlign: 'center' }}>{plan.price} per report</div>
                <button
                  onClick={handleStart}
                  style={{ width: '100%', padding: '14px', borderRadius: 48, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, background: '#313131', color: '#fff', letterSpacing: '-0.2px' }}
                >
                  Start Assessment
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section style={{ padding: '80px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 'clamp(24px, 3.5vw, 40px)', color: '#1F1F1E', letterSpacing: '-1px', lineHeight: 1.2, marginBottom: 20 }}>
            Find out why your property isn't selling and what you can do to improve it.
          </h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, color: '#666', lineHeight: 1.65, marginBottom: 40, maxWidth: 640, margin: '0 auto 40px' }}>
            Get expert insights, market analysis, and professional recommendations designed to help position your property more effectively and attract the right buyers faster.
          </p>

          {/* Placeholder grey square image (from Figma) */}
          <div style={{ background: '#EEF0F2', borderRadius: 24, width: '100%', maxWidth: 700, height: 220, margin: '0 auto 40px', border: '1px solid rgba(0,0,0,0.06)' }} />

          <button
            onClick={handleStart}
            style={{ background: '#313131', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, padding: '16px 40px', borderRadius: 48, border: 'none', cursor: 'pointer', letterSpacing: '-0.2px' }}
          >
            Start Assessment →
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#fff', borderTop: '1px solid #F4F4F4', padding: '28px 24px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#999' }}>© 2025 StaleListings. All rights reserved.</div>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="/privacy-policy" style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#999', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/terms" style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#999', textDecoration: 'none' }}>Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* ── purple brand colour from Figma ── */
const PURPLE = '#A409D2';

/* ─────────────────── SVG ICONS (exact Figma paths) ─────────────────── */
const HouseIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{overflow:'hidden',flexShrink:0}}>
    <path d="M5 19.9825V24.1665C5 29.6662 5 32.416 6.70855 34.1247C8.41708 35.8332 11.1669 35.8332 16.6667 35.8332H23.3333C28.833 35.8332 31.5828 35.8332 33.2915 34.1247C35 32.416 35 29.6662 35 24.1665V19.9825C35 17.1803 35 15.7794 34.4068 14.5666C33.8137 13.3538 32.7078 12.4936 30.496 10.7734L27.1627 8.18075C23.7218 5.50459 22.0015 4.1665 20 4.1665C17.9985 4.1665 16.2782 5.50459 12.8374 8.18075L9.50402 10.7734C7.29222 12.4936 6.18632 13.3538 5.59317 14.5666C5 15.7794 5 17.1803 5 19.9825Z" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M28.333 29.1667V22.5" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const BulbIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{overflow:'hidden',flexShrink:0}}>
    <path d="M10.149 24.9986C9.51836 23.5809 9.16675 22.0038 9.16675 20.3418C9.16675 14.1692 14.017 9.16528 20.0001 9.16528C25.9832 9.16528 30.8334 14.1692 30.8334 20.3418C30.8334 22.0038 30.4818 23.5809 29.8511 24.9986" stroke={PURPLE} strokeWidth="3" strokeLinecap="round"/>
    <path d="M20 3.33191V4.99858" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M36.6667 19.9988H35" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4.99992 19.9988H3.33325" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M31.784 8.21313L30.6055 9.39165" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.39458 9.39324L8.21606 8.21472" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M24.1951 32.1759C25.8791 31.6313 26.5544 30.0899 26.7444 28.5396C26.8011 28.0764 26.4201 27.6923 25.9534 27.6923L14.1282 27.6926C13.6455 27.6926 13.2579 28.1023 13.3155 28.5814C13.5016 30.1288 13.9713 31.2591 15.7558 32.1759M24.1951 32.1759C24.1951 32.1759 16.0496 32.1759 15.7558 32.1759M24.1951 32.1759C23.9926 35.4176 23.0564 36.7014 20.0114 36.6654C16.7544 36.7256 16.0051 35.1388 15.7558 32.1759" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const HandshakeIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{overflow:'hidden',flexShrink:0}}>
    <path d="M36.6663 11.2498H32.0182C31.0163 11.2498 30.5153 11.2498 30.043 11.1068C29.5707 10.9638 29.1538 10.6859 28.3202 10.1302C27.0698 9.29655 25.6433 8.34559 24.9347 8.13104C24.2262 7.9165 23.4747 7.9165 21.9718 7.9165C19.9282 7.9165 18.6108 7.9165 17.692 8.2971C16.7732 8.6777 16.0506 9.40029 14.6055 10.8454L13.3337 12.1172C13.008 12.4429 12.8451 12.6058 12.7446 12.7665C12.3719 13.3625 12.4132 14.1283 12.8478 14.6807C12.9651 14.8297 13.1445 14.9741 13.5033 15.2629C14.8296 16.3302 16.7417 16.2237 17.9427 15.0155L19.9997 12.9463H21.6663L31.6663 23.0058C32.5868 23.9318 32.5868 25.433 31.6663 26.359C30.7458 27.285 29.2535 27.285 28.333 26.359L27.4997 25.5206M22.4997 27.1973L24.1663 28.8738C25.0868 29.7998 26.5792 29.7998 27.4997 28.8738C28.4202 27.948 28.4202 26.4466 27.4997 25.5206L22.4997 20.491M19.1663 23.864L22.4997 27.1973C23.4202 28.1231 23.4202 29.6245 22.4997 30.5505C21.5792 31.4763 20.0868 31.4763 19.1663 30.5505L16.6663 28.0355M3.33301 24.5831H3.86457C5.24647 24.5831 5.93744 24.5831 6.55692 24.8435C7.17641 25.104 7.65992 25.5975 8.62696 26.5846L13.333 31.3888C14.2535 32.3146 15.7459 32.3146 16.6663 31.3888C17.5868 30.4628 17.5868 28.9615 16.6663 28.0355L15.833 27.1973" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M36.6667 24.5835H32.5" stroke={PURPLE} strokeWidth="3" strokeLinecap="round"/>
    <path d="M14.1663 11.25H3.33301" stroke={PURPLE} strokeWidth="3" strokeLinecap="round"/>
  </svg>
);
const QuoteIcon = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{aspectRatio:'1/1',overflow:'hidden',flexShrink:0}}>
    <path d="M10.6321 40.1825C8.24261 37.6446 6.95972 34.7981 6.95972 30.1839C6.95972 22.0643 12.6597 14.7868 20.9486 11.1887L23.0202 14.3855C15.2834 18.5706 13.7709 24.0014 13.1677 27.4255C14.4135 26.7806 16.0443 26.5556 17.6427 26.704C21.8278 27.0915 25.1267 30.5272 25.1267 34.7981C25.1267 36.9515 24.2712 39.0168 22.7485 40.5395C21.2258 42.0622 19.1605 42.9177 17.0071 42.9177C15.8162 42.9074 14.6392 42.6603 13.5447 42.1907C12.4503 41.7211 11.4602 41.0385 10.6321 40.1825ZM33.8308 40.1825C31.4414 37.6446 30.1585 34.7981 30.1585 30.1839C30.1585 22.0643 35.8584 14.7868 44.1473 11.1887L46.219 14.3855C38.4822 18.5706 36.9696 24.0014 36.3665 27.4255C37.6122 26.7806 39.2431 26.5556 40.8415 26.704C45.0266 27.0915 48.3254 30.5272 48.3254 34.7981C48.3254 36.9515 47.47 39.0168 45.9473 40.5395C44.4245 42.0622 42.3593 42.9177 40.2059 42.9177C39.0149 42.9074 37.838 42.6603 36.7435 42.1907C35.649 41.7211 34.6589 41.0385 33.8308 40.1825Z" fill={PURPLE}/>
  </svg>
);
const TrustpilotStars = () => (
  <svg width="160" height="30" viewBox="0 0 160 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="30" height="30" fill="#00B67A"/><rect x="32.5" width="30" height="30" fill="#00B67A"/><rect x="65" width="30" height="30" fill="#00B67A"/><rect x="97.5" width="30" height="30" fill="#00B67A"/><rect x="130" width="30" height="30" fill="#00B67A"/>
    <path d="M15 20.2183L19.5625 19.062L21.4687 24.937L15 20.2183ZM25.5 12.6245H17.4688L15 5.06201L12.5312 12.6245H4.5L11 17.312L8.53125 24.8745L15.0312 20.187L19.0312 17.312L25.5 12.6245Z" fill="white"/>
    <path d="M47.5 20.2183L52.0625 19.062L53.9687 24.937L47.5 20.2183ZM58 12.6245H49.9687L47.5 5.06201L45.0313 12.6245H37L43.5 17.312L41.0312 24.8745L47.5312 20.187L51.5312 17.312L58 12.6245Z" fill="white"/>
    <path d="M80 20.2183L84.5625 19.062L86.4688 24.937L80 20.2183ZM90.5 12.6245H82.4687L80 5.06201L77.5313 12.6245H69.5L76 17.312L73.5313 24.8745L80.0313 20.187L84.0312 17.312L90.5 12.6245Z" fill="white"/>
    <path d="M112.5 20.2183L117.063 19.062L118.969 24.937L112.5 20.2183ZM123 12.6245H114.969L112.5 5.06201L110.031 12.6245H102L108.5 17.312L106.031 24.8745L112.531 20.187L116.531 17.312L123 12.6245Z" fill="white"/>
    <path d="M145 20.2183L149.563 19.062L151.469 24.937L145 20.2183ZM155.5 12.6245H147.469L145 5.06201L142.531 12.6245H134.5L141 17.312L138.531 24.8745L145.031 20.187L149.031 17.312L155.5 12.6245Z" fill="white"/>
  </svg>
);
const VerifyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M14.3733 7.16036L13.4667 6.10703C13.2933 5.90703 13.1533 5.5337 13.1533 5.26703V4.1337C13.1533 3.42703 12.5733 2.84703 11.8667 2.84703H10.7333C10.4733 2.84703 10.0933 2.70703 9.89334 2.5337L8.84 1.62703C8.38 1.2337 7.62667 1.2337 7.16 1.62703L6.11334 2.54036C5.91334 2.70703 5.53334 2.84703 5.27334 2.84703H4.12C3.41334 2.84703 2.83334 3.42703 2.83334 4.1337V5.2737C2.83334 5.5337 2.69334 5.90703 2.52667 6.10703L1.62667 7.16703C1.24 7.62703 1.24 8.3737 1.62667 8.8337L2.52667 9.8937C2.69334 10.0937 2.83334 10.467 2.83334 10.727V11.867C2.83334 12.5737 3.41334 13.1537 4.12 13.1537H5.27334C5.53334 13.1537 5.91334 13.2937 6.11334 13.467L7.16667 14.3737C7.62667 14.767 8.38 14.767 8.84667 14.3737L9.9 13.467C10.1 13.2937 10.4733 13.1537 10.74 13.1537H11.8733C12.58 13.1537 13.16 12.5737 13.16 11.867V10.7337C13.16 10.4737 13.3 10.0937 13.4733 9.8937L14.38 8.84036C14.7667 8.38036 14.7667 7.62036 14.3733 7.16036ZM10.7733 6.74036L7.55334 9.96036C7.46 10.0537 7.33334 10.107 7.2 10.107C7.06667 10.107 6.94 10.0537 6.84667 9.96036L5.23334 8.34703C5.04 8.1537 5.04 7.8337 5.23334 7.64036C5.42667 7.44703 5.74667 7.44703 5.94 7.64036L7.2 8.90036L10.0667 6.0337C10.26 5.84036 10.58 5.84036 10.7733 6.0337C10.9667 6.22703 10.9667 6.54703 10.7733 6.74036Z" fill="#149D4F"/>
  </svg>
);
const CheckItemIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M3 8.5l3 3 7-7" stroke="#313131" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M6 12H18" stroke="#020202" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 18V6" stroke="#020202" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const MinusIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M6 12H18" stroke="#020202" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const HomeInputIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 11.9896V14.5C3 17.7998 3 19.4497 4.02513 20.4749C5.05025 21.5 6.70017 21.5 10 21.5H14C17.2998 21.5 18.9497 21.5 19.9749 20.4749C21 19.4497 21 17.7998 21 14.5V11.9896C21 10.3083 21 9.46773 20.6441 8.74005C20.2882 8.01237 19.6247 7.49628 18.2976 6.46411L16.2976 4.90855C14.2331 3.30285 13.2009 2.5 12 2.5C10.7991 2.5 9.76689 3.30285 7.70242 4.90855L5.70241 6.46411C4.37533 7.49628 3.71179 8.01237 3.3559 8.74005C3 9.46773 3 10.3083 3 11.9896Z" stroke="#313131" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16.9998 17.5V13.5" stroke="#313131" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ─────────────────── DATA ─────────────────── */
const ALL_FAQS = [
  { q: '1. What is StaleListings.com?', a: 'StaleListings.com helps homeowners identify what may be slowing down their home sale, with\npersonalized recommendations powered by property data and experienced local agent insights.' },
  { q: '2. Who is this for?', a: 'The platform is designed for:\n• homeowners preparing to sell\n• sellers already on the market\n• homeowners whose listings have gone stale\n• anyone wanting a second opinion on their sale strategy' },
  { q: '3. How does it work?', a: 'Simply enter your property details or upload your listing link. We analyze your home and provide\nactionable recommendations to improve buyer appeal and selling potential.' },
  { q: '4. Do I need to switch estate agents?', a: 'No. Our recommendations are designed to work alongside your current estate agent.' },
  { q: '5. Can I use this before listing my home?', a: 'Yes. Many homeowners use StaleListings.com before going live to avoid common listing mistakes.' },
  { q: '6. How long does the report take?', a: 'Most reports are delivered within 6–12 hours.' },
  { q: '7. What kind of recommendations will I receive?', a: 'Recommendations may include:\n• pricing insights\n• photo improvements\n• presentation tips\n• listing description feedback\n• buyer appeal suggestions\n• market positioning recommendations' },
  { q: '8. Is the analysis automated or reviewed by humans?', a: 'We combine data-driven analysis with experienced local property expertise.' },
  { q: '9. Will you contact my estate agent?', a: 'No, unless you specifically request it.' },
  { q: '10. What if my home is already listed?', a: "That's completely fine. The platform is specifically designed to help improve active listings." },
  { q: '11. Can this help if my home has been on the market for months?', a: 'Yes. Many sellers use StaleListings.com to identify overlooked issues affecting buyer interest.' },
  { q: '12. Do you guarantee my home will sell faster?', a: "No platform can guarantee a sale, but our goal is to help you improve your home's appeal and reduce avoidable listing mistakes." },
  { q: '13. What property websites do you support?', a: 'We currently support listings from major UK property portals including Rightmove and Zoopla.' },
  { q: '14. How detailed is the report?', a: 'Each report is personalized to your property and includes practical, actionable recommendations you can implement immediately.' },
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
    id: 'quick_insight', name: 'Quick Insight', price: '£79.99',
    tagline: 'Vendors wanting a fast professional\nopinion.',
    features: ['Data-driven property market analysis','Human estate agent review','Local comparable sales review','Pricing position check','Online listing performance review','Summary report with key issues slowing the sale','3–5 actionable recommendations','Turnaround: 24–48 hours'],
  },
  {
    id: 'professional_review', name: 'Professional Review', price: '£299.99',
    tagline: 'Serious sellers wanting expert guidance to improve saleability.',
    preNote: 'Includes everything in Quick Insight, plus',
    features: ['Buyer appeal analysis','Listing photography & description review','Local competition benchmarking','"Why buyers may be overlooking this property" section','Recommended pricing strategy','Priority turnaround','Turnaround: 24 hours'],
    popular: true,
  },
  {
    id: 'premium_strategy', name: 'Premium Strategy', price: '£1,499.99',
    tagline: 'High-value homes or properties stuck on the market for months.',
    preNote: 'Includes everything in professional review plus:',
    features: ['Detailed property positioning strategy','Multi-platform listing audit','Area demand and buyer demographic analysis','Home presentation/staging recommendations','Marketing improvement roadmap','Re-launch strategy','Estate agent strategy review with improvement recommendations','Follow-up review after changes are implemented','Direct access for Q&A support for 14–30 days','24 hours + follow-up support'],
  },
];

/* ─────────────────── FAQ ITEM ─────────────────── */
function FAQItem({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div style={{ display:'flex', padding:'24px 0', justifyContent:'center', alignItems:'center', gap:8, alignSelf:'stretch', borderBottom:'1px solid rgba(0,0,0,0.10)' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:24, flex:'1 0 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', alignSelf:'stretch' }}>
          <div style={{ color:'#000', fontFamily:'Plus Jakarta Sans, sans-serif', fontSize:20, fontWeight:700, lineHeight:'150%', letterSpacing:'-0.4px' }}>{q}</div>
          <button onClick={() => setOpen(!open)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex' }}>
            {open ? <MinusIcon /> : <PlusIcon />}
          </button>
        </div>
        {open && (
          <div style={{ alignSelf:'stretch', color:'#000', fontFamily:'Inter, sans-serif', fontSize:18, fontWeight:400, lineHeight:'150%', letterSpacing:'-0.054px', whiteSpace:'pre-line' }}>{a}</div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────── MAIN COMPONENT ─────────────────── */
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
    <div style={{ fontFamily:'Inter, sans-serif', background:'#fff', minHeight:'100vh', overflowX:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap');
        .sl-nav-links-desktop { display:flex; }
        .sl-hero-right { display:flex; }
        .sl-features-cols { grid-template-columns: repeat(3,1fr); }
        .sl-steps-cols { grid-template-columns: repeat(3,1fr); }
        .sl-testimonial-row { flex-direction:row; }
        .sl-plans-cols { grid-template-columns: repeat(3,1fr); }
        @media(max-width:900px) {
          .sl-nav-links-desktop { display:none !important; }
          .sl-hero-right { display:none !important; }
          .sl-features-cols { grid-template-columns: 1fr !important; }
          .sl-steps-cols { grid-template-columns: 1fr !important; }
          .sl-testimonial-row { flex-direction:column !important; }
          .sl-plans-cols { grid-template-columns: 1fr !important; }
          .sl-faq-padding { padding:48px 24px !important; }
          .sl-section-padding { padding:40px 24px !important; }
          .sl-hero-heading { font-size:36px !important; }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <header style={{ background:'#FFF', borderBottom:'1px solid #F4F4F4', backdropFilter:'blur(5px)', position:'sticky', top:0, zIndex:50 }}>
        <div className="sl-section-padding" style={{ maxWidth:1440, margin:'0 auto', padding:'0 100px', height:80, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          {/* Logo */}
          <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-start' }}>
            <span style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:800, fontSize:26, color:'#313131', letterSpacing:'-0.5px', lineHeight:1 }}>StaleListings</span>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ fontFamily:'Inter, sans-serif', fontSize:13, color:'#000', fontWeight:400 }}>By</span>
              <span style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:800, fontSize:13, color:'#313131', letterSpacing:'-0.3px' }}>HAVLO</span>
            </div>
          </div>
          {/* Nav links + CTA */}
          <div style={{ display:'flex', alignItems:'center', gap:32 }}>
            <nav className="sl-nav-links-desktop" style={{ display:'flex', alignItems:'center', gap:40 }}>
              {['How it works','Faq','Pricing'].map((l, i) => (
                <a key={i} href={l === 'How it works' ? '#how-it-works' : l === 'Faq' ? '#faq' : '#pricing'} style={{ color:'#000', fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:600, letterSpacing:'-0.32px', opacity:0.8, textDecoration:'none' }}>{l}</a>
              ))}
            </nav>
            <button onClick={handleStart} style={{ display:'flex', height:48, padding:'12px 20px', justifyContent:'center', alignItems:'center', gap:4, borderRadius:48, background:'#000', color:'#FFF', fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:700, letterSpacing:'-0.32px', border:'none', cursor:'pointer' }}>
              Start Assessment
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section style={{ height:'auto', minHeight:700, background:'#FFF', overflow:'hidden', position:'relative' }}>
        {/* Pink blob */}
        <div style={{ position:'absolute', right:-100, top:-100, width:700, height:600, borderRadius:'50%', background:'#FFB0E6', filter:'blur(140px)', opacity:0.7, pointerEvents:'none', zIndex:0 }} />

        <div className="sl-section-padding" style={{ maxWidth:1440, margin:'0 auto', padding:'60px 100px', position:'relative', zIndex:1, display:'flex', alignItems:'center', gap:60 }}>
          {/* Left col */}
          <div style={{ flex:'1 1 0', minWidth:0 }}>
            <h1 className="sl-hero-heading" style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:700, fontSize:72, color:'#1F1F1E', lineHeight:1.05, letterSpacing:'-2.16px', margin:'0 0 32px' }}>
              Don't Let Your Home Sit<br/>on the Market
            </h1>
            <p style={{ fontFamily:'Inter, sans-serif', fontSize:18, fontWeight:400, color:'#666', lineHeight:'150%', letterSpacing:'-0.36px', marginBottom:32, maxWidth:560 }}>
              Whether you're preparing to sell or already on the market, get personalised insights combining data-driven analysis with experienced local agent expertise to help your home sell faster — all while working with your current agent, no switching required.
            </p>

            {/* Input bar */}
            <div style={{ display:'flex', height:56, padding:'13px 16px', alignItems:'center', gap:12, borderRadius:8, background:'#EEF0F2', maxWidth:580, marginBottom:16 }}>
              <HomeInputIcon />
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleStart()}
                placeholder="Enter property address or listing url"
                style={{ flex:1, background:'transparent', border:'none', outline:'none', fontFamily:'Inter, sans-serif', fontSize:15, color:'#1F1F1E' }}
              />
              <button onClick={handleStart} style={{ display:'flex', height:36, padding:'6px 14px', alignItems:'center', background:'#313131', color:'#FFF', fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:14, borderRadius:6, border:'none', cursor:'pointer', whiteSpace:'nowrap' }}>
                Assess my home
              </button>
            </div>

            {/* Trustpilot */}
            <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:48 }}>
              <TrustpilotStars />
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                <span style={{ fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:16, color:'#000', letterSpacing:'-0.32px' }}>Excellent</span>
                <span style={{ fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:16, color:'#000', letterSpacing:'-0.32px' }}>Based on verified customer feedback</span>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display:'flex', alignItems:'flex-start', gap:23 }}>
              {[['10K+','Listings Analyzed'],['91K+','Seller Recommendations Generated'],['250K+','Property Data Points Analyzed']].map(([val, label], i) => (
                <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:20 }}>
                  <div style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:600, fontSize:32, color:'#1F1F1E', letterSpacing:'-0.96px', lineHeight:'120%' }}>{val}</div>
                  <div style={{ fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:14, color:'#000', letterSpacing:'-0.28px' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right col: house image */}
          <div className="sl-hero-right" style={{ flex:'0 0 500px', height:420, borderRadius:24, overflow:'hidden', flexShrink:0 }}>
            <img src="https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80" alt="Property" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          </div>
        </div>
      </section>

      {/* ── FEATURES (EEF0F2 card) ── */}
      <section style={{ padding:'40px 100px', background:'#FFF' }} className="sl-section-padding">
        <div style={{ maxWidth:1240, margin:'0 auto' }}>
          <div style={{ display:'flex', padding:56, flexDirection:'column', alignItems:'flex-start', gap:32, alignSelf:'stretch', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#EEF0F2', overflow:'hidden' }}>
            <h2 style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:700, fontSize:'clamp(28px,3.5vw,48px)', color:'#1F1F1E', letterSpacing:'-1.44px', lineHeight:'110%', margin:0, maxWidth:700 }}>
              Homes that sit too long lose buyer attention. Yours doesn't have to.
            </h2>
            <div className="sl-features-cols" style={{ display:'grid', gap:40, alignSelf:'stretch' }}>
              {[
                { Icon: HouseIcon, title:'Spot What Buyers Notice', titleSize:32, desc:'Uncover the small issues that can reduce buyer interest and slow down your sale.' },
                { Icon: BulbIcon, title:'Expert-Backed Selling Insights', titleSize:28, desc:'Combine data-driven analysis with experienced local property expertise.' },
                { Icon: HandshakeIcon, title:'Works With Your Current Agent', titleSize:28, desc:'Use our recommendations alongside your existing estate agent, no switching required.' },
              ].map(({ Icon, title, titleSize, desc }, i) => (
                <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:50 }}>
                  <Icon />
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:24, alignSelf:'stretch' }}>
                    <div style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:600, fontSize:titleSize, color:'#1F1F1E', letterSpacing:'-0.96px', lineHeight:'120%' }}>{title}</div>
                    <div style={{ fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:20, color:'#000', letterSpacing:'-0.6px', lineHeight:'150%' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ padding:'40px 100px', background:'#FFF' }} className="sl-section-padding">
        <div style={{ maxWidth:1240, margin:'0 auto', display:'flex', flexDirection:'column', gap:32 }}>

          {/* Step 1 */}
          <div style={{ display:'flex', padding:56, flexDirection:'column', alignItems:'flex-start', gap:32, alignSelf:'stretch', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#EEF0F2', overflow:'hidden' }}>
            <div style={{ display:'flex', width:120, height:48, padding:'12px 20px', justifyContent:'center', alignItems:'center', gap:4, borderRadius:48, background:'#000' }}>
              <span style={{ color:'#FFF', fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:700, letterSpacing:'-0.32px' }}>Step 1</span>
            </div>
            <div style={{ display:'flex', alignItems:'flex-start', gap:32, alignSelf:'stretch', flexWrap:'wrap' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:24, flex:'1 0 300px' }}>
                <div style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:600, fontSize:40, color:'#1F1F1E', letterSpacing:'-1.2px', lineHeight:'120%' }}>Tell Us About Your Home</div>
                <div style={{ fontFamily:'Inter, sans-serif', fontSize:16, color:'#666', lineHeight:'150%' }}>Enter your property details, upload your listing, or share your Rightmove/Zoopla link to start your analysis.</div>
              </div>
              {/* White card mockup */}
              <div style={{ display:'flex', padding:32, flexDirection:'column', alignItems:'flex-start', gap:32, flex:'0 0 400px', borderRadius:32, border:'1px solid rgba(0,0,0,0.10)', background:'#FFF' }}>
                <div style={{ display:'flex', height:56, padding:'13px 16px', alignItems:'center', gap:12, alignSelf:'stretch', borderRadius:8, background:'#EEF0F2' }}>
                  <HomeInputIcon />
                  <span style={{ fontFamily:'Inter, sans-serif', fontSize:14, color:'#999' }}>Enter property address or listing url</span>
                </div>
                {['Paste Rightmove / Zoopla URL…', 'Your Rightmove/Zoopla URL link'].map((p, i) => (
                  <div key={i} style={{ display:'flex', height:48, padding:'13px 16px', alignItems:'center', gap:12, alignSelf:'stretch', borderRadius:8, background:'#EEF0F2', borderBottom:'1px solid rgba(0,0,0,0.02)' }}>
                    <HomeInputIcon />
                    <span style={{ fontFamily:'Inter, sans-serif', fontSize:14, color:'#999' }}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ display:'flex', padding:56, flexDirection:'column', alignItems:'flex-start', gap:32, alignSelf:'stretch', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#EEF0F2', overflow:'hidden' }}>
            <div style={{ display:'flex', width:120, height:48, padding:'12px 20px', justifyContent:'center', alignItems:'center', gap:4, borderRadius:48, background:'#000' }}>
              <span style={{ color:'#FFF', fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:700, letterSpacing:'-0.32px' }}>Step 2</span>
            </div>
            <div style={{ display:'flex', alignItems:'flex-start', gap:32, alignSelf:'stretch', flexWrap:'wrap' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:24, flex:'1 0 300px' }}>
                <div style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:600, fontSize:40, color:'#1F1F1E', letterSpacing:'-1.2px', lineHeight:'120%' }}>Get personalised selling insights</div>
                <div style={{ fontFamily:'Inter, sans-serif', fontSize:16, color:'#666', lineHeight:'150%' }}>We analyse your home using property data, buyer trends, and experienced local agent expertise to uncover what could improve your sale.</div>
              </div>
              <div style={{ display:'flex', padding:32, flexDirection:'column', gap:20, flex:'0 0 400px', borderRadius:32, border:'1px solid rgba(0,0,0,0.10)', background:'#FFF' }}>
                {[{ title:'Property data', sub:'Pricing trends & comparables' }, { title:'Buyer trends', sub:'What buyers are searching for' }, { title:'Local agent expertise', sub:'Human insight, not just algorithms' }].map((item, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:PURPLE, flexShrink:0, marginTop:6 }} />
                    <div>
                      <div style={{ fontFamily:'Inter, sans-serif', fontWeight:600, fontSize:14, color:'#1F1F1E' }}>{item.title}</div>
                      <div style={{ fontFamily:'Inter, sans-serif', fontSize:13, color:'#888', marginTop:2 }}>{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ display:'flex', padding:56, flexDirection:'column', alignItems:'flex-start', gap:32, alignSelf:'stretch', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#EEF0F2', overflow:'hidden' }}>
            <div style={{ display:'flex', width:120, height:48, padding:'12px 20px', justifyContent:'center', alignItems:'center', gap:4, borderRadius:48, background:'#000' }}>
              <span style={{ color:'#FFF', fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:700, letterSpacing:'-0.32px' }}>Step 3</span>
            </div>
            <div style={{ display:'flex', alignItems:'flex-start', gap:32, alignSelf:'stretch', flexWrap:'wrap' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:24, flex:'1 0 300px' }}>
                <div style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:600, fontSize:40, color:'#1F1F1E', letterSpacing:'-1.2px', lineHeight:'120%' }}>Improve your chances of a faster sale</div>
                <div style={{ fontFamily:'Inter, sans-serif', fontSize:16, color:'#666', lineHeight:'150%' }}>Receive your expert report within 6–12 hours, with actionable recommendations you can implement alongside your current estate agent.</div>
              </div>
              <div style={{ display:'flex', padding:32, flexDirection:'column', gap:16, flex:'0 0 400px', borderRadius:32, border:'1px solid rgba(0,0,0,0.10)', background:'#FFF' }}>
                <div style={{ fontFamily:'Inter, sans-serif', fontWeight:600, fontSize:14, color:'#1F1F1E', marginBottom:4 }}>Your report includes</div>
                {['Pricing insights','Photo improvements','Listing description feedback','Buyer appeal suggestions','Market positioning recommendations'].map((item, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <CheckItemIcon />
                    <span style={{ fontFamily:'Inter, sans-serif', fontSize:14, color:'#444' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding:'40px 100px 64px', background:'#FFF' }} className="sl-section-padding">
        <div style={{ maxWidth:1240, margin:'0 auto' }}>
          <div style={{ display:'flex', padding:'40px 40px 56px', flexDirection:'column', alignItems:'flex-start', gap:32, alignSelf:'stretch', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#EEF0F2' }}>
            <h2 style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:700, fontSize:40, color:'#1F1F1E', letterSpacing:'-1.2px', lineHeight:'120%', margin:0 }}>See why sellers trust our insights</h2>

            {/* Row 1 */}
            <div style={{ display:'flex', alignItems:'center', gap:32, alignSelf:'stretch', flexWrap:'wrap' }}>
              {TESTIMONIALS.slice(0, 3).map((t, i) => (
                <div key={i} style={{ display:'flex', padding:24, flexDirection:'column', alignItems:'flex-start', gap:32, flex:'1 0 260px', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#FFF', overflow:'hidden' }}>
                  <QuoteIcon />
                  <div style={{ fontFamily:'Inter, sans-serif', fontSize:20, fontWeight:400, color:'#000', lineHeight:'150%', letterSpacing:'-0.6px' }}>"{t.text}"</div>
                  <div style={{ fontFamily:'Inter, sans-serif', fontSize:20, fontWeight:700, color:'#000', lineHeight:'150%', letterSpacing:'-0.6px' }}>{t.name}</div>
                </div>
              ))}
            </div>
            {/* Row 2 */}
            <div style={{ display:'flex', alignItems:'center', gap:32, alignSelf:'stretch', flexWrap:'wrap' }}>
              {TESTIMONIALS.slice(3).map((t, i) => (
                <div key={i} style={{ display:'flex', padding:24, flexDirection:'column', alignItems:'flex-start', gap:32, flex:'1 0 260px', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#FFF', overflow:'hidden' }}>
                  <QuoteIcon />
                  <div style={{ fontFamily:'Inter, sans-serif', fontSize:20, fontWeight:400, color:'#000', lineHeight:'150%', letterSpacing:'-0.6px' }}>"{t.text}"</div>
                  <div style={{ fontFamily:'Inter, sans-serif', fontSize:20, fontWeight:700, color:'#000', lineHeight:'150%', letterSpacing:'-0.6px' }}>{t.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="sl-faq-padding" style={{ padding:'80px 200px', background:'#FEFFFF' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:40, alignSelf:'stretch' }}>
          <h2 style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:900, fontSize:44, color:'#050405', lineHeight:'110%', margin:0 }}>Evertthing you need to know</h2>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:0, alignSelf:'stretch' }}>
            {faqsToShow.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} defaultOpen={i < 5} />
            ))}
          </div>
          <button
            onClick={() => setShowAllFaq(!showAllFaq)}
            style={{ display:'flex', height:44, padding:'8px 32px', justifyContent:'center', alignItems:'center', gap:8, background:'#000', border:'none', cursor:'pointer' }}
          >
            <span style={{ fontFamily:'Inter Tight, Inter, sans-serif', fontWeight:500, fontSize:16, color:'#FEFFFF', letterSpacing:'-0.32px' }}>
              {showAllFaq ? 'See Less' : 'Load more'}
            </span>
          </button>
        </div>
      </section>

      {/* ── PRICING CTA + PLANS ── */}
      <section id="pricing" style={{ padding:'80px 100px', background:'#FFB0E6', overflow:'hidden' }} className="sl-section-padding">
        <div style={{ maxWidth:1240, margin:'0 auto', display:'flex', flexDirection:'column', alignItems:'center', gap:32 }}>
          <h2 style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:600, fontSize:40, color:'#1F1F1E', textAlign:'center', letterSpacing:'-1.2px', lineHeight:'120%', maxWidth:858, margin:0 }}>
            Find out why your property isn't selling and what you can do to improve it.
          </h2>
          <p style={{ fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:400, color:'#000', textAlign:'center', letterSpacing:'-0.32px', lineHeight:'150%', maxWidth:734, margin:0 }}>
            Get expert insights, market analysis, and professional recommendations designed to help position your property more effectively and attract the right buyers faster.
          </p>

          {/* Plan cards */}
          <div className="sl-plans-cols" style={{ display:'grid', gap:24, alignSelf:'stretch' }}>
            {PLANS.map((plan, i) => (
              <div key={i} style={{ display:'flex', padding:24, flexDirection:'column', justifyContent:'space-between', alignItems:'center', flex:'1 0 0', alignSelf:'stretch', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#FFF', overflow:'hidden' }}>
                {/* Icon placeholder */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:32, alignSelf:'stretch' }}>
                  <div style={{ width:157, height:122, background:'#D9D9D9', borderRadius:8, flexShrink:0 }} />
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:24, alignSelf:'stretch' }}>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:20, alignSelf:'stretch' }}>
                      <div style={{ fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:24, color:'#000', letterSpacing:'-0.72px', lineHeight:'150%' }}>{plan.name}</div>
                      <div style={{ fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:16, color:'#000', letterSpacing:'-0.48px', lineHeight:'120%' }}>{plan.tagline}</div>
                    </div>
                    <div style={{ display:'flex', paddingTop:16, flexDirection:'column', alignItems:'flex-start', gap:16, alignSelf:'stretch', borderTop:'1px solid rgba(0,0,0,0.10)' }}>
                      {plan.preNote && (
                        <div style={{ fontFamily:'Inter, sans-serif', fontSize:13, color:'#888', fontStyle:'italic', marginBottom:4 }}>{plan.preNote}</div>
                      )}
                      {plan.features.map((f, j) => (
                        <div key={j} style={{ display:'flex', alignItems:'center', gap:8, alignSelf:'stretch' }}>
                          <VerifyIcon />
                          <div style={{ fontFamily:'Inter, sans-serif', fontWeight:500, fontSize:14, color:'#050405', letterSpacing:'-0.42px', lineHeight:'120%' }}>{f}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Price + CTA */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, alignSelf:'stretch', marginTop:24 }}>
                  <div style={{ fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:22, color:'#000', textAlign:'center' }}>{plan.price} per report</div>
                  <button onClick={handleStart} style={{ alignSelf:'stretch', padding:'14px', borderRadius:48, border:'none', cursor:'pointer', fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:15, background:'#313131', color:'#FFF' }}>
                    Start Assessment
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background:'#FFF', borderTop:'1px solid #F4F4F4', padding:'28px 100px' }}>
        <div style={{ maxWidth:1240, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            <span style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:800, fontSize:18, color:'#313131' }}>StaleListings</span>
            <span style={{ fontFamily:'Inter, sans-serif', fontSize:11, color:'#999' }}>© 2025 StaleListings. All rights reserved.</span>
          </div>
          <div style={{ display:'flex', gap:24 }}>
            <a href="/privacy-policy" style={{ fontFamily:'Inter, sans-serif', fontSize:13, color:'#999', textDecoration:'none' }}>Privacy Policy</a>
            <a href="/terms" style={{ fontFamily:'Inter, sans-serif', fontSize:13, color:'#999', textDecoration:'none' }}>Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

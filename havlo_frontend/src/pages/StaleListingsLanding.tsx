import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PURPLE = '#A409D2';

/* ─── SVG ICONS ─── */
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
  <svg width="55.68" height="55.68" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M10.6321 40.1825C8.24261 37.6446 6.95972 34.7981 6.95972 30.1839C6.95972 22.0643 12.6597 14.7868 20.9486 11.1887L23.0202 14.3855C15.2834 18.5706 13.7709 24.0014 13.1677 27.4255C14.4135 26.7806 16.0443 26.5556 17.6427 26.704C21.8278 27.0915 25.1267 30.5272 25.1267 34.7981C25.1267 36.9515 24.2712 39.0168 22.7485 40.5395C21.2258 42.0622 19.1605 42.9177 17.0071 42.9177C15.8162 42.9074 14.6392 42.6603 13.5447 42.1907C12.4503 41.7211 11.4602 41.0385 10.6321 40.1825ZM33.8308 40.1825C31.4414 37.6446 30.1585 34.7981 30.1585 30.1839C30.1585 22.0643 35.8584 14.7868 44.1473 11.1887L46.219 14.3855C38.4822 18.5706 36.9696 24.0014 36.3665 27.4255C37.6122 26.7806 39.2431 26.5556 40.8415 26.704C45.0266 27.0915 48.3254 30.5272 48.3254 34.7981C48.3254 36.9515 47.47 39.0168 45.9473 40.5395C44.4245 42.0622 42.3593 42.9177 40.2059 42.9177C39.0149 42.9074 37.838 42.6603 36.7435 42.1907C35.649 41.7211 34.6589 41.0385 33.8308 40.1825Z" fill={PURPLE}/>
  </svg>
);
const TrustpilotStars = () => (
  <svg width="160" height="30" viewBox="0 0 160 30" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
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
const VerifyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M14.3733 7.16036L13.4667 6.10703C13.2933 5.90703 13.1533 5.5337 13.1533 5.26703V4.1337C13.1533 3.42703 12.5733 2.84703 11.8667 2.84703H10.7333C10.4733 2.84703 10.0933 2.70703 9.89334 2.5337L8.84 1.62703C8.38 1.2337 7.62667 1.2337 7.16 1.62703L6.11334 2.54036C5.91334 2.70703 5.53334 2.84703 5.27334 2.84703H4.12C3.41334 2.84703 2.83334 3.42703 2.83334 4.1337V5.2737C2.83334 5.5337 2.69334 5.90703 2.52667 6.10703L1.62667 7.16703C1.24 7.62703 1.24 8.3737 1.62667 8.8337L2.52667 9.8937C2.69334 10.0937 2.83334 10.467 2.83334 10.727V11.867C2.83334 12.5737 3.41334 13.1537 4.12 13.1537H5.27334C5.53334 13.1537 5.91334 13.2937 6.11334 13.467L7.16667 14.3737C7.62667 14.767 8.38 14.767 8.84667 14.3737L9.9 13.467C10.1 13.2937 10.4733 13.1537 10.74 13.1537H11.8733C12.58 13.1537 13.16 12.5737 13.16 11.867V10.7337C13.16 10.4737 13.3 10.0937 13.4733 9.8937L14.38 8.84036C14.7667 8.38036 14.7667 7.62036 14.3733 7.16036ZM10.7733 6.74036L7.55334 9.96036C7.46 10.0537 7.33334 10.107 7.2 10.107C7.06667 10.107 6.94 10.0537 6.84667 9.96036L5.23334 8.34703C5.04 8.1537 5.04 7.8337 5.23334 7.64036C5.42667 7.44703 5.74667 7.44703 5.94 7.64036L7.2 8.90036L10.0667 6.0337C10.26 5.84036 10.58 5.84036 10.7733 6.0337C10.9667 6.22703 10.9667 6.54703 10.7733 6.74036Z" fill="#149D4F"/>
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
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M3 11.9896V14.5C3 17.7998 3 19.4497 4.02513 20.4749C5.05025 21.5 6.70017 21.5 10 21.5H14C17.2998 21.5 18.9497 21.5 19.9749 20.4749C21 19.4497 21 17.7998 21 14.5V11.9896C21 10.3083 21 9.46773 20.6441 8.74005C20.2882 8.01237 19.6247 7.49628 18.2976 6.46411L16.2976 4.90855C14.2331 3.30285 13.2009 2.5 12 2.5C10.7991 2.5 9.76689 3.30285 7.70242 4.90855L5.70241 6.46411C4.37533 7.49628 3.71179 8.01237 3.3559 8.74005C3 9.46773 3 10.3083 3 11.9896Z" stroke="#313131" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16.9998 17.5V13.5" stroke="#313131" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const LinkIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M9.16992 13.8299C9.54992 14.3999 10.0499 14.8899 10.6299 15.2699C11.2099 15.6499 11.8699 15.9099 12.5799 16.0199C13.2899 16.1299 14.0099 16.0799 14.6999 15.8799C15.3899 15.6799 16.0199 15.3199 16.5499 14.8499L19.5499 12.1499C20.5099 11.2699 21.0499 10.0499 21.0499 8.77988C21.0499 7.50988 20.5099 6.28988 19.5499 5.40988C18.5899 4.52988 17.2999 4.02988 15.9499 4.02988C14.5999 4.02988 13.3099 4.52988 12.3499 5.40988L10.9199 6.71988" stroke="#313131" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14.8301 10.1699C14.4501 9.5999 13.9501 9.1099 13.3701 8.7299C12.7901 8.3499 12.1301 8.0899 11.4201 7.9799C10.7101 7.8699 9.99006 7.9199 9.30006 8.1199C8.61006 8.3199 7.98006 8.6799 7.45006 9.1499L4.45006 11.8499C3.49006 12.7299 2.95006 13.9499 2.95006 15.2199C2.95006 16.4899 3.49006 17.7099 4.45006 18.5899C5.41006 19.4699 6.70006 19.9699 8.05006 19.9699C9.40006 19.9699 10.6901 19.4699 11.6501 18.5899L13.0701 17.2799" stroke="#313131" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const UploadIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0,transform:'matrix(0,-1,-1,0,0,0)'}}>
    <path d="M12 16V12M12 12L9 14M12 12L15 14" stroke="#313131" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 20H7C4.79086 20 3 18.2091 3 16V9C3 6.79086 4.79086 5 7 5H17C19.2091 5 21 6.79086 21 9V16C21 18.2091 19.2091 20 17 20H16" stroke="#313131" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const PropertyDataIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M8.5 17.5L12 14L15.5 17.5M12 14V21M17.5 20H19C20.6569 20 22 18.6569 22 17C22 15.3431 20.6569 14 19 14C18.9872 14 18.9744 14.0003 18.9617 14.0009L19 14C19 11.2386 16.7614 9 14 9C12.8977 9 11.8734 9.36658 11.0555 10H10.5C8.01472 10 6 12.0147 6 14.5C4.34315 14.5 3 15.8431 3 17.5C3 19.1569 4.34315 20.5 6 20.5H8.5" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 3L14 5H10L12 3Z" fill="#000"/>
  </svg>
);
const BuyerTrendsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M9 10C9 10.5523 8.55228 11 8 11C7.44772 11 7 10.5523 7 10C7 9.44772 7.44772 9 8 9C8.55228 9 9 9.44772 9 10Z" fill="#000" stroke="#000" strokeWidth="1.5"/>
    <path d="M14 10C14 10.5523 13.5523 11 13 11C12.4477 11 12 10.5523 12 10C12 9.44772 12.4477 9 13 9C13.5523 9 14 9.44772 14 10Z" fill="#000" stroke="#000" strokeWidth="1.5"/>
    <path d="M19 10C19 10.5523 18.5523 11 18 11C17.4477 11 17 10.5523 17 10C17 9.44772 17.4477 9 18 9C18.5523 9 19 9.44772 19 10Z" fill="#000" stroke="#000" strokeWidth="1.5"/>
    <path d="M3 9C3 6.79086 4.79086 5 7 5H17C19.2091 5 21 6.79086 21 9V15C21 17.2091 19.2091 19 17 19H8L4 21V15V9Z" stroke="#000" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);
const AgentIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" stroke="#000" strokeWidth="1.5"/>
    <path d="M4 20C4 17.2386 7.58172 15 12 15C16.4183 15 20 17.2386 20 20" stroke="#000" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

/* ─── DATA ─── */
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
    tagline: 'Vendors wanting a fast professional opinion.',
    turnaround: 'Turnaround: 24–48 hours',
    features: ['Data-driven property market analysis','Human estate agent review','Local comparable sales review','Pricing position check','Online listing performance review','Summary report with key issues slowing the sale','3–5 actionable recommendations'],
    popular: false,
  },
  {
    id: 'professional_review', name: 'Professional Review', price: '£299.99',
    tagline: 'Serious sellers wanting expert guidance to improve saleability.',
    preNote: 'Includes everything in Quick Insight, plus',
    preNoteDetail: 'a detailed review by an estate agent actively selling similar properties in the local area.',
    turnaround: 'Turnaround: 24 hours',
    features: ['Buyer appeal analysis','Listing photography & description review','Local competition benchmarking','"Why buyers may be overlooking this property" section','Recommended pricing strategy','Priority turnaround'],
    popular: true,
  },
  {
    id: 'premium_strategy', name: 'Premium Strategy', price: '£1,499.99',
    tagline: 'High-value homes or properties stuck on the market for months.',
    preNote: 'Includes everything in professional review plus:',
    turnaround: '24 hours + follow-up support',
    features: ['Detailed property positioning strategy','Multi-platform listing audit','Area demand and buyer demographic analysis','Home presentation/staging recommendations','Marketing improvement roadmap','Re-launch strategy','Estate agent strategy review with improvement recommendations','Follow-up review after changes are implemented','Direct access for Q&A support for 14–30 days'],
    popular: false,
  },
];

/* ── HOUSE ILLUSTRATIONS ── */
const HouseBlue = () => (
  <svg width="157" height="122" viewBox="0 0 157 122" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="18" y="52" width="121" height="70" rx="4" fill="#4A90D9"/>
    <polygon points="78.5,8 8,55 149,55" fill="#2D6BB5"/>
    <rect x="64" y="72" width="29" height="50" rx="3" fill="#1A4A80"/>
    <rect x="30" y="65" width="22" height="22" rx="2" fill="#A8D4F5"/>
    <rect x="35" y="70" width="12" height="12" rx="1" fill="#7ABDE8"/>
    <rect x="105" y="65" width="22" height="22" rx="2" fill="#A8D4F5"/>
    <rect x="110" y="70" width="12" height="12" rx="1" fill="#7ABDE8"/>
    <circle cx="77" cy="97" r="3" fill="#A8D4F5"/>
    <rect x="14" y="50" width="5" height="8" rx="2" fill="#F5A623"/>
    <rect x="138" y="50" width="5" height="8" rx="2" fill="#F5A623"/>
    <rect x="52" y="30" width="12" height="20" rx="2" fill="#4A90D9"/>
    <rect x="55" y="27" width="6" height="6" rx="1" fill="#2D6BB5"/>
  </svg>
);
const HouseOrange = () => (
  <svg width="157" height="122" viewBox="0 0 157 122" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="18" y="52" width="121" height="70" rx="4" fill="#F5A623"/>
    <polygon points="78.5,8 8,55 149,55" fill="#D4831A"/>
    <rect x="64" y="72" width="29" height="50" rx="3" fill="#8B5209"/>
    <rect x="30" y="65" width="22" height="22" rx="2" fill="#FDE8BB"/>
    <rect x="35" y="70" width="12" height="12" rx="1" fill="#F5C870"/>
    <rect x="105" y="65" width="22" height="22" rx="2" fill="#FDE8BB"/>
    <rect x="110" y="70" width="12" height="12" rx="1" fill="#F5C870"/>
    <circle cx="77" cy="97" r="3" fill="#FDE8BB"/>
    <rect x="14" y="50" width="5" height="8" rx="2" fill="#E84393"/>
    <rect x="138" y="50" width="5" height="8" rx="2" fill="#E84393"/>
    <circle cx="120" cy="22" r="10" fill="#F5E642" opacity="0.9"/>
    <circle cx="120" cy="22" r="6" fill="#F5E642"/>
    <rect x="52" y="30" width="12" height="20" rx="2" fill="#F5A623"/>
    <rect x="55" y="27" width="6" height="6" rx="1" fill="#D4831A"/>
  </svg>
);
const HouseTeal = () => (
  <svg width="157" height="122" viewBox="0 0 157 122" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="18" y="52" width="121" height="70" rx="4" fill="#2ABFBF"/>
    <polygon points="78.5,8 8,55 149,55" fill="#1A9090"/>
    <rect x="64" y="72" width="29" height="50" rx="3" fill="#0D5A5A"/>
    <rect x="30" y="65" width="22" height="22" rx="2" fill="#AAEAEA"/>
    <rect x="35" y="70" width="12" height="12" rx="1" fill="#5DCFCF"/>
    <rect x="105" y="65" width="22" height="22" rx="2" fill="#AAEAEA"/>
    <rect x="110" y="70" width="12" height="12" rx="1" fill="#5DCFCF"/>
    <circle cx="77" cy="97" r="3" fill="#AAEAEA"/>
    <rect x="14" y="50" width="5" height="8" rx="2" fill="#F5D742"/>
    <rect x="138" y="50" width="5" height="8" rx="2" fill="#F5D742"/>
    <circle cx="120" cy="20" r="8" fill="#F5D742" opacity="0.8"/>
    <line x1="120" y1="10" x2="120" y2="4" stroke="#F5D742" strokeWidth="2"/>
    <line x1="126" y1="13" x2="130" y2="9" stroke="#F5D742" strokeWidth="2"/>
    <line x1="130" y1="20" x2="136" y2="20" stroke="#F5D742" strokeWidth="2"/>
    <rect x="52" y="30" width="12" height="20" rx="2" fill="#2ABFBF"/>
    <rect x="55" y="27" width="6" height="6" rx="1" fill="#1A9090"/>
  </svg>
);
const HOUSE_ICONS = [HouseBlue, HouseOrange, HouseTeal];

/* ─── FAQ ITEM ─── */
function FAQItem({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div style={{ display:'flex', padding:'24px 0', justifyContent:'center', alignItems:'center', gap:8, alignSelf:'stretch', borderBottom:'1px solid rgba(0,0,0,0.10)' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:24, flex:'1 0 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', alignSelf:'stretch' }}>
          <div style={{ color:'#000', fontFamily:'"Plus Jakarta Sans", sans-serif', fontSize:20, fontWeight:700, lineHeight:'150%', letterSpacing:'-0.02em' }}>{q}</div>
          <button onClick={() => setOpen(!open)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', flexShrink:0 }}>
            {open ? <MinusIcon /> : <PlusIcon />}
          </button>
        </div>
        {open && (
          <div style={{ alignSelf:'stretch', color:'#000', fontFamily:'Inter, sans-serif', fontSize:18, fontWeight:400, lineHeight:'150%', letterSpacing:'-0.003em', whiteSpace:'pre-line' }}>{a}</div>
        )}
      </div>
    </div>
  );
}

/* ─── MAIN COMPONENT ─── */
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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&family=Libre+Franklin:wght@400;500;600;700&display=swap');

        .sl-nav-links { display:flex; }
        .sl-hero-right { display:flex !important; }
        .sl-features-cols { display:flex; flex-direction:row; }
        .sl-testimonial-row { display:flex; flex-direction:row; }

        @media(max-width:1024px) {
          .sl-hero-right { display:none !important; }
          .sl-features-cols { flex-direction:column !important; }
          .sl-testimonial-row { flex-direction:column !important; }
          .sl-hero-heading { font-size:38px !important; }
          .sl-hero-section { padding:60px 40px !important; }
          .sl-features-section { padding:60px 40px !important; }
          .sl-how-section { padding:40px 40px !important; }
          .sl-testimonials-section { padding:60px 40px !important; }
          .sl-faq-section { padding:60px 40px !important; }
          .sl-pricing-section { padding:60px 40px !important; }
          .sl-nav-links { display:none !important; }
          .sl-step-card { padding:32px !important; }
          .sl-step-float { display:none !important; }
          .sl-input-bar { max-width:100% !important; }
        }
        @media(max-width:640px) {
          .sl-hero-heading { font-size:30px !important; }
          .sl-hero-section { padding:40px 20px !important; }
          .sl-features-section { padding:40px 20px !important; }
          .sl-how-section { padding:32px 20px !important; }
          .sl-testimonials-section { padding:40px 20px !important; }
          .sl-faq-section { padding:40px 20px !important; }
          .sl-pricing-section { padding:40px 20px !important; }
          .sl-pricing-cols { flex-direction:column !important; }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <header style={{
        background:'#FFF',
        borderBottom:'1px solid #F4F4F4',
        backdropFilter:'blur(5px)',
        position:'sticky',
        top:0,
        zIndex:50,
        height:80,
        display:'flex',
        alignItems:'center',
      }}>
        <div style={{ width:'100%', maxWidth:1440, margin:'0 auto', padding:'0 100px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          {/* Logo */}
          <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-start' }}>
            <svg width="215" height="36" viewBox="0 0 215 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text x="0" y="28" fontFamily='"Plus Jakarta Sans", sans-serif' fontWeight="800" fontSize="28" fill="#313131" letterSpacing="-0.5">StaleListings</text>
            </svg>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ fontFamily:'Inter, sans-serif', fontSize:16, color:'#000', fontWeight:400, letterSpacing:'-0.02em' }}>By</span>
              <span style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:800, fontSize:16, color:'#313131', letterSpacing:'-0.3px' }}>HAVLO</span>
            </div>
          </div>

          {/* Nav + CTA */}
          <div style={{ display:'flex', alignItems:'center', gap:32 }}>
            <nav className="sl-nav-links" style={{ display:'flex', alignItems:'center', gap:40 }}>
              {[['How it works','#how-it-works'],['Faq','#faq'],['Pricing','#pricing']].map(([label, href], i) => (
                <a key={i} href={href} style={{ color:'#000', fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:600, letterSpacing:'-0.02em', opacity:0.8, textDecoration:'none' }}>{label}</a>
              ))}
            </nav>
            <button onClick={handleStart} style={{ display:'flex', height:48, padding:'12px 20px', justifyContent:'center', alignItems:'center', gap:4, borderRadius:48, background:'#000', color:'#FFF', fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:700, letterSpacing:'-0.02em', border:'none', cursor:'pointer', whiteSpace:'nowrap' }}>
              Start Assessment
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section style={{ background:'#FFF', overflow:'hidden', position:'relative', minHeight:733 }}>
        {/* Pink blob — exact Figma position: left:701px top:-221px width:895px height:736px blur:213.468px */}
        <div style={{ position:'absolute', left:701, top:-221, width:895, height:736, borderRadius:'50%', background:'#FFB0E6', filter:'blur(213.468px)', pointerEvents:'none', zIndex:0 }} />

        <div className="sl-hero-section" style={{ maxWidth:1440, margin:'0 auto', padding:'92px 100px 73px', position:'relative', zIndex:1, display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>

          {/* Left column — 657px wide */}
          <div style={{ width:657, display:'flex', flexDirection:'column', gap:43 }}>

            {/* Heading + input + trustpilot block */}
            <div style={{ display:'flex', flexDirection:'column', gap:48 }}>
              <h1
                className="sl-hero-heading"
                style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:800, fontSize:56, color:'#1F1F1E', lineHeight:'110%', letterSpacing:'-0.03em', margin:0 }}
              >
                Don't Let Your Home Sit<br/>on the Market
              </h1>

              {/* Description */}
              <p style={{ fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:400, color:'#000000', lineHeight:'150%', letterSpacing:'-0.02em', margin:0, maxWidth:657 }}>
                Whether you're preparing to sell or already on the market, get personalised insights combining data-driven analysis with experienced local agent expertise to help your home sell faster — all while working with your current agent, no switching required.
              </p>
            </div>

            {/* Input bar — 570px wide × 56px tall */}
            <div style={{ display:'flex', flexDirection:'column', gap:32 }}>
              <div
                className="sl-input-bar"
                style={{
                  display:'flex',
                  flexDirection:'row',
                  alignItems:'center',
                  width:570,
                  height:56,
                  padding:'16px 4px 16px 16px',
                  boxSizing:'border-box',
                  background:'#EEF0F2',
                  borderBottom:'1px solid rgba(0,0,0,0.05)',
                  borderRadius:12,
                  gap:8,
                }}
              >
                <HomeInputIcon />
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleStart()}
                  placeholder="Enter property address…"
                  style={{
                    flex:1,
                    background:'transparent',
                    border:'none',
                    outline:'none',
                    fontFamily:'"Libre Franklin", sans-serif',
                    fontWeight:500,
                    fontSize:14,
                    color:'#1F1F1E',
                    letterSpacing:'-0.03em',
                    lineHeight:'17px',
                  }}
                />
                <button
                  onClick={handleStart}
                  style={{
                    display:'flex',
                    width:169,
                    height:48,
                    padding:'12px 20px',
                    justifyContent:'center',
                    alignItems:'center',
                    gap:4,
                    background:'#000000',
                    color:'#FFFFFF',
                    fontFamily:'Inter, sans-serif',
                    fontWeight:700,
                    fontSize:16,
                    letterSpacing:'-0.02em',
                    borderRadius:12,
                    border:'none',
                    cursor:'pointer',
                    whiteSpace:'nowrap',
                    flexShrink:0,
                  }}
                >
                  Assess my home
                </button>
              </div>

              {/* Trustpilot row — all on one line: Excellent + stars + based on */}
              <div style={{ display:'flex', alignItems:'center', gap:12, width:549, height:30 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontFamily:'Inter, sans-serif', fontWeight:500, fontSize:20, color:'#040504', letterSpacing:'-0.02em', lineHeight:'100%', whiteSpace:'nowrap' }}>Excellent</span>
                  <TrustpilotStars />
                </div>
                <span style={{ fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:16, color:'#000000', letterSpacing:'-0.02em', lineHeight:'100%', whiteSpace:'nowrap' }}>Based on verified customer feedback</span>
              </div>
            </div>

            {/* Stats row — gap:23px */}
            <div style={{ display:'flex', alignItems:'flex-start', gap:23 }}>
              {[
                ['10K+','Listings Analyzed'],
                ['91K+','Seller Recommendations Generated'],
                ['250K+','Property Data Points Analyzed'],
              ].map(([val, label], i) => (
                <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:4 }}>
                  <div style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:600, fontSize:32, color:'#1F1F1E', letterSpacing:'-0.03em', lineHeight:'120%' }}>{val}</div>
                  <div style={{ fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:14, color:'#000000', letterSpacing:'-0.02em' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — Mask group 582.27px × 568px */}
          <div
            className="sl-hero-right"
            style={{ width:582, height:568, borderRadius:30.45, overflow:'hidden', flexShrink:0 }}
          >
            <img
              src="/stale-hero-house.png"
              alt="Property"
              style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
            />
          </div>
        </div>
      </section>

      {/* ── FEATURES — white bg, padding 80px 100px, gap 78px, 3 columns directly on white ── */}
      <section className="sl-features-section" style={{ padding:'80px 100px', background:'#FFFFFF' }}>
        <div style={{ maxWidth:1440, margin:'0 auto', display:'flex', flexDirection:'column', gap:78, alignItems:'flex-start' }}>
          <h2 style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:600, fontSize:48, color:'#1F1F1E', letterSpacing:'-0.03em', lineHeight:'120%', margin:0, maxWidth:713 }}>
            Homes that sit too long lose buyer attention. Yours doesn't have to.
          </h2>
          <div className="sl-features-cols" style={{ display:'flex', flexDirection:'row', gap:24, alignSelf:'stretch', width:'100%' }}>
            {[
              { Icon: HouseIcon, title:'Spot What Buyers Notice', titleSize:32, desc:'Uncover the small issues that can reduce buyer interest and slow down your sale.' },
              { Icon: BulbIcon, title:'Expert-Backed Selling Insights', titleSize:28, desc:'Combine data-driven analysis with experienced local property expertise.' },
              { Icon: HandshakeIcon, title:'Works With Your Current Agent', titleSize:28, desc:'Use our recommendations alongside your existing estate agent, no switching required.' },
            ].map(({ Icon, title, titleSize, desc }, i) => (
              <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:50, flex:'1 0 0' }}>
                <Icon />
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:24, alignSelf:'stretch' }}>
                  <div style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:600, fontSize:titleSize, color:'#1F1F1E', letterSpacing:'-0.03em', lineHeight:'120%' }}>{title}</div>
                  <div style={{ fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:20, color:'#000000', letterSpacing:'-0.03em', lineHeight:'150%' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS — white bg outer, EEF0F2 step cards inside ── */}
      <section id="how-it-works" className="sl-how-section" style={{ padding:'40px 100px', background:'#FFFFFF' }}>
        <div style={{ maxWidth:1440, margin:'0 auto', display:'flex', flexDirection:'column', gap:32 }}>

          {/* Step 1 */}
          <div className="sl-step-card" style={{ display:'flex', padding:56, flexDirection:'column', alignItems:'flex-start', gap:32, alignSelf:'stretch', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#EEF0F2', overflow:'hidden', position:'relative', isolation:'isolate', boxSizing:'border-box' }}>
            <div style={{ display:'flex', width:120, height:48, padding:'12px 20px', justifyContent:'center', alignItems:'center', gap:4, borderRadius:48, background:'#000', zIndex:1 }}>
              <span style={{ color:'#FFF', fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:700, letterSpacing:'-0.02em' }}>Step 1</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:24, flex:'1 0 0', zIndex:1 }}>
              <div style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:700, fontSize:40, color:'#1F1F1E', letterSpacing:'-0.03em', lineHeight:'120%' }}>Tell Us About Your Home</div>
              <div style={{ fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:20, color:'#000000', letterSpacing:'-0.03em', lineHeight:'150%', maxWidth:514 }}>Enter your property details, upload your listing, or share your Rightmove/Zoopla link to start your analysis.</div>
            </div>
            {/* Floating white card — positioned absolute to the right */}
            <div className="sl-step-float" style={{ position:'absolute', right:-144, top:40, width:679, padding:32, display:'flex', flexDirection:'column', gap:32, borderRadius:32, border:'1px solid rgba(0,0,0,0.10)', background:'#FFFFFF', zIndex:3, boxSizing:'border-box' }}>
              {[
                { Icon: HomeInputIcon, label:'Enter property address…' },
                { Icon: LinkIcon, label:'Paste Rightmove / Zoopla URL…' },
                { Icon: UploadIcon, label:'Upload listing document' },
              ].map(({ Icon, label }, i) => (
                <div key={i} style={{ display:'flex', flexDirection:'row', alignItems:'center', padding:'13px 16px', gap:12, height:56, background:'#EEF0F2', borderBottom:'1px solid rgba(0,0,0,0.02)', borderRadius:8, boxSizing:'border-box' }}>
                  <Icon />
                  <span style={{ fontFamily:'"Libre Franklin", sans-serif', fontWeight:500, fontSize:14, color:'#666666', letterSpacing:'-0.03em' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step 2 */}
          <div className="sl-step-card" style={{ display:'flex', padding:56, flexDirection:'column', alignItems:'flex-start', gap:32, alignSelf:'stretch', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#EEF0F2', overflow:'hidden', position:'relative', isolation:'isolate', boxSizing:'border-box' }}>
            <div style={{ display:'flex', width:120, height:48, padding:'12px 20px', justifyContent:'center', alignItems:'center', gap:4, borderRadius:48, background:'#000', zIndex:1 }}>
              <span style={{ color:'#FFF', fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:700, letterSpacing:'-0.02em' }}>Step 2</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:24, flex:'1 0 0', zIndex:1 }}>
              <div style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:700, fontSize:40, color:'#1F1F1E', letterSpacing:'-0.03em', lineHeight:'120%' }}>Get personalized selling insights</div>
              <div style={{ fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:20, color:'#000000', letterSpacing:'-0.03em', lineHeight:'150%', maxWidth:580 }}>We analyse your home using property data, buyer trends, and experienced local agent expertise to uncover what could improve your sale.</div>
            </div>
            {/* Floating white card */}
            <div className="sl-step-float" style={{ position:'absolute', right:-144, top:40, width:679, padding:32, display:'flex', flexDirection:'column', gap:32, borderRadius:32, border:'1px solid rgba(0,0,0,0.10)', background:'#FFFFFF', zIndex:3, boxSizing:'border-box' }}>
              {[
                { Icon: PropertyDataIcon, title:'Property data', sub:'Pricing trends & comparables' },
                { Icon: BuyerTrendsIcon, title:'Buyer trends', sub:'What buyers are searching for' },
                { Icon: AgentIcon, title:'Local agent expertise', sub:'Human insight, not just algorithms' },
              ].map(({ Icon, title, sub }, i) => (
                <div key={i} style={{ display:'flex', flexDirection:'row', alignItems:'center', padding:16, gap:12, height:73, background:'#EEF0F2', borderBottom:'1px solid rgba(0,0,0,0.02)', borderRadius:8, boxSizing:'border-box' }}>
                  <Icon />
                  <div style={{ display:'flex', flexDirection:'column', gap:12, flex:1 }}>
                    <span style={{ fontFamily:'"Libre Franklin", sans-serif', fontWeight:600, fontSize:16, color:'#000000', letterSpacing:'-0.03em', lineHeight:'19px' }}>{title}</span>
                    <span style={{ fontFamily:'"Libre Franklin", sans-serif', fontWeight:500, fontSize:14, color:'#666666', letterSpacing:'-0.03em', lineHeight:'17px' }}>{sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3 */}
          <div className="sl-step-card" style={{ display:'flex', padding:56, flexDirection:'column', alignItems:'flex-start', gap:32, alignSelf:'stretch', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#EEF0F2', overflow:'hidden', position:'relative', isolation:'isolate', boxSizing:'border-box' }}>
            <div style={{ display:'flex', width:120, height:48, padding:'12px 20px', justifyContent:'center', alignItems:'center', gap:4, borderRadius:48, background:'#000', zIndex:1 }}>
              <span style={{ color:'#FFF', fontFamily:'Inter, sans-serif', fontSize:16, fontWeight:700, letterSpacing:'-0.02em' }}>Step 3</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:24, flex:'1 0 0', zIndex:1 }}>
              <div style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:700, fontSize:40, color:'#1F1F1E', letterSpacing:'-0.03em', lineHeight:'120%' }}>Improve your chances of a faster sale</div>
              <div style={{ fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:20, color:'#000000', letterSpacing:'-0.03em', lineHeight:'150%', maxWidth:661 }}>Receive your expert report within 6–12 hours, with actionable recommendations you can implement alongside your current estate agent.</div>
            </div>
            {/* Floating white card — step 3: right:-192px, border-radius top only */}
            <div className="sl-step-float" style={{ position:'absolute', right:-192, top:46, width:679, padding:32, display:'flex', flexDirection:'column', gap:37, borderRadius:'32px 32px 0px 0px', border:'1px solid rgba(0,0,0,0.10)', background:'#FFFFFF', zIndex:3, boxSizing:'border-box' }}>
              <span style={{ fontFamily:'"Libre Franklin", sans-serif', fontWeight:500, fontSize:20, color:'#000000', letterSpacing:'-0.03em', lineHeight:'24px', textTransform:'uppercase' }}>Your report includes</span>
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                {['Pricing insights','Photo improvements','Listing description feedback','Buyer appeal suggestions','Market positioning recommendations'].map((item, i) => (
                  <div key={i} style={{ fontFamily:'"Libre Franklin", sans-serif', fontWeight:500, fontSize:18, color:'#000000', letterSpacing:'-0.03em', lineHeight:'200%' }}>{item}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS — bg:#EEF0F2, padding 80px 100px ── */}
      <section className="sl-testimonials-section" style={{ padding:'80px 100px', background:'#EEF0F2' }}>
        <div style={{ maxWidth:1440, margin:'0 auto', display:'flex', flexDirection:'column', gap:32 }}>
          <h2 style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:600, fontSize:48, color:'#1F1F1E', letterSpacing:'-0.03em', lineHeight:'120%', margin:0, maxWidth:713 }}>
            See why sellers trust our insights
          </h2>
          {/* Row 1 */}
          <div className="sl-testimonial-row" style={{ display:'flex', flexDirection:'row', alignItems:'center', gap:32, alignSelf:'stretch' }}>
            {TESTIMONIALS.slice(0, 3).map((t, i) => (
              <div key={i} style={{ display:'flex', padding:24, flexDirection:'column', alignItems:'flex-start', gap:32, flex:'1 0 0', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#FFFFFF', overflow:'hidden', minHeight:317.68, boxSizing:'border-box' }}>
                <QuoteIcon />
                <div style={{ fontFamily:'Inter, sans-serif', fontSize:20, fontWeight:400, color:'#000', lineHeight:'150%', letterSpacing:'-0.03em', alignSelf:'stretch' }}>"{t.text}"</div>
                <div style={{ fontFamily:'Inter, sans-serif', fontSize:20, fontWeight:700, color:'#000', lineHeight:'150%', letterSpacing:'-0.03em', alignSelf:'stretch' }}>{t.name}</div>
              </div>
            ))}
          </div>
          {/* Row 2 */}
          <div className="sl-testimonial-row" style={{ display:'flex', flexDirection:'row', alignItems:'center', gap:32, alignSelf:'stretch' }}>
            {TESTIMONIALS.slice(3).map((t, i) => (
              <div key={i} style={{ display:'flex', padding:24, flexDirection:'column', alignItems:'flex-start', gap:32, flex:'1 0 0', borderRadius:32, border:'1px solid rgba(0,0,0,0.05)', background:'#FFFFFF', overflow:'hidden', minHeight:317.68, boxSizing:'border-box' }}>
                <QuoteIcon />
                <div style={{ fontFamily:'Inter, sans-serif', fontSize:20, fontWeight:400, color:'#000', lineHeight:'150%', letterSpacing:'-0.03em', alignSelf:'stretch' }}>"{t.text}"</div>
                <div style={{ fontFamily:'Inter, sans-serif', fontSize:20, fontWeight:700, color:'#000', lineHeight:'150%', letterSpacing:'-0.03em', alignSelf:'stretch' }}>{t.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ — bg:#FEFFFF, padding 80px 200px ── */}
      <section id="faq" className="sl-faq-section" style={{ padding:'80px 200px', background:'#FEFFFF' }}>
        <div style={{ maxWidth:1440, margin:'0 auto' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:40, width:1040, maxWidth:'100%' }}>
            <h2 style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:900, fontSize:44, color:'#050405', lineHeight:'110%', margin:0 }}>Evertthing you need to know</h2>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:0, alignSelf:'stretch' }}>
              {faqsToShow.map((faq, i) => (
                <FAQItem key={i} q={faq.q} a={faq.a} defaultOpen={i < 2} />
              ))}
            </div>
            <button
              onClick={() => setShowAllFaq(!showAllFaq)}
              style={{ display:'flex', height:44, padding:'8px 32px', justifyContent:'center', alignItems:'center', gap:8, background:'#000', border:'none', cursor:'pointer' }}
            >
              <span style={{ fontFamily:'Inter, sans-serif', fontWeight:500, fontSize:16, color:'#FEFFFF', letterSpacing:'-0.02em' }}>
                {showAllFaq ? 'See Less' : 'Load more'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ── PRICING — bg:#FFB0E6, padding 80px 100px ── */}
      <section id="pricing" className="sl-pricing-section" style={{ padding:'80px 100px', background:'#FFB0E6' }}>
        <div style={{ maxWidth:1440, margin:'0 auto', display:'flex', flexDirection:'column', alignItems:'center', gap:32 }}>
          <h2 style={{ fontFamily:'"Plus Jakarta Sans", sans-serif', fontWeight:600, fontSize:40, color:'#1F1F1E', letterSpacing:'-0.03em', lineHeight:'120%', margin:0, maxWidth:858, textAlign:'center' }}>
            Find out why your property isn't selling and what you can do to improve it.
          </h2>
          <p style={{ fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:16, color:'#000000', letterSpacing:'-0.02em', lineHeight:'150%', margin:0, maxWidth:734, textAlign:'center' }}>
            Get expert insights, market analysis, and professional recommendations designed to help position your property more effectively and attract the right buyers faster.
          </p>
          {/* Plan cards */}
          <div className="sl-pricing-cols" style={{ display:'flex', flexDirection:'row', gap:24, alignSelf:'stretch', alignItems:'stretch' }}>
            {PLANS.map((plan, i) => {
              const HouseIcon = HOUSE_ICONS[i];
              const isPopular = plan.popular;
              return (
                <div key={i} style={{ position:'relative', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:24, gap:32, flex:'1 0 0', background:'#FFFFFF', border: isPopular ? '2px solid #1A6B6B' : '1px solid rgba(0,0,0,0.05)', borderRadius:32, boxSizing:'border-box' }}>
                  {/* BEST VALUE badge */}
                  {isPopular && (
                    <div style={{ position:'absolute', top:20, right:20, background:'#E53935', color:'#fff', fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:11, letterSpacing:'0.5px', padding:'4px 10px', borderRadius:20, textTransform:'uppercase' }}>
                      BEST VALUE
                    </div>
                  )}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:32 }}>
                    {/* House illustration */}
                    <HouseIcon />
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:24, alignSelf:'stretch' }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:20, alignSelf:'stretch' }}>
                        <div style={{ fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:24, color:'#000000', letterSpacing:'-0.03em', lineHeight:'150%' }}>{plan.name}</div>
                        <div style={{ fontFamily:'Inter, sans-serif', fontWeight:400, fontSize:16, color:'#000000', letterSpacing:'-0.03em', lineHeight:'120%' }}>{plan.tagline}</div>
                      </div>
                      {/* Features list */}
                      <div style={{ display:'flex', flexDirection:'column', gap:16, paddingTop:16, borderTop:'1px solid rgba(0,0,0,0.1)', alignSelf:'stretch' }}>
                        {(plan as any).preNote && (
                          <div style={{ fontFamily:'Inter, sans-serif', fontSize:14, letterSpacing:'-0.03em', lineHeight:'130%' }}>
                            <span style={{ fontWeight:700, color:'#050405' }}>{(plan as any).preNote}:</span>
                            {(plan as any).preNoteDetail && (
                              <span style={{ fontWeight:400, color:'#050405' }}> {(plan as any).preNoteDetail}</span>
                            )}
                          </div>
                        )}
                        {plan.features.map((feat, j) => (
                          <div key={j} style={{ display:'flex', flexDirection:'row', alignItems:'flex-start', gap:8 }}>
                            <VerifyIcon />
                            <span style={{ fontFamily:'Inter, sans-serif', fontWeight:500, fontSize:14, color:'#050405', letterSpacing:'-0.03em', lineHeight:'120%', flex:1 }}>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Turnaround + Price + CTA */}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
                    {/* Purple turnaround pill */}
                    <div style={{ display:'inline-flex', padding:'10px 12px', borderRadius:10, background:'#FAEBFE', alignSelf:'stretch' }}>
                      <span style={{ fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:14, color:'#602ED3', letterSpacing:'-0.02em', lineHeight:'130%' }}>{(plan as any).turnaround}</span>
                    </div>
                    {/* Price */}
                    <div style={{ fontFamily:'Inter, sans-serif', fontWeight:600, fontSize:24, color:'#000000', letterSpacing:'-0.03em', lineHeight:'120%', alignSelf:'stretch' }}>
                      {plan.price} per report
                    </div>
                    {/* CTA button */}
                    <button
                      onClick={handleStart}
                      style={{ display:'flex', height:44, padding:'8px', justifyContent:'center', alignItems:'center', gap:8, borderRadius:10, background: isPopular ? '#F5A623' : '#000000', color: isPopular ? '#000' : '#FFFFFF', fontFamily:'Inter, sans-serif', fontWeight:500, fontSize:16, letterSpacing:'-0.02em', border:'none', cursor:'pointer', alignSelf:'stretch' }}
                    >
                      Start Assessment
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#fff', borderTop: '1px solid #EFEFEF', padding: '28px 60px' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 20, color: '#1F1F1E', letterSpacing: '-0.5px', flexShrink: 0 }}>StaleListings</span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: '#1F1F1E', textAlign: 'center' }}>© 2025 StaleListings. All rights reserved.</span>
          <div style={{ display: 'flex', gap: 24, flexShrink: 0 }}>
            <a href="/privacy-policy" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, color: '#1F1F1E', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/terms" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, color: '#1F1F1E', textDecoration: 'none' }}>Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

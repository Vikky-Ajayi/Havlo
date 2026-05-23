import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { api } from '../lib/api';
import { Footer } from '../components/shared/Footer';
import { ProductAccessModal } from '../components/product-access/ProductAccessModal';
import { clearProductAccessSession, readProductAccessSession } from '../lib/productAccess';
import { parsePropertyInput } from '../lib/propertyInput';
import {
  CustomOfferPlanId,
  defaultCustomOfferDraft,
  emptyPropertySnapshot,
  readCustomOfferDraft,
  writeCustomOfferDraft,
} from '../lib/customOffers';

const PURPLE = '#A409D2';

const navLinks = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Pricing', href: '#pricing' },
];

const stats = [
  {
    desktopValue: '15K+',
    mobileValue: '15K',
    label: 'Buyer Proposal Submitted',
  },
  {
    desktopValue: '9K+',
    mobileValue: '9K+',
    label: 'Flexible Purchase Opportunities',
  },
  {
    desktopValue: '8K+',
    mobileValue: '8K+',
    label: 'Seller interactions facilitated',
  },
];

const featureItems = [
  {
    title: 'Flexible Offers That Get Seen',
    description:
      'Submit alternative purchase proposals that may never reach sellers through traditional channels',
    icon: 'home',
  },
  {
    title: 'Sellers Care About Certainty Too',
    description:
      'Many homeowners would accept a lower or unconditional offer if it meant a faster, smoother or more flexible sale.',
    icon: 'bulb',
  },
  {
    title: 'Built to Work With Everyone involved.',
    description:
      'Buyers, Sellers and estate agents stay involved through the process while exploring alternative purchase options',
    icon: 'handshake',
  },
];

const steps = [
  {
    step: 'Step 1',
    title: 'Find a Property',
    description: "See a property listed online that you're interested in",
  },
  {
    step: 'Step 2',
    title: 'Paste the Listing URL',
    description:
      'Copy the property link from Rightmove, Zoopla, or the estate agent website and submit it on our platform.',
  },
  {
    step: 'Step 3',
    title: 'Build Your Proposal',
    description:
      "Tell the homeowner why you're interested, your buyer status, your proposed terms and what makes your offer attractive.",
  },
  {
    step: 'Step 4',
    title: 'Seller Review & Introduction',
    description:
      'We securely present your proposal to the homeowner, allowing them to privately review and consider your interest and proposed terms.',
  },
  {
    step: 'Step 5',
    title: 'Seller Chooses Whether to Engage',
    description:
      'If interested, the seller can continue through their existing estate agent or solicitor. We do not negotiate, sell properties, or replace estate agents - we simply help buyers and sellers connect around flexible opportunities.',
  },
];

const testimonials = [
  {
    text: 'We had already been told our offer was unlikely to be considered, but once the seller reviewed our flexible terms directly, the conversation changed completely',
    author: 'Sarah M.',
  },
  {
    text: 'Our delayed completion proposal suited the homeowner perfectly, but it was difficult to properly communicate through the usual process',
    author: 'James & Olivia R.',
  },
  {
    text: 'The seller told us they appreciated receiving the full context behind our offer rather than a simple number passed through our agent',
    author: 'Daniel P.',
  },
  {
    text: 'The platform helped the seller see the practical advantages of our proposal beyond just the headline offer',
    author: 'Priya K.',
  },
  {
    text: 'We finally had a way to explain why our proposal actually reduced risk for the seller, instead of just being judged on the offer amount alone',
    author: 'Emma L.',
  },
  {
    text: 'The estate agent focused entirely on price, while the seller cared far more about certainty and speed. This platform helped us communicate that properly',
    author: 'Michael T.',
  },
];

const faqItems = [
  {
    question: '1. What is Custom Offer?',
    answer:
      'We help buyers submit flexible or alternative property proposals directly to homeowners for properties already listed online. Custom Offer is designed for buyers who want to communicate more than just a standard offer price.\n## Are you an estate agent?\nNo. We are not an estate agency, brokerage, or property listing business. We do not negotiate sales, handle transactions, or replace estate agents or solicitors. We simply facilitate structured buyer introductions and proposal submissions.',
  },
  {
    question: '2. How does it work?',
    answer:
      "1. Find a property listed online.\n2. Paste the property URL into Custom Offer.\n3. Build your proposal and explain your terms.\n4. Pay the submission fee.\n5. We professionally contact the homeowner and invite them to review your proposal securely.\nIf the homeowner is interested, they can continue through their estate agent or solicitor.",
  },
  {
    question: '3. What kind of proposals can I submit?',
    answer:
      'You can submit:\n• Standard offers\n• Flexible completion dates\n• Chain-free proposals\n• Cash buyer proposals\n• Delayed completion arrangements\n• Seller-friendly purchase structures\n• Other alternative purchase terms',
  },
  {
    question: '4. Why would a seller use this?',
    answer:
      "Many homeowners care about more than just the highest offer. Flexibility, certainty, speed, and timing can all influence a seller's decision. Custom Offer helps sellers review proposals with more context than they may receive through traditional channels.",
  },
  {
    question: "5. Why wouldn't I just go through the estate agent?",
    answer:
      'You still can. Custom Offer is designed to work alongside the traditional process. Some buyers simply want an opportunity to properly explain flexible or unconventional terms that may not normally be fully communicated.',
  },
  {
    question: '6. Do you bypass estate agents?',
    answer:
      'No. We do not encourage buyers or sellers to avoid estate agents. Sellers can continue working with their existing agent, solicitor, or broker throughout the process.',
  },
  {
    question: '7. Will the seller see my full personal details?',
    answer:
      'No. Your proposal is initially presented securely and professionally. Personal details are only shared if both parties choose to engage further.',
  },
  {
    question: '8. Do you guarantee the seller will respond?',
    answer:
      'No. Sellers are under no obligation to respond, negotiate, or proceed with any proposal submitted through Custom Offer. While we professionally present all submissions, we cannot guarantee a response or engagement from the homeowner.',
  },
  {
    question: '9. Are submission fees refundable?',
    answer:
      'No. All submission fees are non-refundable once a proposal has been submitted and outreach has commenced. Payment covers the preparation, review, and professional presentation of your proposal regardless of seller response or outcome.',
  },
  {
    question: '10. What does the submission fee include?',
    answer:
      'Depending on your package, the fee may include:\n• Proposal formatting\n• Buyer profile review\n• Seller outreach\n• Proposal presentation\n• Verification checks\n• Secure seller review access',
  },
  {
    question: '11. Do you verify buyers?',
    answer:
      'Some plans may include optional buyer verification such as identity checks to help strengthen credibility with homeowners.',
  },
  {
    question: '12. Can sellers reject proposals?',
    answer:
      'Yes. Sellers are under no obligation to respond, negotiate, or proceed with any proposal submitted through Custom Offer.',
  },
  {
    question: '13. Can I submit an offer below asking price?',
    answer:
      'Yes. Many sellers may still consider lower offers if the proposal provides advantages such as speed, flexibility, reduced chain risk, or certainty.',
  },
  {
    question: '14. Do you handle payments or legal contracts?',
    answer:
      'No. We do not handle deposits, contracts, negotiations, or conveyancing. Any formal transaction continues through solicitors, estate agents, or licensed professionals.',
  },
  {
    question: '15. Is my information secure?',
    answer:
      'We take privacy and data security seriously. Buyer information is handled securely and only shared where necessary and authorised.',
  },
  {
    question: '16. Can sellers upload their own properties?',
    answer:
      'Yes. Homeowners can upload publicly listed property URLs and choose to receive flexible buyer proposals directly through Custom Offer.',
  },
  {
    question: '17. What types of properties can be submitted?',
    answer:
      'Yes. Any publicly listed residential or commercial property may be eligible, including listings from Rightmove, Zoopla, OnTheMarket, or estate agent websites. We support homeowners across the UK.',
  },
  {
    question: '18. Who is Custom Offer best suited for?',
    answer:
      'Custom Offer is particularly useful for:\n• Chain-free buyers\n• Cash buyers\n• Buyers with flexible terms\n• Buyers proposing alternative structures\n• Sellers seeking additional opportunities\n• Homeowners open to creative purchase arrangements',
  },
  {
    question: '19. Does submitting a proposal guarantee a property purchase?',
    answer:
      'No. Custom Offer simply creates an opportunity for communication and consideration. All purchase decisions remain entirely between the buyer and seller.',
  },
  {
    question: '20. What is your refund policy?',
    answer:
      'Due to the nature of our service, all submission fees are non-refundable once a proposal has been submitted. Our fees cover the preparation, review, formatting, and professional presentation of your proposal regardless of seller response, engagement, or transaction outcome.\nWe do not guarantee:\n• seller responses,\n• negotiations,\n• property viewings,\n• or successful purchases.\nBy submitting a proposal through Custom Offer, you acknowledge and accept that the service provided is the presentation of your proposal, not the outcome of the proposal or transaction.',
  },
];

const pricingPlans = [
  {
    name: 'Connect',
    price: '£49.99',
    tagline: 'For buyers who want to professionally present their purchase interest.',
    intro: '',
    buttonBg: '#000000',
    buttonColor: '#FFFFFF',
    borderColor: 'rgba(0, 0, 0, 0.06)',
    badge: '',
    illustration: 'blue',
    items: [
      'Property purchase proposal submission',
      'Seller outreach',
      'Structured buyer message',
      'Standard proposal review',
      'Secure presentation to seller',
    ],
  },
  {
    name: 'Standout',
    price: '£99.99',
    tagline: 'For buyers who want to strengthen their proposal and increase seller consideration.',
    intro: 'Includes everything in Connect, plus:',
    buttonBg: '#F5B200',
    buttonColor: '#111111',
    borderColor: '#0F7B7D',
    badge: 'BEST VALUE',
    illustration: 'orange',
    items: [
      'Priority proposal presentation',
      'Enhanced buyer profile',
      'Flexible terms summary',
      'Tailored proposal positioning',
      'Seller-focused proposal formatting',
      'Highlighted buyer advantages and timeline',
    ],
  },
  {
    name: 'Advantage',
    price: '£149.99',
    tagline: 'For buyers presenting flexible or high-impact purchase proposals.',
    intro: 'Includes everything in Standout, plus:',
    buttonBg: '#000000',
    buttonColor: '#FFFFFF',
    borderColor: 'rgba(0, 0, 0, 0.06)',
    badge: '',
    illustration: 'teal',
    items: [
      'Advanced proposal presentation',
      'Alternative purchase structure formatting',
      'Flexible completion arrangement summary',
      'Priority seller outreach',
      'Follow-up communication attempt',
      'Premium proposal positioning',
      'Detailed buyer intent and compatibility summary',
    ],
  },
];

const BrandLockup: React.FC = () => (
  <div className="co-brand">
    <img src="/custom-offer-logo.png" alt="CustomOffer" className="co-brand-logo" />
  </div>
);

const HamburgerIcon: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M5 7.25H19" stroke="#111111" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M5 12H19" stroke="#111111" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M5 16.75H19" stroke="#111111" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const MenuCloseIcon: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M6.5 6.5L17.5 17.5" stroke="#111111" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M17.5 6.5L6.5 17.5" stroke="#111111" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const TrustpilotStars: React.FC = () => (
  <svg className="co-trustpilot-stars" viewBox="0 0 160 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="30" height="30" fill="#00B67A" />
    <rect x="32.5" width="30" height="30" fill="#00B67A" />
    <rect x="65" width="30" height="30" fill="#00B67A" />
    <rect x="97.5" width="30" height="30" fill="#00B67A" />
    <rect x="130" width="30" height="30" fill="#00B67A" />
    <path d="M15 20.2183L19.5625 19.062L21.4687 24.937L15 20.2183ZM25.5 12.6245H17.4688L15 5.06201L12.5312 12.6245H4.5L11 17.312L8.53125 24.8745L15.0312 20.187L19.0312 17.312L25.5 12.6245Z" fill="white" />
    <path d="M47.5 20.2183L52.0625 19.062L53.9687 24.937L47.5 20.2183ZM58 12.6245H49.9687L47.5 5.06201L45.0313 12.6245H37L43.5 17.312L41.0312 24.8745L47.5312 20.187L51.5312 17.312L58 12.6245Z" fill="white" />
    <path d="M80 20.2183L84.5625 19.062L86.4688 24.937L80 20.2183ZM90.5 12.6245H82.4687L80 5.06201L77.5313 12.6245H69.5L76 17.312L73.5313 24.8745L80.0313 20.187L84.0312 17.312L90.5 12.6245Z" fill="white" />
    <path d="M112.5 20.2183L117.063 19.062L118.969 24.937L112.5 20.2183ZM123 12.6245H114.969L112.5 5.06201L110.031 12.6245H102L108.5 17.312L106.031 24.8745L112.531 20.187L116.531 17.312L123 12.6245Z" fill="white" />
    <path d="M145 20.2183L149.563 19.062L151.469 24.937L145 20.2183ZM155.5 12.6245H147.469L145 5.06201L142.531 12.6245H134.5L141 17.312L138.531 24.8745L145.031 20.187L149.031 17.312L155.5 12.6245Z" fill="white" />
  </svg>
);

const LinkInputIcon: React.FC = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M10.5 13.5L13.5 10.5" stroke="#111111" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M8.255 15.745L5.93 18.07C4.367 19.633 1.833 19.633 0.27 18.07C-1.293 16.507 -1.293 13.973 0.27 12.41L4.51 8.17C6.073 6.607 8.607 6.607 10.17 8.17" transform="translate(6.5 0.5)" stroke="#111111" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M15.745 8.255L18.07 5.93C19.633 4.367 19.633 1.833 18.07 0.27C16.507 -1.293 13.973 -1.293 12.41 0.27L8.17 4.51C6.607 6.073 6.607 8.607 8.17 10.17" transform="translate(0.5 6.5)" stroke="#111111" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const OutlineHomeIcon: React.FC = () => (
  <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M5 19.9825V24.1665C5 29.6662 5 32.416 6.70855 34.1247C8.41708 35.8332 11.1669 35.8332 16.6667 35.8332H23.3333C28.833 35.8332 31.5828 35.8332 33.2915 34.1247C35 32.416 35 29.6662 35 24.1665V19.9825C35 17.1803 35 15.7794 34.4068 14.5666C33.8137 13.3538 32.7078 12.4936 30.496 10.7734L27.1627 8.18075C23.7218 5.50459 22.0015 4.1665 20 4.1665C17.9985 4.1665 16.2782 5.50459 12.8374 8.18075L9.50402 10.7734C7.29222 12.4936 6.18632 13.3538 5.59317 14.5666C5 15.7794 5 17.1803 5 19.9825Z" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M28.333 29.1667V22.5" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const OutlineBulbIcon: React.FC = () => (
  <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M10.149 24.9986C9.51836 23.5809 9.16675 22.0038 9.16675 20.3418C9.16675 14.1692 14.017 9.16528 20.0001 9.16528C25.9832 9.16528 30.8334 14.1692 30.8334 20.3418C30.8334 22.0038 30.4818 23.5809 29.8511 24.9986" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" />
    <path d="M20 3.33191V4.99858" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M36.6667 19.9988H35" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.99992 19.9988H3.33325" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M31.784 8.21313L30.6055 9.39165" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.39458 9.39324L8.21606 8.21472" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M24.1951 32.1759C25.8791 31.6313 26.5544 30.0899 26.7444 28.5396C26.8011 28.0764 26.4201 27.6923 25.9534 27.6923L14.1282 27.6926C13.6455 27.6926 13.2579 28.1023 13.3155 28.5814C13.5016 30.1288 13.9713 31.2591 15.7558 32.1759M24.1951 32.1759C24.1951 32.1759 16.0496 32.1759 15.7558 32.1759M24.1951 32.1759C23.9926 35.4176 23.0564 36.7014 20.0114 36.6654C16.7544 36.7256 16.0051 35.1388 15.7558 32.1759" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const OutlineHandshakeIcon: React.FC = () => (
  <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M36.6663 11.2498H32.0182C31.0163 11.2498 30.5153 11.2498 30.043 11.1068C29.5707 10.9638 29.1538 10.6859 28.3202 10.1302C27.0698 9.29655 25.6433 8.34559 24.9347 8.13104C24.2262 7.9165 23.4747 7.9165 21.9718 7.9165C19.9282 7.9165 18.6108 7.9165 17.692 8.2971C16.7732 8.6777 16.0506 9.40029 14.6055 10.8454L13.3337 12.1172C13.008 12.4429 12.8451 12.6058 12.7446 12.7665C12.3719 13.3625 12.4132 14.1283 12.8478 14.6807C12.9651 14.8297 13.1445 14.9741 13.5033 15.2629C14.8296 16.3302 16.7417 16.2237 17.9427 15.0155L19.9997 12.9463H21.6663L31.6663 23.0058C32.5868 23.9318 32.5868 25.433 31.6663 26.359C30.7458 27.285 29.2535 27.285 28.333 26.359L27.4997 25.5206M22.4997 27.1973L24.1663 28.8738C25.0868 29.7998 26.5792 29.7998 27.4997 28.8738C28.4202 27.948 28.4202 26.4466 27.4997 25.5206L22.4997 20.491M19.1663 23.864L22.4997 27.1973C23.4202 28.1231 23.4202 29.6245 22.4997 30.5505C21.5792 31.4763 20.0868 31.4763 19.1663 30.5505L16.6663 28.0355M3.33301 24.5831H3.86457C5.24647 24.5831 5.93744 24.5831 6.55692 24.8435C7.17641 25.104 7.65992 25.5975 8.62696 26.5846L13.333 31.3888C14.2535 32.3146 15.7459 32.3146 16.6663 31.3888C17.5868 30.4628 17.5868 28.9615 16.6663 28.0355L15.833 27.1973" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M36.6667 24.5835H32.5" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" />
    <path d="M14.1663 11.25H3.33301" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const QuoteMark: React.FC = () => (
  <svg width="38" height="38" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M10.6321 40.1823C8.24261 37.6443 6.95972 34.7979 6.95972 30.1836C6.95972 22.0641 12.6597 14.7866 20.9486 11.1885L23.0202 14.3853C15.2834 18.5703 13.7709 24.0011 13.1677 27.4253C14.4135 26.7804 16.0443 26.5553 17.6427 26.7038C21.8278 27.0912 25.1267 30.527 25.1267 34.7979C25.1267 36.9513 24.2712 39.0165 22.7485 40.5393C21.2258 42.062 19.1605 42.9174 17.0071 42.9174C15.8162 42.9071 14.6392 42.66 13.5447 42.1904C12.4503 41.7209 11.4602 41.0382 10.6321 40.1823ZM33.8308 40.1823C31.4414 37.6443 30.1585 34.7979 30.1585 30.1836C30.1585 22.0641 35.8584 14.7866 44.1473 11.1885L46.219 14.3853C38.4822 18.5703 36.9696 24.0011 36.3665 27.4253C37.6122 26.7804 39.2431 26.5553 40.8415 26.7038C45.0266 27.0912 48.3254 30.527 48.3254 34.7979C48.3254 36.9513 47.47 39.0165 45.9473 40.5393C44.4245 42.062 42.3593 42.9174 40.2059 42.9174C39.0149 42.9071 37.838 42.66 36.7435 42.1904C35.649 41.7209 34.6589 41.0382 33.8308 40.1823Z" fill={PURPLE} />
  </svg>
);

const PlusIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M6 12H18" stroke="#111111" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M12 6V18" stroke="#111111" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const SearchIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="10.5" cy="10.5" r="5.75" stroke="#282828" strokeWidth="1.7" />
    <path d="M15 15L19 19" stroke="#282828" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const PinIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12 21C12 21 6 15.82 6 11.2C6 7.77584 8.68629 5 12 5C15.3137 5 18 7.77584 18 11.2C18 15.82 12 21 12 21Z" stroke="#2A2A2A" strokeWidth="1.7" />
    <circle cx="12" cy="11" r="2" stroke="#2A2A2A" strokeWidth="1.7" />
  </svg>
);

const BookmarkIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M7 20V6.8C7 5.80589 7.80589 5 8.8 5H15.2C16.1941 5 17 5.80589 17 6.8V20L12 16.5L7 20Z" stroke="#2A2A2A" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

const LinkIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M9.5 14.5L14.5 9.5" stroke="#2A2A2A" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M10 7H8.75C6.67893 7 5 8.67893 5 10.75C5 12.8211 6.67893 14.5 8.75 14.5H10" stroke="#2A2A2A" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M14 9.5H15.25C17.3211 9.5 19 11.1789 19 13.25C19 15.3211 17.3211 17 15.25 17H14" stroke="#2A2A2A" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const CheckIcon: React.FC<{ color?: string }> = ({ color = '#149D4F' }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M5 12.5L9.5 17L19 7.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlaneIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M20 4L11 13" stroke="#2A2A2A" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M20 4L14 20L11 13L4 10L20 4Z" stroke="#2A2A2A" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

const EyeIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M2.5 12C4.5 8.5 8 6.5 12 6.5C16 6.5 19.5 8.5 21.5 12C19.5 15.5 16 17.5 12 17.5C8 17.5 4.5 15.5 2.5 12Z" stroke="#2A2A2A" strokeWidth="1.7" />
    <circle cx="12" cy="12" r="2.5" stroke="#2A2A2A" strokeWidth="1.7" />
  </svg>
);

const ClockIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" stroke="#3D3D3D" strokeWidth="1.7" />
    <path d="M12 8.5V12.2L14.7 13.8" stroke="#3D3D3D" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CloseIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M7 7L17 17" stroke="#3D3D3D" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M17 7L7 17" stroke="#3D3D3D" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const VerifyBullet: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M14.3733 7.16036L13.4667 6.10703C13.2933 5.90703 13.1533 5.5337 13.1533 5.26703V4.1337C13.1533 3.42703 12.5733 2.84703 11.8667 2.84703H10.7333C10.4733 2.84703 10.0933 2.70703 9.89334 2.5337L8.84 1.62703C8.38 1.2337 7.62667 1.2337 7.16 1.62703L6.11334 2.54036C5.91334 2.70703 5.53334 2.84703 5.27334 2.84703H4.12C3.41334 2.84703 2.83334 3.42703 2.83334 4.1337V5.2737C2.83334 5.5337 2.69334 5.90703 2.52667 6.10703L1.62667 7.16703C1.24 7.62703 1.24 8.3737 1.62667 8.8337L2.52667 9.8937C2.69334 10.0937 2.83334 10.467 2.83334 10.727V11.867C2.83334 12.5737 3.41334 13.1537 4.12 13.1537H5.27334C5.53334 13.1537 5.91334 13.2937 6.11334 13.467L7.16667 14.3737C7.62667 14.767 8.38 14.767 8.84667 14.3737L9.9 13.467C10.1 13.2937 10.4733 13.1537 10.74 13.1537H11.8733C12.58 13.1537 13.16 12.5737 13.16 11.867V10.7337C13.16 10.4737 13.3 10.0937 13.4733 9.8937L14.38 8.84036C14.7667 8.38036 14.7667 7.62036 14.3733 7.16036ZM10.7733 6.74036L7.55334 9.96036C7.46 10.0537 7.33334 10.107 7.2 10.107C7.06667 10.107 6.94 10.0537 6.84667 9.96036L5.23334 8.34703C5.04 8.1537 5.04 7.8337 5.23334 7.64036C5.42667 7.44703 5.74667 7.44703 5.94 7.64036L7.2 8.90036L10.0667 6.0337C10.26 5.84036 10.58 5.84036 10.7733 6.0337C10.9667 6.22703 10.9667 6.54703 10.7733 6.74036Z" fill="#149D4F" />
  </svg>
);

const HouseBlue: React.FC = () => (
  <svg className="co-house-svg" viewBox="0 0 157 122" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="18" y="52" width="121" height="70" rx="4" fill="#4A90D9" />
    <polygon points="78.5,8 8,55 149,55" fill="#2D6BB5" />
    <rect x="64" y="72" width="29" height="50" rx="3" fill="#1A4A80" />
    <rect x="30" y="65" width="22" height="22" rx="2" fill="#A8D4F5" />
    <rect x="35" y="70" width="12" height="12" rx="1" fill="#7ABDE8" />
    <rect x="105" y="65" width="22" height="22" rx="2" fill="#A8D4F5" />
    <rect x="110" y="70" width="12" height="12" rx="1" fill="#7ABDE8" />
    <circle cx="77" cy="97" r="3" fill="#A8D4F5" />
    <rect x="14" y="50" width="5" height="8" rx="2" fill="#F5A623" />
    <rect x="138" y="50" width="5" height="8" rx="2" fill="#F5A623" />
    <rect x="52" y="30" width="12" height="20" rx="2" fill="#4A90D9" />
    <rect x="55" y="27" width="6" height="6" rx="1" fill="#2D6BB5" />
    <ellipse cx="78.5" cy="118" rx="54" ry="4" fill="#D8E0EF" />
  </svg>
);

const HouseOrange: React.FC = () => (
  <svg className="co-house-svg" viewBox="0 0 157 122" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="18" y="52" width="121" height="70" rx="4" fill="#F5A623" />
    <polygon points="78.5,8 8,55 149,55" fill="#D4831A" />
    <rect x="64" y="72" width="29" height="50" rx="3" fill="#8B5209" />
    <rect x="30" y="65" width="22" height="22" rx="2" fill="#FDE8BB" />
    <rect x="35" y="70" width="12" height="12" rx="1" fill="#F5C870" />
    <rect x="105" y="65" width="22" height="22" rx="2" fill="#FDE8BB" />
    <rect x="110" y="70" width="12" height="12" rx="1" fill="#F5C870" />
    <circle cx="77" cy="97" r="3" fill="#FDE8BB" />
    <rect x="14" y="50" width="5" height="8" rx="2" fill="#E84393" />
    <rect x="138" y="50" width="5" height="8" rx="2" fill="#E84393" />
    <circle cx="120" cy="22" r="10" fill="#F5E642" opacity="0.9" />
    <circle cx="120" cy="22" r="6" fill="#F5E642" />
    <rect x="52" y="30" width="12" height="20" rx="2" fill="#F5A623" />
    <rect x="55" y="27" width="6" height="6" rx="1" fill="#D4831A" />
    <ellipse cx="78.5" cy="118" rx="54" ry="4" fill="#E8E0CF" />
  </svg>
);

const HouseTeal: React.FC = () => (
  <svg className="co-house-svg" viewBox="0 0 157 122" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="18" y="52" width="121" height="70" rx="4" fill="#2ABFBF" />
    <polygon points="78.5,8 8,55 149,55" fill="#1A9090" />
    <rect x="64" y="72" width="29" height="50" rx="3" fill="#0D5A5A" />
    <rect x="30" y="65" width="22" height="22" rx="2" fill="#AAEAEA" />
    <rect x="35" y="70" width="12" height="12" rx="1" fill="#5DCFCF" />
    <rect x="105" y="65" width="22" height="22" rx="2" fill="#AAEAEA" />
    <rect x="110" y="70" width="12" height="12" rx="1" fill="#5DCFCF" />
    <circle cx="77" cy="97" r="3" fill="#AAEAEA" />
    <rect x="14" y="50" width="5" height="8" rx="2" fill="#F5D742" />
    <rect x="138" y="50" width="5" height="8" rx="2" fill="#F5D742" />
    <circle cx="120" cy="20" r="8" fill="#F5D742" opacity="0.8" />
    <line x1="120" y1="10" x2="120" y2="4" stroke="#F5D742" strokeWidth="2" />
    <line x1="126" y1="13" x2="130" y2="9" stroke="#F5D742" strokeWidth="2" />
    <line x1="130" y1="20" x2="136" y2="20" stroke="#F5D742" strokeWidth="2" />
    <rect x="52" y="30" width="12" height="20" rx="2" fill="#2ABFBF" />
    <rect x="55" y="27" width="6" height="6" rx="1" fill="#1A9090" />
    <ellipse cx="78.5" cy="118" rx="54" ry="4" fill="#D6EBE9" />
  </svg>
);

const FeatureIcon: React.FC<{ icon: string }> = ({ icon }) => {
  if (icon === 'bulb') return <OutlineBulbIcon />;
  if (icon === 'handshake') return <OutlineHandshakeIcon />;
  return <OutlineHomeIcon />;
};

const HouseArt: React.FC<{ illustration: string }> = ({ illustration }) => {
  if (illustration === 'orange') return <HouseOrange />;
  if (illustration === 'teal') return <HouseTeal />;
  return <HouseBlue />;
};

const StepOneMockup: React.FC = () => (
  <div className="co-step-panel co-step-panel--search">
    <div className="co-step-soft-row">
      <SearchIcon />
      <span>Search Rightmove, Zoopla...</span>
    </div>
    <div className="co-step-soft-row">
      <PinIcon />
      <span>Browse by area or price range</span>
    </div>
    <div className="co-step-soft-row">
      <BookmarkIcon />
      <span>Save your shortlist</span>
    </div>
  </div>
);

const StepTwoMockup: React.FC = () => (
  <div className="co-step-panel co-step-panel--listing">
    <div className="co-step-soft-row">
      <LinkIcon />
      <span>rightmove.co.uk/properties/14823...</span>
    </div>
    <div className="co-step-proof-line">
      <CheckIcon />
      <span>Works with Rightmove, Zoopla, and most agent sites</span>
    </div>
  </div>
);

const StepThreeMockup: React.FC = () => (
  <div className="co-step-panel co-step-panel--table">
    <div className="co-step-table-row">
      <span>Buyer status</span>
      <strong>Cash buyer</strong>
    </div>
    <div className="co-step-table-row">
      <span>Proposed offer</span>
      <strong>£375,000</strong>
    </div>
    <div className="co-step-table-row">
      <span>Timeline</span>
      <strong>Flexible</strong>
    </div>
    <div className="co-step-note">"Chain-free, mortgage agreed in principle..."</div>
  </div>
);

const StepFourMockup: React.FC = () => (
  <div className="co-step-panel co-step-panel--messages">
    <div className="co-step-message-card">
      <PlaneIcon />
      <div className="co-step-message-copy">
        <strong>Proposal delivered securely</strong>
        <span>Seller notified privately via their agent</span>
      </div>
    </div>
    <div className="co-step-message-card">
      <EyeIcon />
      <div className="co-step-message-copy">
        <strong>Seller reviews in private</strong>
        <span>No pressure, no obligation to respond</span>
      </div>
    </div>
  </div>
);

const StepFiveMockup: React.FC = () => (
  <div className="co-step-panel co-step-panel--responses">
    <div className="co-step-response-card">
      <CheckIcon color="#191919" />
      <span>Seller accepts — conversation begins</span>
    </div>
    <div className="co-step-response-card">
      <ClockIcon />
      <span>Seller considering — awaiting response</span>
    </div>
    <div className="co-step-response-card">
      <CloseIcon />
      <span>No response — not interested at this time</span>
    </div>
  </div>
);

const stepVisuals: Array<React.FC> = [
  StepOneMockup,
  StepTwoMockup,
  StepThreeMockup,
  StepFourMockup,
  StepFiveMockup,
];

const StepVisual: React.FC<{ index: number }> = ({ index }) => {
  const Mockup = stepVisuals[index] ?? stepVisuals[0];

  return <Mockup />;
};

const FAQRow: React.FC<{ question: string; answer: string }> = ({ question, answer }) => (
  <div className="co-faq-row">
    <div className="co-faq-row-top">
      <h3>{question}</h3>
      <PlusIcon />
    </div>
    <p>{answer}</p>
  </div>
);

export const CustomOffers: React.FC = () => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [accessEmail, setAccessEmail] = useState<string | null>(null);
  const [showAllFaq, setShowAllFaq] = useState(false);
  const [listingUrl, setListingUrl] = useState(() => {
    const stored = readCustomOfferDraft();
    return stored?.propertyInput || stored?.listingUrl || '';
  });
  const [ctaError, setCtaError] = useState('');
  const [isStartingFlow, setIsStartingFlow] = useState(false);

  useEffect(() => {
    setAccessEmail(readProductAccessSession('custom-offers')?.email ?? null);
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    if (isMobileMenuOpen || accessModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = originalOverflow;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [accessModalOpen, isMobileMenuOpen]);

  usePageMeta({
    title: 'CustomOffer | Havlo',
    description:
      "Make property offers that don't fit the traditional box. Submit flexible purchase proposals directly to homeowners and help sellers consider carefully structured terms.",
  });

  const visibleFaqItems = showAllFaq ? faqItems : faqItems.slice(0, 5);

  const handleOpenPortal = () => {
    navigate('/custom-offers/portal');
    setIsMobileMenuOpen(false);
  };

  const handleOpenSignIn = () => {
    setAccessModalOpen(true);
    setIsMobileMenuOpen(false);
  };

  const handleSignOut = () => {
    clearProductAccessSession('custom-offers');
    setAccessEmail(null);
    setIsMobileMenuOpen(false);
  };

  const beginProposalFlow = async (selectedPlan?: CustomOfferPlanId) => {
    const parsedInput = parsePropertyInput(listingUrl);
    if (!parsedInput) {
      setCtaError('Enter a property address or listing URL to continue.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsStartingFlow(true);
    setCtaError('');

    if (parsedInput.kind === 'address') {
      const nextDraft = {
        ...defaultCustomOfferDraft(),
        propertyInput: parsedInput.value,
        listingUrl: '',
        property: {
          ...emptyPropertySnapshot(),
          title: parsedInput.value,
          address: parsedInput.value,
          platform: 'manual',
        },
        propertyNeedsReview: false,
        selectedPlan,
      };

      writeCustomOfferDraft(nextDraft);
      setIsStartingFlow(false);
      navigate('/custom-offers/proposal');
      return;
    }

    try {
      const response = await api.customOffersScrape({ listing_url: parsedInput.value });
      const property = {
        ...emptyPropertySnapshot(parsedInput.value),
        ...(response.property || {}),
        url: response.property?.url || parsedInput.value,
        platform: response.platform || response.property?.platform || '',
      };
      const propertyNeedsReview =
        response.status !== 'complete'
        || Boolean(property.blocked)
        || (response.missing_fields || []).length > 0
        || !property.address.trim();

      const nextDraft = {
        ...defaultCustomOfferDraft(),
        propertyInput: parsedInput.value,
        listingUrl: property.url || parsedInput.value,
        property,
        propertyNeedsReview,
        selectedPlan,
      };

      writeCustomOfferDraft(nextDraft);
      navigate('/custom-offers/proposal');
    } catch (error) {
      setCtaError(error instanceof Error ? error.message : 'We could not read that property link right now.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsStartingFlow(false);
    }
  };

  return (
    <div className="co-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        html, body, #root {
          overflow-x: hidden;
        }

        .co-page {
          min-height: 100vh;
          background: #ffffff;
          color: #111111;
          font-family: var(--font-body), sans-serif;
          overflow-x: hidden;
        }

        .co-page * {
          box-sizing: border-box;
        }

        .co-inner {
          width: 100%;
          max-width: 1288px;
          margin: 0 auto;
          padding: 0 56px;
        }

        .co-brand {
          display: inline-flex;
          align-items: flex-start;
        }

        .co-brand-logo {
          display: block;
          width: auto;
          height: 50px;
        }

        .co-header {
          background: #ffffff;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }

        .co-header-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 80px;
        }

        .co-nav {
          display: flex;
          align-items: center;
          gap: 44px;
        }

        .co-header-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .co-auth-row {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .co-auth-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 46px;
          padding: 0 20px;
          border-radius: 14px;
          border: 1px solid rgba(0, 0, 0, 0.12);
          background: #ffffff;
          color: #111111;
          font-size: 16px;
          font-weight: 600;
          letter-spacing: -0.02em;
          cursor: pointer;
          text-decoration: none;
        }

        .co-nav a {
          color: #393939;
          text-decoration: none;
          font-size: 16px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .co-nav a:hover {
          color: ${PURPLE};
        }

        .co-menu-button {
          display: none;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
        }

        .co-menu-button svg {
          display: block;
          width: 28px;
          height: 28px;
        }

        .co-mobile-nav-links a:hover {
          color: ${PURPLE};
        }

        .co-mobile-nav-backdrop,
        .co-mobile-nav-drawer {
          display: none;
        }

        .co-mobile-nav-backdrop {
          position: fixed;
          inset: 0;
          z-index: 90;
          background: rgba(0, 0, 0, 0.45);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }

        .co-mobile-nav-backdrop.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        .co-mobile-nav-drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          z-index: 100;
          width: min(280px, 82vw);
          background: #ffffff;
          box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          flex-direction: column;
          padding: 24px 24px 40px;
        }

        .co-mobile-nav-drawer.is-open {
          transform: translateX(0);
        }

        .co-mobile-nav-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 40px;
        }

        .co-mobile-nav-close {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border: 0;
          background: transparent;
          cursor: pointer;
        }

        .co-mobile-nav-links {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .co-mobile-nav-links a {
          display: block;
          padding: 16px 0;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          color: #1f1f1f;
          text-decoration: none;
          font-size: 20px;
          font-weight: 600;
          letter-spacing: -0.02em;
        }

        .co-hero-wrap {
          overflow-x: clip;
          background:
            radial-gradient(circle at 78% 14%, rgba(255, 199, 232, 0.75), rgba(255, 176, 230, 0.28) 28%, rgba(255, 255, 255, 0) 58%),
            linear-gradient(90deg, #ffffff 0%, #ffffff 44%, #ffb0e6 100%);
        }

        .co-hero-inner {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 470px;
          gap: 36px;
          padding-top: 88px;
          padding-bottom: 82px;
          min-width: 0;
        }

        .co-hero-copy {
          max-width: 688px;
          min-width: 0;
        }

        .co-hero-title {
          margin: 0;
          font-family: 'Plus Jakarta Sans', var(--font-body), sans-serif;
          font-size: 62px;
          font-weight: 800;
          line-height: 0.96;
          letter-spacing: -0.045em;
          color: #191919;
        }

        .co-hero-title-desktop .co-title-line {
          display: block;
          white-space: nowrap;
          color: #191919;
        }

        .co-hero-title-mobile .co-title-line {
          display: block;
          color: #191919;
        }
        .co-hero-title-mobile .co-title-line--keep {
          white-space: normal;
        }

        .co-hero-title .co-title-accent {
          color: ${PURPLE};
        }

        .co-hero-title-mobile {
          display: none;
        }

        .co-hero-copy p {
          margin: 26px 0 0;
          font-size: 18px;
          line-height: 1.45;
          letter-spacing: -0.02em;
          color: #2b2b2b;
          max-width: 596px;
        }

        .co-hero-cta-form {
          margin-top: 38px;
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: 596px;
        }

        .co-hero-url-shell {
          flex: 1 1 auto;
          min-width: 0;
          height: 56px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 18px;
          border-radius: 12px;
          border: 1px solid rgba(0, 0, 0, 0.06);
          background: #eef0f2;
        }

        .co-hero-url-shell:focus-within {
          border-color: rgba(164, 9, 210, 0.9);
          box-shadow: 0 0 0 1px rgba(164, 9, 210, 0.12);
        }

        .co-hero-url-input {
          flex: 1 1 auto;
          min-width: 0;
          border: 0;
          outline: none;
          background: transparent;
          color: #111111;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.02em;
          line-height: 1.35;
        }

        .co-hero-url-input::placeholder {
          color: rgba(17, 17, 17, 0.58);
        }

        .co-primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 220px;
          height: 56px;
          padding: 0 26px;
          border: 0;
          border-radius: 12px;
          background: #000000;
          color: #ffffff;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.01em;
          cursor: pointer;
        }

        .co-primary-button:hover {
          background: #121212;
        }

        .co-primary-button:disabled {
          opacity: 0.78;
          cursor: wait;
        }

        .co-hero-input-error {
          margin-top: 10px;
          color: #b42318;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        .co-rating {
          margin-top: 42px;
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .co-rating-main {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .co-rating-main strong,
        .co-rating-copy {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #191919;
        }

        .co-trustpilot-stars {
          width: 124px;
          height: auto;
          display: block;
        }

        .co-stats {
          margin-top: 38px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 22px;
          max-width: 660px;
          min-width: 0;
        }

        .co-stat-value {
          display: block;
          font-family: 'Plus Jakarta Sans', var(--font-body), sans-serif;
          font-size: 32px;
          font-weight: 600;
          line-height: 1.2;
          letter-spacing: -0.03em;
          color: #1f1f1f;
        }

        .co-stat-label {
          margin-top: 8px;
          display: block;
          font-size: 13px;
          line-height: 1.35;
          letter-spacing: -0.02em;
          color: #000000;
          max-width: none;
        }

        .co-stat-value-mobile {
          display: none;
        }

        .co-hero-card {
          align-self: start;
          min-width: 0;
          max-width: 100%;
          margin-top: 38px;
          background: #ffffff;
          border: 3px solid #111111;
          border-radius: 18px;
          box-shadow: 8px 8px 0 #111111;
          padding: 30px 32px 26px;
        }

        .co-hero-card h2 {
          margin: 0;
          font-family: 'Plus Jakarta Sans', var(--font-body), sans-serif;
          font-size: 24px;
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.03em;
          color: #111111;
        }

        .co-hero-card ul {
          margin: 20px 0 0;
          padding: 20px 0 19px;
          list-style: none;
          border-top: 3px solid #1b1b1b;
          border-bottom: 3px solid #1b1b1b;
        }

        .co-hero-card li {
          position: relative;
          padding: 15px 0 15px 32px;
          font-family: 'Plus Jakarta Sans', var(--font-body), sans-serif;
          font-size: 20px;
          line-height: 1.22;
          letter-spacing: -0.03em;
          color: #1a1a1a;
          border-bottom: 1px solid rgba(0, 0, 0, 0.09);
        }

        .co-hero-card li:last-child {
          border-bottom: 0;
        }

        .co-hero-card li::before {
          content: '•';
          position: absolute;
          left: 10px;
          top: 14px;
          font-size: 22px;
          line-height: 1;
          color: #111111;
        }

        .co-hero-card-footer {
          margin-top: 12px;
          font-family: 'Plus Jakarta Sans', var(--font-body), sans-serif;
          font-size: 20px;
          line-height: 1.35;
          letter-spacing: -0.03em;
          color: #161616;
        }

        .co-hero-card-footer span {
          color: ${PURPLE};
        }

        .co-statement {
          padding: 74px 0 56px;
          background: #ffffff;
        }

        .co-statement p {
          margin: 0;
          max-width: 1120px;
          font-family: 'Plus Jakarta Sans', var(--font-body), sans-serif;
          font-size: 46px;
          font-weight: 700;
          line-height: 1.16;
          letter-spacing: -0.035em;
          color: #222222;
        }

        .co-features {
          padding-bottom: 86px;
          background: #ffffff;
        }

        .co-feature-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 42px;
        }

        .co-feature-item {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .co-feature-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 46px;
        }

        .co-feature-item h3 {
          margin: 26px 0 0;
          font-family: 'Plus Jakarta Sans', var(--font-body), sans-serif;
          font-size: 30px;
          font-weight: 700;
          line-height: 1.08;
          letter-spacing: -0.03em;
          color: #232323;
          max-width: 320px;
        }

        .co-feature-item p {
          margin: 20px 0 0;
          font-size: 19px;
          line-height: 1.45;
          letter-spacing: -0.02em;
          color: #262626;
          max-width: 318px;
        }

        .co-steps {
          padding: 0 0 80px;
          background: #ffffff;
        }

        .co-step-list {
          display: flex;
          flex-direction: column;
          gap: 36px;
        }

        .co-step-card {
          position: relative;
          min-height: 300px;
          padding: 56px 0 0 56px;
          background: #eef1f3;
          border: 1px solid rgba(0, 0, 0, 0.05);
          border-radius: 32px;
          overflow: hidden;
          isolation: isolate;
        }

        .co-step-card--1 {
          min-height: 330px;
        }

        .co-step-card--2 {
          min-height: 296px;
        }

        .co-step-card--3 {
          min-height: 300px;
        }

        .co-step-card--4 {
          min-height: 298px;
        }

        .co-step-card--5 {
          min-height: 310px;
        }

        .co-step-copy {
          position: relative;
          z-index: 1;
          width: calc(100% - 542px);
          max-width: 708px;
          padding: 0 38px 44px 0;
        }

        .co-step-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 126px;
          height: 50px;
          padding: 0 24px;
          border-radius: 999px;
          background: #000000;
          color: #ffffff;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .co-step-copy h3 {
          margin: 30px 0 0;
          font-family: 'Plus Jakarta Sans', var(--font-body), sans-serif;
          font-size: 54px;
          font-weight: 700;
          line-height: 1.04;
          letter-spacing: -0.05em;
          color: #1f1f1f;
          max-width: 760px;
        }

        .co-step-copy p {
          margin: 18px 0 0;
          max-width: 660px;
          font-size: 19px;
          line-height: 1.55;
          letter-spacing: -0.03em;
          color: #2a2a2a;
        }

        .co-step-visual {
          position: absolute;
          top: 40px;
          right: 0;
          bottom: 0;
          width: clamp(480px, 42.5%, 536px);
          display: flex;
          align-items: stretch;
          z-index: 2;
        }

        .co-step-panel {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          background: #ffffff;
          border-left: 1px solid rgba(0, 0, 0, 0.06);
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          border-radius: 32px 32px 0 0;
          padding: 30px 30px 26px;
        }

        .co-step-panel--table {
          padding: 34px 32px 24px;
        }

        .co-step-panel--messages {
          gap: 32px;
          padding-top: 32px;
        }

        .co-step-panel--responses {
          gap: 12px;
          padding-top: 28px;
        }

        .co-step-soft-row {
          display: flex;
          align-items: center;
          gap: 16px;
          min-height: 58px;
          padding: 0 18px;
          border-radius: 10px;
          background: #edf0f2;
          color: #696969;
          font-size: 17px;
          line-height: 1;
          letter-spacing: -0.025em;
          white-space: nowrap;
        }

        .co-step-soft-row + .co-step-soft-row {
          margin-top: 20px;
        }

        .co-step-soft-row svg,
        .co-step-proof-line svg,
        .co-step-message-card svg,
        .co-step-response-card svg {
          flex-shrink: 0;
        }

        .co-step-proof-line {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 32px;
          color: #666666;
          font-size: 17px;
          line-height: 1.25;
          letter-spacing: -0.025em;
        }

        .co-step-proof-line span {
          min-width: 0;
        }

        .co-step-table-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          min-height: 58px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          color: #666666;
          font-size: 17px;
          line-height: 1.25;
          letter-spacing: -0.025em;
        }

        .co-step-table-row strong {
          color: #111111;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.015em;
        }

        .co-step-note {
          padding-top: 18px;
          font-size: 15px;
          line-height: 1.4;
          text-align: center;
          letter-spacing: -0.02em;
          color: #6a6a6a;
        }

        .co-step-message-card {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          min-height: 72px;
          padding: 15px 18px;
          border-radius: 10px;
          background: #edf0f2;
        }

        .co-step-message-copy {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .co-step-message-copy strong {
          font-size: 18px;
          line-height: 1.2;
          color: #181818;
          letter-spacing: -0.03em;
        }

        .co-step-message-copy span {
          font-size: 15px;
          line-height: 1.35;
          color: #444444;
          letter-spacing: -0.02em;
        }

        .co-step-response-card {
          display: flex;
          align-items: center;
          gap: 16px;
          min-height: 64px;
          padding: 0 18px;
          border-radius: 10px;
          background: #edf0f2;
          color: #363636;
          font-size: 17px;
          line-height: 1.25;
          letter-spacing: -0.025em;
        }

        .co-testimonials {
          background: #eef0f2;
          padding: 76px 0 80px;
        }

        .co-testimonials h2 {
          margin: 0;
          font-family: 'Plus Jakarta Sans', var(--font-body), sans-serif;
          font-size: 38px;
          font-weight: 700;
          line-height: 1.08;
          letter-spacing: -0.035em;
          color: #222222;
        }

        .co-testimonial-grid {
          margin-top: 38px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 28px 30px;
        }

        .co-testimonial-scroll-wrap {
          display: none;
          height: 460px;
          overflow: hidden;
          position: relative;
          margin-top: 18px;
        }

        .co-testimonial-scroll-track {
          display: flex;
          flex-direction: column;
          gap: 16px;
          animation: co-scroll-up 28s linear infinite;
        }

        @keyframes co-scroll-up {
          0% {
            transform: translateY(0);
          }

          100% {
            transform: translateY(-50%);
          }
        }

        .co-testimonial-scroll-fade-top,
        .co-testimonial-scroll-fade-bottom {
          position: absolute;
          left: 0;
          right: 0;
          height: 120px;
          pointer-events: none;
          z-index: 2;
        }

        .co-testimonial-scroll-fade-top {
          top: 0;
          background: linear-gradient(to top, rgba(238, 240, 242, 0) 0%, #eef0f2 100%);
        }

        .co-testimonial-scroll-fade-bottom {
          bottom: 0;
          background: linear-gradient(to bottom, rgba(238, 240, 242, 0) 0%, #eef0f2 100%);
        }

        .co-testimonial-card {
          min-height: 260px;
          background: #ffffff;
          border-radius: 24px;
          padding: 26px 26px 22px;
        }

        .co-testimonial-card p {
          margin: 22px 0 0;
          font-size: 19px;
          line-height: 1.46;
          letter-spacing: -0.02em;
          color: #262626;
        }

        .co-testimonial-card strong {
          display: block;
          margin-top: 24px;
          font-size: 17px;
          font-weight: 800;
          line-height: 1.25;
          letter-spacing: -0.02em;
          color: #161616;
        }

        .co-faq {
          background: #ffffff;
          padding: 72px 0 84px;
        }

        .co-faq h2 {
          margin: 0;
          font-family: 'Plus Jakarta Sans', var(--font-body), sans-serif;
          font-size: 38px;
          font-weight: 800;
          line-height: 1.04;
          letter-spacing: -0.035em;
          color: #111111;
        }

        .co-faq-list {
          margin-top: 38px;
        }

        .co-faq-row {
          padding: 24px 0 26px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        .co-faq-row-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .co-faq-row h3 {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
          line-height: 1.4;
          letter-spacing: -0.02em;
          color: #111111;
        }

        .co-faq-row p {
          margin: 16px 0 0;
          max-width: 930px;
          white-space: pre-line;
          font-size: 18px;
          line-height: 1.45;
          letter-spacing: -0.015em;
          color: #232323;
        }

        .co-faq-button-row {
          display: flex;
          justify-content: center;
          margin-top: 28px;
        }

        .co-faq-button {
          width: 136px;
          height: 44px;
          border: 0;
          background: #000000;
          color: #ffffff;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.01em;
          cursor: pointer;
        }

        .co-pricing {
          background: #f5a9df;
          padding: 72px 0 60px;
        }

        .co-pricing-head {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .co-pricing h2 {
          margin: 0;
          max-width: 930px;
          font-family: 'Plus Jakarta Sans', var(--font-body), sans-serif;
          font-size: 38px;
          font-weight: 700;
          line-height: 1.08;
          letter-spacing: -0.035em;
          color: #222222;
        }

        .co-pricing p {
          margin: 20px 0 0;
          max-width: 760px;
          font-size: 19px;
          line-height: 1.45;
          letter-spacing: -0.02em;
          color: #272727;
        }

        .co-pricing-grid {
          margin-top: 36px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 24px;
        }

        .co-plan-card {
          position: relative;
          display: flex;
          flex-direction: column;
          background: #ffffff;
          border-radius: 26px;
          padding: 26px 24px 20px;
          min-height: 640px;
          border: 1px solid rgba(0, 0, 0, 0.06);
        }

        .co-plan-badge {
          position: absolute;
          top: 16px;
          right: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 32px;
          padding: 0 12px;
          border-radius: 999px;
          background: #f14d67;
          color: #ffffff;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .co-house-wrap {
          height: 164px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .co-house-svg {
          width: 166px;
          height: auto;
          display: block;
        }

        .co-plan-card h3 {
          margin: 0;
          font-family: 'Plus Jakarta Sans', var(--font-body), sans-serif;
          font-size: 22px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.03em;
          color: #121212;
        }

        .co-plan-tagline {
          margin-top: 14px;
          font-size: 18px;
          line-height: 1.35;
          letter-spacing: -0.015em;
          color: #222222;
        }

        .co-plan-separator {
          margin-top: 20px;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
          padding-top: 18px;
        }

        .co-plan-intro {
          font-size: 16px;
          line-height: 1.3;
          letter-spacing: -0.015em;
          color: #171717;
          font-weight: 700;
        }

        .co-plan-list {
          margin: 16px 0 0;
          padding: 0;
          list-style: none;
        }

        .co-plan-list li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 16px;
          line-height: 1.3;
          letter-spacing: -0.015em;
          color: #1f1f1f;
        }

        .co-plan-list li + li {
          margin-top: 14px;
        }

        .co-plan-footer {
          margin-top: auto;
          padding-top: 22px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .co-plan-price {
          font-family: 'Plus Jakarta Sans', var(--font-body), sans-serif;
          font-size: 24px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.03em;
          color: #121212;
        }

        .co-plan-button {
          width: 100%;
          height: 46px;
          border: 0;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.015em;
          cursor: pointer;
        }

        .co-footer {
          background: #ffffff;
        }

        .co-footer .co-brand-logo {
          height: 54px;
        }

        .co-footer-inner {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 16px;
          min-height: 90px;
        }

        .co-footer-copy {
          justify-self: center;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: #272727;
        }

        .co-footer-links {
          justify-self: end;
          display: flex;
          align-items: center;
          gap: 34px;
        }

        .co-footer-links a {
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: #2d2d2d;
        }

        .co-footer-links a:hover {
          color: ${PURPLE};
        }

        @media (max-width: 1120px) {
          .co-inner {
            padding: 0 40px;
          }

          .co-hero-inner {
            grid-template-columns: minmax(0, 1fr) 432px;
            gap: 26px;
          }

          .co-hero-title {
            font-size: 49px;
          }

          .co-hero-card li {
            font-size: 18px;
          }

          .co-statement p {
            font-size: 36px;
          }

          .co-step-card {
            padding-left: 44px;
          }

          .co-step-copy {
            width: calc(100% - 468px);
            padding-right: 28px;
            padding-bottom: 36px;
          }

          .co-step-copy h3 {
            font-size: 42px;
          }

          .co-step-copy p {
            max-width: 580px;
            font-size: 17px;
          }

          .co-step-visual {
            top: 36px;
            width: clamp(400px, 40%, 486px);
          }

          .co-step-panel {
            border-radius: 28px 28px 0 0;
            padding: 26px 24px 22px;
          }

          .co-step-panel--table {
            padding: 30px 26px 22px;
          }

          .co-step-panel--messages {
            gap: 20px;
            padding-top: 26px;
          }

          .co-step-panel--responses {
            gap: 10px;
            padding-top: 22px;
          }

          .co-step-soft-row {
            min-height: 50px;
            gap: 12px;
            padding: 0 16px;
            font-size: 14px;
          }

          .co-step-soft-row + .co-step-soft-row {
            margin-top: 16px;
          }

          .co-step-proof-line {
            margin-top: 26px;
            font-size: 14px;
          }

          .co-step-table-row,
          .co-step-table-row strong {
            font-size: 14px;
          }

          .co-step-table-row {
            min-height: 50px;
          }

          .co-step-note {
            font-size: 12px;
          }

          .co-step-message-card {
            min-height: 64px;
            padding: 14px 16px;
          }

          .co-step-message-copy strong {
            font-size: 15px;
          }

          .co-step-message-copy span {
            font-size: 13px;
          }

          .co-step-response-card {
            min-height: 58px;
            padding: 0 16px;
            font-size: 14px;
          }
        }

        @media (max-width: 920px) {
          .co-inner {
            padding: 0 16px;
          }

          .co-nav {
            display: none;
          }

          .co-auth-row {
            display: none;
          }

          .co-menu-button {
            display: inline-flex;
          }

          .co-mobile-nav-backdrop {
            display: block;
          }

          .co-mobile-nav-drawer {
            display: flex;
          }

          .co-header-inner {
            min-height: 74px;
          }

          .co-brand-logo {
            height: 40px;
          }

          .co-hero-wrap {
            background: linear-gradient(180deg, #f3a4df 0%, #f7b4e7 42%, #ffffff 100%);
          }

          .co-hero-inner {
            grid-template-columns: 1fr;
            gap: 28px;
            padding-top: 30px;
            padding-bottom: 38px;
          }

          .co-hero-copy {
            max-width: none;
          }

          .co-hero-title {
            max-width: 100%;
            font-size: clamp(30px, 8.3vw, 39px);
            line-height: 1;
            letter-spacing: -0.05em;
          }

          .co-hero-title-desktop {
            display: none;
          }

          .co-hero-title-mobile {
            display: block;
          }
          .co-hero-title-mobile .co-title-line--keep {
            display: block;
            max-width: 100%;
            white-space: normal;
          }

          .co-hero-copy p {
            margin-top: 18px;
            font-size: 16px;
            line-height: 1.45;
            max-width: none;
          }

          .co-primary-button {
            width: 100%;
            min-width: 0;
            height: 50px;
            border-radius: 10px;
            font-size: 16px;
          }

          .co-hero-cta-form {
            margin-top: 24px;
            display: grid;
            gap: 10px;
            max-width: none;
          }

          .co-hero-url-shell {
            width: 100%;
            height: 50px;
            padding: 0 18px;
            border-radius: 10px;
          }

          .co-hero-url-input {
            font-size: 16px;
          }

          .co-rating {
            margin-top: 20px;
            gap: 6px;
            align-items: flex-start;
            flex-direction: column;
          }

          .co-rating-main {
            gap: 8px;
          }

          .co-rating-main strong,
          .co-rating-copy {
            font-size: 15px;
          }

          .co-trustpilot-stars {
            width: 88px;
          }

          .co-stats {
            margin-top: 20px;
            gap: 14px;
            max-width: none;
          }

          .co-stat-value {
            font-size: 24px;
            line-height: 1.2;
            font-weight: 600;
          }

          .co-stat-value-desktop {
            display: none;
          }

          .co-stat-value-mobile {
            display: inline;
          }

          .co-stat-label {
            margin-top: 6px;
            font-size: 13px;
            line-height: 1.35;
            max-width: none;
          }

          .co-hero-card {
            margin-top: 4px;
            padding: 20px 18px 20px;
            border-radius: 14px;
            border-width: 2px;
            box-shadow: 4px 4px 0 #111111;
          }

          .co-hero-card h2 {
            font-size: 17px;
          }

          .co-hero-card ul {
            margin-top: 12px;
            padding: 12px 0;
            border-top-width: 2px;
            border-bottom-width: 2px;
          }

          .co-hero-card li {
            padding: 10px 0 10px 18px;
            font-size: 15px;
            line-height: 1.45;
          }

          .co-hero-card li::before {
            left: 1px;
            top: 9px;
            font-size: 16px;
          }

          .co-hero-card-footer {
            margin-top: 10px;
            font-size: 15px;
            line-height: 1.45;
          }

          .co-statement {
            padding: 34px 0 30px;
          }

          .co-statement p {
            font-size: 28px;
            line-height: 1.12;
          }

          .co-features {
            padding-bottom: 34px;
          }

          .co-feature-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }

          .co-feature-item h3 {
            margin-top: 14px;
            font-size: 24px;
            max-width: 260px;
          }

          .co-feature-item p {
            margin-top: 10px;
            font-size: 16px;
            line-height: 1.45;
            max-width: none;
          }

          .co-steps {
            padding-bottom: 36px;
          }

          .co-step-list {
            gap: 18px;
          }

          .co-step-card {
            min-height: 0;
            padding: 14px 0 0;
            border-radius: 28px;
          }

          .co-step-copy {
            width: auto;
            max-width: none;
            padding: 0 14px;
          }

          .co-step-badge {
            min-width: 104px;
            height: 44px;
            padding: 0 18px;
            font-size: 16px;
          }

          .co-step-copy h3 {
            margin-top: 22px;
            font-size: 30px;
            max-width: 282px;
          }

          .co-step-copy p {
            margin-top: 14px;
            max-width: none;
            font-size: 16px;
            line-height: 1.5;
          }

          .co-step-visual {
            position: static;
            width: auto;
            margin: 18px 0 0 14px;
          }

          .co-step-panel {
            min-height: 0;
            border: 1px solid rgba(0, 0, 0, 0.06);
            border-radius: 22px;
            padding: 18px 16px 16px;
          }

          .co-step-card--1 .co-step-panel,
          .co-step-card--2 .co-step-panel,
          .co-step-card--3 .co-step-panel {
            min-height: 164px;
          }

          .co-step-card--3 .co-step-panel {
            min-height: 176px;
          }

          .co-step-panel--table {
            padding: 16px 16px 14px;
          }

          .co-step-panel--messages {
            gap: 16px;
            padding-top: 16px;
          }

          .co-step-panel--responses {
            gap: 10px;
            padding-top: 14px;
          }

          .co-step-soft-row {
            min-height: 42px;
            gap: 10px;
            padding: 0 14px;
            border-radius: 8px;
            font-size: 14px;
          }

          .co-step-soft-row + .co-step-soft-row {
            margin-top: 18px;
          }

          .co-step-proof-line {
            gap: 10px;
            margin-top: 22px;
            font-size: 14px;
          }

          .co-step-proof-line span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: clip;
          }

          .co-step-table-row {
            min-height: 40px;
            font-size: 13px;
          }

          .co-step-table-row strong {
            font-size: 13px;
          }

          .co-step-note {
            padding-top: 10px;
            font-size: 12px;
          }

          .co-step-message-card {
            min-height: 64px;
            padding: 14px;
            gap: 12px;
          }

          .co-step-message-copy strong {
            font-size: 16px;
          }

          .co-step-message-copy span {
            font-size: 13px;
            line-height: 1.3;
          }

          .co-step-response-card {
            min-height: 44px;
            padding: 0 12px;
            gap: 12px;
            font-size: 13px;
          }

          .co-testimonials {
            padding: 34px 0 26px;
          }

          .co-testimonials h2 {
            font-size: 28px;
            line-height: 1.1;
            max-width: 320px;
          }

          .co-testimonial-grid {
            margin-top: 18px;
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .co-testimonial-card {
            min-height: 158px;
            border-radius: 18px;
            padding: 18px 18px 16px;
          }

          .co-testimonial-card p {
            margin-top: 12px;
            font-size: 16px;
          }

          .co-testimonial-card strong {
            margin-top: 16px;
            font-size: 16px;
          }

          .co-faq {
            padding: 32px 0 34px;
          }

          .co-faq h2 {
            font-size: 32px;
            line-height: 1.02;
            max-width: 270px;
          }

          .co-faq-list {
            margin-top: 18px;
          }

          .co-faq-row {
            padding: 15px 0 16px;
          }

          .co-faq-row h3 {
            font-size: 18px;
            line-height: 1.35;
            max-width: 275px;
          }

          .co-faq-row p {
            margin-top: 10px;
            max-width: none;
            font-size: 14px;
            line-height: 1.45;
          }

          .co-faq-button-row {
            margin-top: 14px;
          }

          .co-faq-button {
            width: 116px;
            height: 42px;
            font-size: 14px;
          }

          .co-pricing {
            padding: 28px 0 24px;
          }

          .co-pricing h2 {
            font-size: 26px;
            max-width: 330px;
            line-height: 1.04;
          }

          .co-pricing-head {
            padding: 0 4px;
          }

          .co-pricing p {
            margin-top: 12px;
            max-width: 320px;
            font-size: 15px;
            line-height: 1.45;
          }

          .co-pricing-grid {
            margin-top: 18px;
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .co-plan-card {
            min-height: 0;
            border-radius: 20px;
            padding: 18px 14px 14px;
          }

          .co-plan-badge {
            top: 10px;
            right: 10px;
            height: 22px;
            padding: 0 10px;
            font-size: 10px;
          }

          .co-house-wrap {
            height: 108px;
          }

          .co-house-svg {
            width: 118px;
          }

          .co-plan-card h3 {
            font-size: 19px;
          }

          .co-plan-tagline {
            margin-top: 8px;
            font-size: 15px;
          }

          .co-plan-separator {
            margin-top: 14px;
            padding-top: 12px;
          }

          .co-plan-intro,
          .co-plan-list li {
            font-size: 14px;
            line-height: 1.35;
          }

          .co-plan-list li + li {
            margin-top: 10px;
          }

          .co-plan-footer {
            padding-top: 14px;
            gap: 12px;
          }

          .co-plan-price {
            font-size: 22px;
          }

          .co-plan-button {
            height: 42px;
            font-size: 15px;
            border-radius: 8px;
          }

          .co-footer-inner {
            grid-template-columns: 1fr;
            justify-items: center;
            padding-top: 14px;
            padding-bottom: 18px;
            gap: 8px;
            min-height: 0;
          }

          .co-footer-copy {
            order: 2;
            font-size: 14px;
          }

          .co-footer .co-brand-logo {
            height: 44px;
          }

          .co-footer-links {
            order: 3;
            justify-self: center;
            gap: 24px;
          }
        }

        @media (max-width: 640px) {
          .co-testimonial-grid {
            display: none;
          }

          .co-testimonial-scroll-wrap {
            display: block;
          }

          .co-testimonial-card {
            min-height: unset;
            gap: 16px;
          }

          .co-testimonial-card p {
            margin-top: 10px;
            font-size: 15px;
            letter-spacing: -0.01em;
          }

          .co-testimonial-card strong {
            margin-top: 10px;
            font-size: 15px;
          }
        }

        @media (max-width: 0px) {
          .co-inner {
            padding: 0 14px;
          }

          .co-header-inner {
            min-height: 50px;
          }

          .co-brand-title {
            font-size: 16px;
          }

          .co-brand-subtitle {
            font-size: 8px;
            padding-left: 26px;
          }

          .co-hero-inner {
            gap: 18px;
            padding-top: 20px;
            padding-bottom: 26px;
          }

          .co-hero-title {
            font-size: 32px;
            line-height: 0.98;
            letter-spacing: -0.05em;
          }

          .co-hero-copy p {
            margin-top: 14px;
            font-size: 11px;
          }

          .co-primary-button {
            height: 40px;
            font-size: 12px;
          }

          .co-hero-cta-form {
            margin-top: 18px;
            gap: 8px;
          }

          .co-hero-url-shell {
            height: 40px;
            padding: 0 12px;
          }

          .co-hero-url-input {
            font-size: 12px;
          }

          .co-rating {
            margin-top: 16px;
          }

          .co-rating-main strong,
          .co-rating-copy {
            font-size: 11px;
          }

          .co-trustpilot-stars {
            width: 68px;
          }

          .co-stats {
            margin-top: 14px;
            gap: 8px;
          }

          .co-stat-value {
            font-size: 24px;
            line-height: 1.2;
            font-weight: 600;
          }

          .co-stat-label {
            margin-top: 4px;
            font-size: 13px;
            line-height: 1.35;
            max-width: none;
          }

          .co-hero-card {
            padding: 14px 12px 14px;
            border-radius: 12px;
            box-shadow: 4px 4px 0 #111111;
          }

          .co-hero-card h2 {
            font-size: 13px;
          }

          .co-hero-card ul {
            margin-top: 10px;
            padding: 10px 0;
          }

          .co-hero-card li {
            padding: 8px 0 8px 16px;
            font-size: 10px;
          }

          .co-hero-card li::before {
            left: 0;
            top: 7px;
            font-size: 14px;
          }

          .co-hero-card-footer {
            margin-top: 8px;
            font-size: 10px;
          }

          .co-statement {
            padding: 26px 0 24px;
          }

          .co-statement p {
            font-size: 18px;
            line-height: 1.08;
          }

          .co-features {
            padding-bottom: 28px;
          }

          .co-feature-grid {
            gap: 18px;
          }

          .co-feature-icon {
            height: 32px;
          }

          .co-feature-item h3 {
            margin-top: 8px;
            font-size: 15px;
            max-width: 220px;
          }

          .co-feature-item p {
            margin-top: 8px;
            font-size: 11px;
          }

          .co-steps {
            padding-bottom: 28px;
          }

          .co-step-list {
            gap: 16px;
          }

          .co-step-card {
            padding-top: 13px;
            border-radius: 26px;
          }

          .co-step-copy {
            padding: 0 12px;
          }

          .co-step-badge {
            min-width: 92px;
            height: 38px;
            padding: 0 16px;
            font-size: 13px;
          }

          .co-step-copy h3 {
            margin-top: 20px;
            font-size: 22px;
            max-width: 250px;
          }

          .co-step-copy p {
            margin-top: 12px;
            font-size: 11.5px;
          }

          .co-step-visual {
            margin: 16px 12px 0;
          }

          .co-step-panel {
            border-radius: 20px;
            padding: 15px 12px 14px;
          }

          .co-step-card--1 .co-step-panel,
          .co-step-card--2 .co-step-panel {
            min-height: 146px;
          }

          .co-step-card--3 .co-step-panel {
            min-height: 170px;
          }

          .co-step-panel--table {
            padding: 14px 12px 12px;
          }

          .co-step-panel--messages {
            gap: 12px;
            padding-top: 12px;
          }

          .co-step-panel--responses {
            gap: 8px;
            padding-top: 10px;
          }

          .co-step-soft-row {
            min-height: 32px;
            gap: 8px;
            padding: 0 10px;
            border-radius: 7px;
            font-size: 10px;
          }

          .co-step-soft-row + .co-step-soft-row {
            margin-top: 14px;
          }

          .co-step-proof-line {
            gap: 8px;
            margin-top: 18px;
            font-size: 10px;
          }

          .co-step-table-row,
          .co-step-table-row strong {
            font-size: 8px;
          }

          .co-step-table-row {
            min-height: 30px;
          }

          .co-step-note {
            padding-top: 8px;
            font-size: 7.5px;
          }

          .co-step-message-card {
            min-height: 56px;
            padding: 12px 10px;
            gap: 10px;
          }

          .co-step-message-copy strong {
            font-size: 11px;
          }

          .co-step-message-copy span {
            font-size: 8.5px;
          }

          .co-step-response-card {
            min-height: 40px;
            padding: 0 10px;
            gap: 10px;
            font-size: 8.5px;
          }

          .co-testimonials {
            padding: 28px 0 22px;
          }

          .co-testimonials h2 {
            font-size: 18px;
            max-width: 250px;
          }

          .co-testimonial-grid {
            margin-top: 14px;
            gap: 12px;
          }

          .co-testimonial-card {
            min-height: 126px;
            border-radius: 14px;
            padding: 14px 14px 12px;
          }

          .co-testimonial-card p {
            margin-top: 8px;
            font-size: 11px;
          }

          .co-testimonial-card strong {
            margin-top: 12px;
            font-size: 11px;
          }

          .co-faq {
            padding: 28px 0 30px;
          }

          .co-faq h2 {
            font-size: 18px;
            max-width: 190px;
          }

          .co-faq-list {
            margin-top: 14px;
          }

          .co-faq-row {
            padding: 12px 0 13px;
          }

          .co-faq-row h3 {
            font-size: 12px;
            max-width: 210px;
          }

          .co-faq-row p {
            margin-top: 8px;
            font-size: 9px;
          }

          .co-faq-button-row {
            margin-top: 12px;
          }

          .co-faq-button {
            width: 92px;
            height: 30px;
            font-size: 10px;
          }

          .co-pricing {
            padding: 22px 0 20px;
          }

          .co-pricing h2 {
            font-size: 16px;
            max-width: 290px;
          }

          .co-pricing p {
            margin-top: 10px;
            max-width: 280px;
            font-size: 10px;
          }

          .co-pricing-grid {
            margin-top: 14px;
            gap: 12px;
          }

          .co-plan-card {
            border-radius: 16px;
            padding: 14px 12px 12px;
          }

          .co-plan-badge {
            top: 8px;
            right: 8px;
            height: 20px;
            padding: 0 9px;
            font-size: 9px;
          }

          .co-house-wrap {
            height: 90px;
          }

          .co-house-svg {
            width: 96px;
          }

          .co-plan-card h3 {
            font-size: 15px;
          }

          .co-plan-tagline {
            margin-top: 6px;
            font-size: 11px;
          }

          .co-plan-separator {
            margin-top: 10px;
            padding-top: 10px;
          }

          .co-plan-intro,
          .co-plan-list li {
            font-size: 10px;
          }

          .co-plan-list {
            margin-top: 10px;
          }

          .co-plan-list li + li {
            margin-top: 8px;
          }

          .co-plan-footer {
            padding-top: 12px;
            gap: 10px;
          }

          .co-plan-price {
            font-size: 15px;
          }

          .co-plan-button {
            height: 34px;
            font-size: 11px;
          }

          .co-footer-inner {
            padding-top: 12px;
            padding-bottom: 16px;
          }

          .co-footer .co-brand-title {
            font-size: 16px;
          }

          .co-footer .co-brand-subtitle {
            font-size: 8px;
            padding-left: 28px;
          }

          .co-footer-copy,
          .co-footer-links a {
            font-size: 11px;
          }
        }

      `}</style>

      <header className="co-header">
        <div className="co-inner co-header-inner">
          <BrandLockup />
          <div className="co-header-right">
            <nav className="co-nav" aria-label="Custom Offer sections">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href}>
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="co-auth-row">
              {accessEmail ? (
                <>
                  <button type="button" className="co-auth-button" onClick={handleOpenPortal}>
                    My submissions
                  </button>
                  <button type="button" className="co-auth-button" onClick={handleSignOut}>
                    Sign out
                  </button>
                </>
              ) : (
                <button type="button" className="co-auth-button" onClick={handleOpenSignIn}>
                  Sign in
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            className="co-menu-button"
            aria-label="Open navigation menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="co-mobile-nav-drawer"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <HamburgerIcon />
          </button>
        </div>
      </header>

      <div className={`co-mobile-nav-backdrop${isMobileMenuOpen ? ' is-open' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
      <aside
        id="co-mobile-nav-drawer"
        className={`co-mobile-nav-drawer${isMobileMenuOpen ? ' is-open' : ''}`}
        aria-label="Custom Offer mobile sections"
        aria-hidden={!isMobileMenuOpen}
      >
        <div className="co-mobile-nav-drawer-header">
          <BrandLockup />
          <button type="button" className="co-mobile-nav-close" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close navigation menu">
            <MenuCloseIcon />
          </button>
        </div>
        <nav className="co-mobile-nav-links">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setIsMobileMenuOpen(false)}>
              {link.label}
            </a>
          ))}
        </nav>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
          {accessEmail ? (
            <>
              <button type="button" className="co-auth-button" onClick={handleOpenPortal}>
                My submissions
              </button>
              <button type="button" className="co-auth-button" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <button type="button" className="co-auth-button" onClick={handleOpenSignIn}>
              Sign in
            </button>
          )}
        </div>
      </aside>

      <main>
        <section className="co-hero-wrap">
          <div className="co-inner co-hero-inner">
            <div className="co-hero-copy">
              <h1 className="co-hero-title co-hero-title-desktop">
                <span className="co-title-line">
                  Make <span className="co-title-accent">Property Offers</span> That
                </span>
                <span className="co-title-line">Don't Fit the Traditional Box</span>
              </h1>
              <h1 className="co-hero-title co-hero-title-mobile">
                <span className="co-title-line co-title-line--keep">
                  <span>Make</span> <span className="co-title-accent">Property Offers</span>
                </span>
                <span className="co-title-line">That Don't Fit the</span>
                <span className="co-title-line">Traditional Box</span>
              </h1>
              <p>
                Found a property you love, but need a better way to explain your offer? Custom Offer helps buyers present
                flexible terms, stronger context, and seller-friendly proposals alongside the traditional estate agent process.
              </p>
              <form
                className="co-hero-cta-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void beginProposalFlow();
                }}
              >
                <label className="co-hero-url-shell" aria-label="Property address or listing URL">
                  <LinkInputIcon />
                  <input
                    className="co-hero-url-input"
                    type="text"
                    inputMode="text"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="Enter a property address or listing URL"
                    value={listingUrl}
                    onChange={(event) => {
                      setListingUrl(event.target.value);
                      if (ctaError) setCtaError('');
                    }}
                  />
                </label>
                <button type="submit" className="co-primary-button" disabled={isStartingFlow}>
                  {isStartingFlow ? 'Preparing proposal...' : 'Make a custom offer'}
                </button>
              </form>
              {ctaError ? <div className="co-hero-input-error">{ctaError}</div> : null}

              <div className="co-rating">
                <div className="co-rating-main">
                  <strong>Excellent</strong>
                  <TrustpilotStars />
                </div>
                <div className="co-rating-copy">Based on verified customer feedback</div>
              </div>

              <div className="co-stats">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <span className="co-stat-value">
                      <span className="co-stat-value-desktop">{stat.desktopValue}</span>
                      <span className="co-stat-value-mobile">{stat.mobileValue}</span>
                    </span>
                    <span className="co-stat-label">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <aside className="co-hero-card">
              <h2>Whether you are:</h2>
              <ul>
                <li>chain-free or ready to move quickly</li>
                <li>a cash buyer or mortgage buyer with strong certainty</li>
                <li>proposing flexible completion timing</li>
                <li>offering seller-friendly terms</li>
                <li>or simply want your proposal properly presented</li>
              </ul>
              <div className="co-hero-card-footer">
                We help you present your
                <br />
                interest <span>professionally.</span>
              </div>
            </aside>
          </div>
        </section>

        <section className="co-statement">
          <div className="co-inner">
            <p>
              Sellers value certainty and serious intent, not just straightforward offers.
            </p>
          </div>
        </section>

        <section className="co-features">
          <div className="co-inner co-feature-grid">
            {featureItems.map((feature) => (
              <article key={feature.title} className="co-feature-item">
                <div className="co-feature-icon">
                  <FeatureIcon icon={feature.icon} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="co-steps">
          <div className="co-inner">
            <div className="co-step-list">
              {steps.map((step, index) => (
                <article key={step.step} className={`co-step-card co-step-card--${index + 1}`}>
                  <div className="co-step-copy">
                    <div className="co-step-badge">{step.step}</div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                  <div className={`co-step-visual co-step-visual--${index + 1}`}>
                    <StepVisual index={index} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="co-testimonials">
          <div className="co-inner">
            <h2>See how buyers created new opportunities</h2>
            <div className="co-testimonial-grid">
              {testimonials.map((testimonial) => (
                <article key={testimonial.author} className="co-testimonial-card">
                  <QuoteMark />
                  <p>{testimonial.text}</p>
                  <strong>- {testimonial.author}</strong>
                </article>
              ))}
            </div>
            <div className="co-testimonial-scroll-wrap">
              <div className="co-testimonial-scroll-track">
                {[...testimonials, ...testimonials].map((testimonial, index) => (
                  <article key={`${testimonial.author}-${index}`} className="co-testimonial-card">
                    <QuoteMark />
                    <p>{testimonial.text}</p>
                    <strong>- {testimonial.author}</strong>
                  </article>
                ))}
              </div>
              <div className="co-testimonial-scroll-fade-top" />
              <div className="co-testimonial-scroll-fade-bottom" />
            </div>
          </div>
        </section>

        <section id="faq" className="co-faq">
          <div className="co-inner">
            <h2>Everything you need to know</h2>
            <div className="co-faq-list">
              {visibleFaqItems.map((item) => (
                <FAQRow key={item.question} question={item.question} answer={item.answer} />
              ))}
            </div>
            <div className="co-faq-button-row">
              <button type="button" className="co-faq-button" onClick={() => setShowAllFaq((value) => !value)}>
                {showAllFaq ? 'See Less' : 'Load more'}
              </button>
            </div>
          </div>
        </section>

        <section id="pricing" className="co-pricing">
          <div className="co-inner">
            <div className="co-pricing-head">
              <h2>Most buyers submit an offer. Our plans help you present a compelling opportunity sellers actually want to consider.</h2>
              <p>
                Stand out with professionally presented proposals that communicate flexibility, certainty, and the full value
                behind your offer - not just the price.
              </p>
            </div>

            <div className="co-pricing-grid">
              {pricingPlans.map((plan) => (
                <article
                  key={plan.name}
                  className="co-plan-card"
                  style={{ border: `3px solid ${plan.borderColor}` }}
                >
                  {plan.badge ? <div className="co-plan-badge">{plan.badge}</div> : null}

                  <div className="co-house-wrap">
                    <HouseArt illustration={plan.illustration} />
                  </div>

                  <h3>{plan.name}</h3>
                  <div className="co-plan-tagline">{plan.tagline}</div>

                  <div className="co-plan-separator">
                    {plan.intro ? <div className="co-plan-intro">{plan.intro}</div> : null}
                    <ul className="co-plan-list">
                      {plan.items.map((item) => (
                        <li key={item}>
                          <VerifyBullet />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="co-plan-footer">
                    <div className="co-plan-price">{plan.price}</div>
                    <button
                      type="button"
                      className="co-plan-button"
                      style={{ background: plan.buttonBg, color: plan.buttonColor }}
                      onClick={() => void beginProposalFlow(plan.id)}
                    >
                      GET STARTED
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <ProductAccessModal
        scope="custom-offers"
        isOpen={accessModalOpen}
        onClose={() => {
          setAccessModalOpen(false);
          setAccessEmail(readProductAccessSession('custom-offers')?.email ?? null);
        }}
      />
    </div>
  );
};

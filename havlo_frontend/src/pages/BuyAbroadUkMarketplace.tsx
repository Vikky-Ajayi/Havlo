import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bath, Bed, Bitcoin, BriefcaseBusiness, CheckCircle, ChevronLeft, ChevronRight, CreditCard, Eye, EyeOff, Heart, Home, Info, Landmark, MapPin, Menu, Play, Search, ShoppingBasket, SlidersHorizontal, Trash2, Undo2, X } from 'lucide-react';
import { api, API_BASE } from '../lib/api';
import { redirectToCheckout } from '../lib/paymentReturn';
import { useAuth } from '../context/AuthContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTypewriter } from '../hooks/useTypewriter';
import { Footer } from '../components/shared/Footer';
import { CountryBadge } from '../components/shared/CountryBadge';

const HERO_COUNTRIES = ['United Kingdom', 'Canada', 'Dubai', 'United States'];

const MARKETPLACE_FAVS = 'havlo_buyabroad_favs';
// Whose favourites MARKETPLACE_FAVS holds (a user id). Unset means homes
// saved on this browser before favourites moved to accounts.
const MARKETPLACE_FAVS_OWNER = 'havlo_buyabroad_favs_owner';
// The key AuthContext keeps the session token under.
const AUTH_TOKEN_KEY = 'havlo_token';
const MARKETPLACE_BASKET = 'havlo_buyabroad_basket';
const LISTING_CACHE_PREFIX = 'havlo_buyabroad_listing_';
const FAVOURITES_PATH = '/buyabroad/uk/favourites';
const CONSULTATION_FEE = 99.99;
const LISTINGS_API_BASE = API_BASE.replace(/\/$/, '');

function listingsApiUrl(path: string) {
  return `${LISTINGS_API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

type AuthView = 'savePrompt' | 'register' | 'login' | 'otp' | 'forgot' | 'reset';
type CheckoutStep = null | 'payment' | 'details' | 'advisor';
type PaymentMethod = 'card' | 'bank' | 'crypto';

interface Listing {
  id: string;
  rightmove_id: string;
  url: string;
  title: string;
  price_gbp: number;
  price_native?: number;
  price_currency?: string;
  price_display?: string;
  price_ngn: number;
  ngn_rate?: number;
  address: string;
  city: string;
  region?: string;
  country?: string;
  source?: string;
  source_label?: string;
  bedrooms: number;
  bathrooms: number | null;
  property_type: string;
  description: string;
  images: string[];
  scraped_at?: string | null;
}

interface ListingsResponse {
  listings: Listing[];
  total?: number;
  page?: number;
  per_page?: number;
  pages?: number;
  country?: string;
}

const fallbackImages = ['/1.png', '/2.png', '/3.png', '/4.png', '/5.png'];

const COUNTRY_SECTIONS = [
  { key: 'uk', title: 'Properties For Sale in the United Kingdom', allTitle: 'All Properties in the United Kingdom' },
  { key: 'america', title: 'Properties For Sale in the United States', allTitle: 'All Homes in the United States' },
  { key: 'dubai', title: 'Properties For Sale in Dubai', allTitle: 'All Homes in Dubai' },
  { key: 'canada', title: 'Properties For Sale in Canada', allTitle: 'All Homes in Canada' },
] as const;

type CountryKey = typeof COUNTRY_SECTIONS[number]['key'];

// Every field here maps to a real, working query param on GET /listings/
// (see app/routers/listings.py) — nothing decorative.
interface ListingFilters {
  country: CountryKey | '';
  minPrice: string;
  maxPrice: string;
  minBeds: string;
  propertyType: string;
}

const EMPTY_FILTERS: ListingFilters = { country: '', minPrice: '', maxPrice: '', minBeds: '', propertyType: '' };

const PROPERTY_TYPE_OPTIONS = [
  { value: '', label: 'Any type' },
  { value: 'house', label: 'House' },
  { value: 'flat', label: 'Flat' },
  { value: 'bungalow', label: 'Bungalow' },
  { value: 'commercial', label: 'Commercial' },
];

const BEDROOM_OPTIONS = [
  { value: '', label: 'Any beds' },
  { value: '1', label: '1+ beds' },
  { value: '2', label: '2+ beds' },
  { value: '3', label: '3+ beds' },
  { value: '4', label: '4+ beds' },
  { value: '5', label: '5+ beds' },
];

function hasActiveFilters(filters: ListingFilters): boolean {
  return Object.values(filters).some((value) => value !== '');
}

// Deliberately does not touch `country` — every call site already knows
// which country(ies) it's fetching (either the fixed row/modal country, or
// the whole visible-sections list already filtered by filters.country), so
// setting it again here would just be a confusing second source of truth.
function appendListingFilterParams(params: URLSearchParams, filters: ListingFilters) {
  if (filters.minPrice) params.set('min_price', filters.minPrice);
  if (filters.maxPrice) params.set('max_price', filters.maxPrice);
  if (filters.minBeds) params.set('min_beds', filters.minBeds);
  if (filters.propertyType) params.set('property_type', filters.propertyType);
}

function emptyCountryListings(): Record<CountryKey, Listing[]> {
  return COUNTRY_SECTIONS.reduce((acc, section) => {
    acc[section.key] = [];
    return acc;
  }, {} as Record<CountryKey, Listing[]>);
}

function emptyCountryFlags(defaultValue = false): Record<CountryKey, boolean> {
  return COUNTRY_SECTIONS.reduce((acc, section) => {
    acc[section.key] = defaultValue;
    return acc;
  }, {} as Record<CountryKey, boolean>);
}

function emptyCountryMessages(): Record<CountryKey, string> {
  return COUNTRY_SECTIONS.reduce((acc, section) => {
    acc[section.key] = '';
    return acc;
  }, {} as Record<CountryKey, string>);
}

function filterListings(listings: Listing[], term: string) {
  const needle = term.trim().toLowerCase();
  if (!needle) return listings;
  return listings.filter((listing) => (
    `${listing.title} ${listing.address} ${listing.city} ${listing.region || ''} ${listing.country || ''} ${listing.description || ''}`
      .toLowerCase()
      .includes(needle)
  ));
}

function readIds(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as string[];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // ignore storage failures
  }
}

function formatGbp(amount: number) {
  return `£${Math.max(0, Math.round(amount || 0)).toLocaleString('en-GB')}`;
}

function cacheListings(listings: Listing[]) {
  try {
    listings.forEach((listing) => {
      if (listing.rightmove_id) {
        sessionStorage.setItem(`${LISTING_CACHE_PREFIX}${listing.rightmove_id}`, JSON.stringify(listing));
      }
    });
  } catch {
    // ignore storage failures
  }
}

function readCachedListing(id?: string): Listing | null {
  if (!id) return null;
  try {
    const raw = sessionStorage.getItem(`${LISTING_CACHE_PREFIX}${id}`);
    return raw ? JSON.parse(raw) as Listing : null;
  } catch {
    return null;
  }
}

function formatMoney(amount: number, currency = 'GBP') {
  const code = (currency || 'GBP').toUpperCase();
  const value = Math.max(0, Math.round(amount || 0));
  const symbols: Record<string, string> = { GBP: '£', USD: '$', CAD: 'C$', AED: 'AED ' };
  return `${symbols[code] || `${code} `}${value.toLocaleString('en-GB')}`;
}

function displayPrice(listing: Listing) {
  const nativeAmount = listing.price_native || listing.price_gbp || 0;
  const nativeCurrency = (listing.price_currency || 'GBP').toUpperCase();
  if (nativeCurrency !== 'GBP' && nativeAmount > 0) {
    return `${formatMoney(nativeAmount, nativeCurrency)} (${formatGbp(listing.price_gbp)})`;
  }
  return listing.price_display || formatGbp(listing.price_gbp || nativeAmount);
}

function cleanText(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function countryLabel(country?: string) {
  const labels: Record<string, string> = {
    uk: 'United Kingdom',
    america: 'United States',
    canada: 'Canada',
    dubai: 'Dubai',
  };
  return labels[(country || '').toLowerCase()] || country || 'International';
}

function sourceLabel(listing: Listing) {
  return listing.source_label || {
    rightmove: 'Rightmove',
    realtor_com: 'Realtor.com',
    realtor_ca: 'Realtor.ca',
    bayut: 'Bayut',
  }[(listing.source || '').toLowerCase()] || (listing.country ? 'Rightmove' : 'Source');
}

function detailUrl(listing: Listing) {
  return `/buyabroad/uk/listings/${encodeURIComponent(listing.rightmove_id)}`;
}

function listingMetaParts(listing: Listing) {
  const parts: React.ReactNode[] = [];
  if (listing.bedrooms > 0) {
    parts.push(<span key="beds"><Bed size={14} /> {listing.bedrooms} {listing.bedrooms === 1 ? 'bed' : 'beds'}</span>);
  }
  if ((listing.bathrooms || 0) > 0) {
    parts.push(<span key="baths"><Bath size={14} /> {listing.bathrooms} {listing.bathrooms === 1 ? 'bath' : 'baths'}</span>);
  }
  const location = cleanText([listing.city, countryLabel(listing.country)].filter(Boolean).join(', '));
  if (location) {
    parts.push(<span key="location"><MapPin size={14} /> {location}</span>);
  }
  return parts;
}

function calcStampDuty(p: number): number {
  if (p <= 125_000) return Math.round(p * 0.02);
  if (p <= 250_000) return Math.round(p * 0.04);
  if (p <= 925_000) return Math.round(p * 0.07);
  if (p <= 1_500_000) return Math.round(p * 0.12);
  return Math.round(p * 0.14);
}

function calcLandRegistry(p: number): number {
  if (p <= 80_000) return 20;
  if (p <= 100_000) return 40;
  if (p <= 200_000) return 100;
  if (p <= 500_000) return 150;
  if (p <= 1_000_000) return 295;
  return 500;
}

function calcHavloFee(p: number): number {
  if (p <= 100_000) return 5_000;
  if (p <= 150_000) return 7_000;
  if (p <= 300_000) return 10_000;
  if (p <= 500_000) return 20_000;
  return 20_000;
}

function costRowsFor(listing: Listing) {
  const p = listing.price_gbp || 0;
  const country = (listing.country || 'uk').toLowerCase();
  if (country === 'uk') {
    return [
      { label: 'Stamp Duty', amount: calcStampDuty(p), accent: true },
      { label: 'Property Search', amount: 500 },
      { label: 'Solicitor/Conveyancing', amount: 2500 },
      { label: 'Land Registry', amount: calcLandRegistry(p), accent: true },
      { label: 'Level 2 Survey', amount: 800 },
      { label: 'Insurance', amount: 600 },
      { label: 'Havlo Advisory fee', amount: calcHavloFee(p), accent: true },
    ];
  }
  return [
    { label: 'Legal due diligence', amount: Math.max(1500, Math.round(p * 0.008)) },
    { label: 'Survey / inspection', amount: Math.max(650, Math.round(p * 0.0025)) },
    { label: 'Transfer and admin costs', amount: Math.max(2500, Math.round(p * 0.035)), accent: true },
    { label: 'Havlo Advisory fee', amount: calcHavloFee(p), accent: true },
  ];
}

function calcMortgage(priceGbp: number, depositPct: number, termYears: number) {
  const RATE = 0.07; // 7% p.a. typical non-resident mortgage
  const loanGbp = priceGbp * (1 - depositPct / 100);
  const monthlyRate = RATE / 12;
  const n = termYears * 12;
  const monthlyGbp = n > 0
    ? loanGbp * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)
    : 0;
  const totalGbp = monthlyGbp * n;
  const interestGbp = Math.max(0, totalGbp - loanGbp);
  return { loanGbp, monthlyGbp, interestGbp };
}

function imageFor(listing: Listing, index: number) {
  return listing.images?.[0] || fallbackImages[index % fallbackImages.length];
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || 'Buyer',
    last_name: parts.slice(1).join(' ') || 'Lead',
  };
}

type NavKey = 'homes' | 'how' | null;

function Header({
  active = 'homes',
  favCount,
  basketCount,
  onAuth,
  onFavourites,
  onBasket,
}: {
  active?: NavKey;
  favCount: number;
  basketCount: number;
  onAuth: () => void;
  onFavourites: () => void;
  onBasket: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Pricing has no page yet: it's shown, but deliberately inert.
  const links = (
    <>
      <a className={active === 'homes' ? 'active' : undefined} aria-current={active === 'homes' ? 'page' : undefined} href="/buyabroad/uk/listings">Homes</a>
      <a className={active === 'how' ? 'active' : undefined} aria-current={active === 'how' ? 'page' : undefined} href="/buyabroad/uk/consultation">How it Works</a>
      <span className="baml-nav-inert">Pricing</span>
    </>
  );

  return (
    <>
      <header className="baml-header">
        <a className="baml-logo" href="/buyabroad/uk" aria-label="Havlo Buy Abroad">
          <img src="/Havlo Black Transparent.png" alt="Havlo" />
          <span>Buy Abroad</span>
        </a>
        <span className="baml-header-country"><CountryBadge variant="inline" /></span>
        <nav className="baml-nav" aria-label="Buy Abroad">{links}</nav>
        <button type="button" className="baml-consult" onClick={onAuth}>Get Free Consultation</button>
        <div className="baml-actions">
          <button type="button" className="baml-pill" onClick={onFavourites} aria-label={`Saved homes (${favCount})`}><Heart size={21} /><span>{favCount}</span></button>
          <button type="button" className="baml-pill" onClick={onBasket} aria-label={`Basket (${basketCount})`}><ShoppingBasket size={20} /><span>{basketCount}</span></button>
          <button type="button" className="baml-menu" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={28} /></button>
        </div>
      </header>
      <div className={`baml-drawer-backdrop${menuOpen ? ' is-open' : ''}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <div className={`baml-drawer${menuOpen ? ' is-open' : ''}`} role="dialog" aria-modal="true" aria-label="Menu" aria-hidden={!menuOpen}>
        <button type="button" className="baml-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={22} /></button>
        <nav className="baml-drawer-nav" aria-label="Buy Abroad">{links}</nav>
        <button type="button" className="baml-drawer-consult" onClick={() => { setMenuOpen(false); onAuth(); }}>Get Free Consultation</button>
        <div className="baml-drawer-country"><span>Country</span><CountryBadge variant="inline" /></div>
      </div>
    </>
  );
}

// Saving and viewing homes need an account. requireAuth runs the action
// straight away when signed in; otherwise it opens the sign-in prompt and
// runs the action once the visitor has signed in or created an account,
// so they land where they were headed instead of back at the prompt.
function useAuthGate(setAuthView: (view: AuthView | null) => void) {
  const auth = useAuth();
  const pending = useRef<(() => void) | null>(null);
  const requireAuth = useCallback((action: () => void) => {
    if (auth.token) {
      action();
      return;
    }
    pending.current = action;
    setAuthView('savePrompt');
  }, [auth.token, setAuthView]);
  const onAuthenticated = useCallback(() => {
    const action = pending.current;
    pending.current = null;
    action?.();
  }, []);
  const clearPending = useCallback(() => {
    pending.current = null;
  }, []);
  return { requireAuth, onAuthenticated, clearPending };
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeFavsOwner(userId: string | null) {
  try {
    if (userId) localStorage.setItem(MARKETPLACE_FAVS_OWNER, userId);
    else localStorage.removeItem(MARKETPLACE_FAVS_OWNER);
  } catch {
    // ignore storage failures
  }
}

// Favourites are saved to the visitor's account, so they follow them to any
// browser or device. This browser keeps a copy of the signed-in account's
// list so hearts and counts draw straight away, and it's replaced by the
// account's list as soon as that arrives. Homes saved here before
// favourites moved to accounts are added to the first account that signs in.
//
// Changes show at once and are sent one after another; only the answer to
// the last one replaces what's shown, so quick taps don't flicker. A change
// that fails is undone by reloading the account's list.
function useFavourites() {
  const { token, user } = useAuth();
  const userId = user?.id ?? null;
  const [favs, setFavsState] = useState<string[]>(() => (token ? readIds(MARKETPLACE_FAVS) : []));
  const [ready, setReady] = useState(false);
  const favsRef = useRef(favs);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const queue = useRef<Promise<void>>(Promise.resolve());
  const queued = useRef(0);

  const show = useCallback((ids: string[]) => {
    favsRef.current = ids;
    setFavsState(ids);
    writeIds(MARKETPLACE_FAVS, ids);
    if (userIdRef.current) writeFavsOwner(userIdRef.current);
  }, []);

  const send = useCallback((change: (token: string) => Promise<{ listing_ids: string[] }>) => {
    queued.current += 1;
    queue.current = queue.current.then(async () => {
      // Read the token fresh: a save made from the sign-in prompt runs
      // before this component re-renders with the new session.
      const current = readStored(AUTH_TOKEN_KEY);
      let ids: string[] | null = null;
      if (current) {
        try {
          ids = (await change(current)).listing_ids;
        } catch {
          try {
            ids = (await api.favouriteListings(current)).listing_ids;
          } catch {
            // Offline or signed out meanwhile: keep what's shown.
          }
        }
      }
      queued.current -= 1;
      if (ids && queued.current === 0) show(ids);
      setReady(true);
    });
  }, [show]);

  useEffect(() => {
    if (!token) {
      favsRef.current = [];
      setFavsState([]);
      setReady(true);
      // Signed out: forget the account's copy (homes saved before accounts
      // have no owner and are kept for the next sign-in).
      if (readStored(MARKETPLACE_FAVS_OWNER)) {
        writeIds(MARKETPLACE_FAVS, []);
        writeFavsOwner(null);
      }
      return;
    }
    if (!userId) return; // wait for the profile so the copy is tagged right
    const owner = readStored(MARKETPLACE_FAVS_OWNER);
    const fromBeforeAccounts = owner ? [] : readIds(MARKETPLACE_FAVS);
    if (owner && owner !== userId) {
      favsRef.current = [];
      setFavsState([]);
    }
    setReady(false);
    send(async (current) => {
      const res = await api.favouriteListings(current);
      const missing = fromBeforeAccounts.filter((id) => !res.listing_ids.includes(id)).slice(0, 200);
      return missing.length ? api.addFavouriteListings(current, missing) : res;
    });
  }, [token, userId, send]);

  const toggle = useCallback((id: string) => {
    const adding = !favsRef.current.includes(id);
    const next = adding ? [...favsRef.current, id] : favsRef.current.filter((item) => item !== id);
    show(next);
    send((current) => (adding ? api.addFavouriteListings(current, [id]) : api.removeFavouriteListing(current, id)));
  }, [show, send]);

  const remove = useCallback((ids: string[]) => {
    show(favsRef.current.filter((item) => !ids.includes(item)));
    ids.forEach((id) => send((current) => api.removeFavouriteListing(current, id)));
  }, [show, send]);

  return { favs, ready, toggle, remove };
}


function FooterCta() {
  return (
    <>
      <section className="baml-cta">
        <div>
          <h2>Can&apos;t find what you&apos;re <br className="baml-br" />looking for?</h2>
          <p>Our advisors source off-market and exclusive properties not listed on any portal. <br className="baml-br" />Tell us what you want and we&apos;ll find it.</p>
        </div>
        <a href="https://calendly.com/hello-heyhavlo/havlo-enquiry-call" target="_blank" rel="noreferrer" className="baml-call"><img src="/calendly-icon.svg" alt="" className="baml-call-mark" width={22} height={22} /> Book a Call</a>
      </section>
      <Footer />
    </>
  );
}

function ImageLightbox({
  images,
  index,
  title,
  onClose,
  onChange,
}: {
  images: string[];
  index: number;
  title: string;
  onClose: () => void;
  onChange: (index: number) => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') onChange((index + 1) % images.length);
      if (event.key === 'ArrowLeft') onChange((index - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [index, images.length, onClose, onChange]);

  return (
    <div className="baml-lightbox-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <button className="baml-close baml-lightbox-close" onClick={onClose} aria-label="Close">
        <X size={22} />
      </button>
      <div className="baml-lightbox-stage">
        {images.length > 1 && (
          <button
            className="baml-lightbox-arrow baml-lightbox-prev"
            onClick={() => onChange((index - 1 + images.length) % images.length)}
            aria-label="Previous image"
          >
            <ChevronLeft size={28} />
          </button>
        )}
        <img src={images[index]} alt={`${title} ${index + 1}`} />
        {images.length > 1 && (
          <button
            className="baml-lightbox-arrow baml-lightbox-next"
            onClick={() => onChange((index + 1) % images.length)}
            aria-label="Next image"
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>
      {images.length > 1 && <div className="baml-lightbox-counter">{index + 1} / {images.length}</div>}
    </div>
  );
}

// Shared line-drawn house glyph — the vector motif behind every loading
// state on this page, whether that's a single photo still loading (small,
// muted, gently pulsing) or a whole row/modal of listings still loading
// (larger, branded purple, drawing itself in on a loop).
const HOUSE_GLYPH_PATH = 'M10 55 L60 15 L110 55 M20 50 V90 H100 V50 M50 90 V65 H70 V90';

function HouseGlyph({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={Math.round(size * (100 / 120))} viewBox="0 0 120 100" fill="none" className={className} aria-hidden="true">
      <path d={HOUSE_GLYPH_PATH} stroke="currentColor" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ListingsLoadingState() {
  return (
    <div className="baml-loading-state" role="status" aria-label="Loading listings">
      <svg width={110} height={92} viewBox="0 0 120 100" fill="none" className="baml-loading-svg">
        <path d={HOUSE_GLYPH_PATH} stroke="#b20adc" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" className="baml-loading-house" />
        <circle cx="18" cy="14" r="3" fill="#b20adc" className="baml-loading-dot d1" />
        <circle cx="102" cy="18" r="4" fill="#b20adc" className="baml-loading-dot d2" />
        <circle cx="62" cy="4" r="2.5" fill="#b20adc" className="baml-loading-dot d3" />
      </svg>
    </div>
  );
}

function PropertyCard({
  listing,
  index,
  saved,
  onSave,
}: {
  listing: Listing;
  index: number;
  saved: boolean;
  onSave: () => void;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const title = cleanText(listing.title) || cleanText(listing.address) || 'Property for sale';
  const meta = listingMetaParts(listing);
  return (
    <article className="baml-card">
      <a href={detailUrl(listing)} className={`baml-card-img${imgLoaded ? '' : ' is-loading'}`}>
        {!imgLoaded && <HouseGlyph size={26} className="baml-img-placeholder" />}
        <img
          src={imageFor(listing, index)}
          alt={title}
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgLoaded(true)}
        />
      </a>
      <button className={`baml-heart ${saved ? 'active' : ''}`} onClick={onSave} aria-label={saved ? 'Remove saved home' : 'Save home'}>
        <Heart size={28} fill="currentColor" strokeWidth={1.8} />
      </button>
      <a className="baml-card-title" href={detailUrl(listing)}>{title}</a>
      {meta.length > 0 && <p className="baml-meta">{meta}</p>}
      <p className="baml-price">{displayPrice(listing)}</p>
    </article>
  );
}

function ListingSection({
  title,
  listings,
  favs,
  toggleFav,
  onOpenAll,
  loading,
  error,
}: {
  title: string;
  listings: Listing[];
  favs: string[];
  toggleFav: (id: string) => void;
  onOpenAll: () => void;
  loading?: boolean;
  error?: string;
}) {
  return (
    <section className="baml-row-section">
      <div className="baml-row-head">
        <h2>{title}</h2>
        <button onClick={onOpenAll} disabled={!listings.length} aria-label={`Open ${title}`}><img src="/buyabroad-arrow-button.svg" alt="" /></button>
        <div className="baml-row-arrows">
          <button aria-label={`Previous ${title}`}><ChevronLeft size={22} strokeWidth={2.4} /></button>
          <button aria-label={`Next ${title}`}><ChevronRight size={22} strokeWidth={2.4} /></button>
        </div>
      </div>
      <div className="baml-row-grid">
        {loading && <ListingsLoadingState />}
        {!loading && error && <p className="baml-empty">{error}</p>}
        {!loading && !error && !listings.length && <p className="baml-empty">No live listings available for this location yet.</p>}
        {!loading && !error && listings.slice(0, 5).map((listing, index) => (
          <PropertyCard
            key={`${title}-${listing.rightmove_id}-${index}`}
            listing={listing}
            index={index}
            saved={favs.includes(listing.rightmove_id)}
            onSave={() => toggleFav(listing.rightmove_id)}
          />
        ))}
      </div>
    </section>
  );
}

function FilterPanel({
  filters,
  onChange,
  onClose,
}: {
  filters: ListingFilters;
  onChange: (next: ListingFilters) => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [onClose]);

  const set = (patch: Partial<ListingFilters>) => onChange({ ...filters, ...patch });

  return (
    <div ref={rootRef} className="baml-filter-panel" role="dialog" aria-label="Filter listings">
      <label className="baml-filter-field">
        <span>Country</span>
        <select value={filters.country} onChange={(e) => set({ country: e.target.value as CountryKey | '' })}>
          <option value="">All countries</option>
          {COUNTRY_SECTIONS.map((section) => (
            <option key={section.key} value={section.key}>{countryLabel(section.key)}</option>
          ))}
        </select>
      </label>
      <div className="baml-filter-split">
        <label className="baml-filter-field">
          <span>Min price (£)</span>
          <input type="number" min={0} inputMode="numeric" value={filters.minPrice} onChange={(e) => set({ minPrice: e.target.value })} placeholder="No min" />
        </label>
        <label className="baml-filter-field">
          <span>Max price (£)</span>
          <input type="number" min={0} inputMode="numeric" value={filters.maxPrice} onChange={(e) => set({ maxPrice: e.target.value })} placeholder="No max" />
        </label>
      </div>
      <div className="baml-filter-split">
        <label className="baml-filter-field">
          <span>Bedrooms</span>
          <select value={filters.minBeds} onChange={(e) => set({ minBeds: e.target.value })}>
            {BEDROOM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="baml-filter-field">
          <span>Property type</span>
          <select value={filters.propertyType} onChange={(e) => set({ propertyType: e.target.value })}>
            {PROPERTY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="baml-filter-actions">
        <button type="button" className="baml-filter-clear" onClick={() => onChange(EMPTY_FILTERS)} disabled={!hasActiveFilters(filters)}>
          Clear all
        </button>
        <button type="button" className="baml-filter-apply" onClick={onClose}>
          Apply filters
        </button>
      </div>
    </div>
  );
}

function AllHomesModal({
  country,
  favs,
  toggleFav,
  onClose,
  title,
  searchTerm,
  filters,
}: {
  country: CountryKey;
  favs: string[];
  toggleFav: (id: string) => void;
  onClose: () => void;
  title: string;
  searchTerm: string;
  filters: ListingFilters;
}) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListingsResponse>({ listings: [], page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setPage(1);
  }, [country, searchTerm, filters]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ country, page: String(page), per_page: '40' });
    const term = searchTerm.trim();
    if (term) params.set('search', term);
    appendListingFilterParams(params, filters);
      fetch(listingsApiUrl(`/listings/?${params.toString()}`), { signal: controller.signal })
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((payload: ListingsResponse) => {
        cacheListings(payload.listings || []);
        setData(payload);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setError('We could not load these homes right now.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [country, page, searchTerm, filters]);

  const pages = Math.max(1, data.pages || 1);
  const pageButtons = Array.from(
    new Set([1, page - 1, page, page + 1, pages].filter((item) => item >= 1 && item <= pages)),
  );

  return (
    <div className="baml-overlay baml-homes-overlay">
      <div className="baml-all-homes">
        <button className="baml-close" onClick={onClose} aria-label="Close"><X size={22} /></button>
        <h2>{title}</h2>
        <div className="baml-all-scroll">
          <div className="baml-all-grid">
            {loading && <ListingsLoadingState />}
            {error && <p className="baml-error">{error}</p>}
            {!loading && !error && !data.listings.length && <p className="baml-empty">No live listings available for this location yet.</p>}
            {!loading && !error && data.listings.map((listing, index) => (
              <PropertyCard
                key={`all-${listing.rightmove_id}-${index}`}
                listing={listing}
                index={index}
                saved={favs.includes(listing.rightmove_id)}
                onSave={() => toggleFav(listing.rightmove_id)}
              />
            ))}
          </div>
          <div className="baml-pagination">
            <button disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={20} /></button>
            {pageButtons.map((item) => (
              <button key={item} className={item === page ? 'active' : ''} onClick={() => setPage(item)}>{item}</button>
            ))}
            <button disabled={page >= pages} onClick={() => setPage((current) => Math.min(pages, current + 1))}><ChevronRight size={20} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  minLength,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minLength?: number;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label>
      {label}
      <span className="baml-password">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          required
          minLength={minLength}
          autoComplete={autoComplete}
        />
        <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

const OTP_LENGTH = 6;

// One box per digit: typing moves to the next box, Backspace steps back,
// arrows move between boxes, and pasting (or an SMS/email autofill into
// any box) spreads the whole code across them.
function OtpInput({ digits, onChange }: { digits: string[]; onChange: (digits: string[]) => void }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const focusBox = (index: number) => {
    const box = refs.current[Math.max(0, Math.min(OTP_LENGTH - 1, index))];
    box?.focus();
    box?.select();
  };
  const fillFrom = (start: number, text: string) => {
    const incoming = text.replace(/\D/g, '').slice(0, OTP_LENGTH - start).split('');
    if (!incoming.length) return;
    const next = digits.slice();
    incoming.forEach((digit, offset) => { next[start + offset] = digit; });
    onChange(next);
    focusBox(start + incoming.length);
  };

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  return (
    <div className="baml-otp" role="group" aria-label="6-digit code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
            // The site-wide mobile rule pins inputs to 16px with a layered
            // !important that stylesheet rules can't outrank; an inline
            // !important can, so the digits stay large on phones too.
            el?.style.setProperty('font-size', '22px', 'important');
          }}
          value={digit}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1}`}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '');
            if (value.length > 1) {
              fillFrom(index, value);
              return;
            }
            const next = digits.slice();
            next[index] = value;
            onChange(next);
            if (value) focusBox(index + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digit && index > 0) {
              e.preventDefault();
              const next = digits.slice();
              next[index - 1] = '';
              onChange(next);
              focusBox(index - 1);
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              focusBox(index - 1);
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              focusBox(index + 1);
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            fillFrom(index, e.clipboardData.getData('text'));
          }}
        />
      ))}
    </div>
  );
}

const RESEND_SECONDS = 59;

function AuthModal({
  view,
  setView,
  onClose,
  onAuthenticated,
}: {
  view: AuthView;
  setView: (view: AuthView) => void;
  onClose: () => void;
  onAuthenticated?: () => void;
}) {
  const auth = useAuth();
  const [role, setRole] = useState<'buyer' | 'agent'>('buyer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(''));
  const [resendIn, setResendIn] = useState(0);
  const [notice, setNotice] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const otp = otpDigits.join('');

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const goTo = (next: AuthView) => {
    setError('');
    setNotice('');
    setView(next);
  };

  const finish = () => {
    onAuthenticated?.();
    onClose();
  };

  const submitRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true); setError('');
    try {
      const name = splitName(fullName || email.split('@')[0]);
      const resp = await api.register({
        ...name,
        email,
        password,
        phone_country_code: '+234',
        phone_number: '0000000000',
        role,
      } as any);
      await auth.login(resp);
      finish();
    } catch (err: any) {
      setError(err?.message || 'Could not create account.');
    } finally {
      setLoading(false);
    }
  };

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true); setError('');
    try {
      const resp = await api.login({ email, password });
      await auth.login(resp);
      finish();
    } catch (err: any) {
      setError(err?.message || 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  };

  const submitForgot = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true); setError('');
    try {
      await api.forgotPassword(email);
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setResendIn(RESEND_SECONDS);
      goTo('otp');
    } catch (err: any) {
      setError(err?.message || 'Could not send code.');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (resendIn > 0) return;
    setError(''); setNotice('');
    try {
      await api.forgotPassword(email);
      setResendIn(RESEND_SECONDS);
      setNotice('A new code is on its way.');
    } catch (err: any) {
      setError(err?.message || 'Could not resend the code.');
    }
  };

  const submitOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true); setError('');
    try {
      const resp = await api.verifyResetOtp(email, otp);
      setResetToken(resp.reset_token);
      goTo('reset');
    } catch (err: any) {
      setError(err?.message || 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('The two passwords don’t match.');
      return;
    }
    setLoading(true); setError('');
    try {
      await api.resetPassword(resetToken, newPassword);
      setPassword(newPassword);
      goTo('login');
      setNotice('Password updated. Sign in with your new password.');
    } catch (err: any) {
      setError(err?.message || 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  const maskedEmail = email ? email.replace(/^(.{3}).*(@.*)$/, '$1*****$2') : 'free*****@gmail.com';
  const resendLabel = resendIn > 0 ? `Resend Code in 00:${String(resendIn).padStart(2, '0')}` : 'Resend Code';

  return (
    <div className="baml-overlay">
      <div className="baml-auth">
        <button className="baml-close" onClick={onClose} aria-label="Close"><X size={22} /></button>
        {view === 'savePrompt' && (
          <>
            <h2>Sign In To Save Properties</h2>
            <p className="baml-auth-copy">We provide end-to-end advisory and guidance, from search to sale, wherever you&apos;re buying.</p>
            <button className="baml-primary" onClick={() => goTo('register')}>Create Account</button>
            <button className="baml-secondary" onClick={() => goTo('login')}>Sign in</button>
          </>
        )}
        {view === 'register' && (
          <form onSubmit={submitRegister}>
            <h2>Create Your Account</h2>
            <p className="baml-auth-copy">Are you buying a home or listing as an agent?</p>
            <div className="baml-role-grid">
              <button type="button" className={role === 'buyer' ? 'active' : ''} onClick={() => setRole('buyer')}><Home size={22} fill="#b20adc" strokeWidth={1.8} /><strong>I&apos;m a Buyer</strong><small>Search and Save homes</small></button>
              <button type="button" className={role === 'agent' ? 'active' : ''} onClick={() => setRole('agent')}><BriefcaseBusiness size={22} strokeWidth={2} /><strong>I&apos;m an Agent</strong><small>List and Manage Properties</small></button>
            </div>
            <label>Full name<input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" autoComplete="name" required /></label>
            <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="e.g Johndoe@email.com" autoComplete="email" required /></label>
            <PasswordField label="Password" value={password} onChange={setPassword} placeholder="******" minLength={8} autoComplete="new-password" />
            {error && <p className="baml-error">{error}</p>}
            <button className="baml-primary" disabled={loading}>{loading ? 'Please wait...' : 'Continue'}</button>
            <button type="button" className="baml-secondary" onClick={() => goTo('login')}>Already have an Account? <strong>Sign in</strong></button>
          </form>
        )}
        {view === 'login' && (
          <form onSubmit={submitLogin}>
            <h2>Sign In</h2>
            {notice && <p className="baml-notice">{notice}</p>}
            <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="e.g Johndoe@email.com" autoComplete="email" required /></label>
            <PasswordField label="Password" value={password} onChange={setPassword} placeholder="******" autoComplete="current-password" />
            <button type="button" className="baml-link" onClick={() => goTo('forgot')}>Forgot Password?</button>
            {error && <p className="baml-error">{error}</p>}
            <button className="baml-primary" disabled={loading}>{loading ? 'Please wait...' : 'Sign In'}</button>
            <button type="button" className="baml-secondary" onClick={() => goTo('register')}>Don&apos;t have an Account? <strong>Create Account</strong></button>
          </form>
        )}
        {view === 'forgot' && (
          <form onSubmit={submitForgot}>
            <h2>Forgot Password?</h2>
            <p className="baml-auth-copy strong">Enter email address, you will receive a code to reset your password</p>
            <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@email.com" autoComplete="email" required /></label>
            {error && <p className="baml-error">{error}</p>}
            <button className="baml-primary" disabled={loading}>{loading ? 'Sending...' : 'Submit'}</button>
            <button type="button" className="baml-back" onClick={() => goTo('login')}><ArrowLeft size={16} /> Back to Login</button>
          </form>
        )}
        {view === 'otp' && (
          <form onSubmit={submitOtp}>
            <h2>Enter OTP</h2>
            <p className="baml-auth-copy">A 6-Digit code was sent to <strong>{maskedEmail}</strong></p>
            <OtpInput digits={otpDigits} onChange={(next) => { setOtpDigits(next); setError(''); }} />
            <p className="baml-resend">Didn&apos;t get Code? <button type="button" onClick={() => void resendCode()} disabled={resendIn > 0}>{resendLabel}</button></p>
            {notice && <p className="baml-notice">{notice}</p>}
            {error && <p className="baml-error">{error}</p>}
            <button className="baml-primary" disabled={loading || otp.length < OTP_LENGTH}>{loading ? 'Checking...' : 'Confirm'}</button>
            <button type="button" className="baml-back" onClick={() => goTo('forgot')}><ArrowLeft size={16} /> Back</button>
          </form>
        )}
        {view === 'reset' && (
          <form onSubmit={submitReset}>
            <h2>Set New Password</h2>
            <PasswordField label="New Password" value={newPassword} onChange={(v) => { setNewPassword(v); setError(''); }} placeholder="At least 8 Characters" minLength={8} autoComplete="new-password" />
            <PasswordField label="Confirm New Password" value={confirmPassword} onChange={(v) => { setConfirmPassword(v); setError(''); }} placeholder="At least 8 Characters" minLength={8} autoComplete="new-password" />
            {error && <p className="baml-error">{error}</p>}
            <button className="baml-primary" disabled={loading}>{loading ? 'Please wait...' : 'Reset Password'}</button>
          </form>
        )}
      </div>
    </div>
  );
}

function PaymentMethodModal({
  method,
  setMethod,
  onClose,
  onContinue,
}: {
  method: PaymentMethod;
  setMethod: (method: PaymentMethod) => void;
  onClose: () => void;
  onContinue: () => void;
}) {
  const methods: Array<{ id: PaymentMethod; title: string; copy: string; icon: React.ReactNode }> = [
    { id: 'card', title: 'Card', copy: 'Visa, Amex, MasterCard, Verve', icon: <CreditCard size={20} /> },
    { id: 'bank', title: 'Bank Transfer', copy: 'Pay Directly from your Bank', icon: <Landmark size={20} /> },
    { id: 'crypto', title: 'Crypto', copy: 'BTC, ETH, USDT', icon: <Bitcoin size={20} /> },
  ];

  return (
    <div className="baml-overlay">
      <div className="baml-auth baml-pay-modal">
        <button className="baml-close" onClick={onClose} aria-label="Close"><X size={22} /></button>
        <h2>How Would You Like To Pay?</h2>
        <p className="baml-auth-copy">Select a payment method to continue.</p>
        <div className="baml-payment-options">
          {methods.map((item) => (
            <button key={item.id} type="button" className={`baml-pay-option ${method === item.id ? 'active' : ''}`} onClick={() => setMethod(item.id)}>
              <span>{item.icon}</span>
              <strong>{item.title}<small>{item.copy}</small></strong>
            </button>
          ))}
        </div>
        <button className="baml-primary" onClick={onContinue}>Continue</button>
      </div>
    </div>
  );
}

type CheckoutDetails = { fullName: string; email: string; address: string; city: string; postCode: string; phone: string };

function CheckoutDetailsModal({
  details,
  setDetails,
  checkingOut,
  error,
  onClose,
  onBack,
  onSubmit,
}: {
  details: CheckoutDetails;
  setDetails: React.Dispatch<React.SetStateAction<CheckoutDetails>>;
  checkingOut: boolean;
  error: string;
  onClose: () => void;
  onBack: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <div className="baml-overlay">
      <form className="baml-auth baml-details-modal" onSubmit={onSubmit}>
        <button type="button" className="baml-close" onClick={onClose} aria-label="Close"><X size={22} /></button>
        <h2>Your Details</h2>
        <p className="baml-auth-copy">We&apos;ll send your receipt and advisor booking here.</p>
        <label>Full name<input value={details.fullName} onChange={(e) => setDetails((d) => ({ ...d, fullName: e.target.value }))} placeholder="e.g John Doe" required /></label>
        <label>Email<input value={details.email} onChange={(e) => setDetails((d) => ({ ...d, email: e.target.value }))} type="email" placeholder="e.g Johndoe@email.com" required /></label>
        <label>Address<input value={details.address} onChange={(e) => setDetails((d) => ({ ...d, address: e.target.value }))} placeholder="12 Market Street" /></label>
        <div className="baml-details-grid">
          <label>City<input value={details.city} onChange={(e) => setDetails((d) => ({ ...d, city: e.target.value }))} placeholder="Lagos" /></label>
          <label>Post Code<input value={details.postCode} onChange={(e) => setDetails((d) => ({ ...d, postCode: e.target.value }))} placeholder="SY19" /></label>
        </div>
        {error && <p className="baml-error">{error}</p>}
        <button className="baml-primary" disabled={checkingOut}>{checkingOut ? 'Creating checkout...' : 'Confirm & Pay $99.99'}</button>
        <button type="button" className="baml-back" onClick={onBack}><ArrowLeft size={16} /> Back</button>
      </form>
    </div>
  );
}

function AdvisorReadyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="baml-overlay">
      <div className="baml-advisor-shell">
        <button className="baml-close" onClick={onClose} aria-label="Close"><X size={22} /></button>
        <div className="baml-advisor-card">
          <span className="baml-payment-badge"><CheckCircle size={18} /> Payment received</span>
          <div className="baml-avatar-stack">
            <img src="/team-avatars/agent-avatar-man-1.jpg" alt="" />
            <img src="/team-avatars/agent-avatar-woman-1.jpg" alt="" />
            <img src="/team-avatars/agent-avatar-man-2.jpg" alt="" />
            <span>+4K</span>
          </div>
          <p className="baml-trust">Trusted by buyers across 3 countries</p>
          <h2>Your advisor is ready<br />to guide you</h2>
          <p>Every property decision matters. Book a time that works best for you and take the first step towards making your next purchase.</p>
          <a className="baml-primary baml-book-consult" href="https://calendly.com/havlo/consultation" target="_blank" rel="noreferrer">Book your Consultation <ChevronRight size={18} /></a>
        </div>
      </div>
    </div>
  );
}

function MarketplaceStyles() {
  return (
    <>
    <style>{`
      .baml-page{min-height:100vh;background:#f3f4f6;color:#111;font-family:Inter,Arial,sans-serif;overflow-x:hidden}.baml-page,.baml-page *{box-sizing:border-box}.baml-header{height:90px;background:#fff;display:flex;align-items:center;padding:0 clamp(18px,5vw,80px);gap:38px;border-bottom:1px solid #e8e8e8;position:sticky;top:0;z-index:20}.baml-logo{display:flex;flex-direction:column;align-items:center;text-decoration:none;color:#111;line-height:1;flex:0 0 auto}.baml-logo img{width:136px;height:auto;display:block}.baml-logo span{font-size:16px;margin-top:0;font-weight:400}.baml-nav{display:flex;align-items:center;justify-content:center;gap:45px;flex:1;min-width:0}.baml-nav a{font-size:18px;font-weight:700;color:#222;text-decoration:none;padding:17px 0 11px;border-bottom:4px solid transparent;display:inline-flex;align-items:center;gap:10px;white-space:nowrap}.baml-nav-icon{flex:0 0 auto}.baml-nav-icon.home{color:#111;fill:#e39a53}.baml-nav-icon.bulb{color:#d59b02;fill:#ffe37d}.baml-nav-icon.money{color:#111;fill:#d79a30}.baml-nav a.active{border-color:#111}.baml-consult{border:0;background:transparent;font-weight:800;font-size:16px}.baml-actions{display:flex;align-items:center;gap:14px}.baml-pill{height:48px;min-width:70px;border:0;border-radius:12px;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.05);display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:800}.baml-pill span{background:#b20adc;color:#fff;border-radius:999px;min-width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:13px}.baml-menu{border:0;background:transparent;display:none}.baml-hero{padding:72px 24px 64px;text-align:center}.baml-hero h1{font-family:"Plus Jakarta Sans",Inter,sans-serif;font-size:42px;line-height:1.1;margin:0 0 22px;font-weight:900;text-transform:uppercase}.baml-hero-cursor{display:inline-block;width:3px;margin-left:2px;background:currentColor;animation:baml-cursor-blink 0.85s step-end infinite;vertical-align:-0.08em;height:0.85em}@keyframes baml-cursor-blink{0%,100%{opacity:1}50%{opacity:0}}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.baml-hero p{max-width:540px;margin:0 auto 42px;color:#6b6b6b;font-size:17px;line-height:1.45}.baml-search-wrap{position:relative;width:min(690px,calc(100% - 48px));margin:0 auto}.baml-search{width:100%;height:52px;display:grid;grid-template-columns:58px minmax(0,1fr) 52px;border-radius:28px;background:#fff;box-shadow:0 7px 22px rgba(0,0,0,.1);overflow:visible}.baml-search button,.baml-search input{border:0;background:#fff}.baml-search button{display:flex;align-items:center;justify-content:center;cursor:pointer;color:#111}.baml-search>button:first-child{border-radius:28px 0 0 28px;border-right:2px solid #f0f0f0}.baml-search>button:first-child.active{color:#b20adc}.baml-search input{font-size:12px;padding:0 14px;min-width:0}.baml-search .search{background:#b20adc;color:#fff;border-radius:50%;width:52px;height:52px;align-self:center;justify-self:center;box-shadow:0 4px 12px rgba(178,10,220,.25)}.baml-filter-panel{position:absolute;top:calc(100% + 10px);left:0;width:min(360px,100%);background:#fff;border-radius:18px;box-shadow:0 20px 50px rgba(0,0,0,.16);padding:20px;text-align:left;z-index:30;display:flex;flex-direction:column;gap:16px}.baml-filter-field{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:800;color:#444}.baml-filter-field select,.baml-filter-field input{height:44px;border:1px solid #e4e4e4;border-radius:10px;padding:0 12px;font-size:14px;font-weight:600;color:#111;font-family:inherit;background:#fff}.baml-filter-split{display:grid;grid-template-columns:1fr 1fr;gap:12px}.baml-filter-actions{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-top:4px;border-top:1px solid #f0f0f0}.baml-filter-clear{border:0;background:transparent;font-weight:800;color:#666;cursor:pointer;padding:8px 0}.baml-filter-clear:disabled{color:#ccc;cursor:default}.baml-filter-apply{border:0;background:#111;color:#fff;font-weight:800;padding:10px 22px;border-radius:10px;cursor:pointer}.baml-market{background:#fff;border-radius:26px 26px 0 0;padding:70px clamp(18px,5vw,80px) 90px}.baml-row-section{margin-bottom:78px}.baml-row-head{display:flex;align-items:center;gap:12px;margin-bottom:38px}.baml-row-head h2{font-family:"Plus Jakarta Sans",Inter,sans-serif;font-size:28px;font-weight:900;margin:0}.baml-row-head>button,.baml-row-arrows button{border:0;border-radius:50%;background:#f3f4f6;width:35px;height:35px;font-weight:900;font-size:24px;display:inline-flex;align-items:center;justify-content:center}.baml-row-head>button img{width:32px;height:32px;display:block}.baml-row-arrows{margin-left:auto;display:flex;gap:16px}.baml-row-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:32px}.baml-card{position:relative;min-width:0}.baml-card-img{display:block;aspect-ratio:1.23;border-radius:18px;overflow:hidden;background:#eee}.baml-card-img img{width:100%;height:100%;object-fit:cover;display:block}.baml-heart{position:absolute;top:23px;left:22px;border:0;background:transparent;color:#777;text-shadow:0 1px 8px rgba(255,255,255,.9);line-height:1;padding:0}.baml-heart.active{color:#b20adc}.baml-card-title{display:block;margin:16px 0 7px;color:#111;text-decoration:none;font-size:16px;font-weight:900}.baml-meta{font-size:14px;color:#555;margin:0 0 8px;white-space:nowrap;display:flex;align-items:center;gap:3px;min-width:0}.baml-meta svg{flex:0 0 auto;color:#6b6b6b}.baml-price{font-size:15px;color:#666;margin:0}.baml-cta{width:min(1200px,calc(100% - 48px));margin:25px auto 80px;background:#050505;color:#fff;border-radius:18px;padding:48px 56px;display:flex;align-items:center;justify-content:space-between;gap:30px}.baml-cta h2{font-family:"Plus Jakarta Sans",Inter,sans-serif;font-size:31px;line-height:1.05;margin:0 0 18px;font-weight:900}.baml-cta p{margin:0;color:#fff;font-size:15px;max-width:560px;line-height:1.45}.baml-call{background:#fff;color:#111;border-radius:10px;text-decoration:none;font-weight:900;padding:13px 25px;white-space:nowrap;display:inline-flex;align-items:center;gap:8px}.baml-call-mark{display:block;flex:0 0 auto}.baml-footer{padding:0 clamp(24px,6vw,90px) 40px;display:flex;align-items:end;justify-content:space-between}.baml-footer p{font-size:17px}.baml-overlay{position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px}.baml-auth{width:min(430px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;background:#fff;border-radius:22px;padding:24px;position:relative;scrollbar-width:none}.baml-auth::-webkit-scrollbar,.baml-all-homes::-webkit-scrollbar{display:none}.baml-close{position:absolute;right:18px;top:18px;border:0;background:#f1f2f4;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center}.baml-auth h2{font-family:"Plus Jakarta Sans",Inter,sans-serif;margin:0 0 32px;font-size:25px;font-weight:900;letter-spacing:-.04em}.baml-auth-copy{font-size:19px;line-height:1.35;color:#666;margin:-15px 0 34px}.baml-auth-copy.strong{font-weight:700;color:#111;font-size:16px}.baml-auth label{display:flex;flex-direction:column;gap:10px;font-size:12px;font-weight:800;margin-bottom:22px}.baml-auth input{height:50px;border:0;border-radius:12px;background:#f1f2f5;padding:0 16px;font-size:16px}.baml-password{display:flex;background:#f1f2f5;border-radius:12px;overflow:hidden}.baml-password input{flex:1}.baml-password svg{margin:auto 15px}.baml-primary,.baml-secondary{width:100%;height:50px;border-radius:8px;font-size:15px}.baml-primary{border:0;background:#000;color:#fff;font-weight:700;margin-top:18px}.baml-secondary{border:1px solid #e9e9e9;background:#fff;margin-top:12px}.baml-link,.baml-back{border:0;background:transparent;font-weight:800;color:#081735;margin:4px 0 25px;text-align:left}.baml-back{text-align:center;width:100%;font-size:15px;color:#111;display:inline-flex;align-items:center;justify-content:center;gap:6px}.baml-error{color:#b00020;font-weight:700}.baml-role-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:34px}.baml-role-grid button{height:137px;border:0;border-radius:12px;background:#f1f2f4;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}.baml-role-grid button.active{border:1.5px solid #b20adc;background:#fff}.baml-role-grid strong{font-size:15px}.baml-role-grid small{font-size:14px;color:#666}.baml-otp{display:flex;gap:14px;margin:0 0 28px}.baml-otp input{width:51px;height:49px;text-align:center;font-size:34px;font-weight:900;border:1.5px solid #00c986}.baml-resend{text-align:center;color:#555}.baml-resend button{border:0;background:transparent;color:#06f;font-size:16px}.baml-all-homes{position:relative;background:#fff;border-radius:32px 32px 0 0;align-self:end;width:100%;max-height:calc(100dvh - 90px);overflow:auto;padding:44px clamp(18px,5vw,84px)}.baml-all-homes h2{font-family:"Plus Jakarta Sans",Inter,sans-serif;font-size:32px;margin:0 0 92px;font-weight:900}.baml-all-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:86px 33px}.baml-pagination{display:flex;justify-content:center;gap:20px;margin-top:78px}.baml-pagination button{width:40px;height:40px;border:1px solid #ddd;background:#fff;border-radius:10px;font-weight:800}.baml-pagination .active{background:#b20adc;color:#fff}.baml-basket-main{padding:70px clamp(18px,6vw,86px)}.baml-basket-main h1{font-family:"Plus Jakarta Sans",Inter,sans-serif;font-size:32px}.baml-basket-layout{display:grid;grid-template-columns:1fr 430px;gap:35px}.baml-basket-item{height:123px;border:1px solid #ddd;border-radius:18px;display:flex;align-items:center;margin-bottom:36px;overflow:hidden}.baml-basket-item img{width:126px;height:100%;object-fit:cover}.baml-basket-info{padding:0 25px;flex:1}.baml-basket-info h3{margin:0 0 8px}.baml-trash{border:0;background:transparent;margin-right:25px}.baml-summary{border:1px solid #ddd;border-radius:20px;padding:22px;box-shadow:0 8px 22px rgba(0,0,0,.06)}.baml-summary-row{display:flex;justify-content:space-between;margin:26px 0;font-size:17px}.baml-total{border-top:1px solid #ddd;padding-top:22px;font-size:22px}.baml-note{background:#f0f1f5;color:#4b006c;border-radius:10px;padding:18px 22px;font-size:14px;line-height:1.45;display:flex;align-items:flex-start;gap:10px}.baml-back-link{color:#b20adc;text-decoration:none;font-weight:700;display:inline-flex;align-items:center;gap:6px}.baml-empty{grid-column:1/-1;padding:60px 0;color:#666}.baml-loading-state{grid-column:1/-1;display:flex;align-items:center;justify-content:center;padding:56px 0}.baml-loading-house{stroke-dasharray:340;stroke-dashoffset:340;animation:baml-loading-draw 2.6s ease-in-out infinite}.baml-loading-dot{animation:baml-loading-float 1.8s ease-in-out infinite;transform-origin:center}.baml-loading-dot.d2{animation-delay:.3s}.baml-loading-dot.d3{animation-delay:.6s}@keyframes baml-loading-draw{0%{stroke-dashoffset:340;opacity:.35}55%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:-340;opacity:.35}}@keyframes baml-loading-float{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-6px);opacity:1}}.baml-card-img{position:relative;display:flex;align-items:center;justify-content:center}.baml-card-img.is-loading{background:linear-gradient(90deg,#ececec 25%,#f6f6f6 37%,#ececec 63%);background-size:400% 100%;animation:baml-shimmer 1.5s ease infinite}.baml-img-placeholder{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#c3c3cb;animation:baml-glyph-pulse 1.5s ease-in-out infinite}.baml-card-img img{opacity:1;transition:opacity .25s ease}.baml-card-img.is-loading img{opacity:0}@keyframes baml-shimmer{0%{background-position:100% 0}100%{background-position:0 0}}@keyframes baml-glyph-pulse{0%,100%{opacity:.35}50%{opacity:.8}}@media(prefers-reduced-motion:reduce){.baml-loading-house,.baml-loading-dot,.baml-card-img.is-loading,.baml-img-placeholder{animation:none}.baml-loading-house{stroke-dashoffset:0;opacity:1}}.baml-detail-main{padding:50px clamp(18px,6vw,76px)}.baml-detail-top{display:flex;justify-content:space-between;align-items:center}.baml-save-button{border:0;background:transparent;display:inline-flex;align-items:center;gap:7px;font-weight:800;color:#111}.baml-gallery{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:28px 0}.baml-gallery-main{grid-row:span 2}.baml-gallery img{width:100%;height:238px;object-fit:cover}.baml-gallery-main img{height:500px}.baml-gallery-main,.baml-gallery>div{cursor:pointer;overflow:hidden}.baml-gallery-main img,.baml-gallery>div img{transition:transform .2s}.baml-gallery-main:hover img,.baml-gallery>div:hover img{transform:scale(1.03)}.baml-detail-content{display:grid;grid-template-columns:1fr 380px;gap:30px}.baml-cost-card,.baml-cost-table{border:1px solid #ddd;border-radius:20px;padding:20px}.baml-cost-card{box-shadow:0 8px 22px rgba(0,0,0,.08)}.baml-cost-table .tabs{display:grid;grid-template-columns:1fr 1fr;margin:-20px -20px 25px}.baml-cost-table .tabs button{padding:18px;text-align:center;background:#f1f2f5;border:0;border-bottom:2px solid #ccc;font:inherit;font-weight:800;color:#666;cursor:pointer;transition:background .15s,color .15s}.baml-cost-table .tabs button:hover:not(.active){background:#e9eaee;color:#333}.baml-cost-table .tabs button.active{background:#fff;border-bottom-color:#b20adc;color:#111}.baml-mortgage-sub{color:#888;font-size:13px;margin:-6px 0 20px}.baml-mortgage-row{margin-bottom:18px}.baml-mortgage-row label{display:block;font-size:14px;font-weight:700;color:#333;margin-bottom:8px}.baml-slider{width:100%;accent-color:#b20adc;cursor:pointer}.baml-slider-labels{display:flex;justify-content:space-between;font-size:11px;color:#aaa;margin-top:4px}.baml-mortgage-disc{font-size:12px;color:#aaa;margin:16px 0 0;line-height:1.5}.baml-lightbox-overlay{position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:1100;display:flex;align-items:center;justify-content:center;padding:24px}.baml-lightbox-close{position:fixed;top:20px;right:20px;background:rgba(255,255,255,.15);color:#fff}.baml-lightbox-close:hover{background:rgba(255,255,255,.3)}.baml-lightbox-stage{position:relative;max-width:min(1100px,92vw);max-height:88vh;display:flex;align-items:center;justify-content:center}.baml-lightbox-stage img{max-width:100%;max-height:88vh;object-fit:contain;border-radius:8px;display:block}.baml-lightbox-arrow{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.15);color:#fff;border:0;width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s}.baml-lightbox-arrow:hover{background:rgba(255,255,255,.3)}.baml-lightbox-prev{left:-8px}.baml-lightbox-next{right:-8px}.baml-lightbox-counter{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);color:#fff;background:rgba(255,255,255,.15);padding:6px 16px;border-radius:999px;font-size:13px;font-weight:700}@media(max-width:640px){.baml-lightbox-arrow{width:40px;height:40px}.baml-lightbox-prev{left:4px}.baml-lightbox-next{right:4px}.baml-lightbox-stage img{max-height:78vh}}.baml-cost-row{display:flex;justify-content:space-between;margin:24px 0;font-size:18px}.purple{color:#b20adc}.baml-sidebar-actions button,.baml-sidebar-actions a{height:38px;border-radius:8px;display:flex;align-items:center;justify-content:center;text-decoration:none;margin:10px 0;font-weight:800}.baml-sidebar-actions button{width:100%;border:0;background:#000;color:#fff}.baml-sidebar-actions a{border:1px solid #ddd;color:#111}.baml-cost-legend{display:flex;gap:12px;flex-wrap:wrap}.baml-dot{width:8px;height:8px;border-radius:50%;display:inline-block;background:#111;margin-right:4px}.purple-dot{background:#b20adc}.baml-info-note{background:#f0f1f5;color:#4b006c;border-radius:10px;padding:16px;font-size:13px;margin-top:30px;display:flex;align-items:flex-start;gap:9px}
      .baml-detail-main h1,.baml-detail-copy h2{font-family:"Plus Jakarta Sans",Inter,sans-serif;font-weight:900;letter-spacing:-.04em}.baml-detail-main h1{font-size:32px;margin:26px 0 0}.baml-detail-copy h2{font-size:24px;margin:0 0 14px}.baml-save-button{border:0;background:transparent;font-size:16px;font-weight:800}.baml-detail-meta{font-size:15px;color:#666;border-bottom:1px solid #e4e4e4;padding-bottom:20px}.baml-description{font-size:21px;line-height:1.15;margin:20px 0 26px}.baml-cost-card small{color:#777;font-weight:900}.baml-cost-card h2{font-size:34px;margin:8px 0 10px}.baml-progress{height:5px;background:#111;border-radius:999px;position:relative;margin:8px 0 6px}.baml-progress span{position:absolute;right:0;top:0;height:5px;width:22%;background:#b20adc;border-radius:999px}.baml-total strong{font-size:34px}
      .baml-row-arrows button{display:inline-flex;align-items:center;justify-content:center}
      .baml-homes-overlay{align-items:flex-start;background:rgba(0,0,0,.48);padding:0;padding-top:90px;overflow:auto}.baml-homes-overlay .baml-all-homes{align-self:flex-start;width:100%;min-height:calc(100dvh - 90px);max-height:none;border-radius:34px 34px 0 0;padding:42px clamp(54px,5.6vw,88px) 80px;background:#fff;overflow:visible}.baml-homes-overlay .baml-close{right:clamp(42px,5vw,76px);top:40px}.baml-homes-overlay .baml-all-homes h2{font-size:32px;line-height:1.1;margin:0 0 112px}.baml-homes-overlay .baml-all-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:92px 32px}.baml-homes-overlay .baml-card-img{border-radius:18px}.baml-homes-overlay .baml-card-title{font-size:16px;margin-top:16px}.baml-homes-overlay .baml-pagination{justify-content:center;gap:20px;margin-top:90px}.baml-homes-overlay .baml-pagination button{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;font-size:15px}
      @media(max-width:1200px){.baml-header{gap:24px}.baml-nav{gap:28px}.baml-row-grid{grid-template-columns:repeat(4,1fr);gap:28px}.baml-all-grid{grid-template-columns:repeat(4,1fr);gap:58px 28px}.baml-detail-content{grid-template-columns:minmax(0,1fr) 340px}.baml-gallery-main img{height:420px}.baml-gallery img{height:205px}.baml-basket-layout{grid-template-columns:minmax(0,1fr) 380px}}
      @media(max-width:1024px){.baml-row-grid{grid-template-columns:repeat(3,1fr)}.baml-all-grid{grid-template-columns:repeat(3,1fr)}.baml-detail-content,.baml-basket-layout{grid-template-columns:1fr}.baml-cost-card,.baml-summary{max-width:520px}.baml-nav a{font-size:16px}.baml-consult{font-size:15px}.baml-hero{padding-top:54px}.baml-market{padding-inline:32px}}
      @media(max-width:900px){.baml-header{height:auto;min-height:80px;padding:14px 16px;flex-wrap:wrap;gap:16px}.baml-logo img{width:105px}.baml-logo span{font-size:13px;margin-top:0}.baml-nav{order:2;width:100%;justify-content:flex-start;padding:8px 0 0;gap:24px;overflow-x:auto;scrollbar-width:none}.baml-nav::-webkit-scrollbar{display:none}.baml-nav a{font-size:17px;white-space:nowrap}.baml-nav-icon{width:26px;height:26px}.baml-consult{display:none}.baml-menu{display:block}.baml-pill{min-width:74px;height:48px}.baml-hero{padding:36px 16px 24px}.baml-hero h1{font-size:30px}.baml-hero p{font-size:17px}.baml-market{padding:35px 16px 55px;border-radius:18px 18px 0 0}.baml-row-head{margin-bottom:22px}.baml-row-head h2{font-size:21px}.baml-row-arrows{display:none}.baml-row-grid{display:flex;overflow-x:auto;gap:18px;margin-right:-16px;padding-right:16px;scrollbar-width:none}.baml-row-grid::-webkit-scrollbar{display:none}.baml-card{width:164px;flex:0 0 164px}.baml-card-title{font-size:15px}.baml-meta,.baml-price{font-size:13px}.baml-cta{width:calc(100% - 32px);display:block;padding:30px 16px;border-radius:18px;margin:20px auto 55px}.baml-cta h2{font-size:25px}.baml-call{display:flex;justify-content:center;margin-top:34px}.baml-footer{display:block;text-align:center;padding-bottom:38px}.baml-footer .baml-logo img{width:140px;margin:auto}.baml-auth{padding:18px 16px}.baml-auth h2{font-size:24px}.baml-auth-copy{font-size:20px}.baml-all-homes{max-height:calc(100dvh - 90px);padding:34px 16px}.baml-all-homes h2{font-size:20px;margin-bottom:26px}.baml-all-grid{grid-template-columns:repeat(2,1fr);gap:34px 16px}.baml-all-grid .baml-card{width:auto;flex:auto}.baml-pagination{gap:8px;margin-top:42px;overflow-x:auto;justify-content:flex-start;padding-bottom:4px}.baml-basket-main{padding:28px 16px}.baml-basket-layout,.baml-detail-content{display:block}.baml-basket-item{height:80px;margin-bottom:12px}.baml-basket-item img{width:80px}.baml-basket-info{padding:0 10px;min-width:0}.baml-basket-info h3,.baml-basket-info p{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.baml-summary{margin-top:35px;max-width:none}.baml-detail-main{padding:24px 16px}.baml-detail-top{margin-top:16px;align-items:flex-start;gap:12px}.baml-detail-main h1{font-size:20px}.baml-gallery{display:block;margin-left:-16px;margin-right:-16px}.baml-gallery img,.baml-gallery-main img{height:min(520px,72vh);border-radius:0}.baml-gallery>div:not(.baml-gallery-main){display:none}.baml-detail-content{margin-top:-48px;position:relative;z-index:2}.baml-detail-copy{background:#fff;border-radius:16px 16px 0 0;padding:16px}.baml-detail-copy h2{font-size:17px}.baml-detail-meta{line-height:1.55}.baml-description{font-size:15px;line-height:1.25}.baml-cost-card{margin-top:20px;max-width:none}.baml-cost-row{font-size:16px}.baml-search-wrap{width:calc(100% - 32px)}.baml-search{height:56px;grid-template-columns:56px minmax(0,1fr) 56px}.baml-search .search{width:56px;height:56px}.baml-search input{font-size:13px;min-width:0}.baml-otp{gap:9px}.baml-otp input{width:48px}}
      @media(max-width:900px){.baml-homes-overlay{padding-top:90px}.baml-homes-overlay .baml-all-homes{min-height:calc(100dvh - 90px);padding:34px 16px 34px;border-radius:24px 24px 0 0;overflow:visible}.baml-homes-overlay .baml-close{top:32px;right:18px}.baml-homes-overlay .baml-all-homes h2{font-size:20px;margin:0 48px 28px 0}.baml-homes-overlay .baml-all-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:34px 16px}.baml-homes-overlay .baml-all-grid .baml-card{width:auto;flex:auto}.baml-homes-overlay .baml-card-img{border-radius:14px}.baml-homes-overlay .baml-card-title{font-size:15px;margin:12px 0 6px}.baml-homes-overlay .baml-meta,.baml-homes-overlay .baml-price{font-size:13px}.baml-homes-overlay .baml-pagination{justify-content:flex-start;gap:8px;margin-top:36px;overflow-x:auto;padding-bottom:4px}.baml-homes-overlay .baml-pagination button{width:38px;height:38px;flex:0 0 38px}}
      @media(max-width:700px){.baml-logo img{width:82px}.baml-logo span{font-size:11px;font-weight:600;margin-top:-2px}}
      @media(max-width:520px){.baml-page{width:100%;max-width:100vw}.baml-header{align-items:center}.baml-actions{margin-left:auto;gap:10px}.baml-pill{min-width:56px}.baml-menu svg{width:26px;height:26px}.baml-nav{gap:20px}.baml-nav a{font-size:18px}.baml-hero h1{font-size:28px;line-height:1.12}.baml-hero p{font-size:17px;max-width:340px}.baml-search{grid-template-columns:54px minmax(0,1fr) 54px}.baml-search .search{width:54px;height:54px}.baml-search input{padding:0 10px;font-size:12px}.baml-market{padding-inline:16px}.baml-row-section{margin-bottom:48px}.baml-card{width:163px;flex-basis:163px}.baml-card-img{border-radius:14px}.baml-heart{top:14px;left:14px;font-size:26px}.baml-all-homes{border-radius:24px 24px 0 0}.baml-all-grid{gap:30px 16px}.baml-all-grid .baml-card{min-width:0}.baml-auth{width:calc(100vw - 16px);border-radius:20px}.baml-role-grid{gap:12px}.baml-role-grid button{height:136px}.baml-otp{justify-content:space-between;gap:6px}.baml-otp input{width:46px;height:48px}.baml-basket-item{height:82px;border-radius:10px}.baml-trash{margin-right:10px}.baml-summary{padding:16px}.baml-summary-row{font-size:16px;gap:12px}.baml-total strong{font-size:30px}.baml-note{font-size:13px}.baml-gallery img,.baml-gallery-main img{height:420px}.baml-cost-table{margin-left:-16px;margin-right:-16px;border-left:0;border-right:0;border-radius:0}.baml-cost-row{font-size:15px;gap:14px}.baml-cost-row strong{text-align:right}.baml-cta{margin-bottom:44px}.baml-footer p{font-size:15px}}
      @media(max-width:380px){.baml-logo img{width:96px}.baml-pill{min-width:50px;height:44px}.baml-nav a{font-size:16px}.baml-hero h1{font-size:25px}.baml-row-grid{gap:14px}.baml-card{width:150px;flex-basis:150px}.baml-all-grid{gap:26px 12px}.baml-otp input{width:40px;font-size:28px}.baml-gallery img,.baml-gallery-main img{height:360px}.baml-cta h2{font-size:23px}}
    `}</style>
    <style>{`
      .baml-pay-modal{width:min(400px,calc(100vw - 18px));padding:24px 16px 16px}.baml-pay-modal h2,.baml-details-modal h2{margin-bottom:28px}.baml-pay-modal .baml-auth-copy{margin:0 0 46px}.baml-payment-options{display:grid;gap:14px}.baml-pay-option{height:80px;border:0;border-radius:12px;background:#f1f2f4;display:flex;align-items:center;gap:18px;padding:0 20px;text-align:left}.baml-pay-option.active{background:#fff;border:1.5px solid #b20adc}.baml-pay-option>span{width:40px;height:40px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;color:#b20adc}.baml-pay-option strong{font-size:16px;display:flex;flex-direction:column;gap:5px}.baml-pay-option small{font-size:14px;color:#666;font-weight:500}.baml-details-modal{width:min(400px,calc(100vw - 18px));padding:24px 16px}.baml-details-modal .baml-auth-copy{margin:0 0 18px}.baml-details-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.baml-advisor-shell{position:relative;border-radius:36px;padding:12px;background:linear-gradient(135deg,#e8e8ff,#fff1ca);width:min(426px,calc(100vw - 18px))}.baml-advisor-card{background:#fff;border-radius:28px;padding:38px 28px 32px;text-align:center}.baml-payment-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 13px;border-radius:999px;background:#fff0ff;color:#6f008d;font-weight:700}.baml-avatar-stack{display:flex;justify-content:center;margin:36px 0 14px}.baml-avatar-stack img,.baml-avatar-stack span{width:62px;height:62px;border-radius:50%;border:3px solid #fff;margin-left:-12px;object-fit:cover}.baml-avatar-stack img:first-child{margin-left:0}.baml-avatar-stack span{display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-weight:800}.baml-trust{font-size:12px;color:#666}.baml-advisor-card h2{font-family:"Plus Jakarta Sans",Inter,sans-serif;font-size:33px;line-height:1.12;margin:26px 0 12px;font-weight:900}.baml-advisor-card p{color:#666;line-height:1.45}.baml-book-consult{display:inline-flex;width:auto;align-items:center;justify-content:center;gap:16px;text-decoration:none;padding:0 22px;margin-top:28px}.baml-consult-page{padding:38px clamp(18px,6vw,80px) 40px;background:#fff;min-height:calc(100vh - 90px)}.baml-crumbs{display:flex;gap:14px;margin:5px 0 26px;color:#666}.baml-crumbs strong{color:#b20adc}.baml-consult-page h1{font-family:"Plus Jakarta Sans",Inter,sans-serif;font-size:34px;margin:0 0 24px;font-weight:900}.baml-consult-intro{font-size:19px;line-height:1.45;color:#666;max-width:760px}.baml-video-card{border:1px solid #ddd;border-radius:26px;overflow:hidden;margin:44px 0 50px;box-shadow:0 12px 35px rgba(0,0,0,.06)}.baml-video-stage{height:min(520px,45vw);min-height:320px;background:#000;display:flex;align-items:center;justify-content:center;position:relative}.baml-video-pill{position:absolute;left:38px;top:28px;border:1px solid #333;border-radius:999px;color:#fff;padding:8px 15px}.baml-play{width:56px;height:56px;border-radius:50%;border:0;background:#fff;display:flex;align-items:center;justify-content:center}.baml-video-covers{padding:28px 35px 36px}.baml-video-covers h3{color:#666;margin:0 0 28px}.baml-video-grid{display:grid;grid-template-columns:1fr 1fr;gap:26px 80px}.baml-video-grid p{display:flex;align-items:center;gap:14px;color:#666;font-size:18px;margin:0}.baml-video-grid svg{color:#b20adc}.baml-question-card{border:1px solid #ddd;border-radius:22px;padding:30px 32px;margin:0 0 90px;display:flex;align-items:center;justify-content:space-between;gap:24px;box-shadow:0 10px 28px rgba(0,0,0,.05)}.baml-question-card h2{font-size:30px;margin:0 0 8px}.baml-question-card p{margin:0;color:#666;font-size:18px}.baml-question-actions{display:flex;gap:12px}.baml-question-actions a{height:48px;padding:0 26px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-weight:900}.baml-question-actions .outline{border:1px solid #ddd;color:#111;background:#fff}.baml-question-actions .solid{background:#000;color:#fff}
      @media(max-width:900px){.baml-consult-page{padding:28px 16px}.baml-crumbs{display:none}.baml-consult-page h1{font-size:25px}.baml-consult-intro{font-size:18px}.baml-video-stage{height:206px;min-height:206px;border-radius:18px 18px 0 0}.baml-video-card{border-radius:18px;margin:28px 0 18px}.baml-video-pill{left:18px;top:14px}.baml-video-covers{padding:16px 18px}.baml-video-grid{grid-template-columns:1fr;gap:17px}.baml-video-grid p{font-size:16px}.baml-question-card{display:block;padding:28px 14px;margin-bottom:50px}.baml-question-card h2{font-size:21px}.baml-question-card p{font-size:16px;margin-bottom:20px}.baml-question-actions{flex-direction:column-reverse}.baml-question-actions a{width:100%}.baml-advisor-shell{position:fixed;left:0;right:0;bottom:0;width:100%;border-radius:36px 36px 0 0;padding:10px 10px 0}.baml-advisor-card{border-radius:30px 30px 0 0;padding:30px 14px 36px}.baml-advisor-card h2{font-size:29px}.baml-pay-modal,.baml-details-modal{width:calc(100vw - 18px);border-radius:20px}.baml-pay-modal .baml-auth-copy{margin-bottom:46px}.baml-pay-option{height:80px}.baml-details-grid{gap:16px}.baml-details-modal label{margin-bottom:18px}}
    `}</style>
    <style>{`
      .baml-source-badge{display:inline-flex;margin-top:10px;font-size:12px;font-weight:800;color:#555;background:#f2f3f5;border-radius:999px;padding:5px 9px}.baml-card-title{line-height:1.22;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:39px}.baml-meta{white-space:normal;flex-wrap:wrap;gap:7px 10px;line-height:1.35}.baml-meta span{display:inline-flex;align-items:center;gap:4px;min-width:0}.baml-price{font-weight:800;color:#222;line-height:1.35}.baml-detail-price{margin:9px 0 0;font-size:20px;font-weight:900;color:#333}.baml-detail-meta{display:flex;flex-wrap:wrap;gap:8px 16px;line-height:1.45}.baml-detail-meta>span{display:inline-flex;align-items:center;gap:5px}.baml-description{line-height:1.35}.baml-pagination button:disabled{opacity:.4;cursor:not-allowed}.baml-basket-info h3{line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .baml-homes-overlay{align-items:flex-end;justify-content:center;padding:0;overflow:hidden}.baml-homes-overlay .baml-all-homes{align-self:flex-end;margin-top:auto;margin-bottom:0;height:min(82dvh,calc(100dvh - 28px));min-height:0;max-height:calc(100dvh - 28px);display:flex;flex-direction:column;overflow:hidden;border-radius:34px 34px 0 0}.baml-homes-overlay .baml-all-homes h2{flex:0 0 auto}.baml-all-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding-bottom:8px;scrollbar-gutter:stable}.baml-all-scroll::-webkit-scrollbar{width:8px}.baml-all-scroll::-webkit-scrollbar-thumb{background:#d8d9de;border-radius:999px}.baml-all-scroll::-webkit-scrollbar-track{background:transparent}.baml-homes-overlay .baml-all-grid{min-height:0}.baml-homes-overlay .baml-pagination{flex:0 0 auto}
      @media(max-width:900px){.baml-source-badge{font-size:11px;padding:4px 8px}.baml-card-title{min-height:36px}.baml-detail-meta{font-size:14px}.baml-basket-info .baml-meta{display:none}}
      @media(max-width:900px){.baml-homes-overlay{padding-top:0}.baml-homes-overlay .baml-all-homes{height:min(86dvh,calc(100dvh - 18px));max-height:calc(100dvh - 18px);min-height:0;overflow:hidden}.baml-homes-overlay .baml-all-homes h2{margin-bottom:28px}.baml-homes-overlay .baml-all-scroll{padding-bottom:6px}.baml-homes-overlay .baml-pagination{margin-top:36px}}
    `}</style>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');
      /* Header, menu and shared CTA — matches the Buy Abroad basket/consultation designs (Instrument Sans). */
      .baml-page .baml-header{height:80px;padding:0 clamp(16px,5.56vw,80px);gap:0;font-family:'Instrument Sans',Inter,sans-serif}
      .baml-page .baml-logo{flex:0 0 auto}
      .baml-page .baml-nav{flex:0 0 auto;margin-left:auto;gap:73px;justify-content:flex-end}
      .baml-page .baml-nav a,.baml-page .baml-nav-inert{position:relative;display:inline-flex;align-items:center;padding:0;border:0;font-family:'Instrument Sans',Inter,sans-serif;font-size:16px;font-weight:400;letter-spacing:0;color:#3D3D3D;text-decoration:none;white-space:nowrap}
      .baml-page .baml-nav a.active{font-weight:500;color:#111}
      .baml-page .baml-nav a.active::after{content:'';position:absolute;left:-40px;right:0;bottom:-15px;height:4px;border-radius:2px;background:#111}
      .baml-page .baml-nav a:hover{color:#111}
      .baml-nav-inert{cursor:default}
      .baml-page .baml-consult{margin-left:91px;padding:0;font-family:'Instrument Sans',Inter,sans-serif;font-size:16px;font-weight:600;color:#111;cursor:pointer;white-space:nowrap}
      .baml-page .baml-actions{margin-left:33px;gap:14px}
      .baml-header-country{display:inline-flex;margin-left:20px}
      .baml-page .baml-pill{width:73px;min-width:0;height:47px;border-radius:12px;background:#F3F4F6;box-shadow:none;color:#111;cursor:pointer;gap:8px;font-weight:600}
      .baml-page .baml-pill span{min-width:22px;height:22px;padding:0 6px;background:#A409D2;font-family:'Instrument Sans',Inter,sans-serif;font-size:12px;font-weight:600}
      .baml-page .baml-menu{display:none;padding:6px;cursor:pointer;color:#111}
      .baml-drawer-backdrop{position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:opacity .25s}
      .baml-drawer-backdrop.is-open{opacity:1;pointer-events:auto}
      .baml-drawer{position:fixed;top:0;right:0;bottom:0;z-index:1201;width:min(300px,86vw);display:flex;flex-direction:column;padding:72px 24px 32px;background:#fff;box-shadow:-4px 0 24px rgba(0,0,0,.12);font-family:'Instrument Sans',Inter,sans-serif;transform:translateX(100%);visibility:hidden;transition:transform .25s ease,visibility .25s}
      .baml-drawer.is-open{transform:none;visibility:visible}
      .baml-drawer .baml-close{top:20px;right:20px}
      .baml-drawer-nav{display:flex;flex-direction:column}
      .baml-drawer-nav a,.baml-drawer-nav .baml-nav-inert{padding:16px 0;border-bottom:1px solid #EFEFEF;font-size:18px;color:#3D3D3D;text-decoration:none}
      .baml-drawer-nav a.active{font-weight:600;color:#111}
      .baml-drawer-consult{margin-top:24px;height:48px;border:0;border-radius:10px;background:#000;color:#fff;font-family:inherit;font-size:16px;font-weight:600;cursor:pointer}
      .baml-drawer-country{display:flex;align-items:center;justify-content:space-between;margin-top:24px;font-size:15px;color:#666}
      .baml-page .baml-cta{width:min(1240px,calc(100% - 200px));min-height:226px;margin:25px auto 80px;padding:46px 56px;border-radius:28px;background:#0A0A0A;font-family:'Instrument Sans',Inter,sans-serif}
      .baml-page .baml-cta h2{margin:0 0 11px;font-family:'Instrument Sans',Inter,sans-serif;font-size:32px;font-weight:700;line-height:1.15;letter-spacing:-0.02em}
      .baml-page .baml-cta p{max-width:none;font-size:14px;line-height:20px;letter-spacing:-0.01em}
      .baml-page .baml-call{height:48px;padding:0 18px;border-radius:10px;font-family:'Instrument Sans',Inter,sans-serif;font-size:16px;font-weight:600;gap:8px}
      .baml-page .baml-call-mark{width:28px;height:28px}
      /* Sign-in modal fixes: working password reveal, roomy OTP boxes. */
      .baml-password button{flex:none;display:flex;align-items:center;justify-content:center;width:48px;border:0;background:transparent;color:#555;cursor:pointer}
      .baml-password button svg{margin:0}
      .baml-password button:focus-visible{outline:2px solid #A409D2;outline-offset:-4px;border-radius:10px}
      .baml-otp{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px!important;margin:0 0 28px}
      .baml-auth .baml-otp input{width:100%!important;min-width:0;height:56px!important;padding:0!important;border:1.5px solid #E2E3E8;border-radius:12px;background:#F1F2F5;font-size:24px!important;line-height:1!important;font-weight:700;text-align:center;color:#111}
      .baml-auth .baml-otp input:focus{outline:0;border-color:#A409D2;background:#fff;box-shadow:0 0 0 3px rgba(164,9,210,.12)}
      .baml-resend button:disabled{color:#888;cursor:default}
      .baml-notice{margin:0 0 14px;font-size:14px;font-weight:600;color:#0A7A3D}
      /* Basket, consultation and favourites pages. */
      .bab-page{background:#fff;font-family:'Instrument Sans',Inter,sans-serif;letter-spacing:-0.01em}
      .bab-page h1,.bab-page h2,.bab-page h3{font-family:'Instrument Sans',Inter,sans-serif}
      .bab-main{max-width:1440px;margin:0 auto;padding:60px clamp(16px,5.56vw,80px) 0}
      .bab-goback{display:none}
      .bab-title{margin:0;font-size:32px;font-weight:700;line-height:1.2;letter-spacing:-0.03em;color:#111}
      .bab-basket-layout{display:grid;grid-template-columns:minmax(0,1fr) 412px;gap:33px;align-items:start;margin-top:28px}
      .bab-item{display:flex;align-items:center;height:121px;border:1px solid #E6E6E6;border-radius:14px;overflow:hidden;background:#fff}
      .bab-item+.bab-item{margin-top:36px}
      .bab-item-img{flex:none;width:121px;height:100%;background:#eee}
      .bab-item-img img{display:block;width:100%;height:100%;object-fit:cover}
      .bab-item-info{flex:1;min-width:0;padding:0 24px}
      .bab-item-info h2{margin:0;font-size:17px;font-weight:600;line-height:1.3;letter-spacing:-0.02em}
      .bab-item-info h2 a{color:#111;text-decoration:none;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
      .bab-item-meta{display:flex;flex-wrap:wrap;gap:2px 6px;margin:7px 0 0;font-size:14px;line-height:1.4;color:#666}
      .bab-item-price{margin:6px 0 0;font-size:14px;line-height:1.4;color:#666}
      .bab-trash{flex:none;margin-right:18px;padding:8px;border:0;background:none;color:#111;cursor:pointer}
      .bab-empty{margin:0;padding:40px 0;color:#666;font-size:16px}
      .bab-link{display:inline-flex;align-items:center;gap:4px;margin-top:32px;color:#A409D2;font-size:16px;text-decoration:none}
      .bab-summary{padding:14px 21px 21px;border:1px solid #E6E6E6;border-radius:22px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.06)}
      .bab-summary h2{margin:0;font-size:16px;font-weight:500;line-height:1.5;text-transform:uppercase;color:#555}
      .bab-sum-row{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px;line-height:1.5;color:#666}
      .bab-sum-row:first-of-type{margin-top:18px}
      .bab-sum-row+.bab-sum-row{margin-top:20px}
      .bab-sum-row b{font-size:16px;font-weight:600;color:#111}
      .bab-sum-row b.bab-count{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:#F7E8FD;color:#A409D2}
      .bab-sum-total{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:17px;padding-top:12px;border-top:1px solid #E6E6E6}
      .bab-sum-total span{font-size:20px;color:#111}
      .bab-sum-total b{font-size:35px;font-weight:700;line-height:1.15;letter-spacing:-0.02em;color:#111}
      .bab-note{display:flex;gap:14px;margin-top:6px;padding:12px 19px 12px 18px;border-radius:12px;background:#F1F2F7;color:#4B006C;font-size:12px;font-weight:500;line-height:18px;letter-spacing:-0.02em}
      .bab-note p{margin:0}
      .bab-note ul{margin:0;padding:0;list-style:none}
      .bab-note li{position:relative;margin-top:18px;padding-left:18px}
      .bab-note li::before{content:'•';position:absolute;left:6px;top:0}
      .bab-note-icon{flex:none;display:grid;place-items:center;width:16px;height:16px;margin-top:2px;border-radius:50%;background:#4B006C;color:#fff;font-size:11px;font-weight:700;font-family:Georgia,serif;font-style:italic}
      .bab-checkout{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;height:40px;margin-top:40px;border:0;border-radius:8px;background:#000;color:#fff;font-family:inherit;font-size:14px;font-weight:500;cursor:pointer}
      .bab-checkout:disabled{opacity:.5;cursor:not-allowed}
      .bab-consult{padding-top:34px}
      .bab-crumbs{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin:0 0 20px;font-size:16px;line-height:1.5;color:#666}
      .bab-crumbs .done{color:#A409D2;text-decoration:none}
      .bab-intro{max-width:840px;margin:18px 0 0;font-size:18px;line-height:1.5;color:#666}
      .bab-intro b{font-weight:600;color:#111}
      .bab-video{margin-top:38px;border:1px solid #E6E6E6;border-radius:34px;overflow:hidden;background:#fff;box-shadow:0 12px 35px rgba(0,0,0,.05)}
      .bab-video-stage{position:relative;display:flex;align-items:center;justify-content:center;height:540px;background:#000}
      .bab-video-pill{position:absolute;left:37px;top:26px;padding:5px 14px;border:1px solid #3A3A3A;border-radius:999px;background:#111;color:#fff;font-size:14px;line-height:1.4}
      .bab-play{display:grid;place-items:center;width:56px;height:56px;border:0;border-radius:50%;background:#fff;color:#000;cursor:pointer}
      .bab-play svg{margin-left:3px}
      .bab-covers{padding:31px 33px 24px}
      .bab-covers h2{margin:0;font-size:18px;font-weight:500;line-height:1.5;text-transform:uppercase;color:#666}
      .bab-covers ul{display:grid;grid-template-columns:404px minmax(0,1fr);grid-template-rows:repeat(2,auto);grid-auto-flow:column;row-gap:27px;margin:36px 0 0;padding:0;list-style:none}
      .bab-covers li{display:flex;align-items:center;gap:11px;font-size:18px;line-height:1.4;color:#666}
      .bab-tick{flex:none}
      .bab-questions{display:flex;align-items:center;justify-content:space-between;gap:24px;max-width:1238px;min-height:115px;margin-top:51px;padding:22px 32px 22px 37px;border:1px solid #E6E6E6;border-radius:30px;background:#fff;box-shadow:0 10px 28px rgba(0,0,0,.05)}
      .bab-questions h2{margin:0;font-size:30px;font-weight:700;line-height:1.2;letter-spacing:-0.02em;color:#111}
      .bab-questions p{margin:4px 0 0;font-size:18px;line-height:1.5;color:#666}
      .bab-question-actions,.bab-fav-actions{display:flex;flex:none;gap:14px}
      .bab-btn-outline,.bab-btn-solid{display:inline-flex;align-items:center;justify-content:center;gap:4px;height:47px;padding:0 22px;border-radius:8px;font-family:inherit;font-size:16px;font-weight:600;text-decoration:none;cursor:pointer;white-space:nowrap}
      .bab-btn-outline{border:1px solid #E6E6E6;background:#fff;color:#111}
      .bab-btn-solid{border:1px solid #000;background:#000;color:#fff}
      .bab-page .baml-cta{margin-top:120px}
      .bab-fav-empty{display:flex;flex-direction:column;align-items:center;max-width:560px;margin:40px auto 0;padding:48px 32px;border:1px solid #E6E6E6;border-radius:22px;text-align:center;color:#A409D2}
      .bab-fav-empty h2{margin:16px 0 0;font-size:24px;font-weight:700;letter-spacing:-0.02em;color:#111}
      .bab-fav-empty p{margin:8px 0 24px;font-size:16px;line-height:1.5;color:#666}
      .bab-fav-gone{margin:10px 0 0;font-size:15px;color:#666}
      .bab-fav-gone button{padding:0;border:0;background:none;color:#A409D2;font:inherit;font-weight:600;text-decoration:underline;cursor:pointer}
      .bab-fav-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:48px 32px;margin-top:36px}
      .bab-fav-card{display:flex;flex-direction:column;min-width:0}
      .bab-page .bab-fav-card .baml-card-title,.bab-page .bab-fav-card .baml-price{font-family:'Instrument Sans',Inter,sans-serif}
      .bab-fav-basket{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:40px;margin-top:14px;border:1px solid #E6E6E6;border-radius:8px;background:#fff;color:#111;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer}
      .bab-fav-basket.is-added{border-color:#A409D2;color:#A409D2;background:#FBF3FE}
      @media(max-width:1200px){
        .baml-page .baml-nav{gap:40px}
        .baml-page .baml-consult{margin-left:40px}
        .bab-basket-layout{grid-template-columns:minmax(0,1fr) 380px}
        .bab-fav-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
      }
      @media(max-width:1024px){
        .baml-page .baml-nav,.baml-page .baml-consult{display:none}
        .baml-page .baml-actions{margin-left:auto}
        .baml-page .baml-menu{display:block}
        .baml-br{display:none}
        .bab-basket-layout{grid-template-columns:1fr}
        .bab-summary{max-width:560px}
        .bab-video-stage{height:min(540px,48vw)}
        .bab-covers ul{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:24px}
        .bab-questions{max-width:none}
      }
      @media(max-width:900px){
        .baml-page .baml-header{height:80px;min-height:0;flex-wrap:nowrap;padding:0 16px}
        .baml-page .baml-logo img{width:104px}
        .baml-page .baml-logo span{margin-top:2px;font-size:13px;font-weight:400}
        .baml-header-country{display:none}
        .baml-page .baml-actions{gap:10px}
        .baml-page .baml-pill{width:64px;height:48px}
        .baml-page .baml-cta{width:calc(100% - 32px);min-height:0;margin:20px auto 55px;padding:30px 16px;border-radius:24px}
        .baml-page .baml-cta h2{font-size:24px;line-height:1.2}
        .baml-page .baml-cta p{font-size:15px}
        .baml-page .baml-call{height:52px;margin-top:40px}
        .bab-main{padding:24px 16px 0}
        .bab-goback{display:inline-flex;align-items:center;gap:8px;margin-bottom:20px;color:#666;font-size:15px;text-decoration:none}
        .bab-title{font-size:28px}
        .bab-basket-layout{margin-top:20px}
        .bab-item{height:80px;border-radius:10px}
        .bab-item+.bab-item{margin-top:12px}
        .bab-item-img{width:80px}
        .bab-item-info{padding:0 12px}
        .bab-item-info h2{font-size:15px}
        .bab-item-meta,.bab-item-price{margin-top:4px;font-size:11px}
        .bab-trash{margin-right:8px}
        .bab-trash svg{width:20px;height:20px}
        .bab-link{margin-top:24px;font-size:14px}
        .bab-summary{max-width:none;margin-top:28px;padding:16px;border-radius:20px}
        .bab-summary h2{font-size:15px}
        .bab-sum-row{font-size:13px}
        .bab-sum-row b{font-size:15px}
        .bab-sum-row b.bab-count{width:28px;height:28px}
        .bab-sum-total span{font-size:17px}
        .bab-sum-total b{font-size:30px}
        .bab-note{padding:16px 16px 20px;font-size:12px;gap:12px}
        .bab-note li{margin-top:14px}
        .bab-checkout{height:44px;margin-top:28px}
        .bab-consult{padding-top:28px}
        .bab-crumbs{display:none}
        .bab-consult .bab-title{font-size:22px}
        .bab-intro{margin-top:16px;font-size:15px}
        .bab-video{margin-top:24px;border-radius:18px}
        .bab-video-stage{height:206px}
        .bab-video-pill{left:16px;top:14px;font-size:13px}
        .bab-play{width:52px;height:52px}
        .bab-covers{padding:16px 18px 18px}
        .bab-covers h2{font-size:15px}
        .bab-covers ul{grid-template-columns:1fr;grid-template-rows:none;grid-auto-flow:row;row-gap:14px;margin-top:16px}
        .bab-covers li{font-size:14px;gap:10px}
        .bab-tick{width:20px;height:20px}
        .bab-questions{display:block;margin-top:16px;padding:24px 14px;border-radius:18px}
        .bab-questions h2{font-size:21px}
        .bab-questions p{margin-bottom:20px;font-size:15px}
        .bab-question-actions,.bab-fav-actions{flex-direction:column-reverse;gap:10px}
        .bab-fav-actions{flex-direction:column;width:100%}
        .bab-btn-outline,.bab-btn-solid{width:100%;height:48px}
        .bab-page .baml-cta{margin-top:64px}
        .bab-fav-empty{margin-top:28px;padding:36px 18px}
        .bab-fav-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:32px 16px;margin-top:24px}
        .bab-fav-grid .baml-card{width:auto;flex:auto}
      }
    `}</style>
    </>
  );
}

export const BuyAbroadUkListingsRedesign: React.FC = () => {
  usePageMeta({ title: 'Browse United Kingdom Properties in Pounds & Naira | Havlo', description: 'Browse homes across the United Kingdom, the United States, Dubai and Canada with Havlo Buy Abroad.' });
  const typedCountry = useTypewriter(HERO_COUNTRIES);
  const [listingsByCountry, setListingsByCountry] = useState<Record<CountryKey, Listing[]>>(() => emptyCountryListings());
  const [loadingByCountry, setLoadingByCountry] = useState<Record<CountryKey, boolean>>(() => emptyCountryFlags(true));
  const [listingErrors, setListingErrors] = useState<Record<CountryKey, string>>(() => emptyCountryMessages());
  const [searchTerm, setSearchTerm] = useState('');
  const [queryTerm, setQueryTerm] = useState('');
  const { favs, toggle: toggleSaved } = useFavourites();
  const [basket, setBasket] = useState<string[]>(() => readIds(MARKETPLACE_BASKET));
  const [authView, setAuthView] = useState<AuthView | null>(null);
  const [allOpen, setAllOpen] = useState<{ title: string; country: CountryKey } | null>(null);
  const [filters, setFilters] = useState<ListingFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const navigate = useNavigate();

  const visibleSections = filters.country
    ? COUNTRY_SECTIONS.filter((section) => section.key === filters.country)
    : COUNTRY_SECTIONS;

  useEffect(() => {
    if (!allOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [allOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQueryTerm(searchTerm.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const controllers: AbortController[] = [];
    const term = queryTerm;
    setLoadingByCountry(emptyCountryFlags(true));
    setListingErrors(emptyCountryMessages());

    visibleSections.forEach((section) => {
      const controller = new AbortController();
      controllers.push(controller);
      const params = new URLSearchParams({
        country: section.key,
        per_page: '5',
        include_total: 'false',
      });
      if (term) params.set('search', term);
      appendListingFilterParams(params, filters);

      fetch(listingsApiUrl(`/listings/?${params.toString()}`), { signal: controller.signal })
        .then((res) => res.ok ? res.json() : Promise.reject())
        .then((data: ListingsResponse) => {
          if (controller.signal.aborted) return;
          cacheListings(data.listings || []);
          setListingsByCountry((current) => ({ ...current, [section.key]: data.listings || [] }));
        })
        .catch((err) => {
          if (err?.name !== 'AbortError') {
            setListingErrors((current) => ({
              ...current,
              [section.key]: `We could not load ${countryLabel(section.key)} listings right now.`,
            }));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoadingByCountry((current) => ({ ...current, [section.key]: false }));
          }
        });
    });

    return () => {
      controllers.forEach((controller) => controller.abort());
    };
    // visibleSections is derived from filters.country, already listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryTerm, filters]);

  const visibleListingsByCountry = useMemo(() => {
    const next = emptyCountryListings();
    COUNTRY_SECTIONS.forEach((section) => {
      next[section.key] = filterListings(listingsByCountry[section.key], queryTerm);
    });
    return next;
  }, [listingsByCountry, queryTerm]);

  const { requireAuth, onAuthenticated, clearPending } = useAuthGate(setAuthView);

  const toggleFav = (id: string) => requireAuth(() => toggleSaved(id));

  return (
    <div className="baml-page">
      <MarketplaceStyles />
      <Header active="homes" favCount={favs.length} basketCount={basket.length} onAuth={() => setAuthView('savePrompt')} onFavourites={() => requireAuth(() => navigate(FAVOURITES_PATH))} onBasket={() => navigate('/buyabroad/uk/basket')} />
      <section className="baml-hero">
        <h1>
          Buy Property in{' '}
          <span className="baml-hero-typed">
            <span aria-hidden="true">
              {typedCountry}
              <span className="baml-hero-cursor" />
            </span>
            <span className="sr-only">United Kingdom</span>
          </span>
        </h1>
        <p>We provide end-to-end advisory and guidance, from search to sale, wherever you&apos;re buying.</p>
        <div className="baml-search-wrap">
          <div className="baml-search">
            <button
              aria-label="Filter"
              aria-expanded={filterOpen}
              className={hasActiveFilters(filters) ? 'active' : ''}
              onClick={() => setFilterOpen((v) => !v)}
            >
              <SlidersHorizontal size={22} />
            </button>
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by Property title, address, city" />
            <button className="search" aria-label="Search" onClick={() => setQueryTerm(searchTerm.trim())}><Search size={24} /></button>
          </div>
          {filterOpen && (
            <FilterPanel filters={filters} onChange={setFilters} onClose={() => setFilterOpen(false)} />
          )}
        </div>
      </section>
      <main className="baml-market">
        {visibleSections.map((section) => (
          <ListingSection
            key={section.key}
            title={section.title}
            listings={visibleListingsByCountry[section.key]}
            favs={favs}
            toggleFav={toggleFav}
            loading={loadingByCountry[section.key]}
            error={listingErrors[section.key]}
            onOpenAll={() => setAllOpen({ title: section.allTitle, country: section.key })}
          />
        ))}
      </main>
      <FooterCta />
      {authView && <AuthModal view={authView} setView={setAuthView} onClose={() => { setAuthView(null); clearPending(); }} onAuthenticated={onAuthenticated} />}
      {allOpen && <AllHomesModal title={allOpen.title} country={allOpen.country} searchTerm={queryTerm} filters={filters} favs={favs} toggleFav={toggleFav} onClose={() => setAllOpen(null)} />}
    </div>
  );
};

export const BuyAbroadUkListingDetailRedesign: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loadingListing, setLoadingListing] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { favs, toggle: toggleSaved } = useFavourites();
  const [basket, setBasket] = useState<string[]>(() => readIds(MARKETPLACE_BASKET));
  const [authView, setAuthView] = useState<AuthView | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [costTab, setCostTab] = useState<'cash' | 'mortgage'>('cash');
  const [deposit, setDeposit] = useState(25);
  const [term, setTerm] = useState(25);
  const { requireAuth, onAuthenticated, clearPending } = useAuthGate(setAuthView);
  const openFavourites = () => requireAuth(() => navigate(FAVOURITES_PATH));

  usePageMeta({
    title: `${listing?.title || 'Property Details'} | Havlo Buy Abroad`,
    description: 'Review property details, costs, and purchase support through Havlo Buy Abroad.',
  });

  useEffect(() => {
    if (!id) return;
    const cached = readCachedListing(id);
    if (cached) {
      setListing(cached);
      setLoadingListing(false);
    } else {
      setLoadingListing(true);
    }
    setNotFound(false);
    const controller = new AbortController();
    fetch(listingsApiUrl(`/listings/${encodeURIComponent(id)}`), { signal: controller.signal })
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data: Listing) => {
        setListing(data);
        cacheListings([data]);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError' && !cached) setNotFound(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingListing(false);
      });
    return () => controller.abort();
  }, [id]);

  if (loadingListing) {
    return (
      <div className="baml-page">
        <MarketplaceStyles />
        <Header active="homes" favCount={favs.length} basketCount={basket.length} onAuth={() => setAuthView('savePrompt')} onFavourites={openFavourites} onBasket={() => navigate('/buyabroad/uk/basket')} />
        <main className="baml-detail-main"><p className="baml-empty">Loading property details...</p></main>
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="baml-page">
        <MarketplaceStyles />
        <Header active="homes" favCount={favs.length} basketCount={basket.length} onAuth={() => setAuthView('savePrompt')} onFavourites={openFavourites} onBasket={() => navigate('/buyabroad/uk/basket')} />
        <main className="baml-detail-main">
          <a href="/buyabroad/uk/listings" className="baml-back-link"><ArrowLeft size={16} /> Go Back</a>
          <h1>Property not found</h1>
          <p className="baml-empty">This listing is no longer available.</p>
        </main>
      </div>
    );
  }

  const active = listing;
  const images = active.images?.length ? active.images : fallbackImages;
  const saved = favs.includes(active.rightmove_id);
  const propertyPrice = active.price_gbp || 0;
  const costRows = costRowsFor(active);
  const fees = costRows.reduce((sum, row) => sum + row.amount, 0);
  const totalEstimated = propertyPrice + fees;
  const detailMeta = listingMetaParts(active);
  const viewSourceText = `View on ${sourceLabel(active)}`;

  const toggleFav = () => requireAuth(() => toggleSaved(active.rightmove_id));

  const addToBasket = () => {
    const next = basket.includes(active.rightmove_id) ? basket : [...basket, active.rightmove_id];
    setBasket(next);
    writeIds(MARKETPLACE_BASKET, next);
    navigate('/buyabroad/uk/basket');
  };

  return (
    <div className="baml-page">
      <MarketplaceStyles />
      <Header active="homes" favCount={favs.length} basketCount={basket.length} onAuth={() => setAuthView('savePrompt')} onFavourites={openFavourites} onBasket={() => navigate('/buyabroad/uk/basket')} />
      <main className="baml-detail-main">
        <a href="/buyabroad/uk/listings" className="baml-back-link"><ArrowLeft size={16} /> Go Back</a>
        <div className="baml-detail-top">
          <div>
            <h1>{cleanText(active.title) || cleanText(active.address) || 'Property for sale'}</h1>
            <p className="baml-detail-price">{displayPrice(active)}</p>
          </div>
          <button className="baml-save-button" onClick={toggleFav}><Heart size={18} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save'}</button>
        </div>
        <section className="baml-gallery">
          <div
            className="baml-gallery-main"
            role="button"
            tabIndex={0}
            onClick={() => setLightboxIndex(0)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setLightboxIndex(0); }}
          >
            <img src={images[0] || fallbackImages[0]} alt={active.title} />
          </div>
          {[1, 2, 3, 4].map((slot) => (
            <div
              key={slot}
              role="button"
              tabIndex={0}
              onClick={() => setLightboxIndex(slot)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setLightboxIndex(slot); }}
            >
              <img src={images[slot] || fallbackImages[slot % fallbackImages.length]} alt={`${active.title} ${slot + 1}`} />
            </div>
          ))}
        </section>
        <section className="baml-detail-content">
          <div className="baml-detail-copy">
            <h2>{active.property_type || 'Property'} in {cleanText([active.city, countryLabel(active.country)].filter(Boolean).join(', ')) || 'this market'}</h2>
            <p className="baml-detail-meta">
              <span>Source <strong>{sourceLabel(active)}</strong></span>
              <span>Property Status <strong>For Sale</strong></span>
              {detailMeta}
            </p>
            <p className="baml-description">{cleanText(active.description) || cleanText(active.address) || 'Contact Havlo for a full property review, local due diligence, and purchase guidance.'}</p>
            <div className="baml-cost-table">
              <div className="tabs">
                <button type="button" className={costTab === 'cash' ? 'active' : ''} onClick={() => setCostTab('cash')}>Cash Buyer</button>
                <button type="button" className={costTab === 'mortgage' ? 'active' : ''} onClick={() => setCostTab('mortgage')}>Mortgage Buyer</button>
              </div>
              {costTab === 'cash' ? (
                <>
                  <h3>Other Associated Costs</h3>
                  {costRows.map((row) => (
                    <div className="baml-cost-row" key={row.label}><span>{row.label}:</span><strong className={row.accent ? 'purple' : ''}>{formatGbp(row.amount)}</strong></div>
                  ))}
                  <div className="baml-cost-row"><span>Property price:</span><strong>{formatGbp(propertyPrice)}</strong></div>
                  <div className="baml-cost-row baml-total"><span>Total Estimated cost including other fees:</span><strong>{formatGbp(totalEstimated)}</strong></div>
                </>
              ) : (
                <>
                  <h3>Mortgage Calculator</h3>
                  <p className="baml-mortgage-sub">Based on a 7% p.a. non-resident mortgage rate</p>
                  <div className="baml-mortgage-row">
                    <label>Deposit: <strong>{deposit}%</strong> ({formatGbp(Math.round(propertyPrice * deposit / 100))})</label>
                    <input
                      type="range" min={10} max={50} step={5}
                      value={deposit}
                      onChange={(event) => setDeposit(Number(event.target.value))}
                      className="baml-slider"
                    />
                    <div className="baml-slider-labels"><span>10%</span><span>50%</span></div>
                  </div>
                  <div className="baml-mortgage-row">
                    <label>Loan term: <strong>{term} years</strong></label>
                    <input
                      type="range" min={5} max={30} step={5}
                      value={term}
                      onChange={(event) => setTerm(Number(event.target.value))}
                      className="baml-slider"
                    />
                    <div className="baml-slider-labels"><span>5 yrs</span><span>30 yrs</span></div>
                  </div>
                  {(() => {
                    const mortgage = calcMortgage(propertyPrice, deposit, term);
                    return (
                      <>
                        <div className="baml-cost-row"><span>Loan amount:</span><strong>{formatGbp(mortgage.loanGbp)}</strong></div>
                        <div className="baml-cost-row"><span>Total interest:</span><strong>{formatGbp(mortgage.interestGbp)}</strong></div>
                        <div className="baml-cost-row baml-total"><span>Monthly payment:</span><strong>{formatGbp(mortgage.monthlyGbp)}/mo</strong></div>
                      </>
                    );
                  })()}
                  <p className="baml-mortgage-disc">Indicative only. Actual rates vary by lender. We connect you with specialist non-resident mortgage brokers.</p>
                </>
              )}
            </div>
          </div>
          <aside className="baml-cost-card">
            <small>TOTAL ESTIMATED COST</small>
            <h2>{formatGbp(totalEstimated)}</h2>
            <div className="baml-progress"><span /></div>
            <p className="baml-cost-legend"><strong><span className="baml-dot" /> Property {formatGbp(propertyPrice)}</strong> <strong className="purple"><span className="baml-dot purple-dot" /> Fees {formatGbp(fees)}</strong></p>
            <div className="baml-sidebar-actions">
              <button onClick={addToBasket}>Add to Basket <ShoppingBasket size={17} /></button>
              <a href="/buyabroad/uk/consultation">How it Works <ChevronRight size={17} /></a>
              <a href={active.url || '#'} target="_blank" rel="noreferrer">{viewSourceText}</a>
            </div>
            <p className="baml-info-note"><Info size={16} /> This property is covered by your one-time $99.99 consultation deposit. Add as many as you like at no extra cost.</p>
          </aside>
        </section>
      </main>
      <FooterCta />
      {authView && <AuthModal view={authView} setView={setAuthView} onClose={() => { setAuthView(null); clearPending(); }} onAuthenticated={onAuthenticated} />}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={images}
          index={lightboxIndex}
          title={active.title}
          onClose={() => setLightboxIndex(null)}
          onChange={setLightboxIndex}
        />
      )}
    </div>
  );
};

// Bed / shower / pin emoji, as in the basket design.
function BasketMeta({ listing }: { listing: Listing }) {
  const parts: string[] = [];
  if (listing.bedrooms > 0) parts.push(`🛏️ ${listing.bedrooms} ${listing.bedrooms === 1 ? 'bed' : 'beds'}`);
  if ((listing.bathrooms || 0) > 0) parts.push(`🚿 ${listing.bathrooms} ${listing.bathrooms === 1 ? 'bath' : 'baths'}`);
  const place = cleanText(listing.city);
  if (place) parts.push(`📍 ${place}`);
  if (!parts.length) return null;
  return <p className="bab-item-meta">{parts.map((part) => <span key={part}>{part}</span>)}</p>;
}

export const BuyAbroadUkBasket: React.FC = () => {
  usePageMeta({ title: 'Your Basket | Havlo Buy Abroad', description: 'Review selected homes and proceed to checkout.' });
  const auth = useAuth();
  const navigate = useNavigate();
  const [ids, setIds] = useState<string[]>(() => readIds(MARKETPLACE_BASKET));
  const { favs } = useFavourites();
  const [listings, setListings] = useState<Listing[]>([]);
  const [authView, setAuthView] = useState<AuthView | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [checkoutError, setCheckoutError] = useState('');
  const [details, setDetails] = useState<CheckoutDetails>({
    fullName: '',
    email: '',
    address: '',
    city: '',
    postCode: '',
    phone: '',
  });
  const { requireAuth, onAuthenticated, clearPending } = useAuthGate(setAuthView);
  const selected = useMemo(() => ids.length ? listings.filter((item) => ids.includes(item.rightmove_id)) : [], [ids, listings]);

  useEffect(() => {
    if (!ids.length) {
      setListings([]);
      return;
    }
    const cached = ids.map(readCachedListing).filter(Boolean) as Listing[];
    if (cached.length) setListings(cached);
    fetch(listingsApiUrl(`/listings/by-ids?ids=${encodeURIComponent(ids.join(','))}`))
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data: { listings: Listing[] }) => {
        cacheListings(data.listings || []);
        setListings(data.listings || []);
      })
      .catch(() => {});
  }, [ids]);

  useEffect(() => {
    if (!auth.user) return;
    setDetails((current) => ({
      ...current,
      fullName: current.fullName || `${auth.user?.first_name || ''} ${auth.user?.last_name || ''}`.trim(),
      email: current.email || auth.user?.email || '',
      phone: current.phone || auth.user?.phone_number || '',
    }));
  }, [auth.user]);

  const remove = (id: string) => {
    const next = ids.filter((item) => item !== id);
    setIds(next);
    writeIds(MARKETPLACE_BASKET, next);
  };

  const beginCheckout = () => {
    if (!selected.length) return;
    requireAuth(() => {
      setCheckoutError('');
      setCheckoutStep('payment');
    });
  };

  const submitDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!auth.token || !auth.user) {
      setAuthView('savePrompt');
      return;
    }
    setCheckingOut(true);
    setCheckoutError('');
    try {
      const name = splitName(details.fullName || `${auth.user.first_name || ''} ${auth.user.last_name || ''}`);
      const result = await api.bookSession(auth.token, {
        first_name: name.first_name,
        last_name: name.last_name,
        email: details.email || auth.user.email,
        phone_country_code: auth.user.phone_country_code || '+234',
        phone_number: details.phone || auth.user.phone_number || '0000000000',
        preferred_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        preferred_time: '10:00',
      });
      redirectToCheckout(result.checkout_id, { kind: 'buy_abroad_consultation', recordId: result.booking_id, reference: result.checkout_id });
    } catch (err: any) {
      setCheckoutError(err?.message || 'We could not create your checkout. Please try again.');
      setCheckingOut(false);
    }
  };

  return (
    <div className="baml-page bab-page">
      <MarketplaceStyles />
      <Header
        active="homes"
        favCount={favs.length}
        basketCount={selected.length}
        onAuth={() => setAuthView('savePrompt')}
        onFavourites={() => requireAuth(() => navigate(FAVOURITES_PATH))}
        onBasket={() => navigate('/buyabroad/uk/basket')}
      />
      <main className="bab-main">
        <a href="/buyabroad/uk/listings" className="bab-goback"><Undo2 size={20} /> Go Back</a>
        <h1 className="bab-title">Your Basket</h1>
        <div className="bab-basket-layout">
          <div className="bab-items">
            {selected.length ? selected.map((listing, index) => (
              <article className="bab-item" key={listing.rightmove_id}>
                <a href={detailUrl(listing)} className="bab-item-img"><img src={imageFor(listing, index)} alt="" /></a>
                <div className="bab-item-info">
                  <h2><a href={detailUrl(listing)}>{cleanText(listing.title) || cleanText(listing.address) || 'Property for sale'}</a></h2>
                  <BasketMeta listing={listing} />
                  <p className="bab-item-price">{displayPrice(listing)} total</p>
                </div>
                <button type="button" className="bab-trash" onClick={() => remove(listing.rightmove_id)} aria-label={`Remove ${cleanText(listing.title) || 'property'} from basket`}><Trash2 size={24} /></button>
              </article>
            )) : <p className="bab-empty">Your basket is empty.</p>}
            <a href="/buyabroad/uk/listings" className="bab-link"><ArrowLeft size={16} /> Continue Browsing</a>
          </div>
          <aside className="bab-summary" aria-label="Order summary">
            <h2>Order Summary</h2>
            <div className="bab-sum-row"><span>Properties selected</span><b className="bab-count">{selected.length}</b></div>
            <div className="bab-sum-row"><span>Consultation fee ( Refundable)</span><b>${CONSULTATION_FEE}</b></div>
            <div className="bab-sum-total"><span>Total due today</span><b>${CONSULTATION_FEE}</b></div>
            <div className="bab-note">
              <span className="bab-note-icon" aria-hidden="true">i</span>
              <div>
                <p>The consultation itself is free. Due to the high number of enquiries we receive, we ask for a ${CONSULTATION_FEE} deposit to confirm you&apos;re serious about buying, this lets our advisor focus their time on genuine buyers rather than casual enquiries.</p>
                <ul>
                  <li>If you don&apos;t move forward: Your deposit is refunded after the consultation, minus any payment processing fees charged by our provider.</li>
                  <li>If you decide to work with us: The full ${CONSULTATION_FEE} is credited toward your advisory fee — you won&apos;t pay it twice.</li>
                </ul>
              </div>
            </div>
            <button type="button" className="bab-checkout" onClick={beginCheckout} disabled={checkingOut || !selected.length}>
              {checkingOut ? 'Creating checkout...' : <>Proceed to Checkout <ChevronRight size={18} /></>}
            </button>
          </aside>
        </div>
      </main>
      <FooterCta />
      {authView && <AuthModal view={authView} setView={setAuthView} onClose={() => { setAuthView(null); clearPending(); }} onAuthenticated={onAuthenticated} />}
      {checkoutStep === 'payment' && (
        <PaymentMethodModal
          method={paymentMethod}
          setMethod={setPaymentMethod}
          onClose={() => setCheckoutStep(null)}
          onContinue={() => setCheckoutStep('details')}
        />
      )}
      {checkoutStep === 'details' && (
        <CheckoutDetailsModal
          details={details}
          setDetails={setDetails}
          checkingOut={checkingOut}
          error={checkoutError}
          onClose={() => setCheckoutStep(null)}
          onBack={() => setCheckoutStep('payment')}
          onSubmit={submitDetails}
        />
      )}
    </div>
  );
};

// White tick on a purple disc, as in the consultation design.
const TickBadge = () => (
  <svg className="bab-tick" width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
    <circle cx="14" cy="14" r="14" fill="#A409D2" />
    <path d="M8.5 14.4l3.6 3.6 7.4-7.6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const BuyAbroadUkConsultation: React.FC = () => {
  usePageMeta({
    title: 'How Your Consultation Works | Havlo Buy Abroad',
    description: 'Watch how the Havlo Buy Abroad consultation works before booking your advisor call.',
  });
  const navigate = useNavigate();
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [authView, setAuthView] = useState<AuthView | null>(null);
  const { requireAuth, onAuthenticated, clearPending } = useAuthGate(setAuthView);
  const basketCount = readIds(MARKETPLACE_BASKET).length;
  const { favs } = useFavourites();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') setShowAdvisor(true);
  }, []);

  return (
    <div className="baml-page bab-page">
      <MarketplaceStyles />
      <Header
        active="how"
        favCount={favs.length}
        basketCount={basketCount}
        onAuth={() => setAuthView('savePrompt')}
        onFavourites={() => requireAuth(() => navigate(FAVOURITES_PATH))}
        onBasket={() => navigate('/buyabroad/uk/basket')}
      />
      <main className="bab-main bab-consult">
        <nav className="bab-crumbs" aria-label="Checkout progress">
          <a href="/buyabroad/uk/basket" className="done">Basket</a>
          <span aria-hidden="true">·</span>
          <span className="done" aria-current="step">How your consultation works</span>
          <span aria-hidden="true">·</span>
          <span>Payment</span>
          <span aria-hidden="true">·</span>
          <span>Consultation booked</span>
        </nav>
        <h1 className="bab-title">How Your Consultation Works</h1>
        <p className="bab-intro">
          {basketCount > 0 && <>Your basket has <b>{basketCount} {basketCount === 1 ? 'property' : 'properties'}</b> shortlisted. </>}
          Before you pay the <b>${CONSULTATION_FEE} consultation deposit,</b> watch this 2-minute explainer covering what happens next.
        </p>
        <section className="bab-video" aria-label="Consultation explainer video">
          {/* Placeholder until the explainer video is supplied. */}
          <div className="bab-video-stage">
            <span className="bab-video-pill">2 min explainer</span>
            <button className="bab-play" type="button" aria-label="Play consultation explainer">
              <Play size={20} fill="currentColor" />
            </button>
          </div>
          <div className="bab-covers">
            <h2>What this video covers</h2>
            <ul>
              <li><TickBadge />How the process works</li>
              <li><TickBadge />What the consultation includes</li>
              <li><TickBadge />What happens after payment</li>
              <li><TickBadge />Your timeline &amp; next steps</li>
            </ul>
          </div>
        </section>
        <section className="bab-questions">
          <div>
            <h2>Still Have Questions?</h2>
            <p>Read our frequently asked questions before proceeding.</p>
          </div>
          <div className="bab-question-actions">
            <a href="/faq" className="bab-btn-outline">Read FAQs</a>
            <a href="/buyabroad/uk/basket" className="bab-btn-solid">Continue to Payment <ChevronRight size={18} /></a>
          </div>
        </section>
      </main>
      <FooterCta />
      {authView && <AuthModal view={authView} setView={setAuthView} onClose={() => { setAuthView(null); clearPending(); }} onAuthenticated={onAuthenticated} />}
      {showAdvisor && <AdvisorReadyModal onClose={() => setShowAdvisor(false)} />}
    </div>
  );
};

// Saved homes. Favourites are saved to the account (useFavourites), so the
// page asks visitors to sign in first.
export const BuyAbroadUkFavourites: React.FC = () => {
  usePageMeta({ title: 'Your Favourites | Havlo Buy Abroad', description: 'Homes you have saved on Havlo Buy Abroad.' });
  const auth = useAuth();
  const navigate = useNavigate();
  const { favs, ready, remove } = useFavourites();
  const [basket, setBasket] = useState<string[]>(() => readIds(MARKETPLACE_BASKET));
  const [listings, setListings] = useState<Listing[]>(() => favs.map(readCachedListing).filter(Boolean) as Listing[]);
  const [inFlight, setInFlight] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [authView, setAuthView] = useState<AuthView | null>(null);
  const { requireAuth, onAuthenticated, clearPending } = useAuthGate(setAuthView);
  const signedIn = Boolean(auth.token);

  // Fetch details for saved homes we haven't asked about yet: on arrival,
  // and again when the account's list brings in homes saved elsewhere.
  // Removing a home only filters what's shown, so it never refetches.
  const requested = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const toFetchKey = favs.filter((id) => !requested.current.has(id)).join(',');

  useEffect(() => {
    if (!toFetchKey) return;
    const ids = toFetchKey.split(',');
    ids.forEach((id) => requested.current.add(id));
    setInFlight((n) => n + 1);
    setLoadError('');
    // /listings/by-ids answers at most 200 ids per call.
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += 200) batches.push(ids.slice(i, i + 200));
    Promise.all(batches.map((batch) => (
      fetch(listingsApiUrl(`/listings/by-ids?ids=${encodeURIComponent(batch.join(','))}`))
        .then((res) => res.ok ? res.json() as Promise<{ listings: Listing[] }> : Promise.reject())
    )))
      .then((results) => {
        if (!mounted.current) return;
        const found = results.flatMap((data) => data.listings || []);
        cacheListings(found);
        setListings((prev) => [...prev.filter((listing) => !ids.includes(listing.rightmove_id)), ...found]);
      })
      .catch(() => {
        if (mounted.current) setLoadError('We could not refresh your saved homes right now.');
      })
      .finally(() => {
        if (mounted.current) setInFlight((n) => n - 1);
      });
  }, [toFetchKey]);

  const loading = inFlight > 0 || Boolean(toFetchKey);
  // Keep the order homes were saved in.
  const saved = favs
    .map((id) => listings.find((listing) => listing.rightmove_id === id))
    .filter(Boolean) as Listing[];
  // Homes that have since been sold or taken off the portals.
  const unavailable = !loading && !loadError ? favs.filter((id) => !listings.some((listing) => listing.rightmove_id === id)) : [];

  const unsave = (id: string) => remove([id]);

  const clearUnavailable = () => remove(unavailable);

  const toggleBasket = (id: string) => {
    const next = basket.includes(id) ? basket.filter((item) => item !== id) : [...basket, id];
    setBasket(next);
    writeIds(MARKETPLACE_BASKET, next);
  };

  return (
    <div className="baml-page bab-page">
      <MarketplaceStyles />
      <Header
        active={null}
        favCount={favs.length}
        basketCount={basket.length}
        onAuth={() => setAuthView('savePrompt')}
        onFavourites={() => requireAuth(() => navigate(FAVOURITES_PATH))}
        onBasket={() => navigate('/buyabroad/uk/basket')}
      />
      <main className="bab-main">
        <a href="/buyabroad/uk/listings" className="bab-goback"><Undo2 size={20} /> Go Back</a>
        <h1 className="bab-title">Your Favourites</h1>
        {!signedIn ? (
          <section className="bab-fav-empty">
            <Heart size={34} />
            <h2>Sign in to see your saved homes</h2>
            <p>Save homes as you browse and they&apos;ll be waiting for you here.</p>
            <div className="bab-fav-actions">
              <button type="button" className="bab-btn-solid" onClick={() => setAuthView('register')}>Create Account</button>
              <button type="button" className="bab-btn-outline" onClick={() => setAuthView('login')}>Sign in</button>
            </div>
          </section>
        ) : !favs.length && !ready ? (
          <ListingsLoadingState />
        ) : !favs.length ? (
          <section className="bab-fav-empty">
            <Heart size={34} />
            <h2>No saved homes yet</h2>
            <p>Tap the heart on any home to save it here.</p>
            <div className="bab-fav-actions">
              <a href="/buyabroad/uk/listings" className="bab-btn-solid">Browse homes <ChevronRight size={18} /></a>
            </div>
          </section>
        ) : (
          <>
            <p className="bab-intro">{saved.length || favs.length} {(saved.length || favs.length) === 1 ? 'home' : 'homes'} saved. Tap the heart to remove one.</p>
            {unavailable.length > 0 && (
              <p className="bab-fav-gone">
                {unavailable.length} saved {unavailable.length === 1 ? 'home is' : 'homes are'} no longer listed.{' '}
                <button type="button" onClick={clearUnavailable}>Remove {unavailable.length === 1 ? 'it' : 'them'}</button>
              </p>
            )}
            {loadError && !saved.length && <p className="bab-empty">{loadError}</p>}
            {loading && !saved.length ? <ListingsLoadingState /> : (
              <div className="bab-fav-grid">
                {saved.map((listing, index) => (
                  <div className="bab-fav-card" key={listing.rightmove_id}>
                    <PropertyCard listing={listing} index={index} saved onSave={() => unsave(listing.rightmove_id)} />
                    <button
                      type="button"
                      className={`bab-fav-basket${basket.includes(listing.rightmove_id) ? ' is-added' : ''}`}
                      onClick={() => toggleBasket(listing.rightmove_id)}
                      aria-pressed={basket.includes(listing.rightmove_id)}
                    >
                      <ShoppingBasket size={16} /> {basket.includes(listing.rightmove_id) ? 'In basket' : 'Add to basket'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <FooterCta />
      {authView && <AuthModal view={authView} setView={setAuthView} onClose={() => { setAuthView(null); clearPending(); }} onAuthenticated={onAuthenticated} />}
    </div>
  );
};

export default BuyAbroadUkListingsRedesign;


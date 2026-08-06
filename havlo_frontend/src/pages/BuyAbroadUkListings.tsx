import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../hooks/useModal';
import { API_BASE } from '../lib/api';
import './listings-redesign.css';

/* ──────────────────────────────────────────────────
   Types
────────────────────────────────────────────────── */
interface UKListing {
  id: string;
  rightmove_id: string;
  url: string;
  title: string;
  price_gbp: number;
  address: string;
  city: string;
  bedrooms: number;
  bathrooms: number | null;
  property_type: string;
  images: string[];
}

interface IntlListing {
  id: string;
  source: string;
  external_id: string;
  url: string | null;
  title: string | null;
  price_local: number | null;
  currency_code: string;
  currency_symbol: string;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string;
  bedrooms: number;
  bathrooms: number | null;
  property_type: string;
  images: string[];
}

interface CardListing {
  key: string;
  href: string;
  image: string;
  title: string;
  beds: number;
  baths: number | null;
  city: string;
  priceFormatted: string;
  isExternal: boolean;
}

type Country = 'uk' | 'usa' | 'canada' | 'dubai';

/* ──────────────────────────────────────────────────
   Formatters
────────────────────────────────────────────────── */
function fmtGbp(n: number): string {
  return `£${n.toLocaleString('en-GB')}`;
}
function fmtIntl(n: number | null, sym: string, code: string): string {
  if (!n) return '';
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}M ${code}`;
  return `${sym}${Math.round(n).toLocaleString()} ${code}`;
}
function ukToCard(l: UKListing): CardListing {
  return {
    key: `uk-${l.rightmove_id}`,
    href: `/buyabroad/uk/listings/${l.rightmove_id}`,
    image: l.images[0] ?? '',
    title: l.address || l.title || l.city,
    beds: l.bedrooms,
    baths: l.bathrooms,
    city: l.city,
    priceFormatted: `${fmtGbp(l.price_gbp)} total`,
    isExternal: false,
  };
}
function intlToCard(l: IntlListing): CardListing {
  return {
    key: `${l.source}-${l.external_id}`,
    href: l.url ?? '#',
    image: l.images[0] ?? '',
    title: l.address || l.title || l.city || l.country,
    beds: l.bedrooms,
    baths: l.bathrooms,
    city: l.city || l.region || l.country,
    priceFormatted: l.price_local
      ? `${fmtIntl(l.price_local, l.currency_symbol, l.currency_code)} total`
      : '',
    isExternal: true,
  };
}

/* ──────────────────────────────────────────────────
   SVG Icons
────────────────────────────────────────────────── */
const BedIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9.5V19h20V9.5"/><path d="M2 19V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12"/>
    <path d="M2 13h20"/><path d="M6 13v-3h5v3"/><path d="M13 13v-3h5v3"/>
  </svg>
);
const BathIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3a1 1 0 0 1 1-1z"/>
    <path d="M6 12V5a2 2 0 0 1 2-2h3v2.25"/>
    <line x1="4" y1="21" x2="4" y2="22"/><line x1="20" y1="21" x2="20" y2="22"/>
  </svg>
);
const PinIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const HeartFilledIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#A409D2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);
const HeartOutlineIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);
const ArrowRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);
const ChevronLeftIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
);
const ChevronRightIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
);

/* ──────────────────────────────────────────────────
   PropertyCard
────────────────────────────────────────────────── */
function PropertyCard({
  listing,
  isFav,
  onToggleFav,
}: {
  listing: CardListing;
  isFav: boolean;
  onToggleFav: (key: string) => void;
}) {
  const linkProps = listing.isExternal
    ? { href: listing.href, target: '_blank', rel: 'noopener noreferrer' }
    : { href: listing.href };

  return (
    <article className="lp-card">
      <div className="lp-card-img-wrap">
        <a {...linkProps} className="block w-full h-full" tabIndex={-1} aria-hidden="true">
          {listing.image ? (
            <img src={listing.image} alt={listing.title} loading="lazy" className="lp-card-img" />
          ) : (
            <div className="lp-card-no-img">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
          )}
        </a>
        <button
          className={`lp-heart${isFav ? ' lp-heart--active' : ''}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFav(listing.key); }}
          aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
        >
          {isFav ? <HeartFilledIcon /> : <HeartOutlineIcon />}
        </button>
      </div>
      <div className="lp-card-body">
        <a {...linkProps}>
          <h3 className="lp-card-title">{listing.title}</h3>
          <div className="lp-card-meta">
            {listing.beds > 0 && (
              <span className="lp-meta-item"><BedIcon /> {listing.beds} bed{listing.beds !== 1 ? 's' : ''}</span>
            )}
            {listing.baths != null && listing.baths > 0 && (
              <span className="lp-meta-item"><BathIcon /> {listing.baths} bath{listing.baths !== 1 ? 's' : ''}</span>
            )}
            {listing.city && (
              <span className="lp-meta-item"><PinIcon /> {listing.city}</span>
            )}
          </div>
          {listing.priceFormatted && (
            <p className="lp-card-price">{listing.priceFormatted}</p>
          )}
        </a>
      </div>
    </article>
  );
}

/* ──────────────────────────────────────────────────
   SkeletonCard
────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <article className="lp-card">
      <div className="lp-card-img-wrap"><div className="lp-skel-img" /></div>
      <div className="lp-card-body">
        <div className="lp-skel lp-skel-title" />
        <div className="lp-skel lp-skel-meta" />
        <div className="lp-skel lp-skel-price" />
      </div>
    </article>
  );
}

/* ──────────────────────────────────────────────────
   CountrySection
────────────────────────────────────────────────── */
function CountrySection({
  title,
  listings,
  loading,
  onViewAll,
  isFav,
  onToggleFav,
}: {
  title: string;
  listings: CardListing[];
  loading: boolean;
  onViewAll: () => void;
  isFav: (key: string) => boolean;
  onToggleFav: (key: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'right' ? el.offsetWidth * 0.75 : -el.offsetWidth * 0.75, behavior: 'smooth' });
  };

  return (
    <div className="lp-section">
      <div className="lp-section-header">
        <button className="lp-section-title" onClick={onViewAll}>
          {title} <ArrowRightIcon />
        </button>
        <div className="lp-section-nav">
          <button className="lp-nav-btn" onClick={() => scroll('left')} aria-label="Previous"><ChevronLeftIcon /></button>
          <button className="lp-nav-btn" onClick={() => scroll('right')} aria-label="Next"><ChevronRightIcon /></button>
        </div>
      </div>

      <div className="lp-scroll no-scrollbar" ref={scrollRef}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : listings.length === 0 ? (
          <div className="lp-empty-section">
            <p>Properties coming soon.</p>
            <a
              href="https://wa.me/2349039861006"
              target="_blank"
              rel="noopener noreferrer"
              className="lp-empty-link"
            >
              Ask via WhatsApp →
            </a>
          </div>
        ) : (
          listings.map((l) => (
            <PropertyCard key={l.key} listing={l} isFav={isFav(l.key)} onToggleFav={onToggleFav} />
          ))
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   AllHomesModal
────────────────────────────────────────────────── */
function AllHomesModal({
  source,
  title,
  onClose,
  isFav,
  onToggleFav,
}: {
  source: Country;
  title: string;
  onClose: () => void;
  isFav: (key: string) => boolean;
  onToggleFav: (key: string) => void;
}) {
  const PER_PAGE = 10;
  const [listings, setListings] = useState<CardListing[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const doFetch = async () => {
      try {
        if (source === 'uk') {
          const r = await fetch(`${API_BASE}/listings/?per_page=${PER_PAGE}&page=${page}`);
          const d = await r.json();
          setListings((d.listings ?? []).map(ukToCard));
          setTotalPages(d.pages ?? 1);
        } else {
          const r = await fetch(`${API_BASE}/intl-listings/?source=${source}&per_page=${PER_PAGE}&page=${page}`);
          const d = await r.json();
          setListings((d.listings ?? []).map(intlToCard));
          setTotalPages(d.pages ?? 1);
        }
      } catch {/* ignore */} finally {
        setLoading(false);
      }
    };
    void doFetch();
  }, [source, page]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const pageNumbers = (): (number | '...')[] => {
    const arr: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) arr.push(i);
    } else {
      arr.push(1);
      if (page > 3) arr.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) arr.push(i);
      if (page < totalPages - 2) arr.push('...');
      arr.push(totalPages);
    }
    return arr;
  };

  return (
    <div
      className="lp-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`All Homes in ${title}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="lp-modal">
        <div className="lp-modal-header">
          <h2 className="lp-modal-title">All Homes in {title}</h2>
          <button className="lp-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="lp-modal-body">
          {loading ? (
            <div className="lp-modal-grid">
              {Array.from({ length: PER_PAGE }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : listings.length === 0 ? (
            <div className="lp-modal-empty">
              <p>No properties found yet — check back soon!</p>
            </div>
          ) : (
            <div className="lp-modal-grid">
              {listings.map((l) => (
                <PropertyCard key={l.key} listing={l} isFav={isFav(l.key)} onToggleFav={onToggleFav} />
              ))}
            </div>
          )}

          {totalPages > 1 && !loading && (
            <div className="lp-pagination">
              <button
                className="lp-page-btn"
                onClick={() => { setPage((p) => Math.max(1, p - 1)); }}
                disabled={page === 1}
                aria-label="Previous page"
              >
                <ChevronLeftIcon />
              </button>
              {pageNumbers().map((p, i) =>
                p === '...'
                  ? <span key={`e${i}`} className="lp-page-ellipsis">...</span>
                  : (
                    <button
                      key={p}
                      className={`lp-page-btn${page === p ? ' lp-page-btn--active' : ''}`}
                      onClick={() => setPage(p as number)}
                    >
                      {p}
                    </button>
                  )
              )}
              <button
                className="lp-page-btn"
                onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); }}
                disabled={page === totalPages}
                aria-label="Next page"
              >
                <ChevronRightIcon />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   Main Component
────────────────────────────────────────────────── */
export const BuyAbroadUkListings: React.FC = () => {
  usePageMeta({
    title: 'Buy Property in UK, USA, Canada & Dubai | Havlo',
    description: 'Browse live property listings in the UK, USA, Canada and Dubai. End-to-end advisory from Havlo.',
    canonical: 'https://www.heyhavlo.com/buyabroad/uk/listings',
  });

  const { token } = useAuth();
  const { openModal } = useModal();
  const { toggle, isFavorite, count } = useFavorites();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [allHomes, setAllHomes] = useState<{ source: Country; title: string } | null>(null);

  const [ukListings, setUkListings] = useState<CardListing[]>([]);
  const [usaListings, setUsaListings] = useState<CardListing[]>([]);
  const [canadaListings, setCanadaListings] = useState<CardListing[]>([]);
  const [dubaiListings, setDubaiListings] = useState<CardListing[]>([]);
  const [ukLoading, setUkLoading] = useState(true);
  const [intlLoading, setIntlLoading] = useState(true);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch UK
  useEffect(() => {
    setUkLoading(true);
    const p = new URLSearchParams({ per_page: '5', page: '1' });
    if (search) p.set('search', search);
    fetch(`${API_BASE}/listings/?${p}`)
      .then((r) => r.json())
      .then((d) => setUkListings((d.listings ?? []).map(ukToCard)))
      .catch(() => {})
      .finally(() => setUkLoading(false));
  }, [search]);

  // Fetch international (preview endpoint: all 3 sources in one call)
  useEffect(() => {
    setIntlLoading(true);
    const p = new URLSearchParams({ per_page: '5' });
    if (search) p.set('search', search);
    fetch(`${API_BASE}/intl-listings/preview?${p}`)
      .then((r) => r.json())
      .then((d) => {
        setUsaListings((d.usa?.listings ?? []).map(intlToCard));
        setCanadaListings((d.canada?.listings ?? []).map(intlToCard));
        setDubaiListings((d.dubai?.listings ?? []).map(intlToCard));
      })
      .catch(() => {})
      .finally(() => setIntlLoading(false));
  }, [search]);

  const handleToggleFav = useCallback((key: string) => {
    if (!token) { openModal('sign-in-to-save'); return; }
    toggle(key);
  }, [token, toggle, openModal]);

  const SECTIONS: { source: Country; title: string; sectionTitle: string; listings: CardListing[]; loading: boolean }[] = [
    { source: 'uk',     title: 'the UK',  sectionTitle: 'Properties For Sale in the UK',     listings: ukListings,     loading: ukLoading },
    { source: 'usa',    title: 'America', sectionTitle: 'Properties For Sale in America',     listings: usaListings,    loading: intlLoading },
    { source: 'canada', title: 'Canada',  sectionTitle: 'Properties For Sale in Canada',      listings: canadaListings, loading: intlLoading },
    { source: 'dubai',  title: 'Dubai',   sectionTitle: 'Properties For Sale in Dubai',       listings: dubaiListings,  loading: intlLoading },
  ];

  return (
    <div className="lp-page">
      {/* ── Header ───────────────────────────────────── */}
      <header className="lp-header">
        <div className="lp-header-inner">
          {/* Logo */}
          <a href="/buyabroad/uk" className="lp-logo">
            <span className="lp-logo-text">HAVLO</span>
            <span className="lp-logo-sub">Buy Abroad</span>
          </a>

          {/* Desktop Nav */}
          <nav className="lp-desktop-nav">
            <a href="/buyabroad/uk/listings" className="lp-nav-link lp-nav-link--active">
              <span className="lp-nav-icon">🏠</span> Homes
            </a>
            <a href="/buyabroad/uk#how-it-works" className="lp-nav-link">
              <span className="lp-nav-icon">💡</span> How it Works
            </a>
            <a href="/buyabroad/uk#pricing" className="lp-nav-link">
              <span className="lp-nav-icon">💰</span> Pricing
            </a>
            <a href="/buyabroad/uk" className="lp-consult-btn">Get Free Consultation</a>
          </nav>

          {/* Right Icons */}
          <div className="lp-header-icons">
            <button
              className="lp-icon-btn"
              onClick={() => token ? undefined : openModal('sign-in-to-save')}
              aria-label="Saved properties"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={count > 0 && token ? '#A409D2' : 'none'} stroke={count > 0 && token ? '#A409D2' : 'currentColor'} strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              {count > 0 && <span className="lp-badge">{count > 9 ? '9+' : count}</span>}
            </button>

            <button
              className="lp-icon-btn"
              onClick={() => window.open('https://wa.me/2349039861006', '_blank')}
              aria-label="WhatsApp enquiries"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
            </button>

            <button
              className="lp-hamburger"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile nav tabs */}
        <div className="lp-mobile-nav">
          <a href="/buyabroad/uk/listings" className="lp-mobile-nav-link lp-mobile-nav-link--active">
            <span>🏠</span> Homes
          </a>
          <a href="/buyabroad/uk#how-it-works" className="lp-mobile-nav-link">
            <span>💡</span> How it Works
          </a>
          <a href="/buyabroad/uk#pricing" className="lp-mobile-nav-link">
            <span>💰</span> Pricing
          </a>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="lp-mobile-menu">
            <a href="/buyabroad/uk" className="lp-mobile-menu-link">Buy Property in UK</a>
            <a href="/buyabroad/uk/agents" className="lp-mobile-menu-link">Become an Agent Partner</a>
            <a href="/buyabroad/uk/apply" className="lp-mobile-menu-link">Apply to Buy</a>
            <hr className="lp-mobile-menu-divider" />
            {token ? (
              <a href="/dashboard" className="lp-mobile-menu-link">My Dashboard</a>
            ) : (
              <>
                <button
                  className="lp-mobile-menu-link"
                  onClick={() => { openModal('login'); setMobileMenuOpen(false); }}
                >
                  Sign In
                </button>
                <button
                  className="lp-mobile-menu-link lp-mobile-menu-link--primary"
                  onClick={() => { openModal('create-account'); setMobileMenuOpen(false); }}
                >
                  Create Account
                </button>
              </>
            )}
          </div>
        )}
      </header>

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="lp-hero">
        <h1 className="lp-hero-title">BUY PROPERTY IN UK</h1>
        <p className="lp-hero-sub">
          We provide end-to-end advisory and guidance, from search to sale, wherever you're buying.
        </p>
        <div className="lp-search-bar">
          <button className="lp-search-filter" aria-label="Filters">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
          </button>
          <input
            type="text"
            placeholder="Search by Property title, address, city"
            className="lp-search-input"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search properties"
          />
          <button className="lp-search-btn" aria-label="Search">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
        </div>
      </section>

      {/* ── Country Sections ─────────────────────────── */}
      <main className="lp-sections-wrapper">
        {SECTIONS.map(({ source, title, sectionTitle, listings, loading }) => (
          <CountrySection
            key={source}
            title={sectionTitle}
            listings={listings}
            loading={loading}
            onViewAll={() => setAllHomes({ source, title })}
            isFav={isFavorite}
            onToggleFav={handleToggleFav}
          />
        ))}
      </main>

      {/* ── CTA ──────────────────────────────────────── */}
      <section className="lp-cta">
        <div className="lp-cta-inner">
          <div className="lp-cta-text">
            <h2 className="lp-cta-title">
              Can't find what you're<br />looking for?
            </h2>
            <p className="lp-cta-sub">
              Our advisors source off-market and exclusive properties not listed on any portal.
              Tell us what you want and we'll find it.
            </p>
          </div>
          <a
            href="https://wa.me/2349039861006?text=Hi%20Havlo%2C%20I%20am%20looking%20for%20a%20specific%20property%20and%20need%20help."
            target="_blank"
            rel="noopener noreferrer"
            className="lp-cta-btn"
          >
            <span className="lp-cta-btn-icon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l.95-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 17z"/>
              </svg>
            </span>
            Book a Call
          </a>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="lp-footer">
        <a href="/buyabroad/uk" className="lp-footer-logo">
          <span className="lp-footer-logo-text">HAVLO</span>
          <span className="lp-footer-logo-sub">Buy Abroad</span>
        </a>
        <p className="lp-footer-copy">© {new Date().getFullYear()} Havlo Buy Abroad. A Havlo service</p>
      </footer>

      {/* ── All Homes Modal ───────────────────────────── */}
      {allHomes && (
        <AllHomesModal
          source={allHomes.source}
          title={allHomes.title}
          onClose={() => setAllHomes(null)}
          isFav={isFavorite}
          onToggleFav={handleToggleFav}
        />
      )}
    </div>
  );
};

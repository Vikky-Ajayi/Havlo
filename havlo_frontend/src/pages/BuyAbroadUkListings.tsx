import React, { useCallback, useEffect, useState } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';

const WHATSAPP_NUMBER = '2349039861006';

const CITIES = [
  'London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol',
  'Liverpool', 'Sheffield', 'Edinburgh', 'Glasgow', 'Nottingham',
];

const PRICE_RANGES = [
  { label: 'Any price', min: undefined, max: undefined },
  { label: 'Under £200,000', min: undefined, max: 200000 },
  { label: '£200,000 – £350,000', min: 200000, max: 350000 },
  { label: '£350,000 – £500,000', min: 350000, max: 500000 },
  { label: '£500,000 – £1,000,000', min: 500000, max: 1000000 },
  { label: '£1,000,000+', min: 1000000, max: undefined },
];

const BEDS_OPTIONS = [
  { label: 'Any beds', value: undefined },
  { label: '1+ bed', value: 1 },
  { label: '2+ beds', value: 2 },
  { label: '3+ beds', value: 3 },
  { label: '4+ beds', value: 4 },
];

interface Listing {
  id: string;
  rightmove_id: string;
  url: string;
  title: string;
  price_gbp: number;
  price_ngn: number;
  ngn_rate: number;
  address: string;
  city: string;
  bedrooms: number;
  bathrooms: number | null;
  property_type: string;
  description: string;
  images: string[];
}

interface ListingsResponse {
  total: number;
  page: number;
  per_page: number;
  pages: number;
  ngn_rate: number;
  listings: Listing[];
}

function formatGbp(amount: number): string {
  return '£' + amount.toLocaleString('en-GB');
}

function formatNgn(amount: number): string {
  if (amount >= 1_000_000_000) {
    return '₦' + (amount / 1_000_000_000).toFixed(2) + 'bn';
  }
  if (amount >= 1_000_000) {
    return '₦' + (amount / 1_000_000).toFixed(1) + 'm';
  }
  return '₦' + amount.toLocaleString('en-NG');
}

function PropertyCard({ listing }: { listing: Listing }) {
  const img = listing.images[0] || '';
  const detailUrl = `/buyabroad/uk/listings/${listing.rightmove_id}`;

  return (
    <article className="bal-card">
      <a href={detailUrl} className="bal-card-img-wrap" tabIndex={-1} aria-hidden="true">
        {img ? (
          <img src={img} alt={listing.title} loading="lazy" />
        ) : (
          <div className="bal-card-no-img">
            <span>No image</span>
          </div>
        )}
        <span className="bal-card-type">{listing.property_type || 'Property'}</span>
      </a>
      <div className="bal-card-body">
        <div className="bal-card-prices">
          <span className="bal-card-gbp">{formatGbp(listing.price_gbp)}</span>
          <span className="bal-card-ngn">{formatNgn(listing.price_ngn)} NGN</span>
        </div>
        <p className="bal-card-address">{listing.address}</p>
        <div className="bal-card-meta">
          {listing.bedrooms > 0 && (
            <span>🛏 {listing.bedrooms} {listing.bedrooms === 1 ? 'bed' : 'beds'}</span>
          )}
          {listing.bathrooms != null && listing.bathrooms > 0 && (
            <span>🚿 {listing.bathrooms} {listing.bathrooms === 1 ? 'bath' : 'baths'}</span>
          )}
          <span>📍 {listing.city}</span>
        </div>
        <div className="bal-card-actions">
          <a className="bal-card-enquire" href={detailUrl}>
            Get a Free Consultation
          </a>
          <a
            className="bal-card-view"
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Rightmove ↗
          </a>
        </div>
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <article className="bal-card bal-card-skeleton">
      <div className="bal-card-img-wrap bal-skeleton-img" />
      <div className="bal-card-body">
        <div className="bal-skel bal-skel-price" />
        <div className="bal-skel bal-skel-addr" />
        <div className="bal-skel bal-skel-meta" />
        <div className="bal-skel bal-skel-btn" />
      </div>
    </article>
  );
}

export const BuyAbroadUkListings: React.FC = () => {
  usePageMeta({
    title: 'UK Property Listings | Havlo Buy Abroad',
    description: 'Browse live UK property listings for Nigerian buyers. See GBP and NGN prices side-by-side. Enquire directly via WhatsApp.',
    canonical: 'https://www.heyhavlo.com/buyabroad/uk/listings',
  });

  const [city, setCity] = useState('');
  const [priceIdx, setPriceIdx] = useState(0);
  const [bedsIdx, setBedsIdx] = useState(0);
  const [page, setPage] = useState(1);

  const [data, setData] = useState<ListingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scrapeStatus, setScrapeStatus] = useState<'idle' | 'scraping' | 'done'>('idle');

  const priceRange = PRICE_RANGES[priceIdx];
  const minBeds = BEDS_OPTIONS[bedsIdx].value;

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('per_page', '12');
      if (city) params.set('city', city);
      if (priceRange.min != null) params.set('min_price', String(priceRange.min));
      if (priceRange.max != null) params.set('max_price', String(priceRange.max));
      if (minBeds != null) params.set('min_beds', String(minBeds));

      const resp = await fetch(`/api/v1/listings/?${params}`);
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        console.error(`[listings] HTTP ${resp.status}:`, body);
        throw new Error(`HTTP ${resp.status}`);
      }
      const json: ListingsResponse = await resp.json();
      setData(json);
    } catch (err) {
      console.error('[listings] fetch error:', err);
      setError('Could not load listings. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, [city, priceRange.min, priceRange.max, minBeds, page]);

  useEffect(() => {
    void fetchListings();
  }, [fetchListings]);

  const handleFilterChange = () => {
    setPage(1);
  };

  const triggerScrape = async () => {
    if (scrapeStatus === 'scraping') return;
    setScrapeStatus('scraping');
    try {
      await fetch('/api/v1/listings/scrape', { method: 'POST' });
      setTimeout(() => {
        setScrapeStatus('done');
        void fetchListings();
      }, 5000);
    } catch {
      setScrapeStatus('idle');
    }
  };

  const isEmpty = !loading && data && data.listings.length === 0;
  const hasData = data && data.listings.length > 0;

  return (
    <div className="bal-page">
      <style>{`
        .bal-page { font-family: Inter, sans-serif; background: #fafafa; min-height: 100vh; }

        /* ── Header ── */
        .bal-header {
          position: sticky; top: 0; z-index: 100;
          height: 80px; background: #fff;
          border-bottom: 1px solid #eee;
          display: flex; align-items: center;
          padding: 0 max(60px, calc((100vw - 1240px) / 2));
        }
        .bal-logo {
          display: inline-flex; flex-direction: column; align-items: center;
          text-decoration: none; color: #111; line-height: 1; flex-shrink: 0;
        }
        .bal-logo img { width: 136px; height: auto; display: block; }
        .bal-logo span { margin-top: 2px; font-size: 14px; font-weight: 400; color: #555; }
        .bal-header-spacer { flex: 1; }
        .bal-header-back {
          font-size: 13px; font-weight: 700; color: #111;
          text-decoration: none;
          border: 1.5px solid #e0e0e0;
          border-radius: 10px; padding: 9px 18px;
          transition: border-color .15s; white-space: nowrap;
        }
        .bal-header-back:hover { border-color: #b100df; color: #b100df; }
        .bal-header-cta {
          display: inline-flex; align-items: center; justify-content: center;
          height: 48px; border: 0; border-radius: 12px;
          padding: 0 22px; margin-left: 12px;
          background: #050505; color: #fff;
          font-weight: 800; font-size: 13px; cursor: pointer; white-space: nowrap;
          text-decoration: none;
        }
        .bal-header-cta:hover { background: #b100df; }

        /* ── Hero ── */
        .bal-hero {
          background: linear-gradient(90deg, #fff 0%, #fff 45%, #ffd3f2 100%);
          color: #1f1f1e;
          padding: 80px max(60px, calc((100vw - 1240px) / 2)) 72px;
        }
        .bal-hero-inner {
          max-width: 1240px; margin: 0 auto;
          display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 480px);
          gap: 42px; align-items: center;
        }
        .bal-hero-eyebrow {
          color: #b100df; font-family: "Plus Jakarta Sans", Inter, sans-serif;
          font-size: 13px; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; margin-bottom: 16px;
        }
        .bal-hero h1 {
          font-family: "Plus Jakarta Sans", Inter, sans-serif;
          font-size: clamp(32px, 4vw, 52px); font-weight: 800;
          letter-spacing: -0.03em; line-height: 1.12;
          margin: 0 0 16px; color: #111;
        }
        .bal-hero h1 span { color: #b100df; }
        .bal-hero-copy > p {
          font-size: clamp(14px, 1.4vw, 16px); line-height: 1.55;
          color: #444; margin: 0 0 28px; max-width: 440px;
        }
        .bal-hero-cta {
          display: inline-block; height: 48px; line-height: 48px;
          border: 0; border-radius: 12px;
          background: #050505; color: #fff; padding: 0 28px;
          font-weight: 900; font-size: 15px; cursor: pointer;
          margin-bottom: 28px; text-decoration: none; transition: background .15s;
        }
        .bal-hero-cta:hover { background: #b100df; }
        .bal-hero-trust { display: flex; align-items: center; gap: 12px; font-size: 14px; }
        .bal-hero-stars { color: #fff; background: #00b67a; letter-spacing: 2px; padding: 4px 6px; font-size: 16px; line-height: 1; }
        .bal-hero-card {
          background: #fff; border: 3px solid #050505;
          border-radius: 16px; padding: 28px 24px;
          box-shadow: 6px 6px 0 #000;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: 340px;
        }
        .bal-hero-svg { width: 100%; max-width: 360px; }
        .bal-hero-card-chips {
          display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 20px;
        }
        .bal-hero-card-chip {
          background: #f3f4f6; border-radius: 999px; padding: 5px 14px;
          font-size: 12px; font-weight: 700; color: #333; border: 1px solid #e8e8e8;
        }

        /* ── Filter bar ── */
        .bal-filters {
          background: #fff;
          border-bottom: 1px solid #e8e9ec;
          padding: 18px clamp(20px, 5vw, 60px);
        }
        .bal-filters-inner {
          max-width: 1240px; margin: 0 auto;
          display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
        }
        .bal-filter-label { font-size: 13px; font-weight: 700; color: #555; flex-shrink: 0; }
        .bal-filter-select {
          height: 40px; border: 1.5px solid #e0e0e0; border-radius: 9px;
          padding: 0 14px; font-size: 14px; font-family: Inter, sans-serif;
          background: #fff; color: #111; cursor: pointer; outline: none;
          min-width: 160px;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 32px;
        }
        .bal-filter-select:focus { border-color: #b100df; }
        .bal-filter-spacer { flex: 1; }
        .bal-filter-count {
          font-size: 13px; color: #888; font-weight: 500; flex-shrink: 0;
        }

        /* ── Main content ── */
        .bal-main {
          max-width: 1240px; margin: 0 auto;
          padding: 32px clamp(20px, 5vw, 60px) 64px;
        }

        /* ── Rate bar ── */
        .bal-rate-bar {
          background: #f0fdf4; border: 1px solid #bbf7d0;
          border-radius: 10px; padding: 10px 18px;
          font-size: 13px; color: #166534;
          margin-bottom: 24px;
          display: flex; align-items: center; gap: 8px;
        }
        .bal-rate-bar strong { font-weight: 700; }

        /* ── Grid ── */
        .bal-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        /* ── Card ── */
        .bal-card {
          background: #fff;
          border: 1px solid #e6e6e6;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,.05);
          transition: box-shadow .2s, transform .2s;
          display: flex; flex-direction: column;
        }
        .bal-card:hover {
          box-shadow: 0 6px 24px rgba(0,0,0,.10);
          transform: translateY(-2px);
        }
        .bal-card-img-wrap {
          position: relative; height: 200px; overflow: hidden;
          background: #f3f4f6; flex-shrink: 0;
        }
        .bal-card-img-wrap img {
          width: 100%; height: 100%; object-fit: cover;
          display: block; transition: transform .3s;
        }
        .bal-card:hover .bal-card-img-wrap img { transform: scale(1.04); }
        .bal-card-no-img {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          color: #bbb; font-size: 14px;
        }
        .bal-card-type {
          position: absolute; top: 12px; left: 12px;
          background: rgba(0,0,0,.65); color: #fff;
          font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 4px 10px; border-radius: 999px;
        }
        .bal-card-body {
          padding: 18px 20px 20px;
          display: flex; flex-direction: column; flex: 1;
        }
        .bal-card-prices {
          display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .bal-card-gbp {
          font-family: "Plus Jakarta Sans", Inter, sans-serif;
          font-size: 22px; font-weight: 800;
          letter-spacing: -0.03em; color: #111;
        }
        .bal-card-ngn {
          font-size: 13px; font-weight: 600; color: #16a34a;
          background: #f0fdf4; border-radius: 6px;
          padding: 3px 8px;
        }
        .bal-card-address {
          font-size: 13px; color: #555; margin: 0 0 10px;
          line-height: 1.4;
        }
        .bal-card-meta {
          display: flex; flex-wrap: wrap; gap: 10px;
          font-size: 12px; color: #666; margin-bottom: 14px;
        }
        .bal-card-meta span { white-space: nowrap; }
        .bal-card-actions {
          display: flex; flex-direction: column; gap: 8px; margin-top: auto;
        }
        .bal-card-enquire {
          display: block; text-align: center;
          background: #111; color: #fff;
          border-radius: 10px; padding: 10px 16px;
          font-size: 13px; font-weight: 700;
          text-decoration: none; letter-spacing: 0.02em;
          transition: background .15s;
        }
        .bal-card-enquire:hover { background: #b100df; }
        .bal-card-view {
          display: block; text-align: center;
          color: #555; font-size: 12px; font-weight: 600;
          text-decoration: none; padding: 4px;
        }
        .bal-card-view:hover { color: #b100df; }

        /* ── Skeleton ── */
        .bal-card-skeleton { pointer-events: none; }
        .bal-skeleton-img { background: #eaeaea; animation: bal-pulse 1.4s infinite; }
        .bal-skel {
          background: #eaeaea; border-radius: 6px;
          animation: bal-pulse 1.4s infinite; margin-bottom: 10px;
        }
        .bal-skel-price { height: 24px; width: 55%; }
        .bal-skel-addr { height: 14px; width: 85%; }
        .bal-skel-meta { height: 12px; width: 65%; }
        .bal-skel-btn { height: 40px; width: 100%; border-radius: 10px; margin-top: 14px; }
        @keyframes bal-pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }

        /* ── Empty / error states ── */
        .bal-empty {
          text-align: center; padding: 80px 20px;
        }
        .bal-empty-icon { font-size: 48px; margin-bottom: 16px; }
        .bal-empty h3 {
          font-family: "Plus Jakarta Sans", Inter, sans-serif;
          font-size: 24px; font-weight: 700; margin: 0 0 10px; color: #111;
        }
        .bal-empty p { color: #666; font-size: 15px; max-width: 400px; margin: 0 auto 24px; line-height: 1.5; }
        .bal-empty-cta {
          display: inline-block;
          background: #b100df; color: #fff;
          border-radius: 10px; padding: 12px 28px;
          font-size: 14px; font-weight: 700;
          text-decoration: none;
          cursor: pointer; border: 0;
        }
        .bal-scrape-note {
          font-size: 12px; color: #aaa; margin-top: 12px;
        }

        /* ── Pagination ── */
        .bal-pagination {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; margin-top: 48px;
        }
        .bal-page-btn {
          height: 38px; min-width: 38px; padding: 0 14px;
          border: 1.5px solid #e0e0e0; border-radius: 9px;
          background: #fff; font-size: 14px; font-weight: 600;
          cursor: pointer; color: #111; transition: all .15s;
        }
        .bal-page-btn:hover:not(:disabled) { border-color: #b100df; color: #b100df; }
        .bal-page-btn.active { background: #b100df; border-color: #b100df; color: #fff; }
        .bal-page-btn:disabled { opacity: .35; cursor: default; }

        /* ── Whatsapp strip ── */
        .bal-wa-strip {
          background: #050807; color: #fff;
          padding: 48px clamp(20px, 5vw, 60px);
          text-align: center;
        }
        .bal-wa-strip h2 {
          font-family: "Plus Jakarta Sans", Inter, sans-serif;
          font-size: clamp(24px, 4vw, 38px);
          font-weight: 700; letter-spacing: -0.03em; margin: 0 0 14px;
        }
        .bal-wa-strip p { color: #ccc; font-size: 15px; margin: 0 0 28px; }
        .bal-wa-btn {
          display: inline-flex; align-items: center; gap: 10px;
          background: #25d366; color: #fff;
          border-radius: 10px; padding: 14px 32px;
          font-size: 15px; font-weight: 700; text-decoration: none;
          transition: opacity .15s;
        }
        .bal-wa-btn:hover { opacity: .88; }

        /* ── Footer ── */
        .bal-footer {
          padding: 24px clamp(20px, 5vw, 60px);
          border-top: 1px solid #e8e9ec;
          display: flex; align-items: center; justify-content: space-between;
          gap: 24px; flex-wrap: wrap;
        }
        .bal-footer p { font-size: 13px; color: #888; margin: 0; }
        .bal-footer nav { display: flex; gap: 24px; }
        .bal-footer a { font-size: 13px; font-weight: 700; color: #111; text-decoration: none; }
        .bal-footer a:hover { color: #b100df; }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .bal-grid { grid-template-columns: repeat(2, 1fr); }
          .bal-hero-inner { grid-template-columns: 1fr; }
          .bal-hero-card { display: flex; max-width: 480px; margin: 0 auto; }
          .bal-hero { padding: 56px 40px 48px; background: #fff; }
        }
        @media (max-width: 640px) {
          .bal-grid { grid-template-columns: 1fr; }
          .bal-hero h1 { font-size: 28px; }
          .bal-hero { padding: 48px 24px 40px; background: #fff; }
          .bal-hero-card { max-width: 100%; }
          .bal-filter-select { min-width: 130px; font-size: 13px; }
          .bal-header-cta { display: none; }
          .bal-header { padding: 0 20px; }
          .bal-footer { flex-direction: column; text-align: center; }
          .bal-footer nav { justify-content: center; }
        }
      `}</style>

      {/* Header */}
      <header className="bal-header">
        <a href="/buyabroad/uk" className="bal-logo" aria-label="Buy Abroad UK">
          <img src="/Havlo Black Transparent.png" alt="Havlo" />
          <span>Buy Abroad</span>
        </a>
        <div className="bal-header-spacer" />
        <a href="/buyabroad/uk" className="bal-header-back">← Back to Buy Abroad</a>
        <a
          className="bal-header-cta"
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi Havlo, I would like a free consultation about buying UK property.')}`}
          target="_blank" rel="noopener noreferrer"
        >
          Free Consultation
        </a>
      </header>

      {/* Hero */}
      <section className="bal-hero">
        <div className="bal-hero-inner">
          <div className="bal-hero-copy">
            <div className="bal-hero-eyebrow">Live UK Property Listings</div>
            <h1>Browse UK Properties<br />in <span>Pounds & Naira</span></h1>
            <p>Real Rightmove listings — every price shown in both GBP and NGN so Nigerian buyers always know exactly what they're buying.</p>
            <a className="bal-hero-cta" href="#bal-listings">Browse Listings →</a>
            <div className="bal-hero-trust">
              <strong>Excellent</strong>
              <span className="bal-hero-stars">★★★★★</span>
              <b>Based on verified customer feedback</b>
            </div>
          </div>
          <aside className="bal-hero-card" aria-label="UK property illustration">
            <svg className="bal-hero-svg" viewBox="0 0 360 240" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Sky */}
              <rect width="360" height="240" fill="#fdf4ff" rx="12"/>
              {/* Clouds */}
              <ellipse cx="60" cy="40" rx="30" ry="14" fill="#fff" opacity=".7"/>
              <ellipse cx="85" cy="34" rx="22" ry="14" fill="#fff" opacity=".7"/>
              <ellipse cx="290" cy="30" rx="26" ry="12" fill="#fff" opacity=".6"/>
              <ellipse cx="312" cy="24" rx="18" ry="12" fill="#fff" opacity=".6"/>

              {/* Left house */}
              <rect x="28" y="140" width="88" height="84" fill="#f3e8ff" stroke="#111" strokeWidth="1.5"/>
              <polygon points="16,140 72,95 128,140" fill="#b100df" stroke="#111" strokeWidth="1.5"/>
              <rect x="46" y="162" width="24" height="22" rx="2" fill="#e9d5ff" stroke="#111" strokeWidth="1"/>
              <rect x="82" y="162" width="24" height="22" rx="2" fill="#e9d5ff" stroke="#111" strokeWidth="1"/>
              <rect x="54" y="194" width="20" height="30" rx="4" fill="#7c3aed"/>
              <rect x="44" y="98" width="12" height="28" fill="#9333ea" stroke="#111" strokeWidth="1"/>

              {/* Centre house (tallest) */}
              <rect x="130" y="118" width="100" height="106" fill="#fff" stroke="#111" strokeWidth="1.5"/>
              <polygon points="118,118 180,68 242,118" fill="#7c3aed" stroke="#111" strokeWidth="1.5"/>
              <rect x="148" y="140" width="28" height="24" rx="2" fill="#ede9fe" stroke="#111" strokeWidth="1"/>
              <line x1="162" y1="140" x2="162" y2="164" stroke="#111" strokeWidth="1"/>
              <line x1="148" y1="152" x2="176" y2="152" stroke="#111" strokeWidth="1"/>
              <rect x="184" y="140" width="28" height="24" rx="2" fill="#ede9fe" stroke="#111" strokeWidth="1"/>
              <line x1="198" y1="140" x2="198" y2="164" stroke="#111" strokeWidth="1"/>
              <line x1="184" y1="152" x2="212" y2="152" stroke="#111" strokeWidth="1"/>
              <rect x="162" y="184" width="36" height="40" rx="6" fill="#111"/>
              <circle cx="195" cy="205" r="3" fill="#fbbf24"/>
              <rect x="156" y="72" width="16" height="36" fill="#6d28d9" stroke="#111" strokeWidth="1.5"/>

              {/* Right house */}
              <rect x="244" y="148" width="88" height="76" fill="#f3e8ff" stroke="#111" strokeWidth="1.5"/>
              <polygon points="232,148 288,106 344,148" fill="#b100df" stroke="#111" strokeWidth="1.5"/>
              <rect x="258" y="168" width="24" height="20" rx="2" fill="#e9d5ff" stroke="#111" strokeWidth="1"/>
              <rect x="294" y="168" width="24" height="20" rx="2" fill="#e9d5ff" stroke="#111" strokeWidth="1"/>
              <rect x="268" y="196" width="20" height="28" rx="4" fill="#7c3aed"/>
              <rect x="282" y="110" width="12" height="26" fill="#9333ea" stroke="#111" strokeWidth="1"/>

              {/* Ground */}
              <rect x="0" y="224" width="360" height="16" fill="#d1fae5"/>
              <rect x="0" y="220" width="360" height="6" fill="#a7f3d0"/>

              {/* GBP price badge */}
              <rect x="12" y="12" width="86" height="28" rx="14" fill="#111"/>
              <text x="55" y="30" fill="white" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="Inter, sans-serif">£ GBP Listed</text>

              {/* NGN price badge */}
              <rect x="262" y="12" width="86" height="28" rx="14" fill="#b100df"/>
              <text x="305" y="30" fill="white" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="Inter, sans-serif">₦ NGN Prices</text>
            </svg>
            <div className="bal-hero-card-chips">
              <span className="bal-hero-card-chip">🇬🇧 UK Properties</span>
              <span className="bal-hero-card-chip">₦ NGN Shown</span>
              <span className="bal-hero-card-chip">💬 WhatsApp Support</span>
              <span className="bal-hero-card-chip">No Viewing Trip</span>
            </div>
          </aside>
        </div>
      </section>

      {/* Filters */}
      <div className="bal-filters">
        <div className="bal-filters-inner">
          <span className="bal-filter-label">Filter:</span>

          <select
            className="bal-filter-select"
            value={city}
            onChange={(e) => { setCity(e.target.value); handleFilterChange(); }}
            aria-label="Filter by city"
          >
            <option value="">All cities</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            className="bal-filter-select"
            value={priceIdx}
            onChange={(e) => { setPriceIdx(Number(e.target.value)); handleFilterChange(); }}
            aria-label="Filter by price"
          >
            {PRICE_RANGES.map((r, i) => (
              <option key={i} value={i}>{r.label}</option>
            ))}
          </select>

          <select
            className="bal-filter-select"
            value={bedsIdx}
            onChange={(e) => { setBedsIdx(Number(e.target.value)); handleFilterChange(); }}
            aria-label="Filter by bedrooms"
          >
            {BEDS_OPTIONS.map((b, i) => (
              <option key={i} value={i}>{b.label}</option>
            ))}
          </select>

          <div className="bal-filter-spacer" />
          {data && !loading && (
            <span className="bal-filter-count">
              {data.total.toLocaleString()} {data.total === 1 ? 'property' : 'properties'}
            </span>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="bal-main" id="bal-listings">
        {/* Rate bar removed per design update */}

        {/* Error state */}
        {error && (
          <div className="bal-empty">
            <div className="bal-empty-icon">⚠️</div>
            <h3>Something went wrong</h3>
            <p>{error}</p>
            <button className="bal-empty-cta" onClick={() => void fetchListings()}>Try again</button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div className="bal-grid">
            {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && !error && (
          <div className="bal-empty">
            <div className="bal-empty-icon">🏠</div>
            <h3>No listings yet</h3>
            <p>
              Our system is currently scraping Rightmove for fresh properties.
              Check back in a few minutes, or reach out via WhatsApp and we'll
              find you the right property manually.
            </p>
            <a
              className="bal-empty-cta"
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi Havlo, I am looking for UK properties to buy. Can you help?')}`}
              target="_blank" rel="noopener noreferrer"
            >
              Chat on WhatsApp
            </a>
            <p className="bal-scrape-note">
              Listings refresh every 6 hours automatically.
              {scrapeStatus === 'idle' && (
                <> <button
                  style={{ background: 'none', border: 'none', color: '#b100df', cursor: 'pointer', fontSize: 'inherit', fontWeight: 700, padding: 0 }}
                  onClick={() => void triggerScrape()}
                >Refresh now →</button></>
              )}
              {scrapeStatus === 'scraping' && <> Refreshing…</>}
              {scrapeStatus === 'done' && <> Refresh complete.</>}
            </p>
          </div>
        )}

        {/* Listings grid */}
        {hasData && !loading && (
          <div className="bal-grid">
            {data.listings.map((listing) => (
              <PropertyCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.pages > 1 && !loading && (
          <div className="bal-pagination">
            <button
              className="bal-page-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ←
            </button>
            {Array.from({ length: Math.min(7, data.pages) }, (_, i) => {
              const p = page <= 4
                ? i + 1
                : page >= data.pages - 3
                  ? data.pages - 6 + i
                  : page - 3 + i;
              if (p < 1 || p > data.pages) return null;
              return (
                <button
                  key={p}
                  className={`bal-page-btn${page === p ? ' active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              );
            })}
            <button
              className="bal-page-btn"
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={page === data.pages}
            >
              →
            </button>
          </div>
        )}
      </main>

      {/* WhatsApp CTA strip */}
      <section className="bal-wa-strip">
        <h2>Can't find what you're looking for?</h2>
        <p>Our advisors source off-market and exclusive properties not listed on any portal. Tell us what you want and we'll find it.</p>
        <a
          className="bal-wa-btn"
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi Havlo, I am looking for UK property and would like your help finding something specific.')}`}
          target="_blank" rel="noopener noreferrer"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Chat on WhatsApp
        </a>
      </section>

      {/* Footer */}
      <footer className="bal-footer">
        <p>© {new Date().getFullYear()} Havlo. Property prices sourced from Rightmove. NGN prices are indicative only.</p>
        <nav>
          <a href="/buyabroad/uk">Buy Abroad UK</a>
          <a href="/privacy-policy">Privacy</a>
          <a href="/terms-of-use">Terms</a>
        </nav>
      </footer>
    </div>
  );
};

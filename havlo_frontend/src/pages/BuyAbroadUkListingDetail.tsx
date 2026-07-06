import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { api } from '../lib/api';

const WHATSAPP_NUMBER = '2349039861006';

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
  region: string;
  bedrooms: number;
  bathrooms: number | null;
  property_type: string;
  description: string;
  images: string[];
  scraped_at: string | null;
}

function upgradeImageUrl(url: string): string {
  // Try Rightmove's larger 656x437 preset; Gallery falls back on error
  return url.replace(/_max_476x317(\.\w+)$/, '_max_656x437$1');
}

function formatGbp(n: number) {
  return '£' + n.toLocaleString('en-GB');
}
function formatNgn(n: number) {
  if (n >= 1_000_000_000) return '₦' + (n / 1_000_000_000).toFixed(2) + 'bn';
  if (n >= 1_000_000) return '₦' + (n / 1_000_000).toFixed(1) + 'm';
  return '₦' + n.toLocaleString('en-NG');
}

// ── Consultation Modal ─────────────────────────────────────────────────────────
interface ConsultModalProps {
  listing: Listing;
  onClose: () => void;
}
function ConsultModal({ listing, onClose }: ConsultModalProps) {
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const firstName = useMemo(() => fullName.trim().split(/\s+/)[0] || 'Buyer', [fullName]);
  const lastName = useMemo(() => fullName.trim().split(/\s+/).slice(1).join(' ') || 'Lead', [fullName]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.submitContactForm({
        first_name: firstName,
        last_name: lastName,
        email,
        phone_country_code: '+234',
        phone_number: whatsapp,
        country_of_residence: 'Nigeria',
        message: [
          'Buy Abroad UK — Free Consultation Request',
          `Interested in property: ${listing.title}`,
          `Address: ${listing.address}`,
          `Price: £${listing.price_gbp.toLocaleString()} (${formatNgn(listing.price_ngn)} NGN)`,
          `Bedrooms: ${listing.bedrooms}`,
          `Rightmove URL: ${listing.url}`,
          `WhatsApp: ${whatsapp}`,
          `Source: /buyabroad/uk/listings/${listing.rightmove_id}`,
        ].join('\n'),
      });
    } catch {
      // non-fatal
    } finally {
      setSubmitting(false);
      setDone(true);
    }
  };

  const waMsg = encodeURIComponent(
    `Hi Havlo, I requested a free consultation about ${listing.title} at ${listing.address} (£${listing.price_gbp.toLocaleString()}). My name is ${fullName || 'a buyer'}.`
  );

  return (
    <div className="bld-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bld-modal-card" role="dialog" aria-modal="true" aria-label="Free consultation">
        <button className="bld-modal-close" onClick={onClose} aria-label="Close">✕</button>

        {done ? (
          <div className="bld-modal-success">
            <div className="bld-success-icon">🎉</div>
            <h3>You're all set, {firstName}!</h3>
            <p>Our advisors have received your details and will be in touch on WhatsApp shortly.</p>
            <a
              className="bld-modal-wa-btn"
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waMsg}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Chat on WhatsApp now
            </a>
            <p className="bld-secure">🔒 Your details are confidential. No spam, ever.</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="bld-modal-head">
              <h2>Enter your details and we'll be in touch on WhatsApp</h2>
            </div>
            <div className="bld-modal-divider" />

            <label className="bld-field">
              <span>Your full name</span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Select"
                required
              />
            </label>

            <label className="bld-field">
              <span>WhatsApp number</span>
              <div className="bld-phone-wrap">
                <span className="bld-flag-badge">🇳🇬 NG</span>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="000 000 000 00"
                  required
                />
              </div>
            </label>

            <label className="bld-field">
              <span>Email address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g johndoe@email.com"
                required
              />
            </label>

            <div className="bld-modal-spacer" />

            <button className="bld-modal-submit" type="submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Continue →'}
            </button>
            <button className="bld-modal-back" type="button" onClick={onClose}>← Back</button>
            <p className="bld-secure">🔒 Your details are confidential. No spam, ever.</p>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Mortgage Calculator ────────────────────────────────────────────────────────
function MortgageCalc({ priceGbp, ngnRate }: { priceGbp: number; ngnRate: number }) {
  const [deposit, setDeposit] = useState(25);
  const [term, setTerm] = useState(25);
  const RATE = 0.07; // 7% p.a. typical non-resident UK mortgage

  const loanGbp = priceGbp * (1 - deposit / 100);
  const monthlyRate = RATE / 12;
  const n = term * 12;
  const monthlyGbp = loanGbp * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
  const totalGbp = monthlyGbp * n;
  const interestGbp = totalGbp - loanGbp;

  return (
    <div className="bld-calc">
      <h3 className="bld-calc-title">Mortgage Calculator</h3>
      <p className="bld-calc-sub">Based on a 7% p.a. non-resident UK mortgage rate</p>

      <div className="bld-calc-row">
        <label>Deposit: <strong>{deposit}%</strong> ({formatGbp(Math.round(priceGbp * deposit / 100))})</label>
        <input
          type="range" min={10} max={50} step={5}
          value={deposit}
          onChange={(e) => setDeposit(Number(e.target.value))}
          className="bld-slider"
        />
        <div className="bld-slider-labels"><span>10%</span><span>50%</span></div>
      </div>

      <div className="bld-calc-row">
        <label>Loan term: <strong>{term} years</strong></label>
        <input
          type="range" min={5} max={30} step={5}
          value={term}
          onChange={(e) => setTerm(Number(e.target.value))}
          className="bld-slider"
        />
        <div className="bld-slider-labels"><span>5 yrs</span><span>30 yrs</span></div>
      </div>

      <div className="bld-calc-results">
        <div className="bld-calc-result-item">
          <span className="bld-calc-label">Monthly payment</span>
          <span className="bld-calc-gbp">{formatGbp(Math.round(monthlyGbp))}<span>/mo</span></span>
          <span className="bld-calc-ngn">{formatNgn(Math.round(monthlyGbp * ngnRate))}/mo</span>
        </div>
        <div className="bld-calc-result-item">
          <span className="bld-calc-label">Loan amount</span>
          <span className="bld-calc-gbp">{formatGbp(Math.round(loanGbp))}</span>
          <span className="bld-calc-ngn">{formatNgn(Math.round(loanGbp * ngnRate))}</span>
        </div>
        <div className="bld-calc-result-item">
          <span className="bld-calc-label">Total interest</span>
          <span className="bld-calc-gbp">{formatGbp(Math.round(interestGbp))}</span>
          <span className="bld-calc-ngn">{formatNgn(Math.round(interestGbp * ngnRate))}</span>
        </div>
      </div>
      <p className="bld-calc-disc">Indicative only. Actual rates vary by lender. We connect you with specialist non-resident mortgage brokers.</p>
    </div>
  );
}

// ── Image Gallery ──────────────────────────────────────────────────────────────
function Gallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  // Upgraded URLs for main display; originals kept for fallback
  const upgraded = images.length > 0 ? images.map(upgradeImageUrl) : [];
  const original = images;
  const all = upgraded;

  // Fallback: if upgraded URL 404s, swap back to original
  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>, idx: number) => {
    const el = e.currentTarget;
    if (original[idx] && el.src !== original[idx]) {
      el.src = original[idx];
    }
  };

  if (all.length === 0) {
    return (
      <div className="bld-gallery-empty">
        <span>No images available</span>
      </div>
    );
  }

  return (
    <div className="bld-gallery">
      <div className="bld-gallery-main">
        <img
          src={all[active]}
          alt={title}
          onError={(e) => handleImgError(e, active)}
        />
        {all.length > 1 && (
          <>
            <button
              className="bld-gallery-arrow bld-gallery-prev"
              onClick={() => setActive((a) => (a - 1 + all.length) % all.length)}
              aria-label="Previous image"
            >‹</button>
            <button
              className="bld-gallery-arrow bld-gallery-next"
              onClick={() => setActive((a) => (a + 1) % all.length)}
              aria-label="Next image"
            >›</button>
            <div className="bld-gallery-counter">{active + 1} / {all.length}</div>
          </>
        )}
      </div>
      {all.length > 1 && (
        <div className="bld-gallery-thumbs">
          {all.slice(0, 8).map((src, i) => (
            <button
              key={i}
              className={`bld-thumb${i === active ? ' bld-thumb-active' : ''}`}
              onClick={() => setActive(i)}
              aria-label={`Image ${i + 1}`}
            >
              <img src={src} alt="" loading="lazy" onError={(e) => handleImgError(e, i)} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export const BuyAbroadUkListingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [consultOpen, setConsultOpen] = useState(false);

  usePageMeta({
    title: listing ? `${listing.title} | Havlo Buy Abroad` : 'Property Details | Havlo Buy Abroad',
    description: listing ? `${listing.address} — ${formatGbp(listing.price_gbp)} — View full details and enquire via WhatsApp.` : '',
    canonical: `https://www.heyhavlo.com/buyabroad/uk/listings/${id ?? ''}`,
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/v1/listings/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json() as Promise<Listing>;
      })
      .then(setListing)
      .catch(() => setError('This listing could not be found.'))
      .finally(() => setLoading(false));
  }, [id]);

  // Lock body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = consultOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [consultOpen]);

  return (
    <div className="bld-page">
      <style>{`
        .bld-page { font-family: Inter, sans-serif; background: #fafafa; min-height: 100vh; }

        /* Header */
        .bld-header {
          position: sticky; top: 0; z-index: 100;
          height: 72px; background: #fff;
          border-bottom: 1px solid #e8e9ec;
          display: flex; align-items: center;
          padding: 0 clamp(20px, 5vw, 60px); gap: 16px;
        }
        .bld-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; color: #111; flex-shrink: 0; }
        .bld-logo img { height: 26px; width: auto; }
        .bld-logo-sep { width: 1px; height: 18px; background: #d0d0d0; }
        .bld-logo span { font-family: "Plus Jakarta Sans", Inter, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.02em; color: #555; text-transform: uppercase; }
        .bld-header-spacer { flex: 1; }
        .bld-header-back { font-size: 13px; font-weight: 700; color: #111; text-decoration: none; border: 1.5px solid #e0e0e0; border-radius: 8px; padding: 7px 16px; transition: border-color .15s, color .15s; }
        .bld-header-back:hover { border-color: #b100df; color: #b100df; }
        .bld-header-cta { height: 38px; border: 0; border-radius: 8px; padding: 0 20px; background: #b100df; color: #fff; font-weight: 700; font-size: 13px; cursor: pointer; }

        /* Breadcrumb */
        .bld-breadcrumb { padding: 14px clamp(20px, 5vw, 60px); font-size: 13px; color: #888; }
        .bld-breadcrumb a { color: #555; text-decoration: none; font-weight: 600; }
        .bld-breadcrumb a:hover { color: #b100df; }
        .bld-breadcrumb span { margin: 0 6px; }

        /* Main layout */
        .bld-main { max-width: 1240px; margin: 0 auto; padding: 0 clamp(20px, 5vw, 60px) 80px; display: grid; grid-template-columns: 1fr 380px; gap: 40px; align-items: start; }

        /* Left column */
        .bld-left {}

        /* Gallery */
        .bld-gallery { margin-bottom: 32px; }
        .bld-gallery-main { position: relative; border-radius: 16px; overflow: hidden; background: #eee; height: 460px; }
        .bld-gallery-main img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .bld-gallery-empty { height: 300px; background: #f3f4f6; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #bbb; font-size: 15px; margin-bottom: 32px; }
        .bld-gallery-arrow { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,.55); color: #fff; border: 0; width: 42px; height: 42px; border-radius: 50%; font-size: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .15s; z-index: 2; }
        .bld-gallery-arrow:hover { background: rgba(0,0,0,.8); }
        .bld-gallery-prev { left: 14px; }
        .bld-gallery-next { right: 14px; }
        .bld-gallery-counter { position: absolute; bottom: 14px; right: 16px; background: rgba(0,0,0,.6); color: #fff; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; }
        .bld-gallery-thumbs { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
        .bld-thumb { width: 80px; height: 60px; border-radius: 8px; overflow: hidden; border: 2px solid transparent; cursor: pointer; background: none; padding: 0; transition: border-color .15s; flex-shrink: 0; }
        .bld-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .bld-thumb-active { border-color: #b100df; }

        /* Property info */
        .bld-info-section { margin-bottom: 32px; }
        .bld-info-section h2 { font-family: "Plus Jakarta Sans", Inter, sans-serif; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #111; margin: 0 0 16px; padding-bottom: 12px; border-bottom: 1px solid #eee; }
        .bld-title { font-family: "Plus Jakarta Sans", Inter, sans-serif; font-size: clamp(20px, 2.5vw, 26px); font-weight: 500; letter-spacing: -0.01em; color: #111; margin: 0 0 8px; line-height: 1.4; }
        .bld-address { font-size: 15px; color: #555; margin: 0 0 20px; }
        .bld-type-badge { display: inline-block; background: #f0f0f0; color: #444; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 4px 12px; border-radius: 999px; margin-bottom: 20px; }
        .bld-meta-chips { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 24px; }
        .bld-chip { background: #f7f7f7; border: 1px solid #e8e8e8; border-radius: 8px; padding: 8px 16px; font-size: 14px; color: #333; font-weight: 600; }
        .bld-description { font-size: 15px; line-height: 1.65; color: #444; white-space: pre-line; }

        /* Mortgage calc */
        .bld-calc { background: #fff; border: 1px solid #e6e6e6; border-radius: 16px; padding: 24px; margin-bottom: 32px; }
        .bld-calc-title { font-family: "Plus Jakarta Sans", Inter, sans-serif; font-size: 18px; font-weight: 700; margin: 0 0 4px; }
        .bld-calc-sub { font-size: 13px; color: #888; margin: 0 0 22px; }
        .bld-calc-row { margin-bottom: 18px; }
        .bld-calc-row label { display: block; font-size: 14px; font-weight: 600; color: #333; margin-bottom: 8px; }
        .bld-slider { width: 100%; accent-color: #b100df; cursor: pointer; }
        .bld-slider-labels { display: flex; justify-content: space-between; font-size: 11px; color: #aaa; margin-top: 4px; }
        .bld-calc-results { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 22px; }
        .bld-calc-result-item { background: #f7f7fc; border-radius: 10px; padding: 14px 12px; text-align: center; }
        .bld-calc-label { display: block; font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .bld-calc-gbp { display: block; font-family: "Plus Jakarta Sans", Inter, sans-serif; font-size: 18px; font-weight: 800; color: #111; }
        .bld-calc-gbp span { font-size: 12px; font-weight: 500; color: #888; }
        .bld-calc-ngn { display: block; font-size: 12px; font-weight: 600; color: #16a34a; margin-top: 3px; }
        .bld-calc-disc { font-size: 12px; color: #aaa; margin: 16px 0 0; line-height: 1.5; }

        /* Right sidebar */
        .bld-sidebar { position: sticky; top: 88px; }
        .bld-price-card { background: #fff; border: 1px solid #e6e6e6; border-radius: 18px; padding: 28px; box-shadow: 0 4px 20px rgba(0,0,0,.06); margin-bottom: 16px; }
        .bld-price-gbp { font-family: "Plus Jakarta Sans", Inter, sans-serif; font-size: 34px; font-weight: 800; letter-spacing: -0.04em; color: #111; margin-bottom: 8px; }
        .bld-price-ngn-wrap { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 10px 14px; margin-bottom: 22px; }
        .bld-price-ngn-label { font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.06em; }
        .bld-price-ngn-value { font-family: "Plus Jakarta Sans", Inter, sans-serif; font-size: 20px; font-weight: 800; color: #15803d; }
        .bld-price-rate { font-size: 11px; color: #86efac; margin-top: 2px; }
        .bld-consult-btn { width: 100%; height: 52px; border: 0; border-radius: 12px; background: #b100df; color: #fff; font-size: 15px; font-weight: 800; cursor: pointer; letter-spacing: 0.01em; margin-bottom: 10px; transition: background .15s, transform .1s; }
        .bld-consult-btn:hover { background: #9000c0; transform: translateY(-1px); }
        .bld-view-rm { display: block; text-align: center; color: #555; font-size: 13px; font-weight: 600; text-decoration: none; padding: 10px; transition: color .15s; }
        .bld-view-rm:hover { color: #b100df; }
        .bld-sidebar-secure { font-size: 12px; color: #aaa; text-align: center; margin: 8px 0 0; }
        .bld-rate-note { background: #fafafa; border: 1px solid #eee; border-radius: 12px; padding: 14px 16px; font-size: 13px; color: #666; line-height: 1.5; }
        .bld-rate-note strong { color: #111; }

        /* Skeleton / error */
        .bld-loading { text-align: center; padding: 120px 20px; }
        .bld-loading-spinner { width: 40px; height: 40px; border: 3px solid #eee; border-top-color: #b100df; border-radius: 50%; animation: bld-spin .7s linear infinite; margin: 0 auto 20px; }
        @keyframes bld-spin { to { transform: rotate(360deg); } }
        .bld-error { text-align: center; padding: 100px 20px; }
        .bld-error h2 { font-size: 24px; font-weight: 700; margin-bottom: 12px; }
        .bld-error p { color: #666; margin-bottom: 24px; }
        .bld-back-link { display: inline-block; background: #b100df; color: #fff; border-radius: 10px; padding: 12px 28px; font-size: 14px; font-weight: 700; text-decoration: none; }

        /* Consultation Modal */
        .bld-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .bld-modal-card {
          position: relative;
          background: #fff;
          border: 4px solid #000;
          border-radius: 18px;
          box-shadow: 5px 5px 0 #000;
          padding: 32px 30px 28px;
          width: 100%;
          max-width: 480px;
          max-height: 90dvh;
          overflow-y: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .bld-modal-card::-webkit-scrollbar { display: none; }
        .bld-modal-close { position: absolute; top: 14px; right: 16px; background: none; border: 0; font-size: 18px; cursor: pointer; color: #888; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background .15s; }
        .bld-modal-close:hover { background: #f0f0f0; color: #111; }
        .bld-modal-head h2 { font-family: Inter, sans-serif; font-size: 22px; font-weight: 700; line-height: 1.3; letter-spacing: -0.02em; margin: 0; color: #111; }
        .bld-modal-divider { height: 1px; background: #e0e0e0; margin: 20px 0 24px; }
        .bld-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
        .bld-field span { font-size: 14px; font-weight: 700; color: #111; }
        .bld-field input { height: 52px; border: 1.5px solid #e0e0e0; border-radius: 12px; padding: 0 16px; font-size: 15px; font-family: Inter, sans-serif; background: #f5f5f5; color: #111; outline: none; transition: border-color .15s; }
        .bld-field input:focus { border-color: #b100df; background: #fff; }
        .bld-phone-wrap { display: flex; align-items: center; gap: 0; border: 1.5px solid #e0e0e0; border-radius: 12px; background: #f5f5f5; overflow: hidden; transition: border-color .15s; }
        .bld-phone-wrap:focus-within { border-color: #b100df; background: #fff; }
        .bld-flag-badge { padding: 0 14px; height: 52px; display: flex; align-items: center; font-size: 13px; font-weight: 700; color: #333; white-space: nowrap; border-right: 1.5px solid #e0e0e0; flex-shrink: 0; gap: 4px; background: #ebebeb; }
        .bld-phone-wrap input { flex: 1; height: 52px; border: 0; background: transparent; padding: 0 14px; font-size: 15px; font-family: Inter, sans-serif; color: #111; outline: none; }
        .bld-modal-spacer { height: 32px; }
        .bld-modal-submit { width: 100%; height: 52px; border: 0; border-radius: 14px; background: #111; color: #fff; font-size: 16px; font-weight: 800; cursor: pointer; margin-bottom: 12px; transition: background .15s; letter-spacing: 0.01em; }
        .bld-modal-submit:hover:not(:disabled) { background: #b100df; }
        .bld-modal-submit:disabled { opacity: .6; cursor: default; }
        .bld-modal-back { width: 100%; background: none; border: 0; font-size: 14px; font-weight: 700; color: #555; cursor: pointer; padding: 8px; }
        .bld-modal-back:hover { color: #111; }
        .bld-secure { font-size: 12px; color: #aaa; text-align: center; margin: 10px 0 0; }
        .bld-modal-success { text-align: center; padding: 16px 0 8px; }
        .bld-success-icon { font-size: 52px; margin-bottom: 16px; }
        .bld-modal-success h3 { font-family: "Plus Jakarta Sans", Inter, sans-serif; font-size: 24px; font-weight: 700; margin: 0 0 12px; }
        .bld-modal-success p { color: #555; font-size: 15px; line-height: 1.5; margin: 0 0 24px; }
        .bld-modal-wa-btn { display: inline-flex; align-items: center; gap: 10px; background: #25d366; color: #fff; border-radius: 12px; padding: 14px 28px; font-size: 15px; font-weight: 700; text-decoration: none; }
        .bld-modal-wa-btn:hover { opacity: .88; }

        /* Footer */
        .bld-footer { padding: 24px clamp(20px, 5vw, 60px); border-top: 1px solid #e8e9ec; display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
        .bld-footer p { font-size: 13px; color: #888; margin: 0; }
        .bld-footer nav { display: flex; gap: 24px; }
        .bld-footer a { font-size: 13px; font-weight: 700; color: #111; text-decoration: none; }
        .bld-footer a:hover { color: #b100df; }

        /* Responsive */
        @media (max-width: 900px) {
          .bld-main { grid-template-columns: 1fr; gap: 0; }
          .bld-sidebar { position: static; }
          .bld-price-card { margin-top: 0; }
          .bld-gallery-main { height: 280px; }
          .bld-calc-results { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .bld-header-cta { display: none; }
          .bld-footer { flex-direction: column; text-align: center; }
          .bld-footer nav { justify-content: center; }
        }
      `}</style>

      {/* Header */}
      <header className="bld-header">
        <a href="/buyabroad/uk" className="bld-logo" aria-label="Buy Abroad UK">
          <img src="/Havlo Black Transparent.png" alt="Havlo" />
          <div className="bld-logo-sep" />
          <span>Buy Abroad</span>
        </a>
        <div className="bld-header-spacer" />
        <a href="/buyabroad/uk/listings" className="bld-header-back">← All listings</a>
        <button className="bld-header-cta" onClick={() => setConsultOpen(true)}>
          Get Free Consultation
        </button>
      </header>

      {/* Breadcrumb */}
      <nav className="bld-breadcrumb" aria-label="Breadcrumb">
        <a href="/buyabroad/uk">Buy Abroad UK</a>
        <span>›</span>
        <a href="/buyabroad/uk/listings">Listings</a>
        {listing && <><span>›</span><span style={{ color: '#111' }}>{listing.city}</span></>}
      </nav>

      {/* Loading */}
      {loading && (
        <div className="bld-loading">
          <div className="bld-loading-spinner" />
          <p style={{ color: '#888', fontSize: 15 }}>Loading property…</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bld-error">
          <h2>Property not found</h2>
          <p>{error}</p>
          <a href="/buyabroad/uk/listings" className="bld-back-link">← Back to listings</a>
        </div>
      )}

      {/* Main content */}
      {listing && !loading && (
        <main className="bld-main">
          {/* Left column */}
          <div className="bld-left">
            <Gallery images={listing.images} title={listing.title} />

            {/* Title + meta */}
            <div className="bld-info-section">
              <span className="bld-type-badge">{listing.property_type || 'Property'}</span>
              <h1 className="bld-title">{listing.title}</h1>
              <p className="bld-address">📍 {listing.address}</p>
              <div className="bld-meta-chips">
                {listing.bedrooms > 0 && (
                  <span className="bld-chip">🛏 {listing.bedrooms} {listing.bedrooms === 1 ? 'Bedroom' : 'Bedrooms'}</span>
                )}
                {listing.bathrooms != null && listing.bathrooms > 0 && (
                  <span className="bld-chip">🚿 {listing.bathrooms} {listing.bathrooms === 1 ? 'Bathroom' : 'Bathrooms'}</span>
                )}
                <span className="bld-chip">📍 {listing.city}</span>
              </div>
              {listing.description && (
                <p className="bld-description">{listing.description}</p>
              )}
            </div>

            {/* Mortgage calculator */}
            <MortgageCalc priceGbp={listing.price_gbp} ngnRate={listing.ngn_rate} />
          </div>

          {/* Right sidebar */}
          <aside className="bld-sidebar">
            <div className="bld-price-card">
              <div className="bld-price-gbp">{formatGbp(listing.price_gbp)}</div>
              <div className="bld-price-ngn-wrap">
                <div className="bld-price-ngn-label">Nigerian Naira equivalent</div>
                <div className="bld-price-ngn-value">{formatNgn(listing.price_ngn)}</div>
                <div className="bld-price-rate">at £1 = ₦{Math.round(listing.ngn_rate).toLocaleString()}</div>
              </div>

              <button className="bld-consult-btn" onClick={() => setConsultOpen(true)}>
                Get a Free Consultation
              </button>
              <a className="bld-view-rm" href={listing.url} target="_blank" rel="noopener noreferrer">
                View on Rightmove ↗
              </a>
              <p className="bld-sidebar-secure">🔒 Confidential. No spam, ever.</p>
            </div>

            <div className="bld-rate-note">
              <strong>💱 Live exchange rate</strong><br />
              £1 = ₦{Math.round(listing.ngn_rate).toLocaleString()} · Updated hourly from open.er-api.com. NGN prices are indicative only and subject to FX movements.
            </div>
          </aside>
        </main>
      )}

      {/* Footer */}
      <footer className="bld-footer">
        <p>© {new Date().getFullYear()} Havlo. Property data sourced from Rightmove. NGN prices indicative only.</p>
        <nav>
          <a href="/buyabroad/uk/listings">All Listings</a>
          <a href="/privacy-policy">Privacy</a>
          <a href="/terms-of-use">Terms</a>
        </nav>
      </footer>

      {/* Consultation modal */}
      {consultOpen && listing && (
        <ConsultModal listing={listing} onClose={() => setConsultOpen(false)} />
      )}
    </div>
  );
};

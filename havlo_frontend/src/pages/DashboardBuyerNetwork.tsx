import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Link2, Plus, RefreshCw, Sparkles, Star, X, Zap } from 'lucide-react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api, type AgentListing } from '../lib/api';
import {
  persistPendingPayment,
  redirectToCheckout,
  usePaymentReturnPoller,
} from '../lib/paymentReturn';

// ── Fee calculator (mirrors backend: 0.25% rounded up to nearest £500) ────────
function calculateFee(priceRaw: string): number | null {
  const clean = priceRaw.replace(/[^\d.]/g, '');
  const price = parseFloat(clean);
  if (!price || price <= 0) return null;
  const raw = price * 0.0025;
  const rounding = 500;
  return Math.max(rounding, Math.ceil(raw / rounding) * rounding);
}

function formatFee(fee: number): string {
  return `£${fee.toLocaleString('en-GB')}`;
}

function platformLabel(platform: string | null): string {
  switch (platform?.toLowerCase()) {
    case 'rightmove':    return 'Rightmove';
    case 'zoopla':       return 'Zoopla';
    case 'onthemarket':  return 'OnTheMarket';
    case 'primelocation':return 'PrimeLocation';
    default:             return 'Portal';
  }
}

// ── Shared SVGs (match original design exactly) ───────────────────────────────
const HeroRings: React.FC = () => (
  <div className="pointer-events-none absolute -right-24 -bottom-48 opacity-20">
    <svg width="712" height="596" viewBox="0 0 712 596" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g opacity="0.2">
        <path d="M712 263.5C712 409.027 594.027 527 448.5 527C302.973 527 185 409.027 185 263.5C185 117.973 302.973 0 448.5 0C594.027 0 712 117.973 712 263.5ZM223.847 263.5C223.847 387.573 324.427 488.153 448.5 488.153C572.573 488.153 673.153 387.573 673.153 263.5C673.153 139.427 572.573 38.8467 448.5 38.8467C324.427 38.8467 223.847 139.427 223.847 263.5Z" fill="#D9D9D9"/>
        <path d="M527 332.5C527 478.027 409.027 596 263.5 596C117.973 596 0 478.027 0 332.5C0 186.973 117.973 69 263.5 69C409.027 69 527 186.973 527 332.5ZM38.8467 332.5C38.8467 456.573 139.427 557.153 263.5 557.153C387.573 557.153 488.153 456.573 488.153 332.5C488.153 208.427 387.573 107.847 263.5 107.847C139.427 107.847 38.8467 208.427 38.8467 332.5Z" fill="#D9D9D9"/>
      </g>
    </svg>
  </div>
);

const FeatureTick: React.FC<{ light?: boolean }> = ({ light }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="mt-[3px] flex-shrink-0">
    <path d="M14.3726 7.16036L13.4659 6.10703C13.2926 5.90703 13.1526 5.5337 13.1526 5.26703V4.1337C13.1526 3.42703 12.5726 2.84703 11.8659 2.84703H10.7326C10.4726 2.84703 10.0926 2.70703 9.8926 2.5337L8.83927 1.62703C8.37927 1.2337 7.62594 1.2337 7.15927 1.62703L6.1126 2.54036C5.9126 2.70703 5.5326 2.84703 5.2726 2.84703H4.11927C3.4126 2.84703 2.8326 3.42703 2.8326 4.1337V5.2737C2.8326 5.5337 2.6926 5.90703 2.52594 6.10703L1.62594 7.16703C1.23927 7.62703 1.23927 8.3737 1.62594 8.8337L2.52594 9.8937C2.6926 10.0937 2.8326 10.467 2.8326 10.727V11.867C2.8326 12.5737 3.4126 13.1537 4.11927 13.1537H5.2726C5.5326 13.1537 5.9126 13.2937 6.1126 13.467L7.16594 14.3737C7.62594 14.767 8.37927 14.767 8.84594 14.3737L9.89927 13.467C10.0993 13.2937 10.4726 13.1537 10.7393 13.1537H11.8726C12.5793 13.1537 13.1593 12.5737 13.1593 11.867V10.7337C13.1593 10.4737 13.2993 10.0937 13.4726 9.8937L14.3793 8.84036C14.7659 8.38036 14.7659 7.62036 14.3726 7.16036ZM10.7726 6.74036L7.5526 9.96036C7.45927 10.0537 7.3326 10.107 7.19927 10.107C7.06594 10.107 6.93927 10.0537 6.84594 9.96036L5.2326 8.34703C5.03927 8.1537 5.03927 7.8337 5.2326 7.64036C5.42594 7.44703 5.74594 7.44703 5.93927 7.64036L7.19927 8.90036L10.0659 6.0337C10.2593 5.84036 10.5793 5.84036 10.7726 6.0337C10.9659 6.22703 10.9659 6.54703 10.7726 6.74036Z" fill={light ? 'currentColor' : '#149D4F'}/>
  </svg>
);

// ── Markdown-lite renderer for AI report ──────────────────────────────────────
function renderReport(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="font-display text-[16px] font-black tracking-tight text-black mt-5 mb-1">{line.slice(4)}</h3>,
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="font-display text-[20px] font-black tracking-tight text-black mt-6 mb-2">{line.slice(3)}</h2>,
      );
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(
        <p key={i} className="font-display text-[15px] font-bold text-black mt-3 mb-1">{line.slice(2, -2)}</p>,
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const bullets: string[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        bullets.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="space-y-2 my-3">
          {bullets.map((b, bi) => (
            <li key={bi} className="flex gap-2">
              <FeatureTick />
              <span className="font-body text-[14px] leading-snug text-black/85"
                dangerouslySetInnerHTML={{ __html: b.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </li>
          ))}
        </ul>,
      );
      continue;
    } else if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="space-y-2 my-3 list-none">
          {items.map((item, oi) => (
            <li key={oi} className="flex gap-2">
              <span className="font-display font-bold text-[#149D4F] shrink-0 w-5 text-[14px]">{oi + 1}.</span>
              <span className="font-body text-[14px] leading-snug text-black/85"
                dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </li>
          ))}
        </ol>,
      );
      continue;
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="font-body text-[14px] text-black/85 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />,
      );
    }
    i++;
  }
  return elements;
}

// ── AI Report page (full-page view) ───────────────────────────────────────────
interface AIReportPageProps {
  listing: AgentListing;
  token: string;
  onBack: () => void;
}

function AIReportPage({ listing, token, onBack }: AIReportPageProps) {
  const [report, setReport] = useState<string | null>(listing.ai_report || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.agentGenerateAIReport(token, {
        listing_id: listing.id,
        listing_url: listing.external_url || undefined,
        listing_title: listing.title || undefined,
        listing_price: listing.price || undefined,
        listing_description: listing.description || undefined,
      });
      setReport(res.report);
    } catch (e: any) {
      setError(e?.message || 'Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [listing, token]);

  useEffect(() => {
    if (!listing.ai_report) generate();
  }, []);

  const generatedDate = listing.ai_report_generated_at
    ? new Date(listing.ai_report_generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 pb-20 sm:px-6 lg:py-10">
      {/* Back button */}
      <button
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 font-body text-[13px] font-semibold text-black/60 hover:text-black transition-colors"
      >
        <ArrowLeft size={15} />
        Back to listings
      </button>

      {/* Header */}
      <div className="mb-8 rounded-[20px] border border-black/10 bg-white p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-[#A409D2]" />
          <span className="font-body text-[11px] font-bold uppercase tracking-widest text-[#A409D2]">AI Property Analysis — Free</span>
        </div>
        <h2 className="font-display text-[26px] sm:text-[32px] font-black tracking-tight text-black leading-tight">
          {listing.title || 'Property Report'}
        </h2>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {listing.price && (
            <span className="font-body text-[15px] font-bold text-black/60">{listing.price}</span>
          )}
          {listing.address && (
            <span className="font-body text-[14px] text-black/40">{listing.address}</span>
          )}
        </div>
        {generatedDate && !loading && (
          <p className="mt-2 font-body text-[12px] text-black/40">Report generated {generatedDate}</p>
        )}
      </div>

      {/* Report body */}
      <div className="rounded-[20px] border border-black/10 bg-white p-6 sm:p-8">
        {loading && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#A409D2] text-white">
              <Sparkles size={24} />
            </div>
            <p className="font-display text-[22px] font-black tracking-tight text-black">Analysing your listing…</p>
            <p className="font-body text-[14px] text-black/60">This usually takes 10–20 seconds.</p>
            <div className="w-full max-w-[360px] h-1.5 bg-black/10 rounded-full overflow-hidden mt-2">
              <motion.div className="h-full bg-[#A409D2] rounded-full"
                initial={{ width: '0%' }} animate={{ width: '90%' }}
                transition={{ duration: 15, ease: 'easeInOut' }} />
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="font-body text-[14px] text-red-600">{error}</p>
            <button onClick={generate}
              className="h-11 rounded-full bg-black px-6 font-body text-[13px] font-bold uppercase tracking-tight text-white hover:bg-black/90">
              Try Again
            </button>
          </div>
        )}
        {report && !loading && (
          <div>{renderReport(report)}</div>
        )}
      </div>

      {/* Footer actions */}
      {report && !loading && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <button onClick={onBack}
            className="h-11 rounded-full border border-black/15 px-6 font-body text-[13px] font-semibold text-black hover:bg-black/5 transition-colors">
            ← Back to listings
          </button>
          <button onClick={generate}
            className="h-11 rounded-full border border-black/15 px-6 font-body text-[13px] font-medium text-black/60 hover:bg-black/5 transition-colors">
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

// ── Activate Demand modal ──────────────────────────────────────────────────────
const BENEFIT_BULLETS = [
  'Reach local & international buyers',
  'Extend reach beyond Rightmove & Zoopla',
  'Generate real enquiries — not just views',
  'Drive viewing bookings directly to your team',
  'Relaunch stale listings with fresh demand',
  'Reduce reliance on price reductions',
  'Create urgency and competition around your listings',
  'Recover momentum on properties that have gone quiet',
  'Win back vendor confidence with visible marketing activity',
  'Retain instructions that might otherwise be lost',
  'Turn underperforming stock into active opportunities',
];

interface ActivateDemandModalProps {
  listing: AgentListing;
  token: string;
  onClose: () => void;
}

function ActivateDemandModal({ listing, token, onClose }: ActivateDemandModalProps) {
  const fee = listing.price ? calculateFee(listing.price) : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async () => {
    if (!listing.price) {
      setError('No price found for this listing. Please ensure the listing includes a price.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.agentCreateAdvancedCheckout(token, {
        listing_id: listing.id,
        listing_url: listing.external_url || undefined,
        listing_title: listing.title || undefined,
        property_price_raw: listing.price,
      });
      persistPendingPayment({
        kind: 'advanced_service',
        recordId: res.payment_record_id,
        reference: res.checkout_id,
      });
      redirectToCheckout(res.checkout_id, {
        kind: 'advanced_service',
        recordId: res.payment_record_id,
        reference: res.checkout_id,
      });
    } catch (e: any) {
      setError(e?.message || 'Could not create payment. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-[480px] max-h-[90vh] overflow-y-auto rounded-[20px] bg-white shadow-2xl">

        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-[#149D4F]" />
              <span className="font-body text-[11px] font-bold uppercase tracking-widest text-[#149D4F]">Activate Demand</span>
            </div>
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/5">
              <X size={16} />
            </button>
          </div>

          {/* Fee */}
          <div className="mb-5">
            {fee !== null ? (
              <>
                <p className="font-display text-[48px] font-black leading-none tracking-tight text-black">
                  {formatFee(fee)}
                </p>
                <p className="mt-1 font-body text-[13px] font-medium text-black/60">one-off campaign fee</p>
              </>
            ) : (
              <p className="font-body text-[14px] text-black/60 italic">Fee calculated from listing price</p>
            )}
            <p className="mt-2 font-body text-[14px] text-black/75">
              Reignite demand for your listing at:{' '}
              <span className="font-bold text-black">{listing.title || 'this property'}</span>
            </p>
          </div>

          {/* Benefits */}
          <ul className="space-y-2.5 mb-5">
            {BENEFIT_BULLETS.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <FeatureTick />
                <span className="font-body text-[14px] leading-snug text-black/85">{b}</span>
              </li>
            ))}
          </ul>

          {/* Typical outcome */}
          <div className="rounded-[10px] bg-[#149D4F]/10 p-4 mb-4">
            <p className="font-display text-[13px] font-bold text-[#149D4F]">Typical outcome</p>
            <p className="mt-1 font-body text-[13px] leading-snug text-black/80">
              More enquiries, renewed interest, and stronger offers — without relying on price cuts.
            </p>
          </div>

          {/* Advertising note */}
          <div className="mb-5">
            <p className="font-display text-[12px] font-bold uppercase tracking-wide text-black/50 mb-1">Advertising Investment</p>
            <p className="font-body text-[12px] text-black/55 leading-relaxed">
              The service fee is separate from and fully dedicated to promoting your listings. Your budget is tailored to the outcome you want to achieve and how aggressively you want to generate buyer demand.
            </p>
          </div>

          {error && (
            <p className="font-body text-[13px] text-red-600 mb-4">{error}</p>
          )}

          <button
            onClick={handleActivate}
            disabled={loading || fee === null}
            className="h-[56px] w-full rounded-full bg-black font-body text-[15px] font-bold uppercase tracking-tight text-white hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Redirecting to payment…' : 'Activate Demand'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Listing card ───────────────────────────────────────────────────────────────
interface ListingCardProps {
  listing: AgentListing;
  token: string;
  activated: boolean;
  onViewReport: (listing: AgentListing) => void;
}

function ListingCard({ listing, token, activated, onViewReport }: ListingCardProps) {
  const [showActivate, setShowActivate] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);

  const fee = listing.price ? calculateFee(listing.price) : null;
  const images = listing.images?.length ? listing.images : (listing.image_url ? [listing.image_url] : []);
  const currentImg = images[imgIdx] ?? null;
  const hasMultipleImages = images.length > 1;

  const beds = listing.bedrooms ? `${listing.bedrooms} bed` : null;
  const baths = listing.bathrooms ? `${listing.bathrooms} bath` : null;
  const roomLine = [beds, baths].filter(Boolean).join(' · ');

  const features = listing.features ?? [];
  const shownFeatures = features.slice(0, 4);

  return (
    <>
      <div className={`rounded-[14px] border bg-white overflow-hidden ${activated ? 'border-[#149D4F]/40' : 'border-black/10'}`}>
        {/* Image area */}
        {currentImg ? (
          <div className="relative h-44 bg-black/5 overflow-hidden group">
            <img src={currentImg} alt={listing.title || 'Property'}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />

            {/* Carousel controls */}
            {hasMultipleImages && (
              <>
                <button
                  onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                  aria-label="Previous image"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button
                  onClick={() => setImgIdx(i => (i + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                  aria-label="Next image"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                {/* Dots */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.slice(0, 6).map((_, i) => (
                    <button key={i} onClick={() => setImgIdx(i)}
                      className={`h-1.5 rounded-full transition-all ${i === imgIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
                  ))}
                </div>
              </>
            )}

            {/* Image count badge */}
            {hasMultipleImages && (
              <span className="absolute bottom-2 right-2.5 rounded-full bg-black/55 px-2 py-0.5 font-body text-[10px] font-semibold text-white backdrop-blur-sm">
                {imgIdx + 1}/{images.length}
              </span>
            )}

            {/* Platform badge */}
            <div className="absolute top-2.5 left-2.5 flex gap-1.5 flex-wrap">
              {listing.platform && listing.platform !== 'manual' && (
                <span className="rounded-full bg-white/90 px-2.5 py-0.5 font-body text-[11px] font-semibold text-black/70 backdrop-blur-sm">
                  {platformLabel(listing.platform)}
                </span>
              )}
              {listing.property_type && (
                <span className="rounded-full bg-white/90 px-2.5 py-0.5 font-body text-[11px] font-semibold text-black/60 backdrop-blur-sm">
                  {listing.property_type}
                </span>
              )}
            </div>

            {/* Listed date */}
            {listing.listed_date && (
              <span className="absolute top-2.5 right-2.5 rounded-full bg-black/55 px-2.5 py-0.5 font-body text-[10px] font-medium text-white/90 backdrop-blur-sm">
                {listing.listed_date}
              </span>
            )}

            {/* Activated badge */}
            {activated && (
              <span className="absolute bottom-7 right-2.5 flex items-center gap-1 rounded-full bg-[#149D4F] px-2.5 py-0.5 font-body text-[11px] font-bold text-white">
                <Zap size={10} className="fill-white" />
                Demand Activated
              </span>
            )}
          </div>
        ) : (
          /* No image placeholder */
          <div className="h-20 bg-[#F4F5F4] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-black/20">
              <rect x="3" y="5" width="22" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="10" cy="11" r="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M3 19l5-5 4 4 4-5 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}

        <div className="p-5">
          {/* No image — show activated badge inline */}
          {!currentImg && activated && (
            <div className="flex items-center gap-1.5 mb-3">
              <span className="flex items-center gap-1 rounded-full bg-[#149D4F] px-2.5 py-0.5 font-body text-[11px] font-bold text-white">
                <Zap size={10} className="fill-white" />
                Demand Activated
              </span>
            </div>
          )}

          {/* Title */}
          <h4 className="font-display text-[17px] font-black tracking-tight text-black leading-snug line-clamp-2">
            {listing.title || 'Untitled Listing'}
          </h4>

          {/* Address (if distinct from title) */}
          {listing.address && listing.address !== listing.title && (
            <p className="mt-0.5 font-body text-[12px] text-black/50 line-clamp-1">
              {listing.address}
            </p>
          )}

          {/* Price + rooms */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {listing.price && (
              <span className="font-display text-[15px] font-black tracking-tight text-black">{listing.price}</span>
            )}
            {roomLine && (
              <span className="font-body text-[12px] text-black/55">{roomLine}</span>
            )}
            {listing.floor_area && (
              <span className="font-body text-[12px] text-black/45">{listing.floor_area}</span>
            )}
          </div>

          {/* Feature chips */}
          {shownFeatures.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {shownFeatures.map((f, i) => (
                <span key={i} className="rounded-full bg-[#F4F5F4] px-2.5 py-0.5 font-body text-[11px] text-black/60">
                  {f}
                </span>
              ))}
              {features.length > 4 && (
                <span className="rounded-full bg-[#F4F5F4] px-2.5 py-0.5 font-body text-[11px] text-black/40">
                  +{features.length - 4} more
                </span>
              )}
            </div>
          )}

          {listing.external_url && (
            <a href={listing.external_url} target="_blank" rel="noopener noreferrer"
              className="inline-block mt-2 font-body text-[12px] text-black/40 hover:text-black/70 underline underline-offset-2 transition-colors">
              View on portal ↗
            </a>
          )}

          {/* Fee hint */}
          {fee !== null && !activated && (
            <div className="mt-4 rounded-[8px] bg-[#F4F5F4] px-4 py-3">
              <p className="font-body text-[12px] text-black/60">
                Advanced services fee:{' '}
                <span className="font-display font-bold text-black">{formatFee(fee)}</span>
              </p>
            </div>
          )}

          {/* Activated strip */}
          {activated && (
            <div className="mt-4 rounded-[8px] bg-[#149D4F]/10 px-4 py-3">
              <p className="font-display text-[13px] font-bold text-[#149D4F]">Campaign live</p>
              <p className="mt-0.5 font-body text-[12px] text-black/65">
                Buyer demand campaign is active for this property.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-5 flex gap-2">
            <button onClick={() => onViewReport(listing)}
              className="flex flex-1 h-11 items-center justify-center gap-1.5 rounded-md border border-black/10 bg-white font-body text-[13px] font-semibold text-black hover:bg-black/5 transition-colors">
              <Sparkles size={13} className="text-[#A409D2]" />
              AI Report
              <span className="text-black/40 font-normal text-[11px]">• Free</span>
            </button>

            {activated ? (
              <div className="flex flex-1 h-11 items-center justify-center gap-1.5 rounded-md bg-[#149D4F]/10 font-body text-[13px] font-semibold text-[#149D4F]">
                <Star size={13} className="fill-[#149D4F]" />
                Active
              </div>
            ) : (
              <button onClick={() => setShowActivate(true)}
                className="flex flex-1 h-11 items-center justify-center gap-1.5 rounded-md bg-black font-body text-[13px] font-semibold text-white hover:bg-black/90 transition-colors">
                <Zap size={13} />
                Activate Demand
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showActivate && (
          <ActivateDemandModal listing={listing} token={token} onClose={() => setShowActivate(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Add Listing modal (two tabs: link / manual form) ──────────────────────────
interface AddListingModalProps {
  token: string;
  onClose: () => void;
  onAdded: (listing: AgentListing) => void;
}

type AddTab = 'link' | 'manual';

type ScrapedPreview = {
  title: string; address: string; price: string; description: string;
  images: string[]; image_url: string; bedrooms: string; bathrooms: string;
  property_type: string; listed_date: string; features: string[];
  floor_area: string; platform: string; external_url: string;
};

function AddListingModal({ token, onClose, onAdded }: AddListingModalProps) {
  const [tab, setTab] = useState<AddTab>('link');

  // Link tab state
  const [linkUrl, setLinkUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scraped, setScraped] = useState<ScrapedPreview | null>(null);
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Manual tab state
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [manualLink, setManualLink] = useState('');
  const [manualImageUrl, setManualImageUrl] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const inputCls = 'h-12 w-full rounded-lg border border-black/5 bg-[#242628]/5 px-4 font-body text-sm font-medium text-black outline-none placeholder:text-black/40 focus:ring-2 focus:ring-black/10';
  const labelCls = 'block font-body text-[13px] font-bold text-[#001C47] mb-1.5';

  const handleFetchListing = async () => {
    if (!linkUrl.trim()) return;
    setScraping(true);
    setScrapeError(null);
    setScraped(null);
    try {
      const result = await api.agentScrapeListingUrl(token, linkUrl.trim());
      setScraped(result);
    } catch (err: any) {
      setScrapeError(err?.message || 'Could not fetch listing details. Check the URL and try again.');
    } finally {
      setScraping(false);
    }
  };

  const handleSaveScraped = async () => {
    if (!scraped) return;
    setLinkSubmitting(true);
    setLinkError(null);
    try {
      const result = await api.agentAddManualListing(token, {
        title: scraped.title || scraped.address || scraped.external_url,
        address: scraped.address || undefined,
        price: scraped.price || undefined,
        bedrooms: scraped.bedrooms || undefined,
        bathrooms: scraped.bathrooms || undefined,
        property_type: scraped.property_type || undefined,
        listed_date: scraped.listed_date || undefined,
        floor_area: scraped.floor_area || undefined,
        description: scraped.description || undefined,
        external_url: scraped.external_url,
        image_url: scraped.image_url || undefined,
        images: scraped.images.length > 0 ? scraped.images : undefined,
        features: scraped.features.length > 0 ? scraped.features : undefined,
      });
      onAdded(result);
      onClose();
    } catch (err: any) {
      setLinkError(err?.message || 'Failed to add listing. Please try again.');
    } finally {
      setLinkSubmitting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setManualSubmitting(true);
    setManualError(null);
    try {
      const result = await api.agentAddManualListing(token, {
        title: title.trim(),
        price: price.trim() || undefined,
        bedrooms: bedrooms.trim() || undefined,
        address: address.trim() || undefined,
        description: description.trim() || undefined,
        external_url: manualLink.trim() || undefined,
        image_url: manualImageUrl.trim() || undefined,
      });
      onAdded(result);
      onClose();
    } catch (err: any) {
      setManualError(err?.message || 'Failed to add listing. Please try again.');
    } finally {
      setManualSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-[500px] rounded-[20px] bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h3 className="font-display text-[22px] font-black tracking-tight text-black">Add a Listing</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-6 mb-5 rounded-[10px] bg-[#F4F5F4] p-1">
          <button
            onClick={() => setTab('link')}
            className={`flex flex-1 items-center justify-center gap-1.5 h-9 rounded-[8px] font-body text-[13px] font-semibold transition-colors ${
              tab === 'link' ? 'bg-white text-black shadow-sm' : 'text-black/50 hover:text-black/70'
            }`}
          >
            <Link2 size={13} />
            Paste a link
          </button>
          <button
            onClick={() => setTab('manual')}
            className={`flex flex-1 items-center justify-center gap-1.5 h-9 rounded-[8px] font-body text-[13px] font-semibold transition-colors ${
              tab === 'manual' ? 'bg-white text-black shadow-sm' : 'text-black/50 hover:text-black/70'
            }`}
          >
            <Plus size={13} />
            Fill in details
          </button>
        </div>

        {/* Link tab */}
        {tab === 'link' && (
          <div className="px-6 pb-6 space-y-4">
            <p className="font-body text-[13px] text-black/60 -mt-2">
              Paste the URL to any property listing and we'll extract all the details automatically.
            </p>

            {/* URL input + fetch button */}
            {!scraped && (
              <>
                <div>
                  <label className={labelCls}>Listing URL</label>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => { setLinkUrl(e.target.value); setScrapeError(null); }}
                    onKeyDown={(e) => e.key === 'Enter' && !scraping && linkUrl.trim() && handleFetchListing()}
                    placeholder="https://www.rightmove.co.uk/properties/..."
                    className={inputCls}
                    autoFocus
                    disabled={scraping}
                  />
                </div>
                {scrapeError && <p className="font-body text-[13px] text-red-600">{scrapeError}</p>}
                <button
                  onClick={handleFetchListing}
                  disabled={scraping || !linkUrl.trim()}
                  className="h-[52px] w-full rounded-full bg-black font-body text-[14px] font-bold uppercase tracking-tight text-white hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scraping ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw size={14} className="animate-spin" />
                      Fetching details…
                    </span>
                  ) : 'Fetch Listing Details'}
                </button>
                {scraping && (
                  <p className="font-body text-[12px] text-black/40 text-center">
                    This may take 10–20 seconds while we extract the full listing.
                  </p>
                )}
              </>
            )}

            {/* Scraped preview */}
            {scraped && (
              <div className="space-y-4">
                {/* Preview card */}
                <div className="rounded-[12px] border border-black/10 overflow-hidden">
                  {scraped.images.length > 0 && (
                    <img src={scraped.images[0]} alt={scraped.title}
                      className="w-full h-36 object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <div className="p-4 space-y-1">
                    <p className="font-display text-[16px] font-black tracking-tight text-black line-clamp-2">
                      {scraped.title || scraped.address || '(No title extracted)'}
                    </p>
                    {scraped.address && scraped.address !== scraped.title && (
                      <p className="font-body text-[12px] text-black/50 line-clamp-1">{scraped.address}</p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5">
                      {scraped.price && (
                        <span className="font-display text-[14px] font-black text-black">{scraped.price}</span>
                      )}
                      {scraped.bedrooms && (
                        <span className="font-body text-[12px] text-black/55">{scraped.bedrooms} bed</span>
                      )}
                      {scraped.bathrooms && (
                        <span className="font-body text-[12px] text-black/55">{scraped.bathrooms} bath</span>
                      )}
                      {scraped.floor_area && (
                        <span className="font-body text-[12px] text-black/45">{scraped.floor_area}</span>
                      )}
                    </div>
                    {scraped.property_type && (
                      <span className="inline-block rounded-full bg-[#F4F5F4] px-2.5 py-0.5 font-body text-[11px] text-black/60 mt-1">
                        {scraped.property_type}
                      </span>
                    )}
                    {scraped.images.length > 1 && (
                      <p className="font-body text-[11px] text-black/40 mt-1">
                        {scraped.images.length} photos extracted
                      </p>
                    )}
                  </div>
                </div>

                {linkError && <p className="font-body text-[13px] text-red-600">{linkError}</p>}

                <button
                  onClick={handleSaveScraped}
                  disabled={linkSubmitting}
                  className="h-[52px] w-full rounded-full bg-black font-body text-[14px] font-bold uppercase tracking-tight text-white hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {linkSubmitting ? 'Adding…' : 'Add This Listing'}
                </button>

                <button
                  onClick={() => { setScraped(null); setScrapeError(null); }}
                  className="w-full font-body text-[13px] text-black/50 hover:text-black/70 transition-colors"
                >
                  ← Try a different URL
                </button>
              </div>
            )}
          </div>
        )}

        {/* Manual tab */}
        {tab === 'manual' && (
          <form onSubmit={handleManualSubmit} className="px-6 pb-6 space-y-4 max-h-[60vh] overflow-y-auto">
            <p className="font-body text-[13px] text-black/60 -mt-2">
              Fill in your property details directly — no portal link needed.
            </p>
            <div>
              <label className={labelCls}>Property title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 4-bed detached house, Bristol"
                className={inputCls}
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Listed price <span className="font-normal text-black/40">(optional)</span>
                </label>
                <input
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. £875,000"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Bedrooms <span className="font-normal text-black/40">(optional)</span>
                </label>
                <input
                  type="text"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  placeholder="e.g. 4"
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>
                Address <span className="font-normal text-black/40">(optional)</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 12 Cheltenham Road, Bristol BS6 5RW"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                Description <span className="font-normal text-black/40">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Key features, selling points, etc."
                rows={4}
                className="w-full rounded-lg border border-black/5 bg-[#242628]/5 px-4 py-3 font-body text-sm font-medium text-black outline-none placeholder:text-black/40 focus:ring-2 focus:ring-black/10 resize-none"
              />
            </div>
            <div>
              <label className={labelCls}>
                Listing link <span className="font-normal text-black/40">(optional)</span>
              </label>
              <input
                type="url"
                value={manualLink}
                onChange={(e) => setManualLink(e.target.value)}
                placeholder="https://www.rightmove.co.uk/properties/..."
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                Property image URL <span className="font-normal text-black/40">(optional)</span>
              </label>
              <input
                type="url"
                value={manualImageUrl}
                onChange={(e) => setManualImageUrl(e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
              <p className="mt-1 font-body text-[11px] text-black/40">Paste a direct link to a photo of the property.</p>
            </div>
            {manualError && <p className="font-body text-[13px] text-red-600">{manualError}</p>}
            <button
              type="submit"
              disabled={manualSubmitting || !title.trim()}
              className="h-[52px] w-full rounded-full bg-black font-body text-[14px] font-bold uppercase tracking-tight text-white hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {manualSubmitting ? 'Adding…' : 'Add Listing'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function DashboardBuyerNetwork() {
  const { token } = useAuth();

  const [profileUrl, setProfileUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [savedPlatform, setSavedPlatform] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [listings, setListings] = useState<AgentListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  const [activatedIds, setActivatedIds] = useState<Set<string>>(new Set());
  const [showAddListing, setShowAddListing] = useState(false);
  const [selectedReportListing, setSelectedReportListing] = useState<AgentListing | null>(null);

  const handleListingAdded = useCallback((listing: AgentListing) => {
    setListings((prev) => [listing, ...prev]);
  }, []);

  const [paidBanner, setPaidBanner] = useState<{
    listingTitle: string | null;
    fee: number;
  } | null>(null);

  // Load everything on mount
  useEffect(() => {
    if (!token) return;
    (async () => {
      setProfileLoading(true);
      try {
        const link = await api.agentGetProfileLink(token);
        if (link) {
          setSavedUrl(link.profile_url);
          setProfileUrl(link.profile_url);
          setSavedPlatform(link.platform);
          setLastSynced(link.last_synced_at);
        }
      } catch {}

      setListingsLoading(true);
      try {
        const [listingsData, activatedData] = await Promise.all([
          api.agentGetListings(token),
          api.agentGetActivatedListings(token),
        ]);
        setListings(listingsData);
        setActivatedIds(new Set(activatedData.filter((r) => r.listing_id).map((r) => r.listing_id!)));
      } catch {} finally {
        setListingsLoading(false);
      }
      setProfileLoading(false);
    })();
  }, [token]);

  // Payment return poller
  const { polling: paymentPolling } = usePaymentReturnPoller({
    kind: 'advanced_service',
    token,
    fetchStatus: async (recordId) => {
      const res = await api.agentGetAdvancedServiceStatus(token!, recordId);
      return { paid: res.paid, status: res.status };
    },
    onPaid: async () => {
      if (token) {
        try {
          const activated = await api.agentGetActivatedListings(token);
          setActivatedIds(new Set(activated.filter((r) => r.listing_id).map((r) => r.listing_id!)));
          const latest = activated[activated.length - 1];
          if (latest) setPaidBanner({ listingTitle: latest.listing_title, fee: latest.service_fee_amount });
        } catch {}
      }
    },
  });

  const handleSaveProfile = async () => {
    if (!token || !profileUrl.trim()) return;
    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(false);
    try {
      const res = await api.agentSaveProfileLink(token, profileUrl.trim());
      setSavedUrl(res.profile_url);
      setSavedPlatform(res.platform);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (e: any) {
      setProfileError(e?.message || 'Failed to save profile URL.');
    } finally {
      setProfileSaving(false);
    }
  };

  const setSyncErrorTimed = (msg: string, ms = 7000) => {
    setSyncError(msg);
    setTimeout(() => setSyncError(null), ms);
  };

  const handleSync = async () => {
    if (!token) return;
    setSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);
    try {
      const res = await api.agentSyncListings(token);
      setListings(res.listings);
      setLastSynced(new Date().toISOString());
      if (res.count > 0) {
        setSyncSuccess(`${res.count} listing${res.count !== 1 ? 's' : ''} imported successfully.`);
      } else {
        setSyncErrorTimed(
          'No listings were found at that URL. If you use Rightmove or Zoopla, ' +
          'please add listings individually using the "Paste a link" tab — ' +
          'paste each property URL and all details will be imported automatically.',
        );
      }
    } catch (e: any) {
      setSyncErrorTimed(e?.message || 'Sync failed. Please check your profile URL and try again.');
    } finally {
      setSyncing(false);
    }
  };

  const lastSyncedLabel = lastSynced
    ? new Date(lastSynced).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  if (selectedReportListing) {
    return (
      <DashboardLayout title="AI Property Report">
        <AIReportPage
          listing={selectedReportListing}
          token={token!}
          onBack={() => setSelectedReportListing(null)}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="International Buyer Network">
      <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6 pb-20 sm:px-6 lg:space-y-8 lg:py-10">

        {/* Payment confirming banner */}
        <AnimatePresence>
          {paymentPolling && (
            <motion.div key="polling"
              initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="rounded-[14px] border border-[#A409D2]/20 bg-[#A409D2]/5 p-4 flex items-center gap-3">
              <Sparkles size={16} className="text-[#A409D2] shrink-0" />
              <p className="font-body text-[14px] text-black/75">Confirming your payment — this usually takes a few seconds…</p>
            </motion.div>
          )}
          {paidBanner && !paymentPolling && (
            <motion.div key="success"
              initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="rounded-[14px] border border-[#149D4F]/30 bg-[#149D4F]/10 p-4 flex items-start gap-3">
              <FeatureTick />
              <div className="flex-1">
                <p className="font-display text-[15px] font-black tracking-tight text-black">Demand campaign activated!</p>
                <p className="mt-0.5 font-body text-[13px] text-black/70">
                  {paidBanner.listingTitle ? (
                    <>Your campaign for <strong>{paidBanner.listingTitle}</strong> is now live. </>
                  ) : 'Your campaign is now live. '}
                  Fee of {formatFee(paidBanner.fee)} received. Expect renewed enquiries within 7–14 days.
                </p>
              </div>
              <button onClick={() => setPaidBanner(null)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-black/5">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero */}
        <div className="relative overflow-hidden rounded-[20px] bg-black p-6 sm:p-10">
          <div className="relative z-10 max-w-[800px]">
            <h2 className="mb-4 font-display text-2xl font-black leading-none tracking-tight text-white sm:text-[40px]">
              Faster Sales Through Better Exposure
            </h2>
            <p className="max-w-[620px] font-body text-sm font-medium leading-relaxed text-white/80 sm:text-base">
              Connect your listing portal profile to import your properties. Get a free AI analysis report on any listing, or activate a targeted international buyer demand campaign to generate fresh buyer interest.
            </p>
          </div>
          <HeroRings />
        </div>

        {/* Profile URL card */}
        <div className="rounded-[20px] border border-black/10 bg-white p-6 sm:p-8">
          <h3 className="mb-1 font-display text-[22px] font-black tracking-tight text-black">
            Your Listing Portal Profile
          </h3>
          <p className="mb-5 font-body text-[14px] text-black/60">
            Paste the URL to your agent profile on Rightmove, Zoopla, OnTheMarket, etc. We'll import all your listings automatically.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="url"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              placeholder="https://www.rightmove.co.uk/estate-agents/agent/..."
              className="h-12 flex-1 rounded-lg border border-black/5 bg-[#242628]/5 px-4 font-body text-sm font-medium text-black outline-none placeholder:text-black/40 focus:ring-2 focus:ring-black/10"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
              disabled={profileLoading}
            />
            <button
              onClick={handleSaveProfile}
              disabled={profileSaving || profileLoading || !profileUrl.trim()}
              className="h-12 rounded-full bg-black px-6 font-body text-[14px] font-bold uppercase tracking-tight text-white hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {profileSaving ? 'Saving…' : 'Save'}
            </button>
          </div>

          {profileError && <p className="mt-2 font-body text-[13px] text-red-600">{profileError}</p>}
          {profileSuccess && <p className="mt-2 font-body text-[13px] font-medium text-[#149D4F]">Profile URL saved.</p>}
          {savedPlatform && (
            <p className="mt-2 font-body text-[13px] text-black/50">
              Platform detected: <span className="font-semibold text-black/70">{platformLabel(savedPlatform)}</span>
              {lastSyncedLabel && <> · Last synced: {lastSyncedLabel}</>}
            </p>
          )}

          {savedUrl && (
            <div className="mt-5 pt-5 border-t border-black/5">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-black/20 bg-white px-5 font-body text-[13px] font-semibold text-black hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing listings…' : 'Sync Listings from Portal'}
              </button>
              {syncError && <p className="mt-2 font-body text-[13px] text-red-600">{syncError}</p>}
              {syncSuccess && <p className="mt-2 font-body text-[13px] font-medium text-[#149D4F]">{syncSuccess}</p>}
            </div>
          )}
        </div>

        {/* How it works — only before first sync */}
        {listings.length === 0 && !listingsLoading && (
          <div className="rounded-[20px] border border-black/10 bg-white p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 mb-5">
              <h3 className="font-display text-[22px] font-black tracking-tight text-black">How it works</h3>
              <button onClick={() => setShowAddListing(true)}
                className="inline-flex shrink-0 h-10 items-center gap-1.5 rounded-full bg-black px-5 font-body text-[13px] font-semibold text-white hover:bg-black/90 transition-colors">
                <Plus size={13} />
                Add a Listing
              </button>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              {[
                {
                  num: '1',
                  title: 'Connect your portal',
                  desc: 'Paste your Rightmove, Zoopla or OnTheMarket agent profile URL above and sync your listings.',
                },
                {
                  num: '2',
                  title: 'Get AI insights — free',
                  desc: 'Click AI Report on any listing for a free property analysis and action plan powered by AI.',
                },
                {
                  num: '3',
                  title: 'Activate demand',
                  desc: 'Activate a targeted international buyer demand campaign for any listing to generate fresh enquiries and renewed interest.',
                },
              ].map((s) => (
                <div key={s.num} className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black font-display text-[14px] font-black text-white mt-0.5">
                    {s.num}
                  </div>
                  <div>
                    <p className="font-display text-[15px] font-black tracking-tight text-black">{s.title}</p>
                    <p className="mt-1 font-body text-[13px] text-black/60 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Listings */}
        {listingsLoading ? (
          <div className="flex items-center justify-center gap-3 py-12 font-body text-[14px] text-black/50">
            <RefreshCw size={16} className="animate-spin" />
            Loading your listings…
          </div>
        ) : listings.length > 0 ? (
          <div>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-[22px] font-black tracking-tight text-black">Your Listings</h3>
                <p className="font-body text-[13px] text-black/55 mt-0.5">
                  {listings.length} listing{listings.length !== 1 ? 's' : ''}
                  {activatedIds.size > 0 && (
                    <> · <span className="font-bold text-[#149D4F]">{activatedIds.size} active campaign{activatedIds.size !== 1 ? 's' : ''}</span></>
                  )}
                  {lastSyncedLabel ? ` · Synced ${lastSyncedLabel}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={handleSync} disabled={syncing || !savedUrl}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-black/15 bg-white px-4 font-body text-[12px] font-semibold text-black hover:bg-black/5 disabled:opacity-50 transition-colors">
                  <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                  Refresh
                </button>
                <button onClick={() => setShowAddListing(true)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-black px-4 font-body text-[12px] font-semibold text-white hover:bg-black/90 transition-colors">
                  <Plus size={13} />
                  Add Listing
                </button>
              </div>
            </div>

            {syncError && <p className="mb-4 font-body text-[13px] text-red-600">{syncError}</p>}
            {syncSuccess && <p className="mb-4 font-body text-[13px] font-medium text-[#149D4F]">{syncSuccess}</p>}

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  token={token!}
                  activated={activatedIds.has(listing.id)}
                  onViewReport={(l) => setSelectedReportListing(l)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* Free listing note */}
        <p className="text-center font-body text-[12px] text-black/40">
          Listing on Havlo is <span className="font-semibold text-black/60">always free</span>. A fee only applies when you activate our advanced demand services for a specific property.
        </p>

      </div>

      {/* Add listing modal */}
      <AnimatePresence>
        {showAddListing && token && (
          <AddListingModal
            token={token}
            onClose={() => setShowAddListing(false)}
            onAdded={handleListingAdded}
          />
        )}
      </AnimatePresence>

    </DashboardLayout>
  );
}

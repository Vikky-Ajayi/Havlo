import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Sparkles, Star, X, Zap } from 'lucide-react';
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

// ── AI Report modal ────────────────────────────────────────────────────────────
interface AIReportModalProps {
  listing: AgentListing;
  token: string;
  onClose: () => void;
}

function AIReportModal({ listing, token, onClose }: AIReportModalProps) {
  const [report, setReport] = useState<string | null>(null);
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

  useEffect(() => { generate(); }, [generate]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-[680px] max-h-[85vh] rounded-[20px] bg-white shadow-2xl flex flex-col overflow-hidden">

        <div className="flex items-start justify-between p-6 border-b border-black/5 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={14} className="text-[#A409D2]" />
              <span className="font-body text-[11px] font-bold uppercase tracking-widest text-[#A409D2]">AI Property Analysis — Free</span>
            </div>
            <h3 className="font-display text-[22px] font-black tracking-tight text-black leading-tight">
              {listing.title || 'Property Report'}
            </h3>
            {listing.price && (
              <p className="font-body text-[14px] font-bold text-black/60 mt-0.5">{listing.price}</p>
            )}
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5 shrink-0 ml-4">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#A409D2] text-white">
                <Sparkles size={24} />
              </div>
              <p className="font-display text-[20px] font-black tracking-tight text-black">Analysing your listing…</p>
              <p className="font-body text-[14px] text-black/60">This usually takes 10–20 seconds.</p>
              <div className="w-full max-w-[360px] h-1.5 bg-black/10 rounded-full overflow-hidden mt-2">
                <motion.div className="h-full bg-[#A409D2] rounded-full"
                  initial={{ width: '0%' }} animate={{ width: '90%' }}
                  transition={{ duration: 15, ease: 'easeInOut' }} />
              </div>
            </div>
          )}
          {error && !loading && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
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

        {report && !loading && (
          <div className="border-t border-black/5 p-4 shrink-0 flex justify-end">
            <button onClick={onClose}
              className="h-10 rounded-full bg-black px-5 font-body text-[13px] font-bold uppercase tracking-tight text-white hover:bg-black/90">
              Close
            </button>
          </div>
        )}
      </motion.div>
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
}

function ListingCard({ listing, token, activated }: ListingCardProps) {
  const [showReport, setShowReport] = useState(false);
  const [showActivate, setShowActivate] = useState(false);

  const fee = listing.price ? calculateFee(listing.price) : null;

  return (
    <>
      <div className={`rounded-[14px] border bg-white overflow-hidden ${activated ? 'border-[#149D4F]/40' : 'border-black/10'}`}>
        {/* Property image */}
        {listing.image_url && (
          <div className="relative h-40 bg-black/5 overflow-hidden">
            <img src={listing.image_url} alt={listing.title || 'Property'}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            {listing.platform && (
              <span className="absolute top-2.5 left-2.5 rounded-full bg-white/90 px-2.5 py-0.5 font-body text-[11px] font-semibold text-black/70 backdrop-blur-sm">
                {platformLabel(listing.platform)}
              </span>
            )}
            {activated && (
              <span className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-[#149D4F] px-2.5 py-0.5 font-body text-[11px] font-bold text-white">
                <Zap size={10} className="fill-white" />
                Demand Activated
              </span>
            )}
          </div>
        )}

        <div className="p-5">
          {/* No image — show badge inline */}
          {!listing.image_url && activated && (
            <div className="flex items-center gap-1.5 mb-3">
              <span className="flex items-center gap-1 rounded-full bg-[#149D4F] px-2.5 py-0.5 font-body text-[11px] font-bold text-white">
                <Zap size={10} className="fill-white" />
                Demand Activated
              </span>
            </div>
          )}

          {/* Title + price */}
          <h4 className="font-display text-[18px] font-black tracking-tight text-black leading-snug line-clamp-2">
            {listing.title || 'Untitled Listing'}
          </h4>
          {(listing.price || listing.bedrooms) && (
            <p className="mt-1 font-body text-[13px] text-black/65">
              {[listing.bedrooms, listing.price].filter(Boolean).join(' · ')}
            </p>
          )}
          {listing.external_url && (
            <a href={listing.external_url} target="_blank" rel="noopener noreferrer"
              className="inline-block mt-0.5 font-body text-[12px] text-black/40 hover:text-black/70 underline underline-offset-2 transition-colors">
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
            <button onClick={() => setShowReport(true)}
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
        {showReport && (
          <AIReportModal listing={listing} token={token} onClose={() => setShowReport(false)} />
        )}
        {showActivate && (
          <ActivateDemandModal listing={listing} token={token} onClose={() => setShowActivate(false)} />
        )}
      </AnimatePresence>
    </>
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

  const handleSync = async () => {
    if (!token) return;
    setSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);
    try {
      const res = await api.agentSyncListings(token);
      setListings(res.listings);
      setLastSynced(new Date().toISOString());
      setSyncSuccess(
        res.count > 0
          ? `${res.count} listing${res.count !== 1 ? 's' : ''} imported successfully.`
          : 'Profile synced — no listings found. Check your profile URL points directly to your listings.',
      );
    } catch (e: any) {
      setSyncError(e?.message || 'Sync failed. Please check your profile URL and try again.');
    } finally {
      setSyncing(false);
    }
  };

  const lastSyncedLabel = lastSynced
    ? new Date(lastSynced).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

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
            <h3 className="mb-5 font-display text-[22px] font-black tracking-tight text-black">How it works</h3>
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
                  desc: 'Click AI Report on any listing for a free property analysis and action plan powered by Groq.',
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
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="font-display text-[22px] font-black tracking-tight text-black">Your Listings</h3>
                <p className="font-body text-[13px] text-black/55 mt-0.5">
                  {listings.length} listing{listings.length !== 1 ? 's' : ''} imported
                  {activatedIds.size > 0 && (
                    <> · <span className="font-bold text-[#149D4F]">{activatedIds.size} active campaign{activatedIds.size !== 1 ? 's' : ''}</span></>
                  )}
                  {lastSyncedLabel ? ` · Synced ${lastSyncedLabel}` : ''}
                </p>
              </div>
              <button onClick={handleSync} disabled={syncing || !savedUrl}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-black/15 bg-white px-4 font-body text-[12px] font-semibold text-black hover:bg-black/5 disabled:opacity-50 transition-colors">
                <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                Refresh
              </button>
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
    </DashboardLayout>
  );
}

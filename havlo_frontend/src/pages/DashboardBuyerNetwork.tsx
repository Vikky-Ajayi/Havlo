import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Home,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api, type AgentListing } from '../lib/api';

// ── Fee calculator (mirrors backend) ──────────────────────────────────────────
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

// ── Platform badge label ───────────────────────────────────────────────────────
function platformLabel(platform: string | null): string {
  switch (platform?.toLowerCase()) {
    case 'rightmove': return 'Rightmove';
    case 'zoopla': return 'Zoopla';
    case 'onthemarket': return 'OnTheMarket';
    case 'primelocation': return 'PrimeLocation';
    default: return 'Portal';
  }
}

// ── Markdown-lite renderer ─────────────────────────────────────────────────────
function renderReport(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-base font-display font-semibold text-zinc-900 dark:text-white mt-5 mb-1">
          {line.slice(4)}
        </h3>,
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-lg font-display font-bold text-zinc-900 dark:text-white mt-6 mb-2">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(
        <p key={i} className="font-semibold text-zinc-900 dark:text-white mt-3 mb-1">
          {line.slice(2, -2)}
        </p>,
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const bullets: string[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        bullets.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="space-y-1 my-2">
          {bullets.map((b, bi) => (
            <li key={bi} className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="mt-1 text-[#C5A57B] shrink-0">✓</span>
              <span dangerouslySetInnerHTML={{ __html: b.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
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
        <ol key={`ol-${i}`} className="space-y-1 my-2 list-none">
          {items.map((item, oi) => (
            <li key={oi} className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="font-semibold text-[#C5A57B] shrink-0 w-5">{oi + 1}.</span>
              <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </li>
          ))}
        </ol>,
      );
      continue;
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p
          key={i}
          className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
        />,
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

  useEffect(() => {
    generate();
  }, [generate]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-2xl max-h-[85vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#C5A57B]/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-[#C5A57B]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-body uppercase tracking-wide mb-0.5">
              AI Property Analysis — Free
            </p>
            <h2 className="text-base font-display font-semibold text-zinc-900 dark:text-white truncate">
              {listing.title || 'Property Report'}
            </h2>
            {listing.price && (
              <p className="text-sm text-[#C5A57B] font-semibold">{listing.price}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-8 h-8 text-[#C5A57B] animate-spin" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
                Analysing your listing with AI…<br />
                <span className="text-xs">This usually takes 10–20 seconds.</span>
              </p>
            </div>
          )}
          {error && !loading && (
            <div className="flex flex-col items-center gap-3 py-10">
              <AlertCircle className="w-7 h-7 text-red-400" />
              <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
              <button
                onClick={generate}
                className="mt-2 px-4 py-2 bg-[#C5A57B] text-white rounded-lg text-sm font-semibold hover:bg-[#b8936a] transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
          {report && !loading && (
            <div className="prose-sm max-w-none">
              {renderReport(report)}
            </div>
          )}
        </div>

        {/* Footer */}
        {report && !loading && (
          <div className="border-t border-zinc-200 dark:border-zinc-700 p-4 shrink-0 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ── Activate Demand modal ──────────────────────────────────────────────────────
interface ActivateDemandModalProps {
  listing: AgentListing;
  token: string;
  onClose: () => void;
  onSuccess: (checkoutUrl: string) => void;
}

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

function ActivateDemandModal({ listing, token, onClose, onSuccess }: ActivateDemandModalProps) {
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
      onSuccess(res.checkout_url || res.checkout_id);
    } catch (e: any) {
      setError(e?.message || 'Could not create payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#C5A57B]" />
            <span className="text-xs font-body font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              Activate Demand
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Fee display */}
          <div>
            {fee !== null ? (
              <p className="text-4xl font-display font-bold text-zinc-900 dark:text-white tracking-tight">
                {formatFee(fee)}
                <span className="text-sm font-body font-normal text-zinc-500 dark:text-zinc-400 ml-2">
                  one-off campaign fee
                </span>
              </p>
            ) : (
              <p className="text-sm text-zinc-500 italic">Fee calculated from listing price</p>
            )}
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Reignite demand for your listing at:{' '}
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {listing.title || 'this property'}
              </span>
            </p>
          </div>

          {/* Benefits */}
          <ul className="space-y-1.5">
            {BENEFIT_BULLETS.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-[#C5A57B] shrink-0 mt-0.5" />
                {b}
              </li>
            ))}
          </ul>

          {/* Typical outcome */}
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3.5">
            <p className="text-xs font-display font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
              Typical outcome
            </p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              More enquiries, renewed interest, and stronger offers — without relying on price cuts.
            </p>
          </div>

          {/* Advertising investment note */}
          <div>
            <p className="text-xs font-display font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
              Advertising Investment
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              The service fee is separate from and fully dedicated to promoting your listings. Your budget is tailored to the outcome you want to achieve and how aggressively you want to generate buyer demand.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            onClick={handleActivate}
            disabled={loading || fee === null}
            className="w-full py-3.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-display font-semibold text-sm tracking-wide hover:bg-zinc-700 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing…
              </>
            ) : (
              'Activate Demand'
            )}
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
}

function ListingCard({ listing, token }: ListingCardProps) {
  const [showReport, setShowReport] = useState(false);
  const [showActivate, setShowActivate] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fee = listing.price ? calculateFee(listing.price) : null;

  const handleActivateSuccess = (checkoutUrl: string) => {
    setShowActivate(false);
    if (checkoutUrl && checkoutUrl.startsWith('http')) {
      window.location.href = checkoutUrl;
    }
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/50 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      >
        {/* Image */}
        {listing.image_url && (
          <div className="relative h-44 bg-zinc-100 dark:bg-zinc-700 overflow-hidden">
            <img
              src={listing.image_url}
              alt={listing.title || 'Property'}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {listing.platform && (
              <span className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-white/90 dark:bg-zinc-900/90 rounded-full text-xs font-semibold text-zinc-700 dark:text-zinc-200 backdrop-blur-sm">
                {platformLabel(listing.platform)}
              </span>
            )}
          </div>
        )}

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Title + price */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-display font-semibold text-zinc-900 dark:text-white leading-snug line-clamp-2 flex-1">
                {listing.title || 'Untitled Listing'}
              </h3>
              {listing.external_url && (
                <a
                  href={listing.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-zinc-400 hover:text-[#C5A57B] transition-colors shrink-0 mt-0.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            {listing.price && (
              <p className="text-base font-display font-bold text-[#C5A57B] mt-0.5">{listing.price}</p>
            )}
            {listing.bedrooms && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{listing.bedrooms}</p>
            )}
          </div>

          {/* Description (collapsible) */}
          {listing.description && (
            <div>
              <p className={`text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
                {listing.description}
              </p>
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 mt-1 transition-colors"
              >
                {expanded ? (
                  <><ChevronUp className="w-3 h-3" /> Show less</>
                ) : (
                  <><ChevronDown className="w-3 h-3" /> Show more</>
                )}
              </button>
            </div>
          )}

          {/* Fee hint */}
          {fee !== null && (
            <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg px-3 py-2">
              <Zap className="w-3.5 h-3.5 text-[#C5A57B] shrink-0" />
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Advanced services fee:{' '}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatFee(fee)}</span>
                <span className="text-zinc-400 ml-1">(0.25% rounded up to nearest £500)</span>
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowReport(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-600 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C5A57B]" />
              AI Report
              <span className="text-zinc-400 font-normal">• Free</span>
            </button>
            <button
              onClick={() => setShowActivate(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-700 dark:hover:bg-zinc-100 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              Activate Demand
            </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showReport && (
          <AIReportModal
            listing={listing}
            token={token}
            onClose={() => setShowReport(false)}
          />
        )}
        {showActivate && (
          <ActivateDemandModal
            listing={listing}
            token={token}
            onClose={() => setShowActivate(false)}
            onSuccess={handleActivateSuccess}
          />
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

  // Load profile link + listings on mount
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
        const data = await api.agentGetListings(token);
        setListings(data);
      } catch {} finally {
        setListingsLoading(false);
      }
      setProfileLoading(false);
    })();
  }, [token]);

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
          : 'Profile synced — no listings found on this page. Check your profile URL points directly to your listings.',
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
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Page header */}
        <div>
          <p className="text-xs font-body uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1">
            Agent Dashboard
          </p>
          <h1 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">
            International Buyer Network
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
            Connect your listing portal profile to import your properties. Get a free AI analysis report for any listing, or activate our demand campaign — a one-off 0.25% fee rounded up to the nearest £500.
          </p>
        </div>

        {/* Profile URL card */}
        <div className="bg-white dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/50 p-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
              <Home className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
            </div>
            <div>
              <h2 className="text-sm font-display font-semibold text-zinc-900 dark:text-white">
                Your Listing Portal Profile
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Paste the URL to your agent profile page on Rightmove, Zoopla, OnTheMarket, etc.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              placeholder="https://www.rightmove.co.uk/estate-agents/agent/..."
              className="flex-1 px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#C5A57B]/40 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
              disabled={profileLoading}
            />
            <button
              onClick={handleSaveProfile}
              disabled={profileSaving || profileLoading || !profileUrl.trim()}
              className="px-4 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-sm font-semibold hover:bg-zinc-700 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
            >
              {profileSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Save
            </button>
          </div>

          {profileError && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-2">{profileError}</p>
          )}
          {profileSuccess && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Profile URL saved.
            </p>
          )}
          {savedPlatform && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
              Platform detected: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{platformLabel(savedPlatform)}</span>
              {lastSyncedLabel && <> · Last synced: {lastSyncedLabel}</>}
            </p>
          )}

          {/* Sync button */}
          {savedUrl && (
            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-700">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#C5A57B]/50 text-sm font-semibold text-[#C5A57B] hover:bg-[#C5A57B]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {syncing ? 'Syncing listings…' : 'Sync Listings from Portal'}
              </button>
              {syncError && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-2">{syncError}</p>
              )}
              {syncSuccess && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {syncSuccess}
                </p>
              )}
            </div>
          )}
        </div>

        {/* How it works */}
        {listings.length === 0 && !listingsLoading && (
          <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/40 p-5">
            <h3 className="text-sm font-display font-semibold text-zinc-900 dark:text-white mb-3">
              How it works
            </h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                {
                  step: '1',
                  icon: <Home className="w-4 h-4 text-[#C5A57B]" />,
                  title: 'Connect your portal',
                  desc: 'Paste your Rightmove, Zoopla or OnTheMarket agent profile URL above.',
                },
                {
                  step: '2',
                  icon: <FileText className="w-4 h-4 text-[#C5A57B]" />,
                  title: 'Get AI insights — free',
                  desc: 'Click "AI Report" on any imported listing for a free property analysis and action plan.',
                },
                {
                  step: '3',
                  icon: <Zap className="w-4 h-4 text-[#C5A57B]" />,
                  title: 'Activate demand',
                  desc: 'Pay a one-off 0.25% fee (min £500) to launch a targeted international buyer campaign.',
                },
              ].map((s) => (
                <div key={s.step} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#C5A57B]/10 flex items-center justify-center shrink-0 mt-0.5">
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-xs font-display font-semibold text-zinc-900 dark:text-white">{s.title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Listings */}
        {listingsLoading ? (
          <div className="flex items-center justify-center py-12 gap-3 text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading your listings…</span>
          </div>
        ) : listings.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-display font-semibold text-zinc-900 dark:text-white">
                  Your Listings
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {listings.length} listing{listings.length !== 1 ? 's' : ''} imported
                  {lastSyncedLabel ? ` · Last synced ${lastSyncedLabel}` : ''}
                </p>
              </div>
              <button
                onClick={handleSync}
                disabled={syncing || !savedUrl}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-600 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Refresh
              </button>
            </div>

            {syncError && (
              <p className="text-xs text-red-500 dark:text-red-400 mb-3">{syncError}</p>
            )}
            {syncSuccess && (
              <p className="text-xs text-green-600 dark:text-green-400 mb-3 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {syncSuccess}
              </p>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} token={token!} />
              ))}
            </div>
          </div>
        ) : null}

        {/* Free listing note */}
        <div className="text-center py-4">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Listing on Havlo is <span className="font-semibold text-zinc-600 dark:text-zinc-400">always free</span>. A 0.25% fee applies only when you activate our advanced demand services for a specific property.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

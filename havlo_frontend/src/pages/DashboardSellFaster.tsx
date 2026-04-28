import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, MessageSquare, PhoneCall, Search, Sparkles, X } from 'lucide-react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../hooks/useConfig';
import { api } from '../lib/api';
import { CountryCodeSelect } from '../components/shared/CountryCodeSelect';
import { TrustpilotStars } from '../components/ui/TrustpilotStars';
import { usePaymentReturnPoller } from '../lib/paymentReturn';
import {
  defaultRenewalDate,
  formatRenewalDate,
  getSellFasterPlan,
  getSellFasterSkipped,
  setSellFasterPlan,
  setSellFasterSkipped,
  type SellFasterPlanState,
} from '../lib/dashboardState';

interface Plan {
  id: string;
  name: string;
  tag: string;
  description: string;
  setupPrice: string;
  setupLabel?: string;
  monthlyPrice: string;
  setupAmount: number;
  monthlyAmount: number;
  ongoing: string;
  features: string[];
  outcome: string;
  idealFor: string;
  isPopular?: boolean;
  isDark?: boolean;
  isPrivate?: boolean;
  highlight?: string;
  footnote?: string;
  cta?: string;
}

const plans: Plan[] = [
  {
    id: 'launch',
    name: 'Launch',
    tag: 'Launch',
    description: 'For generating initial international interest',
    setupPrice: '£2,000',
    setupLabel: 'Initial Launch Investment',
    monthlyPrice: '£1,500',
    setupAmount: 2000,
    monthlyAmount: 1500,
    ongoing: 'Ongoing buyer demand generation and exposure from £1,500 / month',
    features: [
      'Targeted exposure across key international buyer markets',
      'High-impact campaign designed to capture attention quickly',
      'Private buyer registration page',
      'Enquiry capture and qualification',
      'Live visibility into buyer interest',
      'Designed to generate demand beyond traditional property portals',
      'No long-term commitment — continue based on performance',
    ],
    outcome:
      'Early buyer demand generated with a consistent flow of qualified enquiries to initiate market momentum.',
    idealFor:
      'Properties looking to attract new demand outside their immediate local market.',
    footnote: '* Best suited for initial exposure. For stronger competition, consider Amplify.',
    cta: 'Start Your Property Relaunch',
  },
  {
    id: 'amplify',
    name: 'Amplify',
    tag: 'Amplify',
    description: 'Designed to create strong buyer demand and competition',
    setupPrice: '£3,000',
    setupLabel: 'Initial Launch Investment',
    monthlyPrice: '£2,500',
    setupAmount: 3000,
    monthlyAmount: 2500,
    ongoing: 'Ongoing buyer demand generation and exposure from £2,500 / month',
    features: [
      'Expanded reach across multiple high-intent global markets',
      'Multi-format campaign engineered to drive engagement and enquiries',
      'Dedicated property landing experience',
      'Continuous optimisation to increase enquiry volume',
      'Weekly insights into buyer behaviour and demand trends',
      'Designed to generate demand beyond traditional property portals',
      'No long-term commitment — continue based on performance',
    ],
    outcome:
      'Sustained enquiry flow with increasing buyer competition, strengthening your negotiating position.',
    idealFor:
      'Sellers looking to attract multiple serious buyers and strengthen their negotiating position.',
    isPopular: true,
    highlight: 'MOST POPULAR',
    cta: 'Start Your Property Relaunch',
  },
  {
    id: 'dominate',
    name: 'Dominate',
    tag: 'Dominate',
    description: 'Maximum global exposure to drive premium offers',
    setupPrice: '£5,000',
    setupLabel: 'Initial Launch Investment',
    monthlyPrice: '£3,500',
    setupAmount: 5000,
    monthlyAmount: 3500,
    ongoing: 'Ongoing buyer demand generation and exposure from £3,500 / month',
    features: [
      'Extensive worldwide exposure across 30+ countries',
      'Full-scale campaign strategy designed for maximum visibility',
      'Advanced targeting to reach high-value international buyers',
      'Dedicated campaign management and optimisation',
      'Ongoing strategy refinement based on live demand data',
      'Designed to generate demand beyond traditional property portals',
      'No long-term commitment — continue based on performance',
    ],
    outcome:
      'High enquiry volume, strong buyer competition, and increased likelihood of achieving above-market offers.',
    idealFor:
      'Properties where maximising price and buyer competition is the priority.',
    cta: 'Start Your Property Relaunch',
  },
  {
    id: 'private-clients',
    name: 'Private Clients',
    tag: 'Private',
    description: 'Bespoke strategy for high-value and unique properties',
    setupPrice: 'Custom pricing',
    monthlyPrice: '',
    setupAmount: 0,
    monthlyAmount: 0,
    ongoing: 'Tailored to scope — discussed privately',
    features: [
      'Fully tailored global launch strategy',
      'Premium creative and campaign positioning',
      'Access to high-value international buyers',
      'Bespoke market targeting (UK + international)',
      'Advanced buyer targeting & optimisation',
      'Private buyer registration experience',
      'Live demand insights designed to generate demand beyond traditional portals',
      'Dedicated campaign management',
      'Ongoing strategic advisory',
    ],
    outcome:
      'Direct engagement from high-value buyers, intensified competition, and positioning to secure the strongest possible outcome.',
    idealFor:
      'High-value or unique properties where maximising buyer competition and final price is the priority.',
    isDark: true,
    isPrivate: true,
    cta: 'Request Private Consultation',
  },
];

// Big rings background reused on dark hero blocks.
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

// Green check used in plan feature lists (matches Figma design).
const FeatureTick: React.FC<{ light?: boolean }> = ({ light }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="mt-[3px] flex-shrink-0">
    <path d="M14.3726 7.16036L13.4659 6.10703C13.2926 5.90703 13.1526 5.5337 13.1526 5.26703V4.1337C13.1526 3.42703 12.5726 2.84703 11.8659 2.84703H10.7326C10.4726 2.84703 10.0926 2.70703 9.8926 2.5337L8.83927 1.62703C8.37927 1.2337 7.62594 1.2337 7.15927 1.62703L6.1126 2.54036C5.9126 2.70703 5.5326 2.84703 5.2726 2.84703H4.11927C3.4126 2.84703 2.8326 3.42703 2.8326 4.1337V5.2737C2.8326 5.5337 2.6926 5.90703 2.52594 6.10703L1.62594 7.16703C1.23927 7.62703 1.23927 8.3737 1.62594 8.8337L2.52594 9.8937C2.6926 10.0937 2.8326 10.467 2.8326 10.727V11.867C2.8326 12.5737 3.4126 13.1537 4.11927 13.1537H5.2726C5.5326 13.1537 5.9126 13.2937 6.1126 13.467L7.16594 14.3737C7.62594 14.767 8.37927 14.767 8.84594 14.3737L9.89927 13.467C10.0993 13.2937 10.4726 13.1537 10.7393 13.1537H11.8726C12.5793 13.1537 13.1593 12.5737 13.1593 11.867V10.7337C13.1593 10.4737 13.2993 10.0937 13.4726 9.8937L14.3793 8.84036C14.7659 8.38036 14.7659 7.62036 14.3726 7.16036ZM10.7726 6.74036L7.5526 9.96036C7.45927 10.0537 7.3326 10.107 7.19927 10.107C7.06594 10.107 6.93927 10.0537 6.84594 9.96036L5.2326 8.34703C5.03927 8.1537 5.03927 7.8337 5.2326 7.64036C5.42594 7.44703 5.74594 7.44703 5.93927 7.64036L7.19927 8.90036L10.0659 6.0337C10.2593 5.84036 10.5793 5.84036 10.7726 6.0337C10.9659 6.22703 10.9659 6.54703 10.7726 6.74036Z" fill={light ? 'currentColor' : '#149D4F'}/>
  </svg>
);

// Up-right arrow used inside black CTA pills.
const ArrowUpRightTiny: React.FC<{ className?: string }> = ({ className }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M3.5 10.5L10.5 3.5M10.5 3.5H4.66667M10.5 3.5V9.33333" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Property Demand Check modal — 3-step flow (form → loader → result)
// ─────────────────────────────────────────────────────────────────────────────

// Real country flag PNGs are downloaded into /public/flags so they ship with
// the static frontend bundle (no external CDN dependency at runtime).
const DEMAND_CHECK_MARKETS: { flag: string; name: string }[] = [
  { flag: '/flags/ae.png', name: 'UAE' },
  { flag: '/flags/sg.png', name: 'Singapore' },
  { flag: '/flags/us.png', name: 'USA' },
  { flag: '/flags/hk.png', name: 'Hong Kong' },
];

const buildMicroMessages = (city: string): string[] => {
  const cityLabel = city.trim() || 'your area';
  return [
    `Analysing international buyer demand for your property in ${cityLabel}…`,
    'Scanning international markets',
    'Matching your property with active buyers',
    'Identifying high-intent markets',
    'Estimating enquiry timelines',
    'Detecting high-value buyer demand',
    'Strong demand signals detected',
  ];
};

interface PropertyDemandCheckFlowProps {
  token: string | null;
  onCancel: () => void;
  onActivatePlan: () => void;
}

// Inline Property Demand Check flow rendered within the dashboard content
// area. Mirrors the onboarding form aesthetic (big black headline, soft-grey
// pill inputs, rounded-pill black CTA) with a 3-phase journey: form → 7s
// progress loader → buyer-market result.
const PropertyDemandCheckFlow: React.FC<PropertyDemandCheckFlowProps> = ({ token, onCancel, onActivatePlan }) => {
  // The flow has two screens: the form and the loader. The "result" is
  // shown as a popup modal *over* the form once the loader finishes — it is
  // no longer a third in-page step.
  const [step, setStep] = useState<'form' | 'loading'>('form');
  const [showResultModal, setShowResultModal] = useState(false);
  const [propertyAddress, setPropertyAddress] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [listingUrl, setListingUrl] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [microIndex, setMicroIndex] = useState(0);

  // 13-second loader: animate 0→100% and rotate through the micro-messages.
  // When complete, return to the form view and open the result popup on top.
  useEffect(() => {
    if (step !== 'loading') return;
    const totalMs = 13000;
    const start = performance.now();
    let raf = 0;
    const messages = buildMicroMessages(city);

    const tick = () => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, Math.round((elapsed / totalMs) * 100));
      setProgress(pct);
      const idx = Math.min(messages.length - 1, Math.floor((elapsed / totalMs) * messages.length));
      setMicroIndex(idx);
      if (elapsed < totalMs) {
        raf = requestAnimationFrame(tick);
      } else {
        setProgress(100);
        setMicroIndex(messages.length - 1);
        setStep('form');
        setShowResultModal(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, city]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyAddress.trim() || !city.trim() || !postcode.trim()) {
      setError('Please fill in your property address, city and postcode.');
      return;
    }
    if (!token) {
      setError('You need to be signed in to run a demand check.');
      return;
    }
    setError('');
    setSubmitting(true);
    // Fire-and-forget: log to Google Sheets in the background. Sheets
    // availability does not gate the user-facing analyser experience.
    api
      .submitPropertyDemandCheck(token, {
        property_address: propertyAddress.trim(),
        city: city.trim(),
        postcode: postcode.trim(),
        listing_url: listingUrl.trim() || undefined,
      })
      .catch(() => { /* logging failure is non-fatal */ });
    setSubmitting(false);
    setStep('loading');
  };

  const messages = buildMicroMessages(city);
  const currentMicro = messages[microIndex] || messages[0];

  // While we're on the form step we use a two-pane layout (form on the left,
  // gradient testimonial panel on the right) that mirrors the public
  // Onboarding screen. The loading and result steps fall back to the original
  // narrow single-column layout so they stay visually centered.
  if (step === 'form') {
    return (
      <div className="-mx-4 sm:-mx-6 lg:-mx-0">
        <div className="flex flex-col lg:flex-row lg:min-h-[calc(100vh-160px)]">
          {/* Left side: form */}
          <div className="flex-1 flex flex-col gap-8 px-6 py-10 sm:px-8 lg:px-12 lg:py-14">
            <button
              type="button"
              onClick={onCancel}
              className="flex w-fit items-center gap-2 rounded-lg bg-[#F4F4F4] px-3 py-2 transition-colors hover:bg-gray-200"
            >
              <ChevronLeft size={16} />
              <span className="font-body text-sm font-semibold text-black">Go back</span>
            </button>

            <motion.form
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleSubmit}
              className="flex max-w-[580px] flex-col gap-8"
            >
              <div className="flex flex-col gap-3">
                <h1 className="font-display text-[40px] font-black leading-none tracking-[-1.12px] text-black sm:text-[48px] lg:text-[56px]">
                  Tell us about your property
                </h1>
                <p className="font-body text-base font-medium leading-[1.5] tracking-[-0.32px] text-black/80">
                  Enter a few details so we can analyse buyer demand and identify your strongest international markets.
                </p>
              </div>

              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="font-body text-sm font-semibold tracking-[-0.28px] text-black">
                    Property Address
                  </label>
                  <input
                    type="text"
                    value={propertyAddress}
                    onChange={(e) => setPropertyAddress(e.target.value)}
                    placeholder="e.g. 12 Kensington Gardens"
                    className="h-14 w-full rounded-xl border border-[#3A3C3E]/10 bg-[#242628]/5 px-4 font-body text-base font-medium text-black outline-none placeholder:text-black/50"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-body text-sm font-semibold tracking-[-0.28px] text-black">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. London"
                    className="h-14 w-full rounded-xl border border-[#3A3C3E]/10 bg-[#242628]/5 px-4 font-body text-base font-medium text-black outline-none placeholder:text-black/50"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-body text-sm font-semibold tracking-[-0.28px] text-black">
                    Postcode
                  </label>
                  <input
                    type="text"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    placeholder="e.g. SW7 2AR"
                    className="h-14 w-full rounded-xl border border-[#3A3C3E]/10 bg-[#242628]/5 px-4 font-body text-base font-medium text-black outline-none placeholder:text-black/50"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-body text-sm font-semibold tracking-[-0.28px] text-black">
                    Listing URL <span className="font-medium text-black/55">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={listingUrl}
                    onChange={(e) => setListingUrl(e.target.value)}
                    placeholder="https://"
                    className="h-14 w-full rounded-xl border border-[#3A3C3E]/10 bg-[#242628]/5 px-4 font-body text-base font-medium text-black outline-none placeholder:text-black/50"
                  />
                  <p className="font-body text-xs font-medium text-black/55">
                    Provide your existing listing link for more accurate buyer insights.
                  </p>
                </div>
              </div>

              {error && (
                <p className="font-body text-sm font-medium text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-14 w-full max-w-[280px] items-center justify-center gap-2 rounded-[48px] bg-black font-body text-lg font-bold tracking-[-0.36px] text-white transition-colors hover:bg-black/90 disabled:opacity-50"
              >
                <Search size={18} />
                Analyse my property
              </button>
            </motion.form>
          </div>

          {/* Right side: gradient testimonial panel — hidden on mobile so the
              form takes the full width on small screens, matching Onboarding. */}
          <div className="hidden lg:flex flex-1 bg-gradient-to-b from-[#9BD9FF] via-[#FFB0E8] to-[#FEEAA0] items-center justify-center p-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-[402px] bg-white rounded-2xl border-[1.5px] border-black overflow-hidden shadow-xl"
            >
              <div className="p-6 flex flex-col gap-16">
                <div className="flex flex-col gap-6">
                  <img
                    src="https://api.builder.io/api/v1/image/assets/TEMP/6f2723c232f5b302a2b616f7a1986aa7610e378e?width=272"
                    alt="Havlo Logo"
                    className="w-[136px] h-8 object-contain"
                  />
                  <p className="font-body text-sm font-medium leading-[1.5] tracking-[-0.28px] text-black/80">
                    From relaunch to completion, we expose your property to qualified international buyers — <span className="font-bold">seamlessly and with confidence.</span>
                  </p>
                </div>
              </div>
              <div className="p-6 border-t border-black/10 flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-body text-xl font-bold text-[#277453]">Rated</span>
                    <TrustpilotStars className="h-6" />
                  </div>
                  <p className="font-body text-sm font-bold text-black/80 leading-[1.5] tracking-[-0.28px]">
                    Rated Excellent based on over 1,000 customer reviews.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Result popup — opens once the loader finishes and the flow returns
            to the form view. Must live inside this branch so it actually
            renders when step==='form'. */}
        <DemandCheckResultModal
          open={showResultModal}
          onClose={() => setShowResultModal(false)}
          onActivatePlan={onActivatePlan}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-8 px-4 py-8 sm:px-6 lg:py-12">
      {/* Persistent "Go back" — cancels the flow and returns to the dashboard. */}
      <button
        type="button"
        onClick={onCancel}
        className="flex w-fit items-center gap-2 rounded-lg bg-[#F4F4F4] px-3 py-2 transition-colors hover:bg-gray-200"
      >
        <ChevronLeft size={16} />
        <span className="font-body text-sm font-semibold text-black">Go back</span>
      </button>

      <AnimatePresence mode="wait">
        {step === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="flex flex-col items-center gap-8 py-10 text-center sm:py-16"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#A409D2] text-white">
              <Sparkles size={28} />
            </div>
            <h2 className="font-display text-[32px] font-black leading-[1.1] tracking-[-1px] text-black sm:text-[40px]">
              Running your property demand check
            </h2>

            <div className="w-full max-w-[480px]">
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
                <motion.div
                  className="h-full bg-[#A409D2]"
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: 'linear', duration: 0.05 }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between font-body text-xs font-semibold text-black/60">
                <span>Analysing…</span>
                <span>{progress}%</span>
              </div>
            </div>

            <div className="min-h-[48px] w-full max-w-[480px]">
              <AnimatePresence mode="wait">
                <motion.p
                  key={microIndex}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="font-body text-base font-medium leading-[1.5] text-black/75"
                >
                  {currentMicro}
                </motion.p>
              </AnimatePresence>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Result popup — opens once the loader finishes */}
      <DemandCheckResultModal
        open={showResultModal}
        onClose={() => setShowResultModal(false)}
        onActivatePlan={onActivatePlan}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Result popup shown after the demand-check loader completes.
// ─────────────────────────────────────────────────────────────────────────────

interface DemandCheckResultModalProps {
  open: boolean;
  onClose: () => void;
  onActivatePlan: () => void;
}

const DemandCheckResultModal: React.FC<DemandCheckResultModalProps> = ({ open, onClose, onActivatePlan }) => {
  // Lock the page scroll while the modal is open and allow ESC to close.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="demand-result-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-6 sm:px-6"
        >
          <motion.div
            key="demand-result-card"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[640px] overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-black transition-colors hover:bg-black/10"
            >
              <X size={18} />
            </button>

            {/* Header banner */}
            <div className="flex items-center gap-3 bg-[#A409D2]/10 px-6 py-4 sm:px-8">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#A409D2] text-white">
                <Sparkles size={18} />
              </div>
              <span className="font-display text-xs font-extrabold uppercase tracking-[0.14em] text-[#A409D2]">
                Property analysis complete
              </span>
            </div>

            {/* Body */}
            <div className="flex flex-col gap-6 px-6 py-6 sm:px-8 sm:py-8">
              <div className="flex flex-col gap-3">
                <h2 className="font-display text-[26px] font-black leading-[1.15] tracking-[-0.6px] text-black sm:text-[32px]">
                  Your property shows strong potential to attract international buyers and generate competition.
                </h2>
                <p className="font-body text-sm font-medium leading-[1.5] tracking-[-0.28px] text-black/70 sm:text-base">
                  Based on current global buyer activity and comparable properties.
                </p>
              </div>

              {/* Top buyer markets — real flags */}
              <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-5 sm:p-6">
                <p className="font-display text-xs font-extrabold uppercase tracking-[0.12em] text-black/80">
                  Top buyer markets for your property
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {DEMAND_CHECK_MARKETS.map((m) => (
                    <div
                      key={m.name}
                      className="flex flex-col items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-4 text-center"
                    >
                      <img
                        src={m.flag}
                        alt={`${m.name} flag`}
                        className="h-8 w-12 rounded-md border border-black/10 object-cover"
                        loading="lazy"
                      />
                      <span className="font-body text-sm font-semibold tracking-[-0.28px] text-black">
                        {m.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="font-body text-sm leading-[1.55] text-black/70 sm:text-base">
                Multiple international regions have been identified where your property is likely to attract buyers faster, with demand typically generated within <span className="font-semibold text-black">2-8 weeks</span>.
              </p>

              <button
                type="button"
                onClick={onActivatePlan}
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[48px] bg-[#A409D2] px-6 font-body text-base font-bold tracking-[-0.32px] text-white transition-colors hover:bg-[#8c08b3]"
              >
                Activate My Property Relaunch Plan
                <ArrowUpRightTiny />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const DashboardSellFaster: React.FC = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const config = useConfig();
  const calendlyLink = config.calendly_link || 'https://calendly.com/hello-heyhavlo/havlo-enquiry-call';

  // ── view state ─────────────────────────────────────────────────────────
  const [storedPlan, setStoredPlan] = useState<SellFasterPlanState | null>(getSellFasterPlan());
  const [skipped, setSkipped] = useState<boolean>(getSellFasterSkipped());
  const [forcePlansView, setForcePlansView] = useState<boolean>(false);

  // Default to the main dashboard view for everyone (including newly registered
  // sellers who have no plan). Users reach the Plans view by clicking SUBSCRIBE
  // on the "NO ACTIVE PLAN" bar (which sets forcePlansView=true).
  const showMain = !forcePlansView;

  // ── form drawer state ──────────────────────────────────────────────────
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPrivateClientModalOpen, setIsPrivateClientModalOpen] = useState(false);
  const [contactPreference, setContactPreference] = useState<'you' | 'agent'>('you');
  const [listingUrl, setListingUrl] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPhoneCode, setContactPhoneCode] = useState('+44');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Property Demand Check inline flow state ──────────────────────────
  const [isDemandCheckOpen, setIsDemandCheckOpen] = useState(false);

  const handlePlanSelect = (plan: Plan) => {
    if (plan.isPrivate) {
      setIsPrivateClientModalOpen(true);
      return;
    }
    setSelectedPlan(plan);
    setIsDrawerOpen(true);
  };

  // After successful payment redirect, persist the selected plan locally so
  // the user lands on the subscribed dashboard view.
  usePaymentReturnPoller({
    kind: 'sell_faster',
    token,
    fetchStatus: (id) => api.getSellFasterPaymentStatus(token!, id),
    onPaid: () => {
      try {
        const persisted = JSON.parse(localStorage.getItem('havlo:sell_faster_pending') || 'null') as Plan | null;
        const planForState: SellFasterPlanState = {
          id: persisted?.id || 'launch',
          name: persisted?.name || 'Launch',
          tag: (persisted?.name || 'Launch').replace(/\s*\(Most Popular\)/i, '').toUpperCase() + ' PLAN',
          setupPrice: persisted?.setupPrice || '£2,000',
          monthlyPrice: persisted?.monthlyPrice || '£1,500',
          renewsAt: defaultRenewalDate(),
        };
        setSellFasterPlan(planForState);
        setStoredPlan(planForState);
        setSkipped(false);
        setForcePlansView(false);
        localStorage.removeItem('havlo:sell_faster_pending');
      } catch {
        /* ignore */
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedPlan) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      // Stash the chosen plan so the success poller can persist it after redirect.
      try { localStorage.setItem('havlo:sell_faster_pending', JSON.stringify(selectedPlan)); } catch { /* ignore */ }
      const result = await api.submitSellFaster(token, {
        plan_id: selectedPlan.id,
        plan_name: selectedPlan.name,
        property_address: listingUrl || 'Not provided',
        property_type: 'Residential',
        contact_preference: contactPreference,
        target_countries: ['International'],
        agent_name: contactPreference === 'agent' ? contactName : undefined,
        agent_email: contactPreference === 'agent' ? contactEmail : undefined,
        agent_phone: contactPreference === 'agent' ? contactPhone : undefined,
      });
      setIsDrawerOpen(false);
      if (!result.checkout_id) throw new Error('Missing checkout ID from payment gateway.');
      const { redirectToCheckout } = await import('../lib/paymentReturn');
      redirectToCheckout(result.checkout_id, {
        kind: 'sell_faster',
        recordId: result.application_id,
        reference: result.checkout_id,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    setSellFasterSkipped(true);
    setSkipped(true);
    setForcePlansView(false);
  };

  const handleUpgrade = () => {
    setForcePlansView(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <DashboardLayout title="Sell faster — Relaunch">
      {isDemandCheckOpen ? (
        <PropertyDemandCheckFlow
          token={token}
          onCancel={() => setIsDemandCheckOpen(false)}
          onActivatePlan={() => {
            setIsDemandCheckOpen(false);
            handleUpgrade();
          }}
        />
      ) : showMain ? (
        <SellFasterMain
          plan={storedPlan}
          firstName={user?.first_name}
          calendlyLink={calendlyLink}
          onUpgrade={handleUpgrade}
          onTrackProgress={() => navigate('/dashboard/inbox')}
          onMessage={() => navigate('/dashboard/inbox')}
          onAnalyseProperty={() => setIsDemandCheckOpen(true)}
        />
      ) : (
        <SellFasterPlansView
          onSelect={handlePlanSelect}
          onSkip={storedPlan ? undefined : handleSkip}
        />
      )}

      {/* Submission drawer */}
      <AnimatePresence>
        {isDrawerOpen && selectedPlan && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[500px] flex-col bg-[#F4F5F4] shadow-2xl"
            >
              <div className="flex h-16 items-center justify-between border-b border-[#F1F1F0] bg-white px-6">
                <h3 className="font-display text-xl font-medium tracking-tight text-black">
                  Listing & buyer enquiry details
                </h3>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="rounded-md bg-[#EFEFEF] p-2 transition-colors hover:bg-gray-200"
                >
                  <X size={16} className="text-[#030517]" />
                </button>
              </div>

              <form id="sell-faster-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="border-b border-black/10 pb-8">
                  <h4 className="mb-6 font-display text-xl font-medium text-black">1. Current Listing</h4>
                  <label className="mb-4 block font-body text-sm font-bold text-[#001C47]">
                    Link of where the property is currently listed
                  </label>
                  <input
                    type="text"
                    value={listingUrl}
                    onChange={(e) => setListingUrl(e.target.value)}
                    placeholder="(Paste Rightmove / Zoopla / other listing URL)"
                    className="h-12 w-full rounded-lg border border-black/5 bg-white px-4 font-body text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>

                <div className="border-b border-black/10 pb-8">
                  <h4 className="mb-6 font-display text-xl font-medium text-black">2. Buyer enquiry contact preference</h4>
                  <label className="mb-4 block font-body text-sm font-bold text-black">
                    Who would you like potential buyers to contact?
                  </label>
                  <div className="space-y-4">
                    {(['you', 'agent'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setContactPreference(opt)}
                        className="flex items-center gap-3"
                      >
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                          contactPreference === opt ? 'border-[#00BC67] bg-[#00BC67]' : 'border-[#3A3C3E]'
                        }`}>
                          {contactPreference === opt && <Check size={14} className="text-black" />}
                        </div>
                        <span className="font-body text-sm font-medium text-black/80">
                          {opt === 'you' ? 'You' : 'Your Agent'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pb-4">
                  <h4 className="mb-6 font-display text-xl font-medium text-black">3. Contact details for buyer enquiries</h4>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="block font-body text-sm font-bold text-[#001C47]">Contact name / agent name</label>
                      <input
                        type="text"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Enter name"
                        className="h-12 w-full rounded-lg border border-black/5 bg-white px-4 font-body text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="block font-body text-sm font-bold text-[#001C47]">Email for buyer enquiries</label>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="Enter email"
                        className="h-12 w-full rounded-lg border border-black/5 bg-white px-4 font-body text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="block font-body text-sm font-bold text-[#001C47]">Contact phone number</label>
                      <div className="flex items-center gap-2">
                        <div className="flex h-12 items-center rounded-lg bg-[#DDD] px-2">
                          <CountryCodeSelect value={contactPhoneCode} onChange={setContactPhoneCode} buttonClassName="bg-transparent hover:bg-black/5" />
                        </div>
                        <input
                          type="tel"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="0000 0000 000"
                          className="h-12 flex-1 rounded-lg border border-black/5 bg-white px-4 font-body text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </form>

              <div className="border-t border-[#F1F1F0] bg-white p-6">
                {submitError && <p className="mb-3 font-body text-sm text-red-500">{submitError}</p>}
                <button
                  type="submit"
                  form="sell-faster-form"
                  disabled={submitting}
                  className="h-[60px] w-full rounded-full bg-black text-base font-semibold uppercase tracking-tight text-white transition-colors hover:bg-black/90 disabled:opacity-50"
                >
                  {submitting ? 'SUBMITTING…' : 'SUBMIT & PROCEED TO PAYMENT'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Private clients modal */}
      <AnimatePresence>
        {isPrivateClientModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsPrivateClientModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-[560px] rounded-[20px] bg-white p-8 shadow-2xl"
            >
              <button
                onClick={() => setIsPrivateClientModalOpen(false)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 hover:bg-black/10"
              >
                <X size={16} />
              </button>
              <h3 className="pr-8 font-display text-[32px] font-black leading-[1.1] text-black">
                {user?.first_name ? `${user.first_name}! We've got your details.` : `We've got your details.`}
              </h3>
              <p className="mt-4 font-body text-base text-black/70">
                A dedicated advisor will be in touch shortly. Want to speak with us right away? Choose how you'd like to connect:
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <a
                  href="https://wa.me/message/PPPAWIAXBS7YK1"
                  target="_blank" rel="noopener noreferrer"
                  className="flex h-12 items-center justify-center rounded-full bg-[#60D769] px-6 font-body text-base font-semibold text-white"
                >
                  Chat with us on WhatsApp
                </a>
                <a
                  href={calendlyLink}
                  target="_blank" rel="noopener noreferrer"
                  className="flex h-12 items-center justify-center rounded-full bg-black px-6 font-body text-base font-semibold text-white"
                >
                  Book a Calendly call
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Plans view
// ─────────────────────────────────────────────────────────────────────────────
interface PlansProps {
  onSelect: (plan: Plan) => void;
  onSkip?: () => void;
}

const SellFasterPlansView: React.FC<PlansProps> = ({ onSelect, onSkip }) => (
  <div className="mx-auto max-w-[1200px] px-4 py-6 pb-20 sm:px-6 lg:py-10">
    <div className="relative mb-8 overflow-hidden rounded-[20px] bg-black p-6 sm:p-10 lg:mb-10">
      <div className="relative z-10 max-w-[800px]">
        <h2 className="mb-6 font-display text-3xl font-black leading-none tracking-tight text-white sm:text-[40px]">
          Property on the market for 6+ months?
        </h2>
        <p className="max-w-[740px] font-body text-base font-medium leading-relaxed text-white/80">
          It's time for a smarter exit strategy. We relaunch underperforming listings with refined positioning and targeted buyer exposure to drive renewed interest and faster offers.
        </p>
      </div>
      <HeroRings />
    </div>

    <h3 className="mb-6 font-display text-2xl font-black tracking-tight text-black sm:mb-8 sm:text-[32px]">
      Choose a relaunch plan
    </h3>

    <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} onSelect={() => onSelect(plan)} />
      ))}
    </div>

    {onSkip && (
      <div className="mt-8 flex justify-center">
        <button
          onClick={onSkip}
          className="font-body text-sm font-medium text-black/60 underline-offset-4 hover:text-black hover:underline"
        >
          Skip for now — go to dashboard
        </button>
      </div>
    )}
  </div>
);

const PlanCard: React.FC<{ plan: Plan; onSelect: () => void }> = ({ plan, onSelect }) => {
  const isPurple = !!plan.isPopular;
  const isDark = !!plan.isDark;
  const isLight = !isPurple && !isDark;
  const onColored = isPurple || isDark;

  const containerClass = [
    'relative flex flex-col p-6 lg:p-7',
    isPurple && 'bg-[#A409D2] text-white',
    isDark && 'bg-[#0c0c0c] text-white',
    isLight && 'border border-black/12 bg-white text-black',
  ].filter(Boolean).join(' ');

  const ctaClass = [
    'flex h-11 w-full items-center justify-center px-5 font-body text-[13px] font-semibold transition',
    isPurple && 'bg-white text-black hover:bg-white/90',
    isDark && 'border border-white bg-black text-white hover:bg-white/10',
    isLight && 'bg-black text-white hover:bg-black/85',
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClass}>
      {plan.highlight && (
        <div className="absolute right-5 top-5 rounded-full bg-white px-3 py-1 font-body text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#A409D2]">
          {plan.highlight}
        </div>
      )}

      <h3
        className={`font-display text-[26px] font-black leading-none tracking-[-0.5px] sm:text-[28px] ${
          plan.isPrivate ? 'uppercase tracking-[0.04em] text-[24px] sm:text-[26px]' : ''
        }`}
      >
        {plan.name}
      </h3>
      <p
        className={`mt-3 min-h-[42px] font-body text-[13px] font-medium leading-[1.4] ${
          onColored ? 'text-white/80' : 'text-black/65'
        }`}
      >
        {plan.description}
      </p>

      <div className={`mt-5 border-t pt-5 ${onColored ? 'border-white/15' : 'border-black/12'}`}>
        <div className="font-display text-[20px] leading-[1.2]">
          <span className="font-extrabold">{plan.setupPrice}</span>
          {plan.setupLabel && (
            <span className="ml-1.5 font-body text-[15px] font-normal">{plan.setupLabel}</span>
          )}
        </div>
        <p
          className={`mt-1 font-body text-xs font-semibold ${
            onColored ? 'text-white/70' : 'text-black/60'
          }`}
        >
          {plan.ongoing}
        </p>
      </div>

      <ul className="mt-5 flex flex-col gap-2.5">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <FeatureTick light={onColored} />
            <span
              className={`font-body text-[13px] font-medium leading-[1.45] ${
                onColored ? 'text-white/85' : 'text-black/72'
              }`}
            >
              {f}
            </span>
          </li>
        ))}
      </ul>

      <div
        className={`mt-6 rounded-md p-4 ${
          isPurple ? 'bg-white/10' : isDark ? 'bg-white/8' : 'bg-black/4'
        }`}
      >
        <p
          className={`font-body text-[12px] font-extrabold uppercase tracking-[0.12em] ${
            onColored ? 'text-white' : 'text-black'
          }`}
        >
          Typical outcome:
        </p>
        <p
          className={`mt-1.5 font-body text-[12px] font-medium leading-[1.5] ${
            onColored ? 'text-white/80' : 'text-black/68'
          }`}
        >
          {plan.outcome}
        </p>

        <p
          className={`mt-3 font-body text-[12px] font-extrabold uppercase tracking-[0.12em] ${
            onColored ? 'text-white' : 'text-black'
          }`}
        >
          Ideal for:
        </p>
        <p
          className={`mt-1.5 font-body text-[12px] font-medium leading-[1.5] ${
            onColored ? 'text-white/80' : 'text-black/68'
          }`}
        >
          {plan.idealFor}
        </p>
      </div>

      {plan.footnote && (
        <p
          className={`mt-4 font-body text-[11px] font-medium italic ${
            onColored ? 'text-white/70' : 'text-black/55'
          }`}
        >
          {plan.footnote}
        </p>
      )}

      <div className="mt-auto pt-6">
        <button type="button" onClick={onSelect} className={ctaClass}>
          {plan.cta || 'Start Your Property Relaunch'}
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main subscribed dashboard view
// ─────────────────────────────────────────────────────────────────────────────
interface MainProps {
  plan: SellFasterPlanState | null;
  firstName?: string;
  calendlyLink: string;
  onUpgrade: () => void;
  onTrackProgress: () => void;
  onMessage: () => void;
  onAnalyseProperty: () => void;
}

const SellFasterMain: React.FC<MainProps> = ({ plan, firstName, calendlyLink, onUpgrade, onTrackProgress, onMessage, onAnalyseProperty }) => {
  const displayName = (firstName || 'there').toUpperCase();
  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6 pb-20 sm:px-6 lg:space-y-8 lg:py-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[20px] bg-black p-6 sm:p-10">
        <div className="relative z-10 max-w-[800px]">
          <h2 className="mb-6 font-display text-2xl font-black leading-none tracking-tight text-white sm:text-[40px]">
            Property on the market for 6+ months?
          </h2>
          <p className="max-w-[740px] font-body text-sm font-medium leading-relaxed text-white/80 sm:text-base">
            It's time for a smarter exit strategy. We relaunch underperforming listings with refined positioning and targeted buyer exposure to drive renewed interest and faster offers.
          </p>
        </div>
        <HeroRings />
      </div>

      {/* Subscribed plan card OR subscribe-prompt card */}
      {plan ? (
        <div className="flex flex-col gap-4 rounded-[14px] border border-black/10 bg-white p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="bg-[#A409D2] px-2 py-1 font-display text-[12px] font-bold uppercase tracking-tight text-white">
                {plan.tag}
              </span>
              <span className="font-display text-[15px] font-semibold tracking-tight text-black">
                <span className="font-black">{plan.setupPrice}</span> INITIAL LAUNCH INVESTMENT
              </span>
            </div>
            <p className="font-body text-[14px] text-black/60">renews {formatRenewalDate(plan.renewsAt)}</p>
          </div>
          <button
            onClick={onUpgrade}
            className="inline-flex h-12 items-center justify-center gap-2 self-start rounded-full bg-black px-6 font-body text-[13px] font-bold uppercase tracking-tight text-white hover:bg-black/90 lg:self-auto"
          >
            UPGRADE PLAN FOR MORE
            <ArrowUpRightTiny />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-[14px] border border-dashed border-black/15 bg-white p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onUpgrade}
                className="bg-black/85 px-2 py-1 font-display text-[12px] font-bold uppercase tracking-tight text-white transition-colors hover:bg-black"
              >
                NO ACTIVE PLAN
              </button>
              <span className="font-display text-[15px] font-semibold tracking-tight text-black">
                Run Your Property Demand Check
              </span>
            </div>
            <p className="font-body text-[14px] text-black/60">
              Run a quick check to see how your property could perform with global buyer exposure — before you commit.
            </p>
          </div>
          <button
            onClick={onAnalyseProperty}
            className="inline-flex h-12 items-center justify-center gap-2 self-start rounded-full bg-black px-6 font-body text-[13px] font-bold uppercase tracking-tight text-white hover:bg-black/90 lg:self-auto"
          >
            ANALYSE MY PROPERTY
            <ArrowUpRightTiny />
          </button>
        </div>
      )}

      {/* Welcome card (purple) */}
      <div className="overflow-hidden rounded-[20px] border-[3px] border-black bg-[#A409D2] p-8 text-center sm:p-12">
        <p className="font-body text-base font-medium text-white">Hi</p>
        <h3 className="mt-2 font-display text-[44px] font-black leading-none tracking-tight text-white sm:text-[56px]">
          {displayName}
        </h3>
        <p className="mx-auto mt-5 max-w-[640px] font-body text-sm font-medium leading-relaxed text-white sm:text-base">
          Welcome to your dashboard — track your property exposure campaigns and your property sale audit.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={onTrackProgress}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 font-body text-[14px] font-semibold tracking-tight text-black hover:bg-white/95"
          >
            <MessageSquare size={16} />
            Track Progress
          </button>
          <button
            type="button"
            onClick={onUpgrade}
            className="font-body text-[13px] font-semibold tracking-tight text-white underline underline-offset-4 hover:text-white/80"
          >
            View plans &amp; pricing
          </button>
        </div>
      </div>

      {/* Specialists card (blue) */}
      <div className="overflow-hidden rounded-[20px] border-[3px] border-black bg-[#BBDDF8] p-6 sm:p-8">
        <h3 className="font-display text-2xl font-black leading-tight tracking-tight text-black sm:text-[28px]">
          Your property exposure specialists
        </h3>
        <p className="mt-4 font-display text-[15px] font-bold text-black">Need help? Contact your Havlo team here</p>
        <p className="mt-3 font-body text-[14px] leading-relaxed text-black/85">
          This is your team, but on occasion (when they're on holiday, busy or away due to illness) you might be contacted by other Havlo team members
        </p>

        <div className="mt-6 flex flex-col gap-4 rounded-[14px] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="shrink-0">
              <SpecialistAvatars />
            </div>
            <span className="min-w-0 font-display text-[15px] font-bold leading-snug text-black">
              Your property exposure specialists
            </span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onMessage}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-black px-5 font-body text-[13px] font-semibold tracking-tight text-white hover:bg-black/90"
            >
              <MessageSquare size={15} />
              Message
            </button>
            <a
              href={calendlyLink}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-black px-5 font-body text-[13px] font-semibold tracking-tight text-white hover:bg-black/90"
            >
              <PhoneCall size={15} />
              Book a call
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

// Stack of team specialist avatars (overlapping circles with real photos).
const SpecialistAvatars: React.FC = () => {
  const team = useMemo(
    () => [
      { src: '/team-avatars/avatar1.jpg', name: 'Jess A.' },
      { src: '/team-avatars/avatar2.jpg', name: 'Kwame M.' },
      { src: '/team-avatars/avatar3.jpg', name: 'Liam P.' },
      { src: '/team-avatars/avatar4.jpg', name: 'Rachel S.' },
      { src: '/team-avatars/avatar5.jpg', name: 'David O.' },
    ],
    []
  );
  return (
    <div className="flex -space-x-3">
      {team.map((p, i) => (
        <img
          key={i}
          src={p.src}
          alt={p.name}
          className="h-10 w-10 rounded-full border-2 border-white object-cover shadow-sm"
          loading="lazy"
        />
      ))}
    </div>
  );
};


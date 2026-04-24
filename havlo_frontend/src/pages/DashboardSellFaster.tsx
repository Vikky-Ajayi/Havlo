import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Check, MessageSquare, PhoneCall, X } from 'lucide-react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../hooks/useConfig';
import { api } from '../lib/api';
import { CountryCodeSelect } from '../components/shared/CountryCodeSelect';
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
  monthlyPrice: string;
  setupAmount: number;
  monthlyAmount: number;
  features: string[];
  outcome: string;
  idealFor: string;
  isPopular?: boolean;
  isDark?: boolean;
  isPrivate?: boolean;
  footnote?: string;
}

const plans: Plan[] = [
  {
    id: 'launch',
    name: 'Launch',
    tag: 'Launch',
    description: 'For generating initial international interest',
    setupPrice: '£2,000',
    monthlyPrice: '£1,500',
    setupAmount: 2000,
    monthlyAmount: 1500,
    features: [
      'Targeted exposure across key international buyer markets',
      'High-impact campaign designed to capture attention quickly',
      'Private buyer registration page',
      'Enquiry capture and qualification',
      'Live visibility into buyer interest',
      'Designed to generate demand beyond traditional property portals',
      'No long-term commitment. Continue based on performance',
    ],
    outcome:
      'Early buyer demand generated with a consistent flow of qualified enquiries to initiate market momentum',
    idealFor:
      'Properties looking to attract new demand outside their immediate local market',
    footnote: '* Best suited for initial exposure. For stronger competition, consider Amplify*',
  },
  {
    id: 'amplify',
    name: 'Amplify (Most Popular)',
    tag: 'Amplify',
    description: 'Designed to create strong buyer demand and competition',
    setupPrice: '£3,500',
    monthlyPrice: '£2,500',
    setupAmount: 3500,
    monthlyAmount: 2500,
    features: [
      'Expanded reach across multiple high-intent global markets',
      'Multi-format campaign engineered to drive engagement and enquiries',
      'Dedicated property landing experience',
      'Continuous optimisation to increase enquiry volume',
      'Weekly insights into buyer behaviour and demand trends',
      'Designed to generate demand beyond traditional property portals',
      'No long-term commitment. Continue based on performance',
    ],
    outcome:
      'Sustained enquiry flow with increasing buyer competition, strengthening your negotiating position',
    idealFor:
      'Sellers looking to attract multiple serious buyers and strengthen negotiating position',
    isPopular: true,
  },
  {
    id: 'dominate',
    name: 'Dominate',
    tag: 'Dominate',
    description: 'Maximum global exposure to drive premium offers',
    setupPrice: '£5,000',
    monthlyPrice: '£3,500',
    setupAmount: 5000,
    monthlyAmount: 3500,
    features: [
      'Extensive worldwide exposure across 30+ countries',
      'Full-scale campaign strategy designed for maximum visibility',
      'Advanced targeting to reach high-value international buyers',
      'Dedicated campaign management and optimisation',
      'Ongoing strategy refinement based on live demand data',
      'Designed to generate demand beyond traditional property portals',
      'No long-term commitment. Continue based on performance',
    ],
    outcome:
      'High enquiry volume, strong buyer competition, and increased likelihood of achieving above-market offers momentum',
    idealFor:
      'Properties where maximising price and buyer competition is the priority',
  },
  {
    id: 'private-clients',
    name: 'PRIVATE CLIENTS',
    tag: 'Private',
    description: 'Bespoke strategy for high-value and unique properties',
    setupPrice: 'Custom pricing',
    monthlyPrice: '',
    setupAmount: 0,
    monthlyAmount: 0,
    features: [
      'Fully tailored global launch strategy',
      'Premium creative and campaign positioning',
      'Access to high-value international buyers',
      'Bespoke market targeting (UK + international)',
      'Advanced buyer targeting & optimisation',
      'Private buyer registration experience',
      'Live demand insights designed to generate demand beyond traditional property portals',
      'No long-term commitment. Continue based on performance',
      'Dedicated campaign management',
      'Ongoing strategic advisory',
    ],
    outcome:
      'Direct engagement from high-value buyers, intensified competition, and positioning to secure the strongest possible outcome',
    idealFor:
      'High-value or unique properties where maximising buyer competition and final price is the priority',
    isDark: true,
    isPrivate: true,
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

export const DashboardSellFaster: React.FC = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const config = useConfig();
  const calendlyLink = config.calendly_link || 'https://calendly.com/havlo';

  // ── view state ─────────────────────────────────────────────────────────
  const [storedPlan, setStoredPlan] = useState<SellFasterPlanState | null>(getSellFasterPlan());
  const [skipped, setSkipped] = useState<boolean>(getSellFasterSkipped());
  const [forcePlansView, setForcePlansView] = useState<boolean>(false);

  const showMain = (storedPlan !== null || skipped) && !forcePlansView;

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
      {showMain ? (
        <SellFasterMain
          plan={storedPlan}
          firstName={user?.first_name}
          calendlyLink={calendlyLink}
          onUpgrade={handleUpgrade}
          onTrackProgress={() => navigate('/dashboard/inbox')}
          onMessage={() => navigate('/dashboard/inbox')}
        />
      ) : (
        <SellFasterPlansView
          onSelect={handlePlanSelect}
          onSkip={skipped || storedPlan ? undefined : handleSkip}
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

    <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-black/10 lg:grid-cols-4">
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
  const isLight = plan.isPopular || plan.isDark;
  const bg = plan.isPopular ? 'bg-[#A409D2] text-white' : plan.isDark ? 'bg-black text-white' : 'bg-white text-black';
  const ctaLabel = plan.isPrivate ? 'Request Private Consultation' : 'Start Your Property Relaunch';
  const ctaClass = plan.isPopular
    ? 'bg-white text-black hover:bg-white/90'
    : 'bg-black text-white hover:bg-black/90';

  return (
    <div
      className={`flex flex-col border-b border-black/10 p-6 lg:min-h-[820px] lg:border-b-0 lg:border-r lg:last:border-r-0 ${bg}`}
    >
      <div className="flex-1">
        <h4 className={`mb-1 font-display text-[26px] font-semibold tracking-tight ${plan.isPopular || plan.isDark ? 'text-white' : 'text-black'}`}>
          {plan.name}
        </h4>
        <p className={`mb-6 font-body text-[14px] leading-snug ${plan.isPopular ? 'text-white/85' : plan.isDark ? 'text-white/75' : 'text-black/70'}`}>
          {plan.description}
        </p>

        {plan.isPrivate ? (
          <div className="mb-7">
            <div className="font-display text-[20px] font-semibold tracking-tight text-white">Custom pricing</div>
          </div>
        ) : (
          <div className="mb-7">
            <div className={`font-display text-[18px] font-semibold tracking-tight ${plan.isPopular ? 'text-white' : 'text-black'}`}>
              {plan.setupPrice} Property Launch
            </div>
            <div className={`font-display text-[16px] font-semibold ${plan.isPopular ? 'text-white' : 'text-black/85'}`}>
              Ongoing exposure from {plan.monthlyPrice}/month
            </div>
          </div>
        )}

        <ul className={`mb-6 space-y-3 border-t pt-5 ${plan.isPopular ? 'border-white/30' : plan.isDark ? 'border-white/15' : 'border-black/10'}`}>
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className={isLight ? 'text-white' : 'text-[#149D4F]'}>
                <FeatureTick light={isLight} />
              </span>
              <span className={`font-body text-[14px] leading-snug ${plan.isPopular ? 'text-white' : plan.isDark ? 'text-white/90' : 'text-black/80'}`}>
                {f}
              </span>
            </li>
          ))}
        </ul>

        <div className={`mb-4 space-y-1 border-t pt-5 ${plan.isPopular ? 'border-white/30' : plan.isDark ? 'border-white/15' : 'border-black/10'}`}>
          <p className={`font-display text-[14px] font-bold ${plan.isPopular ? 'text-white' : plan.isDark ? 'text-white' : 'text-[#A409D2]'}`}>
            Typical outcome:
          </p>
          <p className={`font-body text-[13px] leading-snug ${plan.isPopular ? 'text-white/90' : plan.isDark ? 'text-white/80' : 'text-black/70'}`}>
            {plan.outcome}
          </p>
        </div>

        <div className="mb-4 space-y-1">
          <p className={`font-display text-[14px] font-bold ${plan.isPopular ? 'text-white' : plan.isDark ? 'text-white' : 'text-black'}`}>
            Ideal for:
          </p>
          <p className={`font-body text-[13px] leading-snug ${plan.isPopular ? 'text-white/90' : plan.isDark ? 'text-white/80' : 'text-black/70'}`}>
            {plan.idealFor}
          </p>
        </div>

        {plan.footnote && (
          <p className="mt-3 font-body text-[12px] italic text-black/60">{plan.footnote}</p>
        )}
      </div>

      <button
        onClick={onSelect}
        className={`mt-6 w-full rounded-md px-4 py-3 font-body text-[14px] font-semibold tracking-tight transition-colors ${ctaClass}`}
      >
        {ctaLabel}
      </button>
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
}

const SellFasterMain: React.FC<MainProps> = ({ plan, firstName, calendlyLink, onUpgrade, onTrackProgress, onMessage }) => {
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
                <span className="font-black">{plan.setupPrice}</span> PROPERTY LAUNCH
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
              <span className="bg-black/85 px-2 py-1 font-display text-[12px] font-bold uppercase tracking-tight text-white">
                NO ACTIVE PLAN
              </span>
              <span className="font-display text-[15px] font-semibold tracking-tight text-black">
                Pick a plan to launch your property relaunch campaign
              </span>
            </div>
            <p className="font-body text-[14px] text-black/60">
              Subscribe to unlock global exposure, targeted advertising, and weekly insights.
            </p>
          </div>
          <button
            onClick={onUpgrade}
            className="inline-flex h-12 items-center justify-center gap-2 self-start rounded-full bg-black px-6 font-body text-[13px] font-bold uppercase tracking-tight text-white hover:bg-black/90 lg:self-auto"
          >
            SUBSCRIBE TO A PLAN
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
        <button
          onClick={onTrackProgress}
          className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 font-body text-[14px] font-semibold tracking-tight text-black hover:bg-white/95"
        >
          <MessageSquare size={16} />
          Track Progress
        </button>
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
          <div className="flex items-center gap-4">
            <SpecialistAvatars />
            <span className="font-display text-[15px] font-bold text-black">Your property exposure specialists</span>
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


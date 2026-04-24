import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Home as HomeIcon, Star, X } from 'lucide-react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../hooks/useConfig';
import { api } from '../lib/api';
import { CountryCodeSelect } from '../components/shared/CountryCodeSelect';
import { usePaymentReturnPoller } from '../lib/paymentReturn';
import {
  addBuyerNetworkListing,
  defaultRenewalDate,
  formatRenewalDate,
  getBuyerNetworkListings,
  getBuyerNetworkPlan,
  getBuyerNetworkSkipped,
  getBuyerNetworkSlotCapacity,
  setBuyerNetworkPlan,
  setBuyerNetworkSkipped,
  type BuyerNetworkListing,
  type BuyerNetworkPlanState,
} from '../lib/dashboardState';

interface Package {
  id: string;
  name: string;
  description: string;
  price: string;
  priceLabel: string;
  features: string[];
  outcome: string;
  isPopular?: boolean;
  isNetwork?: boolean;
}

const packages: Package[] = [
  {
    id: 'starter',
    name: 'STARTER',
    description: 'Activate international buyer demand on selected listings.',
    price: '£295',
    priceLabel: '/ branch / month',
    features: [
      'Launch up to 2 properties to global audiences',
      'Initial demand activation across international markets',
      'Capture and manage qualified buyer enquiries',
      'Real-time visibility into buyer demand',
    ],
    outcome: 'Early-stage demand and consistent enquiry flow to build momentum.',
  },
  {
    id: 'growth',
    name: 'GROWTH',
    description: 'Designed to generate sustained demand and buyer competition.',
    price: '£495',
    priceLabel: '/ branch / month',
    features: [
      'Launch up to 5 properties across multiple international markets',
      'Expanded global exposure to high-intent buyers',
      'Priority launch positioning',
      'Co-branded launch assets to strengthen vendor perception',
    ],
    outcome:
      'Consistent enquiry flow with increasing buyer competition and stronger negotiating leverage.',
    isPopular: true,
  },
  {
    id: 'network',
    name: 'NETWORK',
    description: 'Scale demand generation across your entire network.',
    price: '£199',
    priceLabel: '/ branch / month',
    features: [
      'Unlimited property launches',
      'Network-wide demand visibility',
      'Centralised reporting for performance tracking',
      'Rollout and onboarding support',
    ],
    outcome: 'Scalable demand generation across multiple listings and branches.',
    isNetwork: true,
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

const FeatureTick: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="mt-[3px] flex-shrink-0">
    <path d="M14.3726 7.16036L13.4659 6.10703C13.2926 5.90703 13.1526 5.5337 13.1526 5.26703V4.1337C13.1526 3.42703 12.5726 2.84703 11.8659 2.84703H10.7326C10.4726 2.84703 10.0926 2.70703 9.8926 2.5337L8.83927 1.62703C8.37927 1.2337 7.62594 1.2337 7.15927 1.62703L6.1126 2.54036C5.9126 2.70703 5.5326 2.84703 5.2726 2.84703H4.11927C3.4126 2.84703 2.8326 3.42703 2.8326 4.1337V5.2737C2.8326 5.5337 2.6926 5.90703 2.52594 6.10703L1.62594 7.16703C1.23927 7.62703 1.23927 8.3737 1.62594 8.8337L2.52594 9.8937C2.6926 10.0937 2.8326 10.467 2.8326 10.727V11.867C2.8326 12.5737 3.4126 13.1537 4.11927 13.1537H5.2726C5.5326 13.1537 5.9126 13.2937 6.1126 13.467L7.16594 14.3737C7.62594 14.767 8.37927 14.767 8.84594 14.3737L9.89927 13.467C10.0993 13.2937 10.4726 13.1537 10.7393 13.1537H11.8726C12.5793 13.1537 13.1593 12.5737 13.1593 11.867V10.7337C13.1593 10.4737 13.2993 10.0937 13.4726 9.8937L14.3793 8.84036C14.7659 8.38036 14.7659 7.62036 14.3726 7.16036ZM10.7726 6.74036L7.5526 9.96036C7.45927 10.0537 7.3326 10.107 7.19927 10.107C7.06594 10.107 6.93927 10.0537 6.84594 9.96036L5.2326 8.34703C5.03927 8.1537 5.03927 7.8337 5.2326 7.64036C5.42594 7.44703 5.74594 7.44703 5.93927 7.64036L7.19927 8.90036L10.0659 6.0337C10.2593 5.84036 10.5793 5.84036 10.7726 6.0337C10.9659 6.22703 10.9659 6.54703 10.7726 6.74036Z" fill="#149D4F"/>
  </svg>
);

const ArrowUpRightTiny: React.FC<{ className?: string }> = ({ className }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M3.5 10.5L10.5 3.5M10.5 3.5H4.66667M10.5 3.5V9.33333" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const DashboardBuyerNetwork: React.FC = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const config = useConfig();
  const calendlyLink = config.calendly_link || 'https://calendly.com/havlo';

  // ── state ─────────────────────────────────────────────────────────────
  const [storedPlan, setStoredPlan] = useState<BuyerNetworkPlanState | null>(getBuyerNetworkPlan());
  const [skipped, setSkipped] = useState<boolean>(getBuyerNetworkSkipped());
  const [forcePlansView, setForcePlansView] = useState<boolean>(false);
  const [listings, setListings] = useState<BuyerNetworkListing[]>(getBuyerNetworkListings());
  const [boostingFor, setBoostingFor] = useState<BuyerNetworkListing | { placeholder: true } | null>(null);
  const [isAddListingOpen, setIsAddListingOpen] = useState(false);

  const showMain = (storedPlan !== null || skipped) && !forcePlansView;

  // ── form drawer state ─────────────────────────────────────────────────
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPartnershipModalOpen, setIsPartnershipModalOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPhoneCode, setContactPhoneCode] = useState('+44');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSelectPackage = (pkg: Package) => {
    if (pkg.isNetwork) {
      setIsPartnershipModalOpen(true);
      return;
    }
    setSelectedPackage(pkg);
    setIsDrawerOpen(true);
  };

  // Persist subscription on payment success.
  usePaymentReturnPoller({
    kind: 'buyer_network',
    token,
    fetchStatus: (id) => api.getBuyerNetworkPaymentStatus(token!, id),
    onPaid: () => {
      try {
        const persisted = JSON.parse(localStorage.getItem('havlo:buyer_network_pending') || 'null') as Package | null;
        const planForState: BuyerNetworkPlanState = {
          id: persisted?.id || 'starter',
          name: persisted?.name || 'STARTER',
          price: persisted?.price || '£295',
          slots: getBuyerNetworkSlotCapacity(persisted?.id || 'starter'),
          renewsAt: defaultRenewalDate(),
        };
        setBuyerNetworkPlan(planForState);
        setStoredPlan(planForState);
        setSkipped(false);
        setForcePlansView(false);
        // Seed a starter demo listing so the dashboard isn't empty.
        if (getBuyerNetworkListings().length === 0) {
          addBuyerNetworkListing({
            title: '4-bed detached house',
            address: '12 Cheltenham Road, Bristol BS6 5RW',
            listedPrice: '£875,000',
            reach: 247,
            enquiries: 18,
            viewings: 4,
            campaignStartedAt: new Date().toISOString(),
          });
          setListings(getBuyerNetworkListings());
        }
        localStorage.removeItem('havlo:buyer_network_pending');
      } catch {
        /* ignore */
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedPackage) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      try { localStorage.setItem('havlo:buyer_network_pending', JSON.stringify(selectedPackage)); } catch { /* ignore */ }
      const result = await api.submitBuyerNetwork(token, {
        package_id: selectedPackage.id,
        package_name: selectedPackage.name,
        company_name: companyName,
        property_types: ['Residential'],
        target_markets: ['International'],
        contact_preference: 'agent',
      });
      setIsDrawerOpen(false);
      if (!result.checkout_id) throw new Error('Missing checkout ID from payment gateway.');
      const { redirectToCheckout } = await import('../lib/paymentReturn');
      redirectToCheckout(result.checkout_id, {
        kind: 'buyer_network',
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
    setBuyerNetworkSkipped(true);
    setSkipped(true);
    setForcePlansView(false);
  };

  const handleUpgrade = () => {
    setForcePlansView(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddListingClick = () => {
    if (!storedPlan) {
      // Skip variant: redirect to plans page.
      setForcePlansView(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setIsAddListingOpen(true);
  };

  const handleAddListingSubmit = (data: { title: string; address: string; listedPrice: string }) => {
    addBuyerNetworkListing({
      ...data,
      reach: 0,
      enquiries: 0,
      viewings: 0,
      campaignStartedAt: new Date().toISOString(),
    });
    setListings(getBuyerNetworkListings());
    setIsAddListingOpen(false);
  };

  return (
    <DashboardLayout title="International Buyer Network">
      {showMain ? (
        <BuyerNetworkMain
          plan={storedPlan}
          listings={listings}
          onUpgrade={handleUpgrade}
          onAddListing={handleAddListingClick}
          onBoost={(listing) => setBoostingFor(listing)}
          onBoostPlaceholder={() => setBoostingFor({ placeholder: true })}
        />
      ) : (
        <BuyerNetworkPlansView
          onSelect={handleSelectPackage}
          onSkip={storedPlan ? undefined : handleSkip}
        />
      )}

      {/* Submission drawer */}
      <AnimatePresence>
        {isDrawerOpen && selectedPackage && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[500px] flex-col bg-[#F4F5F4] shadow-2xl">
              <div className="flex h-16 items-center justify-between border-b border-[#F1F1F0] bg-white px-6">
                <h3 className="font-display text-xl font-medium tracking-tight text-black">Activate {selectedPackage.name}</h3>
                <button onClick={() => setIsDrawerOpen(false)} className="rounded-md bg-[#EFEFEF] p-2 hover:bg-gray-200">
                  <X size={16} className="text-[#030517]" />
                </button>
              </div>
              <form id="bn-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-3">
                  <label className="block font-body text-sm font-bold text-[#001C47]">Company / branch name</label>
                  <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Enter company name"
                    className="h-12 w-full rounded-lg border border-black/5 bg-white px-4 font-body text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
                </div>
                <div className="space-y-3">
                  <label className="block font-body text-sm font-bold text-[#001C47]">Primary contact name</label>
                  <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
                    placeholder="Enter name"
                    className="h-12 w-full rounded-lg border border-black/5 bg-white px-4 font-body text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
                </div>
                <div className="space-y-3">
                  <label className="block font-body text-sm font-bold text-[#001C47]">Email for buyer enquiries</label>
                  <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="Enter email"
                    className="h-12 w-full rounded-lg border border-black/5 bg-white px-4 font-body text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
                </div>
                <div className="space-y-3">
                  <label className="block font-body text-sm font-bold text-[#001C47]">Contact phone</label>
                  <div className="flex items-center gap-2">
                    <div className="flex h-12 items-center rounded-lg bg-[#DDD] px-2">
                      <CountryCodeSelect value={contactPhoneCode} onChange={setContactPhoneCode} buttonClassName="bg-transparent hover:bg-black/5" />
                    </div>
                    <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="0000 0000 000"
                      className="h-12 flex-1 rounded-lg border border-black/5 bg-white px-4 font-body text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
                  </div>
                </div>
                <div className="rounded-xl border border-[#A409D2]/20 bg-[#A409D2]/5 p-4">
                  <p className="font-display text-sm font-bold text-[#A409D2]">Plan summary</p>
                  <p className="mt-1 font-body text-sm text-black/80">{selectedPackage.name} — {selectedPackage.price}{selectedPackage.priceLabel}</p>
                </div>
              </form>
              <div className="border-t border-[#F1F1F0] bg-white p-6">
                {submitError && <p className="mb-3 font-body text-sm text-red-500">{submitError}</p>}
                <button type="submit" form="bn-form" disabled={submitting}
                  className="h-[60px] w-full rounded-full bg-black text-base font-semibold uppercase tracking-tight text-white hover:bg-black/90 disabled:opacity-50">
                  {submitting ? 'SUBMITTING…' : 'SUBMIT & PROCEED TO PAYMENT'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Partnership modal */}
      <AnimatePresence>
        {isPartnershipModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsPartnershipModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-[560px] rounded-[20px] bg-white p-8 shadow-2xl">
              <button onClick={() => setIsPartnershipModalOpen(false)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 hover:bg-black/10">
                <X size={16} />
              </button>
              <h3 className="pr-8 font-display text-[32px] font-black leading-[1.1] text-black">
                {user?.first_name ? `${user.first_name}! Let's discuss a partnership.` : `Let's discuss a partnership.`}
              </h3>
              <p className="mt-4 font-body text-base text-black/70">
                A partnership manager will be in touch shortly. Want to speak with us right away?
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <a href="https://wa.me/message/PPPAWIAXBS7YK1" target="_blank" rel="noopener noreferrer"
                  className="flex h-12 items-center justify-center rounded-full bg-[#60D769] px-6 font-body text-base font-semibold text-white">
                  Chat with us on WhatsApp
                </a>
                <a href={calendlyLink} target="_blank" rel="noopener noreferrer"
                  className="flex h-12 items-center justify-center rounded-full bg-black px-6 font-body text-base font-semibold text-white">
                  Book a Calendly call
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Boost visibility modal */}
      <AnimatePresence>
        {boostingFor && (
          <BoostVisibilityModal onClose={() => setBoostingFor(null)} />
        )}
      </AnimatePresence>

      {/* Add listing modal */}
      <AnimatePresence>
        {isAddListingOpen && (
          <AddListingModal onClose={() => setIsAddListingOpen(false)} onSubmit={handleAddListingSubmit} />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Plans view
// ─────────────────────────────────────────────────────────────────────────────
const BuyerNetworkPlansView: React.FC<{ onSelect: (pkg: Package) => void; onSkip?: () => void }> = ({ onSelect, onSkip }) => (
  <div className="mx-auto max-w-[1200px] px-4 py-6 pb-20 sm:px-6 lg:py-10">
    <div className="relative mb-8 overflow-hidden rounded-[20px] bg-black p-6 sm:p-10 lg:mb-10">
      <div className="relative z-10 max-w-[800px]">
        <h2 className="mb-6 font-display text-3xl font-black leading-none tracking-tight text-white sm:text-[40px]">
          Faster Sales Through Better Exposure
        </h2>
        <p className="max-w-[740px] font-body text-base font-medium leading-relaxed text-white/80">
          By integrating your properties into our exposure network, your listings gain strategic placement across multiple buyer channels. Combined with precision advertising to targeted international buyers, we go beyond traditional portals to increase reach, demand, and deliver faster, higher quality offers.
        </p>
      </div>
      <HeroRings />
    </div>

    <h3 className="mb-6 font-display text-2xl font-black tracking-tight text-black sm:mb-8 sm:text-[32px]">
      Choose a Package
    </h3>

    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {packages.map((pkg) => (
        <PackageCard key={pkg.id} pkg={pkg} onSelect={() => onSelect(pkg)} />
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

const PackageCard: React.FC<{ pkg: Package; onSelect: () => void }> = ({ pkg, onSelect }) => {
  const ringClass = pkg.isPopular ? 'border-[2px] border-[#A409D2]' : 'border border-black/10';
  const ctaLabel = pkg.isNetwork ? 'Request Partnership' : 'Launch my Properties';

  return (
    <div className={`flex flex-col rounded-[14px] bg-white p-6 ${ringClass}`}>
      <div className="flex flex-1 flex-col">
        <div className="mb-4 flex items-start justify-between gap-2">
          <h4 className="font-display text-[18px] font-extrabold tracking-tight text-black">{pkg.name}</h4>
          {pkg.isPopular && (
            <span className="rounded bg-[#A409D2] px-2 py-1 font-display text-[11px] font-bold uppercase tracking-tight text-white">
              MOST POPULAR
            </span>
          )}
        </div>

        <div className="mb-2">
          {pkg.isNetwork && (
            <p className="mb-1 font-display text-[12px] font-bold uppercase tracking-tight text-black/60">FROM</p>
          )}
          <p className={`font-display text-[36px] font-black leading-none tracking-tight ${pkg.isNetwork ? 'text-[#149D4F]' : 'text-[#A409D2]'}`}>
            {pkg.price}
          </p>
          <p className="mt-1 font-body text-[13px] font-medium text-black/65">{pkg.priceLabel}</p>
        </div>

        <p className={`mt-4 mb-5 font-display text-[14px] font-bold leading-snug ${pkg.isNetwork ? 'text-[#149D4F]' : pkg.isPopular ? 'text-[#A409D2]' : 'text-[#A409D2]'}`}>
          {pkg.description}
        </p>

        <ul className="mb-5 space-y-3">
          {pkg.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              <FeatureTick />
              <span className="font-body text-[14px] leading-snug text-black/85">{f}</span>
            </li>
          ))}
        </ul>

        <div className={`mt-auto rounded-[8px] p-3 ${pkg.isNetwork ? 'bg-[#149D4F]/10' : 'bg-[#A409D2]/10'}`}>
          <p className={`font-display text-[13px] font-bold ${pkg.isNetwork ? 'text-[#149D4F]' : 'text-[#A409D2]'}`}>Typical outcome:</p>
          <p className="mt-1 font-body text-[13px] leading-snug text-black/75">{pkg.outcome}</p>
        </div>
      </div>

      <button
        onClick={onSelect}
        className="mt-5 w-full rounded-md bg-black px-4 py-3 font-body text-[14px] font-semibold tracking-tight text-white hover:bg-black/90"
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
  plan: BuyerNetworkPlanState | null;
  listings: BuyerNetworkListing[];
  onUpgrade: () => void;
  onAddListing: () => void;
  onBoost: (listing: BuyerNetworkListing) => void;
  onBoostPlaceholder: () => void;
}

const BuyerNetworkMain: React.FC<MainProps> = ({ plan, listings, onUpgrade, onAddListing, onBoost, onBoostPlaceholder }) => {
  const slotsRemaining = plan ? Math.max(0, plan.slots - listings.length) : 0;
  const upgradeLabel = useMemo(() => {
    if (!plan) return 'SUBSCRIBE NOW';
    if (plan.id === 'starter') return 'UPGRADE TO GROWTH';
    if (plan.id === 'growth') return 'UPGRADE TO NETWORK';
    return 'MANAGE PLAN';
  }, [plan]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6 pb-20 sm:px-6 lg:space-y-8 lg:py-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[20px] bg-black p-6 sm:p-10">
        <div className="relative z-10 max-w-[800px]">
          <h2 className="mb-6 font-display text-2xl font-black leading-none tracking-tight text-white sm:text-[40px]">
            Faster Sales Through Better Exposure
          </h2>
          <p className="max-w-[740px] font-body text-sm font-medium leading-relaxed text-white/80 sm:text-base">
            By integrating your properties into our exposure network, your listings gain strategic placement across multiple buyer channels. Combined with precision advertising to targeted international buyers, we go beyond traditional portals to increase reach, demand, and deliver faster, higher quality offers.
          </p>
        </div>
        <HeroRings />
      </div>

      {/* Subscription bar */}
      {plan ? (
        <div className="flex flex-col gap-4 rounded-[14px] border border-black/10 bg-white p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="bg-[#A409D2] px-2 py-1 font-display text-[12px] font-bold uppercase tracking-tight text-white">
                {plan.name} PLAN
              </span>
              <span className="font-display text-[15px] font-semibold tracking-tight text-black">
                <span className="font-black">{plan.price}</span> / BRANCH / MONTH
              </span>
            </div>
            <p className="font-body text-[14px] text-black/60">
              {plan.slots >= 999 ? 'Unlimited' : plan.slots} active property slot{plan.slots === 1 ? '' : 's'} · renews {formatRenewalDate(plan.renewsAt)}
            </p>
          </div>
          <button
            onClick={onUpgrade}
            className="inline-flex h-12 items-center justify-center gap-2 self-start rounded-full bg-black px-6 font-body text-[13px] font-bold uppercase tracking-tight text-white hover:bg-black/90 lg:self-auto"
          >
            {upgradeLabel}
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
                Pick a package to start launching listings
              </span>
            </div>
            <p className="font-body text-[14px] text-black/60">
              Subscribe to activate property slots and reach international buyers.
            </p>
          </div>
          <button
            onClick={onUpgrade}
            className="inline-flex h-12 items-center justify-center gap-2 self-start rounded-full bg-black px-6 font-body text-[13px] font-bold uppercase tracking-tight text-white hover:bg-black/90 lg:self-auto"
          >
            SUBSCRIBE NOW
            <ArrowUpRightTiny />
          </button>
        </div>
      )}

      {/* Listings */}
      <div>
        <h3 className="mb-4 font-display text-2xl font-black tracking-tight text-black sm:text-[28px]">Listings</h3>
        <div className="space-y-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} onBoost={() => onBoost(listing)} />
          ))}

          {/* Add another / placeholder slot */}
          {plan ? (
            slotsRemaining > 0 && (
              <button
                onClick={onAddListing}
                className="flex w-full flex-col items-center gap-3 rounded-[14px] border-2 border-dashed border-black/20 bg-white px-6 py-10 text-center transition-colors hover:border-black/40"
              >
                <div className="flex h-10 w-10 items-center justify-center">
                  <HomeIcon size={28} className="text-black" />
                </div>
                <p className="font-display text-[20px] font-black tracking-tight text-black">
                  {listings.length === 0 ? 'Add your first listing' : `Add your ${ordinal(listings.length + 1)} listing`}
                </p>
                <p className="font-body text-[13px] text-black/60">
                  You have {slotsRemaining} slot{slotsRemaining === 1 ? '' : 's'} remaining on your {plan.name} plan.
                </p>
                <span className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-black px-5 font-body text-[13px] font-semibold tracking-tight text-white">
                  <Star size={14} className="fill-white" />
                  ADD LISTING
                </span>
              </button>
            )
          ) : (
            // Skip variant: a placeholder card whose CTA bounces back to plans.
            <button
              onClick={onAddListing}
              className="flex w-full flex-col items-center gap-3 rounded-[14px] border-2 border-dashed border-black/20 bg-white px-6 py-10 text-center transition-colors hover:border-black/40"
            >
              <div className="flex h-10 w-10 items-center justify-center">
                <HomeIcon size={28} className="text-black" />
              </div>
              <p className="font-display text-[20px] font-black tracking-tight text-black">Add your first listing</p>
              <p className="font-body text-[13px] text-black/60">Choose a package first to activate property slots.</p>
              <span className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-black px-5 font-body text-[13px] font-semibold tracking-tight text-white">
                <Star size={14} className="fill-white" />
                ADD LISTING
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Optional placeholder boost trigger when there are no listings yet */}
      {plan && listings.length === 0 && (
        <button
          onClick={onBoostPlaceholder}
          className="mx-auto block font-body text-sm font-medium text-black/60 underline-offset-4 hover:text-black hover:underline"
        >
          Preview the Boost Visibility experience
        </button>
      )}
    </div>
  );
};

const ListingCard: React.FC<{ listing: BuyerNetworkListing; onBoost: () => void }> = ({ listing, onBoost }) => (
  <div className="rounded-[14px] border border-black/10 bg-white p-5 sm:p-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex-1">
        <h4 className="font-display text-[22px] font-black tracking-tight text-black sm:text-[24px]">{listing.title}</h4>
        <p className="mt-1 font-body text-[14px] text-black/65">
          {listing.address} · Listed {listing.listedPrice}
        </p>
      </div>
    </div>

    <div className="mt-5 grid grid-cols-3 gap-3 rounded-[10px] sm:max-w-[480px]">
      <Stat label="Reach" value={listing.reach.toLocaleString()} />
      <Stat label="Enquiries" value={listing.enquiries.toLocaleString()} />
      <Stat label="Viewings" value={listing.viewings.toLocaleString()} />
    </div>

    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-body text-[13px] text-black/60">
        Campaign started {formatRenewalDate(listing.campaignStartedAt)}
      </p>
      <button
        onClick={onBoost}
        className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-full bg-black px-5 font-body text-[13px] font-semibold tracking-tight text-white hover:bg-black/90 sm:self-auto"
      >
        <Star size={14} className="fill-white" />
        BOOST FOR VISIBILITY
      </button>
    </div>
  </div>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-[8px] bg-[#F4F5F4] px-4 py-3">
    <div className="font-display text-[20px] font-black leading-none tracking-tight text-black">{value}</div>
    <div className="mt-1 font-body text-[13px] text-black/65">{label}</div>
  </div>
);

function ordinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Boost visibility modal
// ─────────────────────────────────────────────────────────────────────────────
const BoostVisibilityModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const presets = [150, 150, 150];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [customAmount, setCustomAmount] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const reachEstimate = useMemo(() => {
    const amt = customAmount ? Number(customAmount) : presets[selectedIdx];
    if (!amt || isNaN(amt)) return 0;
    return Math.round(amt * 8); // ~8 buyers per £1 estimate
  }, [customAmount, selectedIdx]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-[480px] rounded-[16px] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-[20px] font-black tracking-tight text-black">Boost visibility</h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/5">
            <X size={16} />
          </button>
        </div>

        {confirmed ? (
          <div className="py-6 text-center">
            <p className="font-display text-[18px] font-black tracking-tight text-black">Boost activated</p>
            <p className="mt-2 font-body text-[14px] text-black/70">
              Your campaign will start gaining additional visibility within 24 hours.
            </p>
            <button onClick={onClose}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-black px-6 font-body text-[13px] font-bold uppercase text-white">
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="mb-3 font-display text-[14px] font-bold text-black">Select a budget</p>
            <div className="grid grid-cols-3 gap-3">
              {presets.map((amt, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedIdx(i); setCustomAmount(''); }}
                  className={`flex h-14 items-center justify-center rounded-[10px] border-[2px] font-display text-[18px] font-bold transition-colors ${
                    selectedIdx === i && !customAmount
                      ? 'border-[#A409D2] bg-[#A409D2]/5 text-[#A409D2]'
                      : 'border-black/10 text-black/70 hover:border-black/30'
                  }`}
                >
                  £{amt}
                </button>
              ))}
            </div>

            <p className="mt-5 mb-2 font-display text-[14px] font-bold text-black">Or enter a custom amount</p>
            <div className="flex h-12 items-center gap-2 rounded-[10px] border border-black/10 bg-[#F4F5F4] px-3">
              <span className="rounded bg-white px-2 py-1 text-[13px] font-medium text-black/70">£ ▾</span>
              <input
                type="number"
                min={50}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="e.g 150"
                className="flex-1 bg-transparent font-body text-[14px] text-black focus:outline-none"
              />
            </div>

            <p className="mt-5 font-body text-[14px] text-black">
              Estimated additional reach:{' '}
              <span className="font-display font-bold text-[#A409D2]">~{reachEstimate.toLocaleString()} buyers</span>
            </p>

            <div className="mt-4 rounded-[10px] bg-[#A409D2]/5 p-4">
              <p className="font-display text-[13px] font-bold text-[#A409D2]">What your boost does</p>
              <p className="mt-1 font-body text-[13px] leading-snug text-black/80">
                Targets qualified international buyers across Meta, Google, and partner portals — driving enquiries directly to this listing.
              </p>
            </div>

            <button
              onClick={() => setConfirmed(true)}
              className="mt-6 h-[52px] w-full rounded-full bg-black font-body text-[14px] font-bold uppercase tracking-tight text-white hover:bg-black/90"
            >
              BOOST NOW
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Add listing modal
// ─────────────────────────────────────────────────────────────────────────────
const AddListingModal: React.FC<{ onClose: () => void; onSubmit: (d: { title: string; address: string; listedPrice: string }) => void }> = ({ onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [listedPrice, setListedPrice] = useState('');

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !address) return;
    onSubmit({ title, address, listedPrice: listedPrice || '£—' });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-[460px] rounded-[16px] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-[20px] font-black tracking-tight text-black">Add a listing</h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/5">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handle} className="space-y-4">
          <div className="space-y-2">
            <label className="block font-body text-[13px] font-bold text-[#001C47]">Property title</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 4-bed detached house"
              className="h-11 w-full rounded-lg border border-black/10 bg-white px-3 font-body text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
          </div>
          <div className="space-y-2">
            <label className="block font-body text-[13px] font-bold text-[#001C47]">Address</label>
            <input type="text" required value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 12 Cheltenham Road, Bristol BS6 5RW"
              className="h-11 w-full rounded-lg border border-black/10 bg-white px-3 font-body text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
          </div>
          <div className="space-y-2">
            <label className="block font-body text-[13px] font-bold text-[#001C47]">Listed price</label>
            <input type="text" value={listedPrice} onChange={(e) => setListedPrice(e.target.value)}
              placeholder="£875,000"
              className="h-11 w-full rounded-lg border border-black/10 bg-white px-3 font-body text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
          </div>
          <button type="submit"
            className="mt-2 h-[52px] w-full rounded-full bg-black font-body text-[14px] font-bold uppercase tracking-tight text-white hover:bg-black/90">
            ADD LISTING
          </button>
        </form>
      </motion.div>
    </div>
  );
};


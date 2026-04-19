import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { X, Check, Globe, Zap, Shield, Star, ArrowRight, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { CountryCodeSelect } from '../components/shared/CountryCodeSelect';
import { usePaymentReturnPoller } from '../lib/paymentReturn';

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
  isPopular?: boolean;
  isDark?: boolean;
  accentColor?: string;
}

const plans: Plan[] = [
  {
    id: 'global',
    name: 'Global',
    tag: '3 REGIONS',
    description: 'Targeted exposure in three key international markets most likely to convert for your property.',
    setupPrice: '£2,000',
    monthlyPrice: '£1,500',
    setupAmount: 2000,
    monthlyAmount: 1500,
    features: [
      '3 regions of your choice',
      'Static + camuse ads',
      'Lead capture form',
      'Bi-weekly performance report',
      '3-month minimum'
    ]
  },
  {
    id: 'global-plus',
    name: 'Global+',
    tag: 'MOST POPULAR - 5 REGIONS',
    description: 'Broader reach with richer creative and a dedicated landing page for serious international buyers.',
    setupPrice: '£3,500',
    monthlyPrice: '£2,500',
    setupAmount: 3500,
    monthlyAmount: 2500,
    features: [
      '5 regions of your choice',
      'Static, carousel + short-form video',
      'Dedicated property landing page',
      'Weekly performance report',
      '3-month minimum'
    ],
    isPopular: true,
    accentColor: '#A409D2'
  },
  {
    id: 'worldwide',
    name: 'Worldwide',
    tag: '30+ COUNTRIES',
    description: 'Maximum global exposure for properties that need the widest possible international audience.',
    setupPrice: '£5,000',
    monthlyPrice: '£3,500',
    setupAmount: 5000,
    monthlyAmount: 3500,
    features: [
      '30+ countries worldwide',
      'Full creative suite - static, carousel + video',
      'Dedicated property landing page',
      'Weekly report + monthly strategy call',
      'Rolling monthly after 3 months'
    ]
  },
  {
    id: 'private-client',
    name: 'Private Client',
    tag: 'BESPOKE',
    description: 'For high-value properties that demand a campaign built entirely around them. Pricing tailored to scope - discussed privately.',
    setupPrice: '£5,000',
    monthlyPrice: '£3,500',
    setupAmount: 5000,
    monthlyAmount: 3500,
    features: [
      'Bespoke worldwide targeting strategy',
      'Premium creative production',
      'Dedicated account manager',
      'Weekly strategy calls',
      'Pricing discussed privately'
    ],
    isDark: true
  }
];

export const DashboardSellFaster: React.FC = () => {
  const { token } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [contactPreference, setContactPreference] = useState<'you' | 'agent'>('you');
  const [listingUrl, setListingUrl] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPhoneCode, setContactPhoneCode] = useState('+44');

  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan);
    setIsDrawerOpen(true);
  };

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  usePaymentReturnPoller({
    kind: 'sell_faster',
    token,
    fetchStatus: (id) => api.getSellFasterPaymentStatus(token!, id),
    onPaid: () => setIsSuccessModalOpen(true),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedPlan) return;
    setSubmitting(true);
    setSubmitError('');
    try {
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
      if (result.checkout_url) {
        const { redirectToCheckout } = await import('../lib/paymentReturn');
        redirectToCheckout(result.checkout_url, {
          kind: 'sell_faster',
          recordId: result.application_id,
          reference: result.checkout_id,
        });
        return;
      }
      setIsSuccessModalOpen(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Sell faster — Relaunch">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 lg:py-10 pb-20">
        {/* Hero Section */}
        <div className="relative bg-black rounded-[20px] p-6 sm:p-10 overflow-hidden mb-8 lg:mb-12">
          <div className="relative z-10 max-w-[800px]">
            <h2 className="font-display text-3xl sm:text-[40px] font-black text-white leading-none tracking-tight mb-6">
              Property on the market for 6+ months?
            </h2>
            <p className="font-body text-base font-medium text-white/80 leading-relaxed max-w-[740px]">
              It’s time for a smarter exit strategy. We relaunch underperforming listings with refined positioning and targeted buyer exposure to drive renewed interest and faster offers.
            </p>
          </div>
          
          {/* Abstract Background Elements */}
          <div className="absolute right-[-100px] bottom-[-200px] opacity-20 pointer-events-none">
            <svg width="712" height="596" viewBox="0 0 712 596" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g opacity="0.2">
                <path d="M712 263.5C712 409.027 594.027 527 448.5 527C302.973 527 185 409.027 185 263.5C185 117.973 302.973 0 448.5 0C594.027 0 712 117.973 712 263.5ZM223.847 263.5C223.847 387.573 324.427 488.153 448.5 488.153C572.573 488.153 673.153 387.573 673.153 263.5C673.153 139.427 572.573 38.8467 448.5 38.8467C324.427 38.8467 223.847 139.427 223.847 263.5Z" fill="#D9D9D9"/>
                <path d="M527 332.5C527 478.027 409.027 596 263.5 596C117.973 596 0 478.027 0 332.5C0 186.973 117.973 69 263.5 69C409.027 69 527 186.973 527 332.5ZM38.8467 332.5C38.8467 456.573 139.427 557.153 263.5 557.153C387.573 557.153 488.153 456.573 488.153 332.5C488.153 208.427 387.573 107.847 263.5 107.847C139.427 107.847 38.8467 208.427 38.8467 332.5Z" fill="#D9D9D9"/>
              </g>
            </svg>
          </div>
        </div>

        {/* Plans Section */}
        <div>
          <h3 className="font-display text-2xl sm:text-[32px] font-black text-black tracking-tight mb-6 sm:mb-8">
            Choose a relaunch plan
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-0 border border-black/10 rounded-xl overflow-hidden">
            {plans.map((plan) => (
              <div 
                key={plan.id}
                className={`flex flex-col p-6 lg:min-h-[585px] border-b lg:border-b-0 lg:border-r last:border-b-0 lg:last:border-r-0 border-black/10 transition-all duration-300 ${
                  plan.isPopular ? 'bg-[#A409D2] text-white' : 
                  plan.isDark ? 'bg-black text-white' : 'bg-white text-black'
                }`}
              >
                <div className="flex-1">
                  {/* Tag */}
                  <div className={`inline-flex px-2 py-1 text-[14px] font-medium tracking-tight mb-6 ${
                    plan.isPopular ? 'bg-white text-[#A409D2]' : 
                    plan.isDark ? 'bg-white/20 text-white' : 'bg-[#E0E1E4] text-[#1F1F1E]'
                  }`}>
                    {plan.tag}
                  </div>

                  {/* Name & Description */}
                  <h4 className={`text-[28px] font-semibold tracking-tight mb-3 font-tight ${
                    plan.isPopular || plan.isDark ? 'text-white' : 'text-[#1F1F1E]'
                  }`}>
                    {plan.name}
                  </h4>
                  <p className={`text-[14px] leading-relaxed mb-8 opacity-70 font-body ${
                    plan.isPopular || plan.isDark ? 'text-white' : 'text-black'
                  }`}>
                    {plan.description}
                  </p>

                  {/* Pricing */}
                  <div className="mb-8">
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className={`text-[24px] font-semibold font-tight ${
                        plan.isPopular || plan.isDark ? 'text-white' : 'text-[#1F1F1E]'
                      }`}>
                        {plan.setupPrice}
                      </span>
                      <span className="text-[16px] font-medium opacity-70">setup</span>
                    </div>
                    <div className="text-[16px] font-medium opacity-70">
                      then {plan.monthlyPrice} / month
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-4 pt-6 border-t border-current/10">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className={`mt-1 flex-shrink-0 ${plan.isPopular || plan.isDark ? 'text-white' : 'text-[#149D4F]'}`}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M14.3726 7.16036L13.4659 6.10703C13.2926 5.90703 13.1526 5.5337 13.1526 5.26703V4.1337C13.1526 3.42703 12.5726 2.84703 11.8659 2.84703H10.7326C10.4726 2.84703 10.0926 2.70703 9.8926 2.5337L8.83927 1.62703C8.37927 1.2337 7.62594 1.2337 7.15927 1.62703L6.1126 2.54036C5.9126 2.70703 5.5326 2.84703 5.2726 2.84703H4.11927C3.4126 2.84703 2.8326 3.42703 2.8326 4.1337V5.2737C2.8326 5.5337 2.6926 5.90703 2.52594 6.10703L1.62594 7.16703C1.23927 7.62703 1.23927 8.3737 1.62594 8.8337L2.52594 9.8937C2.6926 10.0937 2.8326 10.467 2.8326 10.727V11.867C2.8326 12.5737 3.4126 13.1537 4.11927 13.1537H5.2726C5.5326 13.1537 5.9126 13.2937 6.1126 13.467L7.16594 14.3737C7.62594 14.767 8.37927 14.767 8.84594 14.3737L9.89927 13.467C10.0993 13.2937 10.4726 13.1537 10.7393 13.1537H11.8726C12.5793 13.1537 13.1593 12.5737 13.1593 11.867V10.7337C13.1593 10.4737 13.2993 10.0937 13.4726 9.8937L14.3793 8.84036C14.7659 8.38036 14.7659 7.62036 14.3726 7.16036ZM10.7726 6.74036L7.5526 9.96036C7.45927 10.0537 7.3326 10.107 7.19927 10.107C7.06594 10.107 6.93927 10.0537 6.84594 9.96036L5.2326 8.34703C5.03927 8.1537 5.03927 7.8337 5.2326 7.64036C5.42594 7.44703 5.74594 7.44703 5.93927 7.64036L7.19927 8.90036L10.0659 6.0337C10.2593 5.84036 10.5793 5.84036 10.7726 6.0337C10.9659 6.22703 10.9659 6.54703 10.7726 6.74036Z" fill="currentColor"/>
                          </svg>
                        </div>
                        <span className="text-[16px] font-medium opacity-70 leading-tight">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => handlePlanSelect(plan)}
                  className={`mt-10 w-full py-3 px-4 border text-[16px] font-semibold tracking-tight transition-colors ${
                    plan.isPopular ? 'border-white text-white hover:bg-white hover:text-[#A409D2]' : 
                    plan.isDark ? 'border-white/20 text-white hover:bg-white/10' : 'border-[#E0E1E4] text-[#1F1F1E] hover:bg-gray-50'
                  }`}
                >
                  CONTINUE TO PAYMENT
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-[500px] bg-[#F4F5F4] shadow-2xl z-[70] flex flex-col"
            >
              {/* Drawer Header */}
              <div className="h-16 px-6 flex items-center justify-between bg-white border-b border-[#F1F1F0]">
                <h3 className="font-display text-xl font-medium text-black tracking-tight">
                  Listing & buyer enquiry details
                </h3>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 bg-[#EFEFEF] rounded-md hover:bg-gray-200 transition-colors"
                >
                  <X size={16} className="text-[#030517]" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Section 1: Current Listing */}
                <div className="pb-8 border-b border-black/10">
                  <h4 className="font-display text-xl font-medium text-black mb-6">1. Current Listing</h4>
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-[#001C47] font-body">
                      Link of where the property is currently listed
                    </label>
                    <div className="relative">
                      <input 
                        type="text"
                        value={listingUrl}
                        onChange={(e) => setListingUrl(e.target.value)}
                        placeholder="(Paste Rightmove / Zoopla / other listing URL)"
                        className="w-full h-12 px-4 bg-white border border-black/5 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-black/5"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Contact Preference */}
                <div className="pb-8 border-b border-black/10">
                  <h4 className="font-display text-xl font-medium text-black mb-6">2. Buyer enquiry contact preference</h4>
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-black font-body">
                      Who would you like potential buyers to contact?
                    </label>
                    <div className="space-y-4">
                      <button 
                        onClick={() => setContactPreference('you')}
                        className="flex items-center gap-3 group"
                      >
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          contactPreference === 'you' ? 'bg-[#00BC67] border-[#00BC67]' : 'border-[#3A3C3E]'
                        }`}>
                          {contactPreference === 'you' && <Check size={14} className="text-black" />}
                        </div>
                        <span className="text-sm font-medium text-black/80 font-body">You</span>
                      </button>
                      <button 
                        onClick={() => setContactPreference('agent')}
                        className="flex items-center gap-3 group"
                      >
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          contactPreference === 'agent' ? 'bg-[#00BC67] border-[#00BC67]' : 'border-[#3A3C3E]'
                        }`}>
                          {contactPreference === 'agent' && <Check size={14} className="text-black" />}
                        </div>
                        <span className="text-sm font-medium text-black/80 font-body">Your Agent</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section 3: Contact Details */}
                <div className="pb-8">
                  <h4 className="font-display text-xl font-medium text-black mb-6">3. Contact details for buyer enquiries</h4>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="block text-sm font-bold text-[#001C47] font-body">
                        Contact name / agent name
                      </label>
                      <input 
                        type="text"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Enter name"
                        className="w-full h-12 px-4 bg-white border border-black/5 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-black/5"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="block text-sm font-bold text-[#001C47] font-body">
                        Email for buyer enquiries
                      </label>
                      <input 
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="Enter email"
                        className="w-full h-12 px-4 bg-white border border-black/5 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-black/5"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="block text-sm font-bold text-[#001C47] font-body">
                        Contact phone number
                      </label>
                      <div className="flex gap-2 items-center">
                        <div className="h-12 px-2 bg-[#DDD] rounded-lg flex items-center">
                          <CountryCodeSelect value={contactPhoneCode} onChange={setContactPhoneCode} buttonClassName="bg-transparent hover:bg-black/5" />
                        </div>
                        <input 
                          type="tel"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="0000 0000 000"
                          className="flex-1 h-12 px-4 bg-white border border-black/5 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-black/5"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 bg-white border-t border-[#F1F1F0]">
                {submitError && <p className="text-red-500 text-sm font-body mb-3">{submitError}</p>}
                <button 
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full h-[60px] bg-black text-white rounded-full text-base font-semibold tracking-tight uppercase hover:bg-black/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'SUBMITTING...' : 'SUBMIT'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {isSuccessModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSuccessModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-[500px] bg-white rounded-[20px] p-10 text-center shadow-2xl overflow-hidden"
            >
              {/* Success Icon */}
              <div className="relative mb-10 inline-block">
                <div className="w-[100px] h-[100px] bg-[#149D4F]/15 rounded-full flex items-center justify-center relative z-10">
                  <Check size={48} className="text-[#149D4F]" />
                </div>
                <div className="absolute -left-1 top-0.5 w-[100px] h-[100px] bg-[#149D4F] rounded-full blur-[2px] opacity-20 -z-0" />
              </div>

              <h3 className="font-display text-[32px] font-black text-black leading-none tracking-tight mb-6">
                We have received your submission
              </h3>
              
              <p className="font-body text-base leading-relaxed text-black/70 mb-10">
                Your relaunch campaign is now being carefully prepared by our team.
                <br /><br />
                Please keep a close eye on your <span className="font-bold text-black">Inbox for updates</span> and further correspondence as we move forward.
              </p>

              <button 
                onClick={() => setIsSuccessModalOpen(false)}
                className="w-full max-w-[258px] h-14 bg-black text-white rounded-full text-base font-semibold tracking-tight hover:bg-black/90 transition-colors"
              >
                GO BACK
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

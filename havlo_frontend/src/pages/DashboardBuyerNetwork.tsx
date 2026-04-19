import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { X, Check, Users, ArrowRight, Globe, Zap, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { CountryCodeSelect } from '../components/shared/CountryCodeSelect';
import { usePaymentReturnPoller } from '../lib/paymentReturn';

interface Package {
  id: string;
  name: string;
  price: string;
  setupAmount: number;
  monthlyAmount: number;
  description: string;
  features: string[];
  isRecommended?: boolean;
}

const packages: Package[] = [
  {
    id: 'partner',
    name: 'Partner',
    price: '£2,000/mo',
    setupAmount: 0,
    monthlyAmount: 2000,
    description: 'Up to 2 active properties',
    features: [
      'International buyer network access',
      'Strategy & campaign planning',
      'Monthly reporting',
      'Email support'
    ]
  },
  {
    id: 'growth',
    name: 'Growth Partner',
    price: '£4,000/mo',
    setupAmount: 0,
    monthlyAmount: 4000,
    description: 'Up to 5 active properties',
    features: [
      'Everything in Partner',
      'Priority launches',
      'Co-branded marketing',
      'Weekly reporting',
      'Strategy calls'
    ],
    isRecommended: true
  },
  {
    id: 'private',
    name: 'Private Client Partner',
    price: '£7,500+/mo',
    setupAmount: 0,
    monthlyAmount: 7500,
    description: 'High-volume',
    features: [
      'Dedicated account manager',
      'Full creative suite',
      'White-label service',
      'Weekly strategy calls',
      'Vendor-winning support'
    ]
  }
];

export const DashboardBuyerNetwork: React.FC = () => {
  const { token } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [contactPreference, setContactPreference] = useState<'email' | 'phone'>('email');
  const [listingUrl1, setListingUrl1] = useState('');
  const [listingUrl2, setListingUrl2] = useState('');
  const [listingUrl3, setListingUrl3] = useState('');
  const [contactEmailField, setContactEmailField] = useState('');
  const [contactPhoneField, setContactPhoneField] = useState('');
  const [contactPhoneCode, setContactPhoneCode] = useState('+44');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  usePaymentReturnPoller({
    kind: 'buyer_network',
    token,
    fetchStatus: (id) => api.getBuyerNetworkPaymentStatus(token!, id),
    onPaid: () => setIsSuccessModalOpen(true),
  });

  const handlePackageSelect = (pkg: Package) => {
    setSelectedPackage(pkg);
    setIsDrawerOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedPackage) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const listings = [listingUrl1, listingUrl2, listingUrl3].filter(Boolean);
      const result = await api.submitBuyerNetwork(token, {
        package_id: selectedPackage.id,
        package_name: selectedPackage.name,
        contact_preference: contactPreference,
        property_types: ['Residential'],
        target_markets: ['International'],
        additional_info: listings.length > 0 ? `Listings: ${listings.join(', ')}` : undefined,
      });
      setIsDrawerOpen(false);
      if (result.checkout_url) {
        const { redirectToCheckout } = await import('../lib/paymentReturn');
        redirectToCheckout(result.checkout_url, {
          kind: 'buyer_network',
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
    <DashboardLayout title="International Buyer Network">
      <div className="max-w-[1162px] mx-auto px-4 sm:px-6 lg:px-0 space-y-6 lg:space-y-10 py-6 lg:py-10 pb-20">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-[20px] bg-black p-6 sm:p-10 lg:p-14 lg:min-h-[250px] flex flex-col justify-center">
          <div className="relative z-10 space-y-6 max-w-[739px]">
            <h2 className="font-display text-3xl lg:text-[40px] font-black leading-tight tracking-[-0.4px] text-white">
              Faster Sales Through Better Exposure
            </h2>
            <p className="font-body text-base lg:text-lg font-medium leading-relaxed tracking-[-0.32px] text-white/80">
              By integrating your properties into our exposure network, your listings gain strategic placement across multiple buyer channels. Combined with precision advertising to targeted international buyers, we go beyond traditional portals to increase reach, demand, and deliver faster, higherquality offers.
            </p>
          </div>
          
          {/* Abstract Background Elements */}
          <div className="absolute right-[-100px] bottom-[-200px] opacity-20 pointer-events-none">
            <svg width="712" height="596" viewBox="0 0 712 596" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M712 263.5C712 409.027 594.027 527 448.5 527C302.973 527 185 409.027 185 263.5C185 117.973 302.973 0 448.5 0C594.027 0 712 117.973 712 263.5ZM223.847 263.5C223.847 387.573 324.427 488.153 448.5 488.153C572.573 488.153 673.153 387.573 673.153 263.5C673.153 139.427 572.573 38.8467 448.5 38.8467C324.427 38.8467 223.847 139.427 223.847 263.5Z" fill="#D9D9D9"/>
              <path d="M527 332.5C527 478.027 409.027 596 263.5 596C117.973 596 0 478.027 0 332.5C0 186.973 117.973 69 263.5 69C409.027 69 527 186.973 527 332.5ZM38.8467 332.5C38.8467 456.573 139.427 557.153 263.5 557.153C387.573 557.153 488.153 456.573 488.153 332.5C488.153 208.427 387.573 107.847 263.5 107.847C139.427 107.847 38.8467 208.427 38.8467 332.5Z" fill="#D9D9D9"/>
            </svg>
          </div>
        </div>

        {/* Packages Section */}
        <div className="space-y-8">
          <h3 className="font-display text-2xl sm:text-[32px] font-black text-black tracking-[-0.64px]">
            Choose a Package
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <div 
                key={pkg.id}
                className="flex flex-col p-6 lg:p-8 rounded-[20px] border-[1.5px] border-black/10 bg-white space-y-8"
              >
                <div className="flex justify-between items-center">
                  <span className="font-tight text-lg font-medium uppercase tracking-[-0.36px] text-black">
                    {pkg.name}
                  </span>
                  {pkg.isRecommended && (
                    <div className="bg-[#00BC67] px-2 py-1 text-white text-[12px] font-bold tracking-[-0.24px] uppercase">
                      RECOMMENDED
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-[28px] font-semibold tracking-[-0.56px] text-[#1F1F1E] font-tight">
                    {pkg.price}
                  </div>
                  <div className="text-sm font-normal text-black/70 font-body">
                    {pkg.description}
                  </div>
                </div>

                <div className="flex-1 space-y-4 pt-6 border-t border-black/10">
                  {pkg.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="mt-1 flex-shrink-0 text-[#149D4F]">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M14.3726 7.16036L13.4659 6.10703C13.2926 5.90703 13.1526 5.5337 13.1526 5.26703V4.1337C13.1526 3.42703 12.5726 2.84703 11.8659 2.84703H10.7326C10.4726 2.84703 10.0926 2.70703 9.8926 2.5337L8.83927 1.62703C8.37927 1.2337 7.62594 1.2337 7.15927 1.62703L6.1126 2.54036C5.9126 2.70703 5.5326 2.84703 5.2726 2.84703H4.11927C3.4126 2.84703 2.8326 3.42703 2.8326 4.1337V5.2737C2.8326 5.5337 2.6926 5.90703 2.52594 6.10703L1.62594 7.16703C1.23927 7.62703 1.23927 8.3737 1.62594 8.8337L2.52594 9.8937C2.6926 10.0937 2.8326 10.467 2.8326 10.727V11.867C2.8326 12.5737 3.4126 13.1537 4.11927 13.1537H5.2726C5.5326 13.1537 5.9126 13.2937 6.1126 13.467L7.16594 14.3737C7.62594 14.767 8.37927 14.767 8.84594 14.3737L9.89927 13.467C10.0993 13.2937 10.4726 13.1537 10.7393 13.1537H11.8726C12.5793 13.1537 13.1593 12.5737 13.1593 11.867V10.7337C13.1593 10.4737 13.2993 10.0937 13.4726 9.8937L14.3793 8.84036C14.7659 8.38036 14.7659 7.62036 14.3726 7.16036ZM10.7726 6.74036L7.5526 9.96036C7.45927 10.0537 7.3326 10.107 7.19927 10.107C7.06594 10.107 6.93927 10.0537 6.84594 9.96036L5.2326 8.34703C5.03927 8.1537 5.03927 7.8337 5.2326 7.64036C5.42594 7.44703 5.74594 7.44703 5.93927 7.64036L7.19927 8.90036L10.0659 6.0337C10.2593 5.84036 10.5793 5.84036 10.7726 6.0337C10.9659 6.22703 10.9659 6.54703 10.7726 6.74036Z" fill="currentColor"/>
                        </svg>
                      </div>
                      <span className="text-base font-medium text-black/70 leading-tight font-body">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button 
                  onClick={() => handlePackageSelect(pkg)}
                  className="h-11 w-full rounded-full border border-black bg-transparent text-[#1F1F1E] font-tight text-base font-medium hover:bg-black hover:text-white transition-colors"
                >
                  CONTINUE TO PAYMENT
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Submission Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-[70] w-full max-w-[500px] bg-[#F4F5F4] shadow-2xl flex flex-col"
            >
              {/* Drawer Header */}
              <div className="h-16 flex items-center justify-between px-6 bg-white border-b border-[#F1F1F0] flex-shrink-0">
                <h2 className="font-display text-xl font-medium tracking-[-0.4px] text-black">Submit your property listings</h2>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="h-8 w-8 bg-[#EFEFEF] rounded-md flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X size={16} className="text-black" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
                <form id="buyer-network-form" onSubmit={handleSubmit} className="space-y-10">
                  {/* Property listing URLs */}
                  <div className="space-y-6 pb-6 border-b border-black/10">
                    <h3 className="font-display text-xl font-medium tracking-[-0.4px] text-black">Property listing URLs</h3>
                    
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <label className="block font-display text-sm font-bold text-[#001C47]">Link 1</label>
                        <input type="text" value={listingUrl1} onChange={(e) => setListingUrl1(e.target.value)} placeholder="Https//..." className="w-full h-12 px-4 rounded-lg border border-black/5 bg-white font-body text-sm font-medium text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10" />
                      </div>
                      <div className="space-y-4">
                        <label className="block font-display text-sm font-bold text-[#001C47]">Link 2</label>
                        <input type="text" value={listingUrl2} onChange={(e) => setListingUrl2(e.target.value)} placeholder="Https//..." className="w-full h-12 px-4 rounded-lg border border-black/5 bg-white font-body text-sm font-medium text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10" />
                      </div>
                      <div className="space-y-4">
                        <label className="block font-display text-sm font-bold text-[#001C47]">Link 3</label>
                        <input type="text" value={listingUrl3} onChange={(e) => setListingUrl3(e.target.value)} placeholder="Https//..." className="w-full h-12 px-4 rounded-lg border border-black/5 bg-white font-body text-sm font-medium text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10" />
                      </div>
                    </div>
                  </div>

                  {/* Buyer enquiry contact preference */}
                  <div className="space-y-6 pb-6 border-b border-black/10">
                    <h3 className="font-display text-xl font-medium tracking-[-0.4px] text-black">Buyer enquiry contact preference</h3>
                    
                    <div className="space-y-6">
                      <label className="block font-display text-sm font-bold text-black">How would you like potential buyers to contact you?</label>
                      
                      <div className="space-y-4">
                        <button 
                          type="button"
                          onClick={() => setContactPreference('email')}
                          className="flex items-center gap-3 group"
                        >
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                            contactPreference === 'email' ? 'bg-[#00BC67] border-[#00BC67]' : 'border-[#3A3C3E]'
                          }`}>
                            {contactPreference === 'email' && <Check size={14} className="text-black" />}
                          </div>
                          <span className="text-sm font-medium text-black/80 font-body">Email</span>
                        </button>
                        
                        <button 
                          type="button"
                          onClick={() => setContactPreference('phone')}
                          className="flex items-center gap-3 group"
                        >
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                            contactPreference === 'phone' ? 'bg-[#00BC67] border-[#00BC67]' : 'border-[#3A3C3E]'
                          }`}>
                            {contactPreference === 'phone' && <Check size={14} className="text-black" />}
                          </div>
                          <span className="text-sm font-medium text-black/80 font-body">Phone</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="block font-display text-sm font-bold text-[#001C47]">Contact email</label>
                      <input 
                        type="email"
                        value={contactEmailField}
                        onChange={(e) => setContactEmailField(e.target.value)}
                        placeholder="Enter email" 
                        className="w-full h-12 px-4 rounded-lg border border-black/5 bg-white font-body text-sm font-medium text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10" 
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="block font-display text-sm font-bold text-[#001C47]">Contact phone</label>
                      <div className="flex gap-2 items-center">
                        <div className="h-12 px-2 bg-[#DDD] rounded-lg flex items-center">
                          <CountryCodeSelect value={contactPhoneCode} onChange={setContactPhoneCode} buttonClassName="bg-transparent hover:bg-black/5" />
                        </div>
                        <input 
                          type="tel"
                          value={contactPhoneField}
                          onChange={(e) => setContactPhoneField(e.target.value)}
                          placeholder="0000 0000 000" 
                          className="flex-1 h-12 px-4 rounded-lg border border-black/5 bg-white font-body text-sm font-medium text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10" 
                        />
                      </div>
                    </div>
                  </div>
                </form>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 bg-white border-t border-[#F1F1F0] flex-shrink-0">
                {submitError && <p className="text-red-500 text-sm font-body mb-3">{submitError}</p>}
                <Button 
                  type="submit"
                  form="buyer-network-form"
                  disabled={submitting}
                  className="h-[60px] w-full rounded-full bg-black text-white flex items-center justify-center gap-3 group border-none disabled:opacity-50"
                >
                  <span className="font-body text-base lg:text-lg font-semibold tracking-[-0.32px] uppercase">{submitting ? 'SUBMITTING...' : 'SUBMIT & PROCEED TO PAYMENT'}</span>
                </Button>
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
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-[500px] bg-white rounded-[20px] border border-[#F1F1F0] p-10 flex flex-col items-center text-center gap-10 shadow-2xl"
            >
              <div className="relative">
                <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(-4px 1.6px 0 #149D4F)' }}>
                  <path opacity="0.15" d="M44.793 10.207C47.668 7.7487 52.3763 7.7487 55.293 10.207L61.8763 15.8737C63.1263 16.957 65.4596 17.832 67.1263 17.832H74.2096C78.6263 17.832 82.2513 21.457 82.2513 25.8737V32.957C82.2513 34.582 83.1263 36.957 84.2096 38.207L89.8763 44.7904C92.3346 47.6654 92.3346 52.3737 89.8763 55.2904L84.2096 61.8737C83.1263 63.1237 82.2513 65.457 82.2513 67.1237V74.207C82.2513 78.6237 78.6263 82.2487 74.2096 82.2487H67.1263C65.5013 82.2487 63.1263 83.1237 61.8763 84.207L55.293 89.8737C52.418 92.332 47.7096 92.332 44.793 89.8737L38.2096 84.207C36.9596 83.1237 34.6263 82.2487 32.9596 82.2487H25.7513C21.3346 82.2487 17.7096 78.6237 17.7096 74.207V67.082C17.7096 65.457 16.8346 63.1237 15.793 61.8737L10.168 55.2487C7.7513 52.3737 7.7513 47.707 10.168 44.832L15.793 38.207C16.8346 36.957 17.7096 34.6237 17.7096 32.9987V25.832C17.7096 21.4154 21.3346 17.7904 25.7513 17.7904H32.9596C34.5846 17.7904 36.9596 16.9154 38.2096 15.832L44.793 10.207Z" fill="#149D4F"/>
                  <path d="M44.9596 63.2083C44.1263 63.2083 43.3346 62.875 42.7513 62.2917L32.668 52.2083C31.4596 51 31.4596 49 32.668 47.7917C33.8763 46.5833 35.8763 46.5833 37.0846 47.7917L44.9596 55.6667L62.8763 37.75C64.0846 36.5417 66.0846 36.5417 67.293 37.75C68.5013 38.9583 68.5013 40.9583 67.293 42.1667L47.168 62.2917C46.5846 62.875 45.793 63.2083 44.9596 63.2083Z" fill="#149D4F"/>
                </svg>
              </div>
              <div className="space-y-6">
                <h3 className="font-display text-[28px] lg:text-[32px] font-black leading-none tracking-[-0.64px] text-black">
                  We have received your submission
                </h3>
                <p className="font-body text-base font-medium leading-[1.25] tracking-[-0.32px] text-black/70">
                  Your international buyer network campaign is now being carefully prepared by our team.
                  <br /><br />
                  Please keep a close eye on your <span className="font-bold text-black">Inbox for updates</span> and further correspondence as we move forward.
                </p>
              </div>
              <Button 
                onClick={() => setIsSuccessModalOpen(false)}
                className="h-[56px] w-full max-w-[258px] rounded-full bg-black text-white font-body text-base font-semibold tracking-[-0.16px] border-none"
              >
                GO BACK
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

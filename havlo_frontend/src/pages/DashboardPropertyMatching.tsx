import React, { useState } from 'react';
import { 
  ArrowRight,
  X,
  ChevronDown
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { CountrySelect } from '../components/shared/CountrySelect';

export const DashboardPropertyMatching: React.FC = () => {
  const { token } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [country, setCountry] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const fd = new FormData(e.currentTarget);
      await api.submitPropertyMatching(token, {
        property_type: (fd.get('propertyType') as string) || 'Residential',
        location: country || (fd.get('country') as string) || '',
        budget_amount: (fd.get('budget') as string) || undefined,
        budget_currency: 'GBP',
        additional_requirements: (fd.get('helpNeeded') as string) || undefined,
        contact_preference: (fd.get('timeline') as string) || undefined,
      });
      setIsDrawerOpen(false);
      setIsSuccess(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Property Matching">
      <div className="max-w-[1162px] mx-auto space-y-10 px-4 lg:px-0">
        {/* Hero Section */}
        <section className="relative rounded-[20px] bg-black p-8 lg:p-10 overflow-hidden min-h-[107px] flex flex-col justify-center gap-4">
          <div className="relative z-10 space-y-2">
            <h2 className="font-display text-2xl lg:text-[32px] font-black leading-tight tracking-[-0.01em] text-white">
              Get matched to the right property
            </h2>
            <p className="font-body text-sm lg:text-base font-medium tracking-[-0.02em] text-white/80">
              We match you with the best-fit properties and connect you to trusted agents.
            </p>
          </div>
          
          {/* Abstract Background Shapes */}
          <div className="absolute right-0 top-0 h-full w-1/2 pointer-events-none">
            <svg width="100%" height="100%" viewBox="0 0 400 107" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-20">
              <path d="M400 0C400 0 300 25 200 53C100 85 0 107 0 107H400V0Z" fill="white" />
            </svg>
          </div>
        </section>

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
          {/* Find Match Card */}
          <div className="flex flex-col p-8 lg:p-10 rounded-[20px] border border-[#F1F1F0] bg-white min-h-[450px] lg:min-h-[502px]">
            <div className="space-y-10">
              <div className="h-14 w-14 rounded-full bg-[#F0F0F0] flex items-center justify-center">
                <img src="/Frame 1410106637.png" alt="House" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
              </div>
              <div className="space-y-6">
                <h3 className="font-display text-2xl lg:text-[32px] font-black leading-none tracking-[-0.48px] text-black">
                  Find the perfect property
                </h3>
                <p className="font-body text-base font-medium leading-[1.25] tracking-[-0.32px] text-black/70">
                  Skip the endless search. Tell us what you need, and we'll match you with properties that fit your lifestyle, budget, and goals.
                </p>
              </div>
            </div>
            <div className="mt-auto pt-6">
              <Button 
                onClick={() => setIsDrawerOpen(true)}
                variant="primary" 
                className="h-[56px] lg:h-[72px] w-full lg:w-fit rounded-full bg-black text-white px-8 flex items-center justify-center gap-3 group border border-black/5"
              >
                <span className="font-body text-base lg:text-xl font-semibold tracking-[-0.32px] uppercase">Find My Match</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform group-hover:translate-x-1">
                  <path d="M18.5 12.0039H5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M13.0001 18.004C13.0001 18.004 19 13.585 19 12.0039C19 10.4228 13 6.00391 13 6.00391" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Button>
            </div>
          </div>

          {/* View Matches Card */}
          <div className="flex flex-col p-8 lg:p-10 rounded-[20px] border border-[#F1F1F0] bg-white min-h-[450px] lg:min-h-[502px]">
            <div className="space-y-10">
              <div className="h-14 w-14 rounded-full bg-[#F0F0F0] flex items-center justify-center">
                <img src="/Frame 2.png" alt="Heart" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
              </div>
              <div className="space-y-6">
                <h3 className="font-display text-2xl lg:text-[32px] font-black leading-none tracking-[-0.48px] text-black">
                  View Your Matched Properties
                </h3>
                <p className="font-body text-base font-medium leading-[1.25] tracking-[-0.32px] text-black/70">
                  Browse a curated list of properties tailored to your preferences. Every option is selected to fit your needs, so you can focus on choosing the right one.
                </p>
              </div>
            </div>
            <div className="mt-auto pt-6">
              <Button 
                variant="primary" 
                className="h-[56px] lg:h-[72px] w-full lg:w-fit rounded-full bg-black text-white px-8 flex items-center justify-center gap-3 group border border-black/5"
              >
                <span className="font-body text-base lg:text-xl font-semibold tracking-[-0.32px] uppercase">View Matches</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform group-hover:translate-x-1">
                  <path d="M18.5 12.0039H5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M13.0001 18.004C13.0001 18.004 19 13.585 19 12.0039C19 10.4228 13 6.00391 13 6.00391" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Property Needs Drawer */}
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
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-[70] w-full max-w-[500px] bg-[#F4F5F4] shadow-2xl flex flex-col"
            >
              {/* Drawer Header */}
              <div className="h-16 flex items-center justify-between px-6 bg-white border-b border-[#F1F1F0] flex-shrink-0">
                <h2 className="font-display text-xl font-medium tracking-[-0.4px]">Tell us your property needs</h2>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 bg-[#EFEFEF] rounded-md hover:bg-gray-200 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8 sidebar-scrollbar">
                <form id="property-needs-form" onSubmit={handleSubmit} className="space-y-8">
                  {/* Property Type */}
                  <div className="space-y-4">
                    <label className="block font-display text-sm font-black text-black">
                      What type of property are you looking for?
                    </label>
                    <div className="space-y-4">
                      {['Residential', 'Commercial', 'Investment', 'Holiday home'].map((type) => (
                        <label key={type} className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center">
                            <input type="radio" name="propertyType" className="peer sr-only" defaultChecked={type === 'Residential'} />
                            <div className="h-6 w-6 rounded-full border-2 border-[#3A3C3E] peer-checked:border-none peer-checked:bg-[#00BC67] transition-all" />
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute opacity-0 peer-checked:opacity-100 transition-opacity">
                              <path d="M8.5 12.5L10.5 14.5L15.5 9.5" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <span className="font-body text-sm font-semibold text-black/80 group-hover:text-black transition-colors">
                            {type}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Country Interest */}
                  <div className="space-y-4">
                    <label className="block font-display text-sm font-black text-black">
                      Which country or location are you interested in?
                    </label>
                    <CountrySelect
                      name="country"
                      value={country}
                      onChange={setCountry}
                      placeholder="Select your country"
                      buttonClassName="bg-white border border-black/10 text-sm font-semibold text-black/70 focus:ring-1 focus:ring-black/10"
                    />
                  </div>

                  {/* Budget Range */}
                  <div className="space-y-4">
                    <label className="block font-display text-sm font-black text-[#001C47]">
                      What is your budget range? (£)<span className="text-[#FA4242]">*</span>
                    </label>
                    <input 
                      type="text"
                      name="budget"
                      placeholder="e.g £200,000 - £500,000"
                      required
                      className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10"
                    />
                  </div>

                  {/* Main Goal */}
                  <div className="space-y-4">
                    <label className="block font-display text-sm font-black text-black">
                      What is your main goal?
                    </label>
                    <div className="relative">
                      <select name="goal" className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black/70 appearance-none focus:outline-none focus:ring-1 focus:ring-black/10">
                        <option>Select</option>
                        <option>Live in it</option>
                        <option>Rental income</option>
                        <option>Capital growth</option>
                        <option>Holiday use</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1L5 5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Property Type Preference */}
                  <div className="space-y-4">
                    <label className="block font-display text-sm font-black text-black">
                      What property type do you prefer?
                    </label>
                    <div className="relative">
                      <select name="propertyType" className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black/70 appearance-none focus:outline-none focus:ring-1 focus:ring-black/10">
                        <option>Select</option>
                        <option>Apartment</option>
                        <option>House</option>
                        <option>Villa</option>
                        <option>Townhouse</option>
                        <option>Land</option>
                        <option>Commercial</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1L5 5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="space-y-4">
                    <label className="block font-display text-sm font-black text-black">
                      How soon are you planning to buy?
                    </label>
                    <div className="space-y-4">
                      {['ASAP', '1–3 months', '3–6 months', 'Just exploring'].map((time) => (
                        <label key={time} className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center">
                            <input type="radio" name="timeline" value={time} className="peer sr-only" defaultChecked={time === 'ASAP'} />
                            <div className="h-6 w-6 rounded-full border-2 border-[#3A3C3E] peer-checked:border-none peer-checked:bg-[#00BC67] transition-all" />
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute opacity-0 peer-checked:opacity-100 transition-opacity">
                              <path d="M8.5 12.5L10.5 14.5L15.5 9.5" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <span className="font-body text-sm font-semibold text-black/80 group-hover:text-black transition-colors">
                            {time}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Help Needed */}
                  <div className="space-y-4">
                    <label className="block font-display text-sm font-black text-black">
                      Do you need help with legal, survey, or financing support?
                    </label>
                    <div className="space-y-4 pb-10">
                      {['YES', 'NO', 'Not sure'].map((option) => (
                        <label key={option} className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center">
                            <input type="radio" name="helpNeeded" value={option} className="peer sr-only" defaultChecked={option === 'YES'} />
                            <div className="h-6 w-6 rounded-full border-2 border-[#3A3C3E] peer-checked:border-none peer-checked:bg-[#00BC67] transition-all" />
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute opacity-0 peer-checked:opacity-100 transition-opacity">
                              <path d="M8.5 12.5L10.5 14.5L15.5 9.5" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <span className="font-body text-sm font-semibold text-black/80 group-hover:text-black transition-colors">
                            {option}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                </form>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 bg-white border-t border-[#F1F1F0] flex-shrink-0">
                {submitError && <p className="text-red-500 text-sm font-body mb-3">{submitError}</p>}
                <Button 
                  type="submit"
                  form="property-needs-form"
                  disabled={submitting}
                  className="h-[60px] w-full rounded-full bg-black text-white flex items-center justify-center gap-3 group border-none disabled:opacity-50"
                >
                  <span className="font-body text-xl font-semibold tracking-[-0.4px] uppercase">{submitting ? 'SUBMITTING...' : 'SUBMIT PREFERENCES'}</span>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform group-hover:translate-x-1">
                    <path d="M24.666 16.0039H6.66602" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M17.3341 24.004C17.3341 24.004 25.334 18.112 25.334 16.0038C25.334 13.8957 17.3339 8.00391 17.3339 8.00391" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {isSuccess && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSuccess(false)}
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
                <h3 className="font-display text-[32px] font-black leading-none tracking-[-0.64px] text-black">
                  Your preferences are in!
                </h3>
                <p className="font-body text-base font-medium leading-[1.25] tracking-[-0.32px] text-black/70">
                  Our team is curating your ideal property matches. We'll be in touch shortly with properties tailored to your requirements.
                </p>
              </div>
              <Button 
                onClick={() => setIsSuccess(false)}
                className="h-[56px] w-full max-w-[258px] rounded-full bg-black text-white font-body text-base font-semibold tracking-[-0.16px] border-none"
              >
                VIEW MATCH PROPERTIES
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

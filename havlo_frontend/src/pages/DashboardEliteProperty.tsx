import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { X, Check, Globe, Phone, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export const DashboardEliteProperty: React.FC = () => {
  const { token } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const fd = new FormData(e.currentTarget);
      await api.submitEliteProperty(token, {
        property_address: (fd.get('city') as string) || '',
        property_type: (fd.get('propertyType') as string) || '',
        asking_price: (fd.get('estimatedValue') as string) || undefined,
        asking_price_currency: 'GBP',
        description: (fd.get('uniqueAsset') as string) || undefined,
        target_buyer_profile: (fd.get('primaryObjective') as string) || undefined,
        additional_info: (fd.get('listingUrl') as string) || undefined,
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
    <DashboardLayout title="Elite Property Introductions">
      <div className="max-w-[1162px] mx-auto px-6 lg:px-0 space-y-10">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-[20px] bg-black p-10 lg:p-14 min-h-[300px] flex flex-col justify-center">
          <div className="relative z-10 space-y-6 max-w-[755px]">
            <h2 className="font-display text-3xl lg:text-[40px] font-black leading-tight tracking-[-0.4px] text-white">
              Showcase your exclusive properties to elite cross-border buyers
            </h2>
            <p className="font-body text-base lg:text-lg font-medium leading-relaxed tracking-[-0.32px] text-white/80">
              Connect your property to vetted foreign buyers seeking international property — family offices, global investors, and high-net-worth individuals.
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

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 pb-20">
          {/* Card 1: Apply for Access */}
          <div className="flex flex-col p-8 lg:p-10 rounded-[20px] border border-[#F1F1F0] bg-white min-h-[450px] lg:min-h-[502px] justify-between">
            <div className="space-y-10">
              <div className="h-14 w-14 rounded-full bg-[#F0F0F0] flex items-center justify-center">
                <Globe size={24} className="text-black" />
              </div>
              <div className="space-y-6">
                <h3 className="font-display text-2xl lg:text-[32px] font-black leading-none tracking-[-0.64px] text-black">
                  Apply for Verified Foreign Buyer Access
                </h3>
                <p className="font-body text-base font-medium leading-[1.25] tracking-[-0.32px] text-black/70">
                  Unlock exclusive access to verified properties and a seamless buying experience. Get approved to explore and invest with confidence from anywhere in the world.
                </p>
              </div>
            </div>
            <Button 
              onClick={() => setIsDrawerOpen(true)}
              className="h-[72px] w-full rounded-full bg-black text-white flex items-center justify-between px-8 group border-none"
            >
              <span className="font-body text-xl font-semibold tracking-[-0.4px] uppercase">Apply Now</span>
              <ArrowRight size={32} className="transition-transform group-hover:translate-x-1" />
            </Button>
          </div>

          {/* Card 2: Book Advisory Call */}
          <div className="flex flex-col p-8 lg:p-10 rounded-[20px] border border-[#F1F1F0] bg-white min-h-[450px] lg:min-h-[502px] justify-between">
            <div className="space-y-10">
              <div className="h-14 w-14 rounded-full bg-[#F0F0F0] flex items-center justify-center">
                <Phone size={24} className="text-black" />
              </div>
              <div className="space-y-6">
                <h3 className="font-display text-2xl lg:text-[32px] font-black leading-none tracking-[-0.64px] text-black">
                  Book an Advisory Call
                </h3>
                <p className="font-body text-base font-medium leading-[1.25] tracking-[-0.32px] text-black/70">
                  Get expert guidance tailored to your needs. Our team is ready to help you make the right property decisions with clarity and confidence.
                </p>
              </div>
            </div>
            <Button 
              className="h-[72px] w-full rounded-full bg-[#006AFE] text-white flex items-center justify-center gap-3 group border-none"
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M27.119 25.6959C25.8758 26.7791 24.3286 28.1279 21.5094 28.1279H19.8294C17.7926 28.1279 15.9446 27.4031 14.615 26.0847C13.3222 24.8015 12.607 23.0383 12.607 21.1247V18.8687C12.607 16.9535 13.3222 15.1983 14.615 13.9087C15.9366 12.5887 17.7926 11.8655 19.8294 11.8655H21.5094C24.3286 11.8655 25.8774 13.2127 27.1174 14.2943C28.4102 15.4143 29.5206 16.3871 32.4854 16.3871C32.9462 16.3871 33.3964 16.3514 33.8358 16.2799C33.8337 16.2746 33.8316 16.265 33.8294 16.2511C33.6491 15.8183 33.4418 15.3972 33.2086 14.9903L31.2214 11.6223C29.4038 8.52634 26.0374 6.61914 22.4006 6.61914H18.4342C14.7974 6.61914 11.431 8.52634 9.61345 11.6223L7.62625 14.9903C6.7329 16.5049 6.26172 18.2312 6.26172 19.9895C6.26172 21.7479 6.7329 23.4742 7.62625 24.9887L9.61345 28.3567C11.431 31.4527 14.7974 33.3583 18.4342 33.3583H22.4006C26.0374 33.3583 29.4038 31.4527 31.2214 28.3567L33.2086 24.9887C33.4476 24.577 33.6545 24.1589 33.8294 23.7343C33.8294 23.7263 33.8358 23.7183 33.8358 23.7055C33.3896 23.6312 32.9378 23.5948 32.4854 23.5967C29.5206 23.6047 28.4102 24.5727 27.1174 25.6975" fill="white"/>
                <path d="M21.5159 13.916H19.8359C16.7399 13.916 14.7031 16.0872 14.7031 18.868V21.1256C14.7031 23.9064 16.7399 26.0792 19.8359 26.0792H21.5159C26.0279 26.0792 25.6791 21.564 32.4919 21.564C33.1415 21.564 33.7927 21.62 34.4199 21.7352C34.6244 20.5858 34.6244 19.4094 34.4199 18.26C33.7837 18.3751 33.1384 18.4324 32.4919 18.4312C25.6711 18.4312 26.0279 13.916 21.5159 13.916Z" fill="white"/>
                <path d="M38.3304 23.3832C37.1664 22.5455 35.8279 21.9821 34.4152 21.7352C34.4152 21.7496 34.4088 21.756 34.4088 21.7704C34.283 22.4375 34.0923 23.0908 33.8392 23.7208C35.0049 23.8959 36.1131 24.3426 37.0744 25.0248C37.0744 25.0328 37.0664 25.0456 37.0664 25.0536C36.5256 26.7816 35.708 28.4136 34.6344 29.8984C33.5752 31.3608 32.2984 32.6504 30.8376 33.732C27.8048 35.967 24.1329 37.1659 20.3656 37.1512C15.7467 37.1644 11.308 35.3598 8.00878 32.1272C6.41687 30.5701 5.14403 28.7173 4.26158 26.6728C3.35318 24.5659 2.88598 22.2952 2.88878 20.0008C2.88878 17.6856 3.34958 15.436 4.26158 13.3288C5.14385 11.2837 6.4167 9.43038 8.00878 7.87278C11.3093 4.64223 15.7471 2.83793 20.3656 2.84878C24.1768 2.84878 27.7992 4.03278 30.8376 6.26798C32.2961 7.33916 33.5773 8.63279 34.6344 10.1016C35.708 11.5848 36.5256 13.212 37.0664 14.9464C37.0664 14.9624 37.0744 14.9688 37.0744 14.9752C36.1131 15.6574 35.0049 16.1041 33.8392 16.2792C34.0982 16.917 34.2912 17.5796 34.4152 18.2568C35.8269 18.0067 37.1647 17.4436 38.3304 16.6088C39.4472 15.7992 39.228 14.8808 39.06 14.3368C36.5992 6.49838 29.156 0.800781 20.3656 0.800781C9.56558 0.800781 0.800781 9.39278 0.800781 20.0008C0.800781 30.6088 9.55758 39.2008 20.3656 39.2008C29.1656 39.2008 36.6056 33.5032 39.06 25.6632C39.236 25.1112 39.4472 24.1928 38.3304 23.3832Z" fill="white"/>
              </svg>
              <span className="font-body text-xl font-semibold tracking-[-0.4px] uppercase">BOOK A CALL</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Application Drawer */}
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
                <h2 className="font-display text-xl font-medium tracking-[-0.4px] text-black">Application</h2>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="h-8 w-8 bg-[#EFEFEF] rounded-md flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X size={16} className="text-black" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
                <form id="elite-property-form" onSubmit={handleSubmit} className="space-y-10">
                  {/* 1. Property overview */}
                  <div className="space-y-6 pb-6 border-b border-black/10">
                    <h3 className="font-display text-xl font-medium tracking-[-0.4px] text-black">1. Property overview</h3>
                    
                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-black">Property type</label>
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

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <label className="block font-display text-sm font-black text-black">Country</label>
                        <div className="relative">
                          <select className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black/70 appearance-none focus:outline-none focus:ring-1 focus:ring-black/10">
                            <option>Select</option>
                            <option>United Kingdom</option>
                            <option>United States</option>
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M1 1L5 5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="block font-display text-sm font-black text-[#001C47]">City</label>
                        <input type="text" name="city" placeholder="Enter City" className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-[#001C47]">Estimated value range</label>
                      <input type="text" name="estimatedValue" placeholder="e.g £200,000 - £500,000" className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10" />
                    </div>

                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-black">Current status</label>
                      <div className="relative">
                        <select className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black/70 appearance-none focus:outline-none focus:ring-1 focus:ring-black/10">
                          <option>Select</option>
                          <option>On-market</option>
                          <option>Off-market</option>
                          <option>Recently listed/Withdrawn</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L5 5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-[#001C47]">Current listing URL</label>
                      <input type="text" name="listingUrl" placeholder="https//.." className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10" />
                    </div>
                  </div>

                  {/* 2. Ownership & authority */}
                  <div className="space-y-6 pb-6 border-b border-black/10">
                    <h3 className="font-display text-xl font-medium tracking-[-0.4px] text-black">2. Ownership & authority</h3>
                    
                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-black">You are the?</label>
                      <div className="relative">
                        <select className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black/70 appearance-none focus:outline-none focus:ring-1 focus:ring-black/10">
                          <option>Select</option>
                          <option>Legal owner</option>
                          <option>Representative / agent</option>
                          <option>Family office / trustee / advisor</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L5 5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-black">Ownership type</label>
                      <div className="relative">
                        <select className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black/70 appearance-none focus:outline-none focus:ring-1 focus:ring-black/10">
                          <option>Select</option>
                          <option>Sole</option>
                          <option>Joint / multiple parties</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L5 5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center mt-1">
                        <input type="checkbox" className="peer sr-only" required />
                        <div className="h-5 w-5 rounded border-2 border-black/20 peer-checked:border-none peer-checked:bg-[#00BC67] transition-all" />
                        <Check size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                      </div>
                      <span className="font-body text-sm font-semibold text-black/80 group-hover:text-black transition-colors leading-tight">
                        I am fully authorised to proceed with international buyer introductions
                      </span>
                    </label>
                  </div>

                  {/* 3. Sales intent */}
                  <div className="space-y-6 pb-6 border-b border-black/10">
                    <h3 className="font-display text-xl font-medium tracking-[-0.4px] text-black">3. Sales intent</h3>
                    
                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-black">Primary objective</label>
                      <div className="relative">
                        <select className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black/70 appearance-none focus:outline-none focus:ring-1 focus:ring-black/10">
                          <option>Select</option>
                          <option>Discreet off-market sale</option>
                          <option>Fast liquidation</option>
                          <option>Maximum international exposure</option>
                          <option>Market testing / valuation discovery</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L5 5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-black">Preferred sale timeframe</label>
                      <div className="relative">
                        <select className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black/70 appearance-none focus:outline-none focus:ring-1 focus:ring-black/10">
                          <option>Select</option>
                          <option>0–3 months</option>
                          <option>3–6 months</option>
                          <option>Flexible</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L5 5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4. Asset positioning */}
                  <div className="space-y-6 pb-6 border-b border-black/10">
                    <h3 className="font-display text-xl font-medium tracking-[-0.4px] text-black">4. Asset positioning</h3>
                    
                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-black">What makes this property a unique international asset?</label>
                      <textarea 
                        name="uniqueAsset"
                        placeholder="Describe property key selling point..." 
                        className="w-full h-32 p-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10 resize-none"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-black">Has the property been previously marketed internationally?</label>
                      <div className="relative">
                        <select className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black/70 appearance-none focus:outline-none focus:ring-1 focus:ring-black/10">
                          <option>Select</option>
                          <option>YES</option>
                          <option>NO</option>
                          <option>Previously listed without sale</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L5 5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-[#001C47]">If yes, which platforms or agencies were used?</label>
                      <input type="text" placeholder="e.g Sotheby’s, JLL, Rightmove Overseas......" className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10" />
                    </div>
                  </div>

                  {/* 5. Pricing expectations */}
                  <div className="space-y-6 pb-6 border-b border-black/10">
                    <h3 className="font-display text-xl font-medium tracking-[-0.4px] text-black">5. Pricing expectations</h3>
                    
                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-[#001C47]">Expected sale price range</label>
                      <input type="text" name="expectedPrice" placeholder="e.g £200,000 - £500,000" className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10" />
                    </div>

                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-black">Pricing structure</label>
                      <div className="relative">
                        <select className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black/70 appearance-none focus:outline-none focus:ring-1 focus:ring-black/10">
                          <option>Select</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L5 5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 6. Discretion & marketing preferences */}
                  <div className="space-y-6 pb-6 border-b border-black/10">
                    <h3 className="font-display text-xl font-medium tracking-[-0.4px] text-black">6. Discretion & marketing preferences</h3>
                    
                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-black">Level of discretion required</label>
                      <div className="relative">
                        <select className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black/70 appearance-none focus:outline-none focus:ring-1 focus:ring-black/10">
                          <option>Select</option>
                          <option>Fully off-market (NDA required)</option>
                          <option>Selective qualified buyers only</option>
                          <option>Broad international exposure</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L5 5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-black">Open to…</label>
                      <div className="relative">
                        <select className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black/70 appearance-none focus:outline-none focus:ring-1 focus:ring-black/10">
                          <option>Select</option>
                          <option>Private introductions only</option>
                          <option>Full international buyer campaign</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L5 5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 7. Timeline & motivation */}
                  <div className="space-y-6 pb-6 border-b border-black/10">
                    <h3 className="font-display text-xl font-medium tracking-[-0.4px] text-black">7. Timeline & motivation</h3>
                    
                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-black">Primary reason for sale</label>
                      <textarea 
                        placeholder="Describe your motivation.." 
                        className="w-full h-32 p-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10 resize-none"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-black">Ideal completion timeline</label>
                      <input type="text" placeholder="e.g Before end of Q3 2026" className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10" />
                    </div>
                  </div>

                  {/* 8. Contact & verification */}
                  <div className="space-y-6 pb-6 border-b border-black/10">
                    <h3 className="font-display text-xl font-medium tracking-[-0.4px] text-black">8. Contact & verification</h3>
                    
                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-[#001C47]">Full name</label>
                      <input type="text" placeholder="Enter name" className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10" />
                    </div>

                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-[#001C47]">Email address</label>
                      <input type="email" placeholder="Enter email" className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10" />
                    </div>

                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-[#001C47]">Phone / WhatsApp</label>
                      <div className="flex gap-2">
                        <div className="relative w-24">
                          <div className="w-full h-12 px-3 rounded-lg bg-[#DDD] flex items-center justify-between">
                            <span className="font-body text-sm font-medium text-black/80">+44</span>
                            <svg width="8" height="4" viewBox="0 0 8 4" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path opacity="0.8" d="M0 0L4 4L8 0" fill="black" fillOpacity="0.8"/>
                            </svg>
                          </div>
                        </div>
                        <input type="tel" placeholder="0000 0000 000" className="flex-1 h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="block font-display text-sm font-black text-black">Preferred contact method</label>
                      <div className="relative">
                        <select className="w-full h-12 px-4 rounded-lg border border-black/10 bg-white font-body text-sm font-semibold text-black/70 appearance-none focus:outline-none focus:ring-1 focus:ring-black/10">
                          <option>Select</option>
                          <option>Email</option>
                          <option>Whatsapp</option>
                          <option>Phone</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L5 5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 9. Agreement & access fee */}
                  <div className="space-y-6 pb-10">
                    <h3 className="font-display text-xl font-medium tracking-[-0.4px] text-black">9. Agreement & access fee</h3>
                    
                    <div className="p-4 rounded-xl border border-[#CCE3FF] bg-[#D6E9FF]">
                      <p className="font-body text-base leading-relaxed tracking-[-0.32px] text-black">
                        <span className="font-bold">Total fee: £20,000</span>, payable as a <span className="font-bold">£5,000 private mandate fee</span> upfront and a <span className="font-bold">£15,000 success advisory fee</span> upon buyer commitment or successful sale completion.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center mt-1">
                          <input type="checkbox" className="peer sr-only" required />
                          <div className="h-5 w-5 rounded border-2 border-black/20 peer-checked:border-none peer-checked:bg-[#00BC67] transition-all" />
                          <Check size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                        </div>
                        <span className="font-body text-sm font-semibold text-black/80 group-hover:text-black transition-colors leading-tight">
                          I confirm I am authorised to represent or sell this property
                        </span>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center mt-1">
                          <input type="checkbox" className="peer sr-only" required />
                          <div className="h-5 w-5 rounded border-2 border-black/20 peer-checked:border-none peer-checked:bg-[#00BC67] transition-all" />
                          <Check size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                        </div>
                        <span className="font-body text-sm font-semibold text-black/80 group-hover:text-black transition-colors leading-tight">
                          I understand this is a paid onboarding process for access to vetted international buyers
                        </span>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center mt-1">
                          <input type="checkbox" className="peer sr-only" required />
                          <div className="h-5 w-5 rounded border-2 border-black/20 peer-checked:border-none peer-checked:bg-[#00BC67] transition-all" />
                          <Check size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                        </div>
                        <span className="font-body text-sm font-semibold text-black/80 group-hover:text-black transition-colors leading-tight">
                          I agree to the fee structure described above
                        </span>
                      </label>
                    </div>
                  </div>
                </form>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 bg-white border-t border-[#F1F1F0] flex-shrink-0">
                {submitError && <p className="text-red-500 text-sm font-body mb-3">{submitError}</p>}
                <Button 
                  type="submit"
                  form="elite-property-form"
                  disabled={submitting}
                  className="h-[60px] w-full rounded-full bg-black text-white flex items-center justify-center gap-3 group border-none disabled:opacity-50"
                >
                  <span className="font-body text-base lg:text-lg font-semibold tracking-[-0.32px] uppercase">{submitting ? 'SUBMITTING...' : 'SUBMIT APPLICATION & PROCEED TO PAYMENT'}</span>
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
                <h3 className="font-display text-[28px] lg:text-[32px] font-black leading-none tracking-[-0.64px] text-black">
                  Thank you, your submission has been received
                </h3>
                <p className="font-body text-base font-medium leading-[1.25] tracking-[-0.32px] text-black/70">
                  Your submission is under review by our advisory team. We accept a limited number of properties to maintain quality and discretion. If approved, a team member will contact you within 24–48 hours to discuss next steps. Access to our international buyer network is reserved for approved listings only. If not accepted, you'll be notified and refunded within 7 working days.
                </p>
              </div>
              <Button 
                onClick={() => setIsSuccess(false)}
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

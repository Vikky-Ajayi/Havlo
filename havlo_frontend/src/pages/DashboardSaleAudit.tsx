import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { X, Check, FileText, Search, ArrowRight } from 'lucide-react';

export const DashboardSaleAudit: React.FC = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [hasFeedback, setHasFeedback] = useState(false); // Toggle this to show the feedback alert

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsDrawerOpen(false);
    setIsSuccessModalOpen(true);
  };

  return (
    <DashboardLayout title="Property Sale Audit">
      <div className="max-w-[1162px] mx-auto px-6 lg:px-0 space-y-10 pb-20">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-[20px] bg-black p-10 lg:p-14 min-h-[250px] flex flex-col justify-center">
          <div className="relative z-10 space-y-6 max-w-[919px]">
            <h2 className="font-display text-3xl lg:text-[40px] font-black leading-tight tracking-[-0.4px] text-white">
              Find out why your property isn't selling — and how to fix it
            </h2>
            <p className="font-body text-base lg:text-lg font-medium leading-relaxed tracking-[-0.32px] text-white/80">
              A specialist review for properties that have been on the market for an extended period. We analyse your listing, positioning, pricing strategy, and presentation to identify the key barriers preventing buyer interest.
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {/* Card 1: Request Property Assessment */}
          <div className="flex flex-col p-8 lg:p-10 rounded-[20px] border border-[#F1F1F0] bg-white min-h-[450px] lg:min-h-[502px] justify-between">
            <div className="space-y-10">
              <div className="h-14 w-14 rounded-full bg-[#F0F0F0] flex items-center justify-center">
                <Search size={24} className="text-black" />
              </div>
              <div className="space-y-6">
                <h3 className="font-display text-2xl lg:text-[32px] font-black leading-none tracking-[-0.64px] text-black">
                  Request Property Assessment
                </h3>
                <p className="font-body text-base font-medium leading-[1.25] tracking-[-0.32px] text-black/70">
                  Get a professional evaluation of your property’s value, potential, and market fit. Our experts provide clear insights to help you make informed decisions.
                </p>
              </div>
            </div>
            <Button 
              onClick={() => setIsDrawerOpen(true)}
              className="h-[72px] w-full rounded-full bg-black text-white flex items-center justify-between px-8 group border-none"
            >
              <span className="font-body text-xl font-semibold tracking-[-0.4px] uppercase">Request Assessment</span>
              <ArrowRight size={32} className="transition-transform group-hover:translate-x-1" />
            </Button>
          </div>

          {/* Card 2: View Assessment Feedback */}
          <div className="flex flex-col p-8 lg:p-10 rounded-[20px] border border-[#F1F1F0] bg-white min-h-[450px] lg:min-h-[502px] justify-between">
            <div className="space-y-10">
              <div className="h-14 w-14 rounded-full bg-[#F0F0F0] flex items-center justify-center">
                <FileText size={24} className="text-black" />
              </div>
              <div className="space-y-6">
                <h3 className="font-display text-2xl lg:text-[32px] font-black leading-none tracking-[-0.64px] text-black">
                  View Assessment Feedback
                </h3>
                <p className="font-body text-base font-medium leading-[1.25] tracking-[-0.32px] text-black/70">
                  Review detailed insights on your property, including its value, strengths, and market positioning to guide your next steps.
                </p>
              </div>
              
              {/* Feedback Alert Box (Conditional) */}
              {!hasFeedback && (
                <div className="p-4 rounded-xl bg-[#FFEBEE] border border-[#FFCDD2]">
                  <p className="font-body text-sm font-medium leading-relaxed text-[#D80027]">
                    Your assessment feedback will appear here once your report has been prepared by our team. Please check your Inbox for an email notification.
                  </p>
                </div>
              )}
            </div>
            <Button 
              className="h-[72px] w-full rounded-full bg-black text-white flex items-center justify-between px-8 group border-none"
            >
              <span className="font-body text-xl font-semibold tracking-[-0.4px] uppercase">View Feedback</span>
              <ArrowRight size={32} className="transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Request Assessment Drawer */}
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
                <h2 className="font-display text-xl font-medium tracking-[-0.4px] text-black">Request a property assessment</h2>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="h-8 w-8 bg-[#EFEFEF] rounded-md flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X size={16} className="text-black" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
                <form id="sale-audit-form" onSubmit={handleSubmit} className="space-y-10">
                  {/* 1. Listing */}
                  <div className="space-y-6 pb-6 border-b border-black/10">
                    <h3 className="font-display text-xl font-medium tracking-[-0.4px] text-black">1. Listing</h3>
                    
                    <div className="space-y-4">
                      <label className="block font-display text-sm font-bold text-[#001C47]">Link of where the property is currently listed</label>
                      <input 
                        type="text" 
                        placeholder="(Paste Rightmove / Zoopla / other listing URL)" 
                        className="w-full h-12 px-4 rounded-lg border border-black/5 bg-white font-body text-sm font-medium text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10" 
                      />
                    </div>
                  </div>

                  {/* 2. Market activity */}
                  <div className="space-y-6 pb-6 border-b border-black/10">
                    <h3 className="font-display text-xl font-medium tracking-[-0.4px] text-black">2. Market activity</h3>
                    
                    <div className="space-y-4">
                      <label className="block font-display text-sm font-bold text-[#001C47]">How many viewings have you received?</label>
                      <input 
                        type="text" 
                        placeholder="(Approximate number is fine" 
                        className="w-full h-12 px-4 rounded-lg border border-black/5 bg-white font-body text-sm font-medium text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10" 
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="block font-display text-sm font-bold text-[#001C47]">How many offers have you received?</label>
                      <input 
                        type="text" 
                        placeholder="Enter 0 if none" 
                        className="w-full h-12 px-4 rounded-lg border border-black/5 bg-white font-body text-sm font-medium text-black placeholder:text-black/30 focus:outline-none focus:ring-1 focus:ring-black/10" 
                      />
                    </div>
                  </div>

                  {/* Fee Information Boxes */}
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-[#D0D1D0]">
                      <p className="font-body text-base font-medium leading-relaxed tracking-[-0.32px] text-black">
                        Assessment fee applies. You will be directed to payment after submitting this form.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-[#CCE3FF] bg-[#D6E9FF]">
                      <p className="font-body text-base leading-relaxed tracking-[-0.32px] text-black">
                        <span className="font-bold">Total fee: £1,999.99</span>, payable as a one-time relaunch assessment fee upfront. Includes a full PDF report and a <span className="font-bold">30–60 minute consultation call.</span>
                      </p>
                    </div>
                  </div>
                </form>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 bg-white border-t border-[#F1F1F0] flex-shrink-0">
                <Button 
                  type="submit"
                  form="sale-audit-form"
                  className="h-[60px] w-full rounded-full bg-black text-white flex items-center justify-center gap-3 group border-none"
                >
                  <span className="font-body text-base lg:text-lg font-semibold tracking-[-0.32px] uppercase">SUBMIT & PROCEED TO PAYMENT</span>
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
                  We're uncovering why it hasn't sold yet. You'll receive a detailed feedback report within the next <span className="font-bold text-black">7 working days.</span>
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

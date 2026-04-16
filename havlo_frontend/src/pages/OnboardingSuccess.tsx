import React from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useModal } from '../hooks/useModal';

export const OnboardingSuccess: React.FC = () => {
  const { openModal } = useModal();
  return (
    <div className="flex flex-col min-h-screen bg-white overflow-x-hidden">
      <div className="flex flex-col items-center px-6 py-20 lg:px-[100px]">
        {/* Title Section */}
        <div className="flex flex-col items-center gap-5 text-center mb-8">
          <span className="font-body text-base font-medium text-black/90 tracking-[-0.32px] opacity-80">
            Thanks for your interest!
          </span>
          <h1 className="font-display text-[32px] font-black leading-none tracking-[-0.64px] text-black">
            You're One Step Closer to Owning Property Abroad!
          </h1>
        </div>

        {/* Primary CTA Card (Purple) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[800px] bg-[#9706C1] rounded-[20px] p-10 flex flex-col items-center gap-8 text-center"
        >
          <div className="flex flex-col items-center gap-10">
            <p className="font-body text-lg font-medium leading-[1.7] tracking-[-0.054px] text-white">
              📞 The fastest way to move forward is a quick call
            </p>
            <h2 className="font-display text-[64px] md:text-[88px] font-medium leading-none tracking-[-1.76px] text-white">
              +44 829 021 9101
            </h2>
          </div>
          <Button 
            className="w-[233px] h-14 bg-white text-[#101C20] rounded-[48px] font-body text-lg font-bold tracking-[-0.36px] hover:bg-white/90 transition-colors"
            onClick={() => window.location.href = 'tel:+448290219101'}
          >
            CALL NOW
          </Button>
        </motion.div>

        {/* Separator */}
        <div className="w-full max-w-[800px] flex items-center gap-4 my-8">
          <div className="flex-1 h-[1px] bg-black/10" />
          <span className="font-body text-base font-medium text-black/90 tracking-[-0.32px] uppercase opacity-80">
            or if you prefer
          </span>
          <div className="flex-1 h-[1px] bg-black/10" />
        </div>

        {/* Secondary CTA Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-[800px] border border-black/10 rounded-[20px] p-6 flex flex-col md:flex-row items-center justify-between gap-6 mb-8"
        >
          <div className="flex flex-col items-start gap-5">
            <h3 className="font-body text-lg font-bold text-black/90 tracking-[-0.36px] opacity-80">
              📅 Book an Appointment
            </h3>
            <p className="font-body text-base font-medium text-black/90 tracking-[-0.32px] opacity-80">
              Schedule a call at a time that works for you
            </p>
          </div>
          <button 
            onClick={() => openModal('book-session')}
            className="h-11 px-6 rounded-[44px] border border-[#9607C1] text-[#9607C1] font-body text-base font-semibold tracking-[-0.32px] hover:bg-[#9607C1]/5 transition-colors"
          >
            Book Now
          </button>
        </motion.div>

        {/* Info Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-[800px] bg-black/[0.03] rounded-[20px] p-6 flex flex-col gap-12 mb-8"
        >
          <div className="flex flex-col items-start gap-5">
            <h4 className="font-body text-lg font-bold text-black/90 tracking-[-0.36px] opacity-80">
              We'll discuss:
            </h4>
            <div className="flex flex-col gap-5">
              {[
                'The best countries for your budget',
                'Legal & residency options',
                'Available properties right now'
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <div className="text-[#00BC67]">
                    <Check size={16} strokeWidth={3} />
                  </div>
                  <span className="font-body text-base font-medium text-black/90 tracking-[-0.32px] opacity-80">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p className="font-body text-base font-medium text-black/90 tracking-[-0.32px] opacity-80">
            ⏱️ Calls usually take 10–15 minutes
          </p>
        </motion.div>

        {/* Footer Message */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="font-body text-base font-medium text-[#D80027] tracking-[-0.32px]"
        >
          👉 Call now to secure your options before they're gone!
        </motion.p>
      </div>
    </div>
  );
};

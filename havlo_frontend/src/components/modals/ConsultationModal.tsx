import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, MessageCircle, CalendarCheck } from 'lucide-react';
import { useModal } from '../../hooks/useModal';
import { useConfig } from '../../hooks/useConfig';

const WHATSAPP_URL = 'https://wa.me/message/PPPAWIAXBS7YK1';

export const ConsultationModal: React.FC = () => {
  const { closeModal } = useModal();
  const config = useConfig();
  const CALENDLY_URL = config.calendly_link || 'https://calendly.com/hello-heyhavlo/havlo-enquiry-call';

  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[6px] px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeModal}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-[520px] rounded-3xl bg-white p-8 shadow-2xl flex flex-col gap-6"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={closeModal}
            className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors"
          >
            <X size={18} className="text-black/70" />
          </button>

          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#A409D2]/10">
              <CalendarCheck size={36} className="text-[#A409D2]" />
            </div>
            <h2 className="font-display text-3xl font-black text-black leading-tight">
              Let's book your consultation
            </h2>
            <p className="font-body text-base text-black/70 leading-relaxed">
              Speak with a dedicated Havlo advisor about your property goals. Choose the option that suits you best:
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full h-14 rounded-full bg-[#25D366] text-white font-body text-base font-bold hover:opacity-90 transition-opacity"
            >
              <MessageCircle size={20} />
              Chat with us on WhatsApp
            </a>
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full h-14 rounded-full bg-black text-white font-body text-base font-bold hover:bg-black/90 transition-colors"
            >
              <Calendar size={20} />
              Book a Calendly call
            </a>
            <button
              type="button"
              onClick={closeModal}
              className="mt-2 font-body text-sm font-semibold text-black/60 hover:text-black underline underline-offset-4"
            >
              Maybe later
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

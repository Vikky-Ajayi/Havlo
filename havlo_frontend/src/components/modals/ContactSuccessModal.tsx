import React from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { ModalWrapper } from './ModalWrapper';
import { useModal } from '../../hooks/useModal';
import { Button } from '../ui/Button';

export const ContactSuccessModal: React.FC = () => {
  const { closeModal } = useModal();

  return (
    <ModalWrapper>
      <div className="relative flex flex-col items-center gap-6 px-8 py-10 text-center">
        <button
          type="button"
          onClick={closeModal}
          aria-label="Close"
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E5E5] transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E6F8EE]">
          <CheckCircle2 className="h-9 w-9 text-[#16A34A]" />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="font-display text-3xl font-black leading-tight text-black">
            Thanks — your enquiry is in motion.
          </h2>
          <p className="font-body text-base leading-relaxed text-black/70">
            Expect to hear from us soon.
          </p>
        </div>

        <Button
          onClick={closeModal}
          className="h-12 w-full max-w-[240px] rounded-[48px] bg-black text-white font-semibold hover:bg-black/90"
        >
          Got it
        </Button>
      </div>
    </ModalWrapper>
  );
};

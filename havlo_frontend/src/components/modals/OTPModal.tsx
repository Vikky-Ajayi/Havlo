import React, { useState, useRef } from 'react';
import { ModalWrapper } from './ModalWrapper';
import { useModal } from '../../hooks/useModal';
import { Button } from '../ui/Button';
import { X } from 'lucide-react';

export const OTPModal: React.FC = () => {
  const { closeModal, switchModal } = useModal();

  return (
    <ModalWrapper>
      <div className="flex flex-col gap-8 p-8 sm:p-[32px_24px] bg-white">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[32px] font-black leading-none text-black">
            Enter OTP
          </h2>
          <button
            onClick={closeModal}
            className="flex h-6 w-6 items-center justify-center rounded-sm transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.05 13.3L0 12.25L5.6 6.65L0 1.05L1.05 0L6.65 5.6L12.25 0L13.3 1.05L7.7 6.65L13.3 12.25L12.25 13.3L6.65 7.7L1.05 13.3Z" fill="black" fillOpacity="0.8"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-[80px]">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl p-[16px_0]">
              <p className="font-body text-xl font-medium tracking-[-0.4px] text-black/70">
                Enter the 6 digit Code sent to <span className="font-bold text-black">Freebornehirhere@gmail.com</span>
              </p>
            </div>

            {/* Code Input */}
            <div className="relative flex items-center rounded-xl border border-[rgba(58,60,62,0.10)] bg-[rgba(36,38,40,0.05)] p-4">
              <input
                type="text"
                placeholder="Enter Code"
                className="w-full bg-transparent font-body text-base font-medium tracking-[-0.32px] text-black outline-none placeholder:text-black/50"
              />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {/* Reset Code */}
            <div className="text-center font-body text-base font-medium tracking-[-0.32px] text-black">
              Didn’t get Code?{' '}
              <button
                className="font-bold underline underline-offset-4 hover:opacity-70"
              >
                Reset Code
              </button>
            </div>

            {/* Submit Button */}
            <Button 
              variant="primary" 
              className="h-14 w-full rounded-[48px] bg-black text-white font-body text-lg font-bold tracking-[-0.36px] hover:bg-black/90 transition-colors"
              onClick={() => switchModal('new-password')}
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
};

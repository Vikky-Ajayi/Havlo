import React from 'react';
import { ModalWrapper } from './ModalWrapper';
import { useModal } from '../../hooks/useModal';
import { Button } from '../ui/Button';
import { X, ChevronDown } from 'lucide-react';

export const BookSessionModal: React.FC = () => {
  const { closeModal } = useModal();

  return (
    <ModalWrapper>
      <div className="flex flex-col gap-8 p-8 sm:p-[32px_24px]">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[32px] font-black leading-none text-black">
              Book Your Consultation
            </h2>
            <button
              onClick={closeModal}
              className="flex h-6 w-6 items-center justify-center rounded-sm bg-[#3A3C3E] text-white/80 transition-colors hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
          <p className="font-body text-[20px] font-medium leading-[1.3] tracking-[-0.4px] text-black/70">
            Schedule a personalized session with our expert to discuss your needs and goals.
          </p>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-6">
            {/* Name Row */}
            <div className="flex gap-6">
              <div className="relative flex flex-1 items-center rounded-xl border border-black/10 bg-[#242628]/[0.05] p-4">
                <input
                  type="text"
                  placeholder="First name"
                  className="w-full bg-transparent font-body text-base font-medium text-black outline-none placeholder:text-black/50"
                />
              </div>
              <div className="relative flex flex-1 items-center rounded-xl border border-black/10 bg-[#242628]/[0.05] p-4">
                <input
                  type="text"
                  placeholder="Last name"
                  className="w-full bg-transparent font-body text-base font-medium text-black outline-none placeholder:text-black/50"
                />
              </div>
            </div>

            {/* Phone Input */}
            <div className="relative flex h-14 items-center gap-2 rounded-xl border border-black/10 bg-[#242628]/[0.05] px-2">
              <div className="flex h-8 items-center gap-1 rounded-lg bg-[#DDD] px-1.5">
                <span className="font-body text-sm font-medium tracking-[-0.28px] text-black/80 opacity-60">
                  +44
                </span>
                <ChevronDown size={12} className="text-black/80 opacity-80" />
              </div>
              <input
                type="tel"
                placeholder="Enter phone number"
                className="w-full bg-transparent font-body text-base font-medium text-black outline-none placeholder:text-black/50"
              />
            </div>

            {/* Email Input */}
            <div className="relative flex items-center rounded-xl border border-black/10 bg-[#242628]/[0.05] p-4">
              <input
                type="email"
                placeholder="Email"
                className="w-full bg-transparent font-body text-base font-medium text-black outline-none placeholder:text-black/50"
              />
            </div>

            {/* Date & Time Selects */}
            <div className="relative flex items-center rounded-xl border border-black/10 bg-[#242628]/[0.05] p-4">
              <select className="w-full appearance-none bg-transparent font-body text-base font-medium text-black outline-none placeholder:text-black/50">
                <option value="" disabled selected>Preferred Date</option>
                <option value="2024-05-20">May 20, 2024</option>
                <option value="2024-05-21">May 21, 2024</option>
              </select>
              <ChevronDown size={20} className="pointer-events-none absolute right-4 text-[#7A7A7A]" />
            </div>

            <div className="relative flex items-center rounded-xl border border-black/10 bg-[#242628]/[0.05] p-4">
              <select className="w-full appearance-none bg-transparent font-body text-base font-medium text-black outline-none placeholder:text-black/50">
                <option value="" disabled selected>Preferred Time</option>
                <option value="09:00">09:00 AM</option>
                <option value="14:00">02:00 PM</option>
              </select>
              <ChevronDown size={20} className="pointer-events-none absolute right-4 text-[#7A7A7A]" />
            </div>
          </div>

          {/* Fee Box */}
          <div className="flex items-center justify-between rounded-xl border border-[#C2E8FF] bg-[#D6EFFF] p-[24px_20px]">
            <span className="font-body text-base font-medium tracking-[-0.32px] text-black">
              Session Fee
            </span>
            <span className="font-body text-[18px] font-bold tracking-[-0.36px] text-[#0078B4]">
              $200
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-6">
            <Button variant="primary" className="h-14 w-full rounded-[48px] text-lg font-bold">
              Confirm Booking
            </Button>
            <p className="text-center font-body text-base font-normal tracking-[-0.32px] text-black/70">
              You'll receive a confirmation email after booking
            </p>
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
};

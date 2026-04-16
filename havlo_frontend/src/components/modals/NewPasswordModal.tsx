import React, { useState } from 'react';
import { ModalWrapper } from './ModalWrapper';
import { useModal } from '../../hooks/useModal';
import { Button } from '../ui/Button';
import { X, Eye, EyeOff } from 'lucide-react';

export const NewPasswordModal: React.FC = () => {
  const { closeModal, switchModal } = useModal();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <ModalWrapper>
      <div className="flex flex-col gap-8 p-8 sm:p-[32px_24px] bg-white">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[32px] font-black leading-none text-black">
            Create new password
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

        {/* Form */}
        <div className="flex flex-col gap-[80px]">
          <div className="flex flex-col gap-6">
            {/* New Password Input */}
            <div className="relative flex items-center rounded-xl border border-[rgba(58,60,62,0.10)] bg-[rgba(36,38,40,0.05)] p-4">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="New Password"
                className="w-full bg-transparent font-body text-base font-medium tracking-[-0.32px] text-black outline-none placeholder:text-black/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[#AEAFB0] transition-colors hover:text-black"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.1139 9.729L20.5709 9C19.8233 10.6713 18.6082 12.0906 17.0722 13.0869C15.5362 14.0832 13.7447 14.6139 11.9139 14.615C10.083 14.6139 8.29158 14.0832 6.75554 13.0869C5.2195 12.0906 4.00445 10.6713 3.25687 9L1.71387 9.729C2.298 10.9856 3.09584 12.1313 4.07187 13.115L2.44187 15.086L3.77187 16.2L5.39987 14.23C5.99987 14.659 6.64287 15.044 7.28587 15.344L6.42887 17.744L8.05687 18.344L8.91387 15.944C9.60994 16.159 10.3295 16.2886 11.0569 16.33V18.9H12.7709V16.33C13.4982 16.2886 14.2178 16.1589 14.9139 15.944L15.7709 18.344L17.4009 17.744L16.5429 15.344C17.2289 15.044 17.8289 14.659 18.4289 14.23L20.0569 16.201L21.3859 15.087L19.7569 13.116C20.7429 12.13 21.5569 11.015 22.1139 9.729Z" fill="#AEAFB0"/>
                </svg>
              </button>
            </div>

            {/* Confirm Password Input */}
            <div className="relative flex items-center rounded-xl border border-[rgba(58,60,62,0.10)] bg-[rgba(36,38,40,0.05)] p-4">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm New Password"
                className="w-full bg-transparent font-body text-base font-medium tracking-[-0.32px] text-black outline-none placeholder:text-black/50"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="text-[#AEAFB0] transition-colors hover:text-black"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.1139 9.729L20.5709 9C19.8233 10.6713 18.6082 12.0906 17.0722 13.0869C15.5362 14.0832 13.7447 14.6139 11.9139 14.615C10.083 14.6139 8.29158 14.0832 6.75554 13.0869C5.2195 12.0906 4.00445 10.6713 3.25687 9L1.71387 9.729C2.298 10.9856 3.09584 12.1313 4.07187 13.115L2.44187 15.086L3.77187 16.2L5.39987 14.23C5.99987 14.659 6.64287 15.044 7.28587 15.344L6.42887 17.744L8.05687 18.344L8.91387 15.944C9.60994 16.159 10.3295 16.2886 11.0569 16.33V18.9H12.7709V16.33C13.4982 16.2886 14.2178 16.1589 14.9139 15.944L15.7709 18.344L17.4009 17.744L16.5429 15.344C17.2289 15.044 17.8289 14.659 18.4289 14.23L20.0569 16.201L21.3859 15.087L19.7569 13.116C20.7429 12.13 21.5569 11.015 22.1139 9.729Z" fill="#AEAFB0"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            variant="primary" 
            className="h-14 w-full rounded-[48px] bg-black text-white font-body text-lg font-bold tracking-[-0.36px] hover:bg-black/90 transition-colors"
            onClick={() => switchModal('login')}
          >
            Continue
          </Button>
        </div>
      </div>
    </ModalWrapper>
  );
};

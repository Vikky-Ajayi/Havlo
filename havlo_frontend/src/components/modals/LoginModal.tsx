import React, { useState } from 'react';
import { ModalWrapper } from './ModalWrapper';
import { useModal } from '../../hooks/useModal';
import { Button } from '../ui/Button';
import { X, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const LoginModal: React.FC = () => {
  const { closeModal, switchModal } = useModal();
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = () => {
    closeModal();
    navigate('/dashboard');
  };

  return (
    <ModalWrapper>
      <div className="flex flex-col gap-8 p-8 sm:p-[32px_24px] bg-white">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[32px] font-black leading-none text-black">
            Log in
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
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-6">
              {/* Email Input */}
              <div className="relative flex items-center rounded-xl border border-[rgba(58,60,62,0.10)] bg-[rgba(36,38,40,0.05)] p-4">
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full bg-transparent font-body text-base font-medium tracking-[-0.32px] text-black outline-none placeholder:text-black/50"
                />
              </div>

              {/* Password Input */}
              <div className="relative flex items-center rounded-xl border border-[rgba(58,60,62,0.10)] bg-[rgba(36,38,40,0.05)] p-4">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  className="w-full bg-transparent font-body text-base font-medium tracking-[-0.32px] text-black outline-none placeholder:text-black/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-black/50 transition-colors hover:text-black"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.1141 9.729L20.5711 9C19.8235 10.6713 18.6085 12.0906 17.0724 13.0869C15.5364 14.0832 13.745 14.6139 11.9141 14.615C10.0833 14.6139 8.29183 14.0832 6.75579 13.0869C5.21975 12.0906 4.00469 10.6713 3.25711 9L1.71411 9.729C2.29824 10.9856 3.09609 12.1313 4.07211 13.115L2.44211 15.086L3.77211 16.2L5.40011 14.23C6.00011 14.659 6.64311 15.044 7.28611 15.344L6.42911 17.744L8.05711 18.344L8.91411 15.944C9.61018 16.159 10.3298 16.2886 11.0571 16.33V18.9H12.7711V16.33C13.4984 16.2886 14.218 16.1589 14.9141 15.944L15.7711 18.344L17.4011 17.744L16.5431 15.344C17.2291 15.044 17.8291 14.659 18.4291 14.23L20.0571 16.201L21.3861 15.087L19.7571 13.116C20.7431 12.13 21.5571 11.015 22.1141 9.729Z" fill="black" fillOpacity="0.5"/>
                  </svg>
                </button>
              </div>

              {/* Forgot Password */}
              <div className="flex h-14 items-center justify-center">
                <button
                  onClick={() => switchModal('forgot-password')}
                  className="font-body text-base font-medium tracking-[-0.32px] text-black underline underline-offset-4 hover:opacity-70"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              variant="primary" 
              className="h-14 w-full rounded-[48px] bg-black text-white font-body text-lg font-bold tracking-[-0.36px] hover:bg-black/90 transition-colors"
              onClick={handleLogin}
            >
              Log in
            </Button>

            {/* Footer Link */}
            <div className="flex h-14 items-center justify-center font-body text-base font-medium tracking-[-0.32px] text-black">
              Don’t have an account?{' '}
              <button
                onClick={() => switchModal('create-account')}
                className="ml-1 font-bold underline underline-offset-4 hover:opacity-70"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
};

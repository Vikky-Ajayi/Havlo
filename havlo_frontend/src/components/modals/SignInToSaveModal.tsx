import React from 'react';
import { useModal } from '../../hooks/useModal';

export const SignInToSaveModal: React.FC = () => {
  const { closeModal, switchModal } = useModal();

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={closeModal}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative z-10 bg-white w-full max-w-[440px] rounded-t-[28px] sm:rounded-[24px] p-8 mx-auto shadow-2xl">
        {/* Close button */}
        <button
          onClick={closeModal}
          className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-full bg-[#f5f5f5] text-black text-lg hover:bg-gray-200 transition-colors"
          aria-label="Close"
        >
          ×
        </button>

        {/* Title */}
        <h2 className="text-[24px] sm:text-[26px] font-bold text-black leading-tight mb-4">
          Sign In To Save Properties
        </h2>

        {/* Subtitle */}
        <p className="text-[15px] text-[#555] leading-relaxed mb-8">
          We provide end-to-end advisory and guidance, from search to sale, wherever you're buying.
        </p>

        {/* Create Account button */}
        <button
          onClick={() => switchModal('create-account')}
          className="w-full py-4 bg-black text-white text-[15px] font-semibold rounded-full hover:bg-gray-900 transition-colors mb-4"
        >
          Create Account
        </button>

        {/* Sign In link */}
        <button
          onClick={() => switchModal('login')}
          className="w-full py-3 text-[15px] text-black font-medium hover:underline transition-colors"
        >
          Sign in
        </button>
      </div>
    </div>
  );
};

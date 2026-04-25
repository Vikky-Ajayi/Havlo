import React, { useState } from 'react';
import { ModalWrapper } from './ModalWrapper';
import { useModal } from '../../hooks/useModal';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';

export const ForgotPasswordModal: React.FC = () => {
  const { closeModal } = useModal();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.forgotPassword(normalizedEmail);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper>
      <div className="flex flex-col gap-8 p-8 sm:p-[32px_24px] bg-white">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[32px] font-black leading-none text-black">
            Forgot Password?
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

        <div className="flex flex-col gap-[80px]">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-black/10 p-[16px_12px]">
              <div className="flex items-center gap-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 7L13.009 12.727C12.7039 12.9042 12.3573 12.9976 12.0045 12.9976C11.6517 12.9976 11.3051 12.9042 11 12.727L2 7M4 4L20 4C21.1046 4 22 4.89543 22 6V18C22 19.1046 21.1046 20 20 20L4 20C2.89543 20 2 19.1046 2 18L2 6C2 4.89543 2.89543 4 4 4Z" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-body text-2xl font-bold tracking-[-0.4px] text-black">
                  Enter your email address.
                </span>
              </div>
              <p className="text-center font-body text-base font-medium tracking-[-0.32px] text-black/80">
                {success
                  ? 'A password reset link has been sent to your email. Please check your inbox.'
                  : 'We will send you a link to reset your password.'}
              </p>
            </div>

            {!success && (
              <div className="relative flex items-center rounded-xl border border-[rgba(58,60,62,0.10)] bg-[rgba(36,38,40,0.05)] p-4">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="email"
                  autoComplete="email"
                  className="w-full bg-transparent font-body text-base font-medium tracking-[-0.32px] text-black outline-none placeholder:text-black/50"
                />
              </div>
            )}

            {error && <p className="text-red-500 text-sm font-body">{error}</p>}
          </div>

          {success ? (
            <Button 
              variant="primary" 
              className="h-14 w-full rounded-[48px] bg-black text-white font-body text-lg font-bold tracking-[-0.36px] hover:bg-black/90 transition-colors"
              onClick={closeModal}
            >
              Done
            </Button>
          ) : (
            <Button 
              variant="primary" 
              className="h-14 w-full rounded-[48px] bg-black text-white font-body text-lg font-bold tracking-[-0.36px] hover:bg-black/90 transition-colors disabled:opacity-50"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Request password reset'}
            </Button>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
};

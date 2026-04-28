import React, { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { ModalWrapper } from './ModalWrapper';
import { useModal } from '../../hooks/useModal';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';

export const OptOutModal: React.FC = () => {
  const { closeModal } = useModal();
  const [propertyAddress, setPropertyAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyAddress.trim()) {
      setError('Please enter your property address.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.marketingOptOut(propertyAddress.trim());
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper>
      <div className="relative flex flex-col gap-6 px-8 py-10">
        <button
          type="button"
          onClick={closeModal}
          aria-label="Close"
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E5E5] transition-colors"
        >
          <X size={16} />
        </button>

        {success ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E6F8EE]">
              <CheckCircle2 className="h-9 w-9 text-[#16A34A]" />
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-2xl font-black leading-tight text-black">
                You're opted out.
              </h2>
              <p className="font-body text-base leading-relaxed text-black/70">
                We've added <span className="font-semibold">{propertyAddress}</span> to our suppression list and will stop sending marketing letters to that address.
              </p>
            </div>
            <Button
              onClick={closeModal}
              className="h-12 w-full max-w-[240px] rounded-[48px] bg-black text-white font-semibold hover:bg-black/90"
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-2xl font-black leading-tight text-black">
                Stop Property Marketing by Post
              </h2>
              <p className="font-body text-sm leading-relaxed text-black/70">
                We respect your preference. Opt out below and we'll stop sending marketing letters to your address.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-body text-sm font-bold text-[#001C47]">
                Property Address<span className="text-[#FA4242]">*</span>
              </label>
              <input
                type="text"
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                placeholder="Enter your property address"
                required
                className="h-12 w-full rounded-lg bg-[#EEF0F2] px-4 font-body text-sm text-black placeholder:text-[#676B80]/60 focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-[#FEE2E2] px-4 py-3 font-body text-sm text-[#B91C1C]">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="h-12 w-full rounded-[48px] bg-black text-white font-semibold hover:bg-black/90 disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Confirm Opt-Out'}
            </Button>
          </form>
        )}
      </div>
    </ModalWrapper>
  );
};

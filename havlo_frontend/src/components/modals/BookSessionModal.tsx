import React, { useState } from 'react';
import { ModalWrapper } from './ModalWrapper';
import { useModal } from '../../hooks/useModal';
import { Button } from '../ui/Button';
import { X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { CountryCodeSelect } from '../shared/CountryCodeSelect';

export const BookSessionModal: React.FC = () => {
  const { closeModal } = useModal();
  const { token, user } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phoneCountryCode, setPhoneCountryCode] = useState(user?.phone_country_code || '+44');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [email, setEmail] = useState(user?.email || '');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateDateOptions = () => {
    const dates: { value: string; label: string }[] = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        dates.push({
          value: d.toISOString().split('T')[0],
          label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
        });
      }
    }
    return dates;
  };

  const timeOptions = [
    { value: '09:00', label: '09:00 AM' },
    { value: '10:00', label: '10:00 AM' },
    { value: '11:00', label: '11:00 AM' },
    { value: '12:00', label: '12:00 PM' },
    { value: '13:00', label: '01:00 PM' },
    { value: '14:00', label: '02:00 PM' },
    { value: '15:00', label: '03:00 PM' },
    { value: '16:00', label: '04:00 PM' },
    { value: '17:00', label: '05:00 PM' },
  ];

  const handleSubmit = async () => {
    if (!token) return;
    if (!firstName || !lastName || !email || !phoneNumber || !preferredDate || !preferredTime) {
      setError('Please fill in all fields including date and time.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.bookSession(token, {
        first_name: firstName,
        last_name: lastName,
        email,
        phone_country_code: phoneCountryCode,
        phone_number: phoneNumber,
        preferred_date: preferredDate,
        preferred_time: preferredTime,
      });
      if (result.checkout_url) {
        window.open(result.checkout_url, '_blank');
      }
      closeModal();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to book session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper>
      <div className="flex flex-col gap-8 p-8 sm:p-[32px_24px]">
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

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-6">
            <div className="flex gap-6">
              <div className="relative flex flex-1 items-center rounded-xl border border-black/10 bg-[#242628]/[0.05] p-4">
                <input
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-transparent font-body text-base font-medium text-black outline-none placeholder:text-black/50"
                />
              </div>
              <div className="relative flex flex-1 items-center rounded-xl border border-black/10 bg-[#242628]/[0.05] p-4">
                <input
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-transparent font-body text-base font-medium text-black outline-none placeholder:text-black/50"
                />
              </div>
            </div>

            <div className="relative flex h-14 items-center gap-2 rounded-xl border border-black/10 bg-[#242628]/[0.05] px-2">
              <CountryCodeSelect value={phoneCountryCode} onChange={setPhoneCountryCode} />
              <input
                type="tel"
                placeholder="Enter phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-transparent font-body text-base font-medium text-black outline-none placeholder:text-black/50"
              />
            </div>

            <div className="relative flex items-center rounded-xl border border-black/10 bg-[#242628]/[0.05] p-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent font-body text-base font-medium text-black outline-none placeholder:text-black/50"
              />
            </div>

            <div className="relative flex items-center rounded-xl border border-black/10 bg-[#242628]/[0.05] p-4">
              <select 
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="w-full appearance-none bg-transparent font-body text-base font-medium text-black outline-none"
              >
                <option value="">Preferred Date</option>
                {generateDateOptions().map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              <ChevronDown size={20} className="pointer-events-none absolute right-4 text-[#7A7A7A]" />
            </div>

            <div className="relative flex items-center rounded-xl border border-black/10 bg-[#242628]/[0.05] p-4">
              <select 
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="w-full appearance-none bg-transparent font-body text-base font-medium text-black outline-none"
              >
                <option value="">Preferred Time</option>
                {timeOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown size={20} className="pointer-events-none absolute right-4 text-[#7A7A7A]" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[#C2E8FF] bg-[#D6EFFF] p-[24px_20px]">
            <span className="font-body text-base font-medium tracking-[-0.32px] text-black">
              Session Fee
            </span>
            <span className="font-body text-[18px] font-bold tracking-[-0.36px] text-[#0078B4]">
              $200
            </span>
          </div>

          {error && <p className="text-red-500 text-sm font-body">{error}</p>}

          <div className="flex flex-col gap-6">
            <Button 
              variant="primary" 
              className="h-14 w-full rounded-[48px] text-lg font-bold disabled:opacity-50"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Confirm Booking'}
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

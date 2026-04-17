import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModalWrapper } from './ModalWrapper';
import { useModal } from '../../hooks/useModal';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CountryCodeSelect } from '../shared/CountryCodeSelect';

export const CreateAccountModal: React.FC = () => {
  const { closeModal, switchModal } = useModal();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+44');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');

    if (!firstName || !lastName || !email || !phoneNumber || !role || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== repeatPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await api.register({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone_country_code: phoneCountryCode,
        phone_number: phoneNumber,
        role,
      });

      const loginResp = await api.login({ email, password });
      await login(loginResp);
      closeModal();

      if (!loginResp.onboarding_complete) {
        navigate('/get-started');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper>
      <div className="flex flex-col gap-8 p-8 sm:p-[32px_24px] bg-white">
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="flex-1 font-display text-[56px] font-black leading-none tracking-[-1.12px] text-black">
              Create account
            </h2>
            <button
              onClick={closeModal}
              className="relative flex h-6 w-6 items-center justify-center rounded-sm bg-[#3A3C3E] transition-colors hover:bg-[#2A2C2E]"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1.05 13.3L0 12.25L5.6 6.65L0 1.05L1.05 0L6.65 5.6L12.25 0L13.3 1.05L7.7 6.65L13.3 12.25L12.25 13.3L6.65 7.7L1.05 13.3Z" fill="white" fillOpacity="0.8"/>
              </svg>
            </button>
          </div>
          <p className="font-body text-base font-medium leading-[1.5] tracking-[-0.32px] text-black/90 opacity-80">
            Join thousands of Users finding their dream properties worldwide
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-6">
            <div className="flex gap-6">
              <div className="relative flex flex-1 items-center rounded-xl border border-[rgba(58,60,62,0.10)] bg-[rgba(36,38,40,0.05)] p-4">
                <input
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full bg-transparent font-body text-base font-medium tracking-[-0.32px] text-black outline-none placeholder:text-black/50"
                />
              </div>
              <div className="relative flex flex-1 items-center rounded-xl border border-[rgba(58,60,62,0.10)] bg-[rgba(36,38,40,0.05)] p-4">
                <input
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full bg-transparent font-body text-base font-medium tracking-[-0.32px] text-black outline-none placeholder:text-black/50"
                />
              </div>
            </div>

            <div className="relative flex items-center rounded-xl border border-[rgba(58,60,62,0.10)] bg-[rgba(36,38,40,0.05)] p-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-transparent font-body text-base font-medium tracking-[-0.32px] text-black outline-none placeholder:text-black/50"
              />
            </div>

            <div className="relative flex h-14 items-center gap-2 rounded-xl border border-[rgba(58,60,62,0.10)] bg-[rgba(36,38,40,0.05)] px-2">
              <CountryCodeSelect value={phoneCountryCode} onChange={setPhoneCountryCode} />
              <input
                type="tel"
                placeholder="Enter phone number"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                className="w-full bg-transparent font-body text-base font-medium tracking-[-0.32px] text-black outline-none placeholder:text-black/50"
              />
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsRoleOpen(!isRoleOpen)}
                className="flex w-full items-center justify-between rounded-xl border border-[rgba(58,60,62,0.10)] bg-[rgba(36,38,40,0.05)] p-4 font-body text-base font-medium tracking-[-0.32px] text-black outline-none transition-all hover:border-black/20"
              >
                <span className={role ? 'text-black' : 'text-black/50'}>
                  {role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Select your role'}
                </span>
                <ChevronDown 
                  size={20} 
                  className={cn("text-black/50 transition-transform duration-200", isRoleOpen && "rotate-180")} 
                />
              </button>
              
              {isRoleOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-[60]" 
                    onClick={() => setIsRoleOpen(false)} 
                  />
                  <div className="absolute top-full left-0 z-[70] mt-2 w-full overflow-hidden rounded-xl border border-[rgba(58,60,62,0.10)] bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                    {['buyer', 'seller', 'agent'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setRole(option);
                          setIsRoleOpen(false);
                        }}
                        className={cn(
                          "w-full px-4 py-3 text-left font-body text-base font-medium transition-colors hover:bg-[rgba(36,38,40,0.05)]",
                          role === option ? "bg-[rgba(36,38,40,0.10)] text-black" : "text-black/70"
                        )}
                      >
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative flex items-center rounded-xl border border-[rgba(58,60,62,0.10)] bg-[rgba(36,38,40,0.05)] p-4">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-transparent font-body text-base font-medium tracking-[-0.32px] text-black outline-none placeholder:text-black/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-black/50 transition-colors hover:text-black"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.1139 9.729L20.5709 9C19.8233 10.6713 18.6082 12.0906 17.0722 13.0869C15.5362 14.0832 13.7447 14.6139 11.9139 14.615C10.083 14.6139 8.29158 14.0832 6.75554 13.0869C5.2195 12.0906 4.00445 10.6713 3.25687 9L1.71387 9.729C2.298 10.9856 3.09584 12.1313 4.07187 13.115L2.44187 15.086L3.77187 16.2L5.39987 14.23C5.99987 14.659 6.64287 15.044 7.28587 15.344L6.42887 17.744L8.05687 18.344L8.91387 15.944C9.60994 16.159 10.3295 16.2886 11.0569 16.33V18.9H12.7709V16.33C13.4982 16.2886 14.2178 16.1589 14.9139 15.944L15.7709 18.344L17.4009 17.744L16.5429 15.344C17.2289 15.044 17.8289 14.659 18.4289 14.23L20.0569 16.201L21.3859 15.087L19.7569 13.116C20.7429 12.13 21.5569 11.015 22.1139 9.729Z" fill="currentColor" fillOpacity={showPassword ? "1" : "0.5"}/>
                </svg>
              </button>
            </div>

            <div className="relative flex items-center rounded-xl border border-[rgba(58,60,62,0.10)] bg-[rgba(36,38,40,0.05)] p-4">
              <input
                type={showRepeatPassword ? 'text' : 'password'}
                placeholder="Repeat password"
                value={repeatPassword}
                onChange={e => setRepeatPassword(e.target.value)}
                className="w-full bg-transparent font-body text-base font-medium tracking-[-0.32px] text-black outline-none placeholder:text-black/50"
              />
              <button
                type="button"
                onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                className="text-black/50 transition-colors hover:text-black"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.1139 9.729L20.5709 9C19.8233 10.6713 18.6082 12.0906 17.0722 13.0869C15.5362 14.0832 13.7447 14.6139 11.9139 14.615C10.083 14.6139 8.29158 14.0832 6.75554 13.0869C5.2195 12.0906 4.00445 10.6713 3.25687 9L1.71387 9.729C2.298 10.9856 3.09584 12.1313 4.07187 13.115L2.44187 15.086L3.77187 16.2L5.39987 14.23C5.99987 14.659 6.64287 15.044 7.28587 15.344L6.42887 17.744L8.05687 18.344L8.91387 15.944C9.60994 16.159 10.3295 16.2886 11.0569 16.33V18.9H12.7709V16.33C13.4982 16.2886 14.2178 16.1589 14.9139 15.944L15.7709 18.344L17.4009 17.744L16.5429 15.344C17.2289 15.044 17.8289 14.659 18.4289 14.23L20.0569 16.201L21.3859 15.087L19.7569 13.116C20.7429 12.13 21.5569 11.015 22.1139 9.729Z" fill="currentColor" fillOpacity={showRepeatPassword ? "1" : "0.5"}/>
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Button 
              variant="primary" 
              className="h-14 w-full rounded-[48px] bg-black text-white font-body text-lg font-bold tracking-[-0.36px] hover:bg-black/90 transition-colors disabled:opacity-50"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
            <div className="flex h-14 items-center justify-center rounded-[56px] font-body text-base font-medium tracking-[-0.32px] text-black">
              Already have an account?{' '}
              <button
                onClick={() => switchModal('login')}
                className="ml-1 font-bold underline underline-offset-4 hover:opacity-70"
              >
                Log in
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
};

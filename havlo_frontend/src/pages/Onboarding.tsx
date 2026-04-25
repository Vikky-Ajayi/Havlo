import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  CheckCircle2,
  Circle,
  X,
  ChevronDown,
  Check,
  MessageCircle,
  Calendar,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { TrustpilotStars } from '../components/ui/TrustpilotStars';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { CountrySelect } from '../components/shared/CountrySelect';
import { CountryCodeSelect } from '../components/shared/CountryCodeSelect';
import { useConfig } from '../hooks/useConfig';

const TOTAL_STEPS = 9;

const WHATSAPP_URL = 'https://wa.me/message/PPPAWIAXBS7YK1';

const helpOptions = [
  { id: 'buy', label: 'I want to buy a property abroad' },
  { id: 'sell', label: 'I want to sell my property abroad' },
];

const propertyTypes = [
  { id: 'Residential', title: 'Residential', description: 'Primary or secondary home for living or renting' },
  { id: 'Commercial', title: 'Commercial', description: 'Properties for business purposes' },
  { id: 'Vacation Home', title: 'Vacation Home', description: 'Holiday retreat and getaway property' },
  { id: 'Investment', title: 'Investment', description: 'Rental income and capital appreciation' },
  { id: 'Other', title: 'Other', description: '' },
];

const timeframes = [
  'Immediately',
  '6-12 months',
  '1-2 years',
  'Just exploring',
];

const currencyOptions = [
  { code: 'USD', label: 'Dollars ($)' },
  { code: 'GBP', label: 'Pounds (£)' },
];

const marqueeItems = [
  'Initial Consultation and Needs Assessment',
  'International Property Search',
  'Legal and Regulatory Guidance',
  'Due Diligence and Documentation',
];

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { token, refreshUser } = useAuth();
  const config = useConfig();
  const CALENDLY_URL = config.calendly_link || 'https://calendly.com/hello-heyhavlo/havlo-enquiry-call';

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const [helpChoice, setHelpChoice] = useState<string>('buy');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedPropertyType, setSelectedPropertyType] = useState<string>('');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('');
  const [budget, setBudget] = useState<string>('');
  const [currency, setCurrency] = useState<string>('USD');
  const [baseCountry, setBaseCountry] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phoneCode, setPhoneCode] = useState<string>('+44');
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const currencyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) {
        setCurrencyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const removeCountry = (country: string) => {
    setSelectedCountries(prev => prev.filter(c => c !== country));
  };

  const goNext = () => {
    setSubmitError('');
    if (step === 1 && helpChoice === 'sell') {
      navigate('/property-audit');
      return;
    }
    setStep(prev => Math.min(prev + 1, TOTAL_STEPS));
  };
  const goBack = () => {
    setSubmitError('');
    if (step === 1) {
      navigate(-1);
      return;
    }
    setStep(prev => Math.max(prev - 1, 1));
  };

  const canContinue = (): boolean => {
    switch (step) {
      case 1: return !!helpChoice;
      case 2: return selectedCountries.length > 0;
      case 3: return !!selectedPropertyType;
      case 4: return !!selectedTimeframe;
      case 5: return budget.trim().length > 0;
      case 6: return !!baseCountry;
      case 7: return name.trim().length > 0;
      case 8: return /\S+@\S+\.\S+/.test(email.trim());
      case 9: return phoneNumber.trim().length >= 4;
      default: return false;
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      if (token) {
        const payload = {
          services: ['Buy property abroad'],
          countries: selectedCountries,
          property_type: selectedPropertyType,
          timeframe: selectedTimeframe,
          budget_amount: budget || undefined,
          budget_currency: currency,
          how_can_we_help: helpChoice === 'sell' ? 'Sell a property abroad' : 'Buy a property abroad',
          base_country: baseCountry,
          name,
          email,
          phone_country_code: phoneCode,
          phone_number: phoneNumber,
        } as Parameters<typeof api.submitOnboarding>[1];
        await api.submitOnboarding(token, payload);
        await refreshUser();
      }
      setShowSuccessPopup(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="flex flex-col min-h-screen bg-white overflow-x-hidden">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Left side: form */}
        <div className="flex-1 px-6 py-12 lg:px-[100px] lg:py-20 flex flex-col gap-8">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-2 px-3 py-2 bg-[#F4F4F4] rounded-lg w-fit hover:bg-gray-200 transition-colors"
          >
            <ChevronLeft size={16} />
            <span className="font-body text-sm font-semibold">Go back</span>
          </button>

          <div className="flex flex-col gap-2">
            <span className="font-body text-sm font-semibold text-black">{step} of {TOTAL_STEPS}</span>
            <div className="w-full max-w-[580px] h-2 bg-black rounded-full overflow-hidden">
              <motion.div
                initial={false}
                animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                className="h-full bg-[#00BC67]"
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* Step 1 — How can we help? */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-8">
                <div className="flex flex-col gap-5">
                  <h1 className="font-display text-[56px] font-black leading-none tracking-[-1.12px] text-black">How can we help you?</h1>
                </div>
                <div className="flex flex-col gap-6 max-w-[587px]">
                  {helpOptions.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setHelpChoice(opt.id)}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                        helpChoice === opt.id
                          ? 'bg-black border-[#242628] text-white'
                          : 'bg-white border-[#242628] text-black hover:border-black'
                      }`}
                    >
                      {helpChoice === opt.id ? (
                        <CheckCircle2 size={24} className="text-[#00BC67] shrink-0" />
                      ) : (
                        <Circle size={24} className="text-black shrink-0" />
                      )}
                      <span className={`font-body text-base font-medium leading-[1.2] tracking-[-0.32px] ${helpChoice === opt.id ? 'text-white' : 'text-black/80'}`}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 2 — Where are you looking? */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-8">
                <div className="flex flex-col gap-5">
                  <h1 className="font-display text-[56px] font-black leading-none tracking-[-1.12px] text-black">Where are you looking?</h1>
                  <p className="font-body text-base font-medium text-black/90 tracking-[-0.32px]">Select the country or countries where you're looking to buy property.</p>
                </div>
                <div className="w-full max-w-[587px] flex flex-col gap-4">
                  <CountrySelect
                    value=""
                    onChange={(c) => {
                      if (!selectedCountries.includes(c)) {
                        setSelectedCountries(prev => [...prev, c]);
                      }
                    }}
                    placeholder="Add a country…"
                    buttonClassName="h-14 rounded-xl bg-[#242628]/5 hover:bg-[#242628]/10 text-base"
                  />
                  {selectedCountries.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedCountries.map(country => (
                        <span
                          key={country}
                          className="flex items-center gap-2 px-3 py-1.5 bg-[#DDDDDD] rounded-lg"
                        >
                          <span className="font-body text-sm font-medium text-black/80 tracking-[-0.32px]">{country}</span>
                          <button
                            type="button"
                            onClick={() => removeCountry(country)}
                            className="text-black/80 hover:text-black"
                            aria-label={`Remove ${country}`}
                          >
                            <X size={14} strokeWidth={2.5} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 3 — Property type */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-8">
                <div className="flex flex-col gap-5">
                  <h1 className="font-display text-[56px] font-black leading-none tracking-[-1.12px] text-black">What type of property?</h1>
                  <p className="font-body text-base font-medium text-black/90 tracking-[-0.32px]">Help us understand your investment goals and preferences.</p>
                </div>
                <div className="flex flex-col gap-6 max-w-[587px]">
                  {propertyTypes.map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setSelectedPropertyType(type.id)}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                        selectedPropertyType === type.id
                          ? 'bg-black border-[#242628] text-white'
                          : 'bg-white border-[#242628] text-black hover:border-black'
                      }`}
                    >
                      <div className="flex flex-col gap-2">
                        <span className="font-display text-xl font-black leading-none">{type.title}</span>
                        {type.description && (
                          <span className={`font-body text-base font-medium leading-[1.5] tracking-[-0.32px] ${selectedPropertyType === type.id ? 'text-white/80' : 'text-black/80'}`}>
                            {type.description}
                          </span>
                        )}
                      </div>
                      {selectedPropertyType === type.id ? (
                        <CheckCircle2 size={24} className="text-[#00BC67] shrink-0" />
                      ) : (
                        <Circle size={24} className="text-black shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 4 — Timeframe */}
            {step === 4 && (
              <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-8">
                <div className="flex flex-col gap-5">
                  <h1 className="font-display text-[56px] font-black leading-none tracking-[-1.12px] text-black">When are you looking to buy?</h1>
                  <p className="font-body text-base font-medium text-black/90 tracking-[-0.32px]">This helps us show you the most relevant properties.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[587px]">
                  {timeframes.map(time => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setSelectedTimeframe(time)}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                        selectedTimeframe === time
                          ? 'bg-black border-[#242628] text-white'
                          : 'bg-white border-[#242628] text-black hover:border-black'
                      }`}
                    >
                      {selectedTimeframe === time ? (
                        <CheckCircle2 size={24} className="text-[#00BC67] shrink-0" />
                      ) : (
                        <Circle size={24} className="text-black shrink-0" />
                      )}
                      <span className={`font-body text-base font-medium leading-[1.2] tracking-[-0.32px] ${selectedTimeframe === time ? 'text-white' : 'text-black/80'}`}>
                        {time}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 5 — Budget */}
            {step === 5 && (
              <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-8">
                <div className="flex flex-col gap-5">
                  <h1 className="font-display text-[56px] font-black leading-none tracking-[-1.12px] text-black">What's your budget?</h1>
                  <p className="font-body text-base font-medium text-black/90 tracking-[-0.32px]">You can enter your budget in USD or GBP.</p>
                </div>
                <div className="w-full max-w-[587px]">
                  <div className="flex items-center h-14 px-2 rounded-xl border border-[#3A3C3E]/10 bg-[#242628]/5">
                    <div className="relative" ref={currencyRef}>
                      <button
                        type="button"
                        onClick={() => setCurrencyDropdownOpen(o => !o)}
                        className="flex items-center gap-1 px-2 py-1 bg-[#DDDDDD] rounded-lg cursor-pointer hover:bg-gray-300 transition-colors"
                      >
                        <span className="font-body text-sm font-medium text-black/80 tracking-[-0.28px]">{currency}</span>
                        <ChevronDown size={14} className={`text-black/80 transition-transform ${currencyDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {currencyDropdownOpen && (
                        <div className="absolute z-20 left-0 top-full mt-2 w-44 bg-white border border-black/10 rounded-xl shadow-2xl overflow-hidden">
                          {currencyOptions.map(opt => (
                            <button
                              key={opt.code}
                              type="button"
                              onClick={() => { setCurrency(opt.code); setCurrencyDropdownOpen(false); }}
                              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors ${currency === opt.code ? 'bg-black/5' : 'hover:bg-black/5'}`}
                            >
                              <span className="font-body text-sm font-medium text-black">{opt.label}</span>
                              {currency === opt.code && <Check size={16} strokeWidth={2.5} className="text-black" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="Enter amount e.g. 250000"
                      className="flex-1 bg-transparent border-none outline-none px-3 font-body text-base font-medium text-black placeholder:text-black/50"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 6 — Base country */}
            {step === 6 && (
              <motion.div key="s6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-8">
                <div className="flex flex-col gap-5">
                  <h1 className="font-display text-[56px] font-black leading-none tracking-[-1.12px] text-black">Where are you currently based?</h1>
                  <p className="font-body text-base font-medium text-black/90 tracking-[-0.32px]">This allows us to assign you a dedicated advisor best suited to your location and requirements.</p>
                </div>
                <div className="w-full max-w-[587px]">
                  <CountrySelect value={baseCountry} onChange={setBaseCountry} placeholder="Select your country" buttonClassName="h-14 rounded-xl bg-[#242628]/5 hover:bg-[#242628]/10" />
                </div>
              </motion.div>
            )}

            {/* Step 7 — Name */}
            {step === 7 && (
              <motion.div key="s7" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-8">
                <div className="flex flex-col gap-5">
                  <h1 className="font-display text-[56px] font-black leading-none tracking-[-1.12px] text-black">May we have your name?</h1>
                  <p className="font-body text-base font-medium text-black/90 tracking-[-0.32px]">So we can address you properly and provide a more personalised experience.</p>
                </div>
                <div className="w-full max-w-[587px]">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full h-14 px-4 rounded-xl border border-[#3A3C3E]/10 bg-[#242628]/5 outline-none font-body text-base font-medium text-black placeholder:text-black/50"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 8 — Email */}
            {step === 8 && (
              <motion.div key="s8" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-8">
                <div className="flex flex-col gap-5">
                  <h1 className="font-display text-[56px] font-black leading-none tracking-[-1.12px] text-black">Your email address</h1>
                  <p className="font-body text-base font-medium text-black/90 tracking-[-0.32px]">We'll use this to share relevant updates and carefully selected opportunities aligned with your enquiry.</p>
                </div>
                <div className="w-full max-w-[587px]">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-14 px-4 rounded-xl border border-[#3A3C3E]/10 bg-[#242628]/5 outline-none font-body text-base font-medium text-black placeholder:text-black/50"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 9 — Phone */}
            {step === 9 && (
              <motion.div key="s9" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-8">
                <div className="flex flex-col gap-5">
                  <h1 className="font-display text-[56px] font-black leading-none tracking-[-1.12px] text-black">Your contact number</h1>
                  <p className="font-body text-base font-medium text-black/90 tracking-[-0.32px]">This allows your dedicated advisor to connect with you directly via phone or WhatsApp, depending on your preference.</p>
                </div>
                <div className="w-full max-w-[587px]">
                  <div className="flex h-14 items-center gap-2 rounded-xl border border-[#3A3C3E]/10 bg-[#242628]/5 px-2">
                    <CountryCodeSelect value={phoneCode} onChange={setPhoneCode} />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Enter phone number"
                      className="flex-1 bg-transparent outline-none font-body text-base font-medium text-black placeholder:text-black/50"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {submitError && (
            <p className="text-red-500 text-sm font-body max-w-[587px]">{submitError}</p>
          )}

          <div className="flex items-center gap-4">
            <Button
              onClick={step === TOTAL_STEPS ? submit : goNext}
              disabled={!canContinue() || submitting}
              className="w-[233px] h-14 bg-black text-white rounded-[48px] font-body text-lg font-bold tracking-[-0.36px] hover:bg-black/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : step === TOTAL_STEPS ? 'Submit' : 'Continue'}
            </Button>
          </div>
        </div>

        {/* Right side: testimonial */}
        <div className="hidden lg:flex flex-1 bg-gradient-to-b from-[#9BD9FF] via-[#FFB0E8] to-[#FEEAA0] items-center justify-center p-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[402px] bg-white rounded-2xl border-[1.5px] border-black overflow-hidden shadow-xl"
          >
            <div className="p-6 flex flex-col gap-16">
              <div className="flex flex-col gap-6">
                <img
                  src="https://api.builder.io/api/v1/image/assets/TEMP/6f2723c232f5b302a2b616f7a1986aa7610e378e?width=272"
                  alt="Havlo Logo"
                  className="w-[136px] h-8 object-contain"
                />
                <p className="font-body text-sm font-medium leading-[1.5] tracking-[-0.28px] text-black/80">
                  From first enquiry to final completion, we guide you through every step of buying property abroad — <span className="font-bold">seamlessly and with confidence.</span>
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-black/10 flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-body text-xl font-bold text-[#277453]">Rated</span>
                  <TrustpilotStars className="h-6" />
                </div>
                <p className="font-body text-sm font-bold text-black/80 leading-[1.5] tracking-[-0.28px]">
                  Rated Excellent based on over 1,000 customer reviews.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="w-full bg-white py-8 overflow-hidden border-t border-black/5">
        <div className="flex items-center gap-8 whitespace-nowrap animate-marquee">
          {[...Array(4)].map((_, i) => (
            <React.Fragment key={i}>
              {marqueeItems.map((item, index) => (
                <div key={`${i}-${index}`} className="flex items-center gap-8">
                  <span className="font-display text-[40px] font-black text-black leading-none">{item}</span>
                  <div className="w-4 h-4 rounded-full bg-[#602FD3] opacity-60 shrink-0" />
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          width: max-content;
          animation: marquee 60s linear infinite;
        }
      `}</style>

      {/* Success popup */}
      <AnimatePresence>
        {showSuccessPopup && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[520px] rounded-3xl bg-white p-8 shadow-2xl flex flex-col gap-6"
            >
              <button
                type="button"
                aria-label="Close"
                onClick={() => { setShowSuccessPopup(false); navigate('/buy-property-abroad'); }}
                className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors"
              >
                <X size={18} className="text-black/70" />
              </button>
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00BC67]/10">
                  <CheckCircle2 size={36} className="text-[#00BC67]" />
                </div>
                <h2 className="font-display text-3xl font-black text-black leading-tight">
                  Thanks{name ? `, ${name.split(' ')[0]}` : ''}! We've got your details.
                </h2>
                <p className="font-body text-base text-black/70 leading-relaxed">
                  A dedicated advisor will be in touch shortly. Want to speak with us right away? Choose how you'd like to connect:
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 w-full h-14 rounded-full bg-[#25D366] text-white font-body text-base font-bold hover:opacity-90 transition-opacity"
                >
                  <MessageCircle size={20} />
                  Chat with us on WhatsApp
                </a>
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 w-full h-14 rounded-full bg-black text-white font-body text-base font-bold hover:bg-black/90 transition-colors"
                >
                  <Calendar size={20} />
                  Book a Calendly call
                </a>
                <button
                  type="button"
                  onClick={() => { setShowSuccessPopup(false); navigate('/buy-property-abroad'); }}
                  className="mt-2 font-body text-sm font-semibold text-black/60 hover:text-black underline underline-offset-4"
                >
                  Back to Buy Abroad
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

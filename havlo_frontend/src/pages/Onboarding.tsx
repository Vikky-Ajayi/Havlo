import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, Circle, X, ChevronDown } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { TrustpilotStars } from '../components/ui/TrustpilotStars';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { token, refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>(['Initial Consultation and Needs Assessment']);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['Nigeria', 'Ghana', 'United Kingdom']);

  const services = [
    'Initial Consultation and Needs Assessment',
    'Property Cover',
    'Financial and Tax Advisory',
    'Legal and Regulatory Guidance',
    'International Property Search',
    'Property Insurance',
    'Post-Purchase/Property management Services',
    'Due Diligence and Documentation',
  ];

  const countries = ['Nigeria', 'Ghana', 'United Kingdom', 'United States', 'Canada', 'United Arab Emirates'];

  const marqueeItems = [
    'Initial Consultation and Needs Assessment',
    'International Property Search',
    'Legal and Regulatory Guidance',
    'Due Diligence and Documentation',
  ];

  const [selectedPropertyType, setSelectedPropertyType] = useState<string>('Residential');

  const propertyTypes = [
    {
      id: 'Residential',
      title: 'Residential',
      description: 'Primary or secondary home for living',
    },
    {
      id: 'Vacation Home',
      title: 'Vacation Home',
      description: 'Holiday retreat and getaway property',
    },
    {
      id: 'Investment',
      title: 'Investment',
      description: 'Rental income and capital appreciation',
    },
  ];

  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('Within 6 months');
  const [budget, setBudget] = useState<string>('');
  const [currency, setCurrency] = useState<string>('GBP');

  const timeframes = [
    'Within 6 months',
    '6-12 months',
    '1-2 years',
    'Just exploring',
  ];

  const handleServiceToggle = (service: string) => {
    setSelectedServices(prev => 
      prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]
    );
  };

  const removeCountry = (country: string) => {
    setSelectedCountries(prev => prev.filter(c => c !== country));
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, 5));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  return (
    <div className="flex flex-col min-h-screen bg-white overflow-x-hidden">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Left Side: Form */}
        <div className="flex-1 px-6 py-12 lg:px-[100px] lg:py-20 flex flex-col gap-8">
          {/* Back Button */}
          <button 
            onClick={prevStep}
            className="flex items-center gap-2 px-3 py-2 bg-[#F4F4F4] rounded-lg w-fit hover:bg-gray-200 transition-colors"
          >
            <ChevronLeft size={16} />
            <span className="font-body text-sm font-semibold">Go back</span>
          </button>

          {/* Progress */}
          <div className="flex flex-col gap-2">
            <span className="font-body text-sm font-semibold text-black">{step} of 5</span>
            <div className="w-full max-w-[580px] h-2 bg-black rounded-full overflow-hidden">
              <motion.div 
                initial={false}
                animate={{ width: `${(step / 5) * 100}%` }}
                className="h-full bg-[#00BC67]" 
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-8"
              >
                <div className="flex flex-col gap-5">
                  <h1 className="font-display text-[56px] font-black leading-none tracking-[-1.12px] text-black">
                    How can we help?
                  </h1>
                  <p className="font-body text-base font-medium text-black/90 tracking-[-0.32px]">
                    Get started by letting us know a little bit about what you need
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[587px]">
                  {services.map((service) => (
                    <button
                      key={service}
                      onClick={() => handleServiceToggle(service)}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                        selectedServices.includes(service)
                          ? 'bg-black border-[#242628] text-white'
                          : 'bg-white border-[#242628] text-black hover:border-black'
                      }`}
                    >
                      {selectedServices.includes(service) ? (
                        <CheckCircle2 size={24} className="text-[#00BC67] shrink-0" />
                      ) : (
                        <Circle size={24} className="text-black shrink-0" />
                      )}
                      <span className={`font-body text-base font-medium leading-[1.2] tracking-[-0.32px] ${
                        selectedServices.includes(service) ? 'text-white' : 'text-black/80'
                      }`}>
                        {service}
                      </span>
                    </button>
                  ))}
                </div>

                <Button 
                  onClick={nextStep}
                  className="w-[233px] h-14 bg-black text-white rounded-[48px] font-body text-lg font-bold tracking-[-0.36px] hover:bg-black/90 transition-colors mt-4"
                >
                  Continue
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-8"
              >
                <div className="flex flex-col gap-5">
                  <h1 className="font-display text-[56px] font-black leading-none tracking-[-1.12px] text-black">
                    Where are you looking?
                  </h1>
                  <p className="font-body text-base font-medium text-black/90 tracking-[-0.32px]">
                    Select the country or countries where you're looking to buy property
                  </p>
                </div>

                <div className="w-full max-w-[587px]">
                  <div className="flex flex-wrap items-center gap-3 p-4 min-h-[56px] rounded-xl border border-[#3A3C3E]/10 bg-[#242628]/5 relative">
                    {selectedCountries.map(country => (
                      <div key={country} className="flex items-center gap-2 px-3 py-1 bg-[#DDDDDD] rounded-lg">
                        <span className="font-body text-base font-medium text-black/80 tracking-[-0.32px]">{country}</span>
                        <button onClick={() => removeCountry(country)} className="text-black/80 hover:text-black">
                          <X size={16} strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-black/80">
                      <ChevronDown size={20} strokeWidth={2.5} />
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={nextStep}
                  className="w-[233px] h-14 bg-black text-white rounded-[48px] font-body text-lg font-bold tracking-[-0.36px] hover:bg-black/90 transition-colors mt-4"
                >
                  Continue
                </Button>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-8"
              >
                <div className="flex flex-col gap-5">
                  <h1 className="font-display text-[56px] font-black leading-none tracking-[-1.12px] text-black">
                    What type of property?
                  </h1>
                  <p className="font-body text-base font-medium text-black/90 tracking-[-0.32px]">
                    Help us understand your investment goals and preferences
                  </p>
                </div>

                <div className="flex flex-col gap-8 max-w-[587px]">
                  {propertyTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setSelectedPropertyType(type.id)}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                        selectedPropertyType === type.id
                          ? 'bg-black border-[#242628] text-white'
                          : 'bg-white border-[#242628] text-black hover:border-black'
                      }`}
                    >
                      <div className="flex flex-col gap-3">
                        <span className="font-display text-xl font-black leading-none">
                          {type.title}
                        </span>
                        <span className={`font-body text-base font-medium leading-[1.5] tracking-[-0.32px] ${
                          selectedPropertyType === type.id ? 'text-white/80' : 'text-black/80'
                        }`}>
                          {type.description}
                        </span>
                      </div>
                      {selectedPropertyType === type.id ? (
                        <CheckCircle2 size={24} className="text-[#00BC67] shrink-0" />
                      ) : (
                        <Circle size={24} className="text-black shrink-0" />
                      )}
                    </button>
                  ))}
                </div>

                <Button 
                  onClick={nextStep}
                  className="w-[233px] h-14 bg-black text-white rounded-[48px] font-body text-lg font-bold tracking-[-0.36px] hover:bg-black/90 transition-colors mt-4"
                >
                  Continue
                </Button>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-8"
              >
                <div className="flex flex-col gap-5">
                  <h1 className="font-display text-[56px] font-black leading-none tracking-[-1.12px] text-black">
                    When are you looking to buy?
                  </h1>
                  <p className="font-body text-base font-medium text-black/90 tracking-[-0.32px]">
                    This helps us show you the most relevant properties
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[587px]">
                  {timeframes.map((time) => (
                    <button
                      key={time}
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
                      <span className={`font-body text-base font-medium leading-[1.2] tracking-[-0.32px] ${
                        selectedTimeframe === time ? 'text-white' : 'text-black/80'
                      }`}>
                        {time}
                      </span>
                    </button>
                  ))}
                </div>

                <Button 
                  onClick={nextStep}
                  className="w-[233px] h-14 bg-black text-white rounded-[48px] font-body text-lg font-bold tracking-[-0.36px] hover:bg-black/90 transition-colors mt-4"
                >
                  Continue
                </Button>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-8"
              >
                <div className="flex flex-col gap-5">
                  <h1 className="font-display text-[56px] font-black leading-none tracking-[-1.12px] text-black">
                    What's your budget?
                  </h1>
                  <p className="font-body text-base font-medium text-black/90 tracking-[-0.32px]">
                    You can enter your budget in your local currency, or use USD or GBP—whichever you prefer.
                  </p>
                </div>

                <div className="w-full max-w-[587px]">
                  <div className="flex items-center h-14 px-2 rounded-xl border border-[#3A3C3E]/10 bg-[#242628]/5">
                    <div className="flex items-center gap-1 px-2 py-1 bg-[#DDDDDD] rounded-lg cursor-pointer hover:bg-gray-300 transition-colors">
                      <span className="font-body text-sm font-medium text-black/80 tracking-[-0.28px]">{currency}</span>
                      <ChevronDown size={14} className="text-black/80" />
                    </div>
                    <input 
                      type="text"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="Enter amount e.g 1000"
                      className="flex-1 bg-transparent border-none outline-none px-3 font-body text-base font-medium text-black placeholder:text-black/50"
                    />
                  </div>
                </div>

                {submitError && (
                  <p className="text-red-500 text-sm font-body">{submitError}</p>
                )}

                <Button 
                  onClick={async () => {
                    if (!token) { navigate('/'); return; }
                    setSubmitting(true);
                    setSubmitError('');
                    try {
                      await api.submitOnboarding(token, {
                        services: selectedServices,
                        countries: selectedCountries,
                        property_type: selectedPropertyType,
                        timeframe: selectedTimeframe,
                        budget_amount: budget || undefined,
                        budget_currency: currency,
                      });
                      await refreshUser();
                      navigate('/get-started/success');
                    } catch (err: unknown) {
                      setSubmitError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  disabled={submitting}
                  className="w-[233px] h-14 bg-black text-white rounded-[48px] font-body text-lg font-bold tracking-[-0.36px] hover:bg-black/90 transition-colors mt-4 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Continue'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side: Testimonial/Info */}
        <div className="hidden lg:flex flex-1 bg-gradient-to-b from-[#9BD9FF] via-[#FFB0E8] to-[#FEEAA0] items-center justify-center p-12">
          <AnimatePresence mode="wait">
            {step !== 4 ? (
              <motion.div 
                key="testimonial"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
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
                      Leave everything to us - we'll find you the best mortgage deal, and do all the work on your behalf <span className="font-bold">all for free!</span>
                    </p>
                  </div>
                </div>
                <div className="p-6 border-t border-black/10 flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-body text-xl font-bold text-[#277453]">Trustpilot</span>
                      <TrustpilotStars className="h-6" />
                    </div>
                    <p className="font-body text-sm font-bold text-black/80 leading-[1.5] tracking-[-0.28px]">
                      Rated Excellent based on over 10,000 customer reviews
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="dashboard-preview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full h-full flex items-center justify-center"
              >
                <img 
                  src="/Get started.png" 
                  alt="Dashboard Preview" 
                  className="w-full max-w-[687px] h-auto object-contain rounded-[32px]"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Marquee */}
      <div className="w-full bg-white py-8 overflow-hidden border-t border-black/5">
        <div className="flex items-center gap-8 whitespace-nowrap animate-marquee">
          {[...Array(4)].map((_, i) => (
            <React.Fragment key={i}>
              {marqueeItems.map((item, index) => (
                <div key={`${i}-${index}`} className="flex items-center gap-8">
                  <span className="font-display text-[40px] font-black text-black leading-none">
                    {item}
                  </span>
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
    </div>
  );
};

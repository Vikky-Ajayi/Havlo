import React, { useState } from 'react';
import { Clock, Star, Plus, Check } from 'lucide-react';
import { HeroBackground } from '../components/shared/HeroBackground';
import { CountryCodeSelect } from '../components/shared/CountryCodeSelect';
import { CountrySelect } from '../components/shared/CountrySelect';

export const PropertyMatching: React.FC = () => {
  const [phoneCode, setPhoneCode] = useState('+44');
  const [country, setCountry] = useState('');
  return (
    <div className="flex flex-col w-full bg-white">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center pt-16 lg:pt-24 pb-12 lg:pb-0 overflow-hidden bg-gradient-to-b from-[#FFB0E8] to-[#FEEAA0] lg:h-[700px] px-6 lg:px-[100px]">
        <div className="relative z-20 max-w-[1144px] w-full flex flex-col items-center gap-6 lg:gap-10 lg:mb-24">
          <span className="font-body text-sm lg:text-lg font-normal uppercase tracking-[-0.36px] text-black">
            Havlo Property Matching
          </span>
          <h1 className="max-w-[730px] font-display font-black tracking-[-1.2px] lg:tracking-[-1.76px] text-[#1F1F1E] text-center text-[44px] sm:text-[56px] lg:text-[88px] leading-[1.05] lg:leading-[1.0]">
            Find your ideal property, <span className="text-[#1f1f1e]">effortlessly</span>
          </h1>
          <p className="max-w-[682px] font-body text-base lg:text-lg leading-[1.4] lg:leading-[1.3] tracking-[-0.36px] text-black text-center">
            Tell us what you want, location, type, budget and we'll do the legwork. Your request goes straight to our trusted partner agents, who handpick properties that match your exact needs.
          </p>

          <h2 className="font-display text-xl sm:text-2xl lg:text-[44px] font-medium leading-snug lg:leading-[1.05] tracking-[-0.4px] lg:tracking-[-0.8px] text-[#1F1F1E] bg-[#f9f9f9] px-5 py-5 lg:px-[37px] lg:py-[25px] w-full mt-4 lg:mt-[27px] text-left rounded-md lg:rounded-none">
            The best part: If you buy through our agent, we contribute towards your legal or survey fees — helping you save while securing your perfect home.
          </h2>
        </div>

        {/* White Callout Box */}
      

        {/* Jagged Edge */}
        <div className="absolute bottom-0 left-0 right-0 h-[100px] z-10 pointer-events-none">
          <HeroBackground 
            showTop={false}
            showBottom={true}
            className="h-full w-full rotate-180" 
          />
        </div>
      </section>

      {/* How it works Section */}
      <section className="flex flex-col items-center gap-14 bg-white px-6 lg:px-[100px] pt-32 pb-20 lg:pb-32">
        <h2 className="font-display text-[48px] lg:text-[56px] font-black leading-[1.1] text-[#040504]">
          How it works
        </h2>
        <div className="grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              num: "01",
              title: "Tell us your wishlist",
              desc: "Share your ideal property details — location, type, budget."
            },
            {
              num: "02",
              title: "Get matched",
              desc: "Our nominated agent finds the homes that fit you"
            },
            {
              num: "03",
              title: "View & choose",
              desc: "Explore properties tailored to your needs."
            },
            {
              num: "04",
              title: "Buy & save",
              desc: "Proceed with the agent and enjoy a discount on fees."
            }
          ].map((item, index) => (
            <div key={index} className="flex flex-col justify-between p-8 rounded-[20px] bg-[#F9F9F9] border border-[#F8F7F6] min-h-[227px]">
              <div className="flex w-8 h-8 items-center justify-center rounded-full bg-[#F5D8FD] border border-[#F5D8FD]">
                <span className="font-body text-lg font-bold text-[#A409D2] tracking-[-0.36px]">{item.num}</span>
              </div>
              <div className="flex flex-col gap-6 mt-10">
                <h3 className="font-body text-2xl font-bold leading-none tracking-[-0.48px] text-[#1F1F1E]">{item.title}</h3>
                <p className="font-body text-base font-medium leading-[1.9] tracking-[-0.048px] text-black">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why Havlo Property Matching? Section */}
      <section className="flex flex-col items-center gap-14 bg-[#F9F9F9] px-6 lg:px-[100px] py-1 md:py-20">
        <h2 className="font-display text-[48px] lg:text-[56px] font-black leading-[1.1] text-[#040504]">
          Why Havlo Property Matching?
        </h2>
        <div className="grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 border border-black/10">
          {[
            {
              icon: <Clock className="w-6 h-6 text-[#A409D2]" />,
              title: "Tailored matches",
              desc: "Properties chosen to your exact specifications, not generic listings."
            },
            {
              icon: <Star className="w-6 h-6 text-[#A409D2]" />,
              title: "Trusted agents",
              desc: "Access to vetted agents and exclusive off-market listings."
            },
            {
              icon: <Plus className="w-6 h-6 text-[#A409D2]" />,
              title: "Save on fees",
              desc: "We contribute to your legal or survey fees when you buy."
            },
            {
              icon: <Check className="w-6 h-6 text-[#A409D2]" />,
              title: "Stress-free search",
              desc: "Fast, effortless, and completely stress-free from start to finish."
            }
          ].map((item, index) => (
            <div key={index} className="flex flex-col gap-14 p-10 border border-black/10 min-h-[350px]">
              {item.icon}
              <div className="flex flex-col gap-8">
                <h3 className="font-body text-2xl font-bold leading-none tracking-[-0.48px] text-[#1F1F1E]">{item.title}</h3>
                <p className="font-body text-base font-medium leading-[1.3] tracking-[-0.32px] text-black">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Form Section */}
      <section className="flex flex-col items-center gap-10 py-1 md:py-20 px-6 lg:px-[100px] bg-white">
        <div className="flex flex-col items-center gap-6 text-center">
          <h2 className="max-w-[482px] font-display text-[44px] font-black leading-[1.1] text-[#050405]">
            Find your perfect property
          </h2>
          <p className="max-w-[482px] font-body text-lg leading-[1] tracking-[-0.18px] text-black">
            Fill in your details and we'll match you with the right agent.
          </p>
        </div>
        
        <div className="w-full max-w-[668px]">
          <form className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <label className="font-body text-sm font-bold text-[#001C47]">
                Full Name<span className="text-[#FA4242]">*</span>
              </label>
              <input 
                type="text" 
                placeholder="Your full name"
                className="h-12 px-4 rounded-lg bg-[#EEF0F2] font-body text-xs text-[#676B80] placeholder:opacity-50 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-4">
              <label className="font-body text-sm font-bold text-[#001C47]">
                Country<span className="text-[#FA4242]">*</span>
              </label>
              <CountrySelect value={country} onChange={setCountry} placeholder="Select your country" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-4">
                <label className="font-body text-sm font-bold text-[#001C47]">
                  Email<span className="text-[#FA4242]">*</span>
                </label>
                <input 
                  type="email" 
                  placeholder="Enter your email address"
                  className="h-12 px-4 rounded-lg bg-[#EEF0F2] font-body text-xs text-[#676B80] placeholder:opacity-50 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-4">
                <label className="font-body text-sm font-bold text-[#001C47]">
                  Phone<span className="text-[#FA4242]">*</span>
                </label>
                <div className="flex h-12 items-center rounded-lg bg-[#EEF0F2] px-2">
                  <CountryCodeSelect value={phoneCode} onChange={setPhoneCode} />
                  <input 
                    type="text" 
                    placeholder="Enter your phone number"
                    className="flex-1 px-4 bg-transparent font-body text-xs text-[#676B80] placeholder:opacity-50 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-4">
                <label className="font-body text-sm font-bold text-[#001C47]">
                  Property type<span className="text-[#FA4242]">*</span>
                </label>
                <div className="relative">
                  <select
                    name="propertyType"
                    defaultValue=""
                    className="w-full h-12 pl-4 pr-10 rounded-lg bg-[#EEF0F2] font-body text-xs text-[#676B80] appearance-none focus:outline-none cursor-pointer"
                  >
                    <option value="" disabled hidden>Select type</option>
                    <option value="Residential">Residential</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Investment">Investment</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg width="8" height="4" viewBox="0 0 8 4" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path opacity="0.8" d="M0 0L4 4L8 0" fill="black" fillOpacity="0.8"/>
                    </svg>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <label className="font-body text-sm font-bold text-[#001C47]">
                  Budget (£)<span className="text-[#FA4242]">*</span>
                </label>
                <input 
                  type="text" 
                  placeholder="e.g £25,0000"
                  className="h-12 px-4 rounded-lg bg-[#EEF0F2] font-body text-xs text-[#676B80] placeholder:opacity-50 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <label className="font-body text-sm font-bold text-[#001C47]">
                Other information / requests
              </label>
              <textarea 
                placeholder="What else would you like us to know"
                className="h-[116px] p-4 rounded-lg bg-[#EEF0F2] font-body text-xs text-[#676B80] placeholder:opacity-50 focus:outline-none resize-none"
              />
            </div>

            <button className="w-full md:w-[258px] h-10 sm:h-14 rounded-[48px] bg-black text-white font-body text-sm sm:text-base font-semibold tracking-[-0.16px] hover:bg-black/90 transition-colors self-center">
              Start my property match
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

import React, { useState } from 'react';
import { Mail, Calendar, MessageCircle, ChevronDown } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { CountryCodeSelect } from '../components/shared/CountryCodeSelect';
import { CountrySelect } from '../components/shared/CountrySelect';
import { cn } from '../lib/utils';

export const Contact: React.FC = () => {
  const [phoneCode, setPhoneCode] = useState('+44');
  const [currency, setCurrency] = useState('GBP');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const currencies = ['USD', 'GBP', 'EUR'];
  const [countryOfResidence, setCountryOfResidence] = useState('');
  return (
    <div className="flex flex-col w-full bg-[#F4F4F4]">
      {/* 1. Hero Section */}
      <section className="flex flex-col items-center px-6 pt-16 lg:pt-20 pb-10 text-center sm:px-10 lg:px-[100px]">
        <div className="flex max-w-[888px] flex-col items-center gap-6 lg:gap-8">
          <div className="flex flex-col items-center gap-4 lg:gap-8">
            <h1 className="font-display text-[36px] sm:text-[48px] lg:text-[64px] font-black leading-[1.1] tracking-tight text-[#001C47]">
              Ready to Chat? Call Us Now
            </h1>
            <p className="max-w-[652px] font-body text-base lg:text-[22px] leading-[1.4] lg:leading-[1.2] text-black">
              For any complaints or suggestions, please contact us via:
            </p>
          </div>
        </div>
      </section>

      {/* 2. Contact Info Section */}
      <section className="flex flex-col items-center px-6 pb-24 sm:px-10 lg:px-[100px]">
        <div className="flex w-full max-w-[888px] flex-col gap-6 lg:gap-8">
          {/* Phone Numbers Card */}
          <div className="flex w-full flex-col items-center justify-center gap-6 lg:gap-10 rounded-[24px] bg-[#081B2A] px-6 py-8 sm:flex-row sm:gap-20">
            <div className="flex flex-col items-center gap-3 lg:gap-4 text-center">
              <a href="tel:+443333390423" className="font-body text-xl lg:text-[28px] font-bold text-white break-all hover:underline">0333 339 0423</a>
              <a href="tel:+447919483480" className="font-body text-xl lg:text-[28px] font-bold text-white break-all hover:underline">0791 948 3480</a>
            </div>
          </div>

          {/* Contact Methods Grid */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <ContactMethodCard
              icon={<Mail className="h-5 w-5 text-black" />}
              label="EMAIL"
              value="hello@heyhavlo.com"
              href="mailto:hello@heyhavlo.com"
            />
            <ContactMethodCard
              icon={<Calendar className="h-5 w-5 text-black" />}
              label="BOOK A CALL"
              value="calendly.com/hello-heyhavlo"
              href="https://calendly.com/hello-heyhavlo/havlo-enquiry-call"
            />
            <ContactMethodCard
              icon={<MessageCircle className="h-5 w-5 text-black" />}
              label="WHATSAPP"
              value="Start a whatsapp chat"
              href="https://wa.me/message/PPPAWIAXBS7YK1"
            />
          </div>

          {/* Contact Form Card */}
          <div className="flex w-full flex-col items-center gap-8 rounded-[32px] bg-white p-8 sm:p-10 border border-white/10">
            <form className="flex w-full flex-col gap-8">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <FormInput label="First Name" placeholder="Enter first name" required />
                <FormInput label="Last Name" placeholder="Enter last name" required />
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <FormInput label="Email" placeholder="Enter your email address" type="email" required />
                <div className="flex flex-col gap-4">
                  <label className="font-body text-sm font-bold text-[#001C47]">
                    Phone<span className="text-[#FA4242]">*</span>
                  </label>
                  <div className="flex h-12 w-full items-center rounded-lg bg-[#EEF0F2] px-2">
                    <CountryCodeSelect value={phoneCode} onChange={setPhoneCode} />
                    <input
                      type="tel"
                      placeholder="Enter your phone number"
                      className="flex-1 bg-transparent px-3 font-body text-xs text-[#676B80] placeholder:text-[#676B80]/50 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="flex flex-col gap-4">
                  <label className="font-body text-sm font-bold text-[#001C47]">
                    Currency<span className="text-[#FA4242]">*</span>
                  </label>
                  <div className="flex h-12 w-full items-center rounded-lg bg-[#EEF0F2] px-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setCurrencyOpen(o => !o)}
                        aria-haspopup="listbox"
                        aria-expanded={currencyOpen}
                        className="flex h-8 items-center gap-1 rounded-lg bg-[#DDD] px-2 cursor-pointer hover:bg-[#CCC] transition-colors"
                      >
                        <span className="font-body text-sm font-medium text-black/80">{currency}</span>
                        <ChevronDown
                          className={cn(
                            'h-3 w-3 text-black/80 transition-transform',
                            currencyOpen && 'rotate-180',
                          )}
                        />
                      </button>
                      {currencyOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-[60]"
                            onClick={() => setCurrencyOpen(false)}
                          />
                          <ul
                            role="listbox"
                            className="absolute top-full left-0 z-[70] mt-1 w-28 overflow-hidden rounded-xl border border-[rgba(58,60,62,0.10)] bg-white shadow-xl"
                          >
                            {currencies.map(c => (
                              <li key={c}>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={currency === c}
                                  onClick={() => {
                                    setCurrency(c);
                                    setCurrencyOpen(false);
                                  }}
                                  className={cn(
                                    'w-full px-3 py-2 text-left font-body text-sm text-black/80 transition-colors hover:bg-gray-50',
                                    currency === c && 'bg-gray-100 font-semibold',
                                  )}
                                >
                                  {c}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Amount"
                      className="flex-1 bg-transparent px-3 font-body text-xs text-[#676B80] placeholder:text-[#676B80]/50 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="flex flex-col gap-4">
                  <label className="font-body text-sm font-bold text-[#001C47]">
                    Country of residence
                  </label>
                  <CountrySelect
                    value={countryOfResidence}
                    onChange={setCountryOfResidence}
                    placeholder="Select"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <label className="font-body text-sm font-bold text-[#001C47]">
                  Please also provide a brief overview of your enquiry/questions
                </label>
                <textarea
                  placeholder="How can we be of help"
                  className="h-[116px] w-full rounded-lg bg-[#EEF0F2] p-4 font-body text-xs text-[#676B80] placeholder:text-[#676B80]/50 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-center pt-4">
                <Button className="h-14 w-full max-w-[258px] rounded-[48px] bg-black text-base font-semibold text-white hover:bg-black/90">
                  Submit
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};

const ContactMethodCard = ({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href: string }) => (
  <div className="flex min-h-[160px] lg:h-[187px] flex-col items-center justify-center gap-3 rounded-[12px] border border-black/5 bg-white p-6 text-center">
    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-black p-2">
      {icon}
    </div>
    <div className="flex flex-col">
      <span className="font-body text-base lg:text-[22px] font-normal text-[#A409D2]">{label}</span>
      <a
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        className="font-body text-base lg:text-[22px] font-normal text-black underline underline-offset-4 break-words"
      >
        {value}
      </a>
    </div>
  </div>
);

const FormInput = ({ label, placeholder, type = "text", required = false }: { label: string; placeholder: string; type?: string; required?: boolean }) => (
  <div className="flex flex-col gap-4">
    <label className="font-body text-sm font-bold text-[#001C47]">
      {label}{required && <span className="text-[#FA4242]">*</span>}
    </label>
    <div className="flex h-12 w-full items-center rounded-lg bg-[#EEF0F2] px-4">
      <input
        type={type}
        placeholder={placeholder}
        className="w-full bg-transparent font-body text-xs text-[#676B80] placeholder:text-[#676B80]/50 focus:outline-none"
      />
    </div>
  </div>
);

const FormSelect = ({ label, placeholder }: { label: string; placeholder: string }) => (
  <div className="flex flex-col gap-4">
    <label className="font-body text-sm font-bold text-[#001C47]">
      {label}
    </label>
    <div className="flex h-12 w-full items-center justify-between rounded-lg bg-[#EEF0F2] px-4 cursor-pointer">
      <span className="font-body text-xs text-[#676B80] opacity-50">{placeholder}</span>
      <ChevronDown className="h-4 w-4 text-black/80" />
    </div>
  </div>
);

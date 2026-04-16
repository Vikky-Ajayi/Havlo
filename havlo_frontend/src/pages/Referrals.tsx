import React from 'react';
import { Check, X } from 'lucide-react';

export const Referrals: React.FC = () => {
  return (
    <div className="flex flex-col w-full bg-white">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center pt-20 pb-32 px-6 lg:px-[100px] text-center overflow-hidden bg-gradient-to-b from-white via-[#FED8F7]/40 to-[#FED8F7]">
        <div className="max-w-[929px] flex flex-col items-center gap-10">
          <span className="font-body text-lg font-medium uppercase tracking-[-0.054px] text-black">
            Strategic Referral Partnership
          </span>
          <h1 className="font-display text-[64px] lg:text-[88px] font-black leading-[1] tracking-[-1.76px] text-[#1F1F1E]">
            Refer Clients Investing in International Property
          </h1>
          <p className="max-w-[662px] font-body text-lg leading-[1.7] tracking-[-0.054px] text-black">
            We collaborate with trusted advisors whose clients are purchasing property abroad. If you serve serious investors seeking overseas real estate, we offer a structured, transparent referral partnership.
          </p>
          <button className="h-14 px-8 rounded-[48px] bg-black text-[#FEFFFF] font-body text-lg font-semibold tracking-[-0.36px] hover:bg-black/90 transition-colors">
            Apply for Partnership
          </button>
          <p className="font-body text-sm leading-[2.18] tracking-[-0.042px] text-black">
            Commission paid on completed advisory engagements · All applications reviewed individually
          </p>
        </div>
      </section>

      {/* Who is this for */}
      <section className="flex flex-col lg:flex-row items-start gap-10 lg:gap-20 py-20 px-6 lg:px-[100px] bg-[#FEFFFF]">
        <div className="flex-1 flex flex-col gap-10">
          <div className="flex items-center gap-3">
            <div className="w-20 h-[2px] rounded-full bg-[#D9D9D9]" />
            <span className="font-body text-2xl font-bold text-[#602FD3] uppercase">WHO IS THIS FOR</span>
          </div>
          <h2 className="max-w-[593px] font-display text-[44px] font-black leading-[1.1] text-[#050405]">
            We Partner With Professionals Who Serve International Investors
          </h2>
          <p className="max-w-[534px] font-body text-lg leading-[1.7] tracking-[-0.054px] text-black">
            If your clients are exploring property acquisition overseas for investment, residency, or diversification, we become your dedicated property advisory arm — handling the full process so you can focus on your core relationship.
          </p>
        </div>
        <div className="flex-1 w-full flex flex-col">
          {[
            "Immigration & Residency Consultants",
            "Wealth managers & private client advisors",
            "International tax advisors",
            "Relocation specialists",
            "Family offices",
            "Cross-border legal professionals"
          ].map((item, index) => (
            <div key={index} className="py-8 border-t border-black/10 flex items-center">
              <span className="font-body text-lg leading-[1.7] tracking-[-0.054px] text-black">{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Who this is not for */}
      <section className="flex flex-col lg:flex-row items-start gap-10 lg:gap-20 py-20 px-6 lg:px-[100px] bg-[#040405]">
        <div className="flex-1 flex flex-col gap-10">
          <div className="flex flex-col gap-10">
            <div className="flex items-center gap-3">
              <div className="w-20 h-[2px] rounded-full bg-[#D9D9D9]" />
              <span className="font-body text-2xl font-bold text-[#FFF500] uppercase">WHO THIS IS NOT FOR</span>
            </div>
            <h2 className="max-w-[593px] font-display text-[56px] font-black leading-[1.1] text-white">
              This Is Not an Open Affiliate Program
            </h2>
          </div>
          <div className="p-8 border-l-[5px] border-white bg-white/10">
            <p className="max-w-[534px] font-body text-lg leading-[1.7] tracking-[-0.054px] text-white">
              We partner only with professionals who have direct, established relationships with their clients. All applications are reviewed and approved individually. We aim to build a curated network — not a volume-based system.
            </p>
          </div>
        </div>
        <div className="flex-1 w-full flex flex-col gap-8">
          <span className="font-body text-lg font-bold text-white leading-[1.7] tracking-[-0.054px]">We do not work with</span>
          <div className="flex flex-col">
            {[
              "Lead generators",
              "Paid traffic affiliates",
              "Email list marketers",
              "“Make money online” promoters",
              "Mass referral networks"
            ].map((item, index) => (
              <div key={index} className="py-8 border-t border-white/10 flex items-center gap-2">
                <X className="w-4 h-4 text-[#D80027]" strokeWidth={3} />
                <span className="font-body text-lg leading-[1.7] tracking-[-0.054px] text-white">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How the partnership works */}
      <section className="flex flex-col gap-10 py-20 px-6 lg:px-[100px] bg-[#050405]">
        <div className="flex flex-col gap-10">
          <span className="font-body text-lg font-normal text-white uppercase">HOW THE PARTNERSHIP WORKS</span>
          <h2 className="font-display text-[56px] font-black leading-[1.1] text-white">Simple, Transparent Structure</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 border border-white/10">
          {[
            {
              num: "I",
              title: "You Introduce",
              desc: "Your client is actively considering an international property purchase and is ready to engage expert guidance."
            },
            {
              num: "II",
              title: "We Manage Advisory",
              desc: "We guide them through every stage:\nMarket selection\nDue diligence\nLegal coordination\nTransaction support"
            },
            {
              num: "III",
              title: "Client Engages",
              desc: "Our advisory fee is agreed and paid directly to us. There is no friction for your client relationship."
            },
            {
              num: "IV",
              title: "You Receive Commission",
              desc: "You receive an agreed percentage of the advisory fee upon successful transaction completion."
            }
          ].map((item, index) => (
            <div key={index} className="flex flex-col gap-14 p-8 lg:p-10 border border-white/10 min-h-[444px]">
              <span className="font-body text-[56px] font-medium italic leading-none tracking-[-1.12px] text-white">{item.num}</span>
              <div className="flex flex-col gap-8">
                <h3 className="font-display text-[32px] font-medium leading-none tracking-[-0.64px] text-white">{item.title}</h3>
                <p className="font-body text-lg leading-[1.7] tracking-[-0.054px] text-white whitespace-pre-line">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Commission Structure */}
      <section className="flex flex-col lg:flex-row items-start gap-10 lg:gap-20 py-20 px-6 lg:px-[100px] bg-[#FEFFFF]">
        <div className="flex-1 flex flex-col gap-10">
          <div className="flex items-center gap-3">
            <div className="w-20 h-[2px] rounded-full bg-[#D9D9D9]" />
            <span className="font-body text-2xl font-medium text-[#602FD3] uppercase">Commission Structure</span>
          </div>
          <h2 className="max-w-[593px] font-display text-[44px] font-black leading-[1.1] text-[#050405]">
            Competitive Advisory Fee Share
          </h2>
          <div className="flex flex-col">
            {[
              "20–30% of collected advisory fees",
              "Paid after successful transaction completion",
              "No caps on earnings",
              "No hidden conditions",
              "No payments on uncompleted transactions"
            ].map((item, index) => (
              <div key={index} className="py-8 border-t border-black/10 flex items-center gap-2">
                <Check className="w-6 h-6 text-[#00BC67]" strokeWidth={3} />
                <span className="font-body text-lg leading-[1.7] tracking-[-0.054px] text-[#1F1F1E]">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 w-full flex flex-col gap-3">
          <div className="flex flex-col items-center justify-center gap-10 p-14 bg-[#FAEBFE] text-center">
            <span className="font-body text-[56px] font-medium leading-[1.2] tracking-[-0.168px] text-black">20–30%</span>
            <span className="max-w-[368px] font-body text-2xl font-medium leading-[1.1] text-[#A409D2] uppercase">
              of advisory fees per completed transaction
            </span>
          </div>
          <div className="flex flex-col gap-10 p-8 bg-[#EBFFF6]">
            <span className="font-body text-2xl font-medium leading-[1.1] text-black uppercase">Example calculation</span>
            <div className="flex flex-col gap-2">
              <div className="font-body text-2xl leading-[1.1] text-[#3A3C3E] uppercase">
                Advisory fee: <span className="font-bold">$15,000</span>
              </div>
              <div className="font-body text-2xl leading-[1.1] text-[#3A3C3E] uppercase">
                Partner share at 25%: <span className="font-bold">$3,750</span>
              </div>
            </div>
          </div>
          <p className="font-body text-lg leading-[1.7] tracking-[-0.054px] text-black">
            Our interests are aligned with successful outcomes. We only earn when your client successfully completes their advisory engagement.
          </p>
        </div>
      </section>

      {/* Ideal Referral */}
      <section className="flex flex-col gap-10 py-20 px-6 lg:px-[100px] bg-[#FFFFFE]">
        <div className="flex flex-col gap-10">
          <div className="flex items-center gap-3">
            <div className="w-20 h-[2px] rounded-full bg-black" />
            <span className="font-body text-2xl font-medium text-black uppercase">Ideal Referral</span>
          </div>
          <h2 className="font-display text-[44px] font-black leading-[1.1] text-[#050405]">
            We Work Best With Qualified Clients
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: "◈",
              title: "$200K+",
              desc: "Clients investing $200,000 or more in international property acquisitions."
            },
            {
              icon: "◈",
              title: "3–6 Mo.",
              desc: "Planning to purchase within 3–6 months with funds readily available."
            },
            {
              icon: "◈",
              title: "Decision Makers",
              desc: "Direct decision-makers who seek structured, professional advisory guidance."
            }
          ].map((item, index) => (
            <div key={index} className="flex flex-col gap-14 p-10 border border-black/10 bg-black/[0.02] min-h-[444px]">
              <span className="font-body text-[56px] font-medium italic leading-none tracking-[-1.12px] text-black">{item.icon}</span>
              <div className="flex flex-col gap-8">
                <h3 className="font-display text-[32px] font-medium leading-none tracking-[-0.64px] text-black">{item.title}</h3>
                <p className="font-body text-lg leading-[1.7] tracking-[-0.054px] text-black">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Protect Your Client Relationship */}
      <section className="flex flex-col lg:flex-row items-start gap-10 lg:gap-20 py-20 px-6 lg:px-[100px] bg-[#FEFFFF]">
        <div className="flex-1 flex flex-col gap-10">
          <div className="flex items-center gap-3">
            <div className="w-20 h-[2px] rounded-full bg-[#D9D9D9]" />
            <span className="font-body text-2xl font-medium text-[#602FD3] uppercase">WHY PARTNER WITH US</span>
          </div>
          <h2 className="max-w-[593px] font-display text-[44px] font-black leading-[1.1] text-[#050405]">
            Protect Your Client Relationship
          </h2>
          <div className="flex flex-col">
            {[
              {
                title: "Professional, Structured Process",
                desc: "We operate with institutional-grade rigour at every stage of the advisory process."
              },
              {
                title: "Transparent Communication",
                desc: "You remain informed at every stage. No surprises, no side-channels."
              },
              {
                title: "Discreet Client Handling",
                desc: "Your clients are treated with the same care and discretion you would provide yourself."
              },
              {
                title: "Long-Term Partnership Focus",
                desc: "We build lasting relationships with partners, not transactional one-offs."
              }
            ].map((item, index) => (
              <div key={index} className="py-6 border-t border-black/10 flex flex-col gap-4">
                <span className="font-body text-xl font-bold leading-[1.53] tracking-[-0.06px] text-[#1F1F1E]">{item.title}</span>
                <span className="font-body text-lg font-normal leading-[1.2] tracking-[-0.054px] text-[#1F1F1E]">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 w-full flex flex-col gap-3">
          <div className="relative p-14 bg-[#FAEBFE]">
            <p className="font-body text-[32px] font-medium leading-[1.4] text-black">
              We operate as your trusted property advisory partner — not a competitor. Your reputation matters. We treat referrals as an extension of your brand.
            </p>
            <div className="absolute left-7 top-5">
              <svg width="49" height="36" viewBox="0 0 49 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.54103 0H21.1947L14.9249 35.9833H0L9.54103 0ZM37.2782 0H49L42.9346 35.9833H28.0097L37.2782 0Z" fill="#F4D0FB"/>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Quality & Integrity Standards */}
      <section className="flex flex-col items-center gap-10 py-20 px-6 lg:px-[100px] bg-[#A409D2]">
        <div className="flex flex-col items-center gap-10 text-center">
          <span className="font-body text-2xl font-medium text-white uppercase">WHY PARTNER WITH US</span>
          <h2 className="font-display text-[44px] font-black leading-[1.1] text-white">Quality & Integrity Standards</h2>
          <p className="max-w-[534px] font-body text-lg leading-[1.7] tracking-[-0.054px] text-white">
            To maintain quality and integrity across our curated network, all partners and referrals are held to the following standards:
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-20 w-full max-w-[1200px]">
          {[
            "All partners must be approved before any referrals are accepted",
            "Commission applies only to closed advisory engagements",
            "Referrals must be introduced directly — no third-party handoffs",
            "We reserve the right to decline unqualified referrals"
          ].map((item, index) => (
            <div key={index} className="py-8 border-t border-white/10 flex items-center gap-2">
              <Check className="w-6 h-6 text-white" strokeWidth={3} />
              <span className="font-body text-lg leading-[1.7] tracking-[-0.054px] text-white">{item}</span>
            </div>
          ))}
        </div>
        <div className="max-w-[535px] w-full p-8 bg-black/10 flex flex-col items-center gap-10 text-center relative">
          <p className="font-body text-[32px] font-medium leading-[1.4] text-white">
            We aim to build a curated network — not a volume-based system
          </p>
          <div className="absolute left-10.5 top-4">
            <svg width="20" height="15" viewBox="0 0 20 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.8943 0H8.6509L6.09179 14.6871H0L3.8943 0ZM15.2156 0H20L17.5243 14.6871H11.4325L15.2156 0Z" fill="white"/>
            </svg>
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section className="flex flex-col items-center gap-10 py-20 px-6 lg:px-[100px] bg-white">
        <div className="flex flex-col items-center gap-6 text-center">
          <h2 className="max-w-[482px] font-display text-[44px] font-black leading-[1.1] text-[#050405]">
            Apply to Become a Strategic Referral Partner
          </h2>
          <p className="max-w-[482px] font-body text-lg leading-[1] tracking-[-0.18px] text-black">
            Please complete the application below.<br />
            We review each submission individually and respond within 3–5 business days.
          </p>
        </div>
        
        <div className="w-full max-w-[888px] p-8 bg-white border border-white/10 rounded-[32px]">
          <form className="flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  Company Name<span className="text-[#FA4242]">*</span>
                </label>
                <input 
                  type="text" 
                  placeholder="Your company"
                  className="h-12 px-4 rounded-lg bg-[#EEF0F2] font-body text-xs text-[#676B80] placeholder:opacity-50 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-4">
                <label className="font-body text-sm font-bold text-[#001C47]">
                  Website<span className="text-[#FA4242]">*</span>
                </label>
                <input 
                  type="text" 
                  placeholder="yourwebsite.com"
                  className="h-12 px-4 rounded-lg bg-[#EEF0F2] font-body text-xs text-[#676B80] placeholder:opacity-50 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-4">
                <label className="font-body text-sm font-bold text-[#001C47]">
                  Industry<span className="text-[#FA4242]">*</span>
                </label>
                <div className="relative">
                  <select className="w-full h-12 px-4 rounded-lg bg-[#EEF0F2] font-body text-xs text-[#676B80] appearance-none focus:outline-none">
                    <option>Select your industry</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg width="8" height="4" viewBox="0 0 8 4" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path opacity="0.8" d="M0 0L4 4L8 0" fill="black" fillOpacity="0.8"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-4">
                <label className="font-body text-sm font-bold text-[#001C47]">
                  Years in business<span className="text-[#FA4242]">*</span>
                </label>
                <input 
                  type="text" 
                  placeholder="e.g 8"
                  className="h-12 px-4 rounded-lg bg-[#EEF0F2] font-body text-xs text-[#676B80] placeholder:opacity-50 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-4">
                <label className="font-body text-sm font-bold text-[#001C47]">
                  Countries served<span className="text-[#FA4242]">*</span>
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="e.g UAE, Singapore, UK"
                    className="w-full h-12 px-4 rounded-lg bg-[#EEF0F2] font-body text-xs text-[#676B80] placeholder:opacity-50 focus:outline-none"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg width="8" height="4" viewBox="0 0 8 4" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path opacity="0.8" d="M0 0L4 4L8 0" fill="black" fillOpacity="0.8"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-4">
                <label className="font-body text-sm font-bold text-[#001C47]">
                  Geographic focus<span className="text-[#FA4242]">*</span>
                </label>
                <input 
                  type="text" 
                  placeholder="e.g MENA , South east Asia"
                  className="h-12 px-4 rounded-lg bg-[#EEF0F2] font-body text-xs text-[#676B80] placeholder:opacity-50 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-4">
                <label className="font-body text-sm font-bold text-[#001C47]">
                  Est. Annual Referral Potential<span className="text-[#FA4242]">*</span>
                </label>
                <div className="relative">
                  <select className="w-full h-12 px-4 rounded-lg bg-[#EEF0F2] font-body text-xs text-[#676B80] appearance-none focus:outline-none">
                    <option>Select range</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg width="8" height="4" viewBox="0 0 8 4" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path opacity="0.8" d="M0 0L4 4L8 0" fill="black" fillOpacity="0.8"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <label className="font-body text-sm font-bold text-[#001C47]">
                Description of Typical Client
              </label>
              <textarea 
                placeholder="Describe the type of client profile you work with"
                className="h-[116px] p-4 rounded-lg bg-[#EEF0F2] font-body text-xs text-[#676B80] placeholder:opacity-50 focus:outline-none resize-none"
              />
            </div>

            <div className="flex flex-col gap-4">
              <label className="font-body text-sm font-bold text-[#001C47]">
                How You Currently Serve International Clients
              </label>
              <textarea 
                placeholder="Describe how international property fits into your current client offering"
                className="h-[116px] p-4 rounded-lg bg-[#EEF0F2] font-body text-xs text-[#676B80] placeholder:opacity-50 focus:outline-none resize-none"
              />
            </div>

            <button className="w-full md:w-[258px] h-14 rounded-[48px] bg-black text-white font-body text-base font-semibold tracking-[-0.16px] hover:bg-black/90 transition-colors self-center">
              Submit Application
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

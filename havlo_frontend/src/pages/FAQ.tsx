import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useModal } from '../hooks/useModal';

interface FAQItemProps {
  question: string;
  answer: React.ReactNode;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col p-6 gap-5 self-stretch rounded-[24px] border border-[#3A3C3E]/10 bg-white shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex justify-between items-center w-full text-left gap-4"
      >
        <h3 className="flex-1 font-display text-[22px] font-black leading-[1.5] text-black">
          {question}
        </h3>
        <div className={
          `flex w-8 h-8 shrink-0 items-center justify-center rounded-full bg-[#3E3F42]/10 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`
        }>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.59883 3.20078V16.0008M9.59883 16.0008L14.3988 11.2008M9.59883 16.0008L4.79883 11.2008" stroke="#ABABAB" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="rotate-180 origin-center" />
          </svg>
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 font-body text-base font-medium leading-[1.5] tracking-[-0.32px] text-black/80">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const FAQ: React.FC = () => {
  const { openModal } = useModal();

  const faqs = [
    {
      question: "What is Havlo?",
      answer: "Havlo is a global platform that helps people buy, manage, and sell property abroad. We guide clients through every stage of overseas property ownership — from clarifying goals before purchase to managing or selling property internationally."
    },
    {
      question: "Who is Havlo for?",
      answer: (
        <div className="flex flex-col gap-2">
          <p>Havlo works with:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Individuals buying a second home abroad</li>
            <li>Investors purchasing international property</li>
            <li>Property owners who require ongoing overseas management</li>
            <li>Owners looking to sell property abroad with trusted local support</li>
          </ul>
        </div>
      )
    },
    {
      question: "Which countries does Havlo operate in?",
      answer: "Havlo supports property transactions and management across multiple international markets, subject to local regulations and market availability. We work with vetted local experts to ensure compliance, accuracy, and reliable execution."
    },
    {
      question: "How does Havlo help with buying property abroad?",
      answer: (
        <div className="flex flex-col gap-2">
          <p>Havlo helps you:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Define your purpose for buying (investment, lifestyle, relocation, rental income)</li>
            <li>Understand local property markets and risks</li>
            <li>Explore suitable ownership and investment structures</li>
            <li>Navigate legal, financial, and regulatory considerations</li>
            <li>Make informed, risk-aware decisions</li>
          </ul>
        </div>
      )
    },
    {
      question: "Why does Havlo focus on my purpose for buying?",
      answer: (
        <div className="flex flex-col gap-2">
          <p>Buying property abroad means different things to different people. An investment property requires a different strategy than a second home or relocation purchase. Understanding your purpose allows Havlo to:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Recommend appropriate locations</li>
            <li>Suggest suitable ownership structures</li>
            <li>Align your purchase with long-term personal or financial goals</li>
          </ul>
        </div>
      )
    },
    {
      question: "What ownership options are available?",
      answer: (
        <div className="flex flex-col gap-2">
          <p>Depending on the country and property type, Havlo helps clients explore:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Full ownership</li>
            <li>Shared ownership</li>
            <li>Fractional ownership</li>
            <li>Co-investment opportunities</li>
          </ul>
          <p>Each option is explained clearly, including benefits, risks, and legal implications.</p>
        </div>
      )
    },
    {
      question: "Can foreigners legally buy property in other countries?",
      answer: (
        <div className="flex flex-col gap-2">
          <p>In many countries, yes — although rules vary widely. Some countries allow full foreign ownership, while others impose restrictions or special requirements. Havlo helps you understand:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Local ownership laws</li>
            <li>Residency or visa considerations</li>
            <li>Tax and compliance requirements</li>
          </ul>
        </div>
      )
    },
    {
      question: "Does Havlo provide legal or financial advice?",
      answer: "Havlo does not replace licensed legal or financial professionals. Instead, we help you understand what questions to ask, highlight potential risks, and connect you with trusted local experts when professional advice is required."
    },
    {
      question: "Can I buy property remotely?",
      answer: "In many cases, yes. Some purchases can be completed partially or fully remotely using powers of attorney and digital processes. Havlo coordinates and explains what is possible in each market."
    },
    {
      question: "Does Havlo help manage properties after purchase?",
      answer: (
        <div className="flex flex-col gap-2">
          <p>Yes. Havlo supports ongoing overseas property management, particularly for owners who live outside the country where the property is located.</p>
          <p>What property management services does Havlo offer?</p>
          <p>Depending on location and local partners, services may include:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Tenant sourcing and screening</li>
            <li>Rent coordination</li>
            <li>Maintenance and minor repairs</li>
            <li>Property inspections</li>
            <li>Managing local service providers</li>
            <li>Preserving long-term property value</li>
          </ul>
        </div>
      )
    },
    {
      question: "Can Havlo manage both rental properties and second homes?",
      answer: "Yes. Whether your property is rented out or used occasionally as a second home, Havlo ensures it remains secure, maintained, and properly overseen."
    },
    {
      question: "How does Havlo protect my property’s value?",
      answer: (
        <div className="flex flex-col gap-2">
          <p>By ensuring:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Timely maintenance and repairs</li>
            <li>Reliable tenants where applicable</li>
            <li>Regular inspections</li>
            <li>Proper local oversight</li>
          </ul>
          <p>This helps prevent neglect, unexpected damage, and long-term depreciation.</p>
        </div>
      )
    },
    {
      question: "Can Havlo help me sell my property abroad?",
      answer: "Yes. Havlo supports property owners who wish to sell overseas property, even if they no longer live in the country where the property is located."
    },
    {
      question: "Do I need to pay taxes when selling property abroad?",
      answer: (
        <div className="flex flex-col gap-2">
          <p>Most countries apply capital gains tax or other fees when selling property. Rules vary based on location and residency status. Havlo helps you understand:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>What taxes may apply</li>
            <li>What documentation is required</li>
            <li>When specialist tax advice is recommended</li>
          </ul>
        </div>
      )
    },
    {
      question: "Can Havlo help sell jointly owned or shared properties?",
      answer: "Yes. Havlo helps owners understand the legal and practical steps involved in selling shared, fractional, or co-owned properties."
    },
    {
      question: "What are Havlo’s fees?",
      answer: "Havlo charges service fees depending on the type of support provided (buying, managing, or selling property). All fees are communicated clearly before you proceed."
    },
    {
      question: "Is there an initial consultation or commitment fee?",
      answer: (
        <div className="flex flex-col gap-2">
          <p>Yes. To commence advisory services, clients are required to pay an initial commitment fee of $500.</p>
          <p>This fee covers:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>An initial consultation</li>
            <li>Discussion of your options and strategy</li>
            <li>Preliminary market and property assessment</li>
          </ul>
          <p>The final service fee depends on the type of property sought and the location, and is discussed transparently before any transaction proceeds.</p>
        </div>
      )
    },
    {
      question: "Are there hidden costs?",
      answer: "No. Transparency is central to Havlo. Any service fees, third-party costs, or potential expenses are explained upfront."
    },
    {
      question: "How do I get started?",
      answer: "You begin by sharing your situation and goals. From there, Havlo guides you through the next steps based on whether you are buying, managing, or selling property abroad."
    },
    {
      question: "How does Havlo work with local partners?",
      answer: "Havlo collaborates with vetted local professionals and service providers to ensure quality, compliance, and reliability in each market."
    },
    {
      question: "Is my information secure?",
      answer: "Yes. Havlo treats all client information with strict confidentiality and uses secure systems to protect personal and property data."
    }
  ];

  return (
    <div className="flex flex-col w-full bg-white">

      {/* Beige rounded box — title only */}
      <div className="mt-4 mb-4 mx-[5px] lg:mx-[5px] rounded-[32px] bg-[#FBF3EA] px-10 pt-[84px] pb-[132px] lg:px-20">
        <h1 className="font-display text-[70px] font-black leading-none tracking-[-1.6px] text-black text-center">
          FAQ's
        </h1>
      </div>

      {/* FAQ list — pulled up to overlap beige box */}
      <div className="flex flex-col w-full max-w-[1126px] mx-auto gap-6 px-6 lg:px-10 -mt-20">
        {faqs.map((faq, index) => (
          <FAQItem key={index} question={faq.question} answer={faq.answer} />
        ))}
      </div>

      {/* Still Have Questions Section */}
      <section className="flex flex-col items-center gap-14 bg-[#FBF3EA] px-4 py-20 mt-20 sm:px-10 lg:px-[100px]">
        <div className="flex flex-col items-center gap-10 text-center max-w-[929px]">
          <h2 className="font-display text-[56px] font-medium leading-none tracking-[-1.44px] text-[#1F1F1E] sm:text-[72px]">
            Still Have Questions?
          </h2>
          <p className="font-body text-lg font-normal leading-[1.7] tracking-[-0.054px] text-black">
            Every property journey is unique. If you have specific questions about buying, managing, or selling property abroad, Havlo is here to help. Start with your goals — we'll guide you from there.
          </p>
        </div>
        <Button 
          onClick={() => openModal('book-session')}
          className="h-14 px-6 rounded-[48px] bg-black text-[#FEFFFF] font-semibold text-lg hover:bg-black/90 transition-colors"
        >
          Talk to our Team
        </Button>
      </section>

    </div>
  );
};

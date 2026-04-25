import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../components/ui/Button';
import { useModal } from '../hooks/useModal';
import { usePageMeta } from '../hooks/usePageMeta';

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
        aria-expanded={isOpen}
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

type TabKey = 'buyers' | 'sellers' | 'agents';

const buyerFaqs: FAQItemProps[] = [
  {
    question: 'What is Havlo?',
    answer: 'Havlo is a global platform that helps people buy, manage, and sell property abroad. We guide clients through every stage of overseas property ownership — from clarifying goals before purchase to managing or selling property internationally.',
  },
  {
    question: 'Who is Havlo for?',
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
    ),
  },
  {
    question: 'Which countries does Havlo operate in?',
    answer: 'Havlo supports property transactions and management across multiple international markets, subject to local regulations and market availability. We work with vetted local experts to ensure compliance, accuracy, and reliable execution.',
  },
  {
    question: 'How does Havlo help with buying property abroad?',
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
    ),
  },
  {
    question: 'Why does Havlo focus on my purpose for buying?',
    answer: (
      <div className="flex flex-col gap-2">
        <p>Buying property abroad means different things to different people. An investment property requires a different strategy than a second home or relocation purchase. Understanding your purpose allows Havlo to:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Recommend appropriate locations</li>
          <li>Suggest suitable ownership structures</li>
          <li>Align your purchase with long-term personal or financial goals</li>
        </ul>
      </div>
    ),
  },
  {
    question: 'What ownership options are available?',
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
    ),
  },
  {
    question: 'Can foreigners legally buy property in other countries?',
    answer: (
      <div className="flex flex-col gap-2">
        <p>In many countries, yes — although rules vary widely. Some countries allow full foreign ownership, while others impose restrictions or special requirements. Havlo helps you understand:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Local ownership laws</li>
          <li>Residency or visa considerations</li>
          <li>Tax and compliance requirements</li>
        </ul>
      </div>
    ),
  },
  {
    question: 'Does Havlo provide legal or financial advice?',
    answer: 'Havlo does not replace licensed legal or financial professionals. Instead, we help you understand what questions to ask, highlight potential risks, and connect you with trusted local experts when professional advice is required.',
  },
  {
    question: 'Can I buy property remotely?',
    answer: 'In many cases, yes. Some purchases can be completed partially or fully remotely using powers of attorney and digital processes. Havlo coordinates and explains what is possible in each market.',
  },
  {
    question: 'Does Havlo help manage properties after purchase?',
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
    ),
  },
  {
    question: 'Can Havlo manage both rental properties and second homes?',
    answer: 'Yes. Whether your property is rented out or used occasionally as a second home, Havlo ensures it remains secure, maintained, and properly overseen.',
  },
  {
    question: 'How does Havlo protect my property’s value?',
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
    ),
  },
  {
    question: 'Can Havlo help me sell my property abroad?',
    answer: 'Yes. Havlo supports property owners who wish to sell overseas property, even if they no longer live in the country where the property is located.',
  },
  {
    question: 'Do I need to pay taxes when selling property abroad?',
    answer: (
      <div className="flex flex-col gap-2">
        <p>Most countries apply capital gains tax or other fees when selling property. Rules vary based on location and residency status. Havlo helps you understand:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>What taxes may apply</li>
          <li>What documentation is required</li>
          <li>When specialist tax advice is recommended</li>
        </ul>
      </div>
    ),
  },
  {
    question: 'Can Havlo help sell jointly owned or shared properties?',
    answer: 'Yes. Havlo helps owners understand the legal and practical steps involved in selling shared, fractional, or co-owned properties.',
  },
  {
    question: 'What are Havlo’s fees?',
    answer: 'Havlo charges service fees depending on the type of support provided (buying, managing, or selling property). All fees are communicated clearly before you proceed.',
  },
  {
    question: 'Is there an initial consultation or commitment fee?',
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
    ),
  },
  {
    question: 'Are there hidden costs?',
    answer: 'No. Transparency is central to Havlo. Any service fees, third-party costs, or potential expenses are explained upfront.',
  },
  {
    question: 'How do I get started?',
    answer: 'You begin by sharing your situation and goals. From there, Havlo guides you through the next steps based on whether you are buying, managing, or selling property abroad.',
  },
  {
    question: 'How does Havlo work with local partners?',
    answer: 'Havlo collaborates with vetted local professionals and service providers to ensure quality, compliance, and reliability in each market.',
  },
  {
    question: 'Is my information secure?',
    answer: 'Yes. Havlo treats all client information with strict confidentiality and uses secure systems to protect personal and property data.',
  },
];

const sellerFaqs: FAQItemProps[] = [
  {
    question: 'What is Havlo?',
    answer: 'Havlo for sellers/homeowners helps homeowners market their high-value or slower-to-sell properties to international (offshore) buyers through targeted digital advertising and a curated network of qualified buyers.',
  },
  {
    question: 'Who is Havlo for?',
    answer: (
      <div className="flex flex-col gap-2">
        <p>Havlo is designed for:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Homeowners/sellers with premium or unique properties</li>
        </ul>
        <p>Particularly those struggling to reach the right buyers locally or sell within expected timeframes.</p>
      </div>
    ),
  },
  {
    question: 'What services does Havlo offer for property?',
    answer: (
      <div className="flex flex-col gap-3">
        <p>Havlo offers three core products:</p>
        <div>
          <p className="font-semibold">Elite Property Introductions</p>
          <p>Showcase your property to a curated list of ready-to-buy offshore buyers who are actively seeking opportunities.</p>
        </div>
        <div>
          <p className="font-semibold">Sell Faster (Havlo Relaunch™)</p>
          <p>A dedicated programme designed to help properties that have been on the market for over 6 months secure a buyer through a strategic relaunch.</p>
        </div>
        <div>
          <p className="font-semibold">Property Sale Audit</p>
          <p>A detailed review to uncover why your property hasn’t sold, with a clear, actionable plan. This includes analysis of pricing, presentation, and market positioning to identify obstacles and recommend the best next steps.</p>
        </div>
      </div>
    ),
  },
  {
    question: 'How does Havlo work?',
    answer: (
      <div className="flex flex-col gap-2">
        <p>Havlo combines:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Targeted digital advertising campaigns</li>
          <li>Access to a curated database of offshore buyers</li>
          <li>Strategic positioning of your property for international appeal</li>
        </ul>
      </div>
    ),
  },
  {
    question: 'What types of properties perform best on Havlo?',
    answer: (
      <div className="flex flex-col gap-2">
        <p>Havlo is best suited for:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>High-value residential properties</li>
          <li>Luxury homes</li>
          <li>Investment properties</li>
          <li>Unique or niche listings</li>
        </ul>
      </div>
    ),
  },
  {
    question: 'What do you mean by “offshore buyers”?',
    answer: 'Offshore buyers are individuals or investors based outside your local market who are looking to purchase property abroad for investment, relocation, or diversification.',
  },
  {
    question: 'Are the buyers qualified?',
    answer: 'Yes. Havlo focuses on curated, high-intent buyers, helping reduce low-quality enquiries.',
  },
  {
    question: 'How is Havlo different from traditional property portals?',
    answer: (
      <div className="flex flex-col gap-2">
        <p>Unlike standard portals, Havlo:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Actively markets your property internationally</li>
          <li>Targets specific buyer profiles</li>
          <li>Uses data-driven advertising rather than passive listings</li>
        </ul>
      </div>
    ),
  },
  {
    question: 'How long does it take to see results?',
    answer: 'Interest can be generated quickly after launch, but timelines vary depending on the property and market conditions.',
  },
  {
    question: 'Do I need to manage anything myself?',
    answer: 'No. Havlo manages the marketing, targeting, and optimisation for you.',
  },
  {
    question: 'Can I track performance?',
    answer: 'Yes, you’ll receive insights into campaign performance, engagement, and enquiries.',
  },
  {
    question: 'Is Havlo suitable for all properties?',
    answer: 'Havlo is most effective for higher-value or slower-to-sell properties with international appeal.',
  },
  {
    question: 'How do I get started?',
    answer: (
      <div className="flex flex-col gap-2">
        <p>Create an account, select the service you require—Elite Property Introductions, Sell Faster (Havlo Relaunch™), or Property Sale Audit—then complete payment and provide your property details.</p>
        <p>Once submitted, Havlo will handle the rest, assessing and marketing your property to the right audience and helping facilitate a successful sale.</p>
      </div>
    ),
  },
  {
    question: 'Does Havlo replace my estate agent?',
    answer: (
      <div className="flex flex-col gap-2">
        <p>No. Havlo works alongside your existing estate agent, not as a replacement.</p>
        <p>Traditional agents primarily rely on local networks and property portals, whereas Havlo helps you reach international (offshore) buyers that are not accessible through standard listings alone.</p>
        <p>Havlo focuses on generating additional demand through targeted global marketing. All enquiries and leads generated are passed directly to you or your appointed agent for handling, negotiation, and closing.</p>
      </div>
    ),
  },
  {
    question: 'Need help or support?',
    answer: 'If you need assistance or would like to speak to someone, simply use the chat feature on your dashboard and our friendly team will be happy to help. You can also contact us using the phone number listed on our website’s Contact Us page, or reach out through our WhatsApp support channels.',
  },
  {
    question: 'What property price range does Havlo market?',
    answer: (
      <div className="flex flex-col gap-2">
        <p>Havlo is designed to market a wide range of property values, with a particular focus on high-value international real estate.</p>
        <p>Our ideal audience consists of buyers who can afford properties from around £500,000 and above, as this allows us to maximise exposure to serious offshore investors and highlight premium opportunities that align with their expectations.</p>
        <p>However, this does not mean your property must be valued at this level to use Havlo. You can still benefit from our services regardless of price point, as international buyers often purchase exceptional properties based on quality, uniqueness, and investment potential—not just price alone.</p>
        <p>In short, if your property has strong appeal, Havlo can help position it to the right global audience.</p>
      </div>
    ),
  },
  {
    question: 'Do I need to do anything differently if my property is valued at £3M+?',
    answer: (
      <div className="flex flex-col gap-2">
        <p>Yes. If your property is valued at £3 million or more, we recommend booking a private consultation with our team directly through your dashboard.</p>
        <p>At this level, we work with a more exclusive buyer pool, including family offices, high-net-worth individuals, and private investors actively seeking premium international property opportunities.</p>
        <p>This ensures your property is positioned and marketed with a more tailored, discreet, and high-impact strategy to reach the most relevant global buyers.</p>
      </div>
    ),
  },
];

const agentFaqs: FAQItemProps[] = [
  {
    question: 'What is International Buyer Network?',
    answer: (
      <div className="flex flex-col gap-2">
        <p>International Buyer Network is a Havlo service designed specifically for estate agents to help sell properties faster by connecting listings with a curated network of qualified, ready-to-buy international buyers.</p>
        <p>It goes beyond traditional property portals by actively promoting your listings to offshore buyers who are already seeking investment opportunities.</p>
      </div>
    ),
  },
  {
    question: 'How does it help estate agents?',
    answer: (
      <div className="flex flex-col gap-2">
        <p>It helps agents generate additional demand by:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Expanding exposure beyond local property portals</li>
          <li>Reaching international and offshore buyers</li>
          <li>Increasing the speed of sales for suitable properties</li>
          <li>Driving more qualified enquiries directly to agents</li>
        </ul>
      </div>
    ),
  },
  {
    question: 'Do I lose control of my listings?',
    answer: 'No. You remain the listing agent at all times. Havlo simply acts as an additional marketing channel to increase exposure and buyer reach.',
  },
  {
    question: 'Who are the international buyers?',
    answer: (
      <div className="flex flex-col gap-2">
        <p>Our curated network includes:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>High-net-worth individuals</li>
          <li>International property investors</li>
          <li>Relocation buyers</li>
          <li>Family offices and private investors</li>
        </ul>
        <p>All buyers are targeted based on intent and purchasing capability.</p>
      </div>
    ),
  },
  {
    question: 'How are enquiries handled?',
    answer: 'All leads and enquiries generated through International Buyer Network are passed directly to you or your agency for follow-up, negotiation, and completion.',
  },
  {
    question: 'How is this different from property portals?',
    answer: (
      <div className="flex flex-col gap-2">
        <p>Unlike passive property listings on portals, Havlo:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Actively markets your listings internationally</li>
          <li>Uses targeted digital advertising campaigns</li>
          <li>Matches properties with pre-qualified buyer profiles</li>
          <li>Focuses on buyer intent, not just visibility</li>
        </ul>
      </div>
    ),
  },
  {
    question: 'What types of properties work best?',
    answer: (
      <div className="flex flex-col gap-2">
        <p>The service is most effective for:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>High-value residential properties</li>
          <li>Investment properties</li>
          <li>Unique or hard-to-sell listings</li>
          <li>Properties with international appeal</li>
        </ul>
      </div>
    ),
  },
  {
    question: 'Do I need to change how I operate?',
    answer: 'No. You continue your normal sales process. Havlo simply adds an international buyer acquisition layer to your existing strategy.',
  },
  {
    question: 'How quickly will I see results?',
    answer: 'Results can begin shortly after activation, depending on the property type and target market, as campaigns are launched directly to relevant buyer audiences.',
  },
  {
    question: 'How do I get started?',
    answer: 'Simply onboard your agency, submit your listings, and Havlo will begin positioning them to the International Buyer Network immediately.',
  },
];

const tabConfig: { key: TabKey; label: string; faqs: FAQItemProps[] }[] = [
  { key: 'buyers', label: 'For Buyers', faqs: buyerFaqs },
  { key: 'sellers', label: 'For Sellers', faqs: sellerFaqs },
  { key: 'agents', label: 'For Agents', faqs: agentFaqs },
];

export const FAQ: React.FC = () => {
  usePageMeta({
    title: "FAQs - International Property Buying with Havlo | Havlo",
    description: "Find answers to common questions about buying, selling, and managing property abroad with Havlo. Clear guidance to help you make informed decisions.",
    canonical: 'https://www.heyhavlo.com/faq',
  });
  const { openModal } = useModal();
  const [activeTab, setActiveTab] = useState<TabKey>('buyers');
  const activeFaqs = tabConfig.find((t) => t.key === activeTab)?.faqs ?? [];

  return (
    <div className="flex flex-col w-full bg-white">
      {/* Beige rounded box — title only */}
      <div className="mt-4 mb-4 mx-[5px] lg:mx-[5px] rounded-[32px] bg-[#FBF3EA] px-10 pt-[84px] pb-[132px] lg:px-20">
        <h1 className="font-display text-[70px] font-black leading-none tracking-[-1.6px] text-black text-center">
          FAQ's
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex flex-col w-full max-w-[1126px] mx-auto px-6 lg:px-10 -mt-20 mb-8">
        <div
          role="tablist"
          aria-label="FAQ categories"
          className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 rounded-full border border-[#3A3C3E]/10 bg-white p-2 shadow-sm self-center"
        >
          {tabConfig.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                aria-controls={`faq-panel-${tab.key}`}
                id={`faq-tab-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.key)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const idx = tabConfig.findIndex((t) => t.key === activeTab);
                    const next =
                      e.key === 'ArrowRight'
                        ? tabConfig[(idx + 1) % tabConfig.length]
                        : tabConfig[(idx - 1 + tabConfig.length) % tabConfig.length];
                    setActiveTab(next.key);
                    document.getElementById(`faq-tab-${next.key}`)?.focus();
                  }
                }}
                className={
                  'px-5 sm:px-6 py-2.5 rounded-full font-body text-base sm:text-lg font-semibold transition-colors ' +
                  (isActive
                    ? 'bg-black text-white'
                    : 'text-black/70 hover:bg-black/5')
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* FAQ list */}
      <div
        role="tabpanel"
        id={`faq-panel-${activeTab}`}
        aria-labelledby={`faq-tab-${activeTab}`}
        className="flex flex-col w-full max-w-[1126px] mx-auto gap-6 px-6 lg:px-10"
      >
        {activeFaqs.map((faq, index) => (
          <FAQItem key={`${activeTab}-${index}`} question={faq.question} answer={faq.answer} />
        ))}
      </div>

      {/* Still Have Questions Section */}
      <section className="flex flex-col items-center gap-14 bg-[#FBF3EA] px-4 sm:px-10 lg:px-[100px] py-10 my-0 mt-[50px]">
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

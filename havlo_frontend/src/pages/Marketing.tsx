import React, { useState } from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { HeroBackground } from '../components/shared/HeroBackground';
import { AutoScrollReviews } from '../components/shared/AutoScrollReviews';
import { TrustpilotStars } from '../components/ui/TrustpilotStars';
import { useModal } from '../hooks/useModal';
import { cn } from '../lib/utils';
import heroImage from '../../Rectangle 5.png';
import { usePageMeta } from '../hooks/usePageMeta';

const sellFasterReviews = [
  { title: 'Finally sold after months of no progress', content: 'Our property had been on the market for over 6 months with very little interest. Havlo Relaunch completely changed that and brought in serious buyers.', author: 'Ben, Reading' },
  { title: 'A real turnaround for our listing', content: 'We had almost given up after months of no offers. The relaunch strategy worked, and we finally secured a buyer.', author: 'Claire, Sheffield' },
  { title: 'Exactly what we needed after 6+ months', content: 'Havlo helped reposition our property and attract a completely new audience. The difference was immediate.', author: 'Marcus, Liverpool' },
  { title: 'Sold after being stuck for nearly a year', content: 'Our house had been listed for close to a year with no success. Havlo Relaunch gave it new life and helped us finally move forward.', author: 'Fiona, Oxford' },
  { title: 'New strategy, real results', content: 'The relaunch approach made all the difference. Better marketing, better positioning, and much stronger enquiries.', author: 'Ryan, Newcastle' },
  { title: 'From no interest to serious offers', content: 'We went from barely any viewings to genuine offers after using Havlo. The international exposure really worked.', author: 'Priya, Leicester' },
  { title: 'Helped us break through a stagnant market', content: 'Our property had gone stale on the market. Havlo Relaunch brought in fresh demand and the right kind of buyers.', author: 'Gareth, Cardiff' },
  { title: 'Professional and highly effective', content: 'The team clearly understood why our property wasn’t selling and fixed it. We saw results much faster than expected.', author: 'Nadia, Abu Dhabi' },
  { title: 'Great solution for slow-moving properties', content: 'If your property has been sitting unsold, this service is exactly what you need. It helped us secure a buyer after months of frustration.', author: 'Lewis, Glasgow' },
  { title: 'A fresh start that worked', content: 'Havlo gave our listing a proper relaunch with a clear strategy. It attracted new interest and ultimately led to a successful sale.', author: 'Sanjay, Slough' },
  { title: 'Gave us clarity we didn’t have before', content: 'We couldn’t understand why our property wasn’t selling. The Havlo assessment clearly identified the issues and gave us a solid plan to move forward.', author: 'Andrew, Guildford' },
  { title: 'Eye-opening and extremely helpful', content: 'The audit highlighted pricing and presentation issues we had completely overlooked. It gave us a clear direction and renewed confidence.', author: 'Rachel, Cambridge' },
  { title: 'Exactly what we needed', content: 'After months of no progress, the assessment showed us exactly what was holding the sale back. The recommendations were practical and easy to implement.', author: 'Tom, Brighton' },
  { title: 'Clear, honest and actionable advice', content: 'Havlo didn’t just guess—they provided real insights backed by data. It helped us understand our position in the market properly.', author: 'Louise, York' },
  { title: 'Helped us fix key issues quickly', content: 'We made a few key changes based on the audit, and the difference was immediate. Much more interest and better quality enquiries.', author: 'Chris, Milton Keynes' },
  { title: 'Finally understood why it wasn’t selling', content: 'The assessment broke everything down clearly—pricing, photos, and positioning. It all made sense once we saw it laid out properly.', author: 'Nina, Reading' },
  { title: 'Professional and insightful service', content: 'The level of detail in the report was impressive. It felt like a proper strategy rather than just general advice.', author: 'Hassan, Doha' },
  { title: 'A smart first step before relaunching', content: 'Before switching agents, this audit helped us get everything right. It saved us time and avoided repeating mistakes.', author: 'Emma, Chelmsford' },
  { title: 'Straightforward and effective', content: 'No fluff—just clear reasons why our property wasn’t selling and what to do next. Exactly what we needed.', author: 'Daniel, Southampton' },
  { title: 'Worth it for the clarity alone', content: 'Even before relaunching, the audit gave us a completely new perspective on how our property was being seen by buyers.', author: 'Priya, Harrow' },
];

const problemPoints = [
  {
    title: "Portals don't reach international buyers",
    text: 'Most offshore buyers are not browsing UK property portals. They are reachable through targeted social advertising in their home markets.',
  },
  {
    title: 'Every month on market costs you money',
    text: 'Mortgage payments, maintenance, and price reductions add up fast. The longer a property sits, the more it costs — and the more leverage buyers gain.',
  },
  {
    title: 'The right buyer may not be in the UK',
    text: 'UK property is a global asset class. Buyers in the Gulf, West Africa, Southeast Asia, and beyond are actively seeking UK property — they just cannot find yours.',
  },
];

const problemStats = [
  { value: '£3,000+', label: 'Average monthly carrying cost while a property sits unsold' },
  { value: '30+', label: 'Countries Havlo campaigns actively reach' },
  { value: '0%', label: 'Commission charged on sale — ever' },
];

const processSteps = [
  {
    step: '01',
    title: 'Strategy call',
    text: 'We learn about your property, your timeline, and the buyer markets most likely to convert. We recommend the right plan and target regions for your specific situation.',
  },
  {
    step: '02',
    title: 'Campaign setup',
    text: 'We build your Meta campaign from scratch — creative, audience targeting, lead capture, and tracking. Your ad spend goes directly to Meta from your account.',
  },
  {
    step: '03',
    title: 'Launch & activation',
    text: 'Your campaign goes live across the chosen international markets. Qualified buyers begin discovering your property within days, not months.',
  },
  {
    step: '04',
    title: 'Optimise & report',
    text: 'We continuously refine targeting and creative based on live performance data, and send you transparent reports on enquiries, engagement and demand.',
  },
];

type Tier = {
  name: string;
  tagline: string;
  setup: string;
  ongoing: string;
  features: string[];
  outcome: string;
  idealFor: string;
  variant: 'white' | 'purple' | 'dark';
  highlight?: string;
  cta: string;
  footnote?: string;
};

const tiers: Tier[] = [
  {
    name: 'Launch',
    tagline: 'For generating initial international interest',
    setup: '£2,000 Property Launch',
    ongoing: 'Ongoing exposure from £1,500 / month',
    features: [
      'Targeted exposure across key international buyer markets',
      'High-impact campaign designed to capture attention quickly',
      'Private buyer registration page',
      'Enquiry capture and qualification',
      'Live visibility into buyer interest',
      'Designed to generate demand beyond traditional property portals',
      'No long-term commitment — continue based on performance',
    ],
    outcome:
      'Early buyer demand generated with a consistent flow of qualified enquiries to initiate market momentum.',
    idealFor:
      'Properties looking to attract new demand outside their immediate local market.',
    variant: 'white',
    cta: 'Start Your Property Relaunch',
    footnote: '* Best suited for initial exposure. For stronger competition, consider Amplify.',
  },
  {
    name: 'Amplify',
    tagline: 'Designed to create strong buyer demand and competition',
    setup: '£3,500 Property Launch',
    ongoing: 'Ongoing exposure from £2,500 / month',
    features: [
      'Expanded reach across multiple high-intent global markets',
      'Multi-format campaign engineered to drive engagement and enquiries',
      'Dedicated property landing experience',
      'Continuous optimisation to increase enquiry volume',
      'Weekly insights into buyer behaviour and demand trends',
      'Designed to generate demand beyond traditional property portals',
      'No long-term commitment — continue based on performance',
    ],
    outcome:
      'Sustained enquiry flow with increasing buyer competition, strengthening your negotiating position.',
    idealFor:
      'Sellers looking to attract multiple serious buyers and strengthen their negotiating position.',
    variant: 'purple',
    highlight: 'MOST POPULAR',
    cta: 'Start Your Property Relaunch',
  },
  {
    name: 'Dominate',
    tagline: 'Maximum global exposure to drive premium offers',
    setup: '£5,000 Property Launch',
    ongoing: 'Ongoing exposure from £3,500 / month',
    features: [
      'Extensive worldwide exposure across 30+ countries',
      'Full-scale campaign strategy designed for maximum visibility',
      'Advanced targeting to reach high-value international buyers',
      'Dedicated campaign management and optimisation',
      'Ongoing strategy refinement based on live demand data',
      'Designed to generate demand beyond traditional property portals',
      'No long-term commitment — continue based on performance',
    ],
    outcome:
      'High enquiry volume, strong buyer competition, and increased likelihood of achieving above-market offers.',
    idealFor:
      'Properties where maximising price and buyer competition is the priority.',
    variant: 'white',
    cta: 'Start Your Property Relaunch',
  },
  {
    name: 'Private Clients',
    tagline: 'Bespoke strategy for high-value and unique properties',
    setup: 'Custom pricing',
    ongoing: 'Tailored to scope — discussed privately',
    features: [
      'Fully tailored global launch strategy',
      'Premium creative and campaign positioning',
      'Access to high-value international buyers',
      'Bespoke market targeting (UK + international)',
      'Advanced buyer targeting & optimisation',
      'Private buyer registration experience',
      'Live demand insights designed to generate demand beyond traditional portals',
      'Dedicated campaign management',
      'Ongoing strategic advisory',
    ],
    outcome:
      'Direct engagement from high-value buyers, intensified competition, and positioning to secure the strongest possible outcome.',
    idealFor:
      'High-value or unique properties where maximising buyer competition and final price is the priority.',
    variant: 'dark',
    cta: 'Request Private Consultation',
  },
];

const portalCons = [
  'Passive listings waiting for buyers',
  'Competing against hundreds of similar properties',
  'Limited to buyers already searching',
  'Local visibility only',
  'No control over demand flow',
];

const havloPros = [
  'Active campaigns generating buyer demand',
  'Positioned as a standout property launch',
  'Reaches buyers not yet actively looking',
  'Local and international visibility across key markets',
  'Scalable exposure based on your goals',
];

const faqs = [
  {
    q: 'Do I still need my estate agent?',
    a: 'Yes — and you keep them. Havlo works alongside your existing agent, not instead of them. We open up international buyer markets your agent cannot reach through portals alone. Viewings, negotiations, and the sale itself are handled through your agent and solicitor as normal.',
  },
  {
    q: 'What does month 1 look like financially?',
    a: 'Month 1 includes the one-time setup fee alongside your first monthly management fee — it is the most investment-heavy month. From month 2 onwards you only pay the monthly management fee, plus your ad spend directly to Meta.',
  },
  {
    q: 'Which plan is right for my property?',
    a: 'Choose based on the reach you want, not the value of your property. Not sure? We will recommend the right plan on your free strategy call — there is no obligation to proceed and no pressure to commit.',
  },
  {
    q: 'Why is ad spend separate from your fees?',
    a: 'Your advertising budget goes directly from your account to Meta. Havlo never touches that money. This means full transparency — you can see every pound spent in real time — and we take no margin on your ad spend whatsoever.',
  },
  {
    q: 'Can I continue beyond the minimum term?',
    a: 'Yes. All plans roll monthly after the minimum term. You can pause or stop with 30 days notice once the minimum period is complete.',
  },
  {
    q: 'Do you charge a commission when the property sells?',
    a: 'No. Havlo charges fixed management fees only. We are a marketing service, not an estate agent. There is no commission, no referral fee, and no percentage of the sale price — ever.',
  },
  {
    q: 'How quickly can I expect buyer interest?',
    a: 'In many cases, sellers begin seeing qualified enquiries within the first few weeks of relaunch. By targeting active international buyers from day one, we accelerate exposure and reduce the time your property sits unnoticed.',
  },
  {
    q: 'What results have other sellers seen?',
    a: 'We\u2019ve helped sellers revive listings that had stalled for months — generating fresh enquiries, attracting international buyers, and creating renewed momentum toward a sale. Results vary by property, but the goal is always the same: more qualified buyers, faster.',
  },
  {
    q: 'What makes this different from my agent?',
    a: 'We don\u2019t replace your agent — we enhance their reach. Most agents rely on local portals and databases, which limits exposure to a domestic audience. Havlo adds a targeted international layer, putting your property in front of qualified buyers your current marketing isn\u2019t reaching.',
  },
];

const FAQ_INITIAL_VISIBLE = 2;

export const Marketing: React.FC = () => {
  usePageMeta({
    title: 'Sell Your Property Abroad with Ease | Havlo',
    description:
      'Sell your property abroad with ease using Havlo. Reach qualified buyers, manage listings seamlessly, and close deals faster—no stress, no hassle.',
    canonical: 'https://www.heyhavlo.com/sell-your-property',
  });

  const { openModal } = useModal();
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(() => new Set([0]));
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const [activeTierIndex, setActiveTierIndex] = useState(0);
  const visibleFaqs = showAllFaqs ? faqs : faqs.slice(0, FAQ_INITIAL_VISIBLE);

  const renderTierCard = (tier: Tier) => {
    const isPurple = tier.variant === 'purple';
    const isDark = tier.variant === 'dark';
    const isLight = tier.variant === 'white';
    return (
      <div
        className={cn(
          'relative flex flex-col p-6 lg:p-7',
          isPurple && 'bg-[#a409d2] text-white',
          isDark && 'bg-[#0c0c0c] text-white',
          isLight && 'border border-black/12 bg-white text-black'
        )}
      >
        {tier.highlight && (
          <div className="absolute right-5 top-5 rounded-full bg-white px-3 py-1 font-body text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#a409d2]">
            {tier.highlight}
          </div>
        )}

        <h3
          className={cn(
            'font-display text-[26px] font-black leading-none tracking-[-0.5px] sm:text-[28px]',
            tier.name === 'Private Clients' && 'uppercase tracking-[0.04em] text-[24px] sm:text-[26px]'
          )}
        >
          {tier.name}
        </h3>
        <p
          className={cn(
            'mt-3 min-h-[42px] font-body text-[13px] font-medium leading-[1.4]',
            isPurple || isDark ? 'text-white/80' : 'text-black/65'
          )}
        >
          {tier.tagline}
        </p>

        <div
          className={cn(
            'mt-5 border-t pt-5',
            isPurple || isDark ? 'border-white/15' : 'border-black/12'
          )}
        >
          <div className="font-display text-[20px] font-extrabold leading-[1.2]">{tier.setup}</div>
          <p
            className={cn(
              'mt-1 font-body text-xs font-semibold',
              isPurple || isDark ? 'text-white/70' : 'text-black/60'
            )}
          >
            {tier.ongoing}
          </p>
        </div>

        <ul className="mt-5 flex flex-col gap-2.5">
          {tier.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  isPurple || isDark ? 'text-white' : 'text-[#149d4f]'
                )}
              />
              <span
                className={cn(
                  'font-body text-[13px] font-medium leading-[1.45]',
                  isPurple || isDark ? 'text-white/85' : 'text-black/72'
                )}
              >
                {feature}
              </span>
            </li>
          ))}
        </ul>

        <div
          className={cn(
            'mt-6 rounded-md p-4',
            isPurple ? 'bg-white/10' : isDark ? 'bg-white/8' : 'bg-black/4'
          )}
        >
          <p
            className={cn(
              'font-body text-[12px] font-extrabold uppercase tracking-[0.12em]',
              isPurple || isDark ? 'text-white' : 'text-black'
            )}
          >
            Typical outcome:
          </p>
          <p
            className={cn(
              'mt-1.5 font-body text-[12px] font-medium leading-[1.5]',
              isPurple || isDark ? 'text-white/80' : 'text-black/68'
            )}
          >
            {tier.outcome}
          </p>

          <p
            className={cn(
              'mt-3 font-body text-[12px] font-extrabold uppercase tracking-[0.12em]',
              isPurple || isDark ? 'text-white' : 'text-black'
            )}
          >
            Ideal for:
          </p>
          <p
            className={cn(
              'mt-1.5 font-body text-[12px] font-medium leading-[1.5]',
              isPurple || isDark ? 'text-white/80' : 'text-black/68'
            )}
          >
            {tier.idealFor}
          </p>
        </div>

        {tier.footnote && (
          <p
            className={cn(
              'mt-4 font-body text-[11px] font-medium italic',
              isPurple || isDark ? 'text-white/70' : 'text-black/55'
            )}
          >
            {tier.footnote}
          </p>
        )}

        <div className="mt-auto pt-6">
          <button
            type="button"
            onClick={tier.variant === 'dark' ? handleBookCall : handleGetStarted}
            className={cn(
              'flex h-11 w-full items-center justify-center px-5 font-body text-[13px] font-semibold transition',
              isPurple && 'bg-white text-black hover:bg-white/90',
              isDark && 'border border-white bg-black text-white hover:bg-white/10',
              isLight && 'bg-black text-white hover:bg-black/85'
            )}
          >
            {tier.cta}
          </button>
        </div>
      </div>
    );
  };

  const toggleFaq = (index: number) => {
    setOpenFaqs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleGetStarted = () => openModal('create-account');
  const handleBookCall = () => openModal('book-session');

  return (
    <div className="flex w-full flex-col overflow-hidden bg-white text-[#050505]">
      {/* 1. HERO */}
      <section className="relative overflow-hidden px-6 pt-16 pb-24 sm:pt-20 sm:pb-28 lg:px-[100px] lg:pt-32 lg:pb-44 min-h-[520px] lg:min-h-[720px]">
        <div className="absolute inset-0">
          <img src={heroImage} alt="International property skyline" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1a]/85 via-[#0a0f1a]/70 to-[#0a0f1a]/85" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-[1140px] flex-col items-center text-center">
          <span className="rounded-full border border-white/35 bg-white/5 px-5 py-2 font-body text-[11px] font-semibold uppercase tracking-[0.22em] text-white/85 backdrop-blur-sm sm:text-xs">
            International Property Marketing
          </span>
          <h1 className="mt-6 font-display text-[40px] font-black leading-[1.0] tracking-[-1.2px] text-white sm:text-[64px] lg:text-[80px] lg:tracking-[-2.4px]">
            Your property.
            <br />
            The world's buyers.
          </h1>
          <p className="mt-6 max-w-[760px] font-body text-sm font-medium leading-[1.55] text-white/80 sm:text-base lg:text-lg">
            Havlo puts slow-to-sell UK properties in front of qualified international and offshore buyers across 30+ countries — using precision Meta advertising your local agent cannot replicate.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            {['30+ Countries Reached', '£500K Min. Property Value', '0% Commission On Sale'].map((badge) => (
              <span
                key={badge}
                className="rounded-full bg-white px-4 py-2 font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-black sm:text-[11px]"
              >
                {badge}
              </span>
            ))}
          </div>
          <button
            onClick={handleGetStarted}
            className="mt-8 h-12 rounded-full bg-[#ff8ce7] px-9 font-body text-sm font-extrabold uppercase tracking-[0.08em] text-black transition hover:bg-[#ff78df] sm:h-14 sm:text-[15px]"
          >
            Start My Relaunch Plan
          </button>
          <p className="mt-3 font-body text-[11px] font-medium text-white/75 sm:text-xs">
            No agent switch required • Works with your current listing
          </p>
        </div>

        <div className="absolute bottom-[-1px] left-0 right-0 z-20 h-[60px] pointer-events-none lg:h-[90px]">
          <HeroBackground showTop={true} showBottom={false} className="h-full w-full" />
        </div>
      </section>

      {/* 1b. Reviews Section */}
      <section className="w-full bg-white px-4 sm:px-10 lg:px-[100px] py-0 my-0">
        <AutoScrollReviews
          reviews={sellFasterReviews}
          bgColor="#F5F5F3"
          header={
            <>
              <h2 className="font-body text-[28px] lg:text-[36px] font-medium leading-none tracking-[-0.8px] text-[#040504]">Excellent</h2>
              <TrustpilotStars className="h-[28px] lg:h-[32px]" />
              <p className="font-body text-[14px] lg:text-[16px] font-normal text-black">
                Based on <span className="font-bold underline">{sellFasterReviews.length} reviews</span>
              </p>
            </>
          }
        />
      </section>

      {/* 2. THE PROBLEM */}
      <section className="bg-white px-6 py-14 lg:px-[100px] lg:py-[100px]">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px w-8 bg-black" />
              <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.22em] text-black/70">
                The problem
              </span>
            </div>
            <h2 className="max-w-[640px] font-display text-[32px] font-black leading-[1.0] tracking-[-0.8px] text-black sm:text-[44px] lg:text-[52px]">
              Your agent is only speaking to local buyers
            </h2>
            <p className="mt-5 max-w-[620px] font-body text-sm font-medium leading-[1.6] text-black/70 sm:text-base">
              Rightmove and Zoopla reach a fraction of the buyers who could purchase your property. The international market — expats, diaspora investors, overseas buyers — is largely invisible to traditional estate agents.
            </p>

            <div className="mt-9 flex flex-col border-t border-black/10">
              {problemPoints.map((point, index) => (
                <div
                  key={point.title}
                  className="grid gap-3 border-b border-black/10 py-6 sm:grid-cols-[42px_1fr]"
                >
                  <span className="font-display text-base font-black text-black">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="font-body text-base font-extrabold leading-[1.3] text-black">{point.title}</h3>
                    <p className="mt-2 font-body text-sm font-medium leading-[1.55] text-black/65">{point.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="self-start bg-[#ffd6f2] p-7 sm:p-9 lg:mt-24 lg:p-10">
            {problemStats.map((stat, index) => (
              <div key={stat.value} className={cn('py-7', index !== 0 && 'border-t border-black/15')}>
                <div className="font-display text-[42px] font-black leading-none tracking-[-1px] text-black sm:text-[54px]">
                  {stat.value}
                </div>
                <p className="mt-3 max-w-[340px] font-body text-sm font-semibold leading-[1.45] text-black/70">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section className="relative bg-[#a409d2] px-6 py-14 text-white lg:px-[100px] lg:py-[100px]">
        <div>
          <div className="mb-10 text-center lg:mb-14">
            <div className="mb-3 flex items-center justify-center gap-3">
              <span className="h-px w-8 bg-white/70" />
              <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/85">
                How it works
              </span>
              <span className="h-px w-8 bg-white/70" />
            </div>
            <h2 className="mx-auto max-w-[820px] font-display text-[30px] font-black leading-[1.05] tracking-[-0.8px] sm:text-[44px] lg:text-[52px]">
              From briefing to international enquiries in weeks
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {processSteps.map((step) => (
              <div
                key={step.step}
                className="flex min-h-[260px] flex-col bg-[#b51dde] p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] lg:p-7"
              >
                <div className="mb-7 flex h-9 w-9 items-center justify-center rounded-sm bg-white/20 font-display text-sm font-black text-white">
                  {step.step}
                </div>
                <h3 className="font-display text-[22px] font-black leading-[1.05] tracking-[-0.4px] text-white">
                  {step.title}
                </h3>
                <p className="mt-4 font-body text-sm font-medium leading-[1.55] text-white/80">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. CHOOSE YOUR REACH (TIERS) */}
      <section className="bg-white px-6 py-14 lg:px-[100px] lg:py-[100px]">
        <div>
          <div className="mb-10 max-w-[820px]">
            <h2 className="font-display text-[32px] font-black leading-[1.0] tracking-[-0.8px] text-black sm:text-[44px] lg:text-[52px]">
              Choose the level of buyer demand you want to create
            </h2>
            <p className="mt-4 max-w-[700px] font-body text-sm font-medium leading-[1.55] text-black/65 sm:text-base">
              Launch your property beyond the local market and generate qualified buyer demand globally.
            </p>
          </div>

          {/* Mobile: tabbed layout */}
          <div className="md:hidden">
            <div className="flex items-center gap-5 border-b border-black/10 overflow-x-auto no-scrollbar">
              {tiers.map((tier, index) => {
                const isActive = activeTierIndex === index;
                return (
                  <button
                    key={tier.name}
                    type="button"
                    onClick={() => setActiveTierIndex(index)}
                    className={cn(
                      'shrink-0 -mb-px border-b-2 pb-3 pt-2 font-body text-[15px] font-semibold transition-colors',
                      isActive
                        ? 'border-[#ff8ce7] text-black'
                        : 'border-transparent text-black/45 hover:text-black/70'
                    )}
                  >
                    {tier.name}
                  </button>
                );
              })}
            </div>
            <div className="mt-5">
              <div key={tiers[activeTierIndex].name}>
                {renderTierCard(tiers[activeTierIndex])}
              </div>
            </div>
          </div>

          {/* Desktop: grid layout */}
          <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
            {tiers.map((tier) => (
              <React.Fragment key={tier.name}>{renderTierCard(tier)}</React.Fragment>
            ))}
          </div>

          {/* Media investment notice */}
          <div className="mt-8 border-l-4 border-[#e8722e] bg-[#fbf4ef] px-6 py-6 sm:px-8 lg:px-10 lg:py-7">
            <h4 className="font-body text-base font-extrabold leading-[1.3] text-[#e8722e] sm:text-lg">
              Media Investment
            </h4>
            <p className="mt-3 font-body text-sm font-medium leading-[1.6] text-black/75 sm:text-[15px]">
              To activate global buyer demand, each campaign includes a dedicated exposure budget. This is allocated directly to premium media platforms to position your property in front of qualified international buyers.{' '}
              <span className="font-bold">Typical investment: £1,000 – £3,000 / month.</span>{' '}
              We advise on the optimal level based on your property, target markets, and desired speed of sale. Higher exposure typically results in increased buyer competition and faster enquiry velocity.
            </p>
            <div className="my-4 h-px w-full bg-black/10" />
            <p className="font-body text-sm font-medium leading-[1.6] text-black/75 sm:text-[15px]">
              To maintain campaign quality and performance, we onboard a limited number of properties each month.{' '}
              <span className="font-bold">Best suited for properties from £500,000+</span>
            </p>
          </div>
        </div>
      </section>

      {/* 5. WHY HAVLO VS TRADITIONAL */}
      <section className="bg-[#f9f9f8] px-6 py-14 lg:px-[100px] lg:py-[100px]">
        <div>
          <div className="mb-10 text-center lg:mb-12">
            <h2 className="font-display text-[30px] font-black leading-[1.05] tracking-[-0.8px] text-black sm:text-[42px] lg:text-[50px]">
              Why Havlo vs Traditional
              <br className="hidden sm:block" /> Property Portals
            </h2>
            <p className="mt-4 font-body text-sm font-medium leading-[1.55] text-black/65 sm:text-base">
              Most properties rely on passive listing platforms such as:
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 opacity-80 sm:gap-x-14">
              <img
                src="/portal-logos/rightmove.png"
                alt="Rightmove"
                className="h-9 w-auto object-contain sm:h-11"
                style={{ filter: 'invert(1)' }}
                loading="lazy"
              />
              <img
                src="/portal-logos/zoopla.png"
                alt="Zoopla"
                className="h-7 w-auto object-contain sm:h-8"
                loading="lazy"
              />
              <img
                src="/portal-logos/onthemarket.png"
                alt="OnTheMarket"
                className="h-7 w-auto object-contain sm:h-9"
                loading="lazy"
              />
            </div>
          </div>

          <div className="mx-auto grid max-w-[760px] gap-5 md:grid-cols-2">
            <div className="rounded-[28px] border-2 border-[#ff8ce7] bg-white p-6 sm:p-7 lg:p-8">
              <h3 className="font-body text-[18px] font-extrabold leading-none tracking-[-0.2px] text-black sm:text-[20px]">
                Traditional portals
              </h3>
              <ul className="mt-5 flex flex-col gap-3.5">
                {portalCons.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-[#e85b6f]" strokeWidth={3} />
                    <span className="font-body text-[13px] font-medium leading-[1.5] text-black/75 sm:text-sm">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[28px] border-2 border-[#7dd3e8] bg-white p-6 sm:p-7 lg:p-8">
              <h3 className="font-body text-[18px] font-extrabold leading-none tracking-[-0.2px] text-black sm:text-[20px]">
                Havlo
              </h3>
              <ul className="mt-5 flex flex-col gap-3.5">
                {havloPros.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#22c55e] text-white">
                      <Check className="h-2.5 w-2.5" strokeWidth={4} />
                    </span>
                    <span className="font-body text-[13px] font-medium leading-[1.5] text-black/80 sm:text-sm">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ */}
      <section className="bg-gradient-to-b from-[#FF8FDD] via-[#FFC78A] to-[#FFD85C] px-6 py-14 lg:px-[100px] lg:py-[100px]">
        <div>
          <div className="mb-9 text-center">
            <div className="mb-3 flex items-center justify-center gap-3">
              <span className="h-px w-8 bg-black" />
              <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.22em] text-black/70">
                Common questions
              </span>
              <span className="h-px w-8 bg-black" />
            </div>
            <h2 className="font-display text-[32px] font-black leading-none tracking-[-0.8px] text-black sm:text-[44px] lg:text-[52px]">
              Everything you need to know
            </h2>
          </div>

          <div className="divide-y divide-black/16 border-y border-black/16">
            {visibleFaqs.map((item, index) => {
              const isOpen = openFaqs.has(index);
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-5 py-6 text-left"
                  >
                    <span className="font-body text-base font-extrabold leading-[1.25] text-black sm:text-lg">
                      {item.q}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/10 text-black">
                      {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </span>
                  </button>
                  {isOpen && (
                    <p className="max-w-[920px] pb-6 pr-4 font-body text-sm font-medium leading-[1.65] text-black/70 sm:pr-12 sm:text-base">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {faqs.length > FAQ_INITIAL_VISIBLE && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => {
                  if (showAllFaqs) {
                    setShowAllFaqs(false);
                    setOpenFaqs((prev) => {
                      const next = new Set<number>();
                      prev.forEach((i) => {
                        if (i < FAQ_INITIAL_VISIBLE) next.add(i);
                      });
                      return next;
                    });
                  } else {
                    setShowAllFaqs(true);
                  }
                }}
                className="rounded-full bg-black px-9 py-3 font-body text-sm font-extrabold uppercase tracking-[0.08em] text-white transition hover:bg-black/85"
              >
                {showAllFaqs ? 'Close' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 7. FINAL CTA */}
      <section className="relative overflow-hidden bg-white px-6 py-16 text-center lg:px-[100px] lg:py-[100px]">
        <div className="absolute left-0 right-0 top-0 h-[80px] pointer-events-none">
          <HeroBackground showTop={true} showBottom={false} className="h-full w-full bg-[#ffe79a]" />
        </div>
        <div className="relative z-10 mx-auto mt-10 flex max-w-[820px] flex-col items-center">
          <h2 className="font-display text-[32px] font-black leading-[1.0] tracking-[-0.8px] text-black sm:text-[44px] lg:text-[56px]">
            Your buyer may not be in the UK.
          </h2>
          <p className="mt-5 max-w-[640px] font-body text-sm font-medium leading-[1.6] text-black/70 sm:text-base">
            Book a free 30-minute strategy call. We will tell you which markets are most likely to contain buyers for your property — and whether Havlo is the right fit. No obligation, no pressure.
          </p>
          <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <button
              onClick={handleGetStarted}
              className="h-12 w-full rounded-full bg-[#a409d2] px-7 font-body text-sm font-extrabold uppercase tracking-[0.08em] text-white transition hover:bg-[#9408bd] sm:w-auto sm:h-14"
            >
              Start My Relaunch Plan
            </button>
            <button
              onClick={handleBookCall}
              className="h-12 w-full rounded-full border border-black/20 bg-white px-7 font-body text-sm font-extrabold uppercase tracking-[0.08em] text-black transition hover:bg-black/5 sm:w-auto sm:h-14"
            >
              Book A Strategy Call
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

import React, { useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { HeroBackground } from '../components/shared/HeroBackground';
import { AutoScrollReviews } from '../components/shared/AutoScrollReviews';
import { useModal } from '../hooks/useModal';
import { cn } from '../lib/utils';
import heroImage from '../../Rectangle 5.png';

const problemPoints = [
  {
    title: 'Your ideal buyer may already be overseas—and never sees your listing',
    text: 'The right buyer could be an expat, investor, relocator, or international purchaser searching from another country.',
  },
  {
    title: 'Local portals create local visibility',
    text: 'Most listings sit on the same portals, in front of the same buyers, with little strategic reach beyond the UK market.',
  },
  {
    title: 'Long listings lose momentum',
    text: 'The longer a property stays online, the easier it is for buyers to assume something is wrong before they even enquire.',
  },
];

const problemStats = [
  { value: '£3,000+', label: 'average wasted on listing upgrades and repeat portal spend' },
  { value: '30+', label: 'international markets actively searching for UK property' },
  { value: '5x', label: 'stronger perceived reach with a structured relaunch campaign' },
];

const processSteps = [
  {
    step: '01',
    title: 'Listing Analysis & Strategy',
    text: 'We review your property, current listing, price position, buyer profile, and the reason your campaign has slowed down.',
  },
  {
    step: '02',
    title: 'Reposition & Creative Upgrade',
    text: 'We rebuild the marketing angle, sharpen the message, and prepare your property for international buyer attention.',
  },
  {
    step: '03',
    title: 'International Distribution',
    text: 'Your home is promoted beyond local portals through targeted exposure, partner routes, and international buyer channels.',
  },
  {
    step: '04',
    title: 'Buyer Enquiries & Optimisation',
    text: 'You receive clearer insight into performance, buyer response, and the next actions needed to keep momentum alive.',
  },
];

const tiers = [
  {
    name: 'Global',
    price: '£2,000 setup',
    monthlyPrice: 'then £1,500 / month',
    description: 'Targeted exposure in three key international markets most likely to convert for your property.',
    features: ['3 regions of your choice', 'Static + carousel ads', 'Lead capture form', 'Bi-weekly performance report', '3-month minimum'],
    accent: 'white',
    tag: '3 REGIONS',
  },
  {
    name: 'Global+',
    price: '£3,500 setup',
    monthlyPrice: 'then £2,500 / month',
    description: 'Broader reach with richer creative and a dedicated landing page for serious international buyers.',
    features: ['5 regions of your choice', 'Static, carousel + short-form video', 'Dedicated property landing page', 'Weekly performance report', '3-month minimum'],
    accent: 'purple',
    badge: 'MOST POPULAR',
    tag: '5 REGIONS',
  },
  {
    name: 'Worldwide',
    price: '£5,000 setup',
    monthlyPrice: 'then £3,500 / month',
    description: 'Maximum global exposure for properties that need the widest possible international audience.',
    features: ['30+ countries worldwide', 'Full creative suite - static, carousel + video', 'Dedicated property landing page', 'Weekly report + monthly strategy call', 'Rolling monthly after 3 months'],
    accent: 'white',
    tag: '30+ COUNTRIES',
  },
  {
    name: 'Private Client',
    price: '£5,000 setup',
    monthlyPrice: 'then £3,500 / month',
    description: 'For high-value properties that demand a campaign built entirely around them. Pricing tailored to scope - discussed privately.',
    features: ['Bespoke worldwide targeting strategy', 'Premium creative production', 'Dedicated account manager', 'Weekly strategy calls', 'Pricing discussed privately'],
    accent: 'black',
    tag: 'BESPOKE',
  },
];

const faqs = [
  {
    q: 'Do I still need my estate agent?',
    a: 'Yes - and you keep them. Havlo works alongside your existing agent, not instead of them. We open up international buyer markets your agent cannot reach through portals alone. Viewings, negotiations, and the sale itself are handled through your agent and solicitor as normal.',
  },
  {
    q: 'What does month 1 look like financially?',
    a: 'Month 1 includes the one-time setup fee alongside your first monthly management fee — it is the most investment-heavy month. From month 2 onwards you only pay the monthly management fee, plus your ad spend directly to Meta.',
  },
  {
    q: 'Which plan is right for my property?',
    a: 'Choose based on the reach you want, not the value of your property. Not sure? We will recommend the right plan on your free strategy call - there is no obligation to proceed and no pressure to commit.',
  },
  {
    q: 'Why is ad spend separate from your fees?',
    a: 'Your advertising budget goes directly from your account to Meta. Havlo never touches that money. This means full transparency — you can see every pound spent in real time - and we take no margin on your ad spend whatsoever.',
  },
  {
    q: 'Can I continue beyond the minimum term?',
    a: 'Yes. All plans roll monthly after the minimum term. You can pause or stop with 30 days notice once the minimum period is complete.',
  },
  {
    q: 'Do you charge a commission when the property sells?',
    a: 'No. Havlo charges fixed management fees only. We are a marketing service, not an estate agent. There is no commission, no referral fee, and no percentage of the sale price - ever.',
  },
];

const relaunchReviews = [
  { title: 'Finally sold after months of no progress', content: 'Our property had been on the market for over 6 months with very little interest. Havlo Relaunch completely changed that and brought in serious buyers.', author: 'Ben, Reading' },
  { title: 'A real turnaround for our listing', content: 'We had almost given up after months of no offers. The relaunch strategy worked, and we finally secured a buyer.', author: 'Claire, Sheffield' },
  { title: 'Exactly what we needed after 6+ months', content: 'Havlo helped reposition our property and attract a completely new audience. The difference was immediate.', author: 'Marcus, Liverpool' },
  { title: 'Sold after being stuck for nearly a year', content: 'Our house had been listed for close to a year with no success. Havlo Relaunch gave it new life and helped us finally move forward.', author: 'Fiona, Oxford' },
  { title: 'New strategy, real results', content: 'The relaunch approach made all the difference. Better marketing, better positioning, and much stronger enquiries.', author: 'Ryan, Newcastle' },
  { title: 'From no interest to serious offers', content: 'We went from barely any viewings to genuine offers after using Havlo. The international exposure really worked.', author: 'Priya, Leicester' },
  { title: 'Helped us break through a stagnant market', content: 'Our property had gone stale on the market. Havlo Relaunch brought in fresh demand and the right kind of buyers.', author: 'Gareth, Cardiff' },
  { title: 'Professional and highly effective', content: 'The team clearly understood why our property wasn\'t selling and fixed it. We saw results much faster than expected.', author: 'Nadia, Abu Dhabi' },
  { title: 'Great solution for slow-moving properties', content: 'If your property has been sitting unsold, this service is exactly what you need. It helped us secure a buyer after months of frustration.', author: 'Lewis, Glasgow' },
  { title: 'A fresh start that worked', content: 'Havlo gave our listing a proper relaunch with a clear strategy. It attracted new interest and ultimately led to a successful sale.', author: 'Sanjay, Slough' },
];

export const Marketing: React.FC = () => {
  const { openModal } = useModal();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleGetStarted = () => openModal('create-account');

  return (
    <div className="flex w-full flex-col overflow-hidden bg-white text-[#050505]">
      <section className="relative min-h-[420px] overflow-hidden px-4 pb-24 pt-24 sm:min-h-[507px] sm:px-6 lg:min-h-[608px] lg:px-[100px] lg:pb-36 lg:pt-32">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Modern property skyline" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#07131b]/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/55" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-[920px] flex-col items-center text-center">
          <h1 className="mt-4 font-display text-[38px] font-black leading-[0.95] tracking-[-1px] text-white sm:text-[58px] lg:text-[72px] lg:tracking-[-2px]">
            Property Isn't Selling. The Right Buyers Haven't Seen It.
          </h1>
          <p className="mt-5 max-w-[620px] font-body text-sm font-medium leading-[1.55] text-white/85 sm:text-base lg:text-lg">
            We relaunch slow-to-sell properties using targeted international exposure and high-performance campaigns—so you attract serious buyers and close faster.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {[
              '30+ Countries Reached',
              '£500K Min. Property Value',
              '0% Commission on Sale',
            ].map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-white/40 px-5 py-2 font-body text-[11px] font-extrabold uppercase tracking-[0.18em] backdrop-blur-sm sm:text-xs text-[#000000] bg-[#ffffff]"
              >
                {badge}
              </span>
            ))}
          </div>
          <div className="mt-7 flex w-full max-w-[680px] flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={handleGetStarted}
              className="h-12 w-full rounded-full bg-[#ff8ce7] px-9 font-body text-sm font-extrabold uppercase tracking-[0.08em] text-black transition hover:bg-[#ff78df] sm:w-auto"
            >
              Start My Relaunch Plan
            </button>
          </div>
          <p className="mt-2 font-body text-xs font-medium text-white/85">
            No agent switch required • Works with your current listing
          </p>
        </div>

        <div className="absolute bottom-[-1px] left-0 right-0 z-20 h-[74px] pointer-events-none lg:h-[98px]">
          <HeroBackground showTop={true} showBottom={false} className="h-full w-full" />
        </div>
      </section>

      <section className="w-full bg-white px-4 pt-2.5 sm:px-6 lg:px-[100px]">
        <AutoScrollReviews reviews={relaunchReviews} bgColor="#F5F5F3" />
      </section>

      <section className="bg-white px-4 py-[60px] sm:px-6 lg:px-[100px] lg:py-[84px]">
        <div className="mx-auto grid max-w-[1240px] gap-9 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px w-8 bg-black" />
              <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.22em] text-black/70">The problem</span>
            </div>
            <h2 className="max-w-[720px] font-display text-[34px] font-black leading-[0.98] tracking-[-0.8px] text-black sm:text-[48px] lg:text-[58px]">
              Your agent is only reaching a fraction of the market.
            </h2>
            <p className="mt-5 max-w-[640px] font-body text-sm font-semibold leading-[1.6] text-black/65 sm:text-base">
              Most property campaigns are built around local portals, local databases, and the same audience everyone else is targeting.
            </p>
            <div className="mt-9 flex flex-col border-y border-black/10">
              {problemPoints.map((point, index) => (
                <div key={point.title} className="grid gap-3 border-b border-black/10 py-6 last:border-b-0 sm:grid-cols-[48px_1fr]">
                  <span className="font-display text-sm font-black text-black/35">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="font-body text-base font-extrabold text-black">{point.title}</h3>
                    <p className="mt-2 font-body text-sm font-medium leading-[1.55] text-black/65">{point.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="self-end bg-[#ffd6f2] p-7 sm:p-9 lg:mb-3 lg:p-10">
            {problemStats.map((stat, index) => (
              <div key={stat.value} className={cn('py-7', index !== 0 && 'border-t border-black/10')}>
                <div className="font-display text-[46px] font-black leading-none tracking-[-1.2px] text-black sm:text-[58px]">{stat.value}</div>
                <p className="mt-3 max-w-[360px] font-body text-sm font-bold leading-[1.45] text-black/70">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative bg-[#a409d2] px-4 py-[68px] text-white sm:px-6 lg:px-[100px] lg:py-[84px]">
        <div className="mx-auto max-w-[1240px]">
          <div className="mb-8 text-center lg:mb-11">
            <div className="mb-3 flex items-center justify-center gap-3">
              <span className="h-px w-8 bg-white/80" />
              <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/80">The process</span>
              <span className="h-px w-8 bg-white/80" />
            </div>
            <h2 className="font-display text-[31px] font-black leading-[1.02] tracking-[-0.8px] sm:text-[46px] lg:text-[58px]">
              From brief to international enquiries in weeks.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {processSteps.map((step) => (
              <div key={step.step} className="min-h-[245px] bg-[#b51dde] p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] lg:p-7">
                <div className="mb-7 flex h-8 w-8 items-center justify-center rounded-sm bg-white/20 font-display text-sm font-black text-white">{step.step}</div>
                <h3 className="font-display text-[24px] font-black leading-[1] tracking-[-0.4px] text-white">{step.title}</h3>
                <p className="mt-4 font-body text-sm font-medium leading-[1.5] text-white/78">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-[68px] sm:px-6 lg:px-[100px] lg:py-[84px]">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-10 max-w-[760px]">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px w-8 bg-black" />
              <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.22em] text-black/70">Our packages</span>
            </div>
            <h2 className="font-display text-[34px] font-black leading-[0.98] tracking-[-0.8px] text-black sm:text-[48px] lg:text-[58px]">Choose your reach</h2>
            <p className="mt-4 max-w-[660px] font-body text-sm font-semibold leading-[1.55] text-black/65 sm:text-base">
              Select a relaunch level based on your property value, campaign urgency, and the amount of international exposure you want.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {tiers.map((tier) => {
              const isPurple = tier.accent === 'purple';
              const isBlack = tier.accent === 'black';
              return (
                <div
                  key={tier.name}
                  className={cn(
                    'relative flex min-h-[520px] flex-col p-6 lg:p-7',
                    isPurple && 'bg-[#a409d2] text-white',
                    isBlack && 'bg-black text-white',
                    !isPurple && !isBlack && 'border border-black/15 bg-white text-black'
                  )}
                >
                  {tier.badge && (
                    <div className="absolute right-5 top-5 rounded-full bg-white px-3 py-1 font-body text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#a409d2]">
                      {tier.badge}
                    </div>
                  )}
                  <span className={cn('font-body text-[11px] font-extrabold uppercase tracking-[0.2em]', isPurple || isBlack ? 'text-white/70' : 'text-black/55')}>
                    {tier.tag}
                  </span>
                  <h3 className="mt-3 font-display text-[30px] font-black leading-none tracking-[-0.6px]">{tier.name}</h3>
                  <p className={cn('mt-4 min-h-[62px] font-body text-sm font-semibold leading-[1.5]', isPurple || isBlack ? 'text-white/75' : 'text-black/62')}>
                    {tier.description}
                  </p>
                  <div className="mt-7 border-t border-current/15 pt-6">
                    <div className="font-display text-[42px] font-black leading-none tracking-[-1px]">{tier.price}</div>
                    <p className={cn('mt-2 font-body text-xs font-bold', isPurple || isBlack ? 'text-white/60' : 'text-black/55')}>{tier.monthlyPrice}</p>
                  </div>
                  <div className="mt-7 flex flex-1 flex-col gap-3">
                    {tier.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2">
                        <Check className={cn('mt-0.5 h-4 w-4 shrink-0', isPurple || isBlack ? 'text-white' : 'text-[#149d4f]')} />
                        <span className={cn('font-body text-sm font-semibold leading-[1.45]', isPurple || isBlack ? 'text-white/78' : 'text-black/68')}>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={handleGetStarted}
                    className={cn(
                      'mt-8 h-12 rounded-full px-5 font-body text-sm font-extrabold uppercase',
                      isPurple || isBlack ? 'bg-white text-black hover:bg-white/90' : 'bg-black text-white hover:bg-black/90'
                    )}
                  >
                    GET STARTED
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-b from-[#FF8FDD] via-[#FFC78A] to-[#FFD85C] px-4 py-[68px] sm:px-6 lg:px-[100px] lg:py-[84px]">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-9">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px w-8 bg-black" />
              <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.22em] text-black/65">Common questions</span>
            </div>
            <h2 className="font-display text-[34px] font-black leading-none tracking-[-0.8px] text-black sm:text-[48px] lg:text-[58px]">Everything you need to know</h2>
          </div>

          <div className="divide-y divide-black/16 border-y border-black/16">
            {faqs.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-5 py-6 text-left"
                  >
                    <span className="font-body text-base font-extrabold leading-[1.25] text-black sm:text-lg">{item.q}</span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/10 text-black">
                      {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </span>
                  </button>
                  {isOpen && <p className="max-w-[920px] pb-6 pr-12 font-body text-sm font-semibold leading-[1.65] text-black/68 sm:text-base">{item.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-white px-4 py-[68px] text-center sm:px-6 lg:px-[100px] lg:py-[84px]">
        <div className="absolute left-0 right-0 top-0 h-[90px] pointer-events-none">
          <HeroBackground showTop={true} showBottom={false} className="h-full w-full bg-[#ffe79a]" />
        </div>
        <div className="relative z-10 mx-auto mt-10 flex max-w-[760px] flex-col items-center">
          <h2 className="font-display text-[34px] font-black leading-[0.98] tracking-[-0.8px] text-black sm:text-[48px] lg:text-[64px]">Stop Waiting for Buyers. Start Reaching Them.</h2>
          <p className="mt-4 max-w-[600px] font-body text-sm font-semibold leading-[1.6] text-black/65 sm:text-base">
            Relaunch your property with targeted exposure designed to attract serious, qualified buyers.
          </p>
          <div className="mt-7 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <button onClick={handleGetStarted} className="h-12 rounded-full bg-[#a409d2] px-7 font-body text-sm font-extrabold uppercase text-white hover:bg-[#9408bd]">
              Start My Relaunch Plan
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

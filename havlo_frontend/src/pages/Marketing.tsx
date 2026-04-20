import React, { useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { HeroBackground } from '../components/shared/HeroBackground';
import { useModal } from '../hooks/useModal';
import { cn } from '../lib/utils';
import heroImage from '../../Rectangle 5.png';

const problemPoints = [
  {
    title: 'Your buyer may not be local',
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
    title: 'Discover call',
    text: 'We review your property, current listing, price position, buyer profile, and the reason your campaign has slowed down.',
  },
  {
    step: '02',
    title: 'Campaign setup',
    text: 'We rebuild the marketing angle, sharpen the message, and prepare your property for international buyer attention.',
  },
  {
    step: '03',
    title: 'Relaunch & reach',
    text: 'Your home is promoted beyond local portals through targeted exposure, partner routes, and international buyer channels.',
  },
  {
    step: '04',
    title: 'Enquiries & report',
    text: 'You receive clearer insight into performance, buyer response, and the next actions needed to keep momentum alive.',
  },
];

const tiers = [
  {
    name: 'Global',
    price: '£2,000',
    description: 'For homes that need a sharper international relaunch.',
    features: ['Audit of current listing', 'International positioning review', 'Campaign copy refresh', 'Buyer-market targeting', 'Monthly report'],
    accent: 'white',
  },
  {
    name: 'Global+',
    price: '£3,000',
    description: 'For sellers who want stronger reach and more active promotion.',
    features: ['Everything in Global', 'Priority international targeting', 'Buyer network exposure', 'Enhanced campaign assets', 'Fortnightly review call'],
    accent: 'purple',
    badge: 'Most popular',
  },
  {
    name: 'Worldwide',
    price: '£5,000',
    description: 'For high-value properties needing broader global exposure.',
    features: ['Everything in Global+', 'Multi-market distribution', 'Partner agency outreach', 'Advanced campaign reporting', 'Dedicated strategist'],
    accent: 'white',
  },
  {
    name: 'Private Client',
    price: '£8,000',
    description: 'For prime homes requiring a discreet, senior-led campaign.',
    features: ['Everything in Worldwide', 'Discreet buyer introductions', 'Private client positioning', 'Senior advisory support', 'Bespoke relaunch plan'],
    accent: 'black',
  },
];

const faqs = [
  {
    q: 'Can you help if my home has already been listed for months?',
    a: 'Yes. Havlo Relaunch is designed specifically for properties that have lost momentum and need a refreshed route to serious buyers.',
  },
  {
    q: 'Will this replace my estate agent?',
    a: 'No. Havlo works alongside your existing agent by adding international reach, strategic positioning, and buyer-market exposure.',
  },
  {
    q: 'What type of property is suitable?',
    a: 'We support a range of homes, but the service is strongest where the property needs better positioning, wider reach, or a more targeted buyer strategy.',
  },
  {
    q: 'Why is international exposure important?',
    a: 'Many motivated buyers are not searching locally. Expats, investors, and relocators may be the right match but never see a UK-only listing campaign.',
  },
  {
    q: 'Can I continue to use my current agent?',
    a: 'Yes. You can keep your current agent while Havlo adds an additional strategic layer to support the sale.',
  },
  {
    q: 'Do you charge commission after the property sells?',
    a: 'No. Packages are structured as campaign fees, so you know the cost before work begins.',
  },
];

export const Marketing: React.FC = () => {
  const { openModal } = useModal();
  const navigate = useNavigate();
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
          <span className="font-body text-[10px] font-extrabold uppercase tracking-[0.28em] text-white/80 sm:text-xs">
            International Property Marketing
          </span>
          <h1 className="mt-4 font-display text-[44px] font-black leading-[0.92] tracking-[-1px] text-white sm:text-[70px] lg:text-[94px] lg:tracking-[-2px]">
            Your property.
            <br />
            The world's buyers.
          </h1>
          <p className="mt-5 max-w-[620px] font-body text-sm font-medium leading-[1.55] text-white/85 sm:text-base lg:text-lg">
            Havlo puts slow-to-sell UK properties in front of qualified international and offshore buyers across 30+ countries — using precision Meta advertising your local agent cannot replicate.
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
              Get Started
            </button>
          </div>
        </div>

        <div className="absolute bottom-[-1px] left-0 right-0 z-20 h-[74px] pointer-events-none lg:h-[98px]">
          <HeroBackground showTop={true} showBottom={false} className="h-full w-full" />
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 lg:px-[100px] lg:py-20">
        <div className="mx-auto grid max-w-[1240px] gap-9 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px w-8 bg-black" />
              <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.22em] text-black/70">The problem</span>
            </div>
            <h2 className="max-w-[720px] font-display text-[34px] font-black leading-[0.98] tracking-[-0.8px] text-black sm:text-[48px] lg:text-[58px]">
              Your agent is only speaking to local buyers.
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

      <section className="relative bg-[#a409d2] px-4 py-16 text-white sm:px-6 lg:px-[100px] lg:py-20">
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

      <section className="bg-white px-4 py-16 sm:px-6 lg:px-[100px] lg:py-20">
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
                    Havlo Relaunch™
                  </span>
                  <h3 className="mt-3 font-display text-[30px] font-black leading-none tracking-[-0.6px]">{tier.name}</h3>
                  <p className={cn('mt-4 min-h-[62px] font-body text-sm font-semibold leading-[1.5]', isPurple || isBlack ? 'text-white/75' : 'text-black/62')}>
                    {tier.description}
                  </p>
                  <div className="mt-7 border-t border-current/15 pt-6">
                    <div className="font-display text-[42px] font-black leading-none tracking-[-1px]">{tier.price}</div>
                    <p className={cn('mt-2 font-body text-xs font-bold', isPurple || isBlack ? 'text-white/60' : 'text-black/55')}>one-off campaign fee</p>
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
                    Get started
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-b from-[#ffb0e8] via-[#ffc4e7] to-[#ffe79a] px-4 py-16 sm:px-6 lg:px-[100px] lg:py-20">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-9">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px w-8 bg-black" />
              <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.22em] text-black/65">FAQs</span>
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

      <section className="relative overflow-hidden bg-white px-4 py-16 text-center sm:px-6 lg:px-[100px] lg:py-20">
        <div className="absolute left-0 right-0 top-0 h-[90px] pointer-events-none">
          <HeroBackground showTop={true} showBottom={false} className="h-full w-full bg-[#ffe79a]" />
        </div>
        <div className="relative z-10 mx-auto mt-10 flex max-w-[760px] flex-col items-center">
          <h2 className="font-display text-[34px] font-black leading-[0.98] tracking-[-0.8px] text-black sm:text-[48px] lg:text-[64px]">Your buyer may not be in the UK.</h2>
          <p className="mt-4 max-w-[600px] font-body text-sm font-semibold leading-[1.6] text-black/65 sm:text-base">
            Build a relaunch campaign that reaches the buyer your current listing may never find.
          </p>
          <div className="mt-7 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <button onClick={handleGetStarted} className="h-12 rounded-full bg-[#a409d2] px-7 font-body text-sm font-extrabold uppercase text-white hover:bg-[#9408bd]">
              Get started today
            </button>
            <button onClick={() => navigate('/contact')} className="h-12 rounded-full border border-black/25 bg-white px-7 font-body text-sm font-extrabold uppercase text-black hover:bg-black/5">
              Book a strategy call
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

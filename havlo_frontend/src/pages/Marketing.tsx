import React, { useState, useEffect, useRef } from 'react';
import { Check, Minus, Plus, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HeroBackground } from '../components/shared/HeroBackground';
import { AutoScrollReviews } from '../components/shared/AutoScrollReviews';
import { TrustpilotStars } from '../components/ui/TrustpilotStars';
import { useModal } from '../hooks/useModal';
import { cn } from '../lib/utils';
import heroImage from '../../Rectangle 5.png';
import { usePageMeta } from '../hooks/usePageMeta';
import { api } from '../lib/api';
import { CountryCodeSelect } from '../components/shared/CountryCodeSelect';

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
    title: 'Your ideal buyer may already be overseas—and never sees your listing',
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
    title: 'Listing Analysis & Strategy',
    text: 'We learn about your property, your timeline, and the buyer markets most likely to convert. We recommend the right plan and target regions for your specific situation.',
  },
  {
    step: '02',
    title: 'Reposition & Creative Upgrade',
    text: 'We build your Meta campaign from scratch — creative, audience targeting, lead capture, and tracking. Your ad spend goes directly to Meta from your account.',
  },
  {
    step: '03',
    title: 'International Distribution',
    text: 'Your campaign goes live across the chosen international markets. Qualified buyers begin discovering your property within days, not months.',
  },
  {
    step: '04',
    title: 'Buyer Enquiries & Optimisation',
    text: 'We continuously refine targeting and creative based on live performance data, and send you transparent reports on enquiries, engagement and demand.',
  },
];

const ASSESS_LOADING_MSGS = [
  'Fetching property details…',
  'Analysing listing performance…',
  'Identifying barriers to buyer interest…',
  'Evaluating pricing and market conditions…',
  'Preparing your personalised assessment…',
];

const STORAGE_PREFIX = 'havlo:assess:';


const portalCons = [
  'Listings go stale over time, losing visibility and momentum',
  'Relies on the same pool of active buyers who have already seen the property',
  'Price reductions become the only lever to generate interest',
  '"Seen it before" effect kills buyer engagement',
  'Competes directly with newer, more attractive listings',
  'Limited control—wait and hope for enquiries',
  'Vendors lose confidence when properties sit unsold',
  'Agents risk losing instructions on slow-moving stock',
  'Exposure declines over time in portal algorithms',
  'Reactive approach: respond to demand that may never come',
];

const havloPros = [
  'Relaunches stale properties with fresh campaigns that reignite interest',
  'Targets new audiences who haven\'t seen or considered the property before',
  'Generates demand without immediately cutting price',
  'Repositions the property as a new opportunity, not old stock',
  'Creates a standout campaign that separates it from portal noise',
  'Proactive outreach that drives enquiries on demand',
  'Demonstrates a clear action plan, restoring vendor confidence',
  'Helps agents retain instructions and recover deals',
  'Fresh visibility across multiple channels—not just portals',
  'Strategic approach: create demand where none exists',
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

  useModal();
  const navigate = useNavigate();
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(() => new Set([0]));
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const visibleFaqs = showAllFaqs ? faqs : faqs.slice(0, FAQ_INITIAL_VISIBLE);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inputMode, setInputMode] = useState<'url' | 'address'>('url');
  const [propertyUrl, setPropertyUrl] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [propertyTitle, setPropertyTitle] = useState('');
  const [propertyPrice, setPropertyPrice] = useState('');
  const [propertyBedrooms, setPropertyBedrooms] = useState('');
  const [propertyDescription, setPropertyDescription] = useState('');
  const [propertyListingLink, setPropertyListingLink] = useState('');
  const [propertyImageUrl, setPropertyImageUrl] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('+44');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [error, setError] = useState('');
  const loadingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (loading) {
      setLoadingMsg(0);
      loadingTimer.current = setInterval(() => {
        setLoadingMsg((prev) => {
          if (prev < ASSESS_LOADING_MSGS.length - 1) return prev + 1;
          clearInterval(loadingTimer.current!);
          return prev;
        });
      }, 4000);
    } else {
      if (loadingTimer.current) clearInterval(loadingTimer.current);
    }
    return () => { if (loadingTimer.current) clearInterval(loadingTimer.current); };
  }, [loading]);

  const handleAssessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (inputMode === 'url' && !propertyUrl.trim()) { setError('Please enter a property listing URL.'); return; }
    if (inputMode === 'address' && !propertyAddress.trim()) { setError('Please enter a property address.'); return; }
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!phone.trim()) { setError('Please enter your phone number.'); return; }

    setLoading(true);
    try {
      const result = await api.publicPropertyAssess({
        property_url: inputMode === 'url' ? propertyUrl.trim() : undefined,
        property_address: inputMode === 'address' ? propertyAddress.trim() : undefined,
        email: email.trim(),
        phone: phone.trim(),
        phone_country_code: phoneCode,
        ...(inputMode === 'address' && {
          property_title: propertyTitle.trim() || undefined,
          property_price: propertyPrice.trim() || undefined,
          property_bedrooms: propertyBedrooms.trim() || undefined,
          property_description: propertyDescription.trim() || undefined,
          property_listing_link: propertyListingLink.trim() || undefined,
          property_image_url: propertyImageUrl.trim() || undefined,
        }),
      });
      localStorage.setItem(STORAGE_PREFIX + result.session_id, JSON.stringify(result));
      setDrawerOpen(false);
      navigate(`/sell-your-property/report?s=${result.session_id}`);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleGetStarted = () => setDrawerOpen(true);

  return (
    <>
    <div className="flex w-full flex-col overflow-hidden bg-white text-[#050505]">
      {/* 1. HERO */}
      <section className="relative overflow-hidden px-6 pt-16 pb-24 sm:pt-20 sm:pb-28 lg:px-[100px] lg:pt-32 lg:pb-44 min-h-[520px] lg:min-h-[720px]">
        <div className="absolute inset-0">
          <img src={heroImage} alt="International property skyline" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1a]/85 via-[#0a0f1a]/70 to-[#0a0f1a]/85" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-[1140px] flex-col items-center text-center">
          <h1 className="font-display text-[40px] font-black leading-[1.0] tracking-[-1.2px] text-white sm:text-[64px] lg:text-[80px] lg:tracking-[-2.4px]">
            Property Isn't Selling.
            <br />
            The Right Buyers Haven't Seen It.
          </h1>
          <p className="mt-6 max-w-[760px] font-body text-sm font-medium leading-[1.55] text-white/80 sm:text-base lg:text-lg">
            We relaunch slow-to-sell properties using targeted international exposure and high-performance campaigns—so you attract serious buyers and close faster.
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
            Assess My Property
          </button>
          <p className="mt-3 font-body text-[11px] font-medium text-white/75 sm:text-xs">
            Free assessment • No commitment required
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
              <span className="font-body font-extrabold uppercase tracking-[0.22em] text-black/70 text-[11px] lg:text-[20px]">
                The problem
              </span>
            </div>
            <h2 className="max-w-[640px] font-display text-[32px] font-black leading-[1.0] tracking-[-0.8px] text-black sm:text-[44px] lg:text-[52px]">
              Your agent is only reaching a fraction of the market..
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
            <div className="mt-6 flex items-center justify-center">
              <img
                src="/portal-logos/portal-logos-grey.png"
                alt="Rightmove, Zoopla, OnTheMarket"
                className="h-7 w-auto max-w-full object-contain sm:h-9"
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

          <p className="mt-10 text-center font-body text-base font-medium leading-[1.6] text-black/65 sm:text-lg">
            Portals are where properties go to be seen.<br />
            Havlo is how you get them sold—especially when they're not moving.
          </p>
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
                {showAllFaqs ? 'Read less' : 'Read more'}
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
            Your buyer isn't limited to the UK.
          </h2>
          <p className="mt-5 max-w-[640px] font-body text-sm font-medium leading-[1.6] text-black/70 sm:text-base">
            Instantly discover where your buyers are and start generating international demand for your property — no calls, no pressure.
          </p>
          <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <button
              onClick={handleGetStarted}
              className="h-12 w-full rounded-full bg-[#a409d2] px-7 font-body text-sm font-extrabold uppercase tracking-[0.08em] text-white transition hover:bg-[#9408bd] sm:w-auto sm:h-14"
            >
              Assess My Property
            </button>
          </div>
        </div>
      </section>
    </div>

    {/* ── Assessment Drawer ── */}
    {drawerOpen && (
      <div className="fixed inset-0 z-50 flex">
        {/* Backdrop */}
        <div
          className="flex-1 bg-black/50 backdrop-blur-sm"
          onClick={() => !loading && setDrawerOpen(false)}
        />
        {/* Panel */}
        <div className="relative flex w-full max-w-[480px] flex-col bg-white shadow-2xl overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/8 px-6 py-5">
            <div>
              <h2 className="font-display text-[20px] font-black leading-tight text-black">Assess My Property</h2>
              <p className="mt-0.5 font-body text-[13px] text-black/55">Get your free AI-powered property assessment</p>
            </div>
            {!loading && (
              <button onClick={() => setDrawerOpen(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/6 hover:bg-black/10 transition-colors">
                <X className="h-4 w-4 text-black" />
              </button>
            )}
          </div>

          {loading ? (
            /* Loading state */
            <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 text-center">
              <div className="h-14 w-14 animate-spin rounded-full border-4 border-black/8 border-t-[#a409d2]" />
              <p className="mt-6 font-body text-[15px] font-semibold text-black min-h-[24px] transition-all duration-500">
                {ASSESS_LOADING_MSGS[loadingMsg]}
              </p>
              <div className="mt-5 w-full max-w-[280px] overflow-hidden rounded-full bg-black/8 h-1.5">
                <div
                  className="h-full rounded-full bg-[#a409d2] transition-all duration-[3800ms] ease-linear"
                  style={{ width: `${((loadingMsg + 1) / ASSESS_LOADING_MSGS.length) * 100}%` }}
                />
              </div>
              <p className="mt-4 font-body text-[12px] text-black/40">This usually takes 20–40 seconds</p>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleAssessSubmit} className="flex flex-1 flex-col gap-5 px-6 py-7">
              {/* Input mode toggle */}
              <div>
                <div className="mb-3 flex items-center gap-1 rounded-lg bg-black/5 p-1">
                  {(['url', 'address'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setInputMode(mode)}
                      className={cn(
                        'flex-1 rounded-md py-2 font-body text-[13px] font-semibold transition-all',
                        inputMode === mode ? 'bg-white text-black shadow-sm' : 'text-black/50 hover:text-black/70'
                      )}
                    >
                      {mode === 'url' ? 'Listing URL' : 'Property Address'}
                    </button>
                  ))}
                </div>
                {inputMode === 'url' ? (
                  <div>
                    <label className="mb-1.5 block font-body text-[13px] font-semibold text-black">Property Listing URL</label>
                    <input
                      type="url"
                      placeholder="https://www.rightmove.co.uk/properties/..."
                      value={propertyUrl}
                      onChange={(e) => setPropertyUrl(e.target.value)}
                      className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 font-body text-sm text-black placeholder-black/35 focus:border-[#a409d2] focus:outline-none"
                    />
                    <p className="mt-1.5 font-body text-[11px] text-black/45">Paste your Rightmove, Zoopla, or OnTheMarket listing URL</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block font-body text-[13px] font-semibold text-black">Property title</label>
                      <input
                        type="text"
                        placeholder="e.g. 4-bed detached house, Bristol"
                        value={propertyTitle}
                        onChange={(e) => setPropertyTitle(e.target.value)}
                        className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 font-body text-sm text-black placeholder-black/35 focus:border-[#a409d2] focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block font-body text-[13px] font-semibold text-black">Listed price</label>
                        <input
                          type="text"
                          placeholder="e.g. £875,000"
                          value={propertyPrice}
                          onChange={(e) => setPropertyPrice(e.target.value)}
                          className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 font-body text-sm text-black placeholder-black/35 focus:border-[#a409d2] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block font-body text-[13px] font-semibold text-black">Bedrooms</label>
                        <input
                          type="text"
                          placeholder="e.g. 4"
                          value={propertyBedrooms}
                          onChange={(e) => setPropertyBedrooms(e.target.value)}
                          className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 font-body text-sm text-black placeholder-black/35 focus:border-[#a409d2] focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block font-body text-[13px] font-semibold text-black">Property Address</label>
                      <input
                        type="text"
                        placeholder="e.g. 12 Oak Road, London, SW1A 1AA"
                        value={propertyAddress}
                        onChange={(e) => setPropertyAddress(e.target.value)}
                        className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 font-body text-sm text-black placeholder-black/35 focus:border-[#a409d2] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block font-body text-[13px] font-semibold text-black">Description</label>
                      <textarea
                        placeholder="Key features, selling points, etc."
                        value={propertyDescription}
                        onChange={(e) => setPropertyDescription(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 font-body text-sm text-black placeholder-black/35 focus:border-[#a409d2] focus:outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block font-body text-[13px] font-semibold text-black">Listing link</label>
                      <input
                        type="url"
                        placeholder="https://www.rightmove.co.uk/properties/..."
                        value={propertyListingLink}
                        onChange={(e) => setPropertyListingLink(e.target.value)}
                        className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 font-body text-sm text-black placeholder-black/35 focus:border-[#a409d2] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block font-body text-[13px] font-semibold text-black">Property image URL</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={propertyImageUrl}
                        onChange={(e) => setPropertyImageUrl(e.target.value)}
                        className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 font-body text-sm text-black placeholder-black/35 focus:border-[#a409d2] focus:outline-none"
                      />
                      <p className="mt-1 font-body text-[11px] text-black/45">Paste a direct link to a photo of the property.</p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block font-body text-[13px] font-semibold text-black">Your Email Address</label>
                <input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 font-body text-sm text-black placeholder-black/35 focus:border-[#a409d2] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-body text-[13px] font-semibold text-black">Phone Number</label>
                <div className="flex h-[46px] items-center gap-2 rounded-lg border border-black/15 bg-white px-2 focus-within:border-[#a409d2]">
                  <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <CountryCodeSelect value={phoneCode} onChange={setPhoneCode} />
                  </div>
                  <input
                    type="tel"
                    placeholder="07700 900000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1 bg-transparent font-body text-sm text-black placeholder-black/35 outline-none"
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-4 py-3 font-body text-[13px] text-red-600">{error}</p>
              )}

              <button
                type="submit"
                className="flex h-13 items-center justify-center gap-2 rounded-full bg-[#a409d2] px-6 font-body text-[15px] font-extrabold uppercase tracking-[0.08em] text-white transition hover:bg-[#9408bd] mt-auto"
              >
                Generate My Assessment
                <ChevronRight className="h-4 w-4" />
              </button>
              <p className="text-center font-body text-[11px] text-black/40 -mt-2">
                Your details are used only to generate and send your assessment. We do not share your data.
              </p>
            </form>
          )}
        </div>
      </div>
    )}
    </>
  );
};

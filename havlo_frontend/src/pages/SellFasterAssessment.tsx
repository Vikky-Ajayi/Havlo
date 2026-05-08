import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { useModal } from '../hooks/useModal';
import { cn } from '../lib/utils';
import { usePageMeta } from '../hooks/usePageMeta';
import type { PublicAssessResult } from '../lib/api';

const STORAGE_PREFIX = 'havlo:assess:';

function renderReport(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="font-display text-[18px] font-black tracking-tight text-black mt-6 mb-2">{line.slice(4)}</h3>,
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="font-display text-[22px] font-black tracking-tight text-black mt-8 mb-2 pb-2 border-b border-black/10">{line.slice(3)}</h2>,
      );
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(
        <p key={i} className="font-body text-[15px] font-bold text-black mt-4 mb-1">{line.slice(2, -2)}</p>,
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const bullets: string[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        bullets.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="space-y-2.5 my-4">
          {bullets.map((b, bi) => (
            <li key={bi} className="flex gap-2.5">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#149d4f] text-white">
                <Check className="h-2.5 w-2.5" strokeWidth={4} />
              </span>
              <span className="font-body text-[14px] leading-relaxed text-black/85"
                dangerouslySetInnerHTML={{ __html: b.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </li>
          ))}
        </ul>,
      );
      continue;
    } else if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="space-y-2.5 my-4 list-none">
          {items.map((item, oi) => (
            <li key={oi} className="flex gap-2.5">
              <span className="font-display font-black text-[#a409d2] shrink-0 w-5 text-[14px]">{oi + 1}.</span>
              <span className="font-body text-[14px] leading-relaxed text-black/85"
                dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </li>
          ))}
        </ol>,
      );
      continue;
    } else if (line.trim() === '---') {
      elements.push(<hr key={i} className="my-8 border-black/10" />);
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="font-body text-[14px] text-black/80 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />,
      );
    }
    i++;
  }
  return elements;
}

const PLAN_COLORS: Record<string, string> = {
  launch: 'border-black/15 bg-white',
  amplify: 'border-[#a409d2] bg-[#a409d2] text-white',
  dominate: 'border-[#0c0c0c] bg-[#0c0c0c] text-white',
  'private-clients': 'border-[#0c0c0c] bg-[#0c0c0c] text-white',
};

export const SellFasterAssessment: React.FC = () => {
  usePageMeta({
    title: 'Your Property Assessment | Havlo',
    description: 'See your personalised property assessment and recommended relaunch plan.',
  });

  const [params] = useSearchParams();
  const { openModal } = useModal();
  const [data, setData] = useState<PublicAssessResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const sessionId = params.get('s');
    if (!sessionId) { setNotFound(true); return; }
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + sessionId);
      if (!raw) { setNotFound(true); return; }
      setData(JSON.parse(raw));
    } catch {
      setNotFound(true);
    }
  }, [params]);

  if (notFound) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-[28px] font-black text-black">Assessment not found</h1>
        <p className="mt-3 font-body text-sm text-black/60">This link may have expired. Please submit a new assessment.</p>
        <Link to="/sell-your-property" className="mt-6 inline-flex h-11 items-center rounded-full bg-[#a409d2] px-8 font-body text-sm font-extrabold uppercase tracking-[0.08em] text-white hover:bg-[#9408bd]">
          Back to Sell Your Property
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 border-t-[#a409d2]" />
      </div>
    );
  }

  const { property, report, pricing } = data;
  const planColorClass = PLAN_COLORS[pricing.plan_id] ?? PLAN_COLORS.amplify;
  const isColoured = pricing.plan_id !== 'launch';

  return (
    <div className="min-h-screen bg-[#f9f9f8]">
      {/* Top bar */}
      <div className="bg-white border-b border-black/8 px-6 py-4 lg:px-[100px]">
        <Link to="/sell-your-property" className="inline-flex items-center gap-2 font-body text-sm font-semibold text-black/60 hover:text-black transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="mx-auto max-w-[900px] px-6 py-10 lg:px-0 lg:py-14">

        {/* Property header */}
        <div className="mb-8 rounded-2xl bg-white border border-black/8 overflow-hidden">
          {property.image && (
            <img src={property.image} alt={property.title} className="w-full h-48 object-cover lg:h-64" />
          )}
          <div className="p-6 lg:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-[#ffd6f2] px-3 py-1 font-body text-[11px] font-extrabold uppercase tracking-[0.12em] text-black">
                    Assessment Ready
                  </span>
                </div>
                <h1 className="font-display text-[24px] font-black leading-tight tracking-tight text-black lg:text-[28px]">
                  {property.title || 'Your Property'}
                </h1>
                {property.address && (
                  <p className="mt-1 font-body text-sm text-black/55">{property.address}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {property.price && (
                    <span className="font-display text-[20px] font-black text-black">{property.price}</span>
                  )}
                  {property.bedrooms && (
                    <span className="font-body text-sm text-black/60">{property.bedrooms} bed</span>
                  )}
                  {property.bathrooms && (
                    <span className="font-body text-sm text-black/60">{property.bathrooms} bath</span>
                  )}
                  {property.property_type && (
                    <span className="font-body text-sm text-black/60">{property.property_type}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">

          {/* Report */}
          <div className="rounded-2xl bg-white border border-black/8 p-6 lg:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-black/8" />
              <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.22em] text-black/45">Your Assessment</span>
              <span className="h-px flex-1 bg-black/8" />
            </div>
            <div>{renderReport(report)}</div>
          </div>

          {/* Sticky sidebar: recommended plan + CTA */}
          <div className="lg:sticky lg:top-6">

            {/* Recommended plan card */}
            <div className={cn('rounded-2xl border-2 p-6', planColorClass)}>
              {pricing.plan_id === 'amplify' && (
                <div className={cn('mb-3 inline-block rounded-full px-3 py-1 font-body text-[10px] font-extrabold uppercase tracking-[0.12em]', isColoured ? 'bg-white/20 text-white' : 'bg-[#a409d2]/10 text-[#a409d2]')}>
                  Most Popular
                </div>
              )}
              <p className={cn('font-body text-[11px] font-extrabold uppercase tracking-[0.16em] mb-1', isColoured ? 'text-white/70' : 'text-black/50')}>
                Recommended Plan
              </p>
              <h2 className={cn('font-display text-[32px] font-black leading-none tracking-tight', isColoured ? 'text-white' : 'text-black')}>
                {pricing.plan_name}
              </h2>
              {!pricing.is_custom ? (
                <div className="mt-4">
                  <div className={cn('font-display text-[24px] font-black', isColoured ? 'text-white' : 'text-black')}>
                    {pricing.setup_fee}
                  </div>
                  <p className={cn('font-body text-[12px] font-medium', isColoured ? 'text-white/70' : 'text-black/55')}>
                    Initial setup investment
                  </p>
                  <div className={cn('mt-2 font-body text-sm font-semibold', isColoured ? 'text-white/85' : 'text-black/70')}>
                    {pricing.monthly_from}
                  </div>
                  <p className={cn('font-body text-[11px]', isColoured ? 'text-white/60' : 'text-black/45')}>
                    Ongoing buyer demand generation
                  </p>
                </div>
              ) : (
                <div className="mt-4">
                  <p className={cn('font-body text-sm font-medium', isColoured ? 'text-white/80' : 'text-black/65')}>
                    Bespoke strategy for high-value properties. Pricing discussed privately.
                  </p>
                </div>
              )}
              <div className={cn('my-5 h-px', isColoured ? 'bg-white/15' : 'bg-black/10')} />
              <ul className="space-y-2">
                {[
                  'International buyer campaigns',
                  '30+ countries reached',
                  'No agent switch required',
                  '0% commission on sale',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className={cn('h-3.5 w-3.5 shrink-0', isColoured ? 'text-white' : 'text-[#149d4f]')} strokeWidth={3} />
                    <span className={cn('font-body text-[13px] font-medium', isColoured ? 'text-white/85' : 'text-black/70')}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <button
              onClick={() => openModal('create-account')}
              className="mt-4 h-14 w-full rounded-2xl bg-[#a409d2] font-body text-[15px] font-extrabold uppercase tracking-[0.08em] text-white transition hover:bg-[#9408bd]"
            >
              Get Started
            </button>
            <p className="mt-2 text-center font-body text-[11px] text-black/45">
              No commitment • Free strategy call included
            </p>

            {/* Trust note */}
            <div className="mt-5 rounded-xl bg-white border border-black/8 p-4 text-center">
              <p className="font-body text-[12px] font-medium leading-relaxed text-black/60">
                <span className="font-bold text-black">0% commission</span> on sale •{' '}
                <span className="font-bold text-black">Works alongside</span> your current agent •{' '}
                No long-term lock-in
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellFasterAssessment;

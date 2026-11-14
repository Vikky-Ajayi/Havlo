import { useEffect, useState } from 'react';
import { API_BASE } from '../../lib/api';

// The /offer landing page's moving strip of properties recently assessed on
// Havlo (app/services/recent_assessments.py): the lead photo, the street (never
// a house number or postcode) and the Saleability Score. Social proof that
// other owners are checking their homes (Nov 2026 brief, section 1). Scrolls
// on its own, seamlessly (the list twice over), pauses under the pointer, and
// slows right down for anyone who prefers reduced motion. Hidden until there
// are enough to fill it.

type Item = { image: string; street: string; town: string; score: number };

const MIN_ITEMS = 5;
const SECONDS_PER_CARD = 2.6; // brisk ("quick succession"), but each card can still be read

const scoreTone = (score: number) => (score < 40 ? 'low' : score < 60 ? 'mid' : 'high');

export const RecentAssessmentsStrip = ({ wide = false }: { wide?: boolean } = {}) => {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/stale-listings/offer/recent-assessments`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { if (!cancelled) setItems(Array.isArray(d.items) ? d.items : []); })
      .catch(() => { /* no strip: the page reads fine without it */ });
    return () => { cancelled = true; };
  }, []);

  if (items.length < MIN_ITEMS) return null;
  const loop = [...items, ...items];

  return (
    <section className={`ras${wide ? ' ras-wide' : ''}`} aria-label="Properties recently assessed on Havlo">
      <div className="ras-head">
        <span className="ras-live" aria-hidden="true" />
        Recently assessed on Havlo
      </div>
      <div className="ras-viewport">
        <ul className="ras-track" style={{ animationDuration: `${items.length * SECONDS_PER_CARD}s` }}>
          {loop.map((item, i) => (
            <li className="ras-card" key={i} aria-hidden={i >= items.length}>
              <span className="ras-photo" style={{ backgroundImage: `url(${item.image})` }} />
              <span className="ras-text">
                <b title={item.street}>{item.street}</b>
                {item.town && <small>{item.town}</small>}
                <span className={`ras-score ras-${scoreTone(item.score)}`}>
                  Saleability <b>{item.score}</b>/100
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <style>{`
        .ras{width:100%;max-width:657px;min-width:0}
        .ras-wide{max-width:none}
        .ras-wide .ras-head{justify-content:center}
        .ras-head{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-family:Inter,sans-serif;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#4b5563}
        .ras-live{width:8px;height:8px;border-radius:50%;background:#16A34A;box-shadow:0 0 0 0 rgba(22,163,74,.5);animation:ras-pulse 1.8s ease-out infinite}
        @keyframes ras-pulse{0%{box-shadow:0 0 0 0 rgba(22,163,74,.45)}80%,100%{box-shadow:0 0 0 8px rgba(22,163,74,0)}}
        .ras-viewport{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 6%,#000 94%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 6%,#000 94%,transparent 100%)}
        .ras-track{display:flex;gap:12px;width:max-content;margin:0;padding:2px 0 6px;list-style:none;animation:ras-scroll linear infinite}
        .ras-viewport:hover .ras-track{animation-play-state:paused}
        @keyframes ras-scroll{from{transform:translateX(0)}to{transform:translateX(calc(-50% - 6px))}}
        .ras-card{flex:none;display:flex;align-items:center;gap:10px;width:236px;padding:8px;background:#fff;border:1px solid #ECEEF2;border-radius:14px;box-shadow:0 2px 10px rgba(16,24,40,.05);box-sizing:border-box}
        .ras-photo{flex:none;width:64px;height:64px;border-radius:10px;background:#EEF0F3 center/cover no-repeat}
        .ras-text{display:flex;flex-direction:column;min-width:0;font-family:Inter,sans-serif;line-height:1.25}
        .ras-text > b{font-size:14px;font-weight:700;color:#1F1F1E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ras-text small{font-size:12px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ras-score{align-self:flex-start;margin-top:6px;padding:3px 8px;border-radius:999px;font-size:11.5px;font-weight:600;white-space:nowrap}
        .ras-score b{font-size:13px;font-weight:800}
        .ras-low{background:#FEECEC;color:#B42318}
        .ras-mid{background:#FEF4E6;color:#B54708}
        .ras-high{background:#E7F6EC;color:#166534}
        @media (prefers-reduced-motion:reduce){.ras-track{animation-duration:240s !important}}
        @media (max-width:640px){.ras-card{width:210px}.ras-photo{width:56px;height:56px}}
      `}</style>
    </section>
  );
};

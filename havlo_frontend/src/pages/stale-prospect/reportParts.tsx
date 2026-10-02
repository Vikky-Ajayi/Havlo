import { useEffect, useState } from 'react';
import { formatGbp, type ReportAction, type SoldComparable } from './types';

// Pieces of the full report shared by the owner's report (StaleProspectWizard)
// and the agent report (AgentReport): the saleability gauge and score bars,
// long-text handling, the Land Registry sold-prices list and the full
// recommendation text.

// ── Shared: saleability gauge ──────────────────────────────────────────────

export const SaleabilityGauge = ({ score, size = 247 }: { score: number; size?: number }) => {
  const angle = 180 - (Math.min(100, Math.max(0, score)) / 100) * 180;
  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  const point = (deg: number, radius = r) => ({
    x: cx + radius * Math.cos((deg * Math.PI) / 180),
    y: cy - radius * Math.sin((deg * Math.PI) / 180),
  });
  const arcPath = (from: number, to: number) => {
    const start = point(from);
    const end = point(to);
    return `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
  };
  const segments = [
    { from: 180, to: 148, color: '#F03A17' },
    { from: 140, to: 108, color: '#FF8A00' },
    { from: 100, to: 68, color: '#D7D93A' },
    { from: 60, to: 28, color: '#3FD88E' },
    { from: 20, to: 0, color: '#09D9B2' },
  ];
  return (
    <div className="slw-gauge" style={{ width: size, height: size / 2 + 40 }}>
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        {segments.map((segment) => (
          <path
            key={segment.color}
            d={arcPath(segment.from, segment.to)}
            fill="none"
            stroke={segment.color}
            strokeWidth="13"
            strokeLinecap="round"
          />
        ))}
        <path
          d={`M ${cx - r - 8} ${cy} A ${r + 8} ${r + 8} 0 0 1 ${cx + r + 8} ${cy}`}
          fill="none"
          stroke="#d1d5db"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="0.5 8"
        />
        <line
          x1={cx}
          y1={cy}
          x2={cx + r * 0.48 * Math.cos((angle * Math.PI) / 180)}
          y2={cy - r * 0.48 * Math.sin((angle * Math.PI) / 180)}
          stroke="#111"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="4" fill="#111" />
      </svg>
      <div className="slw-gauge-score"><b>{score}</b>/100</div>
    </div>
  );
};

export const SCORE_LABELS: Record<string, string> = {
  pricing: 'Pricing',
  listing_presentation: 'Listing presentation',
  market_positioning: 'Market positioning',
  competition: 'Competition',
  buyer_appeal: 'Buyer appeal',
};

export const ScoreBar = ({ label, value }: { key?: string; label: string; value: number }) => {
  const color = value < 45 ? '#E33709' : value < 65 ? '#F5A623' : '#00C08B';
  return (
    <div className="slw-score-bar-row">
      <div className="slw-score-bar-label"><span>{label}</span><b>{value}/100</b></div>
      <div className="slw-score-bar-track"><div className="slw-score-bar-fill" style={{ width: `${value}%`, background: color }} /></div>
    </div>
  );
};

// ── Shared: long-text handling ──────────────────────────────────────────────
//
// Real Groq-generated report text runs 1000-3000+ characters per field (the
// prompt deliberately asks for consultant-length prose), which is exactly
// right for a report someone paid for and wants to actually read, but is far
// too dense for the small, scannable cards the design uses. Rather than
// shortening the underlying content, every long block on these two pages is
// shown clamped by default with a "Read more" toggle — nothing is ever lost,
// the page just doesn't open looking like a wall of text.

// Re-chunks long text into short, readable paragraphs for display. Two
// problems this solves at once:
// - executive_summary genuinely has \n\n breaks in the data, but each one
//   is still a dense 4-6 sentence block — real, but not fine-grained
//   enough to read comfortably.
// - evidence/impact/recommend (derived by splitIntoThree below for any
//   report older than that schema) have NO breaks at all: splitIntoThree
//   joins each third of the sentences with a single space, so pre-line
//   has nothing to render as a break and the whole thing looks like one
//   wall of text regardless of the white-space CSS.
// Treating any existing blank line as a hard boundary (never merging two
// authored paragraphs into one) and then re-splitting every paragraph
// down to at most `perParagraph` sentences fixes both: real paragraph
// intent is preserved, and anything longer just gets broken up further.
export function reflowParagraphs(text: string, perParagraph = 2): string {
  const clean = (text || '').trim();
  if (!clean) return '';
  const paragraphs = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const paragraph of paragraphs.length ? paragraphs : [clean]) {
    const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter(Boolean);
    for (let i = 0; i < sentences.length; i += perParagraph) {
      out.push(sentences.slice(i, i + perParagraph).join(' '));
    }
  }
  return out.join('\n\n');
}

export const ExpandableText = ({
  text,
  maxChars = 220,
  allowExpand = true,
  as: Tag = 'p',
  className,
}: {
  text?: string;
  maxChars?: number;
  allowExpand?: boolean;
  as?: 'p' | 'span';
  className?: string;
}) => {
  const [expanded, setExpanded] = useState(false);
  // "Read more" clamping only makes sense on screen — the truncated string
  // is all the DOM ever contains when collapsed, so printing/downloading a
  // PDF while collapsed would permanently lose that text from the page (no
  // amount of print CSS can bring back text that was never rendered). Force
  // every instance open for the duration of the print, and hide the button
  // itself since there's nothing to click on paper.
  const [forcePrint, setForcePrint] = useState(false);
  useEffect(() => {
    const onBeforePrint = () => setForcePrint(true);
    const onAfterPrint = () => setForcePrint(false);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, []);
  const raw = (text || '').trim();
  if (!raw) return null;
  const clean = reflowParagraphs(raw);
  const isLong = clean.length > maxChars;
  const truncated = isLong ? clean.slice(0, maxChars).replace(/\s+\S*$/, '') + '…' : clean;
  const shown = expanded || forcePrint ? clean : truncated;
  return (
    // The underlying text is written (and, since the duplication fix,
    // stored) as \n\n-separated paragraphs, but plain HTML collapses
    // newlines by default — every long field was rendering as one
    // undifferentiated block no matter how it was punctuated in the data.
    // pre-line respects the existing blank lines as real paragraph breaks
    // while still wrapping normally within each line.
    <Tag className={className} style={{ whiteSpace: 'pre-line' }}>
      {shown}
      {isLong && allowExpand && !forcePrint && (
        <button type="button" className="slw-read-more slw-noprint" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </Tag>
  );
};

// Older reports (generated before evidence/impact/recommend existed) only
// ever stored one long `description` per finding. Rather than showing those
// three labels with nothing under them, split the description into rough
// thirds on sentence boundaries so every report — old or new — gets a
// sensible EVIDENCE / IMPACT / RECOMMEND breakdown.
export function splitIntoThree(text: string): [string, string, string] {
  const clean = (text || '').trim();
  if (!clean) return ['', '', ''];
  const sentences = clean.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter(Boolean);
  if (sentences.length < 3) return [clean, '', ''];
  const third = Math.ceil(sentences.length / 3);
  return [
    sentences.slice(0, third).join(' '),
    sentences.slice(third, third * 2).join(' '),
    sentences.slice(third * 2).join(' '),
  ];
}

// Same idea for action_plan.why_it_matters, which is also empty on older
// reports — fall back to the description's first sentence.
export function firstSentence(text: string): string {
  const clean = (text || '').trim();
  if (!clean) return '';
  const match = clean.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : clean).trim();
}

// Recorded sales from HM Land Registry (never AI-written). The attribution
// is required by the data's licence wherever the sales are shown.
export const SoldPricesList = ({ sales, attribution, loading = false }: { sales: SoldComparable[]; attribution?: string | null; loading?: boolean }) => (
  <div className="slw-sold-comps">
    <div className="slw-sold-comps-head">
      <b>Comparable sold properties</b>
      <span>Recent sales of similar homes nearby</span>
    </div>
    {loading ? (
      <p className="slw-sold-comps-loading">Checking recent sales near you&hellip;</p>
    ) : (
      <ul>
        {sales.map((sale) => (
          <li key={`${sale.address}-${sale.date}`}>
            <div>
              {/* Keep the postcode on one line: "CF23 5JL", never "CF23 / 5JL". */}
              <span className="slw-sold-comps-addr">{sale.address.replace(/ (\d[A-Z]{2})$/, '\u00a0$1')}</span>
              <span className="slw-sold-comps-meta">
                {sale.property_type} &middot; Sold {new Date(`${sale.date}T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              </span>
            </div>
            <b>{formatGbp(sale.price)}</b>
          </li>
        ))}
      </ul>
    )}
    {attribution && <small>{attribution}</small>}
  </div>
);

export const RecommendationContent = ({ contactName, actions }: { contactName: string; actions: ReportAction[] }) => (
  <>
    <p>Dear {contactName || '(name)'},</p>
    <p>Following our assessment of your property&rsquo;s current market position, here is the complete set of recommended actions in priority order, along with why each one matters and how to execute it:</p>

    {actions.map((action, i) => (
      <div className="slw-modal-action" key={i}>
        <h3>{i + 1}) {action.title}
          {action.priority && <span className="slw-modal-priority"> &middot; {action.priority}</span>}
        </h3>
        {action.description && <p style={{ whiteSpace: 'pre-line' }}>{reflowParagraphs(action.description)}</p>}
        {action.why_it_matters && <p><i>Why it matters: {action.why_it_matters}</i></p>}
        {(action.bullets || []).length > 0 && (
          <ul className="slw-modal-bullets">
            {action.bullets!.map((bullet, bi) => <li key={bi}>{bullet}</li>)}
          </ul>
        )}
      </div>
    ))}

    <h3>OUR ADVISORY VIEW</h3>
    <p>We recommend working through these actions in the order shown, starting with the highest-priority items, and reviewing the result of each before moving to the next.<br />
    Your existing agent remains fully in control of the sale &mdash; these recommendations are designed to support their work, not replace it.</p>

    <h3>Prepared &amp; reviewed by</h3>
    <p className="slw-modal-team">Havlo Sales Advisory Team</p>
    <p>Property Intelligence &bull; Sales Strategy &bull; Buyer Generation</p>
    <p className="slw-modal-disclaimer">This recommendation is strategic guidance based on the information available to Havlo at the time of assessment. Individual strategies should be evaluated against the property&rsquo;s circumstances and current market conditions. Results will vary and no particular strategy guarantees a sale.</p>
  </>
);

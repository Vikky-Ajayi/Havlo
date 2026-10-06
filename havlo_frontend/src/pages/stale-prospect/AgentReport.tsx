import { useEffect, useState, type ReactNode } from 'react';
import { downloadAgentReportPdf, getAgentIntel } from './api';
import {
  ExpandableText,
  RecommendationContent,
  SaleabilityGauge,
  SCORE_LABELS,
  ScoreBar,
  SoldPricesList,
  splitIntoThree,
} from './reportParts';
import {
  formatGbp,
  formatReducedDate,
  type AgentIntel,
  type AgentIntelAgency,
  type AgentIntelHome,
  type AgentIntelSale,
  type FullReportData,
  type ProspectReport,
} from './types';

// The agent-facing report on one of an agency's stale listings
// (app/services/agent_report.py): the eight headline figures on the free
// assessment (AgentTeaser), the whole report after purchase
// (AgentFullReport) -- the agency's figures and Havlo's assessment of the
// listing on one page, built from the same cards as the owner's report.
// Every figure comes from real data (Rightmove, HM Land Registry, the
// listing itself); the backend fills each one from a fallback source when
// the first doesn't answer. Commission uses a fee the agent can change
// (kept in this browser), and the PDF is built on the server with it.

type Access = { token?: string; code?: string };

const FEE_KEY = 'havlo_agent_fee_percent';
const DEFAULT_FEE = 1.2;
const VAT = 0.2;

/** The agent's fee (percent), as last entered in this browser. */
export const readAgentFee = (): number => readFee();

const readFee = (): number => {
  try {
    const v = parseFloat(window.localStorage.getItem(FEE_KEY) || '');
    return Number.isFinite(v) && v > 0 && v < 10 ? v : DEFAULT_FEE;
  } catch {
    return DEFAULT_FEE;
  }
};
const saveFee = (v: number) => {
  try {
    window.localStorage.setItem(FEE_KEY, String(v));
  } catch {
    // Private mode: the fee just isn't remembered.
  }
};
const commission = (price: number | null | undefined, fee: number) => (price ? price * (fee / 100) * (1 + VAT) : null);

function useFee() {
  const [fee, setFee] = useState(readFee);
  return [fee, (v: number) => { setFee(v); saveFee(v); }] as const;
}

function useAgentIntel(access: Access) {
  const [state, setState] = useState<{ loading: boolean; intel?: AgentIntel; locked: boolean; error?: string }>({ loading: true, locked: true });
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    let timer: number | undefined;
    const load = async () => {
      try {
        const res = await getAgentIntel(access);
        if (cancelled) return;
        if (res.status === 'ready' && res.intel) {
          setState({ loading: false, intel: res.intel, locked: res.locked });
        } else if (tries++ < 45) {
          timer = window.setTimeout(load, 4000);
        } else {
          setState({ loading: false, locked: res.locked, error: 'The market analysis is taking longer than usual. Please refresh in a minute.' });
        }
      } catch {
        if (!cancelled) setState({ loading: false, locked: true, error: 'We could not load the agent report just now.' });
      }
    };
    load();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [access.token, access.code]);
  return state;
}

// ── Small pieces ──────────────────────────────────────────────────────────

type Tone = 'good' | 'warn' | 'bad' | 'neutral';

const LEVEL_TONE: Record<string, Tone> = {
  Low: 'good', Limited: 'neutral', Routine: 'good',
  Moderate: 'warn', Elevated: 'warn', Soon: 'warn', Medium: 'warn',
  High: 'bad', Priority: 'bad', Strong: 'good',
  Critical: 'bad', Immediate: 'bad', 'Immediate review': 'bad',
};
const toneOf = (level?: string | null): Tone => LEVEL_TONE[level || ''] || 'neutral';
const healthTone = (v: number | null | undefined): Tone => (v == null ? 'neutral' : v < 45 ? 'bad' : v < 65 ? 'warn' : 'good');

const fmtDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const money = (v?: number | null) => (v ? formatGbp(v) : '—');
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

const Pill = ({ value, tone }: { value: string; tone?: Tone }) => <span className={`agr-pill agr-pill-${tone || toneOf(value)}`}>{value}</span>;

const FeeInput = ({ fee, onChange }: { fee: number; onChange: (v: number) => void }) => (
  <label className="agr-fee">
    <span>Fee</span>
    <input
      type="number"
      inputMode="decimal"
      min={0.1}
      max={9.9}
      step={0.05}
      value={fee}
      aria-label="Your fee, percent"
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v) && v > 0 && v < 10) onChange(v);
      }}
    />
    <span>% + VAT</span>
  </label>
);

const Kpi = ({ label, value, sub, tone, meter, children }: {
  key?: string; label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; meter?: number | null; children?: ReactNode;
}) => (
  <div className={`agr-kpi agr-tone-${tone || 'neutral'}`}>
    <span className="agr-kpi-label">{label}</span>
    <b className="agr-kpi-value">{value}</b>
    {meter != null && <span className="agr-meter" aria-hidden="true"><i style={{ width: `${Math.max(4, Math.min(100, meter))}%` }} /></span>}
    {sub && <small className="agr-kpi-sub">{sub}</small>}
    {children}
  </div>
);

const SectionHead = ({ kicker, title, children }: { kicker?: string; title: string; children?: ReactNode }) => (
  <div className="agr-section-head">
    {kicker && <p className="agr-eyebrow">{kicker}</p>}
    <h2>{title}</h2>
    {children && <div className="agr-section-intro">{children}</div>}
  </div>
);

const Preparing = () => (
  <div className="agr-preparing" role="status">
    <span className="agr-spinner" />
    <div>
      <b>Analysing the market around this listing…</b>
      <p>We&rsquo;re reading the homes for sale nearby, who&rsquo;s marketing them and what&rsquo;s selling. This takes up to a minute.</p>
    </div>
  </div>
);

const isReduced = (reducedDate: string | null | undefined) => reducedDate !== null && reducedDate !== undefined;

// ── Headline figures ──────────────────────────────────────────────────────

const Headline = ({ intel, fee, onFee, reducedDate }: { intel: AgentIntel; fee: number; onFee: (v: number) => void; reducedDate?: string | null }) => {
  const h = intel.headline;
  const reduced = isReduced(h.reduced_date ?? reducedDate) ? (h.reduced_date ?? reducedDate ?? '') : null;
  const pressure = h.vendor_pressure || 'High';
  const reasons = h.vendor_pressure_reasons || [];
  const gapParts = [
    h.success_gap_rightmove ? `${h.success_gap_rightmove} agreed on Rightmove` : '',
    h.success_gap_sales ? `${h.success_gap_sales} sold (Land Registry)` : '',
  ].filter(Boolean);
  const listedSince = intel.subject?.listed_date ? `on the market since ${fmtDate(intel.subject.listed_date)}` : 'without a sale';
  return (
    <div className="agr-kpis">
      <Kpi
        label="Instruction health"
        value={h.health != null ? <>{h.health}<em>/100</em></> : '—'}
        tone={healthTone(h.health)}
        meter={h.health}
        sub="Time, price, presentation, competition and homes selling nearby"
      />
      <Kpi label="Instruction risk" value={h.risk} tone={toneOf(h.risk)} sub={h.risk_reason} />
      <Kpi label="Vendor pressure" value={pressure} tone="bad" sub={reasons[0]} />
      {reduced !== null ? (
        <Kpi
          label="Date reduced"
          value={reduced ? formatReducedDate(reduced) : 'Recently'}
          tone="warn"
          sub={[
            h.days_since_reduction != null ? `${h.days_since_reduction} days ago` : 'price already reduced',
            h.dom ? `${h.dom} days on the market` : '',
          ].filter(Boolean).join(' · ')}
        />
      ) : (
        <Kpi
          label="Days on the market"
          value={h.dom != null ? `${h.dom} days` : '—'}
          tone="warn"
          sub={h.dom_benchmark != null ? `vs ${h.dom_benchmark}-day local benchmark*` : listedSince}
        />
      )}
      <Kpi label="Competitor pressure" value={h.competitor_pressure} tone={toneOf(h.competitor_pressure)} sub={h.competitor_reason} />
      <Kpi
        label="Comparable success gap"
        value={h.success_gap}
        tone={h.success_gap >= 3 ? 'bad' : h.success_gap ? 'warn' : 'neutral'}
        sub={<>{h.success_gap === 1 ? 'similar home sold or agreed' : 'similar homes sold or agreed'} since it was listed{gapParts.length > 0 && <span className="agr-kpi-break">{gapParts.join(' · ')}</span>}</>}
      />
      <Kpi label="Relaunch opportunity" value={h.relaunch} tone={toneOf(h.relaunch)} sub={h.relaunch_reason} />
      <Kpi label="Commission on this instruction" value={money(commission(h.price, fee))}>
        <FeeInput fee={fee} onChange={onFee} />
      </Kpi>
    </div>
  );
};

export const AgentTeaser = ({ access, onUnlock, reducedDate }: { access: Access; onUnlock: () => void; reducedDate?: string | null }) => {
  const { loading, intel, error } = useAgentIntel(access);
  const [fee, setFee] = useFee();
  return (
    <section className="agr agr-teaser">
      <SectionHead kicker="Instruction intelligence" title="How exposed is this instruction?">
        {intel && <p>{intel.summary || `Compared with ${intel.comparables} ${intel.basis_label}.`}</p>}
      </SectionHead>
      {loading && <Preparing />}
      {error && <p className="agr-error">{error}</p>}
      {intel && (
        <>
          <div className="agr-tray"><Headline intel={intel} fee={fee} onFee={setFee} reducedDate={reducedDate} /></div>
          <div className="agr-locked">
            <div>
              <b>Unlock the full agent report</b>
              <p>What your vendor can see &middot; the agencies competing around this listing &middot; price position against recorded sales &middot; presentation against similar listings &middot; the questions your vendor is likely to ask, with talking points &middot; five prioritised actions, a 30-day plan and a downloadable PDF.</p>
            </div>
            <button type="button" className="slw-btn-black agr-unlock" onClick={onUnlock}>Unlock the full report</button>
          </div>
          {intel.headline.dom_benchmark != null && <p className="agr-footnote">* The local benchmark is the typical time similar homes still for sale nearby have been listed.</p>}
        </>
      )}
      <AgentReportStyles />
    </section>
  );
};

// ── Lists ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = { on_market: 'For sale', under_offer: 'Under offer', sold_stc: 'Sold STC', removed: 'Removed' };
const STATUS_TONE: Record<string, Tone> = { on_market: 'neutral', under_offer: 'good', sold_stc: 'good', removed: 'bad' };

const HomeList = ({ title, sub, homes }: { title: string; sub?: string; homes: AgentIntelHome[] }) => (
  <div className="agr-card agr-list-card">
    <div className="agr-list-head"><b>{title}</b>{sub && <span>{sub}</span>}</div>
    <ul className="agr-homes">
      {homes.map((h) => (
        <li key={`${h.address}-${h.first_listed}-${h.price}`}>
          <div className="agr-home-main">
            {h.url ? <a href={h.url} target="_blank" rel="noreferrer">{h.address}</a> : <span className="agr-home-addr">{h.address}</span>}
            <small>
              {[h.bedrooms ? `${h.bedrooms} bed` : '', h.type, h.distance != null ? `${h.distance} mi` : '', h.first_listed ? `listed ${fmtDate(h.first_listed)}` : '', h.agent]
                .filter(Boolean).join(' · ')}
            </small>
          </div>
          <div className="agr-home-side">
            <b>{money(h.price)}</b>
            <Pill value={STATUS_LABEL[h.status] || h.status} tone={STATUS_TONE[h.status] || 'neutral'} />
          </div>
        </li>
      ))}
    </ul>
  </div>
);

const toSold = (sales: AgentIntelSale[]) => sales.map((s) => ({ address: s.address, property_type: s.property_type || s.type || '', price: s.price, date: s.date }));

const AgencyTable = ({ agencies }: { agencies: AgentIntelAgency[] }) => {
  const top = Math.max(1, ...agencies.map((a) => a.share));
  return (
    <div className="agr-card agr-agencies" role="table" aria-label="Competing agencies nearby">
      <div className="agr-agency agr-agency-head" role="row">
        <span role="columnheader">Agency</span>
        <span role="columnheader">Listed nearby</span>
        <span role="columnheader">Under offer / sold STC</span>
        <span role="columnheader">New in 30 days</span>
        <span role="columnheader">Share</span>
      </div>
      {agencies.map((a) => (
        <div key={a.agent} className={`agr-agency${a.you ? ' agr-agency-you' : ''}`} role="row">
          <span className="agr-agency-name" role="cell">
            <b>{a.agent}</b>
            {a.you && <em>Your agency</em>}
          </span>
          <span className="agr-agency-stat" role="cell"><i>Listed nearby</i><b>{a.listings}</b></span>
          <span className="agr-agency-stat" role="cell"><i>Under offer / STC</i><b>{a.agreed}</b></span>
          <span className="agr-agency-stat" role="cell"><i>New in 30 days</i><b>{a.new_30}</b></span>
          <span className="agr-agency-share" role="cell">
            <i>Share</i><b>{a.share}%</b>
            <span className="agr-share-bar" aria-hidden="true"><span style={{ width: `${(100 * a.share) / top}%` }} /></span>
          </span>
        </div>
      ))}
    </div>
  );
};

// ── The full report ───────────────────────────────────────────────────────

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </svg>
);

export const AgentFullReport = ({
  access,
  report,
  onOpenRecommendation,
  onOpenDashboard,
}: {
  access: Access;
  report: ProspectReport;
  onOpenRecommendation: () => void;
  onOpenDashboard: () => void;
}) => {
  const { loading, intel, error } = useAgentIntel(access);
  const [fee, setFee] = useFee();
  const [pdfState, setPdfState] = useState<{ busy: boolean; error: string }>({ busy: false, error: '' });
  const data: FullReportData = report.report_data || {};
  const snapshot = report.listing_snapshot || {};
  const image = snapshot.image || (snapshot.images && snapshot.images[0]) || '';
  const scores = data.scores || {};
  const reduced = isReduced(report.reduced_date);
  const agency = intel?.subject?.agent || '';

  const downloadPdf = async () => {
    setPdfState({ busy: true, error: '' });
    try {
      await downloadAgentReportPdf(access, fee);
      setPdfState({ busy: false, error: '' });
    } catch (err) {
      setPdfState({ busy: false, error: (err as Error).message });
    }
  };

  const findings = (data.key_findings || []).filter((f) => f.type === 'issue').slice(0, 2);
  if (findings.length < 2) {
    for (const f of data.key_findings || []) {
      if (findings.length >= 2) break;
      if (!findings.includes(f)) findings.push(f);
    }
  }
  const h = intel?.headline;
  const market = intel?.market;
  const pricing = intel?.pricing;
  const sold = intel?.sold;
  const pres = intel?.presentation;
  const viewItems = intel?.vendor_view?.items || [];
  const comparables = pricing?.comparables?.length ? toSold(pricing.comparables) : toSold(
    (data.comparable_sales || []).filter((c) => !c.is_subject && c.sold_price && c.sold_date)
      .map((c) => ({ address: c.address || '', property_type: c.property_type || '', price: c.sold_price as number, date: c.sold_date as string })),
  );
  const plan = intel?.plan?.length ? intel.plan : (data.thirty_day_plan || []);
  // Sales since it was listed that the comparables list doesn't already show.
  const shown = new Set(comparables.map((c) => `${c.address.toLowerCase().replace(/[^a-z0-9]/g, '')}|${c.price}`));
  const soldSince = (sold?.since_listed || []).filter((s) => !shown.has(`${s.address.toLowerCase().replace(/[^a-z0-9]/g, '')}|${s.price}`));

  return (
    <section className="agr agr-full">
      <div className="agr-report-head">
        <div>
          <p className="agr-eyebrow">Agent report</p>
          <h1>Instruction Intelligence Report</h1>
        </div>
        <div className="agr-head-actions slw-noprint">
          <button type="button" className="slw-btn-black agr-head-btn" onClick={downloadPdf} disabled={pdfState.busy}>
            <DownloadIcon /> {pdfState.busy ? 'Preparing PDF…' : 'Download PDF report'}
          </button>
          <button type="button" className="slw-btn-outline agr-head-btn" onClick={onOpenDashboard}>90-day instruction watch</button>
        </div>
      </div>
      {pdfState.error && <p className="agr-error slw-noprint" role="alert">{pdfState.error}</p>}

      {/* Property and Havlo's summary */}
      <div className="agr-tray agr-hero">
        <div className="agr-card agr-property">
          <div className="agr-property-image" style={image ? { backgroundImage: `url(${image})` } : undefined} />
          <div className="agr-property-text">
            <h2>{report.property_address}</h2>
            <dl className="agr-facts">
              <div><dt>Asking price</dt><dd className="agr-accent">{money(report.asking_price)}</dd></div>
              {reduced ? (
                <div><dt>Date reduced</dt><dd className="agr-hl">{formatReducedDate(report.reduced_date || '')}</dd></div>
              ) : (
                <div><dt>Days on market</dt><dd className="agr-hl">{h?.dom ?? report.listing_duration_days ?? '—'} days</dd></div>
              )}
              <div><dt>Marketed by</dt><dd className="agr-small">{agency || '—'}</dd></div>
              <div><dt>Saleability score</dt><dd>{data.overall_score ?? '—'}<em>/100</em></dd></div>
            </dl>
          </div>
        </div>
        <div className="agr-card agr-summary">
          <b>Executive summary</b>
          <ExpandableText text={data.executive_summary} maxChars={420} />
        </div>
      </div>
      {intel && (
        <p className="agr-basis">
          {intel.summary || `Compared with ${intel.comparables} ${intel.basis_label}.`} Updated {fmtDate(intel.generated_at)}.
        </p>
      )}

      {loading && <Preparing />}
      {error && <p className="agr-error">{error}</p>}

      {intel && h && (
        <>
          <section className="agr-section">
            <SectionHead kicker="Instruction intelligence" title="How exposed is this instruction?" />
            <div className="agr-tray"><Headline intel={intel} fee={fee} onFee={setFee} reducedDate={report.reduced_date} /></div>
          </section>

          <section className="agr-section">
            <SectionHead kicker="The market is moving around this listing" title="What your vendor can see" />
            <div className="agr-tray agr-view">
              {viewItems.map((item) => (
                <div className="agr-card agr-view-item" key={item.text}>
                  <b>{item.value}</b>
                  <span>{item.text}.</span>
                </div>
              ))}
            </div>
            {(h.vendor_pressure_reasons || []).length > 0 && (
              <div className="agr-card agr-pressure">
                <div className="agr-pressure-head"><b>Why vendor pressure is high</b><Pill value="High" tone="bad" /></div>
                <ul>{(h.vendor_pressure_reasons || []).map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            )}
            <p className="agr-insight"><b>Havlo insight:</b> your vendor has access to much of the same market information. A proactive review backed by current evidence shows the instruction is being actively managed.</p>
          </section>

          {intel.actions && (
            <section className="agr-section">
              <SectionHead kicker="Prioritised" title="What Havlo recommends you do now" />
              <ol className="agr-tray agr-actions">
                {intel.actions.map((a, i) => (
                  <li key={a.title} className="agr-card">
                    <span className="agr-num">{i + 1}</span>
                    <div>
                      <div className="agr-action-title"><b>{a.title}</b><Pill value={a.priority} /></div>
                      <p>{a.why}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {intel.vendor && (
            <section className="agr-section">
              <SectionHead kicker={`Vendor conversation priority: ${intel.vendor.priority}`} title="Be ready for the next vendor call" />
              <div className="agr-tray agr-two">
                <div className="agr-card">
                  <h3>Questions your vendor is likely to ask</h3>
                  <ul className="agr-quotes">{intel.vendor.questions.map((q) => <li key={q}>&ldquo;{q}&rdquo;</li>)}</ul>
                </div>
                <div className="agr-card">
                  <h3>Evidence-backed talking points</h3>
                  <ul className="agr-bullets">{intel.vendor.talking_points.map((t) => <li key={t}>{t}</li>)}</ul>
                </div>
              </div>
            </section>
          )}

          {market && (
            <section className="agr-section">
              <SectionHead kicker="Local market movement" title="The competition around this listing" />
              {(market.cards || []).length > 0 && (
                <div className="agr-tray agr-kpis agr-kpis-compact">
                  {(market.cards || []).map((c) => <Kpi key={c.label} label={c.label} value={c.value} sub={c.sub} />)}
                </div>
              )}
              <div className="agr-stack">
                {market.sold_since.length > 0 && (
                  <HomeList title="Listed after this one, already under offer or sold STC" sub="Buyers chose these over this listing" homes={market.sold_since} />
                )}
                {(market.competing || []).length > 0 && (
                  <HomeList title="Similar homes for sale, closest in price" sub={`What buyers are comparing it with, ${intel.area_label || 'nearby'}`} homes={market.competing || []} />
                )}
                {market.new_30.length > 0 && <HomeList title="New competition in the last 30 days" homes={market.new_30} />}
              </div>
            </section>
          )}

          {intel.competitors && intel.competitors.agencies.length > 0 && (
            <section className="agr-section">
              <SectionHead kicker={`Competitor threat: ${intel.competitors.threat} · Exposure: ${intel.competitors.exposure}`} title="Competing agencies nearby">
                <p>{intel.competitors.in_segment} other {plural(intel.competitors.in_segment, 'agency is', 'agencies are')} marketing similar homes {intel.area_label || 'nearby'}; {intel.competitors.agreed_in_segment} {plural(intel.competitors.agreed_in_segment, 'has', 'have')} one under offer or sold STC. These are the agents your vendor is likely to come across.</p>
              </SectionHead>
              <AgencyTable agencies={intel.competitors.agencies} />
              {intel.competitors.momentum.length > 0 && (
                <p className="agr-note"><b>Momentum:</b> {intel.competitors.momentum.map((a) => `${a.agent} (${a.new_30} new)`).join(', ')} took on new listings nearby in the last 30 days.</p>
              )}
            </section>
          )}

          {pricing && (
            <section className="agr-section">
              <SectionHead kicker={`Price reduction pressure: ${pricing.reduction_pressure}`} title="Price position" />
              <div className="agr-tray agr-kpis agr-kpis-compact">
                <Kpi label="Asking price" value={money(h.price ?? report.asking_price)} sub={pricing.price_per_bedroom ? `${money(pricing.price_per_bedroom)} a bedroom` : undefined} />
                {pricing.median_for_sale ? (
                  <Kpi
                    label="Middle of similar homes for sale"
                    value={money(pricing.median_for_sale)}
                    sub={pricing.premium_pct != null ? (pricing.premium_pct === 0 ? 'yours is in line' : `yours is ${Math.abs(pricing.premium_pct)}% ${pricing.premium_pct > 0 ? 'above' : 'below'}`) : undefined}
                  />
                ) : sold?.low_12m ? (
                  <Kpi label="Recorded sale range (12 months)" value={`${money(sold.low_12m)}–${money(sold.high_12m)}`} sub={`${sold.homes_label} ${sold.area_label}`} />
                ) : (
                  <Kpi label="Price per bedroom" value={money(pricing.price_per_bedroom)} sub="the asking price over the bedrooms" />
                )}
                <Kpi
                  label="Middle recorded sale (12 months)"
                  value={money(pricing.sold_median)}
                  sub={pricing.sold_median
                    ? `${pricing.sold_count} ${plural(pricing.sold_count, 'sale')} of ${sold?.homes_label || 'homes'} ${sold?.area_label || 'nearby'}${pricing.sold_premium_pct ? `; yours is ${Math.abs(pricing.sold_premium_pct)}% ${pricing.sold_premium_pct > 0 ? 'above' : 'below'}` : ''}`
                    : 'no recorded sales nearby'}
                />
                <Kpi label="Price score" value={pricing.score != null ? <>{pricing.score}<em>/100</em></> : '—'} tone={healthTone(pricing.score)} meter={pricing.score} sub="against the local evidence" />
              </div>
              <p className="agr-note">
                {pricing.cheaper_share != null && <>{pricing.cheaper_share}% of similar homes for sale nearby are cheaper. </>}
                {pricing.reduced_date ? <>Last reduced {pricing.days_since_reduction} days ago ({fmtDate(pricing.reduced_date)}).</> : <>No price reduction on record.</>}
              </p>
              {(comparables.length > 0 || soldSince.length > 0) && (
                <div className={`agr-sold${comparables.length > 0 && soldSince.length > 0 ? ' agr-two' : ''}`}>
                  {comparables.length > 0 && <SoldPricesList sales={comparables} attribution={report.sold_comparables_attribution || 'Contains HM Land Registry data © Crown copyright and database right. Licensed under the Open Government Licence v3.0.'} />}
                  {soldSince.length > 0 && (
                    <div className="slw-sold-comps">
                      <div className="slw-sold-comps-head">
                        <b>{comparables.length > 0 ? 'Also sold since this one was listed' : 'Sold since this one was listed'}</b>
                        <span>Similar homes {sold?.area_label || 'nearby'} that found a buyer first</span>
                      </div>
                      <ul>
                        {soldSince.map((s) => (
                          <li key={`${s.address}-${s.date}`}>
                            <div>
                              <span className="slw-sold-comps-addr">{s.address}</span>
                              <span className="slw-sold-comps-meta">{s.type || s.property_type} &middot; Sold {fmtDate(s.date)}</span>
                            </div>
                            <b>{formatGbp(s.price)}</b>
                          </li>
                        ))}
                      </ul>
                      <small>Contains HM Land Registry data &copy; Crown copyright and database right. Licensed under the Open Government Licence v3.0.</small>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {pres && (
            <section className="agr-section">
              <SectionHead kicker={`Relaunch opportunity: ${intel.freshness?.relaunch} · Listing fatigue: ${intel.freshness?.fatigue}`} title="Presentation and buyer appeal" />
              <div className="agr-tray agr-kpis agr-kpis-compact">
                <Kpi label="Portal presentation" value={<>{pres.score}<em>/100</em></>} tone={healthTone(pres.score)} meter={pres.score} sub="the listing against similar ones, with Havlo's assessment" />
                <Kpi label="Photos" value={pres.photos ?? '—'} sub={pres.comparable_photos ? `similar listings: ${pres.comparable_photos}` : 'on the listing'} />
                <Kpi label="Floorplan" value={pres.floorplans ? 'Yes' : pres.floorplans === 0 ? 'No' : '—'} tone={pres.floorplans === 0 ? 'bad' : pres.floorplans ? 'good' : 'neutral'} sub={pres.comparable_floorplan_share != null ? `${pres.comparable_floorplan_share}% of similar listings have one` : 'buyers expect one'} />
                <Kpi label="Buyer appeal" value={pres.buyer_appeal != null ? <>{Math.round(pres.buyer_appeal)}<em>/100</em></> : '—'} tone={healthTone(pres.buyer_appeal)} meter={pres.buyer_appeal} sub="Havlo's assessment" />
              </div>
              <div className="agr-tray agr-two">
                <div className="agr-card">
                  <h3>What to fix</h3>
                  {pres.gaps.length > 0
                    ? <ul className="agr-bullets">{pres.gaps.map((g) => <li key={g}>{g[0].toUpperCase() + g.slice(1)}</li>)}</ul>
                    : <p className="agr-muted">The listing&rsquo;s photos, floorplan and copy compare well with similar listings nearby.</p>}
                </div>
                <div className="agr-card">
                  <h3>From Havlo&rsquo;s assessment</h3>
                  {pres.findings.length > 0
                    ? <ul className="agr-bullets">{pres.findings.map((f) => <li key={f.title}><b>{f.title}.</b> {f.detail}</li>)}</ul>
                    : <p className="agr-muted">Buyer appeal is scored {pres.buyer_appeal != null ? `${Math.round(pres.buyer_appeal)}/100` : 'in the assessment'}; see the full recommendation below.</p>}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Havlo's assessment of the listing (the same as the owner's report) */}
      <section className="agr-section">
        <SectionHead kicker="Havlo's assessment" title="Saleability score" />
        <div className="slw-score-row">
          <div className="slw-score-gauge-card">
            <SaleabilityGauge score={data.overall_score ?? 50} />
            <b>Property Saleability Score</b>
            <p>How likely the listing is to attract and convert buyers as it stands.</p>
          </div>
          <div className="slw-score-bars-card">
            {Object.entries(SCORE_LABELS).map(([key, label]) => (
              <ScoreBar key={key} label={label} value={scores[key as keyof typeof scores] ?? 50} />
            ))}
          </div>
        </div>
      </section>

      {findings.length > 0 && (
        <section className="agr-section">
          <SectionHead kicker="Havlo's assessment" title="Why it may not be selling" />
          <div className="slw-why-not-selling">
            {findings.map((finding, i) => {
              const structured = finding.evidence && finding.impact && finding.recommend;
              const [ev, im, rec] = structured
                ? [finding.evidence as string, finding.impact as string, finding.recommend as string]
                : splitIntoThree(finding.description || '');
              return (
                <div className="slw-why-card" key={finding.title || i}>
                  <h3>{String(i + 1).padStart(2, '0')} &mdash; {finding.title}</h3>
                  <div><span className="slw-why-label slw-why-evidence">EVIDENCE</span><ExpandableText text={ev} maxChars={180} /></div>
                  <div><span className="slw-why-label slw-why-impact">IMPACT</span><ExpandableText text={im} maxChars={180} /></div>
                  <div><span className="slw-why-label slw-why-recommend">RECOMMEND</span><ExpandableText text={rec} maxChars={180} /></div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {intel?.branch && h && (
        <section className="agr-section">
          <SectionHead kicker="Commercial" title="What's at stake for the branch" />
          <div className="agr-tray agr-kpis agr-kpis-compact">
            <Kpi label="Commission on this instruction" value={money(commission(h.price, fee))}><FeeInput fee={fee} onChange={setFee} /></Kpi>
            <Kpi label="Your stale listings" value={intel.branch.stale_listings} sub={`worth ${money(intel.branch.stale_value)} in asking prices`} />
            <Kpi label="Commission tied up in them" value={money(commission(intel.branch.stale_value, fee))} sub="at your fee" />
            <Kpi label="This listing" value={intel.branch.rank_by_time ? `#${intel.branch.rank_by_time}` : '—'} sub={`longest-running of your ${intel.branch.stale_listings}`} />
          </div>
        </section>
      )}

      {plan.length > 0 && (
        <section className="agr-section">
          <SectionHead kicker="30-day action plan" title="The next four weeks" />
          <div className="slw-thirty-day-grid">
            {plan.slice(0, 4).map((w) => (
              <div className="slw-week-card" key={w.week}>
                <span>Week {w.week}</span>
                <b>{w.title}</b>
              </div>
            ))}
          </div>
        </section>
      )}

      {intel?.health_components && (
        <section className="agr-section">
          <SectionHead kicker="How the health score is made" title="Instruction health breakdown" />
          <div className="agr-card agr-health">
            {Object.entries(intel.health_components).filter(([, v]) => v != null).map(([k, v]) => (
              <ScoreBar key={k} label={k} value={v as number} />
            ))}
          </div>
        </section>
      )}

      <div className="slw-recommendation-callout slw-noprint agr-recommendation">
        <b>Havlo Stale Listing Recommendation</b>
        <button type="button" className="slw-btn-black" onClick={onOpenRecommendation}>View full recommendation</button>
      </div>
      <div className="slw-print-recommendation">
        <h2 className="slw-section-heading">Havlo Stale Listing Recommendation</h2>
        <div className="slw-modal-body">
          <RecommendationContent contactName={report.contact_name || ''} actions={data.action_plan || []} />
        </div>
      </div>

      <div className="agr-card agr-watch slw-noprint">
        <div>
          <b>Weekly instruction watch</b>
          <p>Your 90-day dashboard checks this listing daily and the homes around it weekly: new competition, price cuts and homes going under offer.</p>
        </div>
        <button type="button" className="slw-btn-outline" onClick={onOpenDashboard}>Open the instruction watch</button>
      </div>

      <div className="agr-footnote">
        <p>
          <b>How this is worked out:</b> The assessment uses the Havlo Index &mdash; Havlo&rsquo;s proprietary scoring model designed to identify the factors that may be affecting a property listing&rsquo;s ability to secure a buyer &mdash; alongside the listing&rsquo;s market position, performance, local competition and Havlo&rsquo;s assessment of its buyer appeal.
        </p>
        <p>
          The local benchmark is the typical time similar homes still for sale nearby have been listed, rather than how long previously sold homes took to sell.
        </p>
        <p>
          The Comparable Success Gap measures similar homes listed after this property that have already progressed to under offer or Sold STC, together with comparable nearby homes that completed a sale after this property was listed.
        </p>
        <p>
          Commission is an estimate based on the agency fee you enter, plus VAT.
        </p>
      </div>
      <AgentReportStyles />
    </section>
  );
};

const AgentReportStyles = () => (
  <style>{`
    .agr{font-family:'Inter',sans-serif;color:#1F1F1E;margin:0 0 40px;--agr-ink:#1F1F1E;--agr-muted:#5B6575;--agr-line:#ECECF0;--agr-tray:#F5F6F8;--agr-accent:#A409D2}
    .agr h1,.agr h2,.agr h3,.agr-kpi-value,.agr-view-item>b,.agr-property dd{font-family:'Plus Jakarta Sans','Inter',sans-serif;letter-spacing:-0.03em;color:var(--agr-ink)}
    .agr h1{font-weight:800;font-size:40px;line-height:1.1;margin:4px 0 0}
    .agr h2{font-weight:700;font-size:28px;line-height:1.2;margin:4px 0 0}
    .agr h3{font-weight:700;font-size:17px;line-height:1.3;margin:0 0 12px}
    .agr-eyebrow{margin:0;font-family:'Inter',sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--agr-accent)}
    .agr-muted,.agr-note{color:var(--agr-muted);font-size:14.5px;line-height:1.55;margin:0}
    .agr-note{margin:12px 2px 0}
    .agr-error{color:#c02626;font-size:14px;margin:10px 0 0}
    .agr-footnote{color:#8A93A3;font-size:12.5px;line-height:1.55;margin:28px 0 0}
    .agr-footnote p{margin:0 0 8px}
    .agr-footnote b{font-weight:600}
    .agr-section{margin-top:48px}
    .agr-section-head{margin:0 0 16px}
    .agr-section-intro p{color:var(--agr-muted);font-size:15px;line-height:1.55;margin:8px 0 0;max-width:820px}
    .agr-tray{background:var(--agr-tray);border-radius:18px;padding:14px}
    .agr-card{background:#fff;border-radius:14px;padding:20px;min-width:0}
    .agr-tray>.agr-card,.agr-two>.agr-card{border:0}
    .agr-section>.agr-card,.agr-stack>.agr-card,.agr-sold .slw-sold-comps{border:1px solid var(--agr-line)}

    /* Head */
    .agr-report-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin:0 0 22px}
    .agr-head-actions{display:flex;gap:10px;flex-wrap:wrap}
    .agr-head-btn{width:auto!important;margin:0!important;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 20px!important;white-space:nowrap}
    .agr-head-btn:disabled{opacity:.7;cursor:progress}

    /* Property + summary */
    .agr-hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px}
    .agr-property{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:22px;padding:12px}
    .agr-property-image{border-radius:10px;min-height:250px;background:#e5e7eb center/cover no-repeat}
    .agr-property-text{display:flex;flex-direction:column;justify-content:space-between;gap:18px;padding:10px 10px 10px 0;min-width:0}
    .agr-property h2{font-size:26px;line-height:1.15;overflow-wrap:anywhere}
    .agr-facts{display:grid;grid-template-columns:1fr 1fr;gap:16px 18px;margin:0;border-top:1px solid #e5e7eb;padding-top:18px}
    .agr-facts div{min-width:0}
    .agr-facts dt{font-size:13px;color:var(--agr-muted);margin:0 0 4px}
    .agr-facts dd{margin:0;font-weight:800;font-size:24px;line-height:1.1;overflow-wrap:anywhere}
    .agr-facts dd em{font-style:normal;color:#9AA3B2;font-size:15px}
    .agr-facts dd.agr-small{font-size:17px;font-weight:700;line-height:1.25}
    .agr-accent{color:var(--agr-accent)!important}
    .agr-hl{color:#EA580C!important}
    .agr-summary b{display:block;font-family:'Plus Jakarta Sans','Inter',sans-serif;font-weight:700;font-size:22px;letter-spacing:-0.03em;margin:0 0 14px}
    .agr-summary p{color:#4B5563;line-height:1.65;margin:0;font-size:14.5px}
    .agr-basis{color:var(--agr-muted);font-size:13.5px;line-height:1.5;margin:12px 4px 0}

    /* KPI cards */
    .agr-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .agr-tray.agr-kpis{padding:14px}
    .agr-kpi{background:#fff;border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:6px;min-width:0}
    .agr-kpi-label{font-size:13px;color:var(--agr-muted);font-weight:600;line-height:1.3}
    .agr-kpi-value{font-size:28px;font-weight:800;line-height:1.1;overflow-wrap:anywhere}
    .agr-kpi-value em{font-style:normal;color:#9AA3B2;font-size:16px;font-weight:700}
    .agr-tone-good .agr-kpi-value{color:#0E7D4C}
    .agr-tone-warn .agr-kpi-value{color:#B14F0A}
    .agr-tone-bad .agr-kpi-value{color:#B42318}
    .agr-kpi-sub{font-size:13px;color:var(--agr-muted);line-height:1.45}
    .agr-kpi-break{display:block;margin-top:4px;color:#344054;font-weight:600}
    .agr-kpis-compact .agr-kpi-value{font-size:24px}
    .agr-meter{display:block;height:6px;border-radius:999px;background:#EEF0F3;overflow:hidden;margin:2px 0}
    .agr-meter i{display:block;height:100%;border-radius:999px;background:#98A2B3}
    .agr-tone-good .agr-meter i{background:#16A34A}.agr-tone-warn .agr-meter i{background:#F59E0B}.agr-tone-bad .agr-meter i{background:#E33709}
    .agr-fee{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--agr-muted);margin-top:auto;padding-top:4px}
    .agr-fee span{white-space:nowrap}
    .agr-fee input{width:58px;flex:none;border:1px solid #d0d5dd;border-radius:8px;padding:5px 6px;font-size:13.5px;font-family:inherit;color:var(--agr-ink);background:#fff}

    .agr-pill{display:inline-flex;align-items:center;font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;background:#f2f4f7;color:#344054;white-space:nowrap}
    .agr-pill-good{background:#E8F7EF;color:#0E7D4C}.agr-pill-warn{background:#FFF4E5;color:#B14F0A}.agr-pill-bad{background:#FDECEC;color:#B42318}

    /* Loading / locked */
    .agr-preparing{display:flex;gap:14px;align-items:center;border:1px dashed #e4c6f2;border-radius:16px;padding:18px;margin:18px 0;background:#fcf7ff}
    .agr-preparing p{margin:4px 0 0;color:var(--agr-muted);font-size:14px}
    .agr-spinner{flex:none;width:24px;height:24px;border-radius:50%;border:3px solid #ecd5f7;border-top-color:var(--agr-accent);animation:agrspin 1s linear infinite}
    @keyframes agrspin{to{transform:rotate(360deg)}}
    .agr-teaser{margin-top:36px}
    .agr-locked{display:flex;align-items:center;justify-content:space-between;gap:18px;border:1.5px solid #e4c6f2;border-radius:16px;padding:18px 20px;background:linear-gradient(180deg,#fcf7ff,#fff);margin-top:14px}
    .agr-locked b{font-family:'Plus Jakarta Sans','Inter',sans-serif;font-size:18px;letter-spacing:-0.02em}
    .agr-locked p{margin:6px 0 0;color:#475467;font-size:14px;line-height:1.55}
    .agr-unlock{width:auto!important;white-space:nowrap;padding:14px 20px!important;margin:0!important}

    /* Vendor view */
    .agr-view{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .agr-view-item{display:flex;flex-direction:column;gap:4px;padding:16px 18px}
    .agr-view-item>b{font-size:26px;font-weight:800;line-height:1.1;color:var(--agr-accent)}
    .agr-view-item>span{font-size:14.5px;line-height:1.5;color:#344054}
    .agr-pressure{margin-top:14px;border:1px solid #F6D3CF!important;background:#FFF8F7}
    .agr-pressure-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
    .agr-pressure-head b{font-size:15px}
    .agr-pressure ul{list-style:disc;margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;color:#3F2A28;font-size:14px;line-height:1.5}
    .agr-insight{background:#f7ecfc;border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.55;margin:14px 0 0;color:#3a2b44}

    /* Actions */
    .agr-actions{list-style:none;margin:0;display:flex;flex-direction:column;gap:10px}
    .agr-actions li{display:flex;gap:14px;align-items:flex-start;padding:16px 18px}
    .agr-action-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .agr-action-title b{font-size:15.5px}
    .agr-actions p{margin:6px 0 0;color:var(--agr-muted);font-size:14px;line-height:1.5}
    .agr-num{flex:none;width:28px;height:28px;border-radius:50%;background:var(--agr-accent);color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center}

    /* Two columns */
    .agr-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .agr-tray.agr-two{margin-top:12px}
    .agr-section-head+.agr-tray.agr-two{margin-top:0}
    .agr-quotes,.agr-bullets{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px;font-size:14.5px;line-height:1.55;color:#344054}
    .agr-bullets{list-style:disc}
    .agr-bullets li::marker,.agr-pressure li::marker{color:#A409D2}
    .agr-quotes{list-style:none;padding-left:0}
    .agr-quotes li{padding-left:12px;border-left:3px solid #ecd5f7}

    /* Homes */
    .agr-stack{display:flex;flex-direction:column;gap:12px;margin-top:12px}
    .agr-list-card{padding:18px 20px 8px}
    .agr-list-head{display:flex;flex-direction:column;gap:2px;margin-bottom:6px}
    .agr-list-head b{font-size:16px}
    .agr-list-head span{font-size:13px;color:var(--agr-muted)}
    .agr-homes{list-style:none;margin:0;padding:0}
    .agr-homes li{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px 0;border-top:1px solid #F0F1F3}
    .agr-home-main{display:flex;flex-direction:column;gap:3px;min-width:0}
    .agr-home-main a,.agr-home-addr{font-size:14.5px;font-weight:600;color:var(--agr-ink);text-decoration:none;overflow-wrap:anywhere}
    .agr-home-main a:hover{color:var(--agr-accent)}
    .agr-home-main small{font-size:12.5px;color:var(--agr-muted);line-height:1.45}
    .agr-home-side{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex:none}
    .agr-home-side b{font-size:15px;white-space:nowrap}

    /* Agencies */
    .agr-agencies{padding:6px 20px}
    .agr-agency{display:grid;grid-template-columns:minmax(0,1.8fr) repeat(3,minmax(0,1fr)) minmax(0,1.2fr);gap:12px;align-items:center;padding:12px 0;border-top:1px solid #F0F1F3;font-size:14px}
    .agr-agency-head{border-top:0;font-size:12px;font-weight:700;color:var(--agr-muted);padding:10px 0}
    .agr-agency-name{display:flex;flex-direction:column;gap:2px;min-width:0}
    .agr-agency-name b{font-weight:600;overflow-wrap:anywhere}
    .agr-agency-name em{font-style:normal;font-size:12px;color:var(--agr-accent);font-weight:700}
    .agr-agency i{display:none;font-style:normal}
    .agr-agency-stat b,.agr-agency-share b{font-weight:700}
    .agr-agency-share{display:flex;align-items:center;gap:10px}
    .agr-share-bar{flex:1;height:6px;border-radius:999px;background:#F0EDF5;overflow:hidden;min-width:30px}
    .agr-share-bar span{display:block;height:100%;background:linear-gradient(90deg,#A409D2,#c65ae8)}
    .agr-agency-you{background:#fcf7ff;margin:0 -20px;padding:12px 20px}

    .agr-sold{margin-top:12px}
    .agr-sold .slw-sold-comps{margin:0}
    .agr-health{border:1px solid var(--agr-line)}
    .agr-recommendation{margin-top:48px}
    .agr-watch{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:24px;border:1px solid var(--agr-line)}
    .agr-watch b{font-size:16px}
    .agr-watch p{margin:6px 0 0;color:var(--agr-muted);font-size:14px;line-height:1.5}
    .agr-watch .slw-btn-outline{width:auto;margin:0;white-space:nowrap}

    @media (max-width:1100px){
      .agr-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
      .agr-hero{grid-template-columns:1fr}
    }
    @media (max-width:900px){
      .agr h1{font-size:30px}
      .agr h2{font-size:23px}
      .agr-section{margin-top:36px}
      .agr-report-head{flex-direction:column;align-items:stretch;gap:16px}
      .agr-head-actions{flex-direction:column}
      .agr-head-btn{width:100%!important}
      .agr-tray{padding:10px;border-radius:16px}
      .agr-kpis{gap:10px}
      .agr-tray.agr-kpis{padding:10px}
      .agr-kpi{padding:14px}
      .agr-kpi-value{font-size:23px}
      .agr-kpis-compact .agr-kpi-value{font-size:21px}
      .agr-property{grid-template-columns:1fr;padding:10px;gap:14px}
      .agr-property-image{min-height:190px}
      .agr-property-text{padding:4px 6px 8px}
      .agr-property h2{font-size:23px}
      .agr-facts dd{font-size:21px}
      .agr-card{padding:16px}
      .agr-view-item{padding:14px 16px}
      .agr-view-item>b{font-size:22px}
      .agr-two{grid-template-columns:1fr}
      .agr-actions li{padding:14px}
      .agr-locked{flex-direction:column;align-items:stretch}
      .agr-unlock{width:100%!important}
      .agr-list-card{padding:14px 16px 4px}
      .agr-agencies{padding:2px 16px}
      .agr-agency{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 10px;padding:14px 0}
      .agr-agency-head{display:none}
      .agr-agency-name{grid-column:1/-1}
      .agr-agency i{display:block;font-size:11.5px;color:var(--agr-muted);font-weight:500;line-height:1.3}
      .agr-agency-stat,.agr-agency-share{display:flex;flex-direction:column;gap:2px}
      .agr-agency-share{grid-column:1/-1;flex-direction:row;align-items:center;gap:8px}
      .agr-agency-share i{flex:none}
      .agr-agency-you{margin:0 -16px;padding:14px 16px}
      .agr-watch{flex-direction:column;align-items:stretch}
      .agr-fee{gap:5px;font-size:12px}
      .agr-fee input{width:50px;padding:4px 5px}
      .agr-recommendation{border-width:10px;padding:18px}
      .agr-recommendation b{font-size:22px;overflow-wrap:anywhere}
      .agr-watch .slw-btn-outline{width:100%}
    }
    @media (max-width:640px){
      .agr-view{grid-template-columns:1fr}
    }
    @media (max-width:360px){
      .agr-kpis{grid-template-columns:1fr}
    }
    @media print{
      .agr-head-actions,.agr-watch,.agr-fee input{display:none!important}
      .agr-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .agr-hero,.agr-two,.agr-view{grid-template-columns:1fr!important}
      .agr-kpi,.agr-card,.agr-view-item,.agr-actions li{break-inside:avoid;page-break-inside:avoid}
      .agr-section-head{break-after:avoid;page-break-after:avoid}
    }
  `}</style>
);

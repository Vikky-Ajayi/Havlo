import { useEffect, useState, type ReactNode } from 'react';
import { getAgentIntel, getProspectDashboardLink } from './api';
import { formatGbp, type AgentIntel, type AgentIntelHome } from './types';

// The agent-facing report on one of an agency's stale listings
// (app/services/agent_report.py): the eight headline figures on the free
// assessment (AgentTeaser), everything after purchase (AgentFullReport).
// Commission uses a fee the agent can change (kept in this browser).

type Access = { token?: string; code?: string };

const FEE_KEY = 'havlo_agent_fee_percent';
const DEFAULT_FEE = 1.2;
const VAT = 0.2;

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
        } else if (tries++ < 40) {
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

const LEVEL_TONE: Record<string, string> = {
  Low: 'good', Limited: 'neutral', Routine: 'good',
  Moderate: 'warn', Elevated: 'warn', Soon: 'warn', Medium: 'warn',
  High: 'bad', Priority: 'bad', Strong: 'good',
  Critical: 'bad', Immediate: 'bad', 'Immediate review': 'bad',
};

const Pill = ({ value }: { value: string }) => <span className={`agr-pill agr-${LEVEL_TONE[value] || 'neutral'}`}>{value}</span>;

const radiusText = (r: number | null | undefined) => (r === 1 ? 'a mile' : 'half a mile');

const FeeInput = ({ fee, onChange }: { fee: number; onChange: (v: number) => void }) => (
  <label className="agr-fee">
    Your fee
    <input
      type="number"
      min={0.1}
      max={9.9}
      step={0.05}
      value={fee}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v) && v > 0 && v < 10) onChange(v);
      }}
    />
    % + VAT
  </label>
);

const Metric = ({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) => (
  <div className={`agr-metric ${tone ? `agr-metric-${tone}` : ''}`}>
    <span>{label}</span>
    <b>{value}</b>
    {sub && <small>{sub}</small>}
  </div>
);

const Headline = ({ intel, fee, onFee }: { intel: AgentIntel; fee: number; onFee: (v: number) => void }) => {
  const h = intel.headline;
  const c = commission(h.price, fee);
  return (
    <div className="agr-metrics">
      <Metric label="Instruction health" value={h.health != null ? <>{h.health}<em>/100</em></> : '—'} tone={h.health == null ? undefined : h.health < 45 ? 'bad' : h.health < 65 ? 'warn' : 'good'} />
      <Metric label="Instruction risk" value={<Pill value={h.risk} />} />
      <Metric label="Vendor frustration risk" value={<Pill value={h.vendor_frustration} />} />
      <Metric
        label="Days on the market"
        value={h.dom != null ? `${h.dom} days` : '—'}
        sub={h.dom_benchmark != null ? `vs ${h.dom_benchmark}-day local benchmark*` : h.dom == null ? 'Listed as price-reduced' : 'Too few similar homes nearby to benchmark'}
      />
      <Metric label="Competitor pressure" value={<Pill value={h.competitor_pressure} />} />
      <Metric
        label="Comparable success gap"
        value={h.success_gap}
        sub={h.success_gap === 1 ? 'similar home listed later is already under offer or sold STC' : 'similar homes listed later are already under offer or sold STC'}
      />
      <Metric label="Relaunch opportunity" value={<Pill value={h.relaunch} />} />
      <Metric
        label="Commission on this instruction"
        value={c ? formatGbp(c) : '—'}
        sub={<FeeInput fee={fee} onChange={onFee} />}
      />
    </div>
  );
};

const Preparing = () => (
  <div className="agr-preparing">
    <span className="agr-spinner" />
    <div>
      <b>Analysing the market around this listing…</b>
      <p>We&rsquo;re reading the homes for sale nearby, who&rsquo;s marketing them and what&rsquo;s selling. This takes up to a minute.</p>
    </div>
  </div>
);

export const AgentTeaser = ({ access, onUnlock }: { access: Access; onUnlock: () => void }) => {
  const { loading, intel, error } = useAgentIntel(access);
  const [fee, setFee] = useState(readFee);
  const changeFee = (v: number) => { setFee(v); saveFee(v); };
  return (
    <section className="agr agr-teaser">
      <p className="agr-eyebrow">Instruction intelligence</p>
      <h2>How exposed is this instruction?</h2>
      {loading && <Preparing />}
      {error && <p className="agr-error">{error}</p>}
      {intel && (
        <>
          <p className="agr-muted">
            Compared with {intel.comparables} {intel.basis_label} within {radiusText(intel.radius)}.
          </p>
          <Headline intel={intel} fee={fee} onFee={changeFee} />
          <div className="agr-locked">
            <div>
              <b>Unlock the full agent report</b>
              <p>What your vendor can see &middot; the agencies competing around this listing &middot; price position and evidence &middot; presentation against similar listings &middot; the questions your vendor is likely to ask, with talking points &middot; five prioritised actions and a 30-day plan.</p>
            </div>
            <button type="button" className="slw-btn-black agr-unlock" onClick={onUnlock}>Unlock the full report</button>
          </div>
          <p className="agr-footnote">* The local benchmark is the typical time similar homes still for sale nearby have been listed.</p>
        </>
      )}
      <AgentReportStyles />
    </section>
  );
};

const Section = ({ title, kicker, children }: { title: string; kicker?: string; children: ReactNode }) => (
  <section className="agr-section">
    {kicker && <p className="agr-eyebrow">{kicker}</p>}
    <h3>{title}</h3>
    {children}
  </section>
);

const statusLabel = (s: AgentIntelHome['status']) => ({ on_market: 'For sale', under_offer: 'Under offer', sold_stc: 'Sold STC', removed: 'Removed' }[s] || s);

const HomesTable = ({ homes }: { homes: AgentIntelHome[] }) => (
  <div className="agr-table-wrap">
    <table className="agr-table">
      <thead><tr><th>Home</th><th>Price</th><th>Status</th><th>Listed</th><th>Agent</th></tr></thead>
      <tbody>
        {homes.map((h) => (
          <tr key={`${h.address}-${h.first_listed}`}>
            <td>{h.url ? <a href={h.url} target="_blank" rel="noreferrer">{h.address}</a> : h.address}<small>{[h.bedrooms ? `${h.bedrooms} bed` : '', h.type, h.distance != null ? `${h.distance} mi` : ''].filter(Boolean).join(' · ')}</small></td>
            <td>{h.price ? formatGbp(h.price) : '—'}</td>
            <td>{statusLabel(h.status)}</td>
            <td>{h.first_listed ? new Date(`${h.first_listed}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
            <td>{h.agent || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const AgentFullReport = ({ access, address }: { access: Access; address: string }) => {
  const { loading, intel, error } = useAgentIntel(access);
  const [fee, setFee] = useState(readFee);
  const changeFee = (v: number) => { setFee(v); saveFee(v); };
  const [watchError, setWatchError] = useState('');

  const openWatch = async () => {
    try {
      const { url } = await getProspectDashboardLink(access);
      window.location.href = url;
    } catch {
      setWatchError('The weekly instruction watch opens once the report is purchased.');
    }
  };

  return (
    <section className="agr agr-full">
      <p className="agr-eyebrow">Instruction intelligence report</p>
      <h2>{address}</h2>
      {loading && <Preparing />}
      {error && <p className="agr-error">{error}</p>}
      {intel && (
        <>
          <p className="agr-muted">
            Compared with {intel.comparables} {intel.basis_label} within {radiusText(intel.radius)} (of {intel.nearby_total} homes for sale nearby).
            Updated {new Date(`${intel.generated_at}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.
          </p>
          <Headline intel={intel} fee={fee} onFee={changeFee} />

          {intel.vendor_view && (
            <Section kicker="The market is moving around this listing" title="What your vendor can see">
              <ul className="agr-list">
                <li><b>{intel.vendor_view.new_since_listed}</b> {intel.basis_label} have come to market nearby {intel.vendor_view.since_label}.</li>
                <li><b>{intel.vendor_view.agreed}</b> are under offer or sold STC{intel.vendor_view.agreed_since_listed ? <>, <b>{intel.vendor_view.agreed_since_listed}</b> of them listed after this one</> : ''}.</li>
                <li><b>{intel.vendor_view.competitor_agencies_agreed}</b> other {intel.vendor_view.competitor_agencies_agreed === 1 ? 'agency has' : 'agencies have'} homes in this segment under offer or sold STC.</li>
                {intel.headline.dom != null && intel.headline.dom_benchmark != null && (
                  <li>This home has been listed <b>{intel.headline.dom} days</b>; similar homes still for sale nearby have typically been listed <b>{intel.headline.dom_benchmark} days</b>.</li>
                )}
                {intel.vendor_view.reduced_nearby > 0 && <li><b>{intel.vendor_view.reduced_nearby}</b> competing homes nearby have recently reduced their price.</li>}
              </ul>
              <p className="agr-insight"><b>Havlo insight:</b> your vendor has access to much of the same market information. A proactive review backed by current evidence shows the instruction is being actively managed.</p>
            </Section>
          )}

          {intel.actions && (
            <Section kicker="Prioritised" title="What Havlo recommends you do now">
              <ol className="agr-actions">
                {intel.actions.map((a, i) => (
                  <li key={a.title}><span className="agr-num">{i + 1}</span><div><b>{a.title}</b> <Pill value={a.priority} /><p>{a.why}</p></div></li>
                ))}
              </ol>
            </Section>
          )}

          {intel.vendor && (
            <Section kicker={`Vendor conversation priority: ${intel.vendor.priority}`} title="Be ready for the next vendor call">
              <div className="agr-two">
                <div>
                  <h4>Questions your vendor is likely to ask</h4>
                  <ul className="agr-list">{intel.vendor.questions.map((q) => <li key={q}>&ldquo;{q}&rdquo;</li>)}</ul>
                </div>
                <div>
                  <h4>Evidence-backed talking points</h4>
                  <ul className="agr-list">{intel.vendor.talking_points.map((t) => <li key={t}>{t}</li>)}</ul>
                </div>
              </div>
            </Section>
          )}

          {intel.market && (
            <Section kicker="Local market movement" title="The competition around this listing">
              <div className="agr-metrics agr-metrics-small">
                <Metric label="Staleness" value={intel.market.staleness != null ? <>{intel.market.staleness}<em>/100</em></> : '—'} sub="share of similar homes for sale listed more recently" />
                <Metric label="Similar homes for sale" value={intel.market.for_sale} />
                <Metric label="Within 15% of your price" value={intel.market.alternatives} sub="buyers' alternatives" />
                <Metric label="New in the last 30 days" value={intel.market.new_30.length} />
              </div>
              {intel.market.sold_since.length > 0 && (<><h4>Listed after this one, already under offer or sold STC</h4><HomesTable homes={intel.market.sold_since} /></>)}
              {intel.market.new_30.length > 0 && (<><h4>New competition in the last 30 days</h4><HomesTable homes={intel.market.new_30} /></>)}
            </Section>
          )}

          {intel.competitors && (
            <Section kicker={`Competitor threat: ${intel.competitors.threat} · Exposure: ${intel.competitors.exposure}`} title="Competing agencies nearby">
              <p className="agr-muted">{intel.competitors.in_segment} other agencies are marketing similar homes nearby; {intel.competitors.agreed_in_segment} have one under offer or sold STC. These are the agents your vendor is likely to come across.</p>
              <div className="agr-table-wrap">
                <table className="agr-table">
                  <thead><tr><th>Agency</th><th>Homes listed nearby</th><th>Under offer / sold STC</th><th>New in 30 days</th><th>Share</th></tr></thead>
                  <tbody>
                    {intel.competitors.agencies.map((a) => (
                      <tr key={a.agent} className={a.you ? 'agr-you' : undefined}>
                        <td>{a.agent}{a.you && <small>Your agency</small>}</td>
                        <td>{a.listings}</td><td>{a.agreed}</td><td>{a.new_30}</td><td>{a.share}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {intel.competitors.momentum.length > 0 && (
                <p className="agr-muted"><b>Momentum:</b> {intel.competitors.momentum.map((a) => `${a.agent} (${a.new_30} new)`).join(', ')} took on new listings nearby in the last 30 days.</p>
              )}
            </Section>
          )}

          {intel.pricing && (
            <Section kicker={`Price reduction pressure: ${intel.pricing.reduction_pressure}`} title="Price position">
              <div className="agr-metrics agr-metrics-small">
                <Metric label="Asking price" value={intel.headline.price ? formatGbp(intel.headline.price) : '—'} />
                <Metric label="Middle of similar homes for sale" value={intel.pricing.median_for_sale ? formatGbp(intel.pricing.median_for_sale) : '—'} sub={intel.pricing.premium_pct != null ? (intel.pricing.premium_pct === 0 ? 'yours is in line' : `yours is ${Math.abs(intel.pricing.premium_pct)}% ${intel.pricing.premium_pct > 0 ? 'above' : 'below'}`) : undefined} />
                <Metric label="Price per bedroom" value={intel.pricing.price_per_bedroom ? formatGbp(intel.pricing.price_per_bedroom) : '—'} sub={intel.pricing.comparable_price_per_bedroom ? `similar homes: ${formatGbp(intel.pricing.comparable_price_per_bedroom)}` : undefined} />
                <Metric label="Recorded sales (12 months)" value={intel.pricing.sold_median ? formatGbp(intel.pricing.sold_median) : '—'} sub={intel.pricing.sold_count ? `middle of ${intel.pricing.sold_count} in the postcode sector` : 'none recorded'} />
              </div>
              <p className="agr-muted">
                {intel.pricing.cheaper_share != null && <>{intel.pricing.cheaper_share}% of similar homes for sale nearby are cheaper. </>}
                {intel.pricing.reduced_date ? <>Last reduced {intel.pricing.days_since_reduction} days ago.</> : <>No price reduction on record.</>}
              </p>
            </Section>
          )}

          {intel.presentation && (
            <Section kicker={`Relaunch opportunity: ${intel.freshness?.relaunch} · Listing fatigue: ${intel.freshness?.fatigue}`} title="Presentation and buyer appeal">
              <div className="agr-metrics agr-metrics-small">
                <Metric label="Portal presentation" value={<>{intel.presentation.score}<em>/100</em></>} sub="listing against similar ones, with Havlo's assessment" />
                <Metric label="Photos" value={intel.presentation.photos ?? '—'} sub={intel.presentation.comparable_photos ? `similar listings: ${intel.presentation.comparable_photos}` : undefined} />
                <Metric label="Floorplan" value={intel.presentation.floorplans ? 'Yes' : intel.presentation.floorplans === 0 ? 'No' : '—'} sub={`${intel.presentation.comparable_floorplan_share}% of similar listings have one`} />
                <Metric label="Buyer appeal" value={intel.presentation.buyer_appeal != null ? <>{Math.round(intel.presentation.buyer_appeal)}<em>/100</em></> : '—'} sub="Havlo's assessment" />
              </div>
              {intel.presentation.gaps.length > 0 ? (
                <><h4>What to fix</h4><ul className="agr-list">{intel.presentation.gaps.map((g) => <li key={g}>{g[0].toUpperCase() + g.slice(1)}</li>)}</ul></>
              ) : intel.presentation.photos == null && intel.presentation.floorplans == null ? (
                <p className="agr-muted">We couldn&rsquo;t read the listing&rsquo;s photos and floorplan this time; they&rsquo;re checked again when the report next updates.</p>
              ) : <p className="agr-muted">The listing&rsquo;s photos, floorplan and copy compare well with similar listings nearby.</p>}
              {intel.presentation.findings.length > 0 && (
                <><h4>From Havlo's assessment</h4><ul className="agr-list">{intel.presentation.findings.map((f) => <li key={f.title}><b>{f.title}.</b> {f.detail}</li>)}</ul></>
              )}
            </Section>
          )}

          {intel.branch && (
            <Section kicker="Commercial" title="What's at stake for the branch">
              <div className="agr-metrics agr-metrics-small">
                <Metric label="Commission on this instruction" value={formatGbp(commission(intel.headline.price, fee) || 0)} sub={<FeeInput fee={fee} onChange={changeFee} />} />
                <Metric label="Your stale listings" value={intel.branch.stale_listings} sub={`worth ${formatGbp(intel.branch.stale_value)} in asking prices`} />
                <Metric label="Commission tied up in them" value={formatGbp(commission(intel.branch.stale_value, fee) || 0)} sub="at your fee" />
                <Metric label="This listing" value={intel.branch.rank_by_time ? `#${intel.branch.rank_by_time}` : '—'} sub={`longest-running of your ${intel.branch.stale_listings}`} />
              </div>
            </Section>
          )}

          {intel.plan && intel.plan.length > 0 && (
            <Section kicker="30-day action plan" title="The next four weeks">
              <ol className="agr-weeks">{intel.plan.map((w) => <li key={w.week}><span>Week {w.week}</span>{w.title}</li>)}</ol>
            </Section>
          )}

          {intel.health_components && (
            <Section kicker="How the health score is made" title="Instruction health breakdown">
              <div className="agr-bars">
                {Object.entries(intel.health_components).filter(([, v]) => v != null).map(([k, v]) => (
                  <div key={k}><span>{k}</span><div className="agr-bar"><i style={{ width: `${v}%` }} /></div><b>{v}</b></div>
                ))}
              </div>
            </Section>
          )}

          <Section kicker="Weekly instruction watch" title="Track what changes">
            <p className="agr-muted">Your 90-day dashboard checks this listing daily and the homes around it weekly: new competition, price cuts and homes going under offer.</p>
            <button type="button" className="slw-btn-outline agr-watch" onClick={openWatch}>Open the weekly instruction watch</button>
            {watchError && <p className="agr-error">{watchError}</p>}
          </Section>

          <p className="agr-footnote">
            How this is worked out: homes for sale within {radiusText(intel.radius)} on Rightmove (price, status, when listed, agency), recorded sales from HM Land Registry, and Havlo&rsquo;s assessment of the listing.
            The local benchmark is the typical time similar homes still for sale nearby have been listed, not how long sold homes took. Commission is an estimate at the fee you enter, plus VAT.
          </p>
        </>
      )}
      <AgentReportStyles />
    </section>
  );
};

const AgentReportStyles = () => (
  <style>{`
    .agr{font-family:'Inter',sans-serif;color:#202124;margin:0 0 40px}
    .agr h2{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:30px;line-height:1.1;margin:4px 0 8px}
    .agr h3{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:22px;margin:4px 0 12px}
    .agr h4{font-size:15px;margin:18px 0 8px}
    .agr-eyebrow{margin:0;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#A409D2}
    .agr-muted{color:#556274;font-size:14.5px;line-height:1.55;margin:0 0 14px}
    .agr-error{color:#c02626;font-size:14px}
    .agr-footnote{color:#98a2b3;font-size:12.5px;line-height:1.5;margin:16px 0 0}
    .agr-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:12px 0}
    .agr-metric{border:1px solid #ececf0;border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:6px;background:#fff;min-width:0}
    .agr-metric>span{font-size:12.5px;color:#667085;font-weight:600}
    .agr-metric>b{font-size:22px;font-weight:800;letter-spacing:-0.02em}
    .agr-metric>b em{font-style:normal;color:#98a2b3;font-size:15px}
    .agr-metric small{font-size:12.5px;color:#667085;line-height:1.4}
    .agr-metric-bad>b{color:#B42318}.agr-metric-warn>b{color:#B14F0A}.agr-metric-good>b{color:#0E7D4C}
    .agr-metrics-small .agr-metric>b{font-size:19px}
    .agr-pill{display:inline-block;font-size:14px;font-weight:800;padding:4px 11px;border-radius:999px;background:#f2f4f7;color:#344054;letter-spacing:0}
    .agr-good{background:#E8F7EF;color:#0E7D4C}.agr-warn{background:#FFF4E5;color:#B14F0A}.agr-bad{background:#FDECEC;color:#B42318}
    .agr-fee{display:flex;align-items:center;gap:6px;font-size:12.5px;color:#667085;flex-wrap:wrap}
    .agr-fee input{width:62px;border:1px solid #d0d5dd;border-radius:7px;padding:3px 6px;font-size:13px;font-family:inherit}
    .agr-preparing{display:flex;gap:14px;align-items:center;border:1px dashed #e4c6f2;border-radius:16px;padding:18px;margin:12px 0;background:#fcf7ff}
    .agr-preparing p{margin:4px 0 0;color:#556274;font-size:14px}
    .agr-spinner{flex:none;width:24px;height:24px;border-radius:50%;border:3px solid #ecd5f7;border-top-color:#A409D2;animation:agrspin 1s linear infinite}
    @keyframes agrspin{to{transform:rotate(360deg)}}
    .agr-locked{display:flex;align-items:center;justify-content:space-between;gap:18px;border:1.5px solid #e4c6f2;border-radius:16px;padding:18px 20px;background:linear-gradient(180deg,#fcf7ff,#fff);margin-top:6px}
    .agr-locked p{margin:6px 0 0;color:#475467;font-size:14px;line-height:1.55}
    .agr-unlock{width:auto!important;white-space:nowrap;padding:14px 20px!important}
    .agr-section{border-top:1px solid #f0f0f3;padding-top:24px;margin-top:24px}
    .agr-list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px;font-size:14.5px;line-height:1.55;color:#344054}
    .agr-insight{background:#f7ecfc;border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.55;margin:14px 0 0;color:#3a2b44}
    .agr-actions{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
    .agr-actions li{display:flex;gap:12px;align-items:flex-start;border:1px solid #ececf0;border-radius:14px;padding:14px}
    .agr-actions p{margin:6px 0 0;color:#556274;font-size:14px;line-height:1.5}
    .agr-actions .agr-pill{font-size:11.5px;padding:3px 8px;margin-left:6px}
    .agr-num{flex:none;width:26px;height:26px;border-radius:50%;background:#A409D2;color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center}
    .agr-two{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .agr-table-wrap{overflow-x:auto;border:1px solid #ececf0;border-radius:12px}
    .agr-table{width:100%;border-collapse:collapse;font-size:13.5px}
    .agr-table th{text-align:left;font-size:12px;color:#667085;font-weight:700;padding:10px 12px;background:#f9fafb;white-space:nowrap}
    .agr-table td{padding:10px 12px;border-top:1px solid #f2f2f5;vertical-align:top}
    .agr-table td small{display:block;color:#667085;font-size:12px;margin-top:2px}
    .agr-table a{color:#202124}
    .agr-you td{background:#fcf7ff;font-weight:700}
    .agr-weeks{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
    .agr-weeks li{border:1px solid #ececf0;border-radius:12px;padding:12px;font-size:14px;font-weight:600}
    .agr-weeks span{display:block;color:#A409D2;font-size:12px;font-weight:800;margin-bottom:4px}
    .agr-bars{display:flex;flex-direction:column;gap:10px}
    .agr-bars>div{display:grid;grid-template-columns:170px 1fr 36px;gap:10px;align-items:center;font-size:13.5px}
    .agr-bar{height:8px;border-radius:999px;background:#f0edf5;overflow:hidden}
    .agr-bar i{display:block;height:100%;background:linear-gradient(90deg,#A409D2,#c65ae8)}
    .agr-watch{width:auto!important;padding:12px 18px!important;margin-top:0!important}
    @media (max-width:900px){
      .agr h2{font-size:24px}
      .agr-metrics{grid-template-columns:1fr 1fr;gap:10px}
      .agr-two{grid-template-columns:1fr}
      .agr-weeks{grid-template-columns:1fr 1fr}
      .agr-locked{flex-direction:column;align-items:stretch}
      .agr-unlock{width:100%!important}
      .agr-bars>div{grid-template-columns:120px 1fr 32px}
    }
  `}</style>
);

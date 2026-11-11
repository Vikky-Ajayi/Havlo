import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { API_BASE } from '../lib/api';
import { useAuth } from '../context/AuthContext';

// The in-house assessment dataset (app/services/assessment_dataset.py): one
// anonymous row per assessment, and what the reports found across all of
// them. Admin sign-in only (it's the company's data asset): the stats, the
// CSV export and "Sync now" all need it.

type Share = { label: string; count: number; pct: number | null };
type Flag = {
  key: string; label: string; known: number; count: number; pct: number | null;
  median_days_with: number | null; median_days_without: number | null;
  paid_rate_with: number | null; paid_rate_without: number | null;
  agreed_rate_with: number | null; agreed_rate_without: number | null;
};
type Factor = { key: string; num: number; name: string; count: number; problem_pct: number | null; working_well_pct: number | null; check_pct: number | null; avg_severity: number | null };
type Stats = {
  total: number; listings: number; records_in_dataset: number;
  headline: { median_days_on_market: number | null; average_score: number | null; reduced_pct: number | null; over_180_pct: number | null; median_price: number | null; v2_reports: number; photo_reviewed: number };
  funnel: { looked_up: number; gave_details: number; reached_checkout: number; paid: number; addon_paid: number; paid_rate: number | null };
  outcomes: { watched: number; agreed: number; agreed_pct: number | null; median_days_to_agreed: number | null; by_status: Record<string, number>; changes_made: { kind: string; count: number }[]; change_effects: { kind: string; listings: number; agreed_rate_with: number | null; agreed_rate_without: number | null }[] };
  flags: Flag[]; factors: Factor[];
  missing_details: Share[]; missing_shots: { label: string; count: number }[];
  distributions: Record<string, Share[]>;
  agencies: { agency: string; assessments: number; poor_photos_pct: number | null; pricing_issue_pct: number | null; no_video_pct: number | null; median_days_on_market: number | null }[];
  by_month: { month: string; assessments: number; poor_photos_pct: number | null; pricing_issue_pct: number | null; no_video_pct: number | null; paid: number }[];
};

const CHANNELS = ['', 'letter', 'meta', 'meta2', 'google', 'review', 'sell', 'rm', 'manual'];
const TYPES = ['', 'detached', 'semi-detached', 'terraced', 'flat', 'bungalow', 'house', 'other'];
const BANDS = ['', 'under £200k', '£200k–350k', '£350k–500k', '£500k–750k', '£750k–1m', '£1m–2m', '£2m+'];
const DIST_TITLES: Record<string, string> = {
  days_on_market: 'Days on the market', price_band: 'Asking price', property_type: 'Property type', photos: 'Photos on the listing',
  score: 'Saleability score', epc: 'EPC rating in the listing', channel: 'Where the assessment came from', region: 'Top areas', report_model: 'Report written by',
};
const CHANGE_LABELS: Record<string, string> = {
  photos_updated: 'Photos changed', price_reduced: 'Price reduced', description_updated: 'Description changed',
  features_updated: 'Key features changed', featured_added: 'Made a featured listing', premium_added: 'Premium listing added',
  price_wording_changed: 'Price wording changed', agent_changed: 'Changed agent', listing_removed: 'Taken off the market',
  listing_relisted: 'Relisted', back_on_market: 'Back on the market',
};

const card: CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px' };
const th: CSSProperties = { padding: '8px 10px', fontWeight: 700, color: '#555', textAlign: 'left', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap', fontSize: 12 };
const td: CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #F0F0F0', fontSize: 13, verticalAlign: 'middle' };
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v}%`);
const num = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('en-GB'));

const Bar = ({ value, color = '#A409D2' }: { value: number | null; color?: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
    <div style={{ flex: 1, height: 8, background: '#F1F1F4', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, value ?? 0)}%`, height: '100%', background: color }} />
    </div>
    <b style={{ fontSize: 13, minWidth: 44, textAlign: 'right' }}>{pct(value)}</b>
  </div>
);

const Section = ({ title, note, children }: { title: string; note?: string; children: ReactNode }) => (
  <section style={{ margin: '26px 0 0' }}>
    <h3 style={{ fontSize: 17, margin: '0 0 4px' }}>{title}</h3>
    {note && <p style={{ margin: '0 0 10px', color: '#666', fontSize: 13 }}>{note}</p>}
    {children}
  </section>
);

const Pair = ({ a, b }: { a: string; b: string }) => (
  <span style={{ whiteSpace: 'nowrap' }}><b>{a}</b><span style={{ color: '#888' }}> vs {b}</span></span>
);

export const DatasetPanel = () => {
  const { token } = useAuth();
  const [filters, setFilters] = useState({
    date_from: '', date_to: '', channel: '', property_type: '', price_band: '', district: '', funnel: 'all', include_copies: false,
  });
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const query = useCallback(() => {
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v === '' || v === false || (k === 'funnel' && v === 'all')) return;
      q.set(k, String(v));
    });
    return q.toString();
  }, [filters]);

  const call = useCallback(async (path: string, init?: RequestInit) => {
    const res = await fetch(`${API_BASE}/stale-listings/prospects-console/dataset/${path}`, {
      ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try { detail = (await res.json()).detail || detail; } catch { /* not JSON */ }
      throw new Error(detail);
    }
    return res;
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      setStats(await (await call(`stats?${query()}`)).json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the dataset.');
    } finally {
      setLoading(false);
    }
  }, [token, call, query]);

  useEffect(() => { void load(); }, [load]);

  const exportCsv = async () => {
    setError('');
    try {
      const blob = await (await call(`export.csv?${query()}`)).blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href; a.download = `havlo-assessments-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    }
  };

  const syncNow = async () => {
    setNotice(''); setError('');
    try {
      const r = await (await call('sync', { method: 'POST' })).json();
      setNotice(`Synced ${r.synced} assessments (${r.added} new).`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed.');
    }
  };

  if (!token) {
    return <p style={{ color: '#92400E' }}>Sign in to heyhavlo.com with your admin account to see the assessment dataset.</p>;
  }

  const set = (k: keyof typeof filters, v: string | boolean) => setFilters((f) => ({ ...f, [k]: v }));
  const select = (k: keyof typeof filters, options: string[], blank: string) => (
    <select className="spc-select" value={String(filters[k])} onChange={(e) => set(k, e.target.value)}>
      {options.map((o) => <option key={o || 'all'} value={o}>{o || blank}</option>)}
    </select>
  );

  return (
    <div>
      <p style={{ color: '#555', fontSize: 14, maxWidth: 820, margin: '0 0 14px' }}>
        One anonymous row per assessment: what each report found about the listing, what the person did, and what happened
        to the listing afterwards. No names, emails, phone numbers or full addresses. It updates every 10 minutes.
      </p>
      <div className="spc-filters" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 13 }}>From <input type="date" className="spc-input" style={{ width: 150 }} value={filters.date_from} onChange={(e) => set('date_from', e.target.value)} /></label>
        <label style={{ fontSize: 13 }}>To <input type="date" className="spc-input" style={{ width: 150 }} value={filters.date_to} onChange={(e) => set('date_to', e.target.value)} /></label>
        {select('channel', CHANNELS, 'All sources')}
        {select('property_type', TYPES, 'All property types')}
        {select('price_band', BANDS, 'All prices')}
        <input className="spc-input" style={{ width: 130 }} placeholder="Postcode area" value={filters.district} onChange={(e) => set('district', e.target.value)} />
        <select className="spc-select" value={filters.funnel} onChange={(e) => set('funnel', e.target.value)}>
          <option value="all">Every assessment</option>
          <option value="engaged">Looked up by a person</option>
          <option value="paid">Paid reports only</option>
        </select>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#555' }}>
          <input type="checkbox" checked={filters.include_copies} onChange={(e) => set('include_copies', e.target.checked)} />
          Include copies (agency and second-homeowner copies of a listing)
        </label>
        <button type="button" className="spc-btn spc-btn-primary" onClick={exportCsv}>Export CSV</button>
        <button type="button" className="spc-btn spc-btn-ghost" onClick={syncNow}>Sync now</button>
      </div>
      {error && <p style={{ color: '#B91C1C', fontWeight: 700, fontSize: 13 }}>{error}</p>}
      {notice && <p style={{ color: '#15803D', fontWeight: 700, fontSize: 13 }}>{notice}</p>}
      {loading && !stats && <div className="spc-loading">Loading the dataset…</div>}

      {stats && (
        <>
          {stats.records_in_dataset === 0 && (
            <p style={{ color: '#92400E', fontSize: 13 }}>The dataset is still filling: the first sync runs a few minutes after a deploy (or press Sync now).</p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 14 }}>
            {[
              ['Assessments', num(stats.total)], ['Listings', num(stats.listings)],
              ['Median days on market', num(stats.headline.median_days_on_market)], ['On the market 180+ days', pct(stats.headline.over_180_pct)],
              ['Already reduced', pct(stats.headline.reduced_pct)], ['Average saleability score', num(stats.headline.average_score)],
              ['Median asking price', stats.headline.median_price ? `£${Math.round(stats.headline.median_price).toLocaleString('en-GB')}` : '—'],
              ['Paid (of those looked up)', `${num(stats.funnel.paid)} · ${pct(stats.funnel.paid_rate)}`],
            ].map(([label, value]) => (
              <div key={label} style={card}><div style={{ fontSize: 12, color: '#666' }}>{label}</div><div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div></div>
            ))}
          </div>

          <Section title="What the reports found" note="Share of assessments where it could be told (Known). The comparisons show the median days on the market, how many paid, and how many went under offer or sold STC during the watch, with the finding vs without it.">
            <div style={{ overflowX: 'auto', ...card, padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Finding', 'Share', 'Count / known', 'Median days on market', 'Paid', 'Under offer / sold STC'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {stats.flags.map((f) => (
                    <tr key={f.key}>
                      <td style={td}>{f.label}</td>
                      <td style={td}><Bar value={f.pct} /></td>
                      <td style={td}>{num(f.count)} / {num(f.known)}</td>
                      <td style={td}><Pair a={num(f.median_days_with)} b={num(f.median_days_without)} /></td>
                      <td style={td}><Pair a={pct(f.paid_rate_with)} b={pct(f.paid_rate_without)} /></td>
                      <td style={td}><Pair a={pct(f.agreed_rate_with)} b={pct(f.agreed_rate_without)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {stats.factors.length > 0 && (
            <Section title="The 20 factors" note={`Verdicts across ${num(stats.headline.v2_reports)} 20-factor reports.`}>
              <div style={{ overflowX: 'auto', ...card, padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Factor', 'Problem', 'Working well', 'Check with agent', 'Average severity'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {stats.factors.map((f) => (
                      <tr key={f.key}>
                        <td style={td}>{f.num}. {f.name}</td>
                        <td style={td}><Bar value={f.problem_pct} color="#DE2921" /></td>
                        <td style={td}>{pct(f.working_well_pct)}</td>
                        <td style={td}>{pct(f.check_pct)}</td>
                        <td style={td}>{f.avg_severity ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
            <Section title="What listings leave out" note="Details buyers look for that the description doesn't mention.">
              <div style={card}>{stats.missing_details.map((m) => (
                <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 8, alignItems: 'center', margin: '4px 0' }}>
                  <span style={{ fontSize: 13, textTransform: 'capitalize' }}>{m.label}</span><Bar value={m.pct} />
                </div>
              ))}</div>
            </Section>
            <Section title="Shots the photo review said were missing">
              <div style={card}>{stats.missing_shots.length ? stats.missing_shots.map((m) => (
                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, margin: '4px 0' }}><span>{m.label}</span><b>{m.count}</b></div>
              )) : <span style={{ color: '#888', fontSize: 13 }}>No photo reviews in this selection.</span>}</div>
            </Section>
          </div>

          <Section title="After the report" note={`Paid reports watched for 30 days: ${num(stats.outcomes.watched)}. Under offer or sold STC: ${num(stats.outcomes.agreed)} (${pct(stats.outcomes.agreed_pct)})${stats.outcomes.median_days_to_agreed != null ? `, a median ${stats.outcomes.median_days_to_agreed} days after paying` : ''}.`}>
            <div style={{ overflowX: 'auto', ...card, padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['What the owner changed', 'Listings', 'Under offer / sold STC, changed vs not'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {stats.outcomes.change_effects.map((c) => (
                    <tr key={c.kind}>
                      <td style={td}>{CHANGE_LABELS[c.kind] || c.kind}</td>
                      <td style={td}>{num(c.listings)}</td>
                      <td style={td}><Pair a={pct(c.agreed_rate_with)} b={pct(c.agreed_rate_without)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Breakdowns">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {(Object.entries(stats.distributions) as [string, Share[]][]).filter(([, rows]) => rows.length).map(([key, rows]) => (
                <div key={key} style={card}>
                  <b style={{ fontSize: 14 }}>{DIST_TITLES[key] || key}</b>
                  {rows.map((r) => (
                    <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, alignItems: 'center', margin: '5px 0' }}>
                      <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>{r.label} ({r.count})</span>
                      <Bar value={r.pct} color="#111" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Section>

          {stats.agencies.length > 0 && (
            <Section title="Agencies" note="The agencies with the most assessed listings in this selection.">
              <div style={{ overflowX: 'auto', ...card, padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Agency', 'Assessments', 'Poor photos', 'Pricing issue', 'No video / tour', 'Median days on market'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {stats.agencies.map((a) => (
                      <tr key={a.agency}>
                        <td style={td}>{a.agency}</td><td style={td}>{a.assessments}</td><td style={td}>{pct(a.poor_photos_pct)}</td>
                        <td style={td}>{pct(a.pricing_issue_pct)}</td><td style={td}>{pct(a.no_video_pct)}</td><td style={td}>{num(a.median_days_on_market)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {stats.by_month.length > 0 && (
            <Section title="By month">
              <div style={{ overflowX: 'auto', ...card, padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Month', 'Assessments', 'Poor photos', 'Pricing issue', 'No video / tour', 'Paid'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {stats.by_month.map((m) => (
                      <tr key={m.month}>
                        <td style={td}>{m.month}</td><td style={td}>{num(m.assessments)}</td><td style={td}>{pct(m.poor_photos_pct)}</td>
                        <td style={td}>{pct(m.pricing_issue_pct)}</td><td style={td}>{pct(m.no_video_pct)}</td><td style={td}>{num(m.paid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
};

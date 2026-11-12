import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { API_BASE } from '../lib/api';
import { useAuth } from '../context/AuthContext';

// Every Rightmove listing and agent the platform sees in its searches
// (app/services/listing_records.py), and each branch's track record: how many
// of its listings agree a sale within 180 days. Groundwork for the agent
// referral service. Admin sign-in only.

type Branch = {
  branch_id: string | null; agency: string | null; branch_name: string | null; main_areas: string[];
  listings: number; for_sale_now: number; agreed_seen: number; decided: number; agreed_within_180: number;
  share_within_180: number | null; median_days_to_agree: number | null; median_price: number | null;
  reduced_pct: number | null; fell_through: number; tour_pct: number | null; ranked: boolean;
};
type Records = {
  totals: {
    listings: number; branches: number; agencies: number; outcodes: number; tracked: number; agreed_seen: number;
    decided: number; share_within_180: number | null; ranked_branches: number; new_last_7_days: number; seen_last_7_days: number;
  };
  top_areas: { outcode: string; listings: number }[];
  branches: Branch[];
  rules: { decide_days: number; min_decided: number; precise_gap_days: number };
};

const TYPES = ['', 'detached', 'semi-detached', 'terraced', 'bungalow', 'flat', 'other'];
const card: CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px' };
const th: CSSProperties = { padding: '8px 10px', fontWeight: 700, color: '#555', textAlign: 'left', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap', fontSize: 12 };
const td: CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #F0F0F0', fontSize: 13, verticalAlign: 'middle' };
const num = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('en-GB'));
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v}%`);
const money = (v: number | null | undefined) => (v == null ? '—' : `£${v.toLocaleString('en-GB')}`);

export const AgentRecordsPanel = () => {
  const { token } = useAuth();
  const [filters, setFilters] = useState({ area: '', property_type: '', bedrooms: '', min_price: '', max_price: '', months: '12' });
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<Records | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rankedOnly, setRankedOnly] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError('');
    const q = new URLSearchParams();
    (Object.entries(applied) as [string, string][]).forEach(([k, v]) => { if (v) q.set(k, v); });
    try {
      const res = await fetch(`${API_BASE}/stale-listings/prospects-console/market-listings/track-records?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try { detail = (await res.json()).detail || detail; } catch { /* not JSON */ }
        throw new Error(typeof detail === 'string' ? detail : `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the agent records.');
    } finally {
      setLoading(false);
    }
  }, [token, applied]);

  useEffect(() => { void load(); }, [load]);

  if (!token) {
    return <p style={{ color: '#92400E' }}>Sign in to heyhavlo.com with your admin account to see the agent records.</p>;
  }

  const set = (k: keyof typeof filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const t = data?.totals;
  const rules = data?.rules;
  const branches = (data?.branches || []).filter((b) => !rankedOnly || b.ranked);

  return (
    <div>
      <p style={{ color: '#555', fontSize: 14, maxWidth: 860, margin: '0 0 14px' }}>
        Every Rightmove listing our searches see, with its estate agent: when it was listed, price cuts, and when it went under
        offer or sold STC. From these, each branch's record of getting homes sold. It fills by itself as the platform runs its
        usual searches (the 30-day watch, agent reports, link matching and inventory scans).
      </p>
      <form
        className="spc-filters"
        style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
        onSubmit={(e) => { e.preventDefault(); setApplied(filters); }}
      >
        <input className="spc-input" style={{ width: 140 }} placeholder="Area (DY or DY10)" value={filters.area} onChange={(e) => set('area', e.target.value)} />
        <select className="spc-select" value={filters.property_type} onChange={(e) => set('property_type', e.target.value)}>
          {TYPES.map((o) => <option key={o || 'all'} value={o}>{o || 'All property types'}</option>)}
        </select>
        <select className="spc-select" value={filters.bedrooms} onChange={(e) => set('bedrooms', e.target.value)}>
          <option value="">Any bedrooms</option>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} bed</option>)}
          <option value="5">5+ bed</option>
        </select>
        <input className="spc-input" style={{ width: 120 }} inputMode="numeric" placeholder="Min price" value={filters.min_price} onChange={(e) => set('min_price', e.target.value.replace(/\D/g, ''))} />
        <input className="spc-input" style={{ width: 120 }} inputMode="numeric" placeholder="Max price" value={filters.max_price} onChange={(e) => set('max_price', e.target.value.replace(/\D/g, ''))} />
        <select className="spc-select" value={filters.months} onChange={(e) => set('months', e.target.value)}>
          <option value="6">Last 6 months</option>
          <option value="12">Last 12 months</option>
          <option value="24">Last 2 years</option>
        </select>
        <button type="submit" className="spc-btn spc-btn-primary">Show</button>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#555' }}>
          <input type="checkbox" checked={rankedOnly} onChange={(e) => setRankedOnly(e.target.checked)} />
          Ranked branches only
        </label>
      </form>

      {error && <p style={{ color: '#B91C1C' }}>{error}</p>}
      {loading && !data && <p style={{ color: '#666' }}>Loading…</p>}

      {t && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, margin: '16px 0' }}>
            {[
              ['Listings recorded', num(t.listings), `${num(t.new_last_7_days)} new in the last 7 days`],
              ['Agent branches', num(t.branches), `${num(t.agencies)} agencies`],
              ['Postcode districts', num(t.outcodes), `${num(t.seen_last_7_days)} listings seen this week`],
              ['Seen under offer / sold STC', num(t.agreed_seen), `${num(t.tracked)} listings followed closely`],
              [`Outcome known (${rules?.decide_days ?? 180} days)`, num(t.decided), `${pct(t.share_within_180)} agreed in time`],
              ['Branches ranked', num(t.ranked_branches), `need ${rules?.min_decided ?? 10}+ known outcomes`],
            ].map(([label, value, sub]) => (
              <div key={label} style={card}>
                <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, margin: '2px 0' }}>{value}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{sub}</div>
              </div>
            ))}
          </div>

          <p style={{ color: '#666', fontSize: 13, maxWidth: 900 }}>
            <b>How a branch is judged:</b> a listing counts as agreed in time when we see it under offer or sold STC within{' '}
            {rules?.decide_days ?? 180} days of Rightmove's first-listed date, and as not in time when it's still for sale after
            that. Both are judged only from searches that show sold STC homes, so a sale is never missed. Days to agree are
            given only when we saw the listing for sale within {rules?.precise_gap_days ?? 14} days before. A branch is ranked
            once {rules?.min_decided ?? 10} of its listings have a known outcome, so the rankings need a few months of history.
          </p>

          <div style={{ ...card, padding: 0, overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Agent</th><th style={th}>Main areas</th><th style={th}>Listings</th><th style={th}>For sale now</th>
                  <th style={th}>Outcome known</th><th style={th}>Agreed in {rules?.decide_days ?? 180} days</th>
                  <th style={th}>Median days to agree</th><th style={th}>Median price</th><th style={th}>Price cut</th>
                  <th style={th}>Fell through</th><th style={th}>With a tour</th>
                </tr>
              </thead>
              <tbody>
                {branches.length === 0 && (
                  <tr><td style={td} colSpan={11}>No listings recorded for these filters yet.</td></tr>
                )}
                {branches.map((b) => (
                  <tr key={b.branch_id || b.branch_name || 'unknown'} style={{ opacity: b.ranked ? 1 : 0.75 }}>
                    <td style={td}>
                      <b>{b.agency || 'Unknown agent'}</b>
                      <div style={{ fontSize: 12, color: '#777' }}>{b.branch_name}{b.ranked ? '' : ' · not ranked yet'}</div>
                    </td>
                    <td style={td}>{b.main_areas.join(', ') || '—'}</td>
                    <td style={td}>{num(b.listings)}</td>
                    <td style={td}>{num(b.for_sale_now)}</td>
                    <td style={td}>{num(b.decided)}</td>
                    <td style={td}><b>{pct(b.share_within_180)}</b> <span style={{ color: '#888', fontSize: 12 }}>({b.agreed_within_180})</span></td>
                    <td style={td}>{num(b.median_days_to_agree)}</td>
                    <td style={td}>{money(b.median_price)}</td>
                    <td style={td}>{pct(b.reduced_pct)}</td>
                    <td style={td}>{num(b.fell_through)}</td>
                    <td style={td}>{pct(b.tour_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data!.top_areas.length > 0 && (
            <p style={{ color: '#666', fontSize: 13, marginTop: 14 }}>
              <b>Most-covered districts:</b> {data!.top_areas.map((a) => `${a.outcode} (${num(a.listings)})`).join(', ')}
            </p>
          )}
        </>
      )}
    </div>
  );
};

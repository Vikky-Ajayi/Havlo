import { useEffect, useState, type CSSProperties } from 'react';
import { api } from '../lib/api';
import type { ReportAccuracyGroup, ReportAccuracyResponse } from '../lib/api';

// The console's "Report accuracy" tab: how many free previews people saw
// before the report checks (app/services/report_guard.py) held a claim the
// checks now remove, and whether those people paid less often.

const RULES: Record<string, string> = {
  unseen_photos: 'Described photos or rooms the AI never saw',
  media: 'Gave a photo, floor plan or tour count it didn’t have',
  description_cut: 'Blamed our cut-off copy of the description on the seller',
  quote: 'Quoted words that aren’t in the listing',
  asking_price: 'Got the asking price wrong',
  bedrooms: 'Got the number of bedrooms wrong',
  bathrooms: 'Got the number of bathrooms wrong',
  days_on_market: 'Got the time on the market wrong',
  market: 'Compared with sales it didn’t have, or figures that don’t add up',
};

const FUNNELS: Record<string, string> = {
  letter: 'Letters', meta: 'Meta ads', google: 'Google ads', review: 'Analyst review', sell: 'Seller page',
};

const rate = (g: ReportAccuracyGroup) => (g.previews ? `${Math.round((g.paid / g.previews) * 1000) / 10}%` : '—');

const card: CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 };
const th: CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#6B7280', fontWeight: 700 };
const td: CSSProperties = { padding: '8px 10px', fontSize: 13, borderTop: '1px solid #F3F4F6' };

export const ReportAccuracyPanel = ({ country }: { country: 'UK' | 'US' }) => {
  const [data, setData] = useState<ReportAccuracyResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError('');
    api.staleProspectsConsoleReportAccuracy(country)
      .then(setData)
      .catch(() => setError('Could not run the accuracy check. Try again in a moment.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [country]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) return <p style={{ color: '#6B7280' }}>Checking every free preview…</p>;
  if (error) return <p style={{ color: '#B91C1C' }}>{error} <button className="spc-btn spc-btn-ghost" onClick={load}>Retry</button></p>;
  if (!data) return null;

  const { affected, clean } = data.before_checks;
  const total = affected.previews + clean.previews;
  const live = new Date(data.checks_live_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const small = affected.previews < 30 || (clean.previews > 0 && clean.previews < 30) || data.after_checks.previews < 30;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111' }}>
          {affected.previews} of {total} free previews ({total ? Math.round((affected.previews / total) * 100) : 0}%) contained a claim the checks now remove.
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6B7280' }}>
          People who saw their free findings before the checks went live ({live}). {data.seen_after_checks} people since then have only seen checked reports.
          Reports an analyst edited aren&rsquo;t counted.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#B45309' }}>PREVIEW HAD A CLAIM WE NOW REMOVE</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{rate(affected)}</div>
          <div style={{ fontSize: 13, color: '#6B7280' }}>paid ({affected.paid} of {affected.previews})</div>
        </div>
        {clean.previews > 0 && (
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>PREVIEW HELD UP</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{rate(clean)}</div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>paid ({clean.paid} of {clean.previews})</div>
          </div>
        )}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8' }}>SINCE THE CHECKS WENT LIVE</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{rate(data.after_checks)}</div>
          <div style={{ fontSize: 13, color: '#6B7280' }}>
            paid ({data.after_checks.paid} of {data.after_checks.previews}). People who only just saw their findings may still pay.
          </div>
        </div>
      </div>
      {small && (
        <p style={{ margin: 0, fontSize: 13, color: '#92400E' }}>
          Fewer than 30 people in a group: treat the difference in payment rates as a hint, not proof.
          {clean.previews === 0 && ' Every preview before the checks had a bad claim, so the fair comparison is before against since the checks.'}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>By funnel</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Funnel</th><th style={th}>Bad claim</th><th style={th}>Paid</th><th style={th}>Held up</th><th style={th}>Paid</th></tr></thead>
            <tbody>
              {(Object.entries(data.by_funnel) as [string, { affected: ReportAccuracyGroup; clean: ReportAccuracyGroup }][]).map(([funnel, g]) => (
                <tr key={funnel}>
                  <td style={td}>{FUNNELS[funnel] || funnel}</td>
                  <td style={td}>{g.affected.previews}</td>
                  <td style={td}>{rate(g.affected)}</td>
                  <td style={td}>{g.clean.previews}</td>
                  <td style={td}>{rate(g.clean)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>What went wrong (previews)</div>
          {Object.keys(data.by_rule).length === 0 && <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>Nothing removed.</p>}
          {(Object.entries(data.by_rule) as [string, number][]).map(([rule, count]) => (
            <div key={rule} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '6px 0', borderTop: '1px solid #F3F4F6' }}>
              <span>{RULES[rule] || rule}</span><b>{count}</b>
            </div>
          ))}
        </div>
      </div>

      {data.examples.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Recent examples</div>
          {data.examples.map((ex) => (
            <div key={`${ex.property_code}-${ex.seen_at}`} style={{ padding: '10px 0', borderTop: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {ex.address} <span style={{ color: '#6B7280', fontWeight: 500 }}>· #{ex.property_code} · {FUNNELS[ex.funnel] || ex.funnel} · {ex.paid ? 'paid' : 'didn’t pay'}</span>
              </div>
              {ex.removed.map((r, i) => (
                <div key={i} style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>
                  <span style={{ color: '#B45309', fontWeight: 600 }}>{RULES[r.rule] || r.rule}:</span> &ldquo;{r.text}&rdquo;
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <div><button className="spc-btn spc-btn-ghost" onClick={load} disabled={loading}>{loading ? 'Checking…' : 'Run again'}</button></div>
    </div>
  );
};

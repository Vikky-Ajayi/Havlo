import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { api } from '../lib/api';
import type { ModelComparisonModels, ModelComparisonState } from '../lib/api';
import { useAuth } from '../context/AuthContext';

// Console > Compare models: the current report model and up to two OpenAI
// models write the free report for the same recent listings, from the same
// facts, and the same claim checks run on each (app/services/model_comparison.py).

const RULES: Record<string, string> = {
  unseen_photos: 'Described photos or rooms it never saw',
  media: 'Wrong or unknown photo / floor plan / tour count',
  description_cut: 'Blamed a cut-off description',
  quote: 'Quoted words not in the listing',
  asking_price: 'Wrong asking price',
  bedrooms: 'Wrong bedrooms',
  bathrooms: 'Wrong bathrooms',
  days_on_market: 'Wrong time on the market',
  market: 'Market comparison it couldn’t back up',
};

const card: CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 };
const th: CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#6B7280', fontWeight: 700, whiteSpace: 'nowrap' };
const td: CSSProperties = { padding: '8px 10px', fontSize: 13, borderTop: '1px solid #F3F4F6', whiteSpace: 'nowrap' };

const usd = (v: number | null | undefined, digits = 4) => (v == null ? '—' : `$${v.toFixed(digits)}`);

export const ModelComparisonPanel = () => {
  const { token } = useAuth();
  const [models, setModels] = useState<ModelComparisonModels | null>(null);
  const [state, setState] = useState<ModelComparisonState | null>(null);
  const [picked, setPicked] = useState<string[]>(['', '']);
  const [listings, setListings] = useState(25);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    api.modelComparisonStatus(token).then(setState).catch((e: Error) => setError(e.message));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api.modelComparisonModels(token)
      .then((m) => {
        setModels(m);
        setPicked([m.suggested[0] || m.openai_models[0] || '', m.suggested[1] || '']);
      })
      .catch((e: Error) => setError(e.message));
    refresh();
  }, [token, refresh]);

  useEffect(() => {
    if (!state?.running) return undefined;
    const id = window.setInterval(refresh, 5000);
    return () => window.clearInterval(id);
  }, [state?.running, refresh]);

  if (!token) {
    return <p style={{ color: '#92400E' }}>Sign in to heyhavlo.com with your admin account to compare models: a run uses your OpenAI credit.</p>;
  }

  const start = () => {
    const chosen = picked.filter(Boolean);
    if (!chosen.length) { setError('Choose at least one OpenAI model.'); return; }
    setError('');
    setStarting(true);
    api.modelComparisonStart(token, chosen, listings)
      .then(() => window.setTimeout(refresh, 1500))
      .catch((e: Error) => setError(e.message))
      .finally(() => setStarting(false));
  };

  const priceOf = (m: string) => {
    const p = models?.prices[m];
    return p ? ` ($${p[0]} in / $${p[1]} out per 1M tokens)` : '';
  };
  const done = state?.results?.length || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card}>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151' }}>
          Each model writes the free report for the same recent listings, read fresh from Rightmove with the same facts,
          and the same claim checks run on each. Nothing is saved to your prospects.
        </p>
        {models && !models.openai_configured && <p style={{ color: '#B91C1C' }}>OPENAI_API_KEY isn&rsquo;t set on the backend.</p>}
        {models?.error && <p style={{ color: '#B91C1C' }}>Couldn&rsquo;t read your OpenAI models: {models.error}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <label style={{ fontSize: 13 }}>Current model<br />
            <input value={models?.current.model || ''} disabled style={{ padding: 8, minWidth: 200 }} />
          </label>
          {[0, 1].map((i) => (
            <label key={i} style={{ fontSize: 13 }}>OpenAI model {i + 1}{i === 1 ? ' (optional)' : ''}<br />
              <select value={picked[i]} onChange={(e) => setPicked((p) => p.map((v, j) => (j === i ? e.target.value : v)))} style={{ padding: 8, minWidth: 220 }}>
                <option value="">{i === 1 ? 'None' : 'Choose…'}</option>
                {(models?.openai_models || []).map((m) => <option key={m} value={m}>{m}{priceOf(m)}</option>)}
              </select>
            </label>
          ))}
          <label style={{ fontSize: 13 }}>Listings<br />
            <select value={listings} onChange={(e) => setListings(Number(e.target.value))} style={{ padding: 8 }}>
              {[5, 10, 25, 30].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button className="spc-btn" onClick={start} disabled={starting || !!state?.running || !models?.openai_models.length}>
            {state?.running ? 'Running…' : starting ? 'Starting…' : 'Run comparison'}
          </button>
        </div>
        {models && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#6B7280' }}>Prices as listed on {models.prices_as_of}. A run of 25 listings usually takes 10–20 minutes.</p>}
        {error && <p style={{ color: '#B91C1C', margin: '10px 0 0' }}>{error}</p>}
      </div>

      {state?.status && (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            {state.running ? `Running: ${done} of ${state.target} listings done` : state.status === 'failed' ? `Stopped: ${state.error}` : `Finished: ${done} listings`}
            {state.skipped ? ` · ${state.skipped} skipped (taken down or unreadable)` : ''}
          </div>
          {state.summary.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Model</th><th style={th}>Reports</th><th style={th}>Failed</th>
                  <th style={th}>Reports needing a removal</th><th style={th}>Claims removed</th>
                  <th style={th}>Previews under 3 findings</th><th style={th}>Avg findings kept</th>
                  <th style={th}>Avg time</th><th style={th}>Cost / report</th><th style={th}>Cost / 1,000</th>
                </tr></thead>
                <tbody>
                  {state.summary.map((s) => (
                    <tr key={s.model}>
                      <td style={td}><b>{s.model}</b>{s.current ? ' (current)' : ''}</td>
                      <td style={td}>{s.reports}</td>
                      <td style={td}>{s.failed}</td>
                      <td style={td}>{s.reports - s.failed ? `${s.reports_with_removals} of ${s.reports - s.failed}` : '—'}</td>
                      <td style={td}>{s.claims_removed}</td>
                      <td style={td}>{s.previews_under_3}</td>
                      <td style={td}>{s.avg_findings_kept ?? '—'}</td>
                      <td style={td}>{s.avg_seconds != null ? `${s.avg_seconds}s` : '—'}</td>
                      <td style={td}>{usd(s.avg_cost_usd)}</td>
                      <td style={td}>{s.avg_cost_usd != null ? usd(s.avg_cost_usd * 1000, 2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {state.summary.map((s) => Object.keys(s.by_rule).length > 0 && (
                <p key={`${s.model}-rules`} style={{ fontSize: 12, color: '#6B7280', margin: '8px 0 0' }}>
                  <b>{s.model}</b> removals: {(Object.entries(s.by_rule) as [string, number][]).map(([r, n]) => `${RULES[r] || r} (${n})`).join(' · ')}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {(state?.results || []).map((r) => (
        <div key={r.property_code + r.url} style={card}>
          <button onClick={() => setOpen(open === r.url ? null : r.url)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
            <b>{r.address}</b>{' '}
            <span style={{ color: '#6B7280', fontSize: 13 }}>
              · #{r.property_code} · {r.sales_given ? 'with Land Registry sales' : 'no sales data'} · {r.media?.photos ?? '?'} photos · {r.description_chars} chars of description
            </span>
            <span style={{ float: 'right', color: '#6B7280' }}>{open === r.url ? '▲' : '▼'}</span>
          </button>
          {open === r.url && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${r.models.length}, minmax(0, 1fr))`, gap: 12, marginTop: 12 }}>
              {r.models.map((m) => (
                <div key={m.model} style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{m.model} <span style={{ color: '#6B7280', fontWeight: 500 }}>· {m.seconds}s · {usd(m.cost_usd)}</span></div>
                  {!m.ok && <p style={{ color: '#B91C1C' }}>Failed: {m.error}</p>}
                  {(m.preview || []).map((f, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <b>{f.title}</b>
                      <div style={{ color: '#374151' }}>{f.description}</div>
                    </div>
                  ))}
                  {(m.removed || []).length > 0 && (
                    <div style={{ marginTop: 8, padding: 8, background: '#FFFBEB', borderRadius: 8 }}>
                      <div style={{ fontWeight: 700, color: '#92400E', marginBottom: 4 }}>Removed by the checks ({m.removed?.length})</div>
                      {(m.removed || []).map((x, i) => (
                        <div key={i} style={{ marginTop: 4 }}><span style={{ color: '#B45309' }}>{RULES[x.rule] || x.rule}:</span> &ldquo;{x.text}&rdquo;</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

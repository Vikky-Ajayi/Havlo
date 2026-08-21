import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../lib/api';

type Finding = { title?: string; description?: string; severity?: string };
type Action = { title?: string; description?: string; priority?: string };
type Preview = {
  property_address: string;
  property_code: string;
  asking_price?: number | null;
  preview: {
    overall_score?: number;
    key_issues?: Finding[];
    recommendations?: Action[];
    locked?: boolean;
  };
  unlocked: boolean;
};

const Header = () => (
  <header className="slx-header">
    <Link to="/stale-listings" className="slx-logo">StaleListings<span>By HAVLO</span></Link>
    <nav><Link to="/stale-listings/seller">Sellers</Link><Link to="/stale-listings/agents">Agents</Link><Link to="/stale-listings/partnerships">Partnerships</Link></nav>
  </header>
);

const accessQuery = (token: string | undefined, params: URLSearchParams) => {
  const code = params.get('code') || '';
  const query = new URLSearchParams();
  if (token) query.set('token', token);
  if (code) query.set('code', code);
  return query.toString();
};

const priceLabel = (value?: number | null) => value ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value) : '';

export const StaleListingProspectPreview = () => {
  const { token } = useParams();
  const [params] = useSearchParams();
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const query = useMemo(() => accessQuery(token, params), [token, params]);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/stale-listings/prospects/preview?${query}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setData)
      .catch(() => setError('We could not find that property assessment. Check the code and try again.'))
      .finally(() => setLoading(false));
  }, [query]);

  const checkout = async () => {
    setCheckingOut(true);
    setError('');
    try {
      const body: Record<string, string> = { redirect_url: `${window.location.origin}/stale-listings/prospect/complete` };
      if (token) body.token = token;
      const code = params.get('code');
      if (code) body.property_code = code;
      if (promoCode.trim()) body.promo_code = promoCode.trim();
      const response = await fetch(`${API_BASE}/stale-listings/prospects/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('checkout_failed');
      const payload = await response.json();
      window.location.href = payload.checkout_url;
    } catch {
      setError('We could not start checkout. Please try again.');
      setCheckingOut(false);
    }
  };

  if (loading) return <div className="slx-page"><Header /><main className="slx-main">Loading assessment...</main></div>;

  return (
    <div className="slx-page">
      <Header />
      <main className="slx-main">
        {error && <p className="slx-error">{error}</p>}
        {data && (
          <>
            <section className="slx-hero">
              <span>Property ID {data.property_code}</span>
              <h1>Your initial listing assessment is ready</h1>
              <p>{data.property_address}</p>
              <strong>{priceLabel(data.asking_price)}</strong>
            </section>
            <section className="slx-score">
              <div><small>Listing score</small><b>{data.preview.overall_score ?? 0}</b><span>/100</span></div>
              <p>This preview shows the main reasons the listing may be losing buyer momentum. Unlock the full report for the complete diagnosis and action plan.</p>
            </section>
            <section className="slx-grid">
              <div>
                <h2>Key issues identified</h2>
                {(data.preview.key_issues || []).map((item) => <article key={item.title}><span>{item.severity || 'Issue'}</span><h3>{item.title}</h3><p>{item.description}</p></article>)}
              </div>
              <div>
                <h2>Recommended next steps</h2>
                {(data.preview.recommendations || []).map((item) => <article key={item.title}><span>{item.priority || 'Action'}</span><h3>{item.title}</h3><p>{item.description}</p></article>)}
              </div>
            </section>
            <section className="slx-unlock">
              <h2>Unlock Your Full Property Listing Assessment</h2>
              <p>Access the complete Havlo report, including the full findings, prioritised action plan, pricing detail, comparable context, and buyer-facing recommendations.</p>
              {data.unlocked ? (
                <Link to={`/stale-listings/prospect/report?${query}`}>Open full report</Link>
              ) : (
                <>
                  <button onClick={checkout} disabled={checkingOut}>{checkingOut ? 'Creating secure checkout...' : 'Unlock full report for £149.99'}</button>
                  <div className="slx-promo">
                    <input
                      type="text"
                      placeholder="Have a promo code?"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      disabled={checkingOut}
                    />
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </main>
      <ProspectStyles />
    </div>
  );
};

export const StaleListingProspectComplete = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Confirming your payment...');
  const query = useMemo(() => accessQuery(params.get('token') || undefined, params), [params]);

  useEffect(() => {
    const id = window.setInterval(async () => {
      const response = await fetch(`${API_BASE}/stale-listings/prospects/payment-status?${query}`);
      if (!response.ok) {
        setMessage('Still confirming. Please keep this page open.');
        return;
      }
      const data = await response.json();
      if (data.payment_status === 'completed') {
        window.clearInterval(id);
        navigate(`/stale-listings/prospect/report?${query}`, { replace: true });
      } else if (data.payment_status === 'failed') {
        setMessage('Payment failed or was cancelled. You can return to the preview and try again.');
      } else {
        setMessage('Still confirming your payment with SumUp...');
      }
    }, 3500);
    return () => window.clearInterval(id);
  }, [navigate, query]);

  return <div className="slx-page"><Header /><main className="slx-main"><section className="slx-unlock"><h1>{message}</h1><Link to={`/stale-listings/prospect?${query}`}>Back to preview</Link></section></main><ProspectStyles /></div>;
};

export const StaleListingProspectReport = () => {
  const [params] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const query = useMemo(() => accessQuery(params.get('token') || undefined, params), [params]);

  useEffect(() => {
    fetch(`${API_BASE}/stale-listings/prospects/report?${query}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setData)
      .catch(() => setError('This report is still locked or could not be found.'));
  }, [query]);

  const report = data?.report_data || {};
  return (
    <div className="slx-page">
      <Header />
      <main className="slx-main">
        {error && <p className="slx-error">{error}</p>}
        {data && (
          <>
            <section className="slx-hero"><span>Full report unlocked</span><h1>{data.property_address}</h1><p>{report.executive_summary}</p></section>
            <section className="slx-score"><div><small>Overall score</small><b>{report.overall_score ?? 0}</b><span>/100</span></div><p>{report.pricing_recommendation_detail || report.pricing_recommendation}</p></section>
            <section className="slx-grid">
              <div><h2>Key findings</h2>{(report.key_findings || []).map((item: Finding) => <article key={item.title}><span>{item.severity || 'Finding'}</span><h3>{item.title}</h3><p>{item.description}</p></article>)}</div>
              <div><h2>Prioritised action plan</h2>{(report.action_plan || []).map((item: Action) => <article key={item.title}><span>{item.priority || 'Action'}</span><h3>{item.title}</h3><p>{item.description}</p></article>)}</div>
            </section>
          </>
        )}
      </main>
      <ProspectStyles />
    </div>
  );
};

const ProspectStyles = () => (
  <style>{`
    .slx-page{font-family:'Inter','Plus Jakarta Sans',sans-serif;background:#f6f6f6;color:#111;min-height:100vh}.slx-header{height:72px;background:#fff;display:flex;justify-content:space-between;align-items:center;padding:0 9%;border-bottom:1px solid #eee}.slx-logo{font-weight:950;font-size:24px;line-height:.75;text-decoration:none;color:#222}.slx-logo span{display:block;font-size:10px;text-align:center;margin-top:6px}.slx-header nav{display:flex;gap:24px}.slx-header nav a{font-weight:800;color:#111;text-decoration:none}.slx-main{max-width:1120px;margin:0 auto;padding:54px 20px}.slx-error{background:#fff0f0;border:1px solid #ffc9c9;color:#9b001d;border-radius:12px;padding:14px}.slx-hero{background:linear-gradient(120deg,#fff,#fff0fc);border-radius:28px;padding:42px;border:1px solid #f1d4f8}.slx-hero span{display:inline-block;background:#fbebff;color:#9c00c6;border-radius:999px;padding:8px 12px;font-weight:900}.slx-hero h1{font-size:48px;line-height:1;letter-spacing:-.05em;margin:18px 0}.slx-hero p{font-size:20px;color:#444}.slx-hero strong{color:#a900d8;font-size:26px}.slx-score{display:grid;grid-template-columns:220px 1fr;gap:28px;align-items:center;margin:26px 0;background:#fff;border:1px solid #e5e5e5;border-radius:22px;padding:28px}.slx-score div{background:#0b0b0b;color:#fff;border-radius:20px;padding:26px;text-align:center}.slx-score small{display:block;text-transform:uppercase;color:#bbb;font-weight:900}.slx-score b{font-size:60px;color:#b400e7}.slx-score p{font-size:18px;line-height:1.6}.slx-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.slx-grid>div{background:#fff;border-radius:22px;border:1px solid #e5e5e5;padding:26px}.slx-grid h2{font-size:30px}.slx-grid article{border-top:1px solid #eee;padding:22px 0}.slx-grid article span{color:#b400e7;font-size:12px;text-transform:uppercase;font-weight:950}.slx-grid article h3{font-size:22px;margin:6px 0}.slx-grid article p{white-space:pre-line;color:#333;line-height:1.65}.slx-unlock{margin-top:28px;background:#080808;color:#fff;border-radius:28px;text-align:center;padding:42px}.slx-unlock h2,.slx-unlock h1{font-size:34px}.slx-unlock p{max-width:720px;margin:0 auto 24px;color:#ddd}.slx-unlock a,.slx-unlock button{display:inline-block;border:0;border-radius:12px;background:#fff;color:#000;padding:15px 24px;font-weight:950;text-decoration:none;cursor:pointer}.slx-unlock button:disabled{opacity:.65}.slx-promo{margin-top:14px}.slx-promo input{width:220px;max-width:80%;border-radius:12px;border:1px solid #333;background:#111;color:#fff;padding:12px 16px;font-weight:700;text-align:center}.slx-promo input::placeholder{color:#888}@media(max-width:760px){.slx-header{padding:0 18px}.slx-header nav{display:none}.slx-main{padding:28px 16px}.slx-hero{padding:28px 20px}.slx-hero h1{font-size:34px}.slx-hero p{font-size:17px}.slx-score,.slx-grid{grid-template-columns:1fr}.slx-unlock{padding:32px 18px}.slx-unlock h2,.slx-unlock h1{font-size:28px}}`}</style>
);

import { useEffect, useMemo, useState, type FormEvent } from 'react';
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

type ReportFinding = { title?: string; description?: string; type?: string; icon?: string };
type ReportAction = { title?: string; description?: string; priority?: string; bullets?: string[] };
type ComparableSale = { address?: string; beds?: number | string; property_type?: string; sold_asking?: string; is_subject?: boolean };
type ListingSnapshot = {
  title?: string;
  address?: string;
  price?: string;
  image?: string;
  bedrooms?: string | number;
  bathrooms?: string | number;
  property_type?: string;
  platform?: string;
};
type FullReport = {
  overall_score?: number;
  scores?: { photos?: number; pricing?: number; description?: number; positioning?: number };
  key_findings?: ReportFinding[];
  action_plan?: ReportAction[];
  comparable_sales?: ComparableSale[];
  pricing_recommendation?: string;
  pricing_recommendation_detail?: string;
  executive_summary?: string;
};
type ReportPayload = {
  property_address: string;
  property_code: string;
  asking_price?: number | null;
  listing_duration_days?: number | null;
  listing_snapshot?: ListingSnapshot;
  report_data?: FullReport;
  payment_status: string;
};

const Header = () => (
  <header className="slx-header slx-noprint">
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

const FINDING_ICONS: Record<string, string> = {
  price: '£', photos: '📷', description: '✏️', location: '📍', marketing: '●', condition: '🏠', timing: '⏱',
};

const PRIORITY_COLORS: Record<string, string> = { URGENT: '#D94716', HIGH: '#D97706', MEDIUM: '#15803D' };

const LoadingShell = ({ label }: { label: string }) => (
  <div className="slx-page slx-loading-shell">
    <div className="slx-loading-card">
      <div className="slx-spinner" />
      <p>{label}</p>
    </div>
    <ProspectStyles />
  </div>
);

export const StaleListingProspectPreview = () => {
  const { token } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
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

  const checkout = async (e?: FormEvent) => {
    e?.preventDefault();
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
      if (payload.unlocked) {
        // Already-paid or promo-code unlocks never touch SumUp — go straight
        // to the full report instead of bouncing through the payment-status
        // polling page.
        navigate(`/stale-listings/prospect/report?${query}`);
        return;
      }
      window.location.href = payload.checkout_url;
    } catch {
      setError(promoCode.trim() ? 'That promo code did not work. Please check it and try again.' : 'We could not start checkout. Please try again.');
      setCheckingOut(false);
    }
  };

  if (loading) return <LoadingShell label="Loading your assessment…" />;

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
                {(data.preview.key_issues || []).map((item, i) => <article key={item.title || i}><span>{item.severity || 'Issue'}</span><h3>{item.title}</h3><p>{item.description}</p></article>)}
              </div>
              <div>
                <h2>Recommended next steps</h2>
                {(data.preview.recommendations || []).map((item, i) => <article key={item.title || i}><span>{item.priority || 'Action'}</span><h3>{item.title}</h3><p>{item.description}</p></article>)}
              </div>
            </section>
            <section className="slx-unlock">
              <h2>Unlock Your Full Property Listing Assessment</h2>
              <p>Access the complete Havlo report, including the full findings, prioritised action plan, pricing detail, comparable context, and buyer-facing recommendations.</p>
              {data.unlocked ? (
                <Link to={`/stale-listings/prospect/report?${query}`}>Open full report</Link>
              ) : (
                <form className="slx-unlock-form" onSubmit={checkout}>
                  <button type="submit" disabled={checkingOut}>{checkingOut ? 'Verifying…' : 'Unlock full report for £149.99'}</button>
                  <div className="slx-promo">
                    <input
                      type="text"
                      placeholder="Have a promo code? Type it and press Enter"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      disabled={checkingOut}
                    />
                  </div>
                </form>
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
    const check = async () => {
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
    };
    check();
    const id = window.setInterval(check, 3500);
    return () => window.clearInterval(id);
  }, [navigate, query]);

  return (
    <div className="slx-page">
      <Header />
      <main className="slx-main">
        <section className="slx-unlock"><h1>{message}</h1><Link to={`/stale-listings/prospect?${query}`}>Back to preview</Link></section>
      </main>
      <ProspectStyles />
    </div>
  );
};

export const StaleListingProspectReport = () => {
  const [params] = useSearchParams();
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const query = useMemo(() => accessQuery(params.get('token') || undefined, params), [params]);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/stale-listings/prospects/report?${query}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setData)
      .catch(() => setError('This report is still locked or could not be found.'))
      .finally(() => setLoading(false));
  }, [query]);

  const handleDownloadPDF = () => window.print();

  if (loading) return <LoadingShell label="Loading your full report…" />;

  const report: FullReport = data?.report_data || {};
  const snapshot: ListingSnapshot = data?.listing_snapshot || {};
  const scores = report.scores || {};
  const priceText = snapshot.price || priceLabel(data?.asking_price);
  const metaParts = [
    snapshot.bedrooms ? `${snapshot.bedrooms} bed` : '',
    snapshot.bathrooms ? `${snapshot.bathrooms} bath` : '',
    snapshot.property_type || '',
    priceText,
  ].filter(Boolean);
  const daysOnMarket = data?.listing_duration_days;

  return (
    <div className="slx-page">
      <Header />
      <main className="slx-main slx-report-main">
        {error && <p className="slx-error">{error}</p>}
        {data && (
          <>
            <section className="slx-report-toolbar slx-noprint">
              <Link to="/stale-listings">← Back to StaleListings</Link>
              <button className="slx-download" onClick={handleDownloadPDF}>Download as PDF</button>
            </section>

            <section className="slx-report-hero">
              {snapshot.image && <img src={snapshot.image} alt={data.property_address} />}
              <div className="slx-report-hero-copy">
                <span>Property ID {data.property_code} · Full report unlocked</span>
                <h1>{data.property_address}</h1>
                {!!metaParts.length && <p className="slx-report-meta">{metaParts.join(' · ')}</p>}
                <p className="slx-report-platform">
                  {snapshot.platform ? `Listed on ${snapshot.platform}` : ''}
                  {snapshot.platform && daysOnMarket ? ' · ' : ''}
                  {daysOnMarket ? `On the market for ${daysOnMarket} days` : ''}
                </p>
                <p className="slx-report-summary">{report.executive_summary}</p>
              </div>
            </section>

            <section className="slx-scoregrid">
              <div className="slx-scoregrid-main">
                <small>Overall score</small>
                <b>{report.overall_score ?? 0}</b>
                <span>/100</span>
              </div>
              <div className="slx-scoregrid-bars">
                {([
                  ['photos', 'Photos'],
                  ['pricing', 'Pricing'],
                  ['description', 'Description'],
                  ['positioning', 'Positioning'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="slx-scorebar">
                    <span>{label}</span>
                    <div className="slx-scorebar-track"><div className="slx-scorebar-fill" style={{ width: `${scores[key] ?? 0}%` }} /></div>
                    <b>{scores[key] ?? 0}</b>
                  </div>
                ))}
              </div>
            </section>

            <section className="slx-pricing-box">
              <h2>Pricing recommendation</h2>
              {report.pricing_recommendation && <p className="slx-pricing-headline">{report.pricing_recommendation}</p>}
              <p>{report.pricing_recommendation_detail}</p>
            </section>

            <section className="slx-findings-full">
              <h2>Key findings</h2>
              <div className="slx-findings-list">
                {(report.key_findings || []).map((item, i) => (
                  <article key={item.title || i} className="slx-finding-card">
                    <span className="slx-finding-icon">{FINDING_ICONS[item.icon || ''] || '●'}</span>
                    <div>
                      <span className={`slx-finding-tag ${item.type === 'strength' ? 'slx-finding-tag--strength' : 'slx-finding-tag--issue'}`}>
                        {item.type === 'strength' ? 'Strength' : 'Issue'}
                      </span>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="slx-actions-full">
              <h2>Prioritised action plan</h2>
              <div className="slx-actions-list">
                {(report.action_plan || []).map((item, i) => (
                  <article key={item.title || i} className="slx-action-card">
                    <span className="slx-action-priority" style={{ background: PRIORITY_COLORS[item.priority || ''] || '#333' }}>{item.priority || 'Action'}</span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    {!!(item.bullets && item.bullets.length) && (
                      <ul>{item.bullets!.map((bullet, bi) => <li key={bi}>{bullet}</li>)}</ul>
                    )}
                  </article>
                ))}
              </div>
            </section>

            {!!(report.comparable_sales && report.comparable_sales.length) && (
              <section className="slx-comps">
                <h2>Comparable sales</h2>
                <div className="slx-comp-table-wrap">
                  <table className="slx-comp-table">
                    <thead><tr><th>Address</th><th>Beds</th><th>Type</th><th>Price</th></tr></thead>
                    <tbody>
                      {report.comparable_sales!.map((sale, i) => (
                        <tr key={i} className={sale.is_subject ? 'is-subject' : ''}>
                          <td>{sale.address}{sale.is_subject ? ' (this property)' : ''}</td>
                          <td>{sale.beds}</td>
                          <td>{sale.property_type}</td>
                          <td>{sale.sold_asking}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <ProspectStyles />
    </div>
  );
};

const ProspectStyles = () => (
  <style>{`
    .slx-page{font-family:'Inter','Plus Jakarta Sans',sans-serif;background:#f6f6f6;color:#111;min-height:100vh}
    .slx-header{height:72px;background:#fff;display:flex;justify-content:space-between;align-items:center;padding:0 9%;border-bottom:1px solid #eee}
    .slx-logo{font-weight:950;font-size:24px;line-height:.75;text-decoration:none;color:#222}
    .slx-logo span{display:block;font-size:10px;text-align:center;margin-top:6px}
    .slx-header nav{display:flex;gap:24px}
    .slx-header nav a{font-weight:800;color:#111;text-decoration:none}
    .slx-main{max-width:1344px;margin:0 auto;padding:54px 20px}
    .slx-error{background:#fff0f0;border:1px solid #ffc9c9;color:#9b001d;border-radius:12px;padding:14px}
    .slx-hero{background:linear-gradient(120deg,#fff,#fff0fc);border-radius:28px;padding:42px;border:1px solid #f1d4f8}
    .slx-hero span{display:inline-block;background:#fbebff;color:#9c00c6;border-radius:999px;padding:8px 12px;font-weight:900}
    .slx-hero h1{font-size:48px;line-height:1;letter-spacing:-.05em;margin:18px 0}
    .slx-hero p{font-size:20px;color:#444}
    .slx-hero strong{color:#a900d8;font-size:26px}
    .slx-score{display:grid;grid-template-columns:220px 1fr;gap:28px;align-items:center;margin:26px 0;background:#fff;border:1px solid #e5e5e5;border-radius:22px;padding:28px}
    .slx-score div{background:#0b0b0b;color:#fff;border-radius:20px;padding:26px;text-align:center}
    .slx-score small{display:block;text-transform:uppercase;color:#bbb;font-weight:900}
    .slx-score b{font-size:60px;color:#b400e7}
    .slx-score p{font-size:18px;line-height:1.6}
    .slx-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    .slx-grid>div{background:#fff;border-radius:22px;border:1px solid #e5e5e5;padding:26px}
    .slx-grid h2{font-size:30px}
    .slx-grid article{border-top:1px solid #eee;padding:22px 0}
    .slx-grid article span{color:#b400e7;font-size:12px;text-transform:uppercase;font-weight:950}
    .slx-grid article h3{font-size:22px;margin:6px 0}
    .slx-grid article p{white-space:pre-line;color:#333;line-height:1.65}
    .slx-unlock{margin-top:28px;background:#080808;color:#fff;border-radius:28px;text-align:center;padding:42px}
    .slx-unlock h2,.slx-unlock h1{font-size:34px}
    .slx-unlock p{max-width:720px;margin:0 auto 24px;color:#ddd}
    .slx-unlock a,.slx-unlock button{display:inline-block;border:0;border-radius:12px;background:#fff;color:#000;padding:15px 24px;font-weight:950;text-decoration:none;cursor:pointer}
    .slx-unlock button:disabled{opacity:.65}
    .slx-unlock-form{display:flex;flex-direction:column;align-items:center}
    .slx-promo{margin-top:14px}
    .slx-promo input{width:280px;max-width:80%;border-radius:12px;border:1px solid #333;background:#111;color:#fff;padding:12px 16px;font-weight:700;text-align:center}
    .slx-promo input::placeholder{color:#888}

    .slx-loading-shell{display:flex;align-items:center;justify-content:center}
    .slx-loading-card{text-align:center}
    .slx-spinner{width:40px;height:40px;margin:0 auto 16px;border:3px solid #e5e5e5;border-top-color:#b400e7;border-radius:50%;animation:slx-spin .8s linear infinite}
    .slx-loading-card p{font-weight:800;color:#555;font-size:16px}
    @keyframes slx-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}

    .slx-report-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
    .slx-report-toolbar a{font-weight:900;color:#111;text-decoration:none}
    .slx-download{border:0;border-radius:12px;background:#080808;color:#fff;padding:13px 22px;font-weight:950;cursor:pointer}
    .slx-download:hover{background:#000}

    .slx-report-hero{display:flex;gap:32px;background:#fff;border:1px solid #e5e5e5;border-radius:28px;padding:32px;align-items:stretch}
    .slx-report-hero img{width:340px;flex:0 0 340px;height:100%;min-height:220px;object-fit:cover;border-radius:20px;background:#eee}
    .slx-report-hero-copy{display:flex;flex-direction:column;justify-content:center;min-width:0}
    .slx-report-hero-copy span{display:inline-block;background:#fbebff;color:#9c00c6;border-radius:999px;padding:8px 12px;font-weight:900;font-size:13px;width:fit-content}
    .slx-report-hero-copy h1{font-size:38px;line-height:1.05;letter-spacing:-.04em;margin:16px 0 8px}
    .slx-report-meta,.slx-report-platform{font-size:16px;color:#555;margin:2px 0}
    .slx-report-summary{font-size:17px;color:#333;line-height:1.6;margin-top:14px}

    .slx-scoregrid{display:grid;grid-template-columns:220px 1fr;gap:28px;align-items:center;margin:24px 0;background:#fff;border:1px solid #e5e5e5;border-radius:22px;padding:28px}
    .slx-scoregrid-main{background:#0b0b0b;color:#fff;border-radius:20px;padding:26px;text-align:center}
    .slx-scoregrid-main small{display:block;text-transform:uppercase;color:#bbb;font-weight:900}
    .slx-scoregrid-main b{font-size:60px;color:#b400e7}
    .slx-scoregrid-bars{display:flex;flex-direction:column;gap:14px}
    .slx-scorebar{display:grid;grid-template-columns:110px 1fr 40px;align-items:center;gap:12px}
    .slx-scorebar span{font-weight:800;text-transform:capitalize;color:#333}
    .slx-scorebar-track{background:#eee;border-radius:999px;height:10px;overflow:hidden}
    .slx-scorebar-fill{background:#b400e7;height:100%;border-radius:999px}
    .slx-scorebar b{text-align:right;color:#111}

    .slx-pricing-box{background:#fff;border:1px solid #e5e5e5;border-radius:22px;padding:28px;margin-bottom:24px}
    .slx-pricing-box h2{font-size:26px;margin:0 0 12px}
    .slx-pricing-headline{font-weight:900;font-size:19px;color:#a900d8;margin:0 0 10px}
    .slx-pricing-box p{line-height:1.7;color:#333;font-size:16px}

    .slx-findings-full,.slx-actions-full,.slx-comps{background:#fff;border:1px solid #e5e5e5;border-radius:22px;padding:28px;margin-bottom:24px}
    .slx-findings-full h2,.slx-actions-full h2,.slx-comps h2{font-size:26px;margin:0 0 18px}
    .slx-findings-list,.slx-actions-list{display:flex;flex-direction:column;gap:18px}
    .slx-finding-card{display:flex;gap:16px;border-top:1px solid #eee;padding-top:18px}
    .slx-finding-card:first-child{border-top:0;padding-top:0}
    .slx-finding-icon{flex:0 0 auto;width:40px;height:40px;border-radius:12px;background:#f4e8fa;display:flex;align-items:center;justify-content:center;font-size:18px}
    .slx-finding-tag{display:inline-block;font-size:12px;text-transform:uppercase;font-weight:950;padding:3px 10px;border-radius:999px;margin-bottom:6px}
    .slx-finding-tag--issue{background:#ffe9e9;color:#c81e3a}
    .slx-finding-tag--strength{background:#e7faf3;color:#15803d}
    .slx-finding-card h3{font-size:19px;margin:2px 0 6px}
    .slx-finding-card p{color:#333;line-height:1.6;white-space:pre-line}

    .slx-action-card{border-top:1px solid #eee;padding-top:18px}
    .slx-action-card:first-child{border-top:0;padding-top:0}
    .slx-action-priority{display:inline-block;color:#fff;font-size:12px;font-weight:950;text-transform:uppercase;padding:4px 12px;border-radius:999px;margin-bottom:8px}
    .slx-action-card h3{font-size:19px;margin:2px 0 6px}
    .slx-action-card p{color:#333;line-height:1.6}
    .slx-action-card ul{margin:10px 0 0;padding-left:20px;color:#444;line-height:1.7}

    .slx-comp-table-wrap{overflow-x:auto}
    .slx-comp-table{width:100%;border-collapse:collapse;font-size:15px}
    .slx-comp-table th{text-align:left;text-transform:uppercase;font-size:12px;color:#999;font-weight:900;padding:10px 12px;border-bottom:2px solid #eee}
    .slx-comp-table td{padding:14px 12px;border-bottom:1px solid #f0f0f0;color:#333}
    .slx-comp-table tr.is-subject td{font-weight:900;color:#a900d8;background:#fdf3ff}

    @media print{
      body{background:#fff}
      .slx-noprint,.slx-header{display:none !important}
      .slx-page{background:#fff}
      .slx-main{padding:0;max-width:100%}
      .slx-report-hero,.slx-scoregrid,.slx-pricing-box,.slx-findings-full,.slx-actions-full,.slx-comps{border:none;box-shadow:none;break-inside:avoid}
    }

    @media(max-width:760px){
      .slx-header{padding:0 18px}
      .slx-header nav{display:none}
      .slx-main{padding:28px 16px}
      .slx-hero{padding:28px 20px}
      .slx-hero h1{font-size:34px}
      .slx-hero p{font-size:17px}
      .slx-score,.slx-grid,.slx-scoregrid{grid-template-columns:1fr}
      .slx-unlock{padding:32px 18px}
      .slx-unlock h2,.slx-unlock h1{font-size:28px}
      .slx-report-toolbar{flex-direction:column;gap:12px;align-items:stretch;text-align:center}
      .slx-report-hero{flex-direction:column;padding:20px}
      .slx-report-hero img{width:100%;flex:none;height:200px}
      .slx-report-hero-copy h1{font-size:28px}
      .slx-scorebar{grid-template-columns:90px 1fr 34px}
    }
  `}</style>
);

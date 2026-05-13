import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';

interface ComparableSale {
  address: string;
  beds: number;
  property_type: string;
  sold_asking: string;
  is_subject: boolean;
}

interface ReportData {
  overall_score: number;
  days_on_market?: number | null;
  scores: { photos: number; pricing: number; description: number; positioning: number };
  key_findings: { title: string; description: string; type: string; icon?: string }[];
  action_plan: { priority: string; title: string; description: string; bullets: string[] }[];
  comparable_sales: ComparableSale[];
  pricing_recommendation: string;
  pricing_recommendation_detail: string;
  executive_summary: string;
}

interface Assessment {
  assessment_id: string;
  reference: string;
  email: string;
  package: string;
  property_address?: string;
  listing_url?: string;
  report_status: string;
  payment_status: string;
  report_data?: ReportData;
  created_at: string;
}

const PACKAGE_LABELS: Record<string, string> = {
  quick_insight: 'Quick Insight',
  professional_review: 'Professional Review',
  premium_strategy: 'Premium Strategy',
};

function scoreBarColor(s: number) {
  return s >= 70 ? '#16A34A' : s >= 50 ? '#D97706' : '#DC2626';
}
function scoreBarBg(s: number) {
  return s >= 70 ? '#DCFCE7' : s >= 50 ? '#FEF3C7' : '#FEE2E2';
}
function overallScoreColor(s: number) {
  return s >= 70 ? '#15803D' : s >= 50 ? '#B45309' : '#B91C1C';
}
function scoreLabel(s: number) {
  return s >= 80 ? 'Strong position' : s >= 65 ? 'Good fundamentals' : s >= 50 ? 'Needs attention' : s >= 35 ? 'Significant issues' : 'Critical — action required';
}

function FindingIcon({ icon, type }: { icon?: string; type: string }) {
  const color = type === 'strength' ? '#15803D' : '#C2410C';
  if (icon === 'price') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
  if (icon === 'photos') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
  if (icon === 'description') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
  if (icon === 'location') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  );
  if (icon === 'marketing') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
  if (icon === 'condition') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
  if (icon === 'timing') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#555', fontFamily: 'Inter, sans-serif' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: scoreBarColor(score), fontFamily: 'Inter, sans-serif' }}>{score}</span>
      </div>
      <div style={{ width: '100%', height: 8, borderRadius: 99, background: '#F0F0F0', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', borderRadius: 99, background: scoreBarColor(score), transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

const SERVICES = [
  { category: 'Premium Marketing & Seller Services', name: 'HAVLO', desc: 'International buyer campaigns and premium listing exposure', color: '#000' },
  { category: 'Repairs & Home Improvement', name: 'Concierge', desc: 'Pre-sale repairs and home improvement services', color: '#1D4ED8' },
  { category: 'Estate Agent Comparison', name: 'GetAgent', desc: 'Compare local agents on performance and fees', color: '#7C3AED' },
  { category: 'Conveyancing & Legal', name: 'ReallyMoving', desc: 'Compare conveyancers and legal services', color: '#0891B2' },
  { category: 'Property Market Data', name: 'PropertyData', desc: 'In-depth market data and comparable analysis', color: '#059669' },
  { category: 'Professional Photography', name: 'Photoplan', desc: 'Professional photography, floor plans and virtual tours', color: '#DC2626' },
  { category: 'Moving & Relocation', name: 'ANYVAN', desc: 'Trusted removal and relocation services', color: '#D97706' },
  { category: 'Home Staging', name: 'Staging Co.', desc: 'Professional home staging to maximise buyer appeal', color: '#7C3AED' },
];

export function StaleListingsReport() {
  const { reference } = useParams<{ reference: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchReport = () => {
    if (!reference) return;
    api.staleListingsGetReport(reference)
      .then(data => {
        setAssessment(data as Assessment);
        setLoading(false);
        if (data.report_status === 'completed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setPolling(false);
        }
      })
      .catch(() => { setError('Report not found or not yet available.'); setLoading(false); });
  };

  useEffect(() => {
    if (!reference) { setError('No report reference provided.'); setLoading(false); return; }
    fetchReport();
  }, [reference]);

  useEffect(() => {
    if (!assessment) return;
    if (assessment.report_status !== 'completed' && assessment.payment_status === 'completed') {
      setPolling(true);
      pollRef.current = setInterval(fetchReport, 8000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [assessment?.report_status, assessment?.payment_status]);

  const handleDownloadPDF = () => {
    document.documentElement.classList.add('printing-report');
    window.print();
    setTimeout(() => document.documentElement.classList.remove('printing-report'), 1000);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F8F8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #E5E7EB', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontFamily: 'Inter, sans-serif', color: '#888', fontSize: 15 }}>Loading your report…</p>
        </div>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F8F8' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: '0 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
          <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 22, marginBottom: 8, color: '#111' }}>Report not found</h2>
          <p style={{ fontFamily: 'Inter, sans-serif', color: '#666', fontSize: 15, marginBottom: 24 }}>{error || 'This report could not be found. Please check your reference code.'}</p>
          <button onClick={() => navigate('/stale-listings')} style={{ background: '#000', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            Back to StaleListings
          </button>
        </div>
      </div>
    );
  }

  const rd = assessment.report_data;
  const issues = rd?.key_findings.filter(f => f.type === 'issue').length || 0;
  const strengths = rd?.key_findings.filter(f => f.type === 'strength').length || 0;
  const address = assessment.property_address || 'Property address not provided';

  const isPending = assessment.payment_status !== 'completed';
  const isProcessing = assessment.payment_status === 'completed' && assessment.report_status !== 'completed';

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media print {
          body * { visibility: hidden !important; }
          .pdf-print-area, .pdf-print-area * { visibility: visible !important; }
          .pdf-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          @page { margin: 0; size: A4; }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E8E9EA', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 68 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, cursor: 'pointer' }} onClick={() => navigate('/stale-listings')}>
            <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px', color: '#000' }}>StaleListings</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#888', fontWeight: 500 }}>by HAVLO</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {rd?.days_on_market && (
              <span style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                On market {rd.days_on_market} days
              </span>
            )}
            {assessment.report_status === 'completed' && (
              <span style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                Report ready
              </span>
            )}
            {assessment.report_status === 'completed' && (
              <button onClick={handleDownloadPDF} style={{ background: '#000', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Download PDF
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── PAGE BACKGROUND ── */}
      <div style={{ background: '#F7F8F8', minHeight: 'calc(100vh - 68px)' }}>

        {/* ── PENDING PAYMENT ── */}
        {isPending && (
          <div style={{ maxWidth: 600, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 26, marginBottom: 12 }}>Payment pending</h2>
            <p style={{ fontFamily: 'Inter, sans-serif', color: '#666', fontSize: 16, marginBottom: 8 }}>Your payment has not yet been confirmed. If you've completed checkout, please wait a moment and refresh.</p>
            <p style={{ fontFamily: 'Inter, sans-serif', color: '#aaa', fontSize: 14 }}>Reference: <strong style={{ color: '#555' }}>{assessment.reference}</strong></p>
            <button onClick={fetchReport} style={{ marginTop: 24, background: '#000', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Refresh Status</button>
          </div>
        )}

        {/* ── PROCESSING ── */}
        {isProcessing && (
          <div style={{ maxWidth: 600, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, border: '3px solid #E5E7EB', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.9s linear infinite', margin: '0 auto 20px' }} />
            <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 26, marginBottom: 12 }}>Your report is being prepared</h2>
            <p style={{ fontFamily: 'Inter, sans-serif', color: '#666', fontSize: 16, marginBottom: 8 }}>Payment confirmed. Our team is reviewing your assessment and preparing your personalised report. You'll receive an email when it's ready.</p>
            <p style={{ fontFamily: 'Inter, sans-serif', color: '#aaa', fontSize: 14 }}>Reference: <strong style={{ color: '#555' }}>{assessment.reference}</strong>{polling && ' · Checking for updates…'}</p>
          </div>
        )}

        {/* ── FULL REPORT ── */}
        {assessment.report_status === 'completed' && rd && (
          <>
            {/* Title section */}
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px 24px' }}>
              <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 34, letterSpacing: '-0.03em', color: '#0A0A0A', margin: '0 0 8px' }}>Your listing report</h1>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#666', margin: 0 }}>
                {address} · {PACKAGE_LABELS[assessment.package] || assessment.package}
              </p>
            </div>

            {/* ── MAIN 2-COL ── */}
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 32px', display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: 20 }} className="sl-report-grid">

              {/* LEFT: Scores panel */}
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E9EA', overflow: 'hidden' }}>
                {/* Property image placeholder */}
                <div style={{ width: '100%', aspectRatio: '4/3', background: 'linear-gradient(135deg, #F0F0F0 0%, #E4E4E4 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#B0B0B0', fontWeight: 500 }}>Property image</span>
                </div>

                <div style={{ padding: '20px 22px' }}>
                  <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, fontSize: 15, color: '#0A0A0A', marginBottom: 3 }}>{address}</div>
                  {assessment.listing_url && (
                    <a href={assessment.listing_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#7C3AED', textDecoration: 'none' }}>View listing ↗</a>
                  )}

                  {/* Overall score */}
                  <div style={{ margin: '20px 0 16px', padding: '16px', background: '#FAFAFA', borderRadius: 12, border: '1px solid #F0F0F0' }}>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: '#999', textTransform: 'uppercase', marginBottom: 8 }}>OVERALL SCORE</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 52, letterSpacing: '-0.03em', color: overallScoreColor(rd.overall_score), lineHeight: 1 }}>{rd.overall_score}</span>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 20, color: '#C0C0C0' }}>/100</span>
                    </div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#888', marginTop: 4 }}>{scoreLabel(rd.overall_score)}</div>
                  </div>

                  {/* Score bars */}
                  <ScoreBar label="Photos & Presentation" score={rd.scores.photos} />
                  <ScoreBar label="Pricing Strategy" score={rd.scores.pricing} />
                  <ScoreBar label="Listing Description" score={rd.scores.description} />
                  <ScoreBar label="Market Positioning" score={rd.scores.positioning} />
                </div>
              </div>

              {/* RIGHT: Key findings */}
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E9EA', padding: '28px 28px 24px' }}>
                <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', color: '#0A0A0A', margin: '0 0 6px' }}>Key findings</h2>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#888', margin: '0 0 24px' }}>
                  {issues > 0 && `${issues} issue${issues !== 1 ? 's' : ''} to address`}{issues > 0 && strengths > 0 ? ' · ' : ''}{strengths > 0 && `${strengths} strength${strengths !== 1 ? 's' : ''} to leverage`}
                </p>

                {rd.key_findings.map((f, i) => {
                  const isStrength = f.type === 'strength';
                  return (
                    <div key={i} style={{
                      display: 'flex', gap: 14, padding: '16px', marginBottom: 12,
                      borderRadius: 12, border: `1px solid ${isStrength ? '#BBF7D0' : '#FED7AA'}`,
                      background: isStrength ? '#F0FDF4' : '#FFFBF5',
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                        background: isStrength ? '#D1FAE5' : '#FEE2E2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <FindingIcon icon={f.icon} type={f.type} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: isStrength ? '#15803D' : '#C2410C', marginBottom: 4 }}>{f.title}</div>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#555', lineHeight: 1.55 }}>{f.description}</div>
                      </div>
                    </div>
                  );
                })}

                {/* Executive summary */}
                {rd.executive_summary && (
                  <div style={{ marginTop: 8, padding: '16px', borderRadius: 12, background: '#F8F9FA', border: '1px solid #E8E9EA' }}>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: '#999', textTransform: 'uppercase', marginBottom: 6 }}>CONSULTANT SUMMARY</div>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#444', lineHeight: 1.65, margin: 0 }}>{rd.executive_summary}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── ACTION PLAN ── */}
            {rd.action_plan.length > 0 && (
              <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 32px' }}>
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E9EA', padding: '28px 28px 20px' }}>
                  <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: '#0A0A0A', margin: '0 0 20px' }}>Prioritised action plan</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {rd.action_plan.map((item, i) => {
                      const pColors: Record<string, { bg: string; text: string; border: string }> = {
                        URGENT: { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
                        HIGH: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
                        MEDIUM: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
                      };
                      const pc = pColors[item.priority] || pColors.MEDIUM;
                      return (
                        <div key={i} style={{ border: '1px solid #E8E9EA', borderRadius: 12, padding: '18px 18px 14px', background: '#FAFAFA' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 16, color: '#0A0A0A', letterSpacing: '-0.3px' }}>{i + 1}</span>
                            <span style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.border}`, padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', fontFamily: 'Inter, sans-serif' }}>{item.priority}</span>
                          </div>
                          <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: '#0A0A0A', marginBottom: 6 }}>{item.title}</div>
                          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#666', lineHeight: 1.5, marginBottom: 10 }}>{item.description}</div>
                          {item.bullets?.length > 0 && (
                            <ul style={{ margin: 0, paddingLeft: 16 }}>
                              {item.bullets.map((b, j) => (
                                <li key={j} style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#555', lineHeight: 1.55, marginBottom: 4 }}>{b}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── COMPARABLE SALES ── */}
            {rd.comparable_sales?.length > 0 && (
              <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 32px' }}>
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E9EA', padding: '28px 28px 20px' }}>
                  <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: '#0A0A0A', margin: '0 0 8px' }}>Pricing vs comparable sales</h2>
                  {rd.pricing_recommendation && (
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#666', margin: '0 0 20px', lineHeight: 1.5 }}>{rd.pricing_recommendation}</p>
                  )}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
                      <thead>
                        <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E8E9EA' }}>
                          {['Property', 'Beds', 'Type', 'Price'].map(h => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#888', fontSize: 12, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rd.comparable_sales.map((c, i) => (
                          <tr key={i} style={{
                            borderBottom: '1px solid #F0F0F0',
                            background: c.is_subject ? '#FFFBEB' : '#fff',
                          }}>
                            <td style={{ padding: '12px 16px', fontWeight: c.is_subject ? 700 : 400, color: c.is_subject ? '#0A0A0A' : '#333' }}>
                              {c.address}{c.is_subject && <span style={{ marginLeft: 8, background: '#FEF3C7', color: '#92400E', padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700 }}>YOUR PROPERTY</span>}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#555' }}>{c.beds > 0 ? `${c.beds} bed` : '—'}</td>
                            <td style={{ padding: '12px 16px', color: '#555' }}>{c.property_type || '—'}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: c.is_subject ? '#B45309' : '#15803D' }}>{c.sold_asking}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rd.pricing_recommendation_detail && (
                    <div style={{ marginTop: 16, padding: '14px 16px', background: '#FFFBEB', borderRadius: 10, border: '1px solid #FDE68A' }}>
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#92400E', margin: 0, lineHeight: 1.6 }}>{rd.pricing_recommendation_detail}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SERVICES SECTION ── */}
            <div style={{ background: '#fff', borderTop: '1px solid #F0F0F0', padding: '48px 24px 56px', marginTop: 8 }}>
              <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                  <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: '#0A0A0A', margin: '0 0 8px' }}>Recommended services</h2>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#666', margin: 0 }}>Based on your assessment, these platforms and services may help improve your sale.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }} className="sl-services-grid">
                  {SERVICES.map((s, i) => (
                    <div key={i} style={{ border: '1px solid #E8E9EA', borderRadius: 12, padding: '18px', background: '#fff', cursor: 'default' }}>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '1px', color: '#999', textTransform: 'uppercase', marginBottom: 6 }}>{s.category}</div>
                      <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 16, color: s.color, marginBottom: 6 }}>{s.name}</div>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#777', lineHeight: 1.5 }}>{s.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── FOOTER DISCLAIMER ── */}
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 40px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#888', lineHeight: 1.6, margin: 0 }}>
                This report is generated using AI analysis and human expert review. Comparable sales data is indicative and based on publicly available information. This report does not constitute professional valuation or legal advice. For an accurate property valuation, please consult a qualified RICS surveyor or local estate agent. Reference: {assessment.reference}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── PDF PRINT AREA (only visible when printing) ── */}
      {assessment.report_status === 'completed' && rd && (
        <div className="pdf-print-area" style={{ display: 'none', fontFamily: 'Arial, sans-serif' }}>
          {/* PAGE 1 */}
          <div style={{ width: '210mm', minHeight: '297mm', padding: '16mm', boxSizing: 'border-box', pageBreakAfter: 'always' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #000' }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px' }}>StaleListings</span>
                <span style={{ color: '#888', fontSize: 11, marginLeft: 6 }}>by HAVLO</span>
              </div>
              <div style={{ fontSize: 11, color: '#555', textAlign: 'right' }}>
                <div style={{ fontWeight: 600 }}>{address}</div>
                <div style={{ color: '#888' }}>Ref: {assessment.reference}</div>
              </div>
            </div>

            {/* Property info box */}
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{address}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {rd.days_on_market && (
                  <span style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                    On market {rd.days_on_market} days
                  </span>
                )}
                <span style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>Report ready</span>
              </div>
            </div>

            {/* LISTING SCORE BREAKDOWN */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: '#888', textTransform: 'uppercase', marginBottom: 12 }}>LISTING SCORE BREAKDOWN</div>
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, textAlign: 'center', background: '#F8F9FA', borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ fontSize: 48, fontWeight: 800, color: overallScoreColor(rd.overall_score), lineHeight: 1 }}>{rd.overall_score}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>/ 100</div>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 2, fontWeight: 600 }}>OVERALL</div>
                </div>
                <div style={{ flex: 1 }}>
                  {([
                    ['Photos & Presentation', rd.scores.photos],
                    ['Pricing Strategy', rd.scores.pricing],
                    ['Listing Description', rd.scores.description],
                    ['Market Positioning', rd.scores.positioning],
                  ] as [string, number][]).map(([label, score]) => (
                    <div key={label} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: '#555' }}>{label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: scoreBarColor(score) }}>{score}/100</span>
                      </div>
                      <div style={{ height: 8, background: '#F0F0F0', borderRadius: 4 }}>
                        <div style={{ width: `${score}%`, height: '100%', background: scoreBarColor(score), borderRadius: 4 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* KEY FINDINGS */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: '#888', textTransform: 'uppercase', marginBottom: 12 }}>KEY FINDINGS</div>
              {rd.key_findings.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, padding: '10px 12px', background: f.type === 'strength' ? '#F0FDF4' : '#FFFBF5', border: `1px solid ${f.type === 'strength' ? '#BBF7D0' : '#FED7AA'}`, borderRadius: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: f.type === 'strength' ? '#16A34A' : '#C2410C', marginTop: 4, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: f.type === 'strength' ? '#15803D' : '#C2410C', marginBottom: 3 }}>{f.title}</div>
                    <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5 }}>{f.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PAGE 2 */}
          <div style={{ width: '210mm', minHeight: '297mm', padding: '16mm', boxSizing: 'border-box' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #000' }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px' }}>StaleListings</span>
                <span style={{ color: '#888', fontSize: 11, marginLeft: 6 }}>by HAVLO</span>
              </div>
              <div style={{ fontSize: 11, color: '#555', textAlign: 'right' }}>
                <div style={{ fontWeight: 600 }}>{address}</div>
                <div style={{ color: '#888' }}>Ref: {assessment.reference}</div>
              </div>
            </div>

            {/* Comparable sales */}
            {rd.comparable_sales?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: '#888', textTransform: 'uppercase', marginBottom: 12 }}>PRICING VS COMPARABLE SALES</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F8F9FA' }}>
                      {['Property', 'Beds', 'Type', 'Price'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#888', fontSize: 10, letterSpacing: '0.5px', textTransform: 'uppercase', border: '1px solid #E8E9EA' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rd.comparable_sales.map((c, i) => (
                      <tr key={i} style={{ background: c.is_subject ? '#FFFBEB' : '#fff' }}>
                        <td style={{ padding: '8px 12px', fontWeight: c.is_subject ? 700 : 400, border: '1px solid #E8E9EA' }}>
                          {c.address}{c.is_subject ? ' ★' : ''}
                        </td>
                        <td style={{ padding: '8px 12px', border: '1px solid #E8E9EA' }}>{c.beds > 0 ? `${c.beds}` : '—'}</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #E8E9EA' }}>{c.property_type || '—'}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: c.is_subject ? '#B45309' : '#15803D', border: '1px solid #E8E9EA' }}>{c.sold_asking}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pricing recommendation box */}
            {rd.pricing_recommendation && (
              <div style={{ marginBottom: 24, padding: '14px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: '#92400E', textTransform: 'uppercase', marginBottom: 6 }}>RECOMMENDATION</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 6 }}>{rd.pricing_recommendation}</div>
                {rd.pricing_recommendation_detail && <div style={{ fontSize: 11, color: '#78350F', lineHeight: 1.55 }}>{rd.pricing_recommendation_detail}</div>}
              </div>
            )}

            {/* Action plan */}
            {rd.action_plan.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: '#888', textTransform: 'uppercase', marginBottom: 12 }}>PRIORITISED ACTION PLAN</div>
                {rd.action_plan.map((item, i) => (
                  <div key={i} style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid #E8E9EA', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0A0A0A' }}>{i + 1}.</span>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: item.priority === 'URGENT' ? '#FEE2E2' : item.priority === 'HIGH' ? '#FFF7ED' : '#EFF6FF', color: item.priority === 'URGENT' ? '#B91C1C' : item.priority === 'HIGH' ? '#C2410C' : '#1D4ED8' }}>{item.priority}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0A0A0A' }}>{item.title}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#555', marginBottom: 4, paddingLeft: 20 }}>{item.description}</div>
                    {item.bullets?.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: 36 }}>
                        {item.bullets.map((b, j) => (
                          <li key={j} style={{ fontSize: 11, color: '#666', lineHeight: 1.5, marginBottom: 2 }}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Footer CTA */}
            <div style={{ background: '#000', color: '#fff', padding: '16px 20px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.3px' }}>Ready to act on this report?</div>
                <div style={{ fontSize: 11, color: '#ccc', marginTop: 2 }}>Contact HAVLO to discuss your personalised strategy.</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>heyhavlo.com</div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .sl-report-grid { grid-template-columns: 1fr !important; }
          .sl-services-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .sl-services-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

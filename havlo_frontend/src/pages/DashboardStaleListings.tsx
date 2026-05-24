import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { clearStaleReviewSession, readStaleReviewSession, writeStaleReviewPreview } from '../lib/staleReviewAccess';

interface ComparableSale { address: string; beds: number; property_type: string; sold_asking: string; is_subject: boolean; }
interface KeyFinding { title: string; description: string; type: string; icon?: string; }
interface ActionItem { priority: string; title: string; description: string; bullets: string[]; }
interface ReportEdit {
  overall_score: number;
  days_on_market: number | null;
  scores: { photos: number; pricing: number; description: number; positioning: number };
  key_findings: KeyFinding[];
  action_plan: ActionItem[];
  comparable_sales: ComparableSale[];
  pricing_recommendation: string;
  pricing_recommendation_detail: string;
  executive_summary: string;
}

type ReviewSurface = 'edit' | 'preview' | 'ai';

interface AdminItem {
  assessment_id: string;
  reference: string;
  email: string;
  first_name: string;
  last_name: string;
  package: string;
  property_address?: string;
  listing_url?: string;
  questions_data?: string;
  report_status: string;
  payment_status: string;
  created_at: string;
  ai_report_json?: string;
  agent_edited_report_json?: string;
  agent_notes?: string;
}

const PACKAGE_LABELS: Record<string, string> = {
  quick_insight: 'Quick Insight',
  professional_review: 'Professional Review',
  premium_strategy: 'Premium Strategy',
};

const Q_LABELS: Record<string, string> = {
  q1_viewings: 'Viewings since listing',
  q2_feedback: 'Buyer feedback',
  q3_under_offer: 'Gone under offer',
  q4_price_reduction: 'Price reductions',
  q5_flexibility: 'Open to adjustments',
  q6_marketing: 'Marketing channels',
  q7_listing_features: 'Listing features',
  q8_photos: 'Photo quality',
  q9_asking_price: 'Asking price range',
  q10_challenge: 'Biggest challenge',
};

const STATUS_PILL: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E', label: 'Pending Review' },
  in_review: { bg: '#DBEAFE', text: '#1E40AF', label: 'In Review' },
  completed: { bg: '#D1FAE5', text: '#065F46', label: 'Approved' },
  failed: { bg: '#FEE2E2', text: '#991B1B', label: 'Failed' },
};

const PAYMENT_PILL: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E' },
  completed: { bg: '#D1FAE5', text: '#065F46' },
  failed: { bg: '#FEE2E2', text: '#991B1B' },
};

function emptyReport(): ReportEdit {
  return {
    overall_score: 50,
    days_on_market: null,
    scores: { photos: 50, pricing: 50, description: 50, positioning: 50 },
    key_findings: [{ title: '', description: '', type: 'issue', icon: '' }],
    action_plan: [{ priority: 'URGENT', title: '', description: '', bullets: ['', ''] }],
    comparable_sales: [],
    pricing_recommendation: '',
    pricing_recommendation_detail: '',
    executive_summary: '',
  };
}

function parseReport(json?: string): ReportEdit | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json);
    return {
      overall_score: p.overall_score ?? 50,
      days_on_market: p.days_on_market ?? null,
      scores: { photos: p.scores?.photos ?? 50, pricing: p.scores?.pricing ?? 50, description: p.scores?.description ?? 50, positioning: p.scores?.positioning ?? 50 },
      key_findings: (p.key_findings || []).map((f: KeyFinding) => ({ title: f.title || '', description: f.description || '', type: f.type || 'issue', icon: f.icon || '' })),
      action_plan: (p.action_plan || []).map((a: ActionItem) => ({ priority: a.priority || 'MEDIUM', title: a.title || '', description: a.description || '', bullets: Array.isArray(a.bullets) ? a.bullets : [] })),
      comparable_sales: (p.comparable_sales || []).map((c: ComparableSale) => ({ address: c.address || '', beds: c.beds || 0, property_type: c.property_type || '', sold_asking: c.sold_asking || '', is_subject: c.is_subject || false })),
      pricing_recommendation: p.pricing_recommendation || '',
      pricing_recommendation_detail: p.pricing_recommendation_detail || '',
      executive_summary: p.executive_summary || '',
    };
  } catch { return null; }
}

const ScoreInput: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => {
  const color = value >= 70 ? '#16A34A' : value >= 50 ? '#D97706' : '#DC2626';
  return (
    <div style={{ flex: 1, minWidth: 120 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="range" min={0} max={100} value={value} onChange={e => onChange(Number(e.target.value))} style={{ flex: 1 }} />
        <span style={{ fontWeight: 700, fontSize: 14, color, minWidth: 32, textAlign: 'right' }}>{value}</span>
      </div>
    </div>
  );
};

const labelStyle: React.CSSProperties = { display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.8px', marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box' as const, border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', fontFamily: 'Inter, sans-serif', fontSize: 13, outline: 'none', background: '#fff' };
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical' as const, minHeight: 80, lineHeight: 1.55 };
const sectionTitleStyle: React.CSSProperties = { fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 14, color: '#0A0A0A', marginBottom: 10, borderBottom: '1px solid #F0F0F0', paddingBottom: 6 };
const previewCardStyle: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 18px' };

const PreviewCopy: React.FC<{ text: string; muted?: boolean }> = ({ text, muted = false }) => (
  <p style={{ margin: 0, color: muted ? '#555555' : '#333333', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' as const }}>
    {text || 'No content added yet.'}
  </p>
);

const FormattedCommentPreview: React.FC<{ text: string; muted?: boolean }> = ({ text, muted = false }) => {
  const normalized = text.replace(/\r/g, '').trim();
  if (!normalized) {
    return <PreviewCopy text="No agent comments added yet." muted={muted} />;
  }

  const blocks = normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {blocks.map((block, index) => {
        const lines = block
          .split(/\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        const bulletLines = lines.filter((line) => /^[-*•]\s+/.test(line));
        const numberedLines = lines.filter((line) => /^\d+[.)]\s+/.test(line));

        if (lines.length && bulletLines.length === lines.length) {
          return (
            <ul key={`agent-comment-bullets-${index}`} style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
              {lines.map((line, lineIndex) => (
                <li key={`${index}-${lineIndex}`} style={{ color: muted ? '#555555' : '#333333', fontSize: 13, lineHeight: 1.7 }}>
                  {line.replace(/^[-*•]\s+/, '')}
                </li>
              ))}
            </ul>
          );
        }

        if (lines.length && numberedLines.length === lines.length) {
          return (
            <ol key={`agent-comment-numbered-${index}`} style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
              {lines.map((line, lineIndex) => (
                <li key={`${index}-${lineIndex}`} style={{ color: muted ? '#555555' : '#333333', fontSize: 13, lineHeight: 1.7 }}>
                  {line.replace(/^\d+[.)]\s+/, '')}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={`agent-comment-paragraph-${index}`} style={{ margin: 0, color: muted ? '#555555' : '#333333', fontSize: 13, lineHeight: 1.75, whiteSpace: 'pre-wrap' as const }}>
            {lines.join('\n')}
          </p>
        );
      })}
    </div>
  );
};

const ScoreBar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const color = value >= 70 ? '#16A34A' : value >= 50 ? '#D97706' : '#DC2626';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr 36px', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <div style={{ height: 8, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', borderRadius: 999, background: color }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
    </div>
  );
};

const ReviewSurfaceButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      padding: '9px 14px',
      borderRadius: 999,
      border: active ? 'none' : '1px solid #E5E7EB',
      background: active ? '#111111' : '#FFFFFF',
      color: active ? '#FFFFFF' : '#555555',
      fontFamily: 'Inter, sans-serif',
      fontWeight: 700,
      fontSize: 12,
      cursor: 'pointer',
    }}
  >
    {children}
  </button>
);

const ReportPreviewPanel: React.FC<{
  report: ReportEdit;
  packageLabel: string;
  reference: string;
  propertyAddress?: string;
  agentComments: string;
  heading: string;
  subheading: string;
  compact?: boolean;
}> = ({ report, packageLabel, reference, propertyAddress, agentComments, heading, subheading, compact = false }) => (
  <div style={{ display: 'grid', gap: 14 }}>
    <div style={{ ...previewCardStyle, background: '#111111', color: '#FFFFFF' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', flexDirection: compact ? 'column' : 'row' }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.72)', fontWeight: 700 }}>{heading}</p>
          <h3 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: compact ? 19 : 22 }}>{propertyAddress || 'Property address not provided'}</h3>
          <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 1.6 }}>{subheading}</p>
        </div>
        <div style={{ minWidth: compact ? 0 : 150, textAlign: compact ? 'left' : 'right' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Reference</div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{reference}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginTop: 10 }}>Plan</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{packageLabel}</div>
        </div>
      </div>
    </div>

    <div style={{ ...previewCardStyle, display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
      <div style={{ gridColumn: compact ? 'span 1' : 'span 1', paddingRight: compact ? 0 : 12, paddingBottom: compact ? 12 : 0, borderRight: compact ? 'none' : '1px solid #F1F5F9', borderBottom: compact ? '1px solid #F1F5F9' : 'none' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#64748B', fontWeight: 700 }}>Overall Score</div>
        <div style={{ marginTop: 8, fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 34, color: report.overall_score >= 70 ? '#16A34A' : report.overall_score >= 50 ? '#D97706' : '#DC2626' }}>
          {report.overall_score}
        </div>
        <div style={{ fontSize: 12, color: '#64748B' }}>{report.days_on_market ? `${report.days_on_market} days on market` : 'Days on market not set'}</div>
      </div>
      <div style={{ gridColumn: compact ? 'span 1' : 'span 4', display: 'grid', gap: 12 }}>
        <ScoreBar label="Photos" value={report.scores.photos} />
        <ScoreBar label="Pricing" value={report.scores.pricing} />
        <ScoreBar label="Description" value={report.scores.description} />
        <ScoreBar label="Positioning" value={report.scores.positioning} />
      </div>
    </div>

    <div style={previewCardStyle}>
      <div style={sectionTitleStyle}>Executive Summary</div>
      <PreviewCopy text={report.executive_summary} />
    </div>

    <div style={{ display: 'grid', gap: 12 }}>
      <div style={sectionTitleStyle}>Key Findings</div>
      {report.key_findings.length ? report.key_findings.map((finding, idx) => (
        <div key={`${finding.title}-${idx}`} style={{ ...previewCardStyle, borderColor: finding.type === 'strength' ? '#BBF7D0' : '#FECACA', background: finding.type === 'strength' ? '#F0FDF4' : '#FEF2F2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
            <h4 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 16, color: '#111111' }}>{finding.title || `Finding ${idx + 1}`}</h4>
            <span style={{ alignSelf: 'flex-start', padding: '4px 9px', borderRadius: 999, background: '#FFFFFF', fontSize: 11, fontWeight: 700, color: '#555555', textTransform: 'uppercase' }}>
              {finding.type || 'issue'}
            </span>
          </div>
          <PreviewCopy text={finding.description} />
        </div>
      )) : <div style={previewCardStyle}><PreviewCopy text="No findings added yet." muted /></div>}
    </div>

    <div style={{ display: 'grid', gap: 12 }}>
      <div style={sectionTitleStyle}>Pricing Recommendation</div>
      <div style={previewCardStyle}>
        <h4 style={{ margin: '0 0 8px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 17 }}>{report.pricing_recommendation || 'No pricing recommendation added yet.'}</h4>
        <PreviewCopy text={report.pricing_recommendation_detail} muted={!report.pricing_recommendation_detail} />
      </div>
    </div>

    <div style={{ display: 'grid', gap: 12 }}>
      <div style={sectionTitleStyle}>Comparable Sales</div>
      {report.comparable_sales.length ? (
        <div style={{ ...previewCardStyle, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#111111', color: '#FFFFFF' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12 }}>Address</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12 }}>Beds</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12 }}>Type</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12 }}>Sold / Asking</th>
              </tr>
            </thead>
            <tbody>
              {report.comparable_sales.map((sale, idx) => (
                <tr key={`${sale.address}-${idx}`} style={{ background: sale.is_subject ? '#FFF7ED' : '#FFFFFF', borderTop: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: sale.is_subject ? 700 : 500, color: sale.is_subject ? '#C2410C' : '#111111' }}>{sale.address || 'Comparable address'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#333333' }}>{sale.beds || '-'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#333333' }}>{sale.property_type || '-'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#333333' }}>{sale.sold_asking || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div style={previewCardStyle}><PreviewCopy text="No comparable sales added yet." muted /></div>}
    </div>

    <div style={{ display: 'grid', gap: 12 }}>
      <div style={sectionTitleStyle}>Action Plan</div>
      {report.action_plan.length ? report.action_plan.map((action, idx) => (
        <div key={`${action.title}-${idx}`} style={previewCardStyle}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#A409D2', fontWeight: 800 }}>{action.priority || 'MEDIUM'}</span>
            <h4 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 16 }}>{action.title || `Action ${idx + 1}`}</h4>
          </div>
          <PreviewCopy text={action.description} />
          {action.bullets.length > 0 && (
            <ul style={{ margin: '10px 0 0 18px', padding: 0, display: 'grid', gap: 6 }}>
              {action.bullets.filter(Boolean).map((bullet, bulletIdx) => (
                <li key={`${bulletIdx}-${bullet.slice(0, 16)}`} style={{ color: '#333333', fontSize: 13, lineHeight: 1.7 }}>{bullet}</li>
              ))}
            </ul>
          )}
        </div>
      )) : <div style={previewCardStyle}><PreviewCopy text="No action plan steps added yet." muted /></div>}
    </div>

    <div style={previewCardStyle}>
      <div style={sectionTitleStyle}>Agent Comments</div>
      <FormattedCommentPreview text={agentComments} muted={!agentComments.trim()} />
    </div>
  </div>
);

export function DashboardStaleListings({ reviewMode = false }: { reviewMode?: boolean }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_review' | 'completed'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reportEdit, setReportEdit] = useState<ReportEdit | null>(null);
  const [agentNotes, setAgentNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [openingPreview, setOpeningPreview] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState('');
  const [reviewSurface, setReviewSurface] = useState<ReviewSurface>('edit');
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));

  useEffect(() => {
    let cancelled = false;

    if (reviewMode) {
      const session = readStaleReviewSession();
      if (!session) {
        setReviewError('This review session has expired. Please open the review email again.');
        setLoading(false);
        return () => {
          cancelled = true;
        };
      }

      api.staleListingsReviewAssessment(session.token)
        .then(data => {
          if (cancelled) return;
          const item = data as AdminItem;
          setItems([item]);
          setExpanded(item.assessment_id);
          const parsed = parseReport(item.agent_edited_report_json || item.ai_report_json);
          setReportEdit(parsed || emptyReport());
          setAgentNotes(item.agent_notes || '');
          setReviewSurface('edit');
          setLoading(false);
        })
        .catch((error) => {
          if (cancelled) return;
          clearStaleReviewSession();
          setReviewError(error instanceof Error ? error.message : 'This review session is no longer valid.');
          setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }

    if (!token) return;
    api.staleListingsAdminList(token)
      .then(data => { if (!cancelled) { setItems(data as AdminItem[]); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
    };
  }, [token, reviewMode]);

  useEffect(() => {
    if (reviewMode || !items.length) return;
    const requestedAssessment = (searchParams.get('assessment') || '').trim();
    if (!requestedAssessment) return;
    const target = items.find(
      item => item.assessment_id === requestedAssessment || item.reference.toLowerCase() === requestedAssessment.toLowerCase(),
    );
    if (target && expanded !== target.assessment_id) {
      openExpanded(target);
    }
  }, [items, searchParams, reviewMode, expanded]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!reviewMode && !user?.is_admin) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><p style={{ color: '#888' }}>Access denied.</p></div>;
  }

  if (reviewMode && !loading && reviewError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F7F8F8', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 18, border: '1px solid #E5E7EB', padding: 28, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', color: '#A409D2', fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>Review access</p>
          <h1 style={{ margin: '0 0 12px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 28 }}>Review session unavailable</h1>
          <p style={{ margin: '0 0 24px', color: '#555', fontSize: 15, lineHeight: 1.7 }}>{reviewError}</p>
          <button onClick={() => navigate('/stale-listings')} style={{ padding: '12px 20px', borderRadius: 10, border: 'none', background: '#000', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Back to Stale Listings
          </button>
        </div>
      </div>
    );
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.report_status === filter);
  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth < 1100;
  const shellPadding = isMobile ? '16px' : '24px 32px';
  const headerPadding = isMobile ? '0 16px' : '0 32px';

  const openExpanded = (item: AdminItem) => {
    if (expanded === item.assessment_id) {
      setExpanded(null);
      setReportEdit(null);
      setAgentNotes('');
      return;
    }
    setExpanded(item.assessment_id);
    const parsed = parseReport(item.agent_edited_report_json || item.ai_report_json);
    setReportEdit(parsed || emptyReport());
    setAgentNotes(item.agent_notes || '');
    setReviewSurface('edit');
  };

  const handleSaveDraft = async (item: AdminItem) => {
    const reviewSession = reviewMode ? readStaleReviewSession() : null;
    if ((!token && !reviewSession) || !reportEdit) return;
    setSaving(true);
    try {
      const payload = {
        agent_notes: agentNotes,
        agent_edited_report_json: JSON.stringify(reportEdit),
        report_status: item.report_status === 'completed' ? 'completed' : 'in_review',
      };
      if (reviewMode && reviewSession) {
        await api.staleListingsReviewFinalize(payload, reviewSession.token);
      } else if (token) {
        await api.staleListingsAdminFinalize(item.assessment_id, payload, token);
      }
      setItems(prev => prev.map(i => i.assessment_id === item.assessment_id
        ? { ...i, agent_edited_report_json: JSON.stringify(reportEdit), agent_notes: agentNotes, report_status: i.report_status === 'completed' ? 'completed' : 'in_review' }
        : i
      ));
      setSuccessMsg('Draft saved.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) { alert(e instanceof Error ? e.message : 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleApprove = async (item: AdminItem) => {
    const reviewSession = reviewMode ? readStaleReviewSession() : null;
    if ((!token && !reviewSession) || !reportEdit) return;
    if (!confirm(`Approve the reviewed report for ${item.reference} and send it to ${item.email}?`)) return;
    setApproving(true);
    try {
      const payload = {
        agent_notes: agentNotes,
        agent_edited_report_json: JSON.stringify(reportEdit),
        report_status: 'completed',
      };
      if (reviewMode && reviewSession) {
        await api.staleListingsReviewFinalize(payload, reviewSession.token);
      } else if (token) {
        await api.staleListingsAdminFinalize(item.assessment_id, payload, token);
      }
      setItems(prev => prev.map(i => i.assessment_id === item.assessment_id
        ? { ...i, agent_edited_report_json: JSON.stringify(reportEdit), agent_notes: agentNotes, report_status: 'completed' }
        : i
      ));
      setSuccessMsg(`Report approved and email sent to ${item.email}.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (e) { alert(e instanceof Error ? e.message : 'Approval failed.'); }
    finally { setApproving(false); }
  };

  const handleOpenActualReportPreview = async (item: AdminItem) => {
    const reviewSession = reviewMode ? readStaleReviewSession() : null;
    if (reviewMode && (!reviewSession || !reportEdit)) return;

    if (!reviewMode) {
      if (item.report_status === 'completed') {
        window.open(`/stale-listings/report/${item.reference}`, '_blank', 'noopener,noreferrer');
        return;
      }
      setReviewSurface('preview');
      return;
    }

    setOpeningPreview(true);
    try {
      const payload = {
        agent_notes: agentNotes,
        agent_edited_report_json: JSON.stringify(reportEdit),
        report_status: item.report_status === 'completed' ? 'completed' : 'in_review',
      };
      await api.staleListingsReviewFinalize(payload, reviewSession.token);
      setItems(prev => prev.map(i => i.assessment_id === item.assessment_id
        ? { ...i, agent_edited_report_json: JSON.stringify(reportEdit), agent_notes: agentNotes, report_status: i.report_status === 'completed' ? 'completed' : 'in_review' }
        : i
      ));
      writeStaleReviewPreview({
        assessmentId: item.assessment_id,
        reference: item.reference,
        package: item.package,
        propertyAddress: item.property_address,
        reportStatus: item.report_status === 'completed' ? 'completed' : 'in_review',
        paymentStatus: item.payment_status,
        reportData: reportEdit,
        agentNotes,
        createdAt: item.created_at,
      });
      window.open(`/stale-listings/report/${item.reference}?preview=review`, '_blank', 'noopener,noreferrer');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not open the report preview.');
    } finally {
      setOpeningPreview(false);
    }
  };

  const handleMarkPaid = async (item: AdminItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    if (!confirm(`Mark payment as completed for ${item.reference}? Use this for manual/test payments only.`)) return;
    try {
      await api.staleListingsAdminMarkPaid(item.assessment_id, token);
      setItems(prev => prev.map(i => i.assessment_id === item.assessment_id
        ? { ...i, payment_status: 'completed' }
        : i
      ));
      setSuccessMsg(`Payment marked as completed for ${item.reference}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to mark as paid.'); }
  };

  const handleDelete = async (item: AdminItem) => {
    if (!token) return;
    if (!confirm(`Delete assessment ${item.reference}? This cannot be undone.`)) return;
    setDeleting(item.assessment_id);
    try {
      await api.staleListingsAdminDelete(item.assessment_id, token);
      setItems(prev => prev.filter(i => i.assessment_id !== item.assessment_id));
      if (expanded === item.assessment_id) setExpanded(null);
    } catch (e) { alert(e instanceof Error ? e.message : 'Delete failed.'); }
    finally { setDeleting(null); }
  };

  const updateFinding = (idx: number, key: keyof KeyFinding, val: string) => {
    if (!reportEdit) return;
    const findings = [...reportEdit.key_findings];
    findings[idx] = { ...findings[idx], [key]: val };
    setReportEdit({ ...reportEdit, key_findings: findings });
  };

  const updateAction = (idx: number, key: keyof Omit<ActionItem, 'bullets'>, val: string) => {
    if (!reportEdit) return;
    const plan = [...reportEdit.action_plan];
    plan[idx] = { ...plan[idx], [key]: val };
    setReportEdit({ ...reportEdit, action_plan: plan });
  };

  const updateBullet = (aIdx: number, bIdx: number, val: string) => {
    if (!reportEdit) return;
    const plan = [...reportEdit.action_plan];
    const bullets = [...plan[aIdx].bullets];
    bullets[bIdx] = val;
    plan[aIdx] = { ...plan[aIdx], bullets };
    setReportEdit({ ...reportEdit, action_plan: plan });
  };

  const updateComparable = (idx: number, key: keyof ComparableSale, val: string | number | boolean) => {
    if (!reportEdit) return;
    const cs = [...reportEdit.comparable_sales];
    cs[idx] = { ...cs[idx], [key]: val };
    setReportEdit({ ...reportEdit, comparable_sales: cs });
  };

  const parsedQuestions = (qs?: string): Record<string, string | string[]> => {
    if (!qs) return {};
    try { return JSON.parse(qs); } catch { return {}; }
  };

  const handleReviewSignOut = () => {
    clearStaleReviewSession();
    navigate('/stale-listings', { replace: true });
  };

  return (
    <div style={{ background: '#F7F8F8', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E8E9EA', padding: headerPadding }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', minHeight: 64, padding: isMobile ? '12px 0' : 0, gap: 12, flexWrap: 'wrap' }}>
          {reviewMode ? (
            <button onClick={handleReviewSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13, fontFamily: 'Inter, sans-serif', marginRight: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              Sign out
            </button>
          ) : (
            <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13, fontFamily: 'Inter, sans-serif', marginRight: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              Back to dashboard
            </button>
          )}
          <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: isMobile ? 18 : 20, letterSpacing: '-0.5px', margin: 0 }}>
            {reviewMode ? 'StaleListings Report Review' : 'StaleListings - Agent Dashboard'}
          </h1>
          {loading && <span style={{ marginLeft: 12, color: '#aaa', fontSize: 13 }}>Loading...</span>}
          <div style={{ marginLeft: isMobile ? 0 : 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
            <span style={{ background: '#F0F0F0', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 600, color: '#555' }}>{items.length} total</span>
            {!reviewMode && (
              <span style={{ background: '#FEF3C7', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 600, color: '#92400E' }}>{items.filter(i => i.report_status === 'pending').length} pending</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: shellPadding }}>
        {successMsg && (
          <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '12px 18px', marginBottom: 16, color: '#065F46', fontWeight: 600, fontSize: 14 }}>{successMsg}</div>
        )}

        {/* Filter tabs */}
        {!reviewMode && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {(['all', 'pending', 'in_review', 'completed'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, background: filter === f ? '#0A0A0A' : '#fff', color: filter === f ? '#fff' : '#555', border: filter === f ? 'none' : '1px solid #E5E7EB' } as React.CSSProperties}>
                {f === 'all' ? 'All' : f === 'in_review' ? 'In Review' : f.charAt(0).toUpperCase() + f.slice(1)} {f === 'all' ? `(${items.length})` : `(${items.filter(i => i.report_status === f).length})`}
              </button>
            ))}
          </div>
        )}

        {/* Assessment list */}
        {filtered.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '48px', textAlign: 'center', color: '#888' }}>
            No assessments found.
          </div>
        )}

        {filtered.map(item => {
          const isOpen = expanded === item.assessment_id;
          const sp = STATUS_PILL[item.report_status] || STATUS_PILL.pending;
          const pp = PAYMENT_PILL[item.payment_status] || PAYMENT_PILL.pending;
          const qData = parsedQuestions(item.questions_data);
          const hasAiReport = !!item.ai_report_json;
          const aiDraft = parseReport(item.ai_report_json);
          const packageLabel = PACKAGE_LABELS[item.package] || item.package;
          const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

          return (
            <div key={item.assessment_id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', marginBottom: 12, overflow: 'hidden' }}>
              {/* Row header */}
              <div
                onClick={() => openExpanded(item)}
                style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', cursor: 'pointer', gap: 16, flexWrap: 'wrap' }}
              >
                <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 14, color: '#0A0A0A', minWidth: 100 }}>{item.reference}</div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{item.first_name} {item.last_name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{item.email}</div>
                </div>
                <div style={{ minWidth: 120 }}>
                  <div style={{ fontSize: 12, color: '#555', fontWeight: 600 }}>{PACKAGE_LABELS[item.package] || item.package}</div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>{dateStr}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ background: pp.bg, color: pp.text, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                    Payment: {item.payment_status}
                  </span>
                  {!reviewMode && item.payment_status !== 'completed' && (
                    <button
                      onClick={e => handleMarkPaid(item, e)}
                      style={{ background: '#065F46', color: '#fff', border: 'none', borderRadius: 10, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Mark as Paid
                    </button>
                  )}
                  <span style={{ background: sp.bg, color: sp.text, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                    {sp.label}
                  </span>
                  {hasAiReport && <span style={{ background: '#EDE9FE', color: '#5B21B6', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>AI Report Ready</span>}
                </div>
                <div style={{ marginLeft: 'auto', color: '#aaa', fontSize: 18 }}>{isOpen ? '▲' : '▼'}</div>
              </div>

              {/* Expanded section */}
              {isOpen && (
                <div style={{ borderTop: '1px solid #F0F0F0', padding: isMobile ? '16px' : '24px 24px 28px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1fr 1fr', gap: isMobile ? 18 : 24 }}>

                    {/* LEFT: Property + Q&A */}
                    <div>
                      {/* Property details */}
                      <div style={{ marginBottom: 20 }}>
                        <div style={sectionTitleStyle}>Property Details</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {[
                            ['Address', item.property_address || 'Not provided'],
                            ['Listing URL', item.listing_url ? item.listing_url.substring(0, 60) + '…' : 'Not provided'],
                            ['Client email', item.email],
                          ].map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
                              <span style={{ fontSize: 12, color: '#888', minWidth: isMobile ? 0 : 80, flexShrink: 0 }}>{k}</span>
                              <span style={{ fontSize: 12, color: '#333', fontWeight: 500, wordBreak: 'break-all' }}>{v}</span>
                            </div>
                          ))}
                        </div>
                        {item.listing_url && (
                          <a href={item.listing_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: '#7C3AED', fontWeight: 600 }}>Open Listing</a>
                        )}
                        {item.report_status === 'completed' && (
                          <a href={`/stale-listings/report/${item.reference}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, marginLeft: 12, fontSize: 12, color: '#059669', fontWeight: 600 }}>View Report</a>
                        )}
                      </div>

                      {/* Questionnaire answers */}
                      {Object.keys(qData).length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={sectionTitleStyle}>Questionnaire Answers</div>
                          <div style={{ display: 'grid', gap: 6 }}>
                            {Object.entries(Q_LABELS).map(([key, label]) => {
                              const val = qData[key];
                              if (!val) return null;
                              const display = Array.isArray(val) ? val.join(', ') : val;
                              return (
                                <div key={key} style={{ display: 'flex', gap: 10, padding: '6px 10px', borderRadius: 6, background: '#FAFAFA', border: '1px solid #F0F0F0' }}>
                                  <span style={{ fontSize: 11, color: '#888', minWidth: 120, flexShrink: 0, fontWeight: 500 }}>{label}</span>
                                  <span style={{ fontSize: 11, color: '#333', fontWeight: 600 }}>{display}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Review workflow */}
                      <div style={{ marginBottom: 20 }}>
                        <div style={sectionTitleStyle}>Review Workflow</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                          <ReviewSurfaceButton active={reviewSurface === 'ai'} onClick={() => setReviewSurface('ai')}>
                            View AI Draft
                          </ReviewSurfaceButton>
                          <ReviewSurfaceButton active={reviewSurface === 'edit'} onClick={() => setReviewSurface('edit')}>
                            Edit Final Report
                          </ReviewSurfaceButton>
                          <ReviewSurfaceButton active={reviewSurface === 'preview'} onClick={() => setReviewSurface('preview')}>
                            Preview Final Report
                          </ReviewSurfaceButton>
                        </div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FAFAFA', border: '1px solid #F0F0F0', fontSize: 12, color: '#555555', lineHeight: 1.7 }}>
                            Review the original AI draft first, make section-by-section edits, add your own commentary, then preview exactly what the client will receive before you send it.
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ background: '#EDE9FE', color: '#5B21B6', padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                              {item.agent_edited_report_json ? 'Edited draft saved' : 'Using original AI draft'}
                            </span>
                            <span style={{ background: '#F5F5F5', color: '#555555', padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                              Send only after preview and approval
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Agent comments */}
                      <div>
                        <div style={sectionTitleStyle}>Agent Comments (Shown To Client)</div>
                        <textarea
                          value={agentNotes}
                          onChange={e => setAgentNotes(e.target.value)}
                          placeholder="Add your own market commentary, local context, cautions, or next-step advice. This section will appear in the client report."
                          style={{ ...textareaStyle, minHeight: 140 }}
                        />
                        <p style={{ margin: '8px 0 0', color: '#7A7A7A', fontSize: 12, lineHeight: 1.6 }}>
                          Paragraph breaks are preserved in the final report, so you can write this like a proper note rather than one long block.
                        </p>
                      </div>
                    </div>

                    {/* RIGHT: Report Editor */}
                    <div>
                      {!hasAiReport && (
                        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400E' }}>
                          AI report has not been generated yet. This may be because Groq is not configured or the background task is still running.
                        </div>
                      )}
                      {reviewSurface === 'ai' && (
                        aiDraft ? (
                          <ReportPreviewPanel
                            report={aiDraft}
                            packageLabel={packageLabel}
                            reference={item.reference}
                            propertyAddress={item.property_address}
                            agentComments=""
                            heading="Original AI Draft"
                            subheading="This is the untouched machine-generated draft before any human review."
                            compact={isTablet}
                          />
                        ) : (
                          <div style={previewCardStyle}>
                            <div style={sectionTitleStyle}>Original AI Draft</div>
                            <PreviewCopy text="The AI draft has not been generated yet for this assessment." muted />
                          </div>
                        )
                      )}
                      {reviewSurface === 'preview' && reportEdit && (
                        <ReportPreviewPanel
                          report={reportEdit}
                          packageLabel={packageLabel}
                          reference={item.reference}
                          propertyAddress={item.property_address}
                          agentComments={agentNotes}
                          heading="Final Client Preview"
                          subheading="This is the reviewed version that will be sent to the client after approval."
                          compact={isTablet}
                        />
                      )}
                      {reviewSurface === 'edit' && reportEdit && (
                        <>
                          <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: 12, marginBottom: 18, padding: '12px 14px', borderRadius: 12, border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                            <div>
                              <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 15, color: '#111111' }}>Edit the final report the client will receive</div>
                              <div style={{ marginTop: 4, fontSize: 12, color: '#666666', lineHeight: 1.6 }}>
                                The original AI draft stays preserved separately. Your edits here become the reviewed version that is previewed and then sent.
                              </div>
                            </div>
                            {aiDraft && (
                              <button
                                onClick={() => {
                                  if (!confirm('Reset the editable report back to the original AI draft? Your unsaved section edits will be replaced.')) return;
                                  setReportEdit(aiDraft);
                                  setSuccessMsg('Editable report reset to the original AI draft.');
                                  setTimeout(() => setSuccessMsg(''), 3000);
                                }}
                                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#333333', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0, width: isMobile ? '100%' : 'auto' }}
                              >
                                Reset to AI Draft
                              </button>
                            )}
                          </div>
                          {/* Scores */}
                          <div style={{ marginBottom: 20 }}>
                            <div style={sectionTitleStyle}>Scores</div>
                            <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                              <div>
                                <label style={labelStyle}>Overall Score</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input type="range" min={0} max={100} value={reportEdit.overall_score} onChange={e => setReportEdit({ ...reportEdit, overall_score: Number(e.target.value) })} style={{ flex: 1, minWidth: 100 }} />
                                  <span style={{ fontWeight: 700, fontSize: 18, color: reportEdit.overall_score >= 70 ? '#16A34A' : reportEdit.overall_score >= 50 ? '#D97706' : '#DC2626' }}>{reportEdit.overall_score}</span>
                                </div>
                              </div>
                              <div>
                                <label style={labelStyle}>Days on Market</label>
                                <input type="number" value={reportEdit.days_on_market ?? ''} onChange={e => setReportEdit({ ...reportEdit, days_on_market: e.target.value ? Number(e.target.value) : null })} placeholder="e.g. 47" style={{ ...inputStyle, width: 90 }} />
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                              {(['photos', 'pricing', 'description', 'positioning'] as const).map(dim => (
                                <ScoreInput key={dim} label={dim.charAt(0).toUpperCase() + dim.slice(1)} value={reportEdit.scores[dim]} onChange={v => setReportEdit({ ...reportEdit, scores: { ...reportEdit.scores, [dim]: v } })} />
                              ))}
                            </div>
                          </div>

                          {/* Executive summary */}
                          <div style={{ marginBottom: 20 }}>
                            <div style={sectionTitleStyle}>Executive Summary</div>
                            <textarea value={reportEdit.executive_summary} onChange={e => setReportEdit({ ...reportEdit, executive_summary: e.target.value })} style={{ ...textareaStyle, minHeight: 100 }} placeholder="3-4 sentence honest summary…" />
                          </div>

                          {/* Key findings */}
                          <div style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid #F0F0F0', paddingBottom: 6 }}>
                              <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 14, color: '#0A0A0A' }}>Key Findings</span>
                              <button onClick={() => setReportEdit({ ...reportEdit, key_findings: [...reportEdit.key_findings, { title: '', description: '', type: 'issue', icon: '' }] })} style={{ fontSize: 12, color: '#7C3AED', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Add Finding</button>
                            </div>
                            {reportEdit.key_findings.map((f, idx) => (
                              <div key={idx} style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px', marginBottom: 8, background: '#FAFAFA' }}>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexDirection: isMobile ? 'column' : 'row' }}>
                                  <input value={f.title} onChange={e => updateFinding(idx, 'title', e.target.value)} placeholder="Finding title" style={{ ...inputStyle, flex: 2 }} />
                                  <select value={f.type} onChange={e => updateFinding(idx, 'type', e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                                    <option value="issue">Issue</option>
                                    <option value="strength">Strength</option>
                                  </select>
                                  <select value={f.icon || ''} onChange={e => updateFinding(idx, 'icon', e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                                  <option value="">- icon -</option>
                                    {['price', 'photos', 'description', 'location', 'marketing', 'condition', 'timing'].map(ic => <option key={ic} value={ic}>{ic}</option>)}
                                  </select>
                                  <button onClick={() => setReportEdit({ ...reportEdit, key_findings: reportEdit.key_findings.filter((_, i) => i !== idx) })} style={{ background: '#FEE2E2', border: 'none', borderRadius: 6, padding: '0 10px', cursor: 'pointer', color: '#B91C1C', fontWeight: 700, fontSize: 14 }}>X</button>
                                </div>
                                <textarea value={f.description} onChange={e => updateFinding(idx, 'description', e.target.value)} placeholder="Finding description…" style={{ ...textareaStyle, minHeight: 60 }} />
                              </div>
                            ))}
                          </div>

                          {/* Action plan */}
                          <div style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid #F0F0F0', paddingBottom: 6 }}>
                              <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 14, color: '#0A0A0A' }}>Action Plan</span>
                              <button onClick={() => setReportEdit({ ...reportEdit, action_plan: [...reportEdit.action_plan, { priority: 'MEDIUM', title: '', description: '', bullets: ['', ''] }] })} style={{ fontSize: 12, color: '#7C3AED', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Add Action</button>
                            </div>
                            {reportEdit.action_plan.map((a, idx) => (
                              <div key={idx} style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px', marginBottom: 8, background: '#FAFAFA' }}>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexDirection: isMobile ? 'column' : 'row' }}>
                                  <select value={a.priority} onChange={e => updateAction(idx, 'priority', e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                                    <option value="URGENT">URGENT</option>
                                    <option value="HIGH">HIGH</option>
                                    <option value="MEDIUM">MEDIUM</option>
                                  </select>
                                  <input value={a.title} onChange={e => updateAction(idx, 'title', e.target.value)} placeholder="Action title" style={{ ...inputStyle, flex: 3 }} />
                                  <button onClick={() => setReportEdit({ ...reportEdit, action_plan: reportEdit.action_plan.filter((_, i) => i !== idx) })} style={{ background: '#FEE2E2', border: 'none', borderRadius: 6, padding: '0 10px', cursor: 'pointer', color: '#B91C1C', fontWeight: 700, fontSize: 14 }}>X</button>
                                </div>
                                <textarea value={a.description} onChange={e => updateAction(idx, 'description', e.target.value)} placeholder="Action description…" style={{ ...textareaStyle, minHeight: 50, marginBottom: 8 }} />
                                {a.bullets.map((b, bIdx) => (
                                  <div key={bIdx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                    <span style={{ color: '#888', fontSize: 13, paddingTop: 8 }}>•</span>
                                    <input value={b} onChange={e => updateBullet(idx, bIdx, e.target.value)} placeholder={`Bullet ${bIdx + 1}`} style={{ ...inputStyle, flex: 1 }} />
                                    <button onClick={() => { const bullets = a.bullets.filter((_, i) => i !== bIdx); updateAction(idx, 'description', a.description); const plan = [...reportEdit.action_plan]; plan[idx] = { ...plan[idx], bullets }; setReportEdit({ ...reportEdit, action_plan: plan }); }} style={{ background: '#F5F5F5', border: 'none', borderRadius: 4, padding: '0 8px', cursor: 'pointer', color: '#888' }}>X</button>
                                  </div>
                                ))}
                                <button onClick={() => { const plan = [...reportEdit.action_plan]; plan[idx] = { ...plan[idx], bullets: [...plan[idx].bullets, ''] }; setReportEdit({ ...reportEdit, action_plan: plan }); }} style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4 }}>+ Add bullet</button>
                              </div>
                            ))}
                          </div>

                          {/* Comparable sales */}
                          <div style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid #F0F0F0', paddingBottom: 6 }}>
                              <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 14, color: '#0A0A0A' }}>Comparable Sales</span>
                              <button onClick={() => setReportEdit({ ...reportEdit, comparable_sales: [...reportEdit.comparable_sales, { address: '', beds: 3, property_type: 'Semi-det.', sold_asking: '', is_subject: false }] })} style={{ fontSize: 12, color: '#7C3AED', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Add Comparable</button>
                            </div>
                            {reportEdit.comparable_sales.map((c, idx) => (
                              <div key={idx} style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px', marginBottom: 6, background: c.is_subject ? '#FFFBEB' : '#FAFAFA', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row' }}>
                                <input value={c.address} onChange={e => updateComparable(idx, 'address', e.target.value)} placeholder="Address" style={{ ...inputStyle, flex: 3, minWidth: 140 }} />
                                <input type="number" value={c.beds} onChange={e => updateComparable(idx, 'beds', Number(e.target.value))} placeholder="Beds" style={{ ...inputStyle, width: 60, flexShrink: 0 }} />
                                <input value={c.property_type} onChange={e => updateComparable(idx, 'property_type', e.target.value)} placeholder="Type" style={{ ...inputStyle, flex: 1, minWidth: 80 }} />
                                <input value={c.sold_asking} onChange={e => updateComparable(idx, 'sold_asking', e.target.value)} placeholder="£xxx,xxx" style={{ ...inputStyle, flex: 1, minWidth: 90 }} />
                                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#555', cursor: 'pointer', flexShrink: 0 }}>
                                  <input type="checkbox" checked={c.is_subject} onChange={e => updateComparable(idx, 'is_subject', e.target.checked)} />
                                  Subject
                                </label>
                                <button onClick={() => setReportEdit({ ...reportEdit, comparable_sales: reportEdit.comparable_sales.filter((_, i) => i !== idx) })} style={{ background: '#FEE2E2', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#B91C1C', fontWeight: 700 }}>X</button>
                              </div>
                            ))}
                          </div>

                          {/* Pricing recommendation */}
                          <div style={{ marginBottom: 20 }}>
                            <div style={sectionTitleStyle}>Pricing Recommendation</div>
                            <input value={reportEdit.pricing_recommendation} onChange={e => setReportEdit({ ...reportEdit, pricing_recommendation: e.target.value })} placeholder="One-sentence pricing recommendation…" style={{ ...inputStyle, marginBottom: 8 }} />
                            <textarea value={reportEdit.pricing_recommendation_detail} onChange={e => setReportEdit({ ...reportEdit, pricing_recommendation_detail: e.target.value })} placeholder="2-3 sentences explaining the rationale…" style={{ ...textareaStyle, minHeight: 70 }} />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, alignItems: isMobile ? 'stretch' : 'center', marginTop: 24, paddingTop: 20, borderTop: '1px solid #F0F0F0', flexWrap: 'wrap' }}>
                    <button onClick={() => handleSaveDraft(item)} disabled={saving} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, color: '#333', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, width: isMobile ? '100%' : 'auto' }}>
                      {saving ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button
                      onClick={() => handleOpenActualReportPreview(item)}
                      disabled={reviewMode ? (!reportEdit || openingPreview) : false}
                      style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #D8B4FE', background: '#FAF5FF', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: '#7C3AED', cursor: reviewMode && (!reportEdit || openingPreview) ? 'not-allowed' : 'pointer', opacity: reviewMode && (!reportEdit || openingPreview) ? 0.7 : 1, width: isMobile ? '100%' : 'auto' }}
                    >
                      {openingPreview ? 'Opening Preview...' : 'Preview Final Report'}
                    </button>
                    <button onClick={() => handleApprove(item)} disabled={approving || !reportEdit} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#059669', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: '#fff', cursor: (approving || !reportEdit) ? 'not-allowed' : 'pointer', opacity: (approving || !reportEdit) ? 0.7 : 1, width: isMobile ? '100%' : 'auto' }}>
                      {approving ? 'Sending...' : 'Approve & Send To Client'}
                    </button>
                    {item.report_status === 'completed' && (
                      <a href={`/stale-listings/report/${item.reference}`} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #7C3AED', background: '#EDE9FE', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, color: '#5B21B6', textDecoration: 'none', width: isMobile ? '100%' : 'auto', boxSizing: 'border-box', textAlign: 'center' }}>
                        View Report
                      </a>
                    )}
                    {!reviewMode && (
                      <div style={{ marginLeft: isMobile ? 0 : 'auto', width: isMobile ? '100%' : 'auto' }}>
                        <button onClick={() => handleDelete(item)} disabled={deleting === item.assessment_id} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: '#B91C1C', cursor: 'pointer', opacity: deleting === item.assessment_id ? 0.6 : 1, width: isMobile ? '100%' : 'auto' }}>
                          {deleting === item.assessment_id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

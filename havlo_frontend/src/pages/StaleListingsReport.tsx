import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { usePageMeta } from '../hooks/usePageMeta';
import { StaleListingsLogo } from '../components/shared/StaleListingsLogo';

interface ComparableSale {
  address: string;
  beds: number;
  property_type: string;
  sold_asking: string;
  is_subject: boolean;
}

interface ListingSnapshot {
  title: string;
  address: string;
  price: string;
  image: string;
  bedrooms: string;
  bathrooms: string;
  property_type: string;
  platform: string;
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
  listing_image_url?: string;
  listing_snapshot?: ListingSnapshot | null;
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

const PRIORITY_ACCENTS: Record<string, { color: string; bg: string }> = {
  URGENT: { color: '#D94716', bg: '#FFF1E8' },
  HIGH: { color: '#D97706', bg: '#FFF5E8' },
  MEDIUM: { color: '#15803D', bg: '#E7FAF3' },
};

function scoreBarColor(score: number) {
  return score >= 70 ? '#2E8B2F' : score >= 50 ? '#F18A00' : '#ED3B2F';
}

function overallScoreColor(score: number) {
  return score >= 70 ? '#12824A' : score >= 50 ? '#E06D00' : '#D93025';
}

function sentenceCasePlatform(platform: string) {
  const value = (platform || '').trim().toLowerCase();
  if (!value) return '';
  if (value === 'onthemarket') return 'OnTheMarket';
  if (value === 'rightmove') return 'Rightmove';
  if (value === 'zoopla') return 'Zoopla';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPropertyMeta(snapshot: ListingSnapshot | null | undefined, address: string) {
  const parts: string[] = [];
  if (snapshot?.bedrooms) parts.push(`${snapshot.bedrooms} bed`);
  if (snapshot?.bathrooms) parts.push(`${snapshot.bathrooms} bath`);
  if (snapshot?.property_type) parts.push(snapshot.property_type);
  if (snapshot?.price) parts.push(snapshot.price);
  return {
    address: snapshot?.address || snapshot?.title || address || 'Property address not provided',
    summary: parts.join(' · '),
    portalLabel: snapshot?.platform ? `Listed on ${sentenceCasePlatform(snapshot.platform)}` : '',
  };
}

function extractImage(assessment: Assessment) {
  return assessment.listing_snapshot?.image || assessment.listing_image_url || '';
}

function FindingIcon({ icon, type }: { icon?: string; type: string }) {
  const emojiMap: Record<string, string> = {
    price: '£',
    photos: '📷',
    description: '✏️',
    location: '📍',
    marketing: '●',
    condition: '🏠',
    timing: '⏱',
  };
  const glyph = emojiMap[icon || ''] || (type === 'strength' ? '●' : '•');
  return <span>{glyph}</span>;
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  return (
    <div className="slr-score-row">
      <div className="slr-score-row-head">
        <span>{label}</span>
        <strong style={{ color: scoreBarColor(score) }}>{score}</strong>
      </div>
      <div className="slr-score-track">
        <div className="slr-score-fill" style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: scoreBarColor(score) }} />
      </div>
    </div>
  );
}

function GetAgentLogo() {
  return (
    <div className="slr-logo-inline slr-logo-inline--getagent" aria-label="GetAgent">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <rect x="1.25" y="4.25" width="15.5" height="12.5" rx="2" stroke="#1F74FF" strokeWidth="1.5" />
        <path d="M4.5 12V10.2M7.5 12V7.6M10.5 12V9M13.5 12V5.5" stroke="#1F74FF" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span>GetAgent</span>
    </div>
  );
}

function EstateAgent4MeLogo() {
  return (
    <div className="slr-logo-inline slr-logo-inline--estateagent4me" aria-label="estateagent4me">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M11 3.5C6.85786 3.5 3.5 6.85786 3.5 11C3.5 15.1421 6.85786 18.5 11 18.5" stroke="#2D84DA" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M11 3.5C15.1421 3.5 18.5 6.85786 18.5 11" stroke="#2D84DA" strokeWidth="2.4" strokeLinecap="round" opacity="0.35" />
      </svg>
      <span><strong>estateagent</strong><em>4me</em></span>
    </div>
  );
}

function ConciergeHomeLogo() {
  return (
    <img src="/report-logos/concierge-home.png" alt="Concierge Home" className="slr-logo-image slr-logo-image--concierge" />
  );
}

function PhotoplanLogo() {
  return (
    <div className="slr-logo-inline slr-logo-inline--photoplan" aria-label="photoplan bookings">
      <span>photoplan</span>
      <small>bookings</small>
    </div>
  );
}

function FocalAgentLogo() {
  return (
    <div className="slr-logo-inline slr-logo-inline--focalagent" aria-label="FOCAL.AGENT">
      <span>FOCAL.</span>
      <em>AGENT</em>
    </div>
  );
}

function HiLogisticsLogo() {
  return (
    <img
      src="/report-logos/hi%20logistics.png"
      alt="HI Logistics"
      className="slr-logo-image slr-logo-image--hilogistics"
    />
  );
}

type ServiceCardItem = {
  title: string;
  description: string;
  logos: ReactNode[];
};

function printFindingAccent(type: string, index: number) {
  if (type === 'strength') {
    return { bg: '#E8FBF6', border: '#B8F0E0', title: '#0E7A50', dot: '#D93A2E' };
  }
  if (index === 0) {
    return { bg: '#FFF2F1', border: '#FFD7D1', title: '#E33B2F', dot: '#D93A2E' };
  }
  return { bg: '#FFF4E9', border: '#FFDABB', title: '#E06A00', dot: '#DF6D00' };
}

function PrintGauge({ score }: { score: number }) {
  const normalized = Math.max(0, Math.min(100, score));
  const color = scoreBarColor(normalized);
  const cx = 88;
  const cy = 84;
  const radius = 56;
  const strokeWidth = 13;
  const trackFraction = 0.8;
  const circumference = 2 * Math.PI * radius;
  const visibleLength = circumference * trackFraction;
  const gapLength = circumference - visibleLength;
  const activeLength = visibleLength * (normalized / 100);
  const rotation = 90 + (((1 - trackFraction) * 360) / 2);
  const trackDash = `${visibleLength.toFixed(2)} ${gapLength.toFixed(2)}`;
  const activeDash = `${activeLength.toFixed(2)} ${circumference.toFixed(2)}`;

  return (
    <svg
      width="176"
      height="168"
      viewBox="0 0 176 168"
      role="img"
      aria-label={`Total score ${normalized}`}
      style={{ overflow: 'visible' }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="#D9D9D9"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={trackDash}
        transform={`rotate(${rotation} ${cx} ${cy})`}
      />
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={activeDash}
        transform={`rotate(${rotation} ${cx} ${cy})`}
      />
      <text
        x={cx}
        y="87"
        textAnchor="middle"
        fontFamily='"Plus Jakarta Sans", Arial, sans-serif'
        fontWeight="800"
        fontSize="40"
        fill="#111111"
      >
        {normalized}
      </text>
      <text
        x={cx}
        y="111"
        textAnchor="middle"
        fontFamily="Inter, Arial, sans-serif"
        fontWeight="500"
        fontSize="10.8"
        fill="#666666"
      >
        TOTAL
      </text>
      <text
        x={cx}
        y="124"
        textAnchor="middle"
        fontFamily="Inter, Arial, sans-serif"
        fontWeight="500"
        fontSize="10.8"
        fill="#666666"
      >
        SCORE
      </text>
    </svg>
  );
}

const SERVICE_CARDS: ServiceCardItem[] = [
  {
    title: 'Premium Marketing & Seller Services',
    description: 'Advanced property exposure and promotion designed to help properties sell faster.',
    logos: [
      <img key="havlo" src="/Havlo%20Black%20Transparent.png" alt="Havlo" className="slr-logo-image slr-logo-image--havlo" />,
    ],
  },
  {
    title: 'Repairs & Home Improvement',
    description: 'Fix overlooked issues that may reduce buyer confidence',
    logos: [<ConciergeHomeLogo key="concierge" />],
  },
  {
    title: 'Estate Agent Comparison',
    description: 'Help homeowners compare local agents based on performance, fees, and speed of sale.',
    logos: [<GetAgentLogo key="getagent" />, <EstateAgent4MeLogo key="estateagent4me" />],
  },
  {
    title: 'Conveyancing & Legal Services',
    description: 'Help sellers manage the legal side of the transaction smoothly.',
    logos: [
      <img key="reallymoving" src="/report-logos/reallymoving.svg" alt="reallymoving" className="slr-logo-image slr-logo-image--rm" />,
      <img key="comparemymove" src="/report-logos/comparemymove.svg" alt="Compare My Move" className="slr-logo-image slr-logo-image--cmm" />,
    ],
  },
  {
    title: 'Property Market Data & Pricing',
    description: 'Analyze pricing trends, comparable sales, and market performance.',
    logos: [
      <img key="propertydata" src="/report-logos/propertydata.svg" alt="PropertyData" className="slr-logo-image slr-logo-image--propertydata" />,
      <img key="home" src="/report-logos/home.svg" alt="home.co.uk" className="slr-logo-image slr-logo-image--home" />,
    ],
  },
  {
    title: 'Professional Photography & Media',
    description: 'Improve buyer engagement with high-quality visuals and video tours.',
    logos: [<PhotoplanLogo key="photoplan" />, <FocalAgentLogo key="focalagent" />],
  },
  {
    title: 'Moving & Relocation Services',
    description: 'Support homeowners preparing for their move after the sale.',
    logos: [<HiLogisticsLogo key="hi" />, <img key="anyvan" src="/report-logos/anyvan.svg" alt="AnyVan" className="slr-logo-image slr-logo-image--anyvan" />],
  },
];

export function StaleListingsReport() {
  usePageMeta({
    title: 'Your Property Listing Report | Havlo',
    description: 'View your personalised listing report with an overall score, comparable sales, pricing recommendation, and a step-by-step action plan to help your property sell.',
    canonical: 'https://www.heyhavlo.com/stale-listings/report',
  });

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
      .then((data) => {
        setAssessment(data as Assessment);
        setLoading(false);
        if (data.report_status === 'completed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setPolling(false);
        }
      })
      .catch(() => {
        setError('Report not found or not yet available.');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!reference) {
      setError('No report reference provided.');
      setLoading(false);
      return;
    }
    fetchReport();
  }, [reference]);

  useEffect(() => {
    if (!assessment) return;
    if (assessment.report_status !== 'completed' && assessment.payment_status === 'completed') {
      setPolling(true);
      pollRef.current = setInterval(fetchReport, 8000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [assessment?.report_status, assessment?.payment_status]);

  const handleDownloadPDF = () => {
    window.print();
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F8F8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #E5E7EB', borderTopColor: '#000', borderRadius: '50%', animation: 'slr-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontFamily: 'Inter, sans-serif', color: '#666', fontSize: 15 }}>Loading your report…</p>
        </div>
        <style>{'@keyframes slr-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F8F8' }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
          <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 24, marginBottom: 8, color: '#111' }}>Report not found</h2>
          <p style={{ fontFamily: 'Inter, sans-serif', color: '#666', fontSize: 15, marginBottom: 24 }}>{error || 'This report could not be found. Please check your reference code.'}</p>
          <button onClick={() => navigate('/stale-listings')} style={{ background: '#000', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            Back to StaleListings
          </button>
        </div>
      </div>
    );
  }

  const report = assessment.report_data;
  const snapshot = assessment.listing_snapshot || null;
  const propertyMeta = formatPropertyMeta(snapshot, assessment.property_address || '');
  const propertyImage = extractImage(assessment);
  const issues = report?.key_findings.filter((item) => item.type !== 'strength').length || 0;
  const strengths = report?.key_findings.filter((item) => item.type === 'strength').length || 0;
  const isPending = assessment.payment_status !== 'completed';
  const isProcessing = assessment.payment_status === 'completed' && assessment.report_status !== 'completed';
  const currentPackage = PACKAGE_LABELS[assessment.package] || assessment.package;
  const pdfPrimaryFindings = report?.key_findings.slice(0, 4) ?? [];
  const pdfAdditionalFindings = report?.key_findings.slice(4) ?? [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes slr-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .slr-page {
          min-height: 100vh;
          background: #f4f5f5;
          color: #1f1f1e;
          font-family: 'Inter', sans-serif;
        }
        .slr-topbar {
          background: #ffffff;
          border-bottom: 1px solid #ececec;
        }
        .slr-topbar-inner,
        .slr-shell {
          width: min(1328px, calc(100% - 48px));
          margin: 0 auto;
        }
        .slr-topbar-inner {
          min-height: 84px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 0;
        }
        .slr-topbar-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .slr-shell {
          padding: 26px 0 40px;
        }
        .slr-title-wrap {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 28px;
        }
        .slr-title-wrap h1 {
          margin: 0;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(28px, 4vw, 58px);
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1.02;
        }
        .slr-title-wrap p {
          margin: 0;
          font-size: 17px;
          line-height: 1.35;
          color: #262626;
        }
        .slr-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 512px) minmax(0, 1fr);
          gap: 24px;
          align-items: stretch;
        }
        .slr-card {
          border-radius: 32px;
          border: 1px solid #dadbdb;
          background: #ffffff;
          box-shadow: 0 1px 0 rgba(0,0,0,0.02);
        }
        .slr-property-card {
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .slr-property-image {
          aspect-ratio: 16 / 13;
          background: #dcdcdc;
        }
        .slr-property-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .slr-property-image-placeholder {
          width: 100%;
          height: 100%;
          background: linear-gradient(180deg, #dedede 0%, #d1d1d1 100%);
        }
        .slr-property-body {
          padding: 22px 28px 26px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .slr-property-address {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(21px, 2vw, 28px);
          font-weight: 800;
          line-height: 1.08;
          letter-spacing: -0.04em;
          margin: 0;
        }
        .slr-property-subline {
          margin: 0;
          font-size: 18px;
          line-height: 1.35;
          color: #333333;
        }
        .slr-overall-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          margin-bottom: 18px;
        }
        .slr-overall-head span {
          font-size: 18px;
          font-weight: 700;
        }
        .slr-overall-value {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .slr-overall-value strong {
          font-size: clamp(36px, 4vw, 56px);
          line-height: 0.95;
          letter-spacing: -0.05em;
        }
        .slr-overall-value em {
          font-style: normal;
          font-size: 21px;
          color: #303030;
          font-weight: 600;
        }
        .slr-score-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 14px;
        }
        .slr-score-row-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          color: #252525;
        }
        .slr-score-row-head strong {
          font-size: 14px;
        }
        .slr-score-track {
          height: 5px;
          border-radius: 999px;
          background: #ececec;
          overflow: hidden;
        }
        .slr-score-fill {
          height: 100%;
          border-radius: 999px;
        }
        .slr-findings-card {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .slr-findings-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 22px 24px;
          border-bottom: 1px solid #ebebeb;
        }
        .slr-findings-head h2,
        .slr-analysis-card h2,
        .slr-services-head h2 {
          margin: 0;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(26px, 2.4vw, 40px);
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1.04;
        }
        .slr-findings-head p {
          margin: 0;
          font-size: 16px;
          line-height: 1.3;
          color: #1f1f1e;
          text-align: right;
          white-space: nowrap;
        }
        .slr-findings-list {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 22px;
        }
        .slr-finding-item {
          border-radius: 24px;
          padding: 22px 22px 20px;
          border: 1px solid transparent;
          display: flex;
          gap: 18px;
          align-items: flex-start;
        }
        .slr-finding-icon {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.04);
        }
        .slr-finding-copy h3 {
          margin: 0 0 8px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 700;
          font-size: clamp(18px, 1.8vw, 28px);
          letter-spacing: -0.04em;
          line-height: 1.1;
        }
        .slr-finding-copy p {
          margin: 0;
          font-size: 16px;
          line-height: 1.55;
          color: #2a2a2a;
        }
        .slr-summary-note {
          margin-top: 8px;
          padding: 18px 22px;
          border-radius: 20px;
          background: #f7f8f8;
          border: 1px solid #ececec;
          font-size: 15px;
          line-height: 1.65;
          color: #424242;
        }
        .slr-analysis-stack {
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin-top: 24px;
        }
        .slr-analysis-card {
          padding: 26px 28px 28px;
        }
        .slr-analysis-card h2 {
          font-size: clamp(24px, 2vw, 34px);
          margin-bottom: 18px;
        }
        .slr-compare-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 15px;
        }
        .slr-compare-table thead th {
          background: #0e0e0e;
          color: #ffffff;
          padding: 12px 14px;
          text-align: left;
          font-size: 13px;
          font-weight: 700;
        }
        .slr-compare-table tbody td {
          padding: 13px 14px;
          border-bottom: 1px solid #ededed;
          color: #242424;
        }
        .slr-compare-table tbody tr:last-child td {
          border-bottom: none;
        }
        .slr-compare-table tbody tr.is-subject {
          background: #fff4eb;
        }
        .slr-recommendation-box {
          margin-top: 12px;
          border: 1px solid #ececec;
          background: #ffffff;
          padding: 14px 12px 4px;
        }
        .slr-recommendation-box strong {
          display: block;
          margin-bottom: 8px;
          color: #eb6200;
          font-size: 16px;
        }
        .slr-recommendation-box p {
          margin: 0 0 10px;
          color: #303030;
          font-size: 14px;
          line-height: 1.55;
        }
        .slr-action-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .slr-action-item {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr);
          gap: 14px;
          padding: 16px 12px;
          border: 1px solid #ececec;
          background: #ffffff;
        }
        .slr-action-index {
          font-size: 24px;
          line-height: 1;
          font-weight: 800;
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: #111111;
          padding-top: 2px;
        }
        .slr-action-copy {
          border-left: 1px solid #ededed;
          padding-left: 12px;
        }
        .slr-action-copy h3 {
          margin: 0 0 8px;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          font-size: 18px;
          line-height: 1.3;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 700;
          letter-spacing: -0.03em;
        }
        .slr-action-priority {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .slr-action-copy p {
          margin: 0 0 8px;
          color: #303030;
          font-size: 15px;
          line-height: 1.5;
        }
        .slr-action-copy ul {
          margin: 0;
          padding-left: 18px;
          color: #303030;
          font-size: 15px;
          line-height: 1.5;
        }
        .slr-services-wrap {
          margin-top: 32px;
        }
        .slr-services-head {
          margin-bottom: 22px;
        }
        .slr-services-head h2 {
          font-size: clamp(22px, 1.8vw, 28px);
          line-height: 1.1;
        }
        .slr-services-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }
        .slr-service-card {
          min-height: 282px;
          padding: 18px 20px 18px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 24px;
        }
        .slr-service-card h3 {
          margin: 0 0 10px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 20px;
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.04em;
        }
        .slr-service-card p {
          margin: 0;
          font-size: 15px;
          line-height: 1.33;
          color: #232323;
        }
        .slr-service-logos {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 16px;
        }
        .slr-logo-image {
          display: block;
          width: auto;
          height: auto;
          max-width: 100%;
          object-fit: contain;
        }
        .slr-logo-image--rm { width: 146px; }
        .slr-logo-image--cmm { width: 190px; }
        .slr-logo-image--concierge { width: 71px; }
        .slr-logo-image--havlo { width: 137px; }
        .slr-logo-image--propertydata { width: 190px; }
        .slr-logo-image--home { width: 104px; }
        .slr-logo-image--anyvan { width: 116px; }
        .slr-logo-inline {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .slr-logo-inline--getagent span {
          color: #1f74ff;
          font-size: 18px;
          font-weight: 700;
        }
        .slr-logo-inline--estateagent4me span {
          display: inline-flex;
          align-items: baseline;
          gap: 0;
          font-size: 14px;
          line-height: 1;
        }
        .slr-logo-inline--estateagent4me strong {
          color: #5d6670;
          font-weight: 700;
        }
        .slr-logo-inline--estateagent4me em {
          color: #2d84da;
          font-style: normal;
          font-weight: 700;
        }
        .slr-logo-inline--photoplan {
          flex-direction: column;
          align-items: flex-start;
          gap: 0;
          line-height: 1;
        }
        .slr-logo-inline--photoplan span {
          color: #111111;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.03em;
        }
        .slr-logo-inline--photoplan small {
          color: #f25f22;
          font-size: 10px;
          font-weight: 700;
          text-transform: lowercase;
          margin-left: 26px;
        }
        .slr-logo-inline--focalagent {
          gap: 0;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.04em;
        }
        .slr-logo-inline--focalagent span {
          color: #4b5563;
        }
        .slr-logo-inline--focalagent em {
          color: #eb4f7c;
          font-style: italic;
          margin-left: 3px;
        }
        .slr-logo-image--hilogistics { width: 138px; }
        .slr-disclaimer {
          margin-top: 18px;
          border-radius: 18px;
          border: 1px solid #ffe2b8;
          background: #fff6e9;
          padding: 16px 18px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .slr-disclaimer-icon {
          width: 22px;
          height: 22px;
          flex-shrink: 0;
          border-radius: 50%;
          border: 2px solid #ef8a00;
          color: #ef8a00;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 13px;
        }
        .slr-disclaimer p {
          margin: 0;
          color: #d35f00;
          font-size: 13px;
          line-height: 1.3;
          font-weight: 600;
        }
        .slr-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 10px 16px;
          border-radius: 16px;
          font-size: 16px;
          line-height: 1;
          white-space: nowrap;
          border: 1px solid transparent;
        }
        .slr-chip--market {
          background: #fff3eb;
          color: #f06f15;
        }
        .slr-chip--ready {
          background: #d9f8ea;
          color: #0d7a4e;
        }
        .slr-chip--button {
          background: #ffffff;
          color: #191919;
          border-color: #dfdfdf;
          cursor: pointer;
          font-weight: 500;
        }
        .slr-mobile-chip-row {
          display: none;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .pdf-print-area {
          display: none;
        }
        .slr-pdf-root {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .slr-pdf-page {
          width: 210mm;
          min-height: 297mm;
          box-sizing: border-box;
          padding: 10mm 8mm 8mm;
          background: #f5f5f5;
          color: #111111;
          font-family: 'Inter', Arial, sans-serif;
          display: flex;
          flex-direction: column;
        }
        .slr-pdf-page + .slr-pdf-page {
          page-break-before: always;
        }
        .slr-pdf-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12mm;
          margin-bottom: 7.5mm;
        }
        .slr-pdf-brand {
          height: 13mm;
          width: auto;
          display: block;
        }
        .slr-pdf-header-copy {
          text-align: right;
          font-size: 10pt;
          line-height: 1.28;
          color: #1f1f1e;
        }
        .slr-pdf-header-copy strong {
          display: block;
          font-weight: 500;
        }
        .slr-pdf-summary-card {
          background: #ffffff;
          border: 1px solid #e9e3dc;
          border-radius: 6mm;
          padding: 5mm 6.5mm;
          margin-bottom: 8.5mm;
        }
        .slr-pdf-summary-title {
          margin: 0 0 2mm;
          font-family: 'Plus Jakarta Sans', Arial, sans-serif;
          font-size: 13pt;
          line-height: 1.08;
          letter-spacing: -0.04em;
          font-weight: 800;
        }
        .slr-pdf-summary-subline {
          margin: 0 0 4mm;
          font-size: 10pt;
          line-height: 1.35;
          color: #323232;
        }
        .slr-pdf-pill-row {
          display: flex;
          gap: 3mm;
          flex-wrap: wrap;
        }
        .slr-pdf-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 9mm;
          padding: 0 4mm;
          border-radius: 3mm;
          font-size: 10pt;
          font-weight: 600;
          line-height: 1;
        }
        .slr-pdf-pill--market {
          background: #fff2e7;
          color: #f06f15;
        }
        .slr-pdf-pill--ready {
          background: #d7f6e7;
          color: #0d7a4e;
        }
        .slr-pdf-score-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 64mm;
          gap: 7mm;
          align-items: start;
          margin-bottom: 9mm;
        }
        .slr-pdf-kicker {
          margin: 0 0 4.5mm;
          font-size: 10pt;
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: 0.01em;
        }
        .slr-pdf-score-row {
          display: grid;
          grid-template-columns: 21mm 1fr;
          gap: 4mm;
          align-items: center;
          margin-bottom: 4mm;
          break-inside: avoid;
        }
        .slr-pdf-score-row:last-child {
          margin-bottom: 0;
        }
        .slr-pdf-score-label {
          font-size: 9pt;
          color: #1f1f1e;
        }
        .slr-pdf-score-track {
          height: 2.4mm;
          border-radius: 999px;
          background: #e6e6e6;
          overflow: hidden;
        }
        .slr-pdf-score-fill {
          height: 100%;
          border-radius: 999px;
        }
        .slr-pdf-gauge-wrap {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 6mm;
          padding-right: 0;
        }
        .slr-pdf-section-title {
          margin: 0 0 5mm;
          font-family: 'Plus Jakarta Sans', Arial, sans-serif;
          font-size: 18pt;
          line-height: 1.05;
          letter-spacing: -0.04em;
          font-weight: 800;
        }
        .slr-pdf-finding-list {
          display: flex;
          flex-direction: column;
          gap: 4.2mm;
        }
        .slr-pdf-finding-card {
          display: grid;
          grid-template-columns: 5mm 1fr;
          gap: 5mm;
          border-radius: 4.5mm;
          border: 1px solid #ffd4cf;
          padding: 4.5mm 5mm;
          break-inside: avoid;
        }
        .slr-pdf-finding-dot {
          width: 4mm;
          height: 4mm;
          border-radius: 50%;
          margin-top: 1.8mm;
        }
        .slr-pdf-finding-title {
          margin: 0 0 1.6mm;
          font-size: 12pt;
          line-height: 1.18;
          font-weight: 800;
        }
        .slr-pdf-finding-copy {
          margin: 0;
          font-size: 9.6pt;
          line-height: 1.42;
          color: #222222;
        }
        .slr-pdf-block {
          margin-bottom: 8.5mm;
        }
        .slr-pdf-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9.6pt;
          margin-bottom: 4mm;
        }
        .slr-pdf-table thead th {
          background: #111111;
          color: #ffffff;
          padding: 3mm 4mm;
          text-align: left;
          font-size: 9.2pt;
          font-weight: 700;
        }
        .slr-pdf-table tbody td {
          padding: 3mm 4mm;
          border-bottom: 1px solid #e9e9e9;
          color: #212121;
          vertical-align: top;
        }
        .slr-pdf-table tbody tr:last-child td {
          border-bottom: none;
        }
        .slr-pdf-table tbody tr.is-subject {
          background: #fff4ea;
        }
        .slr-pdf-table tbody tr.is-subject td {
          color: #e06b00;
          font-weight: 700;
        }
        .slr-pdf-recommendation {
          background: #ffffff;
          border: 1px solid #e7e7e7;
          padding: 4mm;
        }
        .slr-pdf-recommendation strong {
          display: block;
          margin-bottom: 2mm;
          color: #eb6200;
          font-size: 12pt;
          font-weight: 800;
        }
        .slr-pdf-recommendation p {
          margin: 0 0 2mm;
          font-size: 10pt;
          line-height: 1.42;
          color: #242424;
        }
        .slr-pdf-recommendation p:last-child {
          margin-bottom: 0;
        }
        .slr-pdf-action-list {
          display: flex;
          flex-direction: column;
          gap: 4mm;
        }
        .slr-pdf-action-card {
          background: #ffffff;
          border: 1px solid #ececec;
          display: grid;
          grid-template-columns: 8mm 1fr;
          gap: 4mm;
          padding: 4mm;
          break-inside: avoid;
        }
        .slr-pdf-action-index {
          font-family: 'Plus Jakarta Sans', Arial, sans-serif;
          font-size: 13pt;
          line-height: 1;
          font-weight: 800;
          color: #111111;
        }
        .slr-pdf-action-body {
          border-left: 1px solid #ececec;
          padding-left: 4mm;
        }
        .slr-pdf-action-head {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 3mm;
          margin-bottom: 1.5mm;
        }
        .slr-pdf-action-priority {
          font-size: 10pt;
          line-height: 1.1;
          font-weight: 800;
          text-transform: uppercase;
        }
        .slr-pdf-action-divider {
          font-size: 10pt;
          line-height: 1;
        }
        .slr-pdf-action-title {
          font-size: 12pt;
          line-height: 1.2;
          font-weight: 700;
        }
        .slr-pdf-action-description {
          margin: 0 0 1.5mm;
          font-size: 10pt;
          line-height: 1.42;
        }
        .slr-pdf-action-bullets {
          margin: 0;
          padding-left: 4.6mm;
          font-size: 9.5pt;
          line-height: 1.42;
        }
        .slr-pdf-footer-cta {
          margin-top: auto;
          background: #0e0e0e;
          color: #ffffff;
          padding: 5mm 5.5mm;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8mm;
          break-inside: avoid;
        }
        .slr-pdf-footer-cta h3 {
          margin: 0 0 1mm;
          font-size: 12pt;
          font-weight: 800;
        }
        .slr-pdf-footer-cta p {
          margin: 0;
          font-size: 9.5pt;
          line-height: 1.4;
          color: #e4e4e4;
        }
        .slr-pdf-footer-link {
          color: #f0a900;
          font-size: 11pt;
          line-height: 1;
          font-weight: 700;
          white-space: nowrap;
        }
        @media (max-width: 1120px) {
          .slr-main-grid {
            grid-template-columns: 1fr;
          }
          .slr-services-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .slr-topbar-actions {
            display: none;
          }
          .slr-mobile-chip-row {
            display: flex;
          }
        }
        @media (max-width: 720px) {
          .slr-topbar-inner,
          .slr-shell {
            width: min(100% - 32px, 1328px);
          }
          .slr-shell {
            padding-top: 12px;
          }
          .slr-card {
            border-radius: 20px;
          }
          .slr-property-body,
          .slr-findings-list,
          .slr-analysis-card {
            padding-left: 16px;
            padding-right: 16px;
          }
          .slr-findings-head {
            flex-direction: column;
            align-items: flex-start;
          }
          .slr-findings-head p {
            text-align: left;
            white-space: normal;
          }
          .slr-services-grid {
            grid-template-columns: 1fr;
          }
          .slr-service-card {
            min-height: 0;
          }
          .slr-compare-table {
            min-width: 560px;
          }
          .slr-action-item {
            grid-template-columns: 22px minmax(0, 1fr);
            gap: 10px;
          }
          .slr-title-wrap p {
            font-size: 15px;
          }
        }
        @media print {
          html,
          body {
            background: #ffffff !important;
            margin: 0;
            padding: 0;
          }
          body * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .slr-screen {
            display: none !important;
          }
          .pdf-print-area {
            display: block !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>

      <div className="slr-page">
        {isPending && (
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
            <div style={{ textAlign: 'center', maxWidth: 560 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
              <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 28, marginBottom: 12 }}>Payment pending</h2>
              <p style={{ fontFamily: 'Inter, sans-serif', color: '#666', fontSize: 16, marginBottom: 8 }}>Your payment has not yet been confirmed. If you have completed checkout, wait a moment and refresh.</p>
              <p style={{ fontFamily: 'Inter, sans-serif', color: '#999', fontSize: 14, marginBottom: 24 }}>Reference: <strong style={{ color: '#444' }}>{assessment.reference}</strong></p>
              <button onClick={fetchReport} style={{ background: '#000', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                Refresh Status
              </button>
            </div>
          </div>
        )}

        {isProcessing && (
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
            <div style={{ textAlign: 'center', maxWidth: 620 }}>
              <div style={{ width: 48, height: 48, border: '3px solid #E5E7EB', borderTopColor: '#000', borderRadius: '50%', animation: 'slr-spin 0.9s linear infinite', margin: '0 auto 20px' }} />
              <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 28, marginBottom: 12 }}>Your report is being prepared</h2>
              <p style={{ fontFamily: 'Inter, sans-serif', color: '#666', fontSize: 16, marginBottom: 8 }}>Payment confirmed. Our team is reviewing your assessment and preparing your personalised report. You will receive an email when it is ready.</p>
              <p style={{ fontFamily: 'Inter, sans-serif', color: '#999', fontSize: 14 }}>Reference: <strong style={{ color: '#444' }}>{assessment.reference}</strong>{polling ? ' · Checking for updates…' : ''}</p>
            </div>
          </div>
        )}

        {assessment.report_status === 'completed' && report && (
          <>
            <div className="slr-screen">
              <header className="slr-topbar">
                <div className="slr-topbar-inner">
                  <StaleListingsLogo style={{ height: 54, width: 'auto', display: 'block' }} />
                  <div className="slr-topbar-actions">
                    {report.days_on_market ? <span className="slr-chip slr-chip--market">On market {report.days_on_market} days</span> : null}
                    <span className="slr-chip slr-chip--ready">Report ready</span>
                    <button type="button" className="slr-chip slr-chip--button" onClick={handleDownloadPDF}>Download PDF</button>
                  </div>
                </div>
              </header>

              <main className="slr-shell">
                <div className="slr-title-wrap">
                  <div className="slr-mobile-chip-row">
                    {report.days_on_market ? <span className="slr-chip slr-chip--market">On market {report.days_on_market} days</span> : null}
                    <span className="slr-chip slr-chip--ready">Report ready</span>
                    <button type="button" className="slr-chip slr-chip--button" onClick={handleDownloadPDF}>Download PDF</button>
                  </div>
                  <h1>Your listing report</h1>
                  <p>{propertyMeta.address}{propertyMeta.portalLabel ? ` · ${propertyMeta.portalLabel}` : ` · ${currentPackage}`}</p>
                </div>

                <section className="slr-main-grid">
                  <article className="slr-card slr-property-card">
                    <div className="slr-property-image">
                      {propertyImage ? (
                        <img src={propertyImage} alt={propertyMeta.address} />
                      ) : (
                        <div className="slr-property-image-placeholder" />
                      )}
                    </div>
                    <div className="slr-property-body">
                      <div>
                        <h2 className="slr-property-address">{propertyMeta.address}</h2>
                        {propertyMeta.summary ? <p className="slr-property-subline">{propertyMeta.summary}</p> : null}
                      </div>

                      <div>
                        <div className="slr-overall-head">
                          <span>OVERALL SCORE</span>
                          <div className="slr-overall-value">
                            <strong style={{ color: overallScoreColor(report.overall_score) }}>{report.overall_score}</strong>
                            <em>/100</em>
                          </div>
                        </div>
                        <ScoreRow label="Photos" score={report.scores.photos} />
                        <ScoreRow label="Pricing" score={report.scores.pricing} />
                        <ScoreRow label="Description" score={report.scores.description} />
                        <ScoreRow label="Positioning" score={report.scores.positioning} />
                      </div>
                    </div>
                  </article>

                  <article className="slr-card slr-findings-card">
                    <div className="slr-findings-head">
                      <h2>Key findings</h2>
                      <p>{issues} issue{issues !== 1 ? 's' : ''} to address · {strengths} strength{strengths !== 1 ? 's' : ''} to leverage</p>
                    </div>
                    <div className="slr-findings-list">
                      {report.key_findings.map((finding, index) => {
                        const isStrength = finding.type === 'strength';
                        const accent = isStrength
                          ? { bg: '#DFF8F1', border: '#B9F0E1', title: '#0F7A53' }
                          : index === 0
                            ? { bg: '#FFF2F1', border: '#FFD4CF', title: '#E23B2E' }
                            : { bg: '#FFF4EA', border: '#FFD9BF', title: '#E06900' };
                        return (
                          <div key={`${finding.title}-${index}`} className="slr-finding-item" style={{ background: accent.bg, borderColor: accent.border }}>
                            <div className="slr-finding-icon" style={{ color: accent.title }}>
                              <FindingIcon icon={finding.icon} type={finding.type} />
                            </div>
                            <div className="slr-finding-copy">
                              <h3 style={{ color: accent.title }}>{finding.title}</h3>
                              <p>{finding.description}</p>
                            </div>
                          </div>
                        );
                      })}
                      {report.executive_summary ? <div className="slr-summary-note">{report.executive_summary}</div> : null}
                    </div>
                  </article>
                </section>

                <section className="slr-analysis-stack">
                  {report.comparable_sales.length > 0 ? (
                    <article className="slr-card slr-analysis-card">
                      <h2>Pricing vs. Comparable Sales</h2>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="slr-compare-table">
                          <thead>
                            <tr>
                              <th>Property</th>
                              <th>Beds</th>
                              <th>Type</th>
                              <th>Sold / Asking</th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.comparable_sales.map((sale, index) => (
                              <tr key={`${sale.address}-${index}`} className={sale.is_subject ? 'is-subject' : ''}>
                                <td>{sale.address}</td>
                                <td>{sale.beds || '—'}</td>
                                <td>{sale.property_type || '—'}</td>
                                <td style={{ color: sale.is_subject ? '#E06900' : '#2D2D2D', fontWeight: sale.is_subject ? 700 : 500 }}>{sale.sold_asking}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {(report.pricing_recommendation || report.pricing_recommendation_detail) ? (
                        <div className="slr-recommendation-box">
                          <strong>Recommendation</strong>
                          {report.pricing_recommendation ? <p>{report.pricing_recommendation}</p> : null}
                          {report.pricing_recommendation_detail ? <p>{report.pricing_recommendation_detail}</p> : null}
                        </div>
                      ) : null}
                    </article>
                  ) : null}

                  {report.action_plan.length > 0 ? (
                    <article className="slr-card slr-analysis-card">
                      <h2>Prioritised Action Plan</h2>
                      <div className="slr-action-list">
                        {report.action_plan.map((item, index) => {
                          const accent = PRIORITY_ACCENTS[item.priority] || PRIORITY_ACCENTS.MEDIUM;
                          return (
                            <div key={`${item.title}-${index}`} className="slr-action-item">
                              <div className="slr-action-index">{index + 1}</div>
                              <div className="slr-action-copy">
                                <h3>
                                  <span className="slr-action-priority" style={{ color: accent.color }}>{item.priority}</span>
                                  <span>—</span>
                                  <span>{item.title}</span>
                                </h3>
                                <p>{item.description}</p>
                                {item.bullets.length > 0 ? (
                                  <ul>
                                    {item.bullets.map((bullet, bulletIndex) => (
                                      <li key={`${bulletIndex}-${bullet}`}>{bullet}</li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  ) : null}
                </section>

                <section className="slr-services-wrap">
                  <div className="slr-services-head">
                    <h2>Based on your assessment, these platforms and services may help improve your sale.</h2>
                  </div>
                  <div className="slr-services-grid">
                    {SERVICE_CARDS.map((card) => (
                      <article key={card.title} className="slr-card slr-service-card">
                        <div>
                          <h3>{card.title}</h3>
                          <p>{card.description}</p>
                        </div>
                        <div className="slr-service-logos">
                          {card.logos.map((logo, index) => <div key={`${card.title}-${index}`}>{logo}</div>)}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <div className="slr-disclaimer">
                  <div className="slr-disclaimer-icon">i</div>
                  <p>Any third-party services referenced within this report are included solely to support the marketing and sale of your property and should not be interpreted as endorsement or formal affiliation.</p>
                </div>
              </main>
            </div>

            <div className="pdf-print-area">
              <div className="slr-pdf-root">
                <section className="slr-pdf-page">
                  <div className="slr-pdf-header">
                    <StaleListingsLogo className="slr-pdf-brand" />
                    <div className="slr-pdf-header-copy">
                      <strong>{propertyMeta.address}</strong>
                      <div>{propertyMeta.portalLabel || currentPackage}</div>
                    </div>
                  </div>

                  <section className="slr-pdf-summary-card">
                    <h2 className="slr-pdf-summary-title">{propertyMeta.address}</h2>
                    {propertyMeta.summary ? <p className="slr-pdf-summary-subline">{propertyMeta.summary}</p> : null}
                    <div className="slr-pdf-pill-row">
                      {report.days_on_market ? <span className="slr-pdf-pill slr-pdf-pill--market">On market {report.days_on_market} days</span> : null}
                      <span className="slr-pdf-pill slr-pdf-pill--ready">Report ready</span>
                    </div>
                  </section>

                  <section className="slr-pdf-score-grid">
                    <div>
                      <p className="slr-pdf-kicker">LISTING SCORE BREAKDOWN</p>
                      {[
                        ['PHOTOS', report.scores.photos],
                        ['PRICING', report.scores.pricing],
                        ['DESCRIPTION', report.scores.description],
                        ['POSITIONING', report.scores.positioning],
                      ].map(([label, score]) => (
                        <div key={label} className="slr-pdf-score-row">
                          <div className="slr-pdf-score-label">{label}</div>
                          <div className="slr-pdf-score-track">
                            <div className="slr-pdf-score-fill" style={{ width: `${Math.max(0, Math.min(100, Number(score)))}%`, background: scoreBarColor(Number(score)) }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="slr-pdf-gauge-wrap">
                      <PrintGauge score={report.overall_score} />
                    </div>
                  </section>

                  <h2 className="slr-pdf-section-title">Key Findings</h2>
                  <div className="slr-pdf-finding-list">
                    {pdfPrimaryFindings.map((finding, index) => {
                      const accent = printFindingAccent(finding.type, index);
                      return (
                        <article
                          key={`pdf-finding-${finding.title}-${index}`}
                          className="slr-pdf-finding-card"
                          style={{ background: accent.bg, borderColor: accent.border }}
                        >
                          <div className="slr-pdf-finding-dot" style={{ background: accent.dot }} />
                          <div>
                            <h3 className="slr-pdf-finding-title" style={{ color: accent.title }}>{finding.title}</h3>
                            <p className="slr-pdf-finding-copy">{finding.description}</p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="slr-pdf-page">
                  <div className="slr-pdf-header">
                    <StaleListingsLogo className="slr-pdf-brand" />
                    <div className="slr-pdf-header-copy">
                      <strong>{propertyMeta.address}</strong>
                      <div>{propertyMeta.portalLabel || currentPackage}</div>
                    </div>
                  </div>

                  {pdfAdditionalFindings.length > 0 ? (
                    <section className="slr-pdf-block">
                      <h2 className="slr-pdf-section-title">Additional Findings</h2>
                      <div className="slr-pdf-finding-list">
                        {pdfAdditionalFindings.map((finding, index) => {
                          const accent = printFindingAccent(finding.type, index + pdfPrimaryFindings.length);
                          return (
                            <article
                              key={`pdf-extra-finding-${finding.title}-${index}`}
                              className="slr-pdf-finding-card"
                              style={{ background: accent.bg, borderColor: accent.border }}
                            >
                              <div className="slr-pdf-finding-dot" style={{ background: accent.dot }} />
                              <div>
                                <h3 className="slr-pdf-finding-title" style={{ color: accent.title }}>{finding.title}</h3>
                                <p className="slr-pdf-finding-copy">{finding.description}</p>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  {report.comparable_sales.length > 0 ? (
                    <section className="slr-pdf-block">
                      <h2 className="slr-pdf-section-title">Pricing vs. Comparable Sales</h2>
                      <table className="slr-pdf-table">
                        <thead>
                          <tr>
                            <th>Property</th>
                            <th>Beds</th>
                            <th>Type</th>
                            <th>Sold / Asking</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.comparable_sales.map((sale, index) => (
                            <tr key={`pdf-sale-${sale.address}-${index}`} className={sale.is_subject ? 'is-subject' : ''}>
                              <td>{sale.address}</td>
                              <td>{sale.beds || '—'}</td>
                              <td>{sale.property_type || '—'}</td>
                              <td>{sale.sold_asking}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {(report.pricing_recommendation || report.pricing_recommendation_detail) ? (
                        <div className="slr-pdf-recommendation">
                          <strong>Recommendation</strong>
                          {report.pricing_recommendation ? <p>{report.pricing_recommendation}</p> : null}
                          {report.pricing_recommendation_detail ? <p>{report.pricing_recommendation_detail}</p> : null}
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  {report.action_plan.length > 0 ? (
                    <section className="slr-pdf-block">
                      <h2 className="slr-pdf-section-title">Prioritised Action Plan</h2>
                      <div className="slr-pdf-action-list">
                        {report.action_plan.map((item, index) => {
                          const accent = PRIORITY_ACCENTS[item.priority] || PRIORITY_ACCENTS.MEDIUM;
                          return (
                            <article key={`pdf-action-${item.title}-${index}`} className="slr-pdf-action-card">
                              <div className="slr-pdf-action-index">{index + 1}</div>
                              <div className="slr-pdf-action-body">
                                <div className="slr-pdf-action-head">
                                  <span className="slr-pdf-action-priority" style={{ color: accent.color }}>{item.priority}</span>
                                  <span className="slr-pdf-action-divider">—</span>
                                  <span className="slr-pdf-action-title">{item.title}</span>
                                </div>
                                <p className="slr-pdf-action-description">{item.description}</p>
                                {item.bullets.length > 0 ? (
                                  <ul className="slr-pdf-action-bullets">
                                    {item.bullets.map((bullet, bulletIndex) => (
                                      <li key={`pdf-action-bullet-${index}-${bulletIndex}`}>{bullet}</li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                <section className="slr-pdf-footer-cta">
                  <div>
                    <h3>Want deeper support?</h3>
                    <p>Upgrade to Professional or Premium Strategy for a full re-launch plan and direct agent access.</p>
                  </div>
                  <div className="slr-pdf-footer-link">stalelistings.com →</div>
                </section>
              </section>
            </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

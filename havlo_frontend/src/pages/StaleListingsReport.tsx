import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';

interface ReportData {
  overall_score: number;
  scores: { photos: number; pricing: number; description: number; positioning: number };
  key_findings: { title: string; description: string; type: string }[];
  action_plan: { priority: string; title: string; description: string }[];
  pricing_recommendation: string;
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

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 75 ? 'bg-green-500' : score >= 55 ? 'bg-yellow-400' : score >= 35 ? 'bg-orange-400' : 'bg-red-500';
  const textColor = score >= 75 ? 'text-green-700' : score >= 55 ? 'text-yellow-700' : score >= 35 ? 'text-orange-700' : 'text-red-700';
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm text-gray-700 font-medium">{label}</span>
        <span className={`text-sm font-bold ${textColor}`}>{score}/100</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-3">
        <div className={`${color} h-3 rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    URGENT: 'bg-red-100 text-red-700 border border-red-200',
    IMPORTANT: 'bg-orange-100 text-orange-700 border border-orange-200',
    RECOMMENDED: 'bg-blue-100 text-blue-700 border border-blue-200',
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${styles[priority] || styles.RECOMMENDED}`}>
      {priority}
    </span>
  );
}

const PACKAGE_LABELS: Record<string, string> = {
  quick_insight: 'Quick Insight',
  professional_review: 'Professional Review',
  premium_strategy: 'Premium Strategy',
};

export function StaleListingsReport() {
  const { reference } = useParams<{ reference: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reference) { setError('No report reference provided.'); setLoading(false); return; }
    api.staleListingsGetReport(reference)
      .then(data => { setAssessment(data as Assessment); setLoading(false); })
      .catch(() => { setError('Report not found or not yet available.'); setLoading(false); });
  }, [reference]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-black/10 border-t-black rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading your report…</p>
        </div>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-black mb-2">Report not found</h1>
          <p className="text-gray-500 text-sm mb-6">{error || 'This report may not be ready yet or the reference is incorrect.'}</p>
          <button onClick={() => navigate('/stale-listings')} className="bg-black text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-gray-900">
            Back to StaleListings
          </button>
        </div>
      </div>
    );
  }

  const isPending = assessment.report_status !== 'completed';
  const data = assessment.report_data;
  const packageName = PACKAGE_LABELS[assessment.package] || assessment.package;
  const daysOnMarket = (() => {
    const answers = {};
    const tom = (answers as Record<string, string>)['q3_time_on_market'] || '';
    const map: Record<string, number> = {
      'Less than 1 month': 20, '1–3 months': 60, '3–6 months': 120,
      '6–12 months': 270, 'Over 12 months': 400,
    };
    return map[tom] || null;
  })();

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/stale-listings')}>
            <span className="font-bold text-black text-lg tracking-tight">StaleListings</span>
            <span className="text-gray-400 text-sm">by HAVLO</span>
          </div>
          <div className="flex items-center gap-3">
            {daysOnMarket && (
              <span className="hidden sm:inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 text-xs font-semibold px-3 py-1.5 rounded-full border border-orange-100">
                On market {daysOnMarket}+ days
              </span>
            )}
            <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${isPending ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
              {isPending ? '⏳ Report being prepared' : '✓ Report ready'}
            </span>
            {!isPending && (
              <button
                onClick={() => window.print()}
                className="hidden sm:flex items-center gap-1.5 bg-black text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-gray-900 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PDF
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Property header */}
        <div className="mb-8">
          <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{packageName} Report · {assessment.reference}</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-black">Your listing report</h1>
          {assessment.property_address && (
            <p className="text-gray-500 mt-1 text-sm">{assessment.property_address}</p>
          )}
          {assessment.listing_url && !assessment.property_address && (
            <a href={assessment.listing_url} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-600 hover:underline mt-1 inline-block">
              View listing ↗
            </a>
          )}
        </div>

        {/* Pending state */}
        {isPending && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-8 text-center mb-8">
            <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-black mb-2">Your report is being prepared</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Our property experts are reviewing your listing details and preparing your personalised report.
              You'll receive an email notification when it's ready.
            </p>
            <div className="mt-4 text-xs text-gray-400">Reference: <span className="font-mono font-bold text-gray-600">{assessment.reference}</span></div>
          </div>
        )}

        {/* Report content */}
        {!isPending && data && (
          <>
            {/* Score section */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Overall score */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-1">Overall Score</div>
                    <div className="text-5xl font-bold text-black">
                      {data.overall_score}
                      <span className="text-gray-300 text-3xl">/100</span>
                    </div>
                  </div>
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${data.overall_score >= 70 ? 'bg-green-50' : data.overall_score >= 50 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                    {data.overall_score >= 70 ? '🟢' : data.overall_score >= 50 ? '🟡' : '🔴'}
                  </div>
                </div>
                <ScoreBar label="Photos & Presentation" score={data.scores.photos} />
                <ScoreBar label="Pricing Strategy" score={data.scores.pricing} />
                <ScoreBar label="Listing Description" score={data.scores.description} />
                <ScoreBar label="Marketing Positioning" score={data.scores.positioning} />
              </div>

              {/* Executive summary */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
                <div className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-4">Executive Summary</div>
                <p className="text-gray-700 text-sm leading-relaxed mb-6">{data.executive_summary}</p>
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
                  <div className="text-xs text-violet-600 font-semibold uppercase tracking-wide mb-2">Pricing Recommendation</div>
                  <p className="text-sm text-gray-700 leading-relaxed">{data.pricing_recommendation}</p>
                </div>
              </div>
            </div>

            {/* Key findings */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 mb-6">
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-5">Key Findings</div>
              <div className="grid md:grid-cols-2 gap-4">
                {data.key_findings.map((finding, i) => (
                  <div key={i} className={`rounded-xl p-5 border ${finding.type === 'strength' ? 'border-green-100 bg-green-50' : 'border-orange-100 bg-orange-50'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${finding.type === 'strength' ? 'bg-green-200' : 'bg-orange-200'}`}>
                        {finding.type === 'strength' ? '✓' : '!'}
                      </div>
                      <div>
                        <div className={`font-semibold text-sm mb-1 ${finding.type === 'strength' ? 'text-green-800' : 'text-orange-800'}`}>{finding.title}</div>
                        <p className="text-xs leading-relaxed text-gray-600">{finding.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action plan */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 mb-6">
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-5">Prioritised Action Plan</div>
              <div className="space-y-4">
                {data.action_plan.map((item, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className="flex-shrink-0 w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm text-black">{item.title}</span>
                        <PriorityBadge priority={item.priority} />
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="bg-black rounded-2xl p-8 text-center">
              <h2 className="text-xl font-bold text-white mb-3">Want professional support putting this into action?</h2>
              <p className="text-gray-400 text-sm mb-6 max-w-lg mx-auto">
                Our property team can work directly with you and your estate agent to implement these recommendations and market your property to international buyer networks.
              </p>
              <a
                href="/sell-your-property"
                className="inline-block bg-white text-black font-bold px-8 py-3 rounded-xl text-sm hover:bg-gray-100 transition-colors"
              >
                Explore Full Marketing Support →
              </a>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 mt-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-black">StaleListings</span>
            <span className="text-gray-400 text-sm">by HAVLO</span>
          </div>
          <div className="text-xs text-gray-400">© 2026 Havlo Ltd. All rights reserved.</div>
        </div>
      </footer>

      <style>{`@media print { header { display: none; } footer { display: none; } }`}</style>
    </div>
  );
}

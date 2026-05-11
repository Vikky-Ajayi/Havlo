import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface AdminItem {
  assessment_id: string;
  reference: string;
  email: string;
  first_name: string;
  last_name: string;
  package: string;
  property_address?: string;
  listing_url?: string;
  report_status: string;
  payment_status: string;
  created_at: string;
  ai_report_json?: string;
  agent_notes?: string;
}

const PACKAGE_LABELS: Record<string, string> = {
  quick_insight: 'Quick Insight',
  professional_review: 'Professional Review',
  premium_strategy: 'Premium Strategy',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_review: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

export function DashboardStaleListings() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_review' | 'completed'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [newStatus, setNewStatus] = useState('completed');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!token) return;
    api.staleListingsAdminList(token)
      .then(data => { setItems(data as AdminItem[]); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (!user?.is_admin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Access denied.</p>
      </div>
    );
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.report_status === filter);

  const handleFinalize = async (item: AdminItem) => {
    if (!token) return;
    setSaving(true);
    try {
      await api.staleListingsAdminFinalize(item.assessment_id, { agent_notes: notes, report_status: newStatus }, token);
      setItems(prev => prev.map(i => i.assessment_id === item.assessment_id ? { ...i, report_status: newStatus, agent_notes: notes } : i));
      setFinalizing(null);
      setSuccessMsg(`Report ${item.reference} updated to "${newStatus}".`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update report.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: AdminItem) => {
    if (!token) return;
    if (!window.confirm(`Delete assessment ${item.reference}? This cannot be undone.`)) return;
    try {
      await api.staleListingsAdminDelete(item.assessment_id, token);
      setItems(prev => prev.filter(i => i.assessment_id !== item.assessment_id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-black transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="font-bold text-black text-lg">Stale Listings</h1>
            <p className="text-xs text-gray-500">Assessment management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">{items.length} total</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {successMsg && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">{successMsg}</div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['all', 'pending', 'in_review', 'completed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              {f !== 'all' && (
                <span className="ml-2 text-xs opacity-70">{items.filter(i => i.report_status === f).length}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-4 border-black/10 border-t-black rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">📋</div>
            <p className="text-gray-500">No assessments found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => (
              <div key={item.assessment_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <span className="font-bold text-black font-mono text-sm">{item.reference}</span>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[item.report_status] || 'bg-gray-100 text-gray-600'}`}>
                        {item.report_status.replace('_', ' ')}
                      </span>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[item.payment_status] || 'bg-gray-100 text-gray-600'}`}>
                        💳 {item.payment_status}
                      </span>
                    </div>
                    <div className="text-sm text-black font-medium">{item.first_name} {item.last_name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.email}</div>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <span className="text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-md">{PACKAGE_LABELS[item.package] || item.package}</span>
                      {item.property_address && <span className="text-xs text-gray-500">{item.property_address}</span>}
                      {item.listing_url && (
                        <a href={item.listing_url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 hover:underline">View listing ↗</a>
                      )}
                    </div>
                    {item.agent_notes && (
                      <div className="mt-2 text-xs text-gray-500 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                        <span className="font-semibold text-blue-700">Agent notes: </span>{item.agent_notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => setExpanded(expanded === item.assessment_id ? null : item.assessment_id)}
                      className="text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-300 transition-colors"
                    >
                      {expanded === item.assessment_id ? 'Collapse' : 'View Report'}
                    </button>
                    <button
                      onClick={() => { setFinalizing(item.assessment_id); setNotes(item.agent_notes || ''); setNewStatus(item.report_status === 'completed' ? 'completed' : 'completed'); }}
                      className="text-xs font-semibold bg-black text-white px-3 py-1.5 rounded-lg hover:bg-gray-900 transition-colors"
                    >
                      Update
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="text-xs font-medium text-red-500 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Expanded AI report */}
                {expanded === item.assessment_id && (
                  <div className="border-t border-gray-100 p-5">
                    {item.ai_report_json ? (
                      (() => {
                        try {
                          const report = JSON.parse(item.ai_report_json);
                          return (
                            <div className="space-y-5">
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                <div className="bg-gray-50 rounded-xl p-4 text-center col-span-2 sm:col-span-1">
                                  <div className="text-3xl font-bold text-black">{report.overall_score}</div>
                                  <div className="text-xs text-gray-400 mt-1">Overall</div>
                                </div>
                                {Object.entries(report.scores || {}).map(([k, v]) => (
                                  <div key={k} className="bg-gray-50 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-bold text-black">{v as number}</div>
                                    <div className="text-xs text-gray-400 mt-1 capitalize">{k}</div>
                                  </div>
                                ))}
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Executive Summary</div>
                                <p className="text-sm text-gray-700 leading-relaxed">{report.executive_summary}</p>
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Key Findings ({report.key_findings?.length || 0})</div>
                                <div className="space-y-2">
                                  {(report.key_findings || []).map((f: { title: string; description: string; type: string }, i: number) => (
                                    <div key={i} className={`text-xs p-3 rounded-lg ${f.type === 'strength' ? 'bg-green-50 text-green-800' : 'bg-orange-50 text-orange-800'}`}>
                                      <strong>{f.title}:</strong> {f.description}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Action Plan</div>
                                <div className="space-y-2">
                                  {(report.action_plan || []).map((a: { priority: string; title: string; description: string }, i: number) => (
                                    <div key={i} className="text-xs p-3 bg-gray-50 rounded-lg">
                                      <span className="font-bold text-black">[{a.priority}]</span> <strong>{a.title}:</strong> {a.description}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        } catch {
                          return <pre className="text-xs text-gray-600 bg-gray-50 p-4 rounded-xl overflow-auto max-h-80">{item.ai_report_json}</pre>;
                        }
                      })()
                    ) : (
                      <p className="text-sm text-gray-500">AI report not yet generated for this assessment.</p>
                    )}
                  </div>
                )}

                {/* Finalize modal (inline) */}
                {finalizing === item.assessment_id && (
                  <div className="border-t border-gray-100 bg-blue-50 p-5">
                    <h3 className="font-bold text-black text-sm mb-4">Update Assessment — {item.reference}</h3>
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Report Status</label>
                      <select
                        value={newStatus}
                        onChange={e => setNewStatus(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_review">In Review</option>
                        <option value="completed">Completed (sends email)</option>
                      </select>
                    </div>
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Agent Notes</label>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Internal notes visible only to the team…"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                      />
                    </div>
                    {newStatus === 'completed' && (
                      <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-xs px-3 py-2 rounded-lg">
                        Setting to Completed will trigger an email notification to {item.email}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleFinalize(item)}
                        disabled={saving}
                        className={`px-5 py-2 rounded-lg font-semibold text-sm text-white transition-colors ${saving ? 'bg-gray-300' : 'bg-black hover:bg-gray-900'}`}
                      >
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button onClick={() => setFinalizing(null)} className="px-5 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-300">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

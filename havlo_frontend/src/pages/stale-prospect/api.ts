import { API_BASE } from '../../lib/api';
import type { AgentIntelResponse, AgentPortfolio, MonitorDashboardData, ProspectPreview, ProspectReport, SoldComparable } from './types';

async function parseJsonOrThrow(response: Response): Promise<any> {
  if (!response.ok) {
    let detail = 'request_failed';
    try {
      const body = await response.json();
      detail = body?.detail || detail;
    } catch {
      // ignore — non-JSON error body
    }
    const err = new Error(detail) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }
  return response.json();
}

export async function lookupProspect(propertyCode: string): Promise<ProspectPreview> {
  const response = await fetch(`${API_BASE}/stale-listings/prospects/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ property_code: propertyCode }),
  });
  return parseJsonOrThrow(response);
}

// ── Meta-ads landing pages (/assess/seller, /assess/agent) ──────────────

export type AdsAudience = 'owner' | 'agent';
// Which ads' landing page: Meta (/assess/...) or Google (/g/...).
export type AdsChannel = 'meta' | 'google';

/** Reads the pasted Rightmove listing and returns an access token for the
 * normal funnel. Can take up to a minute for a listing we haven't seen. */
export async function startAdsAssessment(payload: {
  listing_url: string;
  audience: AdsAudience;
  channel?: AdsChannel;
  reminder_token?: string;
}): Promise<{ token: string; audience: string; property_code: string; prefill: { first_name?: string; email?: string } }> {
  const response = await fetch(`${API_BASE}/stale-listings/ads/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response);
}

/** "Email me a reminder" for a visitor without their listing link. */
export async function requestUrlReminder(payload: { first_name: string; email: string; audience: AdsAudience; channel?: AdsChannel }): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE}/stale-listings/ads/reminder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response);
}

/** Who a reminder email's link belongs to. */
export async function getUrlReminder(token: string): Promise<{ first_name: string; email: string; audience: string; url_submitted: boolean }> {
  const response = await fetch(`${API_BASE}/stale-listings/ads/reminder?token=${encodeURIComponent(token)}`);
  return parseJsonOrThrow(response);
}

export interface AdsSummary {
  buyer_appeal: string | null;
  pricing: string | null;
  presentation: { count: number; status: string | null };
  competition: { status: 'pending' | 'ready' | 'unavailable'; count?: number | null; basis?: string | null; area?: string | null; fallback?: string | null };
  finding: string | null;
}

/** The ads homeowner's Confirm Property summary, all from their report. */
export async function getAdsSummary(access: { token?: string; code?: string }): Promise<AdsSummary> {
  const query = new URLSearchParams();
  if (access.token) query.set('token', access.token);
  if (access.code) query.set('code', access.code);
  const response = await fetch(`${API_BASE}/stale-listings/prospects/ads-summary?${query.toString()}`);
  return parseJsonOrThrow(response);
}

/** The Payment step was shown (anchors the checkout-recovery emails). */
export async function recordCheckoutVisit(access: { token?: string; property_code?: string }): Promise<void> {
  try {
    await fetch(`${API_BASE}/stale-listings/prospects/checkout-visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(access),
    });
  } catch {
    // Best effort: it only times the follow-up emails.
  }
}

export async function getProspectPreview(params: { token?: string; code?: string }): Promise<ProspectPreview> {
  const query = new URLSearchParams();
  if (params.token) query.set('token', params.token);
  if (params.code) query.set('code', params.code);
  const response = await fetch(`${API_BASE}/stale-listings/prospects/preview?${query.toString()}`);
  return parseJsonOrThrow(response);
}

/** Recent recorded sales near the property (HM Land Registry). The first call
 * for a property can take several seconds while they're looked up. */
export async function getProspectComparables(params: { token?: string; code?: string }): Promise<{ sales: SoldComparable[]; attribution?: string | null }> {
  const query = new URLSearchParams();
  if (params.token) query.set('token', params.token);
  if (params.code) query.set('code', params.code);
  const response = await fetch(`${API_BASE}/stale-listings/prospects/comparables?${query.toString()}`);
  return parseJsonOrThrow(response);
}

export async function confirmProspectProperty(access: { token?: string; property_code?: string }): Promise<{ confirmed: boolean }> {
  const response = await fetch(`${API_BASE}/stale-listings/prospects/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(access),
  });
  return parseJsonOrThrow(response);
}

export async function submitProspectDetails(payload: {
  token?: string;
  property_code?: string;
  full_name: string;
  email: string;
  confirm_email?: string;
  mobile_number: string;
}): Promise<{ contact_name: string }> {
  const response = await fetch(`${API_BASE}/stale-listings/prospects/details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response);
}

export interface CheckoutResult {
  prospect_id: string;
  property_code: string;
  checkout_url: string;
  checkout_id: string;
  amount: number;
  currency: string;
  unlocked: boolean;
  payment_method: string;
  bank_transfer_reference?: string | null;
  bank_transfer_account_name?: string | null;
  bank_transfer_account_number?: string | null;
  bank_transfer_bank_name?: string | null;
}

export async function createProspectCheckout(payload: {
  token?: string;
  property_code?: string;
  redirect_url?: string;
  promo_code?: string;
  payment_method: 'card' | 'bank_transfer';
}): Promise<CheckoutResult> {
  const response = await fetch(`${API_BASE}/stale-listings/prospects/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response);
}

export async function getProspectPaymentStatus(params: { token?: string; code?: string }): Promise<{ payment_status: string; property_code: string }> {
  const query = new URLSearchParams();
  if (params.token) query.set('token', params.token);
  if (params.code) query.set('code', params.code);
  const response = await fetch(`${API_BASE}/stale-listings/prospects/payment-status?${query.toString()}`);
  return parseJsonOrThrow(response);
}

export async function getProspectReport(params: { token?: string; code?: string }): Promise<ProspectReport> {
  const query = new URLSearchParams();
  if (params.token) query.set('token', params.token);
  if (params.code) query.set('code', params.code);
  const response = await fetch(`${API_BASE}/stale-listings/prospects/report?${query.toString()}`);
  return parseJsonOrThrow(response);
}

/** An agency's stale listings, from the code on its letter (/check/agent). */
export async function lookupAgent(agentCode: string): Promise<AgentPortfolio> {
  const response = await fetch(`${API_BASE}/stale-listings/agents/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_code: agentCode }),
  });
  return parseJsonOrThrow(response);
}

/** The same, from the letter's QR token or the token this browser kept. */
export async function getAgentPortfolio(token: string): Promise<AgentPortfolio> {
  const response = await fetch(`${API_BASE}/stale-listings/agents/portfolio?token=${encodeURIComponent(token)}`);
  return parseJsonOrThrow(response);
}

/** Open one of the agency's properties: returns a token for the normal /check funnel. */
export async function openAgentProperty(params: { token: string; prospect_id: string }): Promise<{ token: string }> {
  const response = await fetch(`${API_BASE}/stale-listings/agents/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return parseJsonOrThrow(response);
}

// ── 90-day monitoring dashboard ────────────────────────────────────────────

export async function getMonitorDashboard(token: string): Promise<MonitorDashboardData> {
  const response = await fetch(`${API_BASE}/stale-listings/monitor?token=${encodeURIComponent(token)}`);
  return parseJsonOrThrow(response);
}

export async function setMonitorChecklistItem(token: string, key: string, done: boolean): Promise<MonitorDashboardData> {
  const response = await fetch(`${API_BASE}/stale-listings/monitor/checklist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, key, done }),
  });
  return parseJsonOrThrow(response);
}

export async function shareMonitorDashboard(token: string): Promise<{ url: string }> {
  const response = await fetch(`${API_BASE}/stale-listings/monitor/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return parseJsonOrThrow(response);
}

export async function getMonitorReportLink(token: string): Promise<{ url: string }> {
  const response = await fetch(`${API_BASE}/stale-listings/monitor/report-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return parseJsonOrThrow(response);
}

/** From the report page: the property's dashboard link (a path, /m/<token>). */
export async function getProspectDashboardLink(access: { token?: string; code?: string }): Promise<{ url: string }> {
  const response = await fetch(`${API_BASE}/stale-listings/prospects/monitor-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: access.token, property_code: access.code }),
  });
  return parseJsonOrThrow(response);
}

/** A link token to the agency's listings for the agent to share. */
export async function getAgencyShareToken(token: string): Promise<{ token: string }> {
  const response = await fetch(`${API_BASE}/stale-listings/agents/share-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return parseJsonOrThrow(response);
}

/** From an agency's property page (its /check token): a link token back to all its listings. */
export async function getAgencyPortfolioToken(propertyToken: string): Promise<{ token: string }> {
  const response = await fetch(`${API_BASE}/stale-listings/agents/portfolio-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: propertyToken }),
  });
  return parseJsonOrThrow(response);
}

/** The agent report for an agency's copy of a listing ("preparing" while it's built). */
/** Downloads the full agent report PDF (built on the server), with the
 * agent's fee for the commission figures. */
export async function downloadAgentReportPdf(access: { token?: string; code?: string }, fee: number): Promise<void> {
  const query = new URLSearchParams();
  if (access.token) query.set('token', access.token);
  else if (access.code) query.set('code', access.code);
  query.set('fee', String(fee));
  const response = await fetch(`${API_BASE}/stale-listings/prospects/agent-report.pdf?${query.toString()}`);
  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.json()).detail || '';
    } catch {
      // Not JSON: fall back to the generic message.
    }
    throw new Error(typeof detail === 'string' && detail ? detail : 'We could not create the PDF just now. Please try again.');
  }
  const blob = await response.blob();
  const name = /filename="?([^";]+)"?/.exec(response.headers.get('content-disposition') || '')?.[1] || 'Havlo-agent-report.pdf';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function getAgentIntel(access: { token?: string; code?: string }): Promise<AgentIntelResponse> {
  const query = new URLSearchParams();
  if (access.token) query.set('token', access.token);
  else if (access.code) query.set('code', access.code);
  const response = await fetch(`${API_BASE}/stale-listings/prospects/agent-intel?${query.toString()}`);
  return parseJsonOrThrow(response);
}

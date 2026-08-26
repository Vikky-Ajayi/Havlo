import { API_BASE } from '../../lib/api';
import type { ProspectPreview, ProspectReport } from './types';

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

export async function getProspectPreview(params: { token?: string; code?: string }): Promise<ProspectPreview> {
  const query = new URLSearchParams();
  if (params.token) query.set('token', params.token);
  if (params.code) query.set('code', params.code);
  const response = await fetch(`${API_BASE}/stale-listings/prospects/preview?${query.toString()}`);
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
  confirm_email: string;
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

import type {
  CustomOfferPropertyOverrides,
  CustomOfferPropertySnapshot,
  CustomOfferStatusResponse,
  CustomOfferStepAnswers,
} from './customOffers';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export interface AgentListing {
  id: string;
  external_url: string | null;
  title: string | null;
  address: string | null;
  price: string | null;
  description: string | null;
  image_url: string | null;
  images: string[];
  bedrooms: string | null;
  bathrooms: string | null;
  property_type: string | null;
  listed_date: string | null;
  features: string[];
  floor_area: string | null;
  platform: string | null;
  ai_report: string | null;
  ai_report_generated_at: string | null;
}

/** Build a WebSocket URL for a messaging endpoint (handles http→ws / https→wss). */
export function buildWsUrl(path: string): string {
  const base = API_BASE.startsWith('http')
    ? API_BASE
    : `${window.location.origin}${API_BASE}`;
  const u = new URL(path.replace(/^\//, ''), base.endsWith('/') ? base : `${base}/`);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  queryParams?: Record<string, string>;
  timeout?: number;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, queryParams, timeout = 15000 } = opts;
  const headers: Record<string, string> = {};

  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let url = `${API_BASE}${path}`;
  if (queryParams) {
    const qs = new URLSearchParams(queryParams).toString();
    url += `?${qs}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw err;
  }
  clearTimeout(timeoutId);

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      data?.detail && typeof data.detail === 'string'
        ? data.detail
        : data?.detail?.[0]?.msg || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}

export interface RegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_country_code: string;
  phone_number: string;
  role: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  role: string;
  onboarding_complete: boolean;
  is_admin?: boolean;
  profile?: UserProfile;
}

export interface RegisterResponse {
  message: string;
  user_id: string;
  role: string;
  access_token: string;
  token_type: string;
  onboarding_complete: boolean;
  is_admin?: boolean;
  profile?: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_country_code: string;
  phone_number: string;
  role: string;
  onboarding_complete: boolean;
  is_admin?: boolean;
}

export interface AdminUser {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  role: string;
  phone: string;
  created_at: string;
  conversation_count: number;
  last_message_at: string | null;
  has_unread: boolean;
  unread_count: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  is_admin: boolean;
  phone: string;
  created_at: string;
}

export interface AdminStartConversationPayload {
  user_id: string;
  subject: string;
  initial_message?: string;
  sender_name?: string;
  team_member_initials?: string;
  team_member_color?: string;
}

export interface OnboardingPayload {
  services: string[];
  countries: string[];
  property_type: string;
  timeframe: string;
  budget_amount?: string;
  budget_currency?: string;
}

export interface OnboardingStatus {
  completed: boolean;
  services?: string[];
  countries?: string[];
  property_type?: string;
  timeframe?: string;
  budget_amount?: string;
  budget_currency?: string;
}

export interface PropertyMatchingPayload {
  property_type: string;
  location: string;
  budget_amount?: string;
  budget_currency?: string;
  bedrooms?: string;
  bathrooms?: string;
  additional_requirements?: string;
  contact_preference?: string;
}

export interface ElitePropertyPayload {
  property_address: string;
  property_type: string;
  asking_price?: string;
  asking_price_currency: string;
  description?: string;
  target_buyer_profile?: string;
  additional_info?: string;
}

export interface SaleAuditPayload {
  listing_url?: string;
  time_on_market?: string;
  number_of_viewings?: string;
  number_of_offers?: string;
  original_asking_price?: string;
  current_asking_price?: string;
  price_currency: string;
  estate_agent_name?: string;
  property_description?: string;
  main_challenges?: string;
}

export interface SellFasterPayload {
  plan_id: string;
  plan_name: string;
  property_address: string;
  property_type: string;
  asking_price?: string;
  target_countries: string[];
  contact_preference?: string;
  agent_name?: string;
  agent_email?: string;
  agent_phone?: string;
  additional_info?: string;
}

export interface BuyerNetworkPayload {
  package_id: string;
  package_name: string;
  company_name?: string;
  number_of_properties?: string;
  property_types: string[];
  target_markets: string[];
  contact_preference?: string;
  additional_info?: string;
  discount_code?: string;
}

export interface PropertyDemandCheckPayload {
  property_address: string;
  city: string;
  postcode: string;
  listing_url?: string;
}

export interface PropertyDemandCheckResult {
  ok: boolean;
  city: string;
  markets: string[];
}

export interface PublicAssessPayload {
  property_url?: string;
  property_address?: string;
  email: string;
  phone: string;
  phone_country_code?: string;
  property_title?: string;
  property_price?: string;
  property_bedrooms?: string;
  property_description?: string;
  property_listing_link?: string;
  property_image_url?: string;
}

export interface PublicAssessResult {
  session_id: string;
  report: string;
  property: {
    title: string;
    address: string;
    price: string;
    image: string;
    bedrooms: string;
    bathrooms: string;
    property_type: string;
  };
  pricing: {
    plan_id: string;
    plan_name: string;
    setup_fee: string;
    monthly_from: string;
    is_custom: boolean;
  };
}

export interface CustomOffersScrapeResponse {
  status: string;
  platform: string;
  message: string;
  property: CustomOfferPropertySnapshot;
  missing_fields: string[];
}

export interface CustomOffersSubmitResponse {
  submission_id: string;
  reference: string;
  checkout_url: string;
  checkout_id: string;
  amount: number;
  currency: string;
  message: string;
}

export interface CustomOffersAdminItem {
  submission_id: string;
  reference: string;
  created_at: string;
  updated_at: string;
  listing_url: string;
  listing_platform: string;
  plan_id: string;
  plan_name: string;
  payment_status: string;
  proposal_status: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  property: CustomOfferPropertySnapshot;
  property_overrides: CustomOfferPropertyOverrides;
  answers: CustomOfferStepAnswers;
  admin_notes?: string;
}

export interface Conversation {
  id: string;
  team_member_name: string;
  team_member_initials: string;
  team_member_color: string;
  subject: string;
  last_message_at: string;
  last_message_snippet: string | null;
  unread_count: number;
}

export interface Message {
  id: string;
  content: string;
  sender_type: string;
  sender_name: string;
  created_at: string;
  is_me: boolean;
  is_edited?: boolean;
  edited_at?: string | null;
  is_deleted?: boolean;
  attachment_url?: string | null;
  attachment_filename?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  read_at?: string | null;
}

export interface AdminConversation extends Conversation {
  user: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    role: string;
  };
}

export interface ConversationDetail {
  id: string;
  team_member_name: string;
  team_member_initials: string;
  team_member_color: string;
  subject: string;
  messages: Message[];
}

export interface ProfileUpdatePayload {
  first_name?: string;
  last_name?: string;
  phone_country_code?: string;
  phone_number?: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface BookSessionPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone_country_code: string;
  phone_number: string;
  preferred_date: string;
  preferred_time: string;
}

export interface ProductAccessRequestResponse {
  ok: boolean;
  message: string;
}

export interface ProductAccessConsumeResponse {
  scope: 'stale-listings' | 'custom-offers';
  email: string;
  session_token: string;
  redirect_path: string;
  outcome: 'single-record' | 'portal';
  records_count: number;
  reference?: string | null;
}

export interface StaleListingReviewConsumeResponse {
  email: string;
  session_token: string;
  redirect_path: string;
  assessment_id: string;
  reference: string;
}

export interface StaleListingPortalItem {
  assessment_id: string;
  reference: string;
  property_address: string;
  package: string;
  payment_status: string;
  report_status: string;
  created_at: string;
}

export interface StaleListingPortalResponse {
  email: string;
  items: StaleListingPortalItem[];
}

export interface CustomOfferPortalItem {
  submission_id: string;
  reference: string;
  property_address: string;
  plan_name: string;
  payment_status: string;
  proposal_status: string;
  created_at: string;
}

export interface CustomOfferPortalResponse {
  email: string;
  items: CustomOfferPortalItem[];
}

export interface CustomOfferPaymentVerifyResponse {
  payment_status: string;
  proposal_status: string;
  reference: string;
  portal_session_token?: string | null;
  portal_session_email?: string | null;
  portal_redirect_path?: string | null;
}

export const api = {
  register: (payload: RegisterPayload) =>
    request<RegisterResponse>('/auth/register', { method: 'POST', body: payload }),

  login: (payload: LoginPayload) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: payload }),

  getMe: (token: string) =>
    request<UserProfile>('/auth/me', { token }),

  logout: (token: string) =>
    request<{ message: string }>('/auth/logout', { method: 'POST', token }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } }),

  verifyResetOtp: (email: string, otp: string) =>
    request<{ message: string; reset_token: string }>('/auth/verify-reset-otp', {
      method: 'POST',
      body: { email, otp },
    }),

  resetPassword: (resetToken: string, newPassword: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: { reset_token: resetToken, new_password: newPassword },
    }),

  updateProfile: (token: string, payload: ProfileUpdatePayload) =>
    request<UserProfile>('/users/profile', { method: 'PATCH', token, body: payload }),

  changePassword: (token: string, payload: ChangePasswordPayload) =>
    request<{ message: string }>('/users/change-password', { method: 'POST', token, body: payload }),

  submitOnboarding: (token: string, payload: OnboardingPayload) =>
    request<{ message: string; onboarding_id: string }>('/onboarding', { method: 'POST', token, body: payload }),

  getOnboardingStatus: (token: string) =>
    request<OnboardingStatus>('/onboarding', { token }),

  submitPropertyMatching: (token: string, payload: PropertyMatchingPayload) =>
    request<{ request_id: string; message: string }>('/property-matching', { method: 'POST', token, body: payload }),

  submitEliteProperty: (token: string, payload: ElitePropertyPayload) =>
    request<{ application_id: string; message: string }>('/elite-property/apply', { method: 'POST', token, body: payload }),

  submitSaleAudit: (token: string, payload: SaleAuditPayload) =>
    request<{
      request_id: string;
      checkout_url: string;
      checkout_id: string;
      amount: number;
      currency: string;
      message: string;
    }>('/sale-audit', { method: 'POST', token, body: payload }),

  submitSellFaster: (token: string, payload: SellFasterPayload) =>
    request<{ application_id: string; checkout_url: string; checkout_id: string; total_amount: number; currency: string; message: string }>('/sell-faster', { method: 'POST', token, body: payload }),

  submitBuyerNetwork: (token: string, payload: BuyerNetworkPayload) =>
    request<{ application_id: string; checkout_url: string; checkout_id: string; total_amount: number; currency: string; message: string }>('/buyer-network', { method: 'POST', token, body: payload }),

  submitPropertyDemandCheck: (token: string, payload: PropertyDemandCheckPayload) =>
    request<PropertyDemandCheckResult>('/sell-faster/property-demand-check', {
      method: 'POST', token, body: payload,
    }),

  // ── Public pricing (no auth) ─────────────────────────────────────────────
  publicPropertyAssess: (payload: PublicAssessPayload) =>
    request<PublicAssessResult>('/sell-faster/public-assess', { method: 'POST', body: payload }),

  getSellFasterPlans: () =>
    request<Record<string, { name: string; setup: number; monthly: number; currency: string }>>('/sell-faster/plans'),
  getBuyerNetworkPackages: () =>
    request<Record<string, { name: string; setup: number; monthly: number; currency: string }>>('/buyer-network/packages'),

  // ── Payment status polling ───────────────────────────────────────────────
  getSessionPaymentStatus: (token: string, bookingId: string) =>
    request<{ checkout_id: string; status: string; paid: boolean; redirect_url?: string | null }>(
      `/bookings/session/${bookingId}/status`, { token }
    ),
  getSellFasterPaymentStatus: (token: string, applicationId: string) =>
    request<{ checkout_id: string; status: string; paid: boolean; redirect_url?: string | null }>(
      `/sell-faster/${applicationId}/status`, { token }
    ),
  getBuyerNetworkPaymentStatus: (token: string, applicationId: string) =>
    request<{ checkout_id: string; status: string; paid: boolean; redirect_url?: string | null }>(
      `/buyer-network/${applicationId}/status`, { token }
    ),
  getSaleAuditPaymentStatus: (token: string, requestId: string) =>
    request<{ checkout_id: string; status: string; paid: boolean; redirect_url?: string | null }>(
      `/sale-audit/${requestId}/status`, { token }
    ),

  getConversations: (token: string) =>
    request<Conversation[]>('/messaging/conversations', { token }),

  getConversation: (token: string, id: string) =>
    request<ConversationDetail>(`/messaging/conversations/${id}`, { token }),

  sendMessage: (token: string, conversationId: string, content: string) =>
    request<{ message: Message }>(`/messaging/conversations/${conversationId}/messages`, {
      method: 'POST',
      token,
      body: { content },
    }),

  renameConversation: (token: string, conversationId: string, subject: string) =>
    request<Conversation>(`/messaging/conversations/${conversationId}`, {
      method: 'PATCH',
      token,
      body: { subject },
    }),

  deleteConversation: (token: string, conversationId: string) =>
    request<null>(`/messaging/conversations/${conversationId}`, {
      method: 'DELETE',
      token,
    }),

  markConversationRead: (token: string, conversationId: string) =>
    request<null>(`/messaging/conversations/${conversationId}/read`, {
      method: 'POST',
      token,
    }),

  editMessage: (token: string, messageId: string, content: string) =>
    request<Message>(`/messaging/messages/${messageId}`, {
      method: 'PATCH',
      token,
      body: { content },
    }),

  deleteMessage: (token: string, messageId: string) =>
    request<{ ok: boolean; id: string; conversation_id: string }>(
      `/messaging/messages/${messageId}`,
      { method: 'DELETE', token },
    ),

  uploadAttachment: async (
    token: string,
    conversationId: string,
    file: File,
    content: string = '',
  ): Promise<{ message: Message }> => {
    const base = (import.meta as any).env?.VITE_API_URL || '/api/v1';
    const fd = new FormData();
    fd.append('file', file);
    if (content) fd.append('content', content);
    const res = await fetch(`${base}/messaging/conversations/${conversationId}/attachment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!res.ok) {
      let detail = 'Upload failed.';
      try {
        const j = await res.json();
        if (j?.detail) detail = String(j.detail);
      } catch {}
      throw new Error(detail);
    }
    return res.json();
  },

  bookSession: (token: string, payload: BookSessionPayload) =>
    request<{ booking_id: string; checkout_url: string; checkout_id: string; amount: number; currency: string; message: string }>('/bookings/session', { method: 'POST', token, body: payload }),

  // ── Admin messaging ──────────────────────────────────────────────────────
  adminListUsers: (
    token: string,
    opts: { q?: string; only_with_threads?: boolean } = {},
  ) => {
    const queryParams: Record<string, string> = {};
    if (opts.q && opts.q.trim()) queryParams.q = opts.q.trim();
    if (opts.only_with_threads) queryParams.only_with_threads = 'true';
    return request<AdminUser[]>('/messaging/admin/users', { token, queryParams });
  },

  adminListUserConversations: (token: string, userId: string) =>
    request<Conversation[]>(`/messaging/admin/users/${userId}/conversations`, { token }),

  adminListAllConversations: (token: string, limit = 200) =>
    request<AdminConversation[]>('/messaging/admin/conversations', {
      token,
      queryParams: { limit: String(limit) },
    }),

  adminGetConversation: (token: string, conversationId: string) =>
    request<ConversationDetail>(`/messaging/admin/conversations/${conversationId}`, { token }),

  adminStartConversation: (token: string, payload: AdminStartConversationPayload) =>
    request<{ id: string; subject: string; user_id: string; initial_message_id: string | null }>(
      '/messaging/admin/conversations',
      { method: 'POST', token, body: payload },
    ),

  adminSendMessage: (
    token: string,
    conversationId: string,
    content: string,
    senderName?: string,
  ) =>
    request<{ message: Message }>(
      '/messaging/admin/send',
      {
        method: 'POST',
        token,
        body: {
          conversation_id: conversationId,
          content,
          sender_name: senderName || 'Havlo Advisory',
        },
      },
    ),

  // ── Admin user management ────────────────────────────────────────────────
  adminListAllUsers: (token: string) =>
    request<AdminUserRow[]>('/admin/users', { token }),

  adminDeleteUser: (token: string, userId: string) =>
    request<{ deleted: boolean; email: string; id: string }>(
      `/admin/users/${userId}`,
      { method: 'DELETE', token },
    ),

  // ── Agent Dashboard ───────────────────────────────────────────────────────
  agentGetProfileLink: (token: string) =>
    request<{ profile_url: string; platform: string | null; last_synced_at: string | null } | null>(
      '/agent/profile-link',
      { token },
    ),

  agentSaveProfileLink: (token: string, profileUrl: string) =>
    request<{ profile_url: string; platform: string | null; last_synced_at: string | null }>(
      '/agent/profile-link',
      { method: 'PUT', token, body: { profile_url: profileUrl } },
    ),

  agentSyncListings: (token: string) =>
    request<{
      count: number;
      listings: AgentListing[];
    }>('/agent/listings/sync', { method: 'POST', token }),

  agentGetListings: (token: string) =>
    request<AgentListing[]>('/agent/listings', { token }),

  agentDeleteListing: (token: string, listingId: string) =>
    request<void>(`/agent/listings/${listingId}`, { method: 'DELETE', token }),

  agentUpdateListing: (
    token: string,
    listingId: string,
    payload: {
      title?: string;
      price?: string;
      bedrooms?: string;
      bathrooms?: string;
      address?: string;
      description?: string;
      external_url?: string;
      image_url?: string;
    },
  ) =>
    request<AgentListing>(`/agent/listings/${listingId}`, { method: 'PATCH', token, body: payload }),

  agentGenerateAIReport: (
    token: string,
    payload: {
      listing_id?: string;
      listing_url?: string;
      listing_title?: string;
      listing_price?: string;
      listing_description?: string;
      listing_address?: string;
    },
  ) => request<{ report: string }>('/agent/ai-report', { method: 'POST', token, body: payload }),

  agentCreateAdvancedCheckout: (
    token: string,
    payload: {
      listing_id?: string;
      listing_url?: string;
      listing_title?: string;
      property_price_raw: string;
    },
  ) =>
    request<{
      payment_record_id: string;
      checkout_id: string;
      checkout_url: string;
      service_fee_amount: number;
      currency: string;
      message: string;
    }>('/agent/advanced-service/checkout', { method: 'POST', token, body: payload }),

  agentGetAdvancedServiceStatus: (token: string, recordId: string) =>
    request<{
      payment_record_id: string;
      checkout_id: string;
      status: string;
      paid: boolean;
    }>(`/agent/advanced-service/${recordId}/status`, { token }),

  agentAddManualListing: (
    token: string,
    payload: {
      title: string;
      price?: string;
      bedrooms?: string;
      bathrooms?: string;
      address?: string;
      property_type?: string;
      listed_date?: string;
      floor_area?: string;
      description?: string;
      external_url?: string;
      image_url?: string;
      images?: string[];
      features?: string[];
    },
  ) => request<AgentListing>('/agent/listings/manual', { method: 'POST', token, body: payload }),

  agentScrapeListingUrl: (token: string, url: string) =>
    request<{
      title: string;
      address: string;
      price: string;
      description: string;
      images: string[];
      image_url: string;
      bedrooms: string;
      bathrooms: string;
      property_type: string;
      listed_date: string;
      features: string[];
      floor_area: string;
      platform: string;
      external_url: string;
      blocked: boolean;
    }>('/agent/listings/scrape-url', { method: 'POST', token, body: { url }, timeout: 45000 }),

  agentGetActivatedListings: (token: string) =>
    request<{
      payment_record_id: string;
      listing_id: string | null;
      listing_url: string | null;
      listing_title: string | null;
      service_fee_amount: number;
      activated_at: string;
    }[]>('/agent/activated-listings', { token }),

  // ── Public website forms (no auth) ───────────────────────────────────────
  submitContactForm: (payload: {
    first_name: string;
    last_name: string;
    email: string;
    phone_country_code: string;
    phone_number: string;
    country_of_residence: string;
    message: string;
  }) => request<{ ok: boolean }>('/public/contact', { method: 'POST', body: payload }),

  joinNewsletter: (email: string, source: string = 'footer') =>
    request<{ ok: boolean }>('/public/newsletter', {
      method: 'POST',
      body: { email, source },
    }),

  marketingOptOut: (email: string, notes: string = '') =>
    request<{ ok: boolean }>('/public/marketing-opt-out', {
      method: 'POST',
      body: { email, notes },
    }),

  // ── Stale Listings (public, no auth) ─────────────────────────────────────────
  staleListingsSubmit: (payload: {
    first_name: string;
    last_name: string;
    email: string;
    phone_country_code: string;
    phone: string;
    package: 'quick_insight' | 'professional_review' | 'premium_strategy';
    property_address?: string;
    listing_url?: string;
    questions_data: Record<string, string | string[]>;
    redirect_url?: string;
  }) =>
    request<{
      assessment_id: string;
      reference: string;
      checkout_url: string;
      checkout_id: string;
      amount: number;
      message: string;
    }>('/stale-listings/submit', { method: 'POST', body: payload }),

  staleListingsGetReport: (reference: string, token?: string) =>
    request<{
      assessment_id: string;
      reference: string;
      email: string;
      package: string;
      property_address?: string;
      listing_url?: string;
      listing_image_url?: string;
      listing_snapshot?: {
        title: string;
        address: string;
        price: string;
        image: string;
        bedrooms: string;
        bathrooms: string;
        property_type: string;
        platform: string;
      } | null;
      report_status: string;
      payment_status: string;
      report_data?: {
        overall_score: number;
        days_on_market?: number | null;
        scores: { photos: number; pricing: number; description: number; positioning: number };
        key_findings: { title: string; description: string; type: string; icon?: string }[];
        action_plan: { priority: string; title: string; description: string; bullets: string[] }[];
        comparable_sales: { address: string; beds: number; property_type: string; sold_asking: string; is_subject: boolean }[];
        pricing_recommendation: string;
        pricing_recommendation_detail: string;
        executive_summary: string;
      };
      preview_mode?: boolean;
      created_at: string;
    }>(`/stale-listings/report/${encodeURIComponent(reference)}`, { timeout: 30000, token }),

  staleListingsVerifyPayment: (reference: string) =>
    request<{ payment_status: string; reference: string }>(
      `/stale-listings/payment-verify/${encodeURIComponent(reference)}`,
      { method: 'POST' }
    ),

  staleListingsAccessRequest: (email: string) =>
    request<ProductAccessRequestResponse>('/stale-listings/access/request', {
      method: 'POST',
      body: { email },
    }),

  staleListingsAccessConsume: (token: string) =>
    request<ProductAccessConsumeResponse>('/stale-listings/access/consume', {
      method: 'POST',
      body: { token },
    }),

  staleListingsReviewAccessConsume: (token: string) =>
    request<StaleListingReviewConsumeResponse>('/stale-listings/review-access/consume', {
      method: 'POST',
      body: { token },
    }),

  staleListingsAccessRecords: (token: string) =>
    request<StaleListingPortalResponse>('/stale-listings/access/records', {
      token,
    }),

  staleListingsReviewAssessment: (token: string) =>
    request<{
      assessment_id: string;
      reference: string;
      email: string;
      first_name: string;
      last_name: string;
      package: string;
      property_address?: string;
      listing_url?: string;
      listing_image_url?: string;
      questions_data?: string;
      report_status: string;
      payment_status: string;
      created_at: string;
      ai_report_json?: string;
      agent_edited_report_json?: string;
      agent_notes?: string;
    }>('/stale-listings/review-access/assessment', { token }),

  staleListingsReviewFinalize: (
    payload: { agent_notes?: string; agent_edited_report_json?: string; report_status: string },
    token: string,
  ) =>
    request<{ ok: boolean; report_status: string }>(
      '/stale-listings/review-access/assessment/finalize',
      { method: 'PUT', body: payload, token }
    ),

  staleListingsAdminList: (token: string) =>
    request<{
      assessment_id: string;
      reference: string;
      email: string;
      first_name: string;
      last_name: string;
      package: string;
      property_address?: string;
      listing_url?: string;
      listing_image_url?: string;
      questions_data?: string;
      report_status: string;
      payment_status: string;
      created_at: string;
      ai_report_json?: string;
      agent_edited_report_json?: string;
      agent_notes?: string;
    }[]>('/stale-listings/admin', { token }),

  staleListingsAdminFinalize: (
    assessmentId: string,
    payload: { agent_notes?: string; agent_edited_report_json?: string; report_status: string },
    token: string
  ) =>
    request<{ ok: boolean; report_status: string }>(
      `/stale-listings/admin/${assessmentId}/finalize`,
      { method: 'PUT', body: payload, token }
    ),

  staleListingsAdminDelete: (assessmentId: string, token: string) =>
    request<{ ok: boolean }>(`/stale-listings/admin/${assessmentId}`, { method: 'DELETE', token }),

  staleListingsAdminMarkPaid: (assessmentId: string, token: string) =>
    request<{ ok: boolean; payment_status: string; reference: string }>(
      `/stale-listings/admin/${assessmentId}/mark-paid`,
      { method: 'POST', token }
    ),

  customOffersScrape: (payload: { listing_url: string }) =>
    request<CustomOffersScrapeResponse>('/custom-offers/scrape', {
      method: 'POST',
      body: payload,
      timeout: 45000,
    }),

  customOffersSubmit: (payload: {
    listing_url?: string;
    property_address?: string;
    property_snapshot: CustomOfferPropertySnapshot;
    property_overrides: CustomOfferPropertyOverrides;
    proposal_data: CustomOfferStepAnswers;
    plan_id: 'connect' | 'standout' | 'advantage';
    redirect_url?: string;
  }) =>
    request<CustomOffersSubmitResponse>('/custom-offers/submit', {
      method: 'POST',
      body: payload,
      timeout: 45000,
    }),

  customOffersVerifyPayment: (reference: string) =>
    request<CustomOfferPaymentVerifyResponse>(
      `/custom-offers/payment-verify/${encodeURIComponent(reference)}`,
      { method: 'POST', timeout: 30000 }
    ),

  customOffersStatus: (reference: string) =>
    request<CustomOfferStatusResponse>(`/custom-offers/status/${encodeURIComponent(reference)}`),

  customOffersAccessRequest: (email: string) =>
    request<ProductAccessRequestResponse>('/custom-offers/access/request', {
      method: 'POST',
      body: { email },
    }),

  customOffersAccessConsume: (token: string) =>
    request<ProductAccessConsumeResponse>('/custom-offers/access/consume', {
      method: 'POST',
      body: { token },
    }),

  customOffersAccessRecords: (token: string) =>
    request<CustomOfferPortalResponse>('/custom-offers/access/records', {
      token,
    }),

  customOffersAdminList: (token: string) =>
    request<CustomOffersAdminItem[]>('/custom-offers/admin', { token }),

  customOffersAdminUpdate: (
    submissionId: string,
    payload: { proposal_status?: string; admin_notes?: string },
    token: string,
  ) =>
    request<CustomOffersAdminItem>(`/custom-offers/admin/${submissionId}`, {
      method: 'PATCH',
      body: payload,
      token,
    }),
};

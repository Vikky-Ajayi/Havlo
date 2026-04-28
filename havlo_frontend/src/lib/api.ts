const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

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
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, queryParams } = opts;
  const headers: Record<string, string> = {};

  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let url = `${API_BASE}${path}`;
  if (queryParams) {
    const qs = new URLSearchParams(queryParams).toString();
    url += `?${qs}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

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

  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>('/auth/reset-password', { method: 'POST', body: { access_token: token, new_password: newPassword } }),

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
};

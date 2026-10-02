// Shared types for the QR-code letter-prospect wizard
// (Landing -> Finding Property -> Confirm Property (with the details form)
// -> Assessment -> Payment -> Full Report). Mirrors the backend schemas in
// app/schemas/schemas.py and the report shape produced by
// app/services/groq_service.py.

export interface ListingSnapshot {
  title?: string;
  address?: string;
  price?: string;
  image?: string;
  images?: string[];
  bedrooms?: string | number;
  bathrooms?: string | number;
  property_type?: string;
  platform?: string;
  description?: string;
  features?: string[];
}

export interface PreviewFinding {
  title?: string;
  description?: string;
  type?: string;
  icon?: string;
}

export interface PreviewData {
  overall_score?: number;
  scores?: Record<string, number>;
  key_issues?: PreviewFinding[];
  recommendations?: PreviewFinding[];
  executive_summary?: string;
  locked_message?: string;
}

export interface ProspectPreview {
  prospect_id: string;
  /** 'agent' for an agency's own copy opened from /check/agent. */
  audience?: 'owner' | 'agent';
  property_code: string;
  property_address: string;
  rightmove_url: string;
  asking_price?: number | null;
  listing_duration_days?: number | null;
  /** Set when Rightmove only gave a "Reduced on" date (YYYY-MM-DD, or "" if
   * unreadable): listing_duration_days then counts from the reduction. */
  reduced_date?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  listing_snapshot: ListingSnapshot;
  preview: PreviewData;
  payment_status: string;
  is_unlocked: boolean;
  property_confirmed: boolean;
  has_contact_details: boolean;
  checkout_started?: boolean;
}

export interface ReportFinding {
  title?: string;
  description?: string;
  type?: string;
  icon?: string;
  evidence?: string;
  impact?: string;
  recommend?: string;
}

export interface ReportAction {
  priority?: string;
  title?: string;
  description?: string;
  why_it_matters?: string;
  bullets?: string[];
}

export interface ComparableSale {
  address?: string;
  beds?: number | string;
  property_type?: string;
  sold_asking?: string;
  is_subject?: boolean;
  /** Land Registry rows only (report_comparable_rows on the backend). */
  sold_price?: number;
  sold_date?: string;
}

/** A recorded sale near the property, from HM Land Registry. */
export interface SoldComparable {
  address: string;
  property_type: string;
  price: number;
  date: string; // YYYY-MM-DD
}

export interface ActiveCompetitor {
  address?: string;
  price?: string;
  beds?: number;
  distance?: string;
  days_listed?: number;
  differentiator?: string;
}

export interface ThirtyDayPlanWeek {
  week: number;
  title: string;
}

export interface FullReportData {
  overall_score?: number;
  days_on_market?: number | null;
  scores?: {
    pricing?: number;
    listing_presentation?: number;
    market_positioning?: number;
    competition?: number;
    buyer_appeal?: number;
  };
  key_findings?: ReportFinding[];
  action_plan?: ReportAction[];
  comparable_sales?: ComparableSale[];
  active_competition?: ActiveCompetitor[];
  thirty_day_plan?: ThirtyDayPlanWeek[];
  pricing_recommendation?: string;
  pricing_recommendation_detail?: string;
  executive_summary?: string;
}

export interface ProspectReport {
  prospect_id: string;
  property_code: string;
  property_address: string;
  rightmove_url: string;
  asking_price?: number | null;
  listing_duration_days?: number | null;
  reduced_date?: string | null;
  contact_name?: string | null;
  listing_snapshot: ListingSnapshot;
  report_data: FullReportData;
  /** Present whenever report_data.comparable_sales holds Land Registry sales. */
  sold_comparables_attribution?: string | null;
  payment_status: string;
}

export type WizardStep =
  | 'landing'
  | 'finding'
  | 'confirm'
  | 'not_found'
  | 'assessment'
  | 'payment'
  | 'success'
  | 'report';

export const STEPPER_ITEMS: { key: WizardStep | 'finding'; label: string }[] = [
  { key: 'landing', label: 'Enter Property ID' },
  { key: 'finding', label: 'Finding Property' },
  { key: 'confirm', label: 'Confirm Property' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'payment', label: 'Payment' },
  { key: 'report', label: 'Full Report' },
];

// Maps every possible step (including terminal/error states) onto the
// index of the stepper item that should be highlighted as active.
export function stepperIndexFor(step: WizardStep): number {
  switch (step) {
    case 'landing':
      return 0;
    case 'finding':
      return 1;
    case 'confirm':
    case 'not_found':
      return 2;
    case 'assessment':
      return 3;
    case 'payment':
      return 4;
    case 'success':
    case 'report':
      return 5;
    default:
      return 0;
  }
}

// Mirrors prospect_unlock_price in app/services/stale_prospect_service.py
// (what the checkout route charges): £149.99 for an estate agency's copy —
// the same per-assessment price as on /stale-listings/agents — otherwise a
// flat £299.99 whatever the asking price. Keeps the askingPrice parameter
// so callers don't change if per-price tiering is ever reintroduced.
export function unlockPrice(askingPrice?: number | null, audience?: 'owner' | 'agent'): number {
  return audience === 'agent' ? 149.99 : 299.99;
}

/** "12 Aug 2026" for a reduced_date; "Recently" when the date couldn't be read. */
export function formatReducedDate(iso: string): string {
  const date = iso ? new Date(`${iso}T00:00:00`) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatGbp(value?: number | null, opts?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0, ...opts }).format(value);
}

export interface AgentPortfolioProperty {
  prospect_id: string;
  property_address: string;
  asking_price?: number | null;
  days_on_market: number;
  /** Set when the listing qualified through a price reduction: days_on_market
   * then counts from the reduction, so show "Date reduced" instead. */
  reduced_date?: string | null;
  bedrooms?: number | null;
  property_type?: string | null;
  image_url?: string | null;
  branch_name?: string | null;
  /** This agency's own progress with the property. */
  status: 'new' | 'opened' | 'in_progress' | 'unlocked';
}

export interface AgentPortfolio {
  agent_code: string;
  company_name: string;
  brand?: string | null;
  logo_url?: string | null;
  token: string;
  properties: AgentPortfolioProperty[];
}

// ── 90-day monitoring dashboard (/m/:token, MonitorDashboard.tsx) ──────────

export type MonitorListingStatus = 'on_market' | 'under_offer' | 'sold_stc' | 'removed';

export interface MonitorEvent {
  id: string;
  scope: 'listing' | 'nearby' | 'customer';
  kind: string;
  at: string;
  data: Record<string, any>;
}

export interface MonitorChecklistItem {
  key: string;
  title: string;
  detail: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | null;
  source: 'report' | 'havlo';
  auto: boolean;
  done: boolean;
  done_by: 'detected' | 'you' | null;
  done_at: string | null;
}

export interface MonitorPlanPhase {
  title: string;
  start_day: number;
  end_day: number;
  current: boolean;
  weeks: { week: number; title: string }[];
  tasks: { key: string; title: string; done: boolean }[];
  notes?: string[];
}

export interface MonitorNearbyListing {
  id: string;
  address: string;
  price: number | null;
  bedrooms: number | null;
  type: string;
  status: MonitorListingStatus;
  update: string;
  update_date: string;
  first_listed: string;
  distance: number | null;
  url: string;
  image: string;
  similar: boolean;
}

export interface MonitorPulse {
  for_sale: number;
  under_offer_or_sold: number;
  reduced: number;
  median_price: number | null;
}

export interface MonitorSale {
  id: string;
  address: string;
  price: number;
  date: string;
  type: string;
}

export interface MonitorDashboardData {
  read_only: boolean;
  audience: 'owner' | 'agent';
  property: {
    address: string;
    postcode?: string | null;
    image?: string | null;
    rightmove_url?: string | null;
    bedrooms?: number | null;
    property_type?: string | null;
    agent?: string | null;
    agent_branch?: string | null;
  };
  contact_first_name: string | null;
  day: number;
  total_days: number;
  started_at: string;
  ends_at: string;
  ended: boolean;
  last_checked_at: string | null;
  headline: {
    status: MonitorListingStatus;
    status_label: string;
    price_start: number | null;
    price_now: number | null;
    price_change: number;
    price_text: string | null;
    price_qualifier: string;
    days_on_market: number | null;
    listing_changes: number;
    actions_done: number;
    actions_total: number;
    photos?: number | null;
    floorplans?: number | null;
    virtual_tours?: number | null;
  };
  baseline: {
    price: number | null;
    image_count: number | null;
    floorplans: number | null;
    virtual_tours: number | null;
    description_words: number | null;
    featured: boolean | null;
  } | null;
  next_step: { title: string; detail: string };
  alerts: MonitorEvent[];
  timeline: MonitorEvent[];
  checklist: MonitorChecklistItem[];
  plan: { current_week: number; weeks: { week: number; title: string }[]; phases: MonitorPlanPhase[] };
  nearby: {
    checked_at: string | null;
    radius: number | null;
    pulse_now: MonitorPulse | null;
    pulse_start: MonitorPulse | null;
    events: MonitorEvent[];
    listings: MonitorNearbyListing[];
    sold: MonitorSale[];
  };
  summary?: {
    price_start: number | null;
    price_end: number | null;
    status: MonitorListingStatus;
    listing_changes: number;
    actions_done: number;
    actions_total: number;
    nearby_new: number;
    nearby_reduced: number;
    nearby_agreed: number;
    nearby_sold: number;
  };
}

// ── Agent report (app/services/agent_report.py, AgentReport.tsx) ──────────

export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical';

export interface AgentIntelHome {
  address: string;
  price: number | null;
  bedrooms: number | null;
  type: string;
  status: 'on_market' | 'under_offer' | 'sold_stc' | 'removed';
  first_listed: string;
  distance: number | null;
  agent: string;
  url: string;
}

export interface AgentIntelAgency {
  agent: string;
  listings: number;
  agreed: number;
  new_30: number;
  similar: number;
  share: number;
  you: boolean;
}

export interface AgentIntelHeadline {
  health: number | null;
  risk: RiskLevel;
  risk_reason?: string;
  /** Always High on these listings; the reasons say why for this one. */
  vendor_pressure?: 'High';
  vendor_pressure_reasons?: string[];
  /** Older reports' name for vendor pressure. */
  vendor_frustration: 'Low' | 'Elevated' | 'High';
  dom: number | null;
  dom_benchmark: number | null;
  /** YYYY-MM-DD for a price-reduced listing ("" when unreadable), else null. */
  reduced_date?: string | null;
  days_since_reduction?: number | null;
  competitor_pressure: 'Low' | 'Moderate' | 'High';
  competitor_reason?: string;
  success_gap: number;
  /** Similar homes listed after this one now under offer or sold STC. */
  success_gap_rightmove?: number;
  /** Similar homes nearby that completed a sale after it was listed (HM Land Registry). */
  success_gap_sales?: number;
  relaunch: 'Limited' | 'Moderate' | 'Strong';
  relaunch_reason?: string;
  price: number | null;
}

export interface AgentIntelSale {
  address: string;
  price: number;
  date: string;
  type?: string;
  property_type?: string;
}

export interface AgentIntelCard {
  label: string;
  value: string;
  sub?: string;
}

export interface AgentIntel {
  version?: number;
  generated_at: string;
  radius: number | null;
  /** e.g. "within half a mile", "in CF23". */
  area_label?: string;
  /** What the figures were compared with, in a sentence. */
  summary?: string;
  sources?: { listing?: string; nearby?: string | null; sales?: string | null; nearby_area?: string; sales_area?: string; nearby_count?: number; sales_count?: number };
  basis_label: string;
  comparables: number;
  headline: AgentIntelHeadline;
  subject?: { listed_date: string | null; reduced_date: string | null; days_since_reduction: number | null; dom: number | null; agent: string };
  // Full report only (after purchase):
  nearby_total?: number;
  health_components?: Record<string, number | null>;
  vendor_view?: {
    since_label: string; new_since_listed: number; agreed: number; agreed_since_listed: number; sold_since_listed?: number;
    competitor_agencies_agreed: number; reduced_nearby: number; items?: { value: string | number; text: string }[];
  };
  market?: {
    cards?: AgentIntelCard[]; staleness: number | null; dom_gap: number | null; for_sale: number; alternatives: number;
    new_30: AgentIntelHome[]; sold_since: AgentIntelHome[]; competing?: AgentIntelHome[]; new_since_listed: number;
  };
  sold?: {
    area_label: string; homes_label: string; count_12m: number; median_12m: number | null; low_12m: number | null; high_12m: number | null;
    since_listed: AgentIntelSale[]; recent: AgentIntelSale[];
  };
  competitors?: { agencies: AgentIntelAgency[]; leading: AgentIntelAgency[]; alternative_set: AgentIntelAgency[]; momentum: AgentIntelAgency[]; threat: string; exposure: string; in_segment: number; agreed_in_segment: number };
  pricing?: {
    median_for_sale: number | null; premium_pct: number | null; cheaper_share: number | null; price_per_bedroom: number | null;
    comparable_price_per_bedroom: number | null; sold_median: number | null; sold_count: number; sold_premium_pct?: number | null;
    reduced_date: string | null; days_since_reduction: number | null; reduction_pressure: string; score: number | null;
    comparables?: AgentIntelSale[];
  };
  presentation?: { score: number; assessment_score: number | null; photos: number | null; comparable_photos: number | null; floorplans: number | null; comparable_floorplan_share: number | null; virtual_tours: number | null; comparable_tour_share: number | null; description_words: number | null; features: number | null; gaps: string[]; buyer_appeal: number | null; findings: { title: string; detail: string }[] };
  freshness?: { fatigue: string; days_since_update: number | null; relaunch: string };
  vendor?: { priority: string; questions: string[]; talking_points: string[] };
  actions?: { title: string; priority: 'Immediate' | 'High' | 'Medium' | 'Low'; why: string }[];
  plan?: { week: number; title: string }[];
  branch?: { stale_listings: number; stale_value: number; rank_by_time: number | null };
}

export interface AgentIntelResponse {
  status: 'preparing' | 'ready';
  locked: boolean;
  refreshing?: boolean;
  intel?: AgentIntel;
}

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

// Mirrors _stale_prospect_checkout_amount in app/routers/stale_listings.py —
// flat £299.99 regardless of asking price. Keeps the askingPrice parameter
// so callers don't need to change if per-price tiering is ever
// reintroduced.
export function unlockPrice(askingPrice?: number | null): number {
  return 299.99;
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

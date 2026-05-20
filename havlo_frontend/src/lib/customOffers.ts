export type CustomOfferPlanId = 'connect' | 'standout' | 'advantage';

export interface CustomOfferPlan {
  id: CustomOfferPlanId;
  name: string;
  price: string;
  amount: number;
  tagline: string;
  intro?: string;
  buttonBg: string;
  buttonColor: string;
  borderColor: string;
  badge?: string;
  illustration: 'blue' | 'orange' | 'teal';
  items: string[];
}

export interface CustomOfferPropertySnapshot {
  title: string;
  address: string;
  price: string;
  description: string;
  url: string;
  images: string[];
  image: string;
  bedrooms: string;
  bathrooms: string;
  property_type: string;
  listed_date: string;
  features: string[];
  floor_area: string;
  platform: string;
  blocked?: boolean;
}

export interface CustomOfferPropertyOverrides {
  title?: string;
  address?: string;
  price?: string;
  description?: string;
  image?: string;
  bedrooms?: string;
  bathrooms?: string;
  property_type?: string;
}

export interface CustomOfferStepAnswers {
  property_interest: string;
  proposal_type: string;
  proposed_offer: string;
  seller_consideration: string;
  flexible_terms: string[];
  buyer_status: string;
  proceed_timing: string;
  viewed_state: string;
  presentation_primary: string;
  presentation_risk: string;
  presentation_style: string;
  full_name: string;
  email: string;
  phone: string;
  confirm_responses_not_guaranteed: boolean;
  confirm_non_refundable: boolean;
  confirm_information_accurate: boolean;
}

export interface CustomOfferDraft {
  propertyInput: string;
  listingUrl: string;
  property: CustomOfferPropertySnapshot;
  propertyOverrides: CustomOfferPropertyOverrides;
  propertyNeedsReview: boolean;
  selectedPlan?: CustomOfferPlanId;
  answers: CustomOfferStepAnswers;
}

export interface CustomOfferStatusResponse {
  submission_id: string;
  reference: string;
  created_at: string;
  listing_url: string;
  listing_platform: string;
  plan_id: string;
  plan_name: string;
  payment_status: string;
  proposal_status: string;
  property: CustomOfferPropertySnapshot;
  property_overrides: CustomOfferPropertyOverrides;
  answers: CustomOfferStepAnswers;
  buyer_name: string;
}

export const CUSTOM_OFFER_PLANS: CustomOfferPlan[] = [
  {
    id: 'connect',
    name: 'Connect',
    price: '£49.99',
    amount: 49.99,
    tagline: 'For buyers who want to professionally present their purchase interest.',
    buttonBg: '#000000',
    buttonColor: '#FFFFFF',
    borderColor: 'rgba(0, 0, 0, 0.06)',
    illustration: 'blue',
    items: [
      'Property purchase proposal submission',
      'Seller outreach',
      'Structured buyer message',
      'Standard proposal review',
      'Secure presentation to seller',
    ],
  },
  {
    id: 'standout',
    name: 'Standout',
    price: '£99.99',
    amount: 99.99,
    tagline: 'For buyers who want to strengthen their proposal and increase seller consideration.',
    intro: 'Includes everything in Connect, plus:',
    buttonBg: '#F5B200',
    buttonColor: '#111111',
    borderColor: '#0F7B7D',
    badge: 'BEST VALUE',
    illustration: 'orange',
    items: [
      'Priority proposal presentation',
      'Enhanced buyer profile',
      'Flexible terms summary',
      'Tailored proposal positioning',
      'Seller-focused proposal formatting',
      'Highlighted buyer advantages and timeline',
    ],
  },
  {
    id: 'advantage',
    name: 'Advantage',
    price: '£149.99',
    amount: 149.99,
    tagline: 'For buyers presenting flexible or high-impact purchase proposals.',
    intro: 'Includes everything in Standout, plus:',
    buttonBg: '#000000',
    buttonColor: '#FFFFFF',
    borderColor: 'rgba(0, 0, 0, 0.06)',
    illustration: 'teal',
    items: [
      'Advanced proposal presentation',
      'Alternative purchase structure formatting',
      'Flexible completion arrangement summary',
      'Priority seller outreach',
      'Follow-up communication attempt',
      'Premium proposal positioning',
      'Detailed buyer intent and compatibility summary',
    ],
  },
];

const STORAGE_KEY = 'havlo:custom-offer-draft';

export const DEFAULT_CUSTOM_OFFER_ANSWERS: CustomOfferStepAnswers = {
  property_interest: '',
  proposal_type: '',
  proposed_offer: '',
  seller_consideration: '',
  flexible_terms: [],
  buyer_status: '',
  proceed_timing: '',
  viewed_state: '',
  presentation_primary: '',
  presentation_risk: '',
  presentation_style: '',
  full_name: '',
  email: '',
  phone: '',
  confirm_responses_not_guaranteed: false,
  confirm_non_refundable: false,
  confirm_information_accurate: false,
};

export function emptyPropertySnapshot(url: string = ''): CustomOfferPropertySnapshot {
  return {
    title: '',
    address: '',
    price: '',
    description: '',
    url,
    images: [],
    image: '',
    bedrooms: '',
    bathrooms: '',
    property_type: '',
    listed_date: '',
    features: [],
    floor_area: '',
    platform: '',
    blocked: false,
  };
}

export function defaultCustomOfferDraft(): CustomOfferDraft {
  return {
    propertyInput: '',
    listingUrl: '',
    property: emptyPropertySnapshot(),
    propertyOverrides: {},
    propertyNeedsReview: false,
    answers: { ...DEFAULT_CUSTOM_OFFER_ANSWERS },
  };
}

export function readCustomOfferDraft(): CustomOfferDraft | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CustomOfferDraft>;
    return {
      ...defaultCustomOfferDraft(),
      ...parsed,
      propertyInput: typeof parsed?.propertyInput === 'string' ? parsed.propertyInput : (parsed?.listingUrl || ''),
      property: { ...emptyPropertySnapshot(parsed?.listingUrl || ''), ...(parsed?.property || {}) },
      propertyOverrides: { ...(parsed?.propertyOverrides || {}) },
      answers: { ...DEFAULT_CUSTOM_OFFER_ANSWERS, ...(parsed?.answers || {}) },
    };
  } catch {
    return null;
  }
}

export function writeCustomOfferDraft(draft: CustomOfferDraft) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function clearCustomOfferDraft() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function mergeCustomOfferProperty(
  property: CustomOfferPropertySnapshot,
  overrides: CustomOfferPropertyOverrides,
): CustomOfferPropertySnapshot {
  return {
    ...property,
    title: overrides.title?.trim() || property.title,
    address: overrides.address?.trim() || property.address,
    price: overrides.price?.trim() || property.price,
    description: overrides.description?.trim() || property.description,
    image: overrides.image?.trim() || property.image,
    bedrooms: overrides.bedrooms?.trim() || property.bedrooms,
    bathrooms: overrides.bathrooms?.trim() || property.bathrooms,
    property_type: overrides.property_type?.trim() || property.property_type,
  };
}

export function customOfferStatusLabel(status: string) {
  switch (status) {
    case 'awaiting_seller_review':
      return 'Awaiting Seller Review';
    case 'seller_interested':
      return 'Seller Interested';
    case 'seller_not_interested':
      return 'Seller Not Interested';
    case 'closed':
      return 'Closed';
    case 'submitted':
      return 'Submitted';
    default:
      return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

export function prettyPlatform(platform: string) {
  if (!platform) return 'Property listing';
  if (platform.toLowerCase() === 'onthemarket') return 'OnTheMarket';
  if (platform.toLowerCase() === 'primelocation') return 'PrimeLocation';
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

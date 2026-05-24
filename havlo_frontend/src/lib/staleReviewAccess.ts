export interface StaleReviewSession {
  email: string;
  token: string;
  assessmentId: string;
  reference: string;
}

export interface StaleReviewPreviewSnapshot {
  assessmentId: string;
  reference: string;
  package: string;
  propertyAddress?: string;
  reportStatus: string;
  paymentStatus: string;
  reportData: unknown;
  agentNotes: string;
  createdAt?: string;
}

const STORAGE_KEY = 'havlo-stale-review-session';
const PREVIEW_STORAGE_KEY = 'havlo-stale-review-preview';

export function readStaleReviewSession(): StaleReviewSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StaleReviewSession;
    if (!parsed?.token || !parsed?.assessmentId || !parsed?.reference || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStaleReviewSession(session: StaleReviewSession): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function readStaleReviewPreview(reference?: string): StaleReviewPreviewSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StaleReviewPreviewSnapshot;
    if (!parsed?.reference || !parsed?.assessmentId || !parsed?.reportData) return null;
    if (reference && parsed.reference !== reference) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStaleReviewPreview(snapshot: StaleReviewPreviewSnapshot): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearStaleReviewSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
}

export interface StaleReviewSession {
  email: string;
  token: string;
  assessmentId: string;
  reference: string;
}

const STORAGE_KEY = 'havlo-stale-review-session';

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

export function clearStaleReviewSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export type ProductAccessScope = 'stale-listings' | 'custom-offers';

export interface ProductAccessSession {
  email: string;
  scope: ProductAccessScope;
  token: string;
}

const storageKey = (scope: ProductAccessScope) => `havlo-product-access:${scope}`;

export function readProductAccessSession(scope: ProductAccessScope): ProductAccessSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProductAccessSession;
    if (!parsed?.token || parsed.scope !== scope || !parsed.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeProductAccessSession(session: ProductAccessSession): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(session.scope), JSON.stringify(session));
}

export function clearProductAccessSession(scope: ProductAccessScope): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(scope));
}

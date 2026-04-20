import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const PAYMENT_KEY = 'havlo:pending_payment';
const LEGACY_BOOKING_ID_KEY = 'havlo_pending_booking_id';
const LEGACY_CHECKOUT_ID_KEY = 'havlo_pending_checkout_id';
const LEGACY_PAYMENT_TYPE_KEY = 'havlo_pending_payment_type';

export type PaymentKind =
  | 'session'
  | 'sell_faster'
  | 'buyer_network'
  | 'sale_audit';

export interface PendingPayment {
  kind: PaymentKind;
  recordId: string;
  reference: string;
}

export function persistPendingPayment(p: PendingPayment) {
  try {
    localStorage.setItem(PAYMENT_KEY, JSON.stringify(p));
    if (p.kind === 'session') {
      localStorage.setItem(LEGACY_BOOKING_ID_KEY, p.recordId);
      localStorage.setItem(LEGACY_CHECKOUT_ID_KEY, p.reference);
      localStorage.setItem(LEGACY_PAYMENT_TYPE_KEY, 'session');
    }
  } catch {
    /* ignore */
  }
}

export function readPendingPayment(): PendingPayment | null {
  try {
    const raw = localStorage.getItem(PAYMENT_KEY);
    if (raw) return JSON.parse(raw) as PendingPayment;
    const legacyType = localStorage.getItem(LEGACY_PAYMENT_TYPE_KEY);
    const legacyBookingId = localStorage.getItem(LEGACY_BOOKING_ID_KEY);
    const legacyCheckoutId = localStorage.getItem(LEGACY_CHECKOUT_ID_KEY);
    if (legacyType === 'session' && legacyBookingId && legacyCheckoutId) {
      return {
        kind: 'session',
        recordId: legacyBookingId,
        reference: legacyCheckoutId,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingPayment() {
  try {
    localStorage.removeItem(PAYMENT_KEY);
    localStorage.removeItem(LEGACY_BOOKING_ID_KEY);
    localStorage.removeItem(LEGACY_CHECKOUT_ID_KEY);
    localStorage.removeItem(LEGACY_PAYMENT_TYPE_KEY);
  } catch {
    /* ignore */
  }
}

/** Redirect the user to Havlo checkout page (SumUp widget mount). */
export function redirectToCheckout(checkoutId: string, p: PendingPayment) {
  persistPendingPayment(p);
  const params = new URLSearchParams({
    checkout_id: checkoutId,
    record_id: p.recordId,
    type: p.kind,
  });
  window.location.href = `/checkout?${params.toString()}`;
}

/**
 * On mount, if the URL contains `?payment=success` and a stored pending payment
 * matches the given kind, poll the supplied status fetcher every 4s (max 20
 * attempts ≈ 80s). Calls onPaid when status returns paid:true.
 */
export function usePaymentReturnPoller(args: {
  kind: PaymentKind;
  token: string | null;
  fetchStatus: (recordId: string) => Promise<{ paid: boolean; status: string; redirect_url?: string | null }>;
  onPaid: (result: { paid: boolean; status: string; redirect_url?: string | null }) => void;
  onError?: (err: unknown) => void;
  onTimeout?: () => void;
}) {
  const { kind, token, fetchStatus, onPaid, onError, onTimeout } = args;
  const location = useLocation();
  const navigate = useNavigate();
  const [polling, setPolling] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const stopped = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('payment') !== 'success') return;
    const pending = readPendingPayment();
    if (!pending || pending.kind !== kind || !token) return;

    stopped.current = false;
    setPolling(true);
    let attempts = 0;
    const MAX = 20;
    const INTERVAL = 4000;

    const tick = async () => {
      if (stopped.current) return;
      attempts += 1;
      try {
        const res = await fetchStatus(pending.recordId);
        if (res.paid) {
          stopped.current = true;
          setPolling(false);
          clearPendingPayment();
          // Strip the ?payment=success&ref=... params from the URL.
          navigate(location.pathname, { replace: true });
          onPaid(res);
          return;
        }
      } catch (err) {
        if (onError) onError(err);
      }
      if (attempts >= MAX) {
        stopped.current = true;
        setPolling(false);
        setTimedOut(true);
        if (onTimeout) onTimeout();
        return;
      }
      setTimeout(tick, INTERVAL);
    };
    tick();
    return () => {
      stopped.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, token]);

  return { polling, timedOut };
}

export const PAYMENT_TIMEOUT_MESSAGE =
  'Payment is taking longer than expected. Please check your email for confirmation or contact support.';

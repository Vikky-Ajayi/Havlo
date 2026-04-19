import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const PAYMENT_KEY = 'havlo:pending_payment';

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
  } catch {
    /* ignore */
  }
}

export function readPendingPayment(): PendingPayment | null {
  try {
    const raw = localStorage.getItem(PAYMENT_KEY);
    return raw ? (JSON.parse(raw) as PendingPayment) : null;
  } catch {
    return null;
  }
}

export function clearPendingPayment() {
  try {
    localStorage.removeItem(PAYMENT_KEY);
  } catch {
    /* ignore */
  }
}

/** Redirect the user to the SumUp hosted checkout in the SAME tab. */
export function redirectToCheckout(checkoutUrl: string, p: PendingPayment) {
  persistPendingPayment(p);
  window.location.href = checkoutUrl;
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

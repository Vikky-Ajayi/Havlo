import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clearPendingPayment, readPendingPayment } from '../lib/paymentReturn';

type CheckoutKind = 'session' | 'sell_faster' | 'buyer_network' | 'sale_audit';

function resolvePostPaymentRoute(kind: CheckoutKind): string {
  if (kind === 'session') return '/dashboard';
  if (kind === 'sell_faster') return '/dashboard/sell-faster';
  if (kind === 'buyer_network') return '/dashboard/buyer-network';
  return '/dashboard/sale-audit';
}

export const CheckoutPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const checkoutId = searchParams.get('checkout_id') || '';
  const kind = (searchParams.get('type') || 'session') as CheckoutKind;
  const recordId = searchParams.get('record_id') || '';

  const nextPath = useMemo(() => resolvePostPaymentRoute(kind), [kind]);

  useEffect(() => {
    const pending = readPendingPayment();
    if (!checkoutId || !pending) {
      setError('Missing payment context. Please start payment again from your dashboard.');
      return;
    }

    let scriptEl: HTMLScriptElement | null = document.querySelector(
      'script[data-sumup-sdk="true"]',
    );
    const mountWidget = () => {
      if (!window.SumUpCard) {
        setError('Unable to load payment widget. Please refresh and try again.');
        return;
      }
      try {
        window.SumUpCard.mount({
          id: 'sumup-card',
          checkoutId,
          onResponse: (type: string) => {
            if (type === 'success') {
              navigate(`${nextPath}?payment=success&checkout_id=${encodeURIComponent(checkoutId)}&record_id=${encodeURIComponent(recordId)}`, { replace: true });
              return;
            }
            if (type === 'error') {
              setError('Payment could not be completed. Please check card details and try again.');
            }
            if (type === 'unsupported-browser') {
              setError('Your browser is not supported for this payment. Please use Chrome or Firefox.');
            }
          },
          showSubmitButton: true,
          showZipCode: false,
          showEmail: false,
          showInstallments: false,
          locale: 'en-GB',
        });
      } catch {
        setError('Failed to initialize payment. Please refresh and try again.');
      }
    };

    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.src = 'https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js';
      scriptEl.async = true;
      scriptEl.dataset.sumupSdk = 'true';
      scriptEl.onload = mountWidget;
      scriptEl.onerror = () => setError('Failed to load payment SDK. Please check your connection and retry.');
      document.head.appendChild(scriptEl);
    } else if (window.SumUpCard) {
      mountWidget();
    } else {
      scriptEl.addEventListener('load', mountWidget, { once: true });
    }

    return () => {
      try {
        window.SumUpCard?.unmount();
      } catch {
        // ignore cleanup errors from third-party widget
      }
    };
  }, [checkoutId, navigate, nextPath, recordId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F5F4] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-black text-black">Complete Payment</h1>
        <p className="text-sm text-black/60 mt-1 mb-6">Secured by SumUp</p>
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm p-3">
            {error}
          </div>
        ) : (
          <div id="sumup-card" />
        )}
        <button
          type="button"
          className="mt-6 text-sm text-black/70 underline"
          onClick={() => {
            clearPendingPayment();
            navigate(nextPath, { replace: true });
          }}
        >
          Cancel and go back
        </button>
      </div>
    </div>
  );
};

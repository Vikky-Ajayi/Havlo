import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createNextStepsCheckout, getNextSteps, getNextStepsOrderStatus } from './api';
import { formatGbp, type NextStepsData } from './types';
import { Footer, Header, Spinner, WizardStyles } from './StaleProspectWizard';

// /stale-listings/prospect/next-steps?code=XXXX (or ?token=YYYY) — the optional
// services offered after a 20-factor report. One SumUp payment covers the
// basket; 30-Day Monitoring is shown as already included. Reached from the
// report's "Explore Next Steps" bar and the dashboard CTA.

const PENDING_KEY = 'havlo_nextsteps_pending'; // sessionStorage: the order being paid

export const ProspectNextSteps = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || undefined;
  const code = params.get('code') || undefined;
  const access = useMemo(() => ({ token, code }), [token, code]);
  const accessKey = token || code || '';

  const [data, setData] = useState<NextStepsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [justPaid, setJustPaid] = useState<string[] | null>(null);
  const pollTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await getNextSteps(access);
      setData(d);
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Could not load your next steps.');
    } finally {
      setLoading(false);
    }
  }, [access]);

  // Resume a payment we sent to SumUp: on return, poll the stored order.
  const pollPendingOrder = useCallback(async () => {
    let pending: { orderId: string; access: string } | null = null;
    try {
      pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
    } catch {
      pending = null;
    }
    if (!pending || pending.access !== accessKey) return;
    setConfirming(true);
    try {
      const { order } = await getNextStepsOrderStatus(access, pending.orderId);
      if (order.status === 'completed') {
        try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
        setConfirming(false);
        setJustPaid(order.items.map((i) => i.name));
        await load();
      } else {
        // Still pending at SumUp — check again shortly (a few times).
        pollTimer.current = window.setTimeout(pollPendingOrder, 2500);
      }
    } catch {
      setConfirming(false);
    }
  }, [access, accessKey, load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void pollPendingOrder();
    return () => { if (pollTimer.current) window.clearTimeout(pollTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessKey]);

  const addons = (data?.services || []).filter((s) => s.status !== 'included');
  const included = (data?.services || []).filter((s) => s.status === 'included');
  const selectable = addons.filter((s) => s.status === 'available');
  const total = selectable.filter((s) => selected.has(s.key)).reduce((sum, s) => sum + s.price, 0);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const pay = async () => {
    if (paying || selected.size === 0) return;
    setPaying(true);
    setError('');
    try {
      // The clean path (no query) — the backend appends the access key, so
      // SumUp returns here with a single token/code, not a duplicated one.
      const redirect = `${window.location.origin}${window.location.pathname}`;
      const res = await createNextStepsCheckout({
        token, property_code: code, items: [...selected], redirect_url: redirect,
      });
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ orderId: res.order_id, access: accessKey }));
      } catch { /* ignore */ }
      window.location.assign(res.checkout_url);
    } catch (err) {
      setError((err as Error).message || 'Could not start checkout. Please try again.');
      setPaying(false);
    }
  };

  return (
    <div className="slw-page">
      <Header />
      <div className="slw-shell">
        <main className="slw-main slw-ns">
          {loading ? (
            <div className="slw-ns-center"><Spinner /><p>Loading your next steps…</p></div>
          ) : error && !data ? (
            <div className="slw-ns-center"><h1>Next steps</h1><p className="slw-ns-error">{error}</p></div>
          ) : data ? (
            <>
              <div className="slw-ns-head">
                <p className="slw-ns-eyebrow">Optional next steps</p>
                <h1>Act on your report</h1>
                <p className="slw-ns-sub">{data.property_address} · Have us do the work for you. Pick what you need — one payment covers it.</p>
              </div>

              {confirming && <div className="slw-ns-banner slw-ns-banner-info">Confirming your payment…</div>}
              {justPaid && (
                <div className="slw-ns-banner slw-ns-banner-ok">
                  <b>Order confirmed.</b> We&rsquo;ve got your {justPaid.join(' and ')}. Our team will be in touch by email.
                </div>
              )}
              {error && <div className="slw-ns-banner slw-ns-banner-error">{error}</div>}

              <div className="slw-ns-grid">
                {addons.map((s) => {
                  const isOrdered = s.status === 'ordered';
                  const isOn = selected.has(s.key);
                  return (
                    <div
                      key={s.key}
                      className={`slw-ns-card${isOn ? ' slw-ns-card-on' : ''}${isOrdered ? ' slw-ns-card-done' : ''}`}
                      role={isOrdered ? undefined : 'button'}
                      tabIndex={isOrdered ? undefined : 0}
                      onClick={isOrdered ? undefined : () => toggle(s.key)}
                      onKeyDown={isOrdered ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(s.key); } }}
                    >
                      <div className="slw-ns-card-top">
                        <b className="slw-ns-card-name">{s.name}</b>
                        <span className="slw-ns-card-price">{formatGbp(s.price)}</span>
                      </div>
                      <p className="slw-ns-card-blurb">{s.blurb}</p>
                      {isOrdered
                        ? <span className="slw-ns-tag slw-ns-tag-done">Ordered ✓</span>
                        : <span className={`slw-ns-check${isOn ? ' slw-ns-check-on' : ''}`} aria-hidden="true">{isOn ? '✓' : ''}</span>}
                    </div>
                  );
                })}
                {included.map((s) => (
                  <div key={s.key} className="slw-ns-card slw-ns-card-included">
                    <div className="slw-ns-card-top">
                      <b className="slw-ns-card-name">{s.name}</b>
                      <span className="slw-ns-card-price slw-ns-card-free">Included</span>
                    </div>
                    <p className="slw-ns-card-blurb">{s.blurb}</p>
                    <span className="slw-ns-tag slw-ns-tag-included">Already yours</span>
                  </div>
                ))}
              </div>

              {selectable.length > 0 && (
                <div className="slw-ns-bar">
                  <div className="slw-ns-bar-total">
                    <span>Total</span>
                    <b>{formatGbp(total)}</b>
                  </div>
                  <button type="button" className="slw-btn-black slw-ns-pay" disabled={selected.size === 0 || paying} onClick={pay}>
                    {paying ? 'Opening secure checkout…' : selected.size === 0 ? 'Select a service' : `Pay ${formatGbp(total)}`}
                  </button>
                </div>
              )}
            </>
          ) : null}
        </main>
      </div>
      <Footer />
      <WizardStyles />
      <style>{`
        .slw-ns{padding:36px 0 80px;max-width:860px;margin:0 auto}
        .slw-ns-center{text-align:center;padding:90px 0;color:#556274}
        .slw-ns-center .slw-spinner{margin:0 auto 16px}
        .slw-ns-error{color:#B42318}
        .slw-ns-head{margin-bottom:22px}
        .slw-ns-eyebrow{margin:0;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#A409D2}
        .slw-ns-head h1{font-family:'Plus Jakarta Sans','Inter',sans-serif;font-weight:800;font-size:34px;letter-spacing:-0.03em;margin:6px 0 8px;color:#141414}
        .slw-ns-sub{margin:0;color:#475467;font-size:15.5px;line-height:1.5}
        .slw-ns-banner{border-radius:12px;padding:14px 16px;margin:0 0 18px;font-size:14.5px;line-height:1.5}
        .slw-ns-banner-info{background:#F1F0FB;color:#5A4AA8}
        .slw-ns-banner-ok{background:#E7F6EC;color:#166534}
        .slw-ns-banner-error{background:#FDECEC;color:#B42318}
        .slw-ns-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px}
        .slw-ns-card{position:relative;background:#fff;border:1.5px solid #e6e8ec;border-radius:16px;padding:20px 22px 22px;cursor:pointer;transition:border-color .12s,box-shadow .12s}
        .slw-ns-card:hover{border-color:#cfc3ef}
        .slw-ns-card-on{border-color:#A409D2;box-shadow:0 6px 22px rgba(164,9,210,.1)}
        .slw-ns-card-done,.slw-ns-card-included{cursor:default;background:#f7f8fa}
        .slw-ns-card-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:8px}
        .slw-ns-card-name{font-family:'Plus Jakarta Sans','Inter',sans-serif;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#141414}
        .slw-ns-card-price{font-weight:800;font-size:18px;color:#141414;white-space:nowrap}
        .slw-ns-card-free{color:#166534;font-size:14px}
        .slw-ns-card-blurb{margin:0 0 30px;color:#475467;font-size:14px;line-height:1.5}
        .slw-ns-check{position:absolute;bottom:18px;right:20px;width:26px;height:26px;border-radius:8px;border:2px solid #cfd4dc;background:#fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px;font-weight:800}
        .slw-ns-check-on{background:#A409D2;border-color:#A409D2}
        .slw-ns-tag{position:absolute;bottom:18px;right:20px;font-size:12.5px;font-weight:700;padding:4px 10px;border-radius:999px}
        .slw-ns-tag-done{background:#E7F6EC;color:#166534}
        .slw-ns-tag-included{background:#eef0f3;color:#5f6671}
        .slw-ns-bar{position:sticky;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:18px;background:#fff;border:1px solid #ececec;border-radius:16px;padding:16px 20px;box-shadow:0 -6px 24px rgba(16,17,21,.06)}
        .slw-ns-bar-total{display:flex;flex-direction:column}
        .slw-ns-bar-total span{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#9097a1}
        .slw-ns-bar-total b{font-family:'Plus Jakarta Sans','Inter',sans-serif;font-size:26px;letter-spacing:-0.02em;color:#141414}
        .slw-ns-pay{min-width:220px}
        @media (max-width:720px){.slw-ns-grid{grid-template-columns:1fr}.slw-ns-head h1{font-size:28px}}
      `}</style>
    </div>
  );
};

export default ProspectNextSteps;

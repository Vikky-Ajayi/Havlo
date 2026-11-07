import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { journeyGtmId, loadGtmContainer, pushGtmEventOnce, type Journey } from '../../lib/gtm';
import { createNextStepsCheckout, getNextSteps, getNextStepsOrderStatus } from './api';
import { formatGbp, type NextStepsData, type NextStepsOrder } from './types';
import { Footer, Header, Spinner, WizardStyles, useHideChatWidget } from './StaleProspectWizard';

// /stale-listings/prospect/next-steps?code=XXXX (or ?token=YYYY) — the optional
// services offered after a 20-factor report. One SumUp payment covers the
// basket; 30-Day Monitoring is shown as already included. Reached from the
// report's "Explore Next Steps" bar and the dashboard CTA.
// /rm/next-steps and /offer/next-steps (`journey`) are the same page in the
// Rightmove and offer-page journeys: it loads that campaign's Tag Manager
// container and tells it about add-on payments.

const PENDING_KEY = 'havlo_nextsteps_pending'; // sessionStorage: the order being paid

// A paid add-on order, for the campaign's container: once per order.
function pushAddonPurchaseEvent(order: NextStepsOrder, journey: Journey) {
  pushGtmEventOnce(`${journey}_addon_purchase_${order.order_id}`, 'purchase', {
    ecommerce: {
      transaction_id: `sl_addon_${order.order_id}`,
      value: order.amount,
      currency: order.currency || 'GBP',
      items: order.items.map((i) => ({ item_id: i.key, item_name: i.name, price: i.price, quantity: 1 })),
    },
  });
}

export const ProspectNextSteps = ({ journey }: { journey?: Journey } = {}) => {
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
  // The chat bubble sits where the Pay bar is.
  useHideChatWidget();

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
        if (journey) pushAddonPurchaseEvent(order, journey);
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
  }, [access, accessKey, load, journey]);

  useEffect(() => {
    void load();
  }, [load]);

  // The campaign's container (index.html loads it too; this covers arriving from elsewhere).
  useEffect(() => {
    if (journey) loadGtmContainer(journeyGtmId(journey));
  }, [journey]);

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
        <main className="slw-main ns">
          {loading ? (
            <div className="slw-ns-center"><Spinner /><p>Loading your next steps…</p></div>
          ) : error && !data ? (
            <div className="slw-ns-center"><h1>Next steps</h1><p className="slw-ns-error">{error}</p></div>
          ) : data ? (
            <>
              <div className="ns-head">
                <p className="ns-eyebrow">Optional next steps</p>
                <h1>
                  Turn your report&rsquo;s findings{' '}
                  <span className="ns-underline">
                    into action
                    <svg viewBox="0 0 300 18" preserveAspectRatio="none" aria-hidden="true">
                      <path d="M4 12 C 70 4, 150 3, 296 9" fill="none" stroke="#F5B300" strokeWidth="5" strokeLinecap="round" />
                    </svg>
                  </span>
                </h1>
                <p className="ns-sub">Choose the support you need to improve your listing, boost visibility and attract more serious buyers.</p>
              </div>

              {confirming && <div className="ns-banner ns-banner-info">Confirming your payment…</div>}
              {justPaid && (
                <div className="ns-banner ns-banner-ok">
                  <b>Order confirmed.</b> We&rsquo;ve got your {justPaid.join(' and ')}. Our team will be in touch by email.
                </div>
              )}
              {error && <div className="ns-banner ns-banner-error">{error}</div>}

              <div className="ns-grid">
                {addons.map((s) => {
                  const theme = THEMES[s.key] || THEMES.listing_rewrite;
                  const isOrdered = s.status === 'ordered';
                  const isOn = selected.has(s.key);
                  return (
                    <div
                      key={s.key}
                      className={`ns-card ns-${theme.tone}${isOn ? ' ns-card-on' : ''}${isOrdered ? ' ns-card-done' : ''}`}
                      role={isOrdered ? undefined : 'checkbox'}
                      aria-checked={isOrdered ? undefined : isOn}
                      tabIndex={isOrdered ? undefined : 0}
                      onClick={isOrdered ? undefined : () => toggle(s.key)}
                      onKeyDown={isOrdered ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(s.key); } }}
                    >
                      <div className="ns-card-main">
                        <span className="ns-icon">{theme.icon}</span>
                        <div className="ns-card-text">
                          <div className="ns-card-top">
                            <b>{s.name}</b>
                            <span className="ns-price">{formatGbp(s.price)}</span>
                          </div>
                          <p>{s.blurb}</p>
                        </div>
                      </div>
                      <div className="ns-card-foot">
                        {s.deliverable ? <span className="ns-pill"><CheckIcon />{s.deliverable}</span> : <span />}
                        {isOrdered
                          ? <span className="ns-ordered">Ordered <CheckIcon /></span>
                          : <span className={`ns-check${isOn ? ' ns-check-on' : ''}`} aria-hidden="true">{isOn && <CheckIcon />}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {included.map((s) => (
                <div key={s.key} className="ns-included">
                  <span className="ns-icon ns-icon-green"><ChartIcon /></span>
                  <div className="ns-included-text">
                    <b>{s.name}</b>
                    <p>{s.blurb}</p>
                  </div>
                  <div className="ns-included-tags">
                    <span className="ns-tag-included">Included</span>
                    <span className="ns-tag-yours">Already yours</span>
                  </div>
                </div>
              ))}

              <section className="ns-agent">
                <div className="ns-agent-top">
                  <span className="ns-icon ns-icon-amber"><HandshakeIcon /></span>
                  <div className="ns-agent-copy">
                    <h2>Use the results with your estate agent</h2>
                    <p>Once your Listing Rewrite and/or Relaunch Strategy is complete, usually within 3&ndash;7 working days, you&rsquo;ll receive a clear, actionable report by email that you can share with your estate agent, so they can implement the recommendations for you.</p>
                  </div>
                </div>
                <div className="ns-steps">
                  {STEPS.map((step, i) => (
                    <Fragment key={step.title}>
                      {i > 0 && <span className="ns-step-arrow" aria-hidden="true"><ArrowIcon /></span>}
                      <div className="ns-step">
                        <span className="ns-step-num">{i + 1}</span>
                        <span className="ns-step-icon">{step.icon}</span>
                        <div>
                          <b>{step.title}</b>
                          <p>{step.text}</p>
                        </div>
                      </div>
                    </Fragment>
                  ))}
                </div>
              </section>

              {selectable.length > 0 && (
                <div className="ns-bar">
                  <div className="ns-bar-total">
                    <span>Total</span>
                    <b>{formatGbp(total)}</b>
                  </div>
                  <button type="button" className="ns-pay" disabled={selected.size === 0 || paying} onClick={pay}>
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
        .ns{padding:40px 0 90px;max-width:1120px;margin:0 auto;font-family:'Inter',sans-serif}
        .slw-ns-center{text-align:center;padding:90px 0;color:#556274}
        .slw-ns-center .slw-spinner{margin:0 auto 16px}
        .slw-ns-error{color:#B42318}
        .ns-head{margin-bottom:30px}
        .ns-eyebrow{margin:0 0 10px;font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#A409D2}
        .ns-head h1{font-family:'Plus Jakarta Sans','Inter',sans-serif;font-weight:800;font-size:46px;line-height:1.1;letter-spacing:-0.035em;margin:0 0 14px;color:#111}
        .ns-underline{position:relative;display:inline-block;white-space:nowrap}
        .ns-underline svg{position:absolute;left:-2%;bottom:-10px;width:104%;height:16px}
        .ns-sub{margin:0;color:#3f4652;font-size:18px;line-height:1.5}
        .ns-banner{border-radius:12px;padding:14px 16px;margin:0 0 18px;font-size:14.5px;line-height:1.5}
        .ns-banner-info{background:#F1F0FB;color:#5A4AA8}
        .ns-banner-ok{background:#E7F6EC;color:#166534}
        .ns-banner-error{background:#FDECEC;color:#B42318}

        .ns-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
        .ns-card{--tone:#2F6FE4;--tone-soft:#EAF1FE;--tone-tint:#F5F8FF;display:flex;flex-direction:column;justify-content:space-between;gap:20px;background:#fff;border:1.5px solid var(--tone);border-radius:18px;padding:24px 26px;cursor:pointer;transition:box-shadow .15s,transform .15s,background .15s}
        .ns-relaunch{--tone:#B23BDF;--tone-soft:#F5E6FD;--tone-tint:#FCF4FF}
        .ns-card:hover{box-shadow:0 8px 26px rgba(16,24,40,.08)}
        .ns-card:focus-visible{outline:3px solid var(--tone-soft);outline-offset:2px}
        .ns-card-on{border-width:2px;background:linear-gradient(135deg,var(--tone-tint) 0%,#fff 70%);box-shadow:0 10px 30px rgba(16,24,40,.09)}
        .ns-card-done{cursor:default;opacity:.92}
        .ns-card-main{display:flex;gap:18px;align-items:flex-start}
        .ns-icon{flex:none;width:64px;height:64px;border-radius:16px;background:var(--tone-soft);color:var(--tone);display:flex;align-items:center;justify-content:center}
        .ns-icon svg{width:34px;height:34px}
        .ns-card-text{flex:1 1 auto;min-width:0}
        .ns-card-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:8px}
        .ns-card-top b{font-family:'Plus Jakarta Sans','Inter',sans-serif;font-size:24px;font-weight:800;letter-spacing:-0.03em;color:#111}
        .ns-price{font-family:'Plus Jakarta Sans','Inter',sans-serif;font-size:26px;font-weight:800;letter-spacing:-0.02em;color:#111;white-space:nowrap}
        .ns-card-text p{margin:0;color:#3f4652;font-size:15.5px;line-height:1.55}
        .ns-card-foot{display:flex;align-items:center;justify-content:space-between;gap:14px}
        .ns-pill{display:inline-flex;align-items:center;gap:9px;background:var(--tone-tint);color:#1f2937;font-size:14.5px;font-weight:600;padding:9px 16px;border-radius:999px}
        .ns-pill svg{width:16px;height:16px;color:var(--tone);flex:none}
        .ns-check{flex:none;width:34px;height:34px;border-radius:9px;border:2px solid #cfd4dc;background:#fff;display:flex;align-items:center;justify-content:center;color:#fff}
        .ns-check svg{width:20px;height:20px}
        .ns-check-on{background:var(--tone);border-color:var(--tone)}
        .ns-ordered{display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:700;color:#166534;background:#E7F6EC;padding:6px 12px;border-radius:999px}
        .ns-ordered svg{width:14px;height:14px}

        .ns-included{--tone:#16A34A;--tone-soft:#E7F6EC;display:flex;align-items:center;gap:20px;background:linear-gradient(135deg,#F7F9FD 0%,#fff 80%);border:1px solid #e3e6ec;border-radius:18px;padding:20px 26px;margin-bottom:28px}
        .ns-icon-green{--tone:#16A34A;--tone-soft:#E7F6EC}
        .ns-included-text{flex:1 1 auto;min-width:0}
        .ns-included-text b{display:block;font-family:'Plus Jakarta Sans','Inter',sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.03em;color:#111;margin-bottom:4px}
        .ns-included-text p{margin:0;color:#3f4652;font-size:15.5px;line-height:1.5}
        .ns-included-tags{display:flex;gap:10px;flex:none}
        .ns-tag-included,.ns-tag-yours{font-size:15px;font-weight:700;padding:9px 18px;border-radius:999px}
        .ns-tag-included{background:#E7F6EC;color:#15803D}
        .ns-tag-yours{background:#EEF0F3;color:#5F6671}

        .ns-agent{background:#FFF8E7;border:1.5px solid #F6DDA0;border-radius:20px;padding:26px;margin-bottom:26px}
        .ns-agent-top{display:flex;gap:22px;align-items:flex-start;margin-bottom:24px}
        .ns-icon-amber{--tone:#E59400;--tone-soft:#FFE7B3;width:76px;height:76px;border-radius:18px}
        .ns-icon-amber svg{width:40px;height:40px}
        .ns-agent-copy{border-left:2px solid #F3CE7A;padding-left:22px}
        .ns-agent-copy h2{font-family:'Plus Jakarta Sans','Inter',sans-serif;font-size:32px;font-weight:800;letter-spacing:-0.035em;line-height:1.15;margin:0 0 10px;color:#111}
        .ns-agent-copy p{margin:0;color:#2f3540;font-size:16.5px;line-height:1.55}
        .ns-steps{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:stretch;gap:14px}
        .ns-step{position:relative;display:flex;gap:14px;align-items:center;background:#fff;border:1px solid #F1E4BF;border-radius:16px;padding:18px 18px 18px 16px;min-height:96px}
        .ns-step-num{position:absolute;top:-14px;left:74px;width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#8B3FEA,#B23BDF);color:#fff;font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px #fff}
        .ns-step-icon{flex:none;width:58px;height:58px;border-radius:14px;background:#F6EEFD;color:#A409D2;display:flex;align-items:center;justify-content:center}
        .ns-step-icon svg{width:30px;height:30px}
        .ns-step b{display:block;font-size:17px;font-weight:800;color:#111;margin-bottom:3px}
        .ns-step p{margin:0;color:#4b5260;font-size:14px;line-height:1.45}
        .ns-step-arrow{color:#A409D2;display:flex;align-self:center}
        .ns-step-arrow svg{width:26px;height:26px}

        .ns-bar{position:sticky;bottom:12px;z-index:5;display:flex;align-items:center;gap:26px;background:#fff;border:1px solid #ececec;border-radius:20px;padding:18px 22px;box-shadow:0 -4px 30px rgba(16,17,21,.07)}
        .ns-bar-total{display:flex;flex-direction:column;flex:none}
        .ns-bar-total span{font-size:15px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#7a818c}
        .ns-bar-total b{font-family:'Plus Jakarta Sans','Inter',sans-serif;font-size:40px;letter-spacing:-0.03em;color:#111;line-height:1.1}
        .ns-pay{flex:1 1 auto;height:68px;border:none;border-radius:12px;background:#111;color:#fff;font-family:'Plus Jakarta Sans','Inter',sans-serif;font-size:22px;font-weight:800;cursor:pointer}
        .ns-pay:disabled{background:#c9ccd2;cursor:default}

        @media (max-width:900px){
          .ns-head h1{font-size:32px}
          .ns-sub{font-size:16px}
          .ns-grid{grid-template-columns:1fr}
          .ns-card{padding:20px}
          .ns-card-main{gap:14px}
          .ns-icon{width:46px;height:46px;border-radius:12px}
          .ns-icon svg{width:24px;height:24px}
          .ns-card-top b{font-size:20px}
          .ns-price{font-size:21px}
          .ns-card-text p{font-size:15px}
          .ns-pill{font-size:13.5px;padding:8px 12px}
          .ns-card-foot{align-items:flex-end}
          .ns-included{flex-wrap:wrap}
          .ns-included-tags{width:100%}
          .ns-agent{padding:20px}
          .ns-agent-top{flex-direction:column;gap:14px}
          .ns-agent-copy{border-left:none;padding-left:0}
          .ns-agent-copy h2{font-size:25px}
          .ns-steps{grid-template-columns:1fr;gap:22px}
          .ns-step-arrow{justify-content:center;transform:rotate(90deg)}
          .ns-bar{gap:16px;padding:14px 16px}
          .ns-bar-total b{font-size:30px}
          .ns-pay{height:56px;font-size:18px}
        }
      `}</style>
    </div>
  );
};

// ── Look: each service's accent and icon (lucide-style strokes) ──────────
const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const CheckIcon = () => svg(<polyline points="20 6 9 17 4 12" />);
const ArrowIcon = () => svg(<><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>);
const RewriteIcon = () => svg(<><path d="m18 5-2.414-2.414A2 2 0 0 0 14.172 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2" /><path d="M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" /><path d="M8 18h1" /><path d="M8 8h6" /><path d="M8 12h4" /></>);
const RocketIcon = () => svg(<><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></>);
const ChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="3.5" y="12" width="4" height="9" rx="1.5" /><rect x="10" y="5" width="4" height="16" rx="1.5" /><rect x="16.5" y="9" width="4" height="12" rx="1.5" />
  </svg>
);
const HandshakeIcon = () => svg(<><path d="m11 17 2 2a1 1 0 1 0 3-3" /><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" /><path d="m21 3 1 11h-2" /><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" /><path d="M3 4h8" /></>);
const PlanIcon = () => svg(<><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 12 1.5 1.5L13 11" /><path d="M9 17h6" /></>);
const ShareIcon = () => svg(<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></>);
const HouseIcon = () => svg(<><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>);

const THEMES: Record<string, { tone: string; icon: ReactNode }> = {
  listing_rewrite: { tone: 'rewrite', icon: <RewriteIcon /> },
  relaunch_strategy: { tone: 'relaunch', icon: <RocketIcon /> },
};

const STEPS: { title: string; text: string; icon: ReactNode }[] = [
  { title: 'We prepare your plan', text: 'Get your improved listing and/or relaunch strategy.', icon: <PlanIcon /> },
  { title: 'Share with your agent', text: 'Forward the PDF we email you to your estate agent.', icon: <ShareIcon /> },
  { title: 'Your agent implements it', text: 'They can action the recommendations to improve your property’s chances of selling.', icon: <HouseIcon /> },
];

export default ProspectNextSteps;

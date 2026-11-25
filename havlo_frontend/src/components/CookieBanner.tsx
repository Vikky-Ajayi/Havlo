import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { setConsent, shouldAskConsent } from '../lib/consent';
import { keepMetaClickId } from '../lib/metaPixel';

// Asks before the Meta Pixel loads (src/lib/consent.ts), on the pages that
// have it, until the visitor answers. Accepting loads the pixel there and
// then; declining keeps Meta tracking off. Either choice is remembered, and
// can be changed from the privacy policy.
export const CookieBanner = () => {
  const { pathname } = useLocation();
  const [ask, setAsk] = useState(() => shouldAskConsent(pathname));

  useEffect(() => {
    const update = () => setAsk(shouldAskConsent(window.location.pathname));
    update();
    window.addEventListener('havlo-consent', update);
    return () => window.removeEventListener('havlo-consent', update);
  }, [pathname]);

  if (!ask) return null;

  const choose = (granted: boolean) => {
    if (granted) keepMetaClickId();
    setConsent(granted ? 'granted' : 'denied');
  };

  return (
    <div className="hcb" role="dialog" aria-live="polite" aria-label="Cookies">
      <p>
        We&rsquo;d like to use cookies to measure how our adverts on Facebook and Instagram perform, which shares
        details of your visit with Meta. <Link to="/privacy-policy">Privacy policy</Link>
      </p>
      <div className="hcb-actions">
        <button type="button" className="hcb-decline" onClick={() => choose(false)}>Decline</button>
        <button type="button" className="hcb-accept" onClick={() => choose(true)}>Accept</button>
      </div>
      <style>{`
        .hcb{position:fixed;left:16px;bottom:16px;z-index:2147483000;max-width:420px;padding:16px 18px;background:#fff;color:#1f2024;border:1px solid #E5E7EB;border-radius:14px;box-shadow:0 12px 40px rgba(16,24,40,.18);font-family:Inter,sans-serif}
        .hcb p{margin:0;font-size:14px;line-height:1.5}
        .hcb a{color:#A409D2;font-weight:600;text-decoration:underline}
        .hcb-actions{display:flex;gap:10px;margin-top:12px}
        .hcb-actions button{flex:1;padding:10px 14px;border-radius:9px;font:600 14px Inter,sans-serif;cursor:pointer}
        .hcb-decline{background:#fff;color:#1f2024;border:1px solid #D0D5DD}
        .hcb-accept{background:#111;color:#fff;border:1px solid #111}
        @media (max-width:640px){.hcb{left:12px;right:12px;bottom:12px;max-width:none}}
      `}</style>
    </div>
  );
};

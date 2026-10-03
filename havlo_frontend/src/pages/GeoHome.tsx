import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { detectCountryFromIP, experienceRouteFor, getStoredCountry, setStoredCountry } from '../lib/geo';
import { usePageMeta } from '../hooks/usePageMeta';
import { HOME_SEO } from '../lib/siteSeo';

// Root route ("/"). Silently detects the visitor's country (via Vercel's
// edge geolocation, see lib/geo.ts) and sends them to their side of the
// site. Only Nigeria goes to Buy Abroad; everyone else, and anyone whose
// country can't be detected, lands on /stale-listings. Nobody outside
// Nigeria is ever sent to /buyabroad from here.
export const GeoHome = () => {
  const navigate = useNavigate();
  usePageMeta({ ...HOME_SEO, canonical: 'https://www.heyhavlo.com/' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = getStoredCountry();
      if (stored) {
        navigate(experienceRouteFor(stored), { replace: true });
        return;
      }

      const detected = await detectCountryFromIP();
      if (cancelled) return;

      if (detected) {
        setStoredCountry(detected, 'auto');
        navigate(experienceRouteFor(detected), { replace: true });
      } else {
        // Nothing is stored, so the next visit tries detection again.
        navigate('/stale-listings', { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Detection is near-instant (one edge request), so this is on screen
  // for a moment at most — no spinner needed, just a blank frame.
  return <main className="min-h-screen bg-white" />;
};

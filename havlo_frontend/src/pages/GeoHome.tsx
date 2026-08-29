import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { detectCountryFromIP, experienceRouteFor, getStoredCountry, setStoredCountry } from '../lib/geo';

// Root route ("/"). Silently detects the visitor's country (via Vercel's
// edge geolocation, see lib/geo.ts) and sends them straight to the UK or
// international side of the site — no more manual "Are you in the UK?"
// prompt for the common case. That prompt only reappears as a fallback if
// detection genuinely can't resolve a country (local dev, or the /api/geo
// function being unreachable), so there's always a way forward.
export const GeoHome = () => {
  const navigate = useNavigate();
  const [detectionFailed, setDetectionFailed] = useState(false);

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
        setDetectionFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const chooseManually = (experience: 'uk' | 'global') => {
    setStoredCountry(experience === 'uk' ? 'GB' : 'INTL', 'manual');
    navigate(experience === 'uk' ? '/stale-listings' : '/buyabroad/uk', { replace: true });
  };

  if (!detectionFailed) {
    // Detection is near-instant (one edge request), so this is on screen
    // for a moment at most — no spinner needed, just a blank frame.
    return <main className="min-h-screen bg-white" />;
  }

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-center">
      <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-3xl place-items-center">
        <section className="w-full rounded-[32px] border border-black/10 bg-white p-8 shadow-[0_24px_80px_rgba(0,0,0,0.08)] sm:p-12">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-[#a900d8]">Choose your Havlo experience</p>
          <h1 className="mt-4 font-body text-4xl font-light tracking-[-0.05em] text-black sm:text-6xl">
            Are you currently in the UK?
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-black/65">
            We couldn't automatically detect your location. You can change this any time from the country badge at the top of the page.
          </p>
          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => chooseManually('uk')}
              className="rounded-2xl bg-black px-5 py-5 text-base font-black text-white"
            >
              Yes, I am in the UK
            </button>
            <button
              onClick={() => chooseManually('global')}
              className="rounded-2xl border border-black/15 px-5 py-5 text-base font-black text-black"
            >
              No, I am outside the UK
            </button>
          </div>
          <Link className="mt-7 inline-block text-sm font-bold text-[#a900d8]" to="/home">
            Open the original Havlo home page
          </Link>
        </section>
      </div>
    </main>
  );
};

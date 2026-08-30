import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { flagUrl } from '../../lib/geoCountries';
import { ALL_COUNTRY_REGIONS } from '../../lib/allCountries';
import {
  COUNTRY_CHANGED_EVENT,
  detectCountryFromIP,
  experienceRouteFor,
  getStoredCountry,
  isUK,
  setStoredCountry,
} from '../../lib/geo';

// Every country (not the smaller curated investment-market list the
// /countries marketing page shows — see allCountries.ts for why they're
// separate), flattened once for search.
const ALL_COUNTRIES = ALL_COUNTRY_REGIONS.flatMap((region) =>
  region.countries.map((country) => ({ ...country, region: region.name })),
);

function countryNameForIso(iso: string | null): string | null {
  if (!iso) return null;
  const match = ALL_COUNTRIES.find((c) => c.flag.toUpperCase() === iso.toUpperCase());
  return match ? match.name : null;
}

// Module-level guard so that however many CountryBadge instances are on
// screen (only one normally, but StrictMode double-mounts in dev), an
// unresolved visitor only triggers one /api/geo call, not one per badge.
let inFlightDetection: Promise<string | null> | null = null;

// Global country switcher: a pill (flag + chevron) meant to sit inline in
// a page's own header/navbar — see `variant`. Clicking opens a dropdown of
// countries grouped by region; picking one updates the badge's flag and —
// if it moves you between the UK and international sides of the site —
// redirects to that experience's entry point.
//
// If no country is stored yet (a visitor who landed on some page other
// than "/", where GeoHome normally does this), the badge resolves one
// itself via IP geolocation on mount, so the flag is never left to a
// manual choice just because the badge happened to mount first.
export const CountryBadge = ({ variant = 'floating' }: { variant?: 'floating' | 'inline' }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [currentIso, setCurrentIso] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = getStoredCountry();
    setCurrentIso(stored);
    if (!stored) {
      inFlightDetection ??= detectCountryFromIP();
      inFlightDetection.then((detected) => {
        // Another badge instance (or GeoHome) may have set a value while
        // this call was in flight — don't clobber it with a stale result.
        if (detected && !getStoredCountry()) setStoredCountry(detected, 'auto');
      });
    }
    // Catches GeoHome's (or another badge instance's) auto-detected country
    // landing after this badge has already mounted and read the (then-empty)
    // stored value — see the comment on setStoredCountry in lib/geo.ts.
    const onCountryChanged = (e: Event) => setCurrentIso((e as CustomEvent<string>).detail);
    window.addEventListener(COUNTRY_CHANGED_EVENT, onCountryChanged);
    return () => window.removeEventListener(COUNTRY_CHANGED_EVENT, onCountryChanged);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const filteredRegions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_COUNTRY_REGIONS;
    return ALL_COUNTRY_REGIONS.map((region) => ({
      ...region,
      countries: region.countries.filter((c) => c.name.toLowerCase().includes(q)),
    })).filter((region) => region.countries.length > 0);
  }, [query]);

  const currentName = countryNameForIso(currentIso);
  const hasKnownFlag = ALL_COUNTRIES.some((c) => c.flag.toUpperCase() === (currentIso || '').toUpperCase());

  const handleSelect = (iso: string) => {
    const wasUK = isUK(currentIso);
    const nowUK = isUK(iso);
    setStoredCountry(iso, 'manual');
    setCurrentIso(iso);
    setOpen(false);
    setQuery('');
    if (wasUK !== nowUK) {
      navigate(experienceRouteFor(iso));
    }
  };

  return (
    <div
      ref={rootRef}
      className={variant === 'inline' ? 'relative shrink-0' : 'fixed top-4 right-4 z-[70] sm:top-5 sm:right-5'}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={currentName ? `Browsing as ${currentName}. Change country.` : 'Choose your country'}
        className="flex items-center gap-2 rounded-full bg-[#F4F4F5] pl-1.5 pr-3 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.08)] border border-black/5 hover:bg-[#ECECEE] transition-colors"
      >
        <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-white shadow-inner shrink-0">
          {hasKnownFlag ? (
            <img
              src={flagUrl(currentIso as string)}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <GlobeIcon />
          )}
        </span>
        <ChevronDownIcon className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-[70] mt-2 w-[300px] max-h-[70vh] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_24px_60px_rgba(0,0,0,0.18)] flex flex-col"
        >
          <div className="p-3 border-b border-black/5">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries"
              className="w-full rounded-xl bg-[#F4F4F5] px-3 py-2 text-sm text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#A409D2]/30"
            />
          </div>
          <div className="overflow-y-auto py-2">
            {filteredRegions.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-black/50">No countries match "{query}".</p>
            )}
            {filteredRegions.map((region) => (
              <div key={region.name}>
                <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-black/40">
                  {region.name}
                </p>
                {region.countries.map((country) => {
                  const selected = currentIso?.toUpperCase() === country.flag.toUpperCase();
                  return (
                    <button
                      key={country.name}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelect(country.flag)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F9F0FC] transition-colors ${
                        selected ? 'bg-[#F9F0FC]' : ''
                      }`}
                    >
                      <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full shrink-0 border border-black/5">
                        <img
                          src={flagUrl(country.flag)}
                          alt=""
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </span>
                      <span className="text-sm font-medium text-[#1F1F1E] truncate">{country.name}</span>
                      {selected && <CheckIcon className="ml-auto shrink-0 text-[#A409D2]" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ChevronDownIcon = ({ className = '' }: { className?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
       strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const CheckIcon = ({ className = '' }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
       strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b6b75" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z" />
  </svg>
);

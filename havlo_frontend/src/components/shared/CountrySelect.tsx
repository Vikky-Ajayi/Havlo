import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { COUNTRY_CODES, type CountryCode } from '../../lib/countryCodes';
import { cn } from '../../lib/utils';

interface CountrySelectProps {
  value?: string;
  onChange: (country: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  name?: string;
}

const FlagImg: React.FC<{ iso?: string; emoji?: string; alt?: string; lazy?: boolean }> = ({
  iso,
  emoji,
  alt = '',
  lazy = false,
}) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [iso]);
  if (!iso || failed) {
    return emoji ? (
      <span className="inline-block w-[20px] text-base leading-none" aria-hidden>
        {emoji}
      </span>
    ) : (
      <span className="inline-block h-[15px] w-[20px] rounded-[2px] bg-gray-200" aria-hidden />
    );
  }
  const code = iso.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w40/${code}.png 1x, https://flagcdn.com/w80/${code}.png 2x`}
      width={20}
      height={15}
      alt={alt}
      loading={lazy ? 'lazy' : undefined}
      onError={() => setFailed(true)}
      className="inline-block h-[15px] w-[20px] flex-shrink-0 rounded-[2px] object-cover"
    />
  );
};

// Deduplicate by country name (alphabetical) — COUNTRY_CODES is already sorted.
const COUNTRIES: CountryCode[] = (() => {
  const seen = new Set<string>();
  return COUNTRY_CODES.filter(c => {
    if (seen.has(c.country)) return false;
    seen.add(c.country);
    return true;
  });
})();

export const CountrySelect: React.FC<CountrySelectProps> = ({
  value,
  onChange,
  placeholder = 'Select',
  className,
  buttonClassName,
  name,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => COUNTRIES.find(c => c.country === value),
    [value],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(c => c.country.toLowerCase().includes(q));
  }, [search]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 0);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full', className)}
      onKeyDown={e => {
        if (e.key === 'Escape' && isOpen) {
          e.stopPropagation();
          setIsOpen(false);
        }
      }}
    >
      {name && <input type="hidden" name={name} value={value || ''} />}
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={selected ? `Country: ${selected.country}` : placeholder}
        className={cn(
          'flex h-12 w-full items-center gap-2 rounded-lg bg-[#EEF0F2] px-4 text-left transition-colors hover:bg-[#E4E7EA]',
          buttonClassName,
        )}
      >
        {selected ? (
          <>
            <FlagImg iso={selected.iso} emoji={selected.flag} alt={selected.country} />
            <span className="flex-1 truncate font-body text-xs text-[#676B80]">
              {selected.country}
            </span>
          </>
        ) : (
          <span className="flex-1 truncate font-body text-xs text-[#676B80]/50">
            {placeholder}
          </span>
        )}
        <ChevronDown
          size={14}
          className={cn('text-black/50 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
          <div
            role="listbox"
            aria-label="Country"
            className="absolute top-full left-0 z-[70] mt-1 w-full overflow-hidden rounded-xl border border-[rgba(58,60,62,0.10)] bg-white shadow-xl"
          >
            <div className="border-b border-gray-100 p-2">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search country..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg bg-gray-50 px-3 py-1.5 text-sm outline-none placeholder:text-black/40"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filtered.map(c => {
                const isSelected = value === c.country;
                return (
                  <button
                    key={c.country}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(c.country);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50',
                      isSelected && 'bg-gray-100 font-semibold',
                    )}
                  >
                    <FlagImg iso={c.iso} emoji={c.flag} alt={c.country} lazy />
                    <span className="text-black/80">{c.country}</span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-center text-sm text-black/50">No matches</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

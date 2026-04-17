import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { COUNTRY_CODES } from '../../lib/countryCodes';
import { cn } from '../../lib/utils';

interface CountryCodeSelectProps {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  buttonClassName?: string;
}

const FlagPlaceholder: React.FC<{ emoji?: string; alt?: string }> = ({
  emoji,
  alt = '',
}) => {
  if (emoji) {
    return (
      <span
        role="img"
        aria-label={alt}
        className="inline-flex h-[15px] w-[20px] flex-shrink-0 items-center justify-center overflow-hidden rounded-[2px] text-[14px] leading-none"
      >
        {emoji}
      </span>
    );
  }
  return (
    <span
      aria-label={alt}
      className="inline-block h-[15px] w-[20px] flex-shrink-0 rounded-[2px] bg-gray-300"
    />
  );
};

const FlagImg: React.FC<{
  iso?: string;
  emoji?: string;
  alt?: string;
  lazy?: boolean;
}> = ({ iso, emoji, alt = '', lazy = false }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [iso]);
  if (!iso) return <FlagPlaceholder emoji={emoji} alt={alt} />;
  if (failed) return <FlagPlaceholder emoji={emoji} alt={alt} />;
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

const PRIMARY_FOR_CODE: Record<string, string> = {
  '+1': 'United States',
  '+44': 'United Kingdom',
  '+7': 'Russia',
  '+212': 'Morocco',
  '+590': 'Guadeloupe',
  '+599': 'Curaçao',
  '+262': 'Mayotte',
};

const resolveSelected = (value: string) => {
  const primary = PRIMARY_FOR_CODE[value];
  if (primary) {
    const match = COUNTRY_CODES.find(c => c.code === value && c.country === primary);
    if (match) return match;
  }
  return COUNTRY_CODES.find(c => c.code === value) || COUNTRY_CODES[0];
};

export const CountryCodeSelect: React.FC<CountryCodeSelectProps> = ({
  value,
  onChange,
  className,
  buttonClassName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = resolveSelected(value);
  const filtered = COUNTRY_CODES.filter(c => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.code.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 0);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  return (
    <div
      className={cn('relative', className)}
      onKeyDown={e => {
        if (e.key === 'Escape' && isOpen) {
          e.stopPropagation();
          setIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Country code: ${selected?.country} ${selected?.code}`}
        className={cn(
          'flex h-8 items-center gap-1 rounded-lg bg-[#DDD] px-2 cursor-pointer hover:bg-[#CCC] transition-colors',
          buttonClassName,
        )}
      >
        <FlagImg iso={selected?.iso} emoji={selected?.flag} alt={selected?.country} />
        <ChevronDown
          size={12}
          className={cn('text-black/50 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
          <div
            role="listbox"
            aria-label="Country code"
            className="absolute top-full left-0 z-[70] mt-1 w-72 overflow-hidden rounded-xl border border-[rgba(58,60,62,0.10)] bg-white shadow-xl"
          >
            <div className="p-2 border-b border-gray-100">
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
              {filtered.map((c, i) => {
                const isSelected =
                  value === c.code &&
                  (PRIMARY_FOR_CODE[value]
                    ? c.country === PRIMARY_FOR_CODE[value]
                    : true);
                return (
                  <button
                    key={`${c.code}-${c.country}-${i}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(c.code);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50',
                      isSelected && 'bg-gray-100 font-semibold',
                    )}
                  >
                    <FlagImg iso={c.iso} emoji={c.flag} alt={c.country} lazy />
                    <span className="text-black/80">{c.country}</span>
                    <span className="ml-auto text-black/50">{c.code}</span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-center text-sm text-black/50">
                  No matches
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

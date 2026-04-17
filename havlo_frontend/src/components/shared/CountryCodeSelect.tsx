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

export const CountryCodeSelect: React.FC<CountryCodeSelectProps> = ({
  value,
  onChange,
  className,
  buttonClassName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = COUNTRY_CODES.find(c => c.code === value) || COUNTRY_CODES[0];
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
        <span className="text-sm">{selected?.flag}</span>
        <span className="font-body text-sm font-medium tracking-[-0.28px] text-black/80">
          {selected?.code}
        </span>
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
            className="absolute top-full left-0 z-[70] mt-1 w-56 overflow-hidden rounded-xl border border-[rgba(58,60,62,0.10)] bg-white shadow-xl"
          >
            <div className="p-2 border-b border-gray-100">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg bg-gray-50 px-3 py-1.5 text-sm outline-none placeholder:text-black/40"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.map(c => (
                <button
                  key={c.code}
                  type="button"
                  role="option"
                  aria-selected={value === c.code}
                  onClick={() => {
                    onChange(c.code);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50',
                    value === c.code && 'bg-gray-100 font-semibold',
                  )}
                >
                  <span>{c.flag}</span>
                  <span className="text-black/70">{c.country}</span>
                  <span className="ml-auto text-black/50">{c.code}</span>
                </button>
              ))}
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

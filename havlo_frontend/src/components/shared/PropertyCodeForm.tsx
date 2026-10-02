import { FormEvent, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Hero field for the code printed on a Havlo letter. Owners get a 4-digit
// property code (opens /stale-listings/prospect); agencies get a 5-digit
// agency code (opens their portfolio at /check/agent) and may also have a
// property code for a single listing, so the agent form accepts either.
export const PropertyCodeForm = ({ audience, className }: { audience: 'owner' | 'agent'; className?: string }) => {
  const navigate = useNavigate();
  const inputId = useId();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const isAgent = audience === 'agent';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = code.replace(/\D/g, '');
    if (clean.length === 4) {
      navigate(`/stale-listings/prospect?code=${clean}`);
    } else if (isAgent && clean.length === 5) {
      navigate(`/check/agent?code=${clean}`);
    } else {
      setError(isAgent ? 'Enter the 4- or 5-digit code from your letter.' : 'Enter the 4-digit code from your letter.');
    }
  };

  return (
    <form className={`pcf${className ? ` ${className}` : ''}`} onSubmit={submit} noValidate>
      <label htmlFor={inputId}>{isAgent ? 'Have an agency or property code?' : 'Have a property code?'}</label>
      <div className="pcf-row">
        <input
          id={inputId}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={isAgent ? 5 : 4}
          value={code}
          onChange={(event) => {
            setCode(event.target.value.replace(/\D/g, ''));
            setError('');
          }}
          placeholder={isAgent ? 'Enter the code from your letter' : 'Enter your 4-digit property code'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
        <button type="submit">{isAgent ? 'View listings' : 'View assessment'}</button>
      </div>
      {error && <p id={`${inputId}-error`} className="pcf-error">{error}</p>}
      <style>{`
        .pcf{width:100%;max-width:440px}
        .pcf label{display:block;margin:0 0 8px;font-family:Inter,sans-serif;font-weight:600;font-size:14px;line-height:150%;letter-spacing:-0.02em;color:#1F1F1E}
        .pcf-row{display:flex;align-items:center;gap:8px;padding:4px 4px 4px 14px;border:1px solid rgba(0,0,0,.12);border-radius:12px;background:#fff}
        .pcf-row:focus-within{border-color:#A409D2;box-shadow:0 0 0 3px rgba(164,9,210,.12)}
        .pcf input{flex:1;min-width:0;height:40px;border:0;outline:0;background:transparent;font-family:Inter,sans-serif;font-weight:500;font-size:15px;letter-spacing:-0.02em;color:#1F1F1E}
        .pcf input::placeholder{color:#8A8A8A}
        .pcf button{flex:none;height:40px;padding:0 18px;border:0;border-radius:9px;background:#000;color:#fff;font-family:Inter,sans-serif;font-weight:600;font-size:14px;letter-spacing:-0.02em;cursor:pointer;white-space:nowrap}
        .pcf button:hover{background:#222}
        .pcf-error{margin:8px 0 0;font-family:Inter,sans-serif;font-size:13px;font-weight:500;color:#DC2626}
        @media(max-width:480px){
          .pcf-row{flex-wrap:wrap;padding:6px}
          .pcf input{flex-basis:100%;padding:0 8px}
          .pcf button{width:100%}
        }
      `}</style>
    </form>
  );
};

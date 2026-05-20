import React, { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { ProductAccessScope } from '../../lib/productAccess';

const SCOPE_META: Record<ProductAccessScope, { label: string; homePath: string }> = {
  'stale-listings': {
    label: 'Stale Listings',
    homePath: '/stale-listings',
  },
  'custom-offers': {
    label: 'Custom Offers',
    homePath: '/custom-offers',
  },
};

async function requestMagicLink(scope: ProductAccessScope, email: string) {
  if (scope === 'stale-listings') {
    return api.staleListingsAccessRequest(email);
  }
  return api.customOffersAccessRequest(email);
}

function EnvelopeIllustration() {
  return (
    <svg width="164" height="112" viewBox="0 0 164 112" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="82" cy="95" rx="50" ry="7" fill="#F0D2C4" />
      <path d="M48 43L82 18L116 43V84H48V43Z" fill="#1F66DC" />
      <path d="M43 42.5L82 18L121 42.5L82 71L43 42.5Z" fill="#FF9B2C" />
      <path d="M43 42.5V82C43 84.2091 44.7909 86 47 86H117C119.209 86 121 84.2091 121 82V42.5L82 71L43 42.5Z" fill="#FF9822" />
      <path d="M58 33L86 24L80 55L52 50L58 33Z" fill="#FFF8EA" />
      <path d="M83 33.5L112 27L110 49L81 55L83 33.5Z" fill="#FFF8EA" />
      <path d="M59 38H81" stroke="#65718B" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M58 44H76" stroke="#65718B" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M91 37H105" stroke="#65718B" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M126 27L130 22" stroke="#8892A8" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M131 35L138 33" stroke="#8892A8" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M123 21L124 14" stroke="#8892A8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SuccessIllustration() {
  return (
    <svg width="108" height="108" viewBox="0 0 108 108" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="54" cy="54" r="40" fill="#2FAA4F" />
      <path d="M39 55.5L49.5 66L71 40" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M19.5 8.5L8.5 19.5M8.5 8.5L19.5 19.5" stroke="#7A7F86" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface ProductAccessRequestCardProps {
  scope: ProductAccessScope;
  initialEmail?: string;
  onClose?: () => void;
  variant?: 'modal' | 'inline';
}

export function ProductAccessRequestCard({
  scope,
  initialEmail = '',
  onClose,
  variant = 'inline',
}: ProductAccessRequestCardProps) {
  const meta = useMemo(() => SCOPE_META[scope], [scope]);
  const [email, setEmail] = useState(initialEmail);
  const [sentTo, setSentTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setError('');
    try {
      await requestMagicLink(scope, email.trim());
      setSentTo(email.trim());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send your sign-in link right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 32,
        boxShadow: variant === 'modal' ? '0 24px 50px rgba(0, 0, 0, 0.14)' : '0 8px 30px rgba(0, 0, 0, 0.08)',
        width: 'min(100%, 860px)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: variant === 'modal' ? '18px 18px 20px' : '26px 20px 22px' }}>
        {onClose ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sign in"
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                border: 0,
                background: '#EEF1F5',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CloseIcon />
            </button>
          </div>
        ) : null}

        {!sentTo ? (
          <div style={{ padding: variant === 'modal' ? '0 22px 18px' : '0 10px 10px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <EnvelopeIllustration />
            </div>
            <h2 style={{ margin: '0 0 12px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: variant === 'modal' ? 33 : 30, fontWeight: 800, letterSpacing: '-0.05em', color: '#303540' }}>
              Sign in easily without a password!
            </h2>
            <p style={{ margin: '0 0 24px', color: '#4B5563', fontSize: 16, lineHeight: 1.5 }}>
              We&apos;ll send you an email with a magic link that&apos;ll sign you in instantly to {meta.label}.
            </p>
            <form onSubmit={handleSend}>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  height: 72,
                  borderRadius: 18,
                  border: '1px solid rgba(0, 0, 0, 0.14)',
                  padding: '0 26px',
                  fontSize: 17,
                  color: '#111111',
                  outline: 'none',
                  marginBottom: 20,
                }}
              />
              {error ? <div style={{ marginBottom: 14, color: '#C02626', fontSize: 14 }}>{error}</div> : null}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  height: 72,
                  borderRadius: 18,
                  border: 0,
                  background: '#000000',
                  color: '#FFFFFF',
                  fontSize: 22,
                  fontWeight: 700,
                  cursor: loading ? 'default' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Sending magic link...' : 'Send magic link'}
              </button>
            </form>
          </div>
        ) : (
          <div style={{ padding: variant === 'modal' ? '4px 26px 8px' : '4px 10px 6px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <SuccessIllustration />
            </div>
            <h2 style={{ margin: '0 0 12px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: variant === 'modal' ? 34 : 30, fontWeight: 800, letterSpacing: '-0.05em', color: '#303540' }}>
              Check your email
            </h2>
            <p style={{ margin: '0 0 8px', color: '#4B5563', fontSize: 16, lineHeight: 1.55 }}>
              We&apos;ve sent a magic link to <strong style={{ color: '#303540' }}>{sentTo}</strong>.
            </p>
            <p style={{ margin: '0 0 0', color: '#4B5563', fontSize: 16, lineHeight: 1.55 }}>
              Don&apos;t forget to check your spam folder.
            </p>
          </div>
        )}
      </div>

      {sentTo ? (
        <div
          style={{
            background: '#EEF1F5',
            padding: '18px 20px 22px',
            textAlign: 'center',
            color: '#606875',
            fontSize: 17,
            lineHeight: 1.4,
          }}
        >
          Didn&apos;t get it?{' '}
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={loading}
            style={{
              border: 0,
              background: 'transparent',
              padding: 0,
              color: '#0562F2',
              fontSize: 17,
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            Send me a new email
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface ProductAccessModalProps {
  scope: ProductAccessScope;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductAccessModal({ scope, isOpen, onClose }: ProductAccessModalProps) {
  if (!isOpen) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      style={{
        position: 'fixed',
        top: 'var(--app-viewport-offset-top, 0px)',
        left: 'var(--app-viewport-offset-left, 0px)',
        width: '100vw',
        height: 'var(--app-viewport-height, 100vh)',
        zIndex: 300,
        background: 'rgba(0, 0, 0, 0.28)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
      }}
      onClick={onClose}
    >
      <div style={{ width: 'min(100%, 900px)' }} onClick={(event) => event.stopPropagation()}>
        <ProductAccessRequestCard scope={scope} onClose={onClose} variant="modal" />
      </div>
    </div>
  );
}

export function ProductAccessEmptyState(props: {
  scope: ProductAccessScope;
  title: string;
  body: string;
}) {
  const { scope, title, body } = props;
  const meta = SCOPE_META[scope];
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '36px 16px 60px' }}>
      <ProductAccessRequestCard scope={scope} variant="inline" />
      <div style={{ textAlign: 'center', marginTop: 24, color: '#4B5563' }}>
        <h1 style={{ margin: '0 0 10px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 28, fontWeight: 800, letterSpacing: '-0.05em', color: '#111111' }}>{title}</h1>
        <p style={{ margin: '0 auto', maxWidth: 620, fontSize: 15, lineHeight: 1.6 }}>{body}</p>
        <a href={meta.homePath} style={{ display: 'inline-block', marginTop: 18, color: '#0562F2', fontWeight: 600, textDecoration: 'none' }}>
          Return to {meta.label}
        </a>
      </div>
    </div>
  );
}

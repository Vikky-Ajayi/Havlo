import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { writeStaleReviewSession } from '../lib/staleReviewAccess';

export function StaleListingsReviewAccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('This review link is missing or incomplete.');
      return;
    }

    let cancelled = false;
    api.staleListingsReviewAccessConsume(token)
      .then((response) => {
        if (cancelled) return;
        writeStaleReviewSession({
          email: response.email,
          token: response.session_token,
          assessmentId: response.assessment_id,
          reference: response.reference,
        });
        navigate(response.redirect_path, { replace: true });
      })
      .catch((consumeError) => {
        if (cancelled) return;
        setError(consumeError instanceof Error ? consumeError.message : 'This review link is no longer valid.');
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, token]);

  if (!error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F6F7', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', border: '3px solid rgba(0,0,0,0.10)', borderTopColor: '#000000', animation: 'sl-review-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <h1 style={{ margin: '0 0 8px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 30, fontWeight: 800, letterSpacing: '-0.05em' }}>Opening review workspace…</h1>
          <p style={{ margin: 0, color: '#555555', fontSize: 15 }}>Checking your secure Stale Listings review link.</p>
          <style>{`@keyframes sl-review-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F6F7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 520, background: '#FFFFFF', borderRadius: 28, border: '1px solid rgba(0,0,0,0.08)', padding: '32px 28px', textAlign: 'center' }}>
        <p style={{ margin: '0 0 10px', color: '#A409D2', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Review link issue</p>
        <h1 style={{ margin: '0 0 12px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 30, fontWeight: 800, letterSpacing: '-0.05em', color: '#111111' }}>Request a fresh review email</h1>
        <p style={{ margin: '0 0 24px', color: '#555555', fontSize: 15, lineHeight: 1.7 }}>{error}</p>
        <a href="mailto:support@heyhavlo.com" style={{ display: 'inline-flex', minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: '0 22px', borderRadius: 12, background: '#000000', color: '#FFFFFF', textDecoration: 'none', fontWeight: 700 }}>
          Contact support
        </a>
      </div>
    </div>
  );
}

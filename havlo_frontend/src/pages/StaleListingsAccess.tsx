import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProductAccessEmptyState } from '../components/product-access/ProductAccessModal';
import { api } from '../lib/api';
import { writeProductAccessSession } from '../lib/productAccess';

export function StaleListingsAccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('This sign-in link is missing or incomplete.');
      return;
    }

    let cancelled = false;
    api.staleListingsAccessConsume(token)
      .then((response) => {
        if (cancelled) return;
        writeProductAccessSession({
          scope: 'stale-listings',
          email: response.email,
          token: response.session_token,
        });
        navigate(response.redirect_path, { replace: true });
      })
      .catch((consumeError) => {
        if (cancelled) return;
        setError(consumeError instanceof Error ? consumeError.message : 'This sign-in link is no longer valid.');
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, token]);

  if (!error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F6F7', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', border: '3px solid rgba(0,0,0,0.10)', borderTopColor: '#000000', animation: 'sl-access-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <h1 style={{ margin: '0 0 8px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 30, fontWeight: 800, letterSpacing: '-0.05em' }}>Signing you in…</h1>
          <p style={{ margin: 0, color: '#555555', fontSize: 15 }}>Checking your Stale Listings access link.</p>
          <style>{`@keyframes sl-access-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F6F7' }}>
      <ProductAccessEmptyState
        scope="stale-listings"
        title="Request a new sign-in link"
        body={error}
      />
    </div>
  );
}

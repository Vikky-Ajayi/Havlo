import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProductAccessEmptyState } from '../components/product-access/ProductAccessModal';
import { api, StaleListingPortalResponse } from '../lib/api';
import { clearProductAccessSession, readProductAccessSession } from '../lib/productAccess';

export function StaleListingsPortal() {
  const navigate = useNavigate();
  const [data, setData] = useState<StaleListingPortalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = readProductAccessSession('stale-listings');
    if (!session) {
      setLoading(false);
      setError('Sign in to view your Stale Listings assessments.');
      return;
    }

    api.staleListingsAccessRecords(session.token)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((recordsError) => {
        clearProductAccessSession('stale-listings');
        setError(recordsError instanceof Error ? recordsError.message : 'Unable to load your assessments right now.');
        setLoading(false);
      });
  }, []);

  const signOut = () => {
    clearProductAccessSession('stale-listings');
    navigate('/stale-listings', { replace: true });
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#F5F6F7' }} />;
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F6F7' }}>
        <ProductAccessEmptyState scope="stale-listings" title="Sign in to your assessments" body={error} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F6F7', fontFamily: 'Inter, sans-serif', color: '#111111' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px 16px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
          <div>
            <p style={{ margin: '0 0 8px', color: '#A409D2', fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>Signed in</p>
            <h1 style={{ margin: '0 0 8px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 34, fontWeight: 800, letterSpacing: '-0.05em' }}>Your Stale Listings assessments</h1>
            <p style={{ margin: 0, color: '#555555', fontSize: 15 }}>{data?.email}</p>
          </div>
          <button type="button" onClick={signOut} style={{ height: 42, borderRadius: 10, border: '1px solid rgba(0,0,0,0.14)', background: '#FFFFFF', padding: '0 18px', fontWeight: 600, cursor: 'pointer' }}>Sign out</button>
        </div>

        {!data?.items.length ? (
          <div style={{ background: '#FFFFFF', borderRadius: 22, border: '1px solid rgba(0,0,0,0.08)', padding: 24 }}>
            <h2 style={{ margin: '0 0 10px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em' }}>No assessments found yet</h2>
            <p style={{ margin: 0, color: '#555555', fontSize: 15, lineHeight: 1.6 }}>If you’ve recently completed checkout, wait a little and try again. Otherwise, start a new stale listing assessment from the landing page.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {data.items.map((item) => (
              <article key={item.assessment_id} style={{ background: '#FFFFFF', borderRadius: 22, border: '1px solid rgba(0,0,0,0.08)', padding: 20, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ margin: '0 0 6px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em' }}>{item.property_address || 'Property not confirmed'}</h2>
                    <p style={{ margin: 0, color: '#555555', fontSize: 14 }}>{item.package.replace(/_/g, ' ')}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ padding: '8px 12px', borderRadius: 999, background: '#F5F5F5', fontSize: 13, fontWeight: 700 }}>{item.payment_status}</span>
                    <span style={{ padding: '8px 12px', borderRadius: 999, background: '#EEF8F1', color: '#0E8E4B', fontSize: 13, fontWeight: 700 }}>{item.report_status}</span>
                  </div>
                </div>
                <div style={{ color: '#666666', fontSize: 13 }}>Reference: {item.reference} · {new Date(item.created_at).toLocaleString()}</div>
                <div>
                  <Link to={`/stale-listings/report/${encodeURIComponent(item.reference)}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, borderRadius: 10, background: '#000000', color: '#FFFFFF', padding: '0 18px', fontWeight: 600, textDecoration: 'none' }}>
                    Open assessment
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

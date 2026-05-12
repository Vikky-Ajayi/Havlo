import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

const PURPLE = '#A409D2';

const StaleListingsLogo = () => (
  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 215, height: 52 }}>
    <svg width="215" height="33" viewBox="0 0 215 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="26" fontFamily='"Plus Jakarta Sans", sans-serif' fontWeight="800" fontSize="26" fill="#313131" letterSpacing="-0.5">StaleListings</text>
    </svg>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, color: '#000', fontWeight: 400, letterSpacing: '-0.32px' }}>By</span>
      <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 13, color: '#313131', letterSpacing: '-0.3px' }}>HAVLO</span>
    </div>
  </div>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 7V5C4 2.79086 5.79086 1 8 1C10.2091 1 12 2.79086 12 5V7M3.2 15H12.8C13.4627 15 14 14.4627 14 13.8V8.2C14 7.53726 13.4627 7 12.8 7H3.2C2.53726 7 2 7.53726 2 8.2V13.8C2 14.4627 2.53726 15 3.2 15Z" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const GreenBadgeIcon = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M60 8L72.5 16.5L87.5 14.5L94 28.5L107 36L105.5 51.5L115 63L105.5 74.5L107 90L94 97.5L87.5 111.5L72.5 109.5L60 118L47.5 109.5L32.5 111.5L26 97.5L13 90L14.5 74.5L5 63L14.5 51.5L13 36L26 28.5L32.5 14.5L47.5 16.5L60 8Z" fill="#D1FAE5" stroke="#6EE7B7" strokeWidth="2"/>
    <path d="M40 62L53 75L80 48" stroke="#059669" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function StaleListingsComplete() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('ref') || 'SL-' + Math.random().toString(36).slice(2, 10).toUpperCase();

  const planName = sessionStorage.getItem('sl_plan_name') || 'Professional Review';
  const planTurnaround = sessionStorage.getItem('sl_plan_turnaround') || '24 hours (priority)';
  const userEmail = sessionStorage.getItem('sl_email') || 'your registered email';

  useEffect(() => {
    if (!reference) return;
    const verify = async () => {
      try {
        await api.staleListingsVerifyPayment(reference);
      } catch {
        // non-fatal
      }
    };
    verify();
  }, [reference]);

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9F9', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');
        @media (max-width: 640px) {
          .sl-c-navbar { padding: 12px 20px !important; }
          .sl-c-stepper { padding: 16px 20px !important; }
          .sl-c-content { padding: 40px 20px !important; }
        }
      `}</style>

      {/* NAVBAR */}
      <header className="sl-c-navbar" style={{ display: 'flex', height: 80, padding: '12px 56px', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F4F4F4', background: '#FFF', backdropFilter: 'blur(5px)', boxSizing: 'border-box', flexShrink: 0 }}>
        <button onClick={() => navigate('/stale-listings')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <StaleListingsLogo />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <LockIcon />
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 16, color: '#000', letterSpacing: '-0.32px' }}>Secure assessment · SSL encrypted</span>
        </div>
      </header>

      {/* STEPPER — all 3 steps purple/completed */}
      <div className="sl-c-stepper" style={{ background: '#fff', borderBottom: '1px solid #F4F4F4', padding: '20px 56px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {[
            { num: 1, label: 'Your property' },
            { num: 2, label: 'Choose Plan' },
            { num: 3, label: 'Completed' },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: PURPLE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: '#fff' }}>{step.num}</span>
                </div>
                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: step.num === 3 ? 600 : 400, fontSize: 14, color: '#000' }}>{step.label}</span>
              </div>
              {i < 2 && <div style={{ width: 80, height: 1, background: PURPLE, margin: '0 20px' }} />}
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="sl-c-content" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 56px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>

          {/* Green badge + heading + description */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
            <GreenBadgeIcon />
            <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 32, color: '#000', letterSpacing: '-0.5px', margin: 0 }}>
              Assessment underway
            </h1>
            <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 16, color: '#444', lineHeight: '150%', margin: 0, maxWidth: 440 }}>
              Your property is now undergoing a detailed market assessment. An experienced property specialist will review your listing, presentation, pricing, and buyer appeal before preparing your report.
            </p>
          </div>

          {/* Summary card */}
          <div style={{ width: '100%', background: '#fff', borderRadius: 20, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden', boxSizing: 'border-box' }}>
            {[
              { label: 'Plan', value: planName },
              { label: 'Report delivery', value: planTurnaround },
              { label: 'Sent to', value: userEmail },
              { label: 'Reference', value: reference },
            ].map((row, i, arr) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '20px 24px',
                borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
              }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, color: '#666' }}>{row.label}</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: '#000', textAlign: 'right', maxWidth: 280 }}>{row.value}</span>
              </div>
            ))}

            {/* Done button inside the card */}
            <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <button
                onClick={() => navigate('/stale-listings')}
                style={{ display: 'flex', height: 52, padding: '16px 48px', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 10, background: '#020202', border: 'none', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: '#fff', cursor: 'pointer', letterSpacing: '-0.32px', margin: '0 auto' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

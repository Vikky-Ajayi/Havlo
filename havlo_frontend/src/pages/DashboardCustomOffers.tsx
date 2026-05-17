import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, CustomOffersAdminItem } from '../lib/api';
import { customOfferStatusLabel, prettyPlatform } from '../lib/customOffers';

const STATUS_OPTIONS = [
  'submitted',
  'awaiting_seller_review',
  'seller_interested',
  'seller_not_interested',
  'closed',
];

export function DashboardCustomOffers() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<CustomOffersAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [proposalStatus, setProposalStatus] = useState('awaiting_seller_review');
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    api.customOffersAdminList(token)
      .then((response) => {
        setItems(response);
        setSelectedId(response[0]?.submission_id || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  const selected = useMemo(
    () => items.find((item) => item.submission_id === selectedId) || null,
    [items, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setProposalStatus(selected.proposal_status || 'awaiting_seller_review');
    setAdminNotes(selected.admin_notes || '');
  }, [selected]);

  if (!user?.is_admin) {
    return (
      <div style={centerWrap}>
        <p style={mutedText}>Access denied.</p>
      </div>
    );
  }

  const handleSave = async () => {
    if (!token || !selected) return;
    setSaving(true);
    setMessage('');
    try {
      const updated = await api.customOffersAdminUpdate(
        selected.submission_id,
        {
          proposal_status: proposalStatus,
          admin_notes: adminNotes,
        },
        token,
      );
      setItems((current) => current.map((item) => (
        item.submission_id === updated.submission_id ? updated : item
      )));
      setMessage('Submission updated.');
      window.setTimeout(() => setMessage(''), 3200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={pageWrap}>
      <style>{`
        .co-admin-layout {
          display: grid;
          grid-template-columns: 360px minmax(0, 1fr);
          gap: 20px;
        }
        .co-admin-panel {
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 18px;
          overflow: hidden;
        }
        .co-admin-list {
          display: grid;
          gap: 0;
        }
        .co-admin-row {
          width: 100%;
          text-align: left;
          border: 0;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          background: #ffffff;
          padding: 16px 18px;
          cursor: pointer;
        }
        .co-admin-row:first-child {
          border-top: 0;
        }
        .co-admin-row.is-active {
          background: #faf5ff;
        }
        .co-admin-detail-grid {
          display: grid;
          gap: 16px;
        }
        .co-admin-card {
          padding: 18px 20px;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
        }
        .co-admin-card:first-child {
          border-top: 0;
        }
        .co-admin-two-col {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px 16px;
        }
        .co-admin-stack {
          display: grid;
          gap: 12px;
        }
        .co-admin-answer {
          padding: 14px 16px;
          border-radius: 14px;
          background: #f7f7f7;
        }
        .co-admin-answer strong {
          display: block;
          margin-bottom: 5px;
          font-size: 13px;
        }
        .co-admin-input,
        .co-admin-select,
        .co-admin-textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 10px;
          background: #ffffff;
          color: #111111;
          font-size: 14px;
          padding: 12px 14px;
        }
        .co-admin-textarea {
          min-height: 140px;
          resize: vertical;
          line-height: 1.5;
        }
        @media (max-width: 980px) {
          .co-admin-layout {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 680px) {
          .co-admin-two-col {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={headerWrap}>
        <div>
          <div style={eyebrowStyle}>ADMIN</div>
          <h1 style={headingStyle}>Custom Offers</h1>
          <p style={subheadingStyle}>Review paid submissions, update buyer-facing statuses, and keep internal notes for manual seller outreach.</p>
        </div>
      </div>

      {loading ? (
        <div style={centerWrap}>
          <p style={mutedText}>Loading submissions...</p>
        </div>
      ) : null}

      {!loading ? (
        <div className="co-admin-layout">
          <section className="co-admin-panel">
            <div style={panelHeaderStyle}>
              <strong style={panelTitleStyle}>Submissions</strong>
              <span style={pillStyle}>{items.length}</span>
            </div>
            <div className="co-admin-list">
              {items.map((item) => (
                <button
                  key={item.submission_id}
                  type="button"
                  className={`co-admin-row${item.submission_id === selectedId ? ' is-active' : ''}`}
                  onClick={() => setSelectedId(item.submission_id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>{item.reference}</div>
                      <div style={{ marginTop: 4, color: '#444444', fontSize: 13, lineHeight: 1.45 }}>{item.buyer_name || item.buyer_email}</div>
                    </div>
                    <div style={statusPill(item.proposal_status)}>{customOfferStatusLabel(item.proposal_status)}</div>
                  </div>
                  <div style={{ marginTop: 10, color: '#666666', fontSize: 12, lineHeight: 1.45 }}>
                    {prettyPlatform(item.listing_platform)} · {item.plan_name} · Payment {item.payment_status}
                  </div>
                </button>
              ))}
              {!items.length ? (
                <div style={{ padding: 20, color: '#666666', fontSize: 14 }}>No custom-offers submissions yet.</div>
              ) : null}
            </div>
          </section>

          <section className="co-admin-panel">
            {!selected ? (
              <div style={{ padding: 24, color: '#666666', fontSize: 14 }}>Select a submission to review.</div>
            ) : (
              <div className="co-admin-detail-grid">
                <div className="co-admin-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                      <div style={eyebrowStyle}>{selected.reference}</div>
                      <h2 style={{ margin: '6px 0 6px', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 28, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1.08 }}>
                        {selected.property.address || selected.property.title || 'Submitted property'}
                      </h2>
                      <p style={{ margin: 0, color: '#444444', fontSize: 14, lineHeight: 1.5 }}>{selected.listing_url}</p>
                    </div>
                    <a
                      href={`/custom-offers/status/${encodeURIComponent(selected.reference)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={blackButtonLink}
                    >
                      Open public status
                    </a>
                  </div>
                </div>

                <div className="co-admin-card">
                  <strong style={panelTitleStyle}>Submission Details</strong>
                  <div className="co-admin-two-col" style={{ marginTop: 14 }}>
                    <MetaItem label="Buyer">{selected.buyer_name || 'Not provided'}</MetaItem>
                    <MetaItem label="Email">{selected.buyer_email || 'Not provided'}</MetaItem>
                    <MetaItem label="Phone">{selected.buyer_phone || 'Not provided'}</MetaItem>
                    <MetaItem label="Platform">{prettyPlatform(selected.listing_platform)}</MetaItem>
                    <MetaItem label="Plan">{selected.plan_name}</MetaItem>
                    <MetaItem label="Payment">{selected.payment_status}</MetaItem>
                    <MetaItem label="Bedrooms">{selected.property.bedrooms || 'Not provided'}</MetaItem>
                    <MetaItem label="Bathrooms">{selected.property.bathrooms || 'Not provided'}</MetaItem>
                  </div>
                </div>

                <div className="co-admin-card">
                  <strong style={panelTitleStyle}>Proposal Answers</strong>
                  <div className="co-admin-stack" style={{ marginTop: 14 }}>
                    <AnswerCard question="What interests you most about this property?">{selected.answers.property_interest || 'Not provided'}</AnswerCard>
                    <AnswerCard question="What type of proposal would you like to submit?">{selected.answers.proposal_type || 'Not provided'}</AnswerCard>
                    <AnswerCard question="What is your proposed offer or arrangement?">{selected.answers.proposed_offer || 'Not provided'}</AnswerCard>
                    <AnswerCard question="Why should the seller consider your proposal?">{selected.answers.seller_consideration || 'Not provided'}</AnswerCard>
                    <AnswerCard question="Buyer position">{selected.answers.buyer_status || 'Not provided'}</AnswerCard>
                    <AnswerCard question="Proceed timing">{selected.answers.proceed_timing || 'Not provided'}</AnswerCard>
                    <AnswerCard question="Presentation style">{selected.answers.presentation_style || 'Not provided'}</AnswerCard>
                  </div>
                </div>

                <div className="co-admin-card">
                  <strong style={panelTitleStyle}>Internal Review</strong>
                  <div className="co-admin-two-col" style={{ marginTop: 14 }}>
                    <div>
                      <label style={labelStyle}>Buyer-facing status</label>
                      <select className="co-admin-select" value={proposalStatus} onChange={(event) => setProposalStatus(event.target.value)}>
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {customOfferStatusLabel(option)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Selected flexible terms</label>
                      <div className="co-admin-input" style={{ minHeight: 46, display: 'flex', alignItems: 'center' }}>
                        {selected.answers.flexible_terms.length ? selected.answers.flexible_terms.join(', ') : 'None selected'}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <label style={labelStyle}>Admin notes</label>
                    <textarea
                      className="co-admin-textarea"
                      value={adminNotes}
                      onChange={(event) => setAdminNotes(event.target.value)}
                      placeholder="Add internal notes about outreach, seller responses, or follow-up actions"
                    />
                  </div>
                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ color: message ? '#111111' : '#666666', fontSize: 14 }}>{message || 'Saving a new status here will trigger the buyer status-update email.'}</div>
                    <button type="button" onClick={handleSave} style={blackButton} disabled={saving}>
                      {saving ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function AnswerCard({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <div className="co-admin-answer">
      <strong>{question}</strong>
      <div style={{ color: '#333333', fontSize: 14, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ color: '#111111', fontSize: 14, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

const pageWrap: React.CSSProperties = {
  minHeight: '100vh',
  background: '#F5F6F7',
  padding: '28px 18px 48px',
};

const headerWrap: React.CSSProperties = {
  maxWidth: 1320,
  margin: '0 auto 22px',
};

const centerWrap: React.CSSProperties = {
  minHeight: '60vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const mutedText: React.CSSProperties = {
  margin: 0,
  color: '#666666',
  fontSize: 15,
};

const eyebrowStyle: React.CSSProperties = {
  color: '#A409D2',
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: '-0.01em',
};

const headingStyle: React.CSSProperties = {
  margin: '6px 0 6px',
  fontFamily: '"Plus Jakarta Sans", sans-serif',
  fontSize: 38,
  fontWeight: 800,
  letterSpacing: '-0.05em',
  lineHeight: 1.02,
};

const subheadingStyle: React.CSSProperties = {
  margin: 0,
  color: '#444444',
  fontSize: 15,
  lineHeight: 1.55,
  maxWidth: 760,
};

const panelHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '18px 20px',
};

const panelTitleStyle: React.CSSProperties = {
  color: '#111111',
  fontSize: 16,
  fontWeight: 800,
};

const pillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 28,
  height: 28,
  borderRadius: 999,
  background: '#111111',
  color: '#FFFFFF',
  fontSize: 12,
  fontWeight: 700,
  padding: '0 10px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  color: '#666666',
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const blackButton: React.CSSProperties = {
  height: 44,
  border: 0,
  borderRadius: 8,
  background: '#000000',
  color: '#FFFFFF',
  fontSize: 15,
  fontWeight: 600,
  padding: '0 20px',
  cursor: 'pointer',
};

const blackButtonLink: React.CSSProperties = {
  ...blackButton,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
};

function statusPill(status: string): React.CSSProperties {
  const colors: Record<string, { bg: string; text: string }> = {
    submitted: { bg: '#E5E7EB', text: '#111827' },
    awaiting_seller_review: { bg: '#DBEAFE', text: '#1D4ED8' },
    seller_interested: { bg: '#DCFCE7', text: '#166534' },
    seller_not_interested: { bg: '#FEE2E2', text: '#991B1B' },
    closed: { bg: '#F3F4F6', text: '#374151' },
  };
  const active = colors[status] || colors.submitted;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    background: active.bg,
    color: active.text,
    fontSize: 12,
    fontWeight: 700,
    padding: '7px 10px',
    whiteSpace: 'nowrap',
  };
}

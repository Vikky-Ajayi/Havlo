import { useState, type FormEvent } from 'react';
import { addReportFigures } from './api';
import type { ProspectReport, ReportFactor } from './types';

// The two "check with your agent" factors whose figures only the agent can
// see. The customer types them in and that factor is rewritten from them
// (app/services/report_owner_figures.py; keep the field names in step).
export const OWNER_FIGURE_FORMS: Record<string, {
  intro: string;
  fields: { name: string; label: string; kind: 'count' | 'text'; placeholder?: string }[];
}> = {
  engagement: {
    intro: 'Your agent can send these from their Rightmove and Zoopla dashboards.',
    fields: [
      { name: 'views_total', label: 'Total views since the listing went live', kind: 'count' },
      { name: 'views_14d', label: 'Views in the last 14 days', kind: 'count' },
      { name: 'enquiries', label: 'Enquiries (emails and calls)', kind: 'count' },
      { name: 'viewings_booked', label: 'Viewings booked', kind: 'count' },
    ],
  },
  viewing_conversion: {
    intro: 'Ask your agent for these, and for the feedback from each viewing.',
    fields: [
      { name: 'viewings', label: 'Viewings so far', kind: 'count' },
      { name: 'second_viewings', label: 'Second viewings', kind: 'count' },
      { name: 'offers', label: 'Offers received', kind: 'count' },
      { name: 'feedback', label: 'Feedback from viewings', kind: 'text', placeholder: 'Paste what your agent sent you, for example “liked the garden, felt the kitchen needs updating”' },
    ],
  },
};

type Access = { token?: string; code?: string };

const shortDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/** The "Add your agent's figures" button and form on a factor card. Shown
 * only on the two factors above, on a paid, finished report. */
export const FactorFigures = ({
  factor,
  report,
  access,
  agent = false,
  onUpdated,
}: {
  factor: ReportFactor;
  report: ProspectReport;
  access: Access;
  agent?: boolean;
  onUpdated: (report: ProspectReport) => void;
}) => {
  const form = OWNER_FIGURE_FORMS[factor.key || ''];
  const given = report.report_data?._owner_figures?.[factor.key || '']?.figures || {};
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(given).map(([k, v]) => [k, String(v ?? '')])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!form || report.payment_status !== 'completed' || report.report_expanded === false) return null;
  const updated = factor.owner_figures?.updated_at;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const figures: Record<string, string | number> = {};
    for (const field of form.fields) {
      const raw = (values[field.name] || '').trim();
      if (!raw) continue;
      if (field.kind === 'text') {
        figures[field.name] = raw;
      } else {
        const n = Number(raw.replace(/,/g, ''));
        if (!Number.isInteger(n) || n < 0) {
          setError(`Please enter a whole number for “${field.label}”.`);
          return;
        }
        figures[field.name] = n;
      }
    }
    if (!Object.keys(figures).length) {
      setError('Please enter at least one of the figures.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const next = await addReportFigures({
        token: access.token, property_code: access.token ? undefined : access.code,
        factor: factor.key as 'engagement' | 'viewing_conversion', figures,
      });
      setOpen(false);
      onUpdated(next);
    } catch (err) {
      const message = (err as Error).message;
      setError(message && message !== 'request_failed' ? message : 'We couldn’t update this section just now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="slw-figs slw-noprint">
      {updated && !open && (
        <p className="slw-figs-done">Updated from {agent ? 'the' : 'your agent’s'} figures{shortDate(updated) ? ` on ${shortDate(updated)}` : ''}.</p>
      )}
      {!open ? (
        <button type="button" className="slw-figs-open" onClick={() => setOpen(true)}>
          {updated ? 'Update the figures' : agent ? 'Add the figures' : 'Add your agent’s figures'}
          <span>{updated ? 'and we’ll rewrite this section again' : 'and we’ll rewrite this section from them'}</span>
        </button>
      ) : (
        <form className="slw-figs-form" onSubmit={submit}>
          <p className="slw-figs-intro">{form.intro} Fill in the ones you have.</p>
          <div className="slw-figs-grid">
            {form.fields.map((field) => (
              <label key={field.name} className={field.kind === 'text' ? 'slw-figs-wide' : undefined}>
                <span>{field.label}</span>
                {field.kind === 'text' ? (
                  <textarea rows={3} maxLength={2000} placeholder={field.placeholder} value={values[field.name] || ''}
                    onChange={(e) => setValues({ ...values, [field.name]: e.target.value })} />
                ) : (
                  <input type="text" inputMode="numeric" autoComplete="off" value={values[field.name] || ''}
                    onChange={(e) => setValues({ ...values, [field.name]: e.target.value })} />
                )}
              </label>
            ))}
          </div>
          {error && <p className="slw-error">{error}</p>}
          <div className="slw-figs-actions">
            <button type="submit" className="slw-btn-black" disabled={busy}>
              {busy ? 'Rewriting this section…' : 'Update this section'}
            </button>
            <button type="button" className="slw-figs-cancel" onClick={() => { setOpen(false); setError(''); }} disabled={busy}>
              Cancel
            </button>
          </div>
          {busy && <p className="slw-figs-wait">This takes about 20 seconds.</p>}
        </form>
      )}
    </div>
  );
};

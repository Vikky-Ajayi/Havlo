import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getMonitorDashboard,
  getMonitorReportLink,
  setMonitorChecklistItem,
  shareMonitorDashboard,
} from './api';
import {
  formatGbp,
  type MonitorChecklistItem,
  type MonitorDashboardData,
  type MonitorEvent,
  type MonitorNearbyListing,
  type MonitorPulse,
} from './types';
import { CheckIconGreen, Footer, Header, Spinner, WizardStyles } from './StaleProspectWizard';

// /m/:token -- the 90-day monitoring dashboard that comes with a purchased
// report (app/services/listing_monitor.py). The link is texted once after
// purchase and is also on the report page. A share link (read_only) shows
// the same page without the checklist controls.

const fmtDate = (iso?: string | null, withYear = false) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
};

const timeAgo = (iso?: string | null) => {
  if (!iso) return '';
  const hours = Math.max(0, (Date.now() - new Date(iso).getTime()) / 36e5);
  if (hours < 1) return 'less than an hour ago';
  if (hours < 24) return `${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const signedGbp = (n: number) => `${n < 0 ? '−' : '+'}${formatGbp(Math.abs(n))}`;

type Tone = 'good' | 'bad' | 'info' | 'neutral' | 'you';

interface EventView {
  title: string;
  detail: string;
  tone: Tone;
  url?: string;
}

const listingEventView = (e: MonitorEvent): EventView => {
  const d = e.data || {};
  switch (e.kind) {
    case 'price_reduced':
    case 'price_increased':
      return {
        title: e.kind === 'price_reduced' ? 'Asking price reduced' : 'Asking price increased',
        detail: `${formatGbp(d.from)} → ${formatGbp(d.to)} (${signedGbp(d.change)}, ${d.percent > 0 ? '+' : '−'}${Math.abs(d.percent)}%)`,
        tone: 'info',
      };
    case 'price_wording_changed':
      return { title: 'Price wording changed', detail: `${d.from || 'None'} → ${d.to || 'None'}`, tone: 'info' };
    case 'photos_updated': {
      const parts = [
        d.added ? `${d.added} added` : '',
        d.removed ? `${d.removed} removed` : '',
        d.new_lead_photo ? 'new lead photo' : '',
        `${d.total} in total`,
      ].filter(Boolean);
      return { title: 'Photos updated', detail: parts.join(' · '), tone: 'good' };
    }
    case 'floorplan_added':
      return { title: 'Floorplan added', detail: 'Buyers can now see the layout before booking a viewing.', tone: 'good' };
    case 'virtual_tour_added':
      return { title: 'Video or virtual tour added', detail: 'Listings with tours tend to get more serious enquiries.', tone: 'good' };
    case 'brochure_added':
      return { title: 'Brochure added', detail: '', tone: 'good' };
    case 'description_updated':
      return { title: 'Description rewritten', detail: d.words_after ? `${d.words_after} words` : '', tone: 'good' };
    case 'features_updated': {
      const added: string[] = d.added || [];
      return { title: 'Key features updated', detail: added.length ? `New: ${added.join(' · ')}` : 'Wording changed', tone: 'good' };
    }
    case 'featured_added':
      return { title: 'Now a featured listing', detail: 'It shows higher up Rightmove search results.', tone: 'good' };
    case 'premium_added':
      return { title: 'Premium listing placement added', detail: 'Larger, more eye-catching in search results.', tone: 'good' };
    case 'agent_changed':
      return { title: 'Estate agent changed', detail: [d.from, d.to].filter(Boolean).join(' → '), tone: 'info' };
    case 'status_under_offer':
      return { title: 'Under offer', detail: 'Your property is showing as under offer on Rightmove.', tone: 'good' };
    case 'status_sold_stc':
      return { title: 'Sold subject to contract', detail: 'Your property is showing as sold STC on Rightmove.', tone: 'good' };
    case 'listing_removed':
      return { title: 'Listing taken off Rightmove', detail: "We'll keep checking in case it comes back.", tone: 'bad' };
    case 'listing_relisted':
      return { title: 'Back on Rightmove', detail: '', tone: 'info' };
    case 'back_on_market':
      return { title: 'Back on the market', detail: 'The sale fell through or the offer was withdrawn.', tone: 'bad' };
    case 'checklist_done':
      return { title: `You marked “${d.title}” as done`, detail: '', tone: 'you' };
    default:
      return { title: e.kind.replace(/_/g, ' '), detail: '', tone: 'neutral' };
  }
};

const homeLine = (d: Record<string, any>) =>
  [d.bedrooms ? `${d.bedrooms} bed` : '', d.type, d.distance != null ? `${d.distance} mi away` : ''].filter(Boolean).join(' · ');

const nearbyEventView = (e: MonitorEvent): EventView => {
  const d = e.data || {};
  switch (e.kind) {
    case 'nearby_new':
      return { title: `New listing: ${d.address}`, detail: [formatGbp(d.price), homeLine(d)].filter(Boolean).join(' · '), tone: 'info', url: d.url };
    case 'nearby_reduced':
      return { title: `Price cut: ${d.address}`, detail: `${formatGbp(d.from)} → ${formatGbp(d.price)} · ${homeLine(d)}`, tone: 'info', url: d.url };
    case 'nearby_under_offer':
      return { title: `Under offer: ${d.address}`, detail: [formatGbp(d.price), homeLine(d)].filter(Boolean).join(' · '), tone: 'good', url: d.url };
    case 'nearby_sold_stc':
      return { title: `Sold STC: ${d.address}`, detail: [formatGbp(d.price), homeLine(d)].filter(Boolean).join(' · '), tone: 'good', url: d.url };
    case 'nearby_sold':
      return { title: `Sold price recorded: ${d.address}`, detail: `${formatGbp(d.price)} · ${d.type || 'Home'} · completed ${fmtDate(d.date, true)}`, tone: 'neutral' };
    default:
      return { title: e.kind.replace(/_/g, ' '), detail: '', tone: 'neutral' };
  }
};

const eventView = (e: MonitorEvent) => (e.scope === 'nearby' ? nearbyEventView(e) : listingEventView(e));

const EventRow = ({ event }: { event: MonitorEvent; key?: string }) => {
  const v = eventView(event);
  const body = (
    <>
      <span className={`lmd-dot lmd-tone-${v.tone}`} aria-hidden="true" />
      <div className="lmd-event-text">
        <b>{v.title}</b>
        {v.detail && <span>{v.detail}</span>}
      </div>
      <time>{fmtDate(event.at)}</time>
    </>
  );
  return (
    <li className="lmd-event">
      {v.url ? <a href={v.url} target="_blank" rel="noreferrer">{body}</a> : <div>{body}</div>}
    </li>
  );
};

const STATUS_CLASS: Record<string, string> = {
  on_market: 'lmd-pill',
  under_offer: 'lmd-pill lmd-pill-good',
  sold_stc: 'lmd-pill lmd-pill-good',
  removed: 'lmd-pill lmd-pill-bad',
};

const PulseStat = ({ label, now, start, money }: { label: string; now?: number | null; start?: number | null; money?: boolean }) => {
  const change = now != null && start != null ? now - start : 0;
  return (
    <div className="lmd-pulse-stat">
      <span>{label}</span>
      <b>{now == null ? '—' : money ? formatGbp(now) : now}</b>
      {change !== 0 && (
        <small>{money ? signedGbp(change) : `${change > 0 ? '+' : ''}${change}`} since you started</small>
      )}
    </div>
  );
};

const NearbyCard = ({ home }: { home: MonitorNearbyListing; key?: string }) => (
  <li className="lmd-home">
    <a href={home.url} target="_blank" rel="noreferrer">
      <div className="lmd-home-image" style={home.image ? { backgroundImage: `url(${home.image})` } : undefined}>
        <div className="lmd-home-tags">
          {home.similar && <span className="lmd-tag lmd-tag-purple">Similar to yours</span>}
          {home.status === 'sold_stc' && <span className="lmd-tag lmd-tag-green">Sold STC</span>}
          {home.status === 'under_offer' && <span className="lmd-tag lmd-tag-green">Under offer</span>}
          {home.status === 'on_market' && home.update === 'price_reduced' && <span className="lmd-tag">Reduced</span>}
        </div>
      </div>
      <div className="lmd-home-body">
        <b>{home.price ? formatGbp(home.price) : 'Price on request'}</b>
        <span>{home.address}</span>
        <small>{homeLine(home)}</small>
      </div>
    </a>
  </li>
);

const ChecklistRow = ({
  item,
  readOnly,
  busy,
  onToggle,
}: {
  key?: string;
  item: MonitorChecklistItem;
  readOnly: boolean;
  busy: boolean;
  onToggle: (item: MonitorChecklistItem) => void;
}) => {
  const locked = readOnly || item.done_by === 'detected';
  return (
    <li className={`lmd-check ${item.done ? 'lmd-check-done' : ''}`}>
      <button
        type="button"
        className="lmd-checkbox"
        aria-pressed={item.done}
        aria-label={item.done ? `Mark “${item.title}” as not done` : `Mark “${item.title}” as done`}
        disabled={locked || busy}
        onClick={() => onToggle(item)}
      >
        {item.done && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5l3 3 6-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}
      </button>
      <div className="lmd-check-text">
        <div className="lmd-check-title">
          <b>{item.title}</b>
          {item.priority && <span className={`lmd-priority lmd-priority-${item.priority.toLowerCase()}`}>{item.priority}</span>}
        </div>
        {item.detail && <p>{item.detail}</p>}
        <small>
          {item.done_by === 'detected' && <>Spotted on your listing · {fmtDate(item.done_at)}</>}
          {item.done_by === 'you' && <>Marked done by you · {fmtDate(item.done_at)}</>}
          {!item.done && (item.auto ? "We'll tick this automatically when it shows on Rightmove" : 'Tick when done')}
        </small>
      </div>
    </li>
  );
};

const SECTIONS = [
  ['updates', 'Updates'],
  ['checklist', 'Your changes'],
  ['plan', '90-day plan'],
  ['nearby', 'Nearby'],
] as const;

export const MonitorDashboard = () => {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<MonitorDashboardData | null>(null);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [showAllNearby, setShowAllNearby] = useState(false);

  useEffect(() => {
    document.body.classList.add('slw-prospect-active');
    return () => document.body.classList.remove('slw-prospect-active');
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMonitorDashboard(token)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err: Error) => { if (!cancelled) setError(err.message === 'request_failed' ? 'Something went wrong loading your dashboard.' : err.message); });
    return () => { cancelled = true; };
  }, [token]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3500);
  };

  const toggle = useCallback(async (item: MonitorChecklistItem) => {
    setBusyKey(item.key);
    try {
      setData(await setMonitorChecklistItem(token, item.key, !item.done));
    } catch (err) {
      flash((err as Error).message || "That didn't save. Please try again.");
    } finally {
      setBusyKey(null);
    }
  }, [token]);

  const share = async () => {
    try {
      const { url } = await shareMonitorDashboard(token);
      const text = data?.audience === 'agent'
        ? 'The 90-day dashboard for your property, from Havlo'
        : 'My 90-day listing dashboard from Havlo';
      if (navigator.share) {
        await navigator.share({ title: 'Havlo listing dashboard', text, url }).catch(() => undefined);
      } else {
        await navigator.clipboard.writeText(url);
        flash('View-only link copied. Paste it into an email or message.');
      }
    } catch {
      flash("Couldn't create a share link. Please try again.");
    }
  };

  const openReport = async () => {
    try {
      const { url } = await getMonitorReportLink(token);
      navigate(url);
    } catch {
      flash("Couldn't open the report. Please try again.");
    }
  };

  const nearbyListings = useMemo(() => {
    const all = data?.nearby.listings || [];
    return showAllNearby ? all : all.slice(0, 6);
  }, [data, showAllNearby]);

  if (error || !data) {
    return (
      <div className="slw-page">
        <Header />
        <div className="slw-shell">
          <main className="slw-main lmd-center">
            {error ? (
              <>
                <h1 className="lmd-h1">We couldn't open this dashboard</h1>
                <p className="lmd-muted">{error}</p>
              </>
            ) : (
              <>
                <Spinner />
                <p className="lmd-muted">Loading your dashboard…</p>
              </>
            )}
          </main>
        </div>
        <Footer />
        <WizardStyles />
        <DashboardStyles />
      </div>
    );
  }

  const h = data.headline;
  const progress = Math.round((100 * data.day) / data.total_days);
  const doneCount = data.checklist.filter((c) => c.done).length;
  const nextKey = data.checklist.find((c) => !c.done && c.title === data.next_step.title);
  const pulseNow: MonitorPulse | null = data.nearby.pulse_now;
  const pulseStart: MonitorPulse | null = data.nearby.pulse_start;

  return (
    <div className="slw-page">
      <Header />
      <div className="slw-shell">
        <main className="slw-main lmd">
          {/* Hero */}
          <section className="lmd-hero">
            <div className="lmd-hero-image" style={data.property.image ? { backgroundImage: `url(${data.property.image})` } : undefined} />
            <div className="lmd-hero-text">
              <p className="lmd-eyebrow">
                {data.read_only ? 'Shared listing dashboard' : data.contact_first_name ? `${data.contact_first_name}'s 90-day listing dashboard` : 'Your 90-day listing dashboard'}
              </p>
              <h1 className="lmd-h1">{data.property.address}</h1>
              <p className="lmd-muted">
                {[data.property.agent, data.property.agent_branch].filter(Boolean).join(' · ')}
                {data.property.rightmove_url && (
                  <> · <a href={data.property.rightmove_url} target="_blank" rel="noreferrer">View on Rightmove</a></>
                )}
              </p>
              <div className="lmd-progress" aria-label={`Day ${data.day} of ${data.total_days}`}>
                <div className="lmd-progress-bar"><span style={{ width: `${progress}%` }} /></div>
                <div className="lmd-progress-labels">
                  <b>{data.ended ? 'Your 90 days are complete' : `Day ${data.day} of ${data.total_days}`}</b>
                  <span>{data.last_checked_at ? `Listing checked ${timeAgo(data.last_checked_at)}` : 'First check under way'}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Headline figures */}
          <section className="lmd-stats">
            <div className="lmd-stat">
              <span>Status</span>
              <b><span className={STATUS_CLASS[h.status] || 'lmd-pill'}>{h.status_label}</span></b>
            </div>
            <div className="lmd-stat">
              <span>Asking price</span>
              <b>{h.price_now ? formatGbp(h.price_now) : h.price_text || '—'}</b>
              {h.price_change !== 0 ? <small>{signedGbp(h.price_change)} since day 1</small> : h.price_qualifier ? <small>{h.price_qualifier}</small> : null}
            </div>
            <div className="lmd-stat">
              <span>Days on the market</span>
              <b>{h.days_on_market ?? '—'}</b>
            </div>
            <div className="lmd-stat">
              <span>Changes made</span>
              <b>{h.actions_done}<em>/{h.actions_total}</em></b>
              <small>{h.listing_changes} spotted on Rightmove</small>
            </div>
          </section>

          {data.summary && (
            <section className="lmd-card lmd-summary">
              <h2>Your 90-day summary</h2>
              <ul>
                <li><b>{data.summary.price_start && data.summary.price_end ? `${formatGbp(data.summary.price_start)} → ${formatGbp(data.summary.price_end)}` : '—'}</b><span>Asking price</span></li>
                <li><b>{data.summary.listing_changes}</b><span>Listing changes spotted</span></li>
                <li><b>{data.summary.actions_done}/{data.summary.actions_total}</b><span>Checklist items done</span></li>
                <li><b>{data.summary.nearby_agreed}</b><span>Homes nearby went under offer or sold STC</span></li>
                <li><b>{data.summary.nearby_new}</b><span>New listings nearby</span></li>
                <li><b>{data.summary.nearby_sold}</b><span>Sold prices recorded nearby</span></li>
              </ul>
              <p className="lmd-muted">Monitoring has finished; this dashboard stays here for you to look back on.</p>
            </section>
          )}

          {/* Next best step */}
          <section className="lmd-card lmd-next">
            <p className="lmd-eyebrow">Your next best step</p>
            <h2>{data.next_step.title}</h2>
            <p>{data.next_step.detail}</p>
            {!data.read_only && nextKey && (
              <button type="button" className="slw-btn-black lmd-btn-inline" disabled={busyKey === nextKey.key} onClick={() => toggle(nextKey)}>
                Mark as done
              </button>
            )}
          </section>

          {data.alerts.length > 0 && (
            <section className="lmd-card lmd-alerts">
              <h2>This week</h2>
              <ul className="lmd-events">{data.alerts.map((e) => <EventRow key={e.id} event={e} />)}</ul>
            </section>
          )}

          <nav className="lmd-tabs" aria-label="Dashboard sections">
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }}>{label}</a>
            ))}
          </nav>

          {/* Updates to the listing */}
          <section id="updates" className="lmd-section">
            <h2 className="lmd-h2">Recent updates to your listing</h2>
            <p className="lmd-muted">We check your Rightmove listing every day: price, photos, floorplan, video tour, description, key features and status.</p>
            {data.timeline.length > 0 ? (
              <ul className="lmd-events lmd-card">{data.timeline.map((e) => <EventRow key={e.id} event={e} />)}</ul>
            ) : (
              <div className="lmd-card lmd-empty">No changes to the listing yet. They'll appear here as soon as we spot them.</div>
            )}
            {data.baseline && (
              <p className="lmd-baseline">
                When monitoring started ({fmtDate(data.started_at, true)}): {formatGbp(data.baseline.price)} · {data.baseline.image_count ?? 0} photos ·{' '}
                {data.baseline.floorplans ? 'floorplan' : 'no floorplan'} · {data.baseline.virtual_tours ? 'video tour' : 'no video tour'}
                {data.baseline.featured ? ' · featured listing' : ''}
              </p>
            )}
          </section>

          {/* Checklist */}
          <section id="checklist" className="lmd-section">
            <div className="lmd-section-head">
              <h2 className="lmd-h2">Changes you've made</h2>
              <span className="lmd-count">{doneCount} of {data.checklist.length} done</span>
            </div>
            <p className="lmd-muted">
              From your report's recommendations. Anything we can see on Rightmove is ticked automatically; tick the rest yourself when it's done.
            </p>
            <div className="lmd-progress-bar lmd-progress-thin"><span style={{ width: `${data.checklist.length ? (100 * doneCount) / data.checklist.length : 0}%` }} /></div>
            <ul className="lmd-checklist lmd-card">
              {data.checklist.map((item) => (
                <ChecklistRow key={item.key} item={item} readOnly={data.read_only} busy={busyKey === item.key} onToggle={toggle} />
              ))}
            </ul>
          </section>

          {/* 90-day plan */}
          <section id="plan" className="lmd-section">
            <h2 className="lmd-h2">Your 90-day plan</h2>
            <p className="lmd-muted">Week {data.plan.current_week} of 13.</p>
            <div className="lmd-phases">
              {data.plan.phases.map((phase) => (
                <div key={phase.title} className={`lmd-card lmd-phase ${phase.current ? 'lmd-phase-current' : ''}`}>
                  <div className="lmd-phase-head">
                    <span>Days {phase.start_day}–{phase.end_day}</span>
                    {phase.current && !data.ended && <em>You are here</em>}
                  </div>
                  <h3>{phase.title}</h3>
                  <ol className="lmd-weeks">
                    {phase.weeks.map((w) => (
                      <li key={w.week} className={w.week === data.plan.current_week && !data.ended ? 'lmd-week-now' : w.week < data.plan.current_week ? 'lmd-week-past' : ''}>
                        <span>Week {w.week}</span>{w.title}
                      </li>
                    ))}
                  </ol>
                  {phase.tasks.length > 0 && (
                    <ul className="lmd-tasks">
                      {phase.tasks.map((t) => (
                        <li key={t.key} className={t.done ? 'lmd-task-done' : ''}>{t.done ? <CheckIconGreen /> : <span className="lmd-task-dot" />}{t.title}</li>
                      ))}
                    </ul>
                  )}
                  {phase.notes && phase.notes.length > 0 && (
                    <ul className="lmd-notes">{phase.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Nearby */}
          <section id="nearby" className="lmd-section">
            <h2 className="lmd-h2">What's happening nearby</h2>
            <p className="lmd-muted">
              {data.nearby.checked_at
                ? `Homes for sale within ${data.nearby.radius === 1 ? 'a mile' : 'half a mile'}, checked weekly (last ${timeAgo(data.nearby.checked_at)}).`
                : "We're gathering the homes for sale around you. This appears after the first weekly check."}
            </p>
            {pulseNow && (
              <div className="lmd-pulse lmd-card">
                <PulseStat label="For sale" now={pulseNow.for_sale} start={pulseStart?.for_sale} />
                <PulseStat label="Under offer or sold STC" now={pulseNow.under_offer_or_sold} start={pulseStart?.under_offer_or_sold} />
                <PulseStat label="Reduced" now={pulseNow.reduced} start={pulseStart?.reduced} />
                <PulseStat label="Median asking price" now={pulseNow.median_price} start={pulseStart?.median_price} money />
              </div>
            )}
            {data.nearby.events.length > 0 && (
              <>
                <h3 className="lmd-h3">Changes since you started</h3>
                <ul className="lmd-events lmd-card">{data.nearby.events.slice(0, 12).map((e) => <EventRow key={e.id} event={e} />)}</ul>
              </>
            )}
            {nearbyListings.length > 0 && (
              <>
                <h3 className="lmd-h3">Homes for sale near you</h3>
                <ul className="lmd-homes">{nearbyListings.map((home) => <NearbyCard key={home.id} home={home} />)}</ul>
                {!showAllNearby && data.nearby.listings.length > 6 && (
                  <button type="button" className="slw-btn-outline lmd-btn-inline" onClick={() => setShowAllNearby(true)}>Show more</button>
                )}
              </>
            )}
            {data.nearby.sold.length > 0 && (
              <>
                <h3 className="lmd-h3">Recent sold prices in your postcode sector</h3>
                <div className="lmd-card lmd-sold">
                  <table>
                    <tbody>
                      {data.nearby.sold.slice(0, 8).map((s) => (
                        <tr key={s.id}>
                          <td>{s.address}<small>{s.type}</small></td>
                          <td><b>{formatGbp(s.price)}</b><small>{fmtDate(s.date, true)}</small></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="lmd-attribution">Contains HM Land Registry data © Crown copyright and database right. Licensed under the Open Government Licence v3.0.</p>
                </div>
              </>
            )}
          </section>

          {/* Actions */}
          {!data.read_only && (
            <section className="lmd-section lmd-actions">
              <button type="button" className="slw-btn-black" onClick={openReport}>View your full report</button>
              <button type="button" className="slw-btn-outline" onClick={share}>
                {data.audience === 'agent' ? 'Share with your vendor' : 'Share with your agent'}
              </button>
              <a className="slw-btn-outline lmd-link-btn" href="/contact-us">Book a call with Havlo</a>
              {data.audience !== 'agent' && (
                <a className="lmd-sell-faster" href="/sell-your-property">
                  <b>Want more buyers seeing it?</b> Sell Faster (Havlo Relaunch™) takes your property to buyers beyond the portals. Find out more →
                </a>
              )}
            </section>
          )}
          {notice && <div className="lmd-toast" role="status">{notice}</div>}
        </main>
      </div>
      <Footer />
      <WizardStyles />
      <DashboardStyles />
    </div>
  );
};

const DashboardStyles = () => (
  <style>{`
    .lmd{padding:32px 0 72px;max-width:980px;margin:0 auto}
    .lmd-center{text-align:center;padding:96px 0}
    .lmd-center .slw-spinner{margin:0 auto 16px}
    .lmd-h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:36px;line-height:1.08;letter-spacing:-0.02em;margin:6px 0 8px;color:#202124}
    .lmd-h2{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:26px;line-height:1.15;letter-spacing:-0.01em;margin:0 0 6px;color:#202124}
    .lmd-h3{font-size:16px;font-weight:700;margin:26px 0 12px;color:#202124}
    .lmd-muted{color:#556274;font-size:14.5px;line-height:1.55;margin:0 0 14px}
    .lmd-muted a{color:#A409D2;font-weight:600}
    .lmd-eyebrow{margin:0;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#A409D2}
    .lmd-card{border:1px solid #ececf0;border-radius:18px;background:#fff;padding:20px 22px}

    .lmd-hero{display:grid;grid-template-columns:260px 1fr;gap:28px;align-items:center}
    .lmd-hero-image{height:190px;border-radius:18px;background:#f3f1f7 center/cover no-repeat}
    .lmd-progress{margin-top:14px}
    .lmd-progress-bar{height:10px;border-radius:999px;background:#f0edf5;overflow:hidden}
    .lmd-progress-bar span{display:block;height:100%;background:linear-gradient(90deg,#A409D2,#c65ae8);border-radius:999px}
    .lmd-progress-thin{height:6px;margin:4px 0 16px}
    .lmd-progress-labels{display:flex;justify-content:space-between;gap:12px;margin-top:8px;font-size:13px;color:#556274}
    .lmd-progress-labels b{color:#202124}

    .lmd-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:28px 0 18px}
    .lmd-stat{border:1px solid #ececf0;border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:6px;min-width:0}
    .lmd-stat>span{font-size:12.5px;color:#667085;font-weight:600}
    .lmd-stat>b{font-size:22px;font-weight:800;color:#202124;letter-spacing:-0.02em}
    .lmd-stat>b em{font-style:normal;color:#98a2b3;font-size:16px}
    .lmd-stat small{font-size:12.5px;color:#667085}
    .lmd-pill{display:inline-block;font-size:13px;font-weight:700;padding:5px 11px;border-radius:999px;background:#f2f4f7;color:#344054;letter-spacing:0}
    .lmd-pill-good{background:#E8F7EF;color:#0E7D4C}
    .lmd-pill-bad{background:#FDECEC;color:#B42318}

    .lmd-next{border:1.5px solid #e4c6f2;background:linear-gradient(180deg,#fcf7ff,#fff);margin-bottom:18px}
    .lmd-next h2{font-size:20px;margin:6px 0 6px;color:#202124}
    .lmd-next p{margin:0;color:#475467;font-size:14.5px;line-height:1.55}
    .lmd-btn-inline{width:auto!important;padding:12px 20px!important;margin-top:14px!important;font-size:14px!important}
    .lmd-alerts{margin-bottom:18px}
    .lmd-alerts h2{font-size:16px;margin:0 0 6px}

    .lmd-tabs{position:sticky;top:0;z-index:5;display:flex;gap:6px;background:#fff;padding:10px 0;margin:10px 0 6px;border-bottom:1px solid #f0f0f3;overflow-x:auto;scrollbar-width:none}
    .lmd-tabs::-webkit-scrollbar{display:none}
    .lmd-tabs a{flex:none;padding:8px 14px;border-radius:999px;background:#f5f3f8;color:#3a2b44;font-size:13.5px;font-weight:700;text-decoration:none}
    .lmd-tabs a:hover{background:#efe3f7}
    .lmd-section{padding-top:30px;scroll-margin-top:60px}
    .lmd-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
    .lmd-count{font-size:13px;font-weight:700;color:#A409D2;white-space:nowrap}
    .lmd-empty{color:#667085;font-size:14.5px}
    .lmd-baseline{font-size:13px;color:#667085;margin:12px 2px 0}

    .lmd-events{list-style:none;margin:0;padding:6px 22px}
    .lmd-events.lmd-card{padding:6px 22px}
    .lmd-alerts .lmd-events{padding:0}
    .lmd-event>div,.lmd-event>a{display:grid;grid-template-columns:12px 1fr auto;gap:14px;align-items:start;padding:14px 0;border-bottom:1px solid #f2f2f5;color:inherit;text-decoration:none}
    .lmd-event:last-child>div,.lmd-event:last-child>a{border-bottom:none}
    .lmd-event>a:hover b{color:#A409D2}
    .lmd-event-text{display:flex;flex-direction:column;gap:3px;min-width:0}
    .lmd-event-text b{font-size:14.5px;color:#202124;overflow-wrap:anywhere}
    .lmd-event-text span{font-size:13.5px;color:#556274;overflow-wrap:anywhere}
    .lmd-event time{font-size:12.5px;color:#98a2b3;white-space:nowrap;padding-top:2px}
    .lmd-dot{width:10px;height:10px;border-radius:50%;margin-top:5px;background:#d0d5dd}
    .lmd-tone-good{background:#12b76a}.lmd-tone-bad{background:#f04438}.lmd-tone-info{background:#A409D2}.lmd-tone-you{background:#2e90fa}

    .lmd-checklist{list-style:none;margin:0;padding:4px 22px}
    .lmd-check{display:grid;grid-template-columns:26px 1fr;gap:14px;padding:16px 0;border-bottom:1px solid #f2f2f5}
    .lmd-check:last-child{border-bottom:none}
    .lmd-checkbox{width:24px;height:24px;border-radius:7px;border:2px solid #cfd4dc;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;margin-top:1px}
    .lmd-checkbox:disabled{cursor:default}
    .lmd-check-done .lmd-checkbox{background:#A409D2;border-color:#A409D2}
    .lmd-check-text p{margin:4px 0 0;font-size:13.5px;color:#556274;line-height:1.5}
    .lmd-check-text small{display:block;margin-top:6px;font-size:12.5px;color:#98a2b3}
    .lmd-check-done .lmd-check-text small{color:#0E7D4C;font-weight:600}
    .lmd-check-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .lmd-check-title b{font-size:15px;color:#202124}
    .lmd-check-done .lmd-check-title b{color:#475467}
    .lmd-priority{font-size:10.5px;font-weight:800;letter-spacing:.06em;padding:3px 7px;border-radius:6px}
    .lmd-priority-urgent{background:#FDECEC;color:#B42318}.lmd-priority-high{background:#FFF4E5;color:#B14F0A}.lmd-priority-medium{background:#EEF4FF;color:#3538CD}

    .lmd-phases{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .lmd-phase{display:flex;flex-direction:column;gap:10px}
    .lmd-phase-current{border:1.5px solid #A409D2;box-shadow:0 6px 24px rgba(164,9,210,.08)}
    .lmd-phase-head{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:700;color:#667085}
    .lmd-phase-head em{font-style:normal;background:#A409D2;color:#fff;border-radius:999px;padding:3px 9px;font-size:11.5px}
    .lmd-phase h3{margin:0;font-size:18px;color:#202124}
    .lmd-weeks{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
    .lmd-weeks li{font-size:13.5px;color:#344054;display:grid;grid-template-columns:62px 1fr;gap:8px;padding:6px 8px;border-radius:8px}
    .lmd-weeks li span{font-weight:700;color:#98a2b3;font-size:12.5px}
    .lmd-week-now{background:#f7ecfc;color:#202124!important;font-weight:600}
    .lmd-week-now span{color:#A409D2!important}
    .lmd-week-past{color:#98a2b3!important}
    .lmd-tasks,.lmd-notes{list-style:none;margin:4px 0 0;padding:10px 0 0;border-top:1px dashed #ececf0;display:flex;flex-direction:column;gap:8px}
    .lmd-tasks li{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;color:#344054}
    .lmd-tasks li svg{flex:none;width:16px;height:16px;margin-top:1px}
    .lmd-task-done{color:#98a2b3!important;text-decoration:line-through}
    .lmd-task-dot{flex:none;width:8px;height:8px;border-radius:50%;border:2px solid #A409D2;margin:5px 4px 0}
    .lmd-notes li{font-size:13.5px;color:#475467;line-height:1.5;padding-left:14px;position:relative}
    .lmd-notes li::before{content:"";position:absolute;left:0;top:8px;width:5px;height:5px;border-radius:50%;background:#A409D2}

    .lmd-pulse{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
    .lmd-pulse-stat{display:flex;flex-direction:column;gap:4px}
    .lmd-pulse-stat span{font-size:12.5px;color:#667085;font-weight:600}
    .lmd-pulse-stat b{font-size:20px;font-weight:800;color:#202124}
    .lmd-pulse-stat small{font-size:12px;color:#A409D2;font-weight:600}
    .lmd-homes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .lmd-home a{display:flex;flex-direction:column;border:1px solid #ececf0;border-radius:16px;overflow:hidden;color:inherit;text-decoration:none;height:100%}
    .lmd-home a:hover{border-color:#d9b3ec}
    .lmd-home-image{position:relative;height:140px;background:#f3f1f7 center/cover no-repeat}
    .lmd-home-tags{position:absolute;top:10px;left:10px;display:flex;gap:6px;flex-wrap:wrap}
    .lmd-tag{font-size:11.5px;font-weight:700;padding:4px 8px;border-radius:999px;background:#fff;color:#344054}
    .lmd-tag-purple{background:#A409D2;color:#fff}
    .lmd-tag-green{background:#E8F7EF;color:#0E7D4C}
    .lmd-home-body{padding:12px 14px 14px;display:flex;flex-direction:column;gap:3px}
    .lmd-home-body b{font-size:16px;color:#202124}
    .lmd-home-body span{font-size:13.5px;color:#344054}
    .lmd-home-body small{font-size:12.5px;color:#667085}
    .lmd-sold{padding:6px 22px 14px}
    .lmd-sold table{width:100%;border-collapse:collapse}
    .lmd-sold td{padding:12px 0;border-bottom:1px solid #f2f2f5;font-size:14px;color:#202124;vertical-align:top}
    .lmd-sold td:last-child{text-align:right;white-space:nowrap;padding-left:12px}
    .lmd-sold small{display:block;font-size:12.5px;color:#667085;margin-top:2px}
    .lmd-attribution{font-size:11.5px;color:#98a2b3;margin:10px 0 0}

    .lmd-summary{margin-bottom:18px;border:1.5px solid #12b76a}
    .lmd-summary h2{font-size:20px;margin:0 0 12px}
    .lmd-summary ul{list-style:none;margin:0 0 12px;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .lmd-summary li{display:flex;flex-direction:column;gap:2px}
    .lmd-summary li b{font-size:18px;color:#202124}
    .lmd-summary li span{font-size:12.5px;color:#667085}

    .lmd-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;align-items:stretch}
    .lmd-actions .slw-btn-outline{margin-top:0}
    .lmd-link-btn{display:flex;align-items:center;justify-content:center;text-decoration:none;text-align:center}
    .lmd-sell-faster{grid-column:1 / -1;display:block;padding:16px 18px;border-radius:14px;background:#f7ecfc;color:#3a2b44;font-size:14px;line-height:1.5;text-decoration:none}
    .lmd-sell-faster b{color:#A409D2}
    .lmd-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#111;color:#fff;padding:12px 18px;border-radius:10px;font-size:14px;z-index:50;max-width:calc(100% - 32px)}

    @media (max-width: 900px){
      .lmd{padding:18px 0 56px}
      .lmd-hero{grid-template-columns:1fr;gap:16px}
      .lmd-hero-image{height:200px}
      .lmd-h1{font-size:28px}
      .lmd-h2{font-size:22px}
      .lmd-stats{grid-template-columns:1fr 1fr;gap:10px;margin:20px 0 14px}
      .lmd-stat{padding:14px}
      .lmd-stat>b{font-size:19px}
      .lmd-phases{grid-template-columns:1fr}
      .lmd-pulse{grid-template-columns:1fr 1fr;row-gap:16px}
      .lmd-homes{grid-template-columns:1fr 1fr}
      .lmd-summary ul{grid-template-columns:1fr 1fr}
      .lmd-actions{grid-template-columns:1fr}
      .lmd-card{padding:16px}
      .lmd-events.lmd-card,.lmd-checklist{padding:2px 16px}
      .lmd-sold{padding:4px 16px 12px}
    }
    @media (max-width: 480px){
      .lmd-homes{grid-template-columns:1fr}
      .lmd-event>div,.lmd-event>a{grid-template-columns:10px 1fr;gap:12px}
      .lmd-event time{grid-column:2;padding-top:0}
    }
  `}</style>
);

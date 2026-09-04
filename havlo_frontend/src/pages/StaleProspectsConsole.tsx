import { useCallback, useEffect, useState } from 'react';
import { api, API_BASE } from '../lib/api';
import type { StaleProspectAbandonedItem, StaleProspectConsoleDetail, StaleProspectConsoleListItem } from '../lib/api';

// ── Report edit shape ───────────────────────────────────────────────────────
// Mirrors the same subset DashboardStaleListings.tsx already edits for
// StaleListingAssessment reports — same underlying schema (both come from
// groq_service.generate_stale_listing_report), so the same editable fields
// make sense here.

interface KeyFinding { title: string; description: string; type: string; icon?: string; }
interface ActionItem { priority: string; title: string; description: string; bullets: string[]; why_it_matters?: string; }
interface ComparableSale { address: string; beds: number | string; property_type: string; sold_asking: string; is_subject?: boolean; }
interface ReportEdit {
  overall_score: number;
  scores: { photos: number; pricing: number; description: number; positioning: number };
  key_findings: KeyFinding[];
  action_plan: ActionItem[];
  comparable_sales: ComparableSale[];
  pricing_recommendation: string;
  pricing_recommendation_detail: string;
  executive_summary: string;
}

function parseReport(data: Record<string, unknown>): ReportEdit {
  const scores = (data.scores as Record<string, number>) || {};
  return {
    overall_score: Number(data.overall_score) || 50,
    scores: {
      photos: Number(scores.photos) || 50,
      pricing: Number(scores.pricing) || 50,
      description: Number(scores.description) || 50,
      positioning: Number(scores.positioning) || 50,
    },
    key_findings: (Array.isArray(data.key_findings) ? data.key_findings : []).map((f: Record<string, unknown>) => ({
      title: String(f.title || ''), description: String(f.description || ''), type: String(f.type || 'issue'), icon: String(f.icon || ''),
    })),
    action_plan: (Array.isArray(data.action_plan) ? data.action_plan : []).map((a: Record<string, unknown>) => ({
      priority: String(a.priority || 'MEDIUM'), title: String(a.title || ''), description: String(a.description || ''),
      bullets: Array.isArray(a.bullets) ? a.bullets.map(String) : [], why_it_matters: String(a.why_it_matters || ''),
    })),
    comparable_sales: (Array.isArray(data.comparable_sales) ? data.comparable_sales : []).map((c: Record<string, unknown>) => ({
      address: String(c.address || ''), beds: (c.beds as number | string) ?? '', property_type: String(c.property_type || ''),
      sold_asking: String(c.sold_asking || ''), is_subject: Boolean(c.is_subject),
    })),
    pricing_recommendation: String(data.pricing_recommendation || ''),
    pricing_recommendation_detail: String(data.pricing_recommendation_detail || ''),
    executive_summary: String(data.executive_summary || ''),
  };
}

function emptyManualForm() {
  return { rightmove_url: '', building_name_or_number: '', street: '', city: '', postcode: '', county: '', asking_price: '', listing_duration_days: '180' };
}

const STATUS_LABELS: Record<string, string> = {
  identified: 'Identified', report_ready: 'Report ready', letter_ready: 'Letter ready',
  email_queued: 'Email queued', email_sending: 'Sending', email_sent: 'Sent', email_failed: 'Send failed', email_skipped: 'Send skipped',
};

const money = (v?: number | null) => v == null ? '—' : `£${Math.round(v).toLocaleString('en-GB')}`;

export const StaleProspectsConsole = () => {
  useEffect(() => {
    document.title = 'Stale Prospects Console — Havlo';
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'robots'); document.head.appendChild(meta); }
    meta.setAttribute('content', 'noindex, nofollow');
  }, []);

  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const isMobile = viewportWidth < 700;

  const [items, setItems] = useState<StaleProspectConsoleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [treatedFilter, setTreatedFilter] = useState<'all' | 'treated' | 'untreated'>('untreated');
  const [search, setSearch] = useState('');

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const res = await api.staleProspectsConsoleList({
        city: cityFilter || undefined,
        treated: treatedFilter === 'all' ? undefined : treatedFilter === 'treated',
        q: search.trim() || undefined,
        limit: 100,
      });
      setItems(res.items);
      setTotal(res.total);
      setCities(res.cities);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Could not load prospects.');
    } finally {
      setLoading(false);
    }
  }, [cityFilter, treatedFilter, search]);

  useEffect(() => {
    const t = setTimeout(loadList, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [loadList, search]);

  // ── Tab: "Prospects" (above) vs "Follow-up" (entered a code, submitted
  // contact details, never checked out — the worklist for manual/paper
  // follow-up letters) ────────────────────────────────────────────────────
  const [tab, setTab] = useState<'prospects' | 'abandoned'>('prospects');
  const [abandonedItems, setAbandonedItems] = useState<StaleProspectAbandonedItem[]>([]);
  const [abandonedTotal, setAbandonedTotal] = useState(0);
  const [abandonedLoading, setAbandonedLoading] = useState(false);
  const [abandonedError, setAbandonedError] = useState('');
  const [abandonedSearch, setAbandonedSearch] = useState('');
  const [includeUnsubscribed, setIncludeUnsubscribed] = useState(false);

  const loadAbandoned = useCallback(async () => {
    setAbandonedLoading(true);
    setAbandonedError('');
    try {
      const res = await api.staleProspectsConsoleListAbandoned({
        includeUnsubscribed,
        q: abandonedSearch.trim() || undefined,
        limit: 100,
      });
      setAbandonedItems(res.items);
      setAbandonedTotal(res.total);
    } catch (e) {
      setAbandonedError(e instanceof Error ? e.message : 'Could not load follow-up list.');
    } finally {
      setAbandonedLoading(false);
    }
  }, [includeUnsubscribed, abandonedSearch]);

  useEffect(() => {
    if (tab !== 'abandoned') return;
    const t = setTimeout(loadAbandoned, abandonedSearch ? 350 : 0);
    return () => clearTimeout(t);
  }, [tab, loadAbandoned, abandonedSearch]);

  const fmtDate = (v?: string | null) => v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  // ── Detail / edit ──────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StaleProspectConsoleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editForm, setEditForm] = useState<ReportEdit | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setEditForm(null);
    setSaveMsg('');
    setViewMode('preview');
    setDetailLoading(true);
    try {
      const d = await api.staleProspectsConsoleGet(id);
      setDetail(d);
      setEditForm(parseReport(d.report_data));
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Could not load this prospect.');
    } finally {
      setDetailLoading(false);
    }
  };
  const closeDetail = () => { setSelectedId(null); setDetail(null); setEditForm(null); };

  const saveEdit = async () => {
    if (!selectedId || !editForm) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const updated = await api.staleProspectsConsoleUpdateReport(selectedId, editForm as unknown as Record<string, unknown>);
      setDetail(updated);
      setSaveMsg('Saved — letter PDF regenerated.');
      setItems(prev => prev.map(it => it.prospect_id === selectedId ? { ...it, ...updated } : it));
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const toggleTreated = async (id: string, treated: boolean) => {
    try {
      const updated = await api.staleProspectsConsoleSetTreated(id, treated);
      setItems(prev => treatedFilter === 'all'
        ? prev.map(it => it.prospect_id === id ? { ...it, treated_at: updated.treated_at } : it)
        : prev.filter(it => it.prospect_id !== id));
      if (detail && detail.prospect_id === id) setDetail({ ...detail, treated_at: updated.treated_at });
    } catch {
      // Best-effort — list stays as-is, admin can retry the click.
    }
  };

  // ── Manual create ──────────────────────────────────────────────────────
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState(emptyManualForm());
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState('');
  const [manualSuccess, setManualSuccess] = useState<{ property_code: string; preview_url: string } | null>(null);

  // Without this, the modal (position: fixed) "bobs" on mobile: touching
  // the semi-transparent backdrop scrolls the page underneath, which on
  // iOS Safari toggles the address bar and recalculates vh on every
  // scroll tick — the fixed overlay visibly jumps as a result. Locking
  // background scroll while either modal is open removes the trigger for
  // that entirely (the modal's own content still scrolls normally, since
  // that's a separate, nested scroll container).
  //
  // overflow:hidden on documentElement+body (the first thing tried here)
  // is not enough on real iOS Safari, even though it looked sufficient
  // under this Browser tool's mobile emulation — that emulation is
  // Chromium/Android, and iOS Safari has a well-known separate quirk: a
  // touch-drag on the body can still trigger its rubber-band scroll under
  // overflow:hidden. This page has ~290 prospect cards in the DOM behind
  // the modal (not virtualized), so there's plenty of scrollable height
  // for that to be visible. The robust fix for that specific iOS bug is
  // pinning the body with position:fixed at its current scroll offset,
  // then restoring both on close.
  const anyModalOpen = !!selectedId || showManual;
  useEffect(() => {
    if (!anyModalOpen) return;
    const scrollY = window.scrollY;
    const { body } = document;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      htmlOverflow: document.documentElement.style.overflow,
    };
    document.documentElement.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    return () => {
      document.documentElement.style.overflow = prev.htmlOverflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [anyModalOpen]);

  const submitManual = async () => {
    setManualError('');
    if (!manualForm.rightmove_url.trim() || !manualForm.street.trim() || !manualForm.city.trim() || !manualForm.postcode.trim()) {
      setManualError('Rightmove URL, street, city and postcode are all required.');
      return;
    }
    setManualSubmitting(true);
    try {
      const res = await api.staleProspectsConsoleCreateManual({
        rightmove_url: manualForm.rightmove_url.trim(),
        building_name_or_number: manualForm.building_name_or_number.trim() || undefined,
        street: manualForm.street.trim(),
        city: manualForm.city.trim(),
        postcode: manualForm.postcode.trim(),
        county: manualForm.county.trim() || undefined,
        asking_price: manualForm.asking_price ? Number(manualForm.asking_price) : undefined,
        listing_duration_days: manualForm.listing_duration_days ? Number(manualForm.listing_duration_days) : undefined,
      });
      setManualSuccess({ property_code: res.property_code, preview_url: res.preview_url });
      setManualForm(emptyManualForm());
      loadList();
    } catch (e) {
      setManualError(e instanceof Error ? e.message : 'Could not create this prospect.');
    } finally {
      setManualSubmitting(false);
    }
  };

  const closeManual = () => { setShowManual(false); setManualError(''); setManualSuccess(null); setManualForm(emptyManualForm()); };

  return (
    <div className="spc-page">
      <style>{`
        .spc-page{min-height:100vh;background:#F6F7F9;font-family:Inter,Arial,sans-serif;color:#111}
        .spc-page,.spc-page *{box-sizing:border-box}
        .spc-shell{max-width:1400px;margin:0 auto;padding:${isMobile ? '18px 16px 60px' : '32px 32px 80px'}}
        .spc-header{display:flex;justify-content:space-between;align-items:${isMobile ? 'flex-start' : 'center'};flex-direction:${isMobile ? 'column' : 'row'};gap:14px;margin-bottom:22px}
        .spc-title{font-family:"Plus Jakarta Sans",sans-serif;font-weight:800;font-size:${isMobile ? 22 : 26};letter-spacing:-0.02em;margin:0}
        .spc-subtitle{margin:6px 0 0;color:#6B7280;font-size:13.5px;max-width:560px;line-height:1.55}
        .spc-header-actions{display:flex;gap:10px;flex-wrap:wrap}
        .spc-btn{border:0;border-radius:10px;padding:11px 18px;font-weight:800;font-size:13.5px;cursor:pointer;white-space:nowrap}
        .spc-btn-primary{background:#111;color:#fff}
        .spc-btn-primary:hover{background:#000}
        .spc-btn-ghost{background:#fff;color:#111;border:1px solid #E3E5E9}
        .spc-btn-ghost:hover{background:#F4F4F5}
        .spc-stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
        .spc-stat{background:#fff;border:1px solid #EEF0F3;border-radius:12px;padding:12px 16px;min-width:110px}
        .spc-stat b{display:block;font-family:"Plus Jakarta Sans",sans-serif;font-size:20px;font-weight:800}
        .spc-stat span{color:#8A8F98;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
        .spc-filters{display:flex;gap:10px;flex-wrap:wrap;align-items:center;background:#fff;border:1px solid #EEF0F3;border-radius:14px;padding:14px;margin-bottom:20px}
        .spc-select,.spc-input{height:40px;border-radius:9px;border:1px solid #E3E5E9;padding:0 12px;font-size:13.5px;font-family:inherit;color:#111;background:#fff}
        .spc-input{flex:1;min-width:180px}
        .spc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
        .spc-card{background:#fff;border:1px solid #EEF0F3;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;transition:box-shadow .15s,transform .15s}
        .spc-card:hover{box-shadow:0 10px 28px rgba(17,17,17,.08);transform:translateY(-2px)}
        .spc-card-img{height:150px;background:#F0F1F3 center/cover no-repeat;position:relative}
        .spc-card-img.empty::after{content:'No image';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#B4B8C0;font-size:12px;font-weight:700}
        .spc-badges{position:absolute;top:10px;left:10px;display:flex;gap:6px;flex-wrap:wrap}
        .spc-badge{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;padding:4px 8px;border-radius:999px;background:rgba(17,17,17,.72);color:#fff}
        .spc-badge.manual{background:#7C3AED}
        .spc-badge.treated{background:#059669}
        .spc-card-body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:8px;flex:1}
        .spc-addr{font-weight:800;font-size:14.5px;line-height:1.35;margin:0}
        .spc-meta{color:#6B7280;font-size:12.5px;display:flex;flex-wrap:wrap;gap:6px 10px}
        .spc-price{font-family:"Plus Jakarta Sans",sans-serif;font-weight:800;font-size:17px;color:#111;margin-top:2px}
        .spc-status-pill{align-self:flex-start;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:#F0F1F3;color:#444}
        .spc-card-actions{display:flex;gap:8px;margin-top:auto;padding-top:6px}
        .spc-card-actions button{flex:1;border-radius:8px;border:1px solid #E3E5E9;background:#fff;padding:8px 10px;font-size:12.5px;font-weight:800;cursor:pointer}
        .spc-card-actions button.view{background:#111;color:#fff;border-color:#111}
        .spc-card-actions button.treated-on{background:#ECFDF5;border-color:#A7F3D0;color:#047857}
        .spc-empty{background:#fff;border:1px dashed #D8DAE0;border-radius:16px;padding:60px 20px;text-align:center;color:#8A8F98;font-size:14px}
        .spc-overlay{position:fixed;inset:0;background:rgba(17,17,17,.5);z-index:200;display:flex;align-items:${isMobile ? 'flex-end' : 'center'};justify-content:center;padding:${isMobile ? '0' : '24px'};overscroll-behavior:contain}
        .spc-modal{background:#fff;width:100%;max-width:900px;max-height:${isMobile ? '92vh' : '88vh'};max-height:${isMobile ? '92svh' : '88svh'};overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;border-radius:${isMobile ? '20px 20px 0 0' : '20px'};padding:${isMobile ? '20px' : '32px'};position:relative}
        .spc-modal-sm{max-width:560px}
        .spc-close{position:sticky;top:0;float:right;border:0;background:#F4F4F5;border-radius:50%;width:34px;height:34px;font-size:16px;cursor:pointer;color:#444;z-index:2}
        .spc-modal h2{font-family:"Plus Jakarta Sans",sans-serif;font-weight:800;font-size:20px;margin:0 0 4px}
        .spc-modal .sub{color:#8A8F98;font-size:12.5px;margin:0 0 20px}
        .spc-field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
        .spc-field label{font-size:12px;font-weight:800;color:#444;text-transform:uppercase;letter-spacing:.02em}
        .spc-field input,.spc-field textarea,.spc-field select{border:1px solid #E3E5E9;border-radius:9px;padding:10px 12px;font-size:14px;font-family:inherit;color:#111;width:100%}
        .spc-field textarea{resize:vertical;min-height:70px;line-height:1.5}
        .spc-row2{display:grid;grid-template-columns:${isMobile ? '1fr' : '1fr 1fr'};gap:12px}
        .spc-section-title{font-family:"Plus Jakarta Sans",sans-serif;font-weight:800;font-size:15px;margin:26px 0 12px;padding-top:18px;border-top:1px solid #EEF0F3}
        .spc-repeat-item{border:1px solid #EEF0F3;border-radius:12px;padding:14px;margin-bottom:12px;background:#FAFAFB}
        .spc-repeat-item-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
        .spc-repeat-item-head b{font-size:12.5px;color:#8A8F98}
        .spc-remove{border:0;background:#FEE2E2;color:#B91C1C;border-radius:6px;padding:4px 9px;font-size:11px;font-weight:800;cursor:pointer}
        .spc-add{border:1px dashed #C9CCD3;background:transparent;color:#444;border-radius:9px;padding:9px 14px;font-size:12.5px;font-weight:800;cursor:pointer;width:100%;margin-top:2px}
        .spc-save-bar{position:sticky;bottom:-32px;margin:24px -32px -32px;padding:16px 32px;background:#fff;border-top:1px solid #EEF0F3;display:flex;align-items:center;gap:12px;justify-content:flex-end}
        .spc-save-msg{margin-right:auto;font-size:12.5px;font-weight:700;color:#047857}
        .spc-link{color:#7C3AED;font-weight:800;font-size:13px;text-decoration:none}
        .spc-scores-grid{display:grid;grid-template-columns:repeat(${isMobile ? 2 : 4},1fr);gap:10px}
        .spc-score-field label{font-size:11px}
        .spc-loading{padding:80px 0;text-align:center;color:#8A8F98;font-size:14px}
        .spc-tabs{display:flex;gap:6px;border-bottom:1px solid #EEF0F3;margin:16px 0 18px}
        .spc-tabs button{border:0;background:transparent;padding:10px 4px;margin-right:18px;font-size:13.5px;font-weight:800;color:#9AA0AA;cursor:pointer;border-bottom:2px solid transparent}
        .spc-tabs button.active{color:#111;border-bottom-color:#111}
        .spc-preview-head{display:flex;gap:16px;align-items:center;padding-bottom:18px;border-bottom:1px solid #EEF0F3;margin-bottom:18px}
        .spc-preview-head img{width:96px;height:72px;border-radius:10px;object-fit:cover;flex-shrink:0}
        .spc-preview-head h3{font-family:"Plus Jakarta Sans",sans-serif;font-size:17px;margin:0 0 4px}
        .spc-preview-head p{margin:0;color:#6B7280;font-size:12.5px}
        .spc-preview-score{margin-left:auto;text-align:center;flex-shrink:0}
        .spc-preview-score b{display:block;font-family:"Plus Jakarta Sans",sans-serif;font-size:26px;font-weight:800}
        .spc-preview-score span{color:#9AA0AA;font-size:11px;font-weight:700}
        .spc-preview-section{margin-bottom:26px}
        .spc-preview-section h4{font-family:"Plus Jakarta Sans",sans-serif;font-size:14.5px;font-weight:800;margin:0 0 10px}
        .spc-preview-section p{font-size:13.5px;line-height:1.6;color:#333;margin:0 0 8px;white-space:pre-line}
        .spc-preview-empty{color:#9AA0AA;font-style:italic}
        .spc-preview-scores{display:grid;gap:10px}
        .spc-preview-score-bar{display:grid;grid-template-columns:100px 1fr 30px;align-items:center;gap:10px;font-size:12px;text-transform:capitalize;color:#555}
        .spc-preview-score-bar .track{height:8px;border-radius:999px;background:#F0F1F3;overflow:hidden}
        .spc-preview-score-bar .fill{height:100%;background:#7C3AED;border-radius:999px}
        .spc-preview-score-bar b{text-align:right;color:#111}
        .spc-preview-card{border:1px solid #EEF0F3;border-radius:12px;padding:12px 14px;margin-bottom:10px;background:#FAFAFB}
        .spc-preview-card b{font-size:13.5px;display:block;margin-bottom:4px}
        .spc-preview-card p{margin:0}
        .spc-priority-tag{font-size:10px;font-weight:800;padding:2px 7px;border-radius:999px;margin-right:4px}
        .spc-priority-tag.p-urgent{background:#FEE2E2;color:#B91C1C}
        .spc-priority-tag.p-high{background:#FEF3C7;color:#92400E}
        .spc-priority-tag.p-medium{background:#ECFDF5;color:#047857}
        .spc-preview-table{width:100%;border-collapse:collapse;font-size:12.5px}
        .spc-preview-table th{text-align:left;color:#9AA0AA;font-size:11px;text-transform:uppercase;padding:0 8px 8px 0}
        .spc-preview-table td{padding:8px 8px 8px 0;border-top:1px solid #EEF0F3}
        @media print{
          /* The mobile-bobbing scroll-lock (see the anyModalOpen effect
             above) sets body{position:fixed} with an inline style while
             this modal — and this print button — are open. That makes
             body the containing block for any descendant position:absolute
             element, including #spc-print-target below, instead of the
             page. body's own box still spans its full ~290-card content
             height even though every child is visibility:hidden (that
             only hides paint, not layout), so the print target ended up
             absolutely positioned inside a ~40,000px-tall invisible box —
             paginated into a couple dozen mostly-blank pages with the
             real content stranded on page 1. !important is required
             because it must beat the higher-specificity inline style.
             html{overflow:hidden} is reset too, defensively, in case any
             browser lets that clip print content. */
          html,body{position:static !important;overflow:visible !important;height:auto !important}
          body *{visibility:hidden}
          #spc-print-target,#spc-print-target *{visibility:visible}
          #spc-print-target{position:absolute;top:0;left:0;width:100%;padding:24px}
          .spc-preview-head img{display:block}
        }
      `}</style>

      <div className="spc-shell">
        <div className="spc-header">
          <div>
            <h1 className="spc-title">Stale Prospects Console</h1>
            <p className="spc-subtitle">Every property the automated Rightmove discovery has found (plus anything added by hand below) — browse, edit the report and letter, mark properties as dealt with, and add near-misses manually.</p>
          </div>
          <div className="spc-header-actions">
            <button className="spc-btn spc-btn-ghost" onClick={tab === 'prospects' ? loadList : loadAbandoned}>Refresh</button>
            {tab === 'prospects' && <button className="spc-btn spc-btn-primary" onClick={() => setShowManual(true)}>+ Add manually</button>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18, borderBottom: '1px solid #E5E7EB' }}>
          <button
            onClick={() => setTab('prospects')}
            style={{ padding: '10px 4px', marginRight: 20, background: 'none', border: 'none', borderBottom: tab === 'prospects' ? '2px solid #111111' : '2px solid transparent', fontWeight: 700, fontSize: 14, color: tab === 'prospects' ? '#111111' : '#888', cursor: 'pointer' }}
          >
            Prospects
          </button>
          <button
            onClick={() => setTab('abandoned')}
            style={{ padding: '10px 4px', background: 'none', border: 'none', borderBottom: tab === 'abandoned' ? '2px solid #111111' : '2px solid transparent', fontWeight: 700, fontSize: 14, color: tab === 'abandoned' ? '#111111' : '#888', cursor: 'pointer' }}
          >
            Follow Up
          </button>
        </div>

        {tab === 'prospects' && (
        <div className="spc-stats">
          <div className="spc-stat"><b>{total}</b><span>{treatedFilter === 'all' ? 'total' : treatedFilter}</span></div>
          <div className="spc-stat"><b>{cities.length}</b><span>Locations</span></div>
        </div>
        )}

        {tab === 'prospects' && (
        <>
        <div className="spc-filters">
          <select className="spc-select" value={cityFilter} onChange={e => setCityFilter(e.target.value)}>
            <option value="">All locations</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="spc-select" value={treatedFilter} onChange={e => setTreatedFilter(e.target.value as 'all' | 'treated' | 'untreated')}>
            <option value="untreated">Not treated</option>
            <option value="treated">Treated</option>
            <option value="all">All</option>
          </select>
          <input className="spc-input" placeholder="Search address, postcode or property code..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {listError && <p style={{ color: '#B91C1C', fontWeight: 700, fontSize: 13 }}>{listError}</p>}

        {loading ? (
          <div className="spc-loading">Loading prospects...</div>
        ) : items.length === 0 ? (
          <div className="spc-empty">No prospects match these filters.</div>
        ) : (
          <div className="spc-grid">
            {items.map(item => {
              const treated = !!item.treated_at;
              return (
                <div className="spc-card" key={item.prospect_id}>
                  <div className={`spc-card-img${item.image_url ? '' : ' empty'}`} style={item.image_url ? { backgroundImage: `url(${item.image_url})` } : undefined}>
                    <div className="spc-badges">
                      {item.is_manual && <span className="spc-badge manual">Manual</span>}
                      {treated && <span className="spc-badge treated">Treated</span>}
                    </div>
                  </div>
                  <div className="spc-card-body">
                    <p className="spc-addr">{item.property_address}</p>
                    <div className="spc-meta">
                      <span>{item.postcode || 'No postcode'}</span>
                      {item.bedrooms != null && <span>{item.bedrooms} bed</span>}
                      {item.property_type && <span>{item.property_type}</span>}
                    </div>
                    <div className="spc-price">{money(item.asking_price)}</div>
                    <span className="spc-status-pill">{STATUS_LABELS[item.processing_status] || item.processing_status}</span>
                    <div className="spc-card-actions">
                      <button className="view" onClick={() => openDetail(item.prospect_id)}>View & edit</button>
                      <button className={treated ? 'treated-on' : ''} onClick={() => toggleTreated(item.prospect_id, !treated)}>
                        {treated ? 'Treated ✓' : 'Mark treated'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>
        )}

        {tab === 'abandoned' && (
          <>
            <div className="spc-stats">
              <div className="spc-stat"><b>{abandonedTotal}</b><span>to follow up</span></div>
            </div>
            <div className="spc-filters">
              <input className="spc-input" placeholder="Search address, property code, contact name or email..." value={abandonedSearch} onChange={e => setAbandonedSearch(e.target.value)} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#555' }}>
                <input type="checkbox" checked={includeUnsubscribed} onChange={e => setIncludeUnsubscribed(e.target.checked)} />
                Include unsubscribed
              </label>
            </div>

            {abandonedError && <p style={{ color: '#B91C1C', fontWeight: 700, fontSize: 13 }}>{abandonedError}</p>}

            {abandonedLoading ? (
              <div className="spc-loading">Loading follow-up list...</div>
            ) : abandonedItems.length === 0 ? (
              <div className="spc-empty">Nobody matches — everyone who submitted their details either checked out or hasn't been left behind.</div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F7F8F8', textAlign: 'left' }}>
                      {['Property', 'Contact', 'Price', 'Confirmed', 'Details submitted', 'Payment', 'Follow-ups sent', 'Status'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', fontWeight: 700, color: '#555', whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {abandonedItems.map(item => (
                      <tr key={item.prospect_id} style={{ borderBottom: '1px solid #F0F0F0' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{item.property_address}</div>
                          <div style={{ color: '#888', fontSize: 12 }}>{item.property_code}{item.postcode ? ` · ${item.postcode}` : ''}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div>{item.contact_name || '—'}</div>
                          {item.contact_email && <div><a href={`mailto:${item.contact_email}`} className="spc-link" style={{ fontSize: 12 }}>{item.contact_email}</a></div>}
                          {item.contact_phone && <div style={{ color: '#888', fontSize: 12 }}>{item.contact_phone}</div>}
                        </td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{money(item.asking_price)}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{fmtDate(item.property_confirmed_at)}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{fmtDate(item.contact_details_submitted_at)}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{item.payment_status}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          {item.abandonment_emails_sent} email{item.abandonment_emails_sent === 1 ? '' : 's'}
                          {item.abandonment_sms_sent_at && ', 1 SMS'}
                        </td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          {item.unsubscribed_at ? <span style={{ color: '#B91C1C', fontWeight: 700 }}>Unsubscribed</span>
                            : item.treated_at ? <span style={{ color: '#15803D', fontWeight: 700 }}>Treated</span>
                            : <span style={{ color: '#92400E', fontWeight: 700 }}>Open</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {selectedId && (
        <div className="spc-overlay" onClick={closeDetail}>
          <div className="spc-modal" onClick={e => e.stopPropagation()}>
            <button className="spc-close" onClick={closeDetail} aria-label="Close">✕</button>
            {detailLoading || !detail || !editForm ? (
              <div className="spc-loading">{saveMsg || 'Loading...'}</div>
            ) : (
              <>
                <h2>{detail.property_address}</h2>
                <p className="sub">{detail.postcode || 'No postcode'} · {detail.city || 'Unknown location'} · {money(detail.asking_price)} · {detail.listing_duration_days ?? '?'} days on market</p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
                  <a className="spc-link" href={detail.rightmove_url} target="_blank" rel="noreferrer">View on Rightmove →</a>
                  {detail.letter_pdf_path && (
                    // Cache-bust with a fresh value on every render of a new
                    // `detail` (i.e. after a save/regenerate) — without it,
                    // this being the exact same URL as before let the browser
                    // (target="_blank" tab-reuse especially) show the
                    // pre-edit PDF instead of re-fetching, even with the
                    // server's own no-store header.
                    <a className="spc-link" href={`${API_BASE}/stale-listings/prospects-console/prospects/${detail.prospect_id}/letter.pdf?v=${Date.now()}`} target="_blank" rel="noreferrer">
                      Download letter PDF →
                    </a>
                  )}
                  <button className="spc-btn spc-btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => toggleTreated(detail.prospect_id, !detail.treated_at)}>
                    {detail.treated_at ? 'Marked treated — undo' : 'Mark as treated'}
                  </button>
                </div>
                {detail.is_edited && <p style={{ fontSize: 12, color: '#7C3AED', fontWeight: 700, margin: '0 0 10px' }}>This report has been edited from the original AI output.</p>}

                <div className="spc-tabs">
                  <button className={viewMode === 'preview' ? 'active' : ''} onClick={() => setViewMode('preview')}>Preview full report</button>
                  <button className={viewMode === 'edit' ? 'active' : ''} onClick={() => setViewMode('edit')}>Edit report</button>
                </div>

                {viewMode === 'preview' ? (
                  <>
                    <div style={{ margin: '4px 0 14px' }}>
                      <button className="spc-btn spc-btn-ghost" onClick={() => window.print()}>🖨 Print / save full report as PDF</button>
                    </div>
                    <div id="spc-print-target">
                      <div className="spc-preview-head">
                        {detail.image_url && <img src={detail.image_url} alt="" />}
                        <div>
                          <h3>{detail.property_address}</h3>
                          <p>{detail.postcode} · {detail.city} · {money(detail.asking_price)} · {detail.bedrooms ?? '?'} bed {detail.property_type || ''} · {detail.listing_duration_days ?? '?'} days on market</p>
                        </div>
                        <div className="spc-preview-score">
                          <b>{editForm.overall_score}</b><span>/ 100</span>
                        </div>
                      </div>

                      <div className="spc-preview-section">
                        <h4>Executive summary</h4>
                        <p>{editForm.executive_summary || '—'}</p>
                      </div>

                      <div className="spc-preview-section">
                        <h4>Scores</h4>
                        <div className="spc-preview-scores">
                          {(Object.keys(editForm.scores) as (keyof ReportEdit['scores'])[]).map(key => (
                            <div key={key} className="spc-preview-score-bar">
                              <span>{key}</span>
                              <div className="track"><div className="fill" style={{ width: `${editForm.scores[key]}%` }} /></div>
                              <b>{editForm.scores[key]}</b>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="spc-preview-section">
                        <h4>Key findings</h4>
                        {editForm.key_findings.length === 0 && <p className="spc-preview-empty">No findings.</p>}
                        {editForm.key_findings.map((f, i) => (
                          <div className="spc-preview-card" key={i}>
                            <b>{i + 1}. {f.title || 'Untitled finding'}</b>
                            <p>{f.description}</p>
                          </div>
                        ))}
                      </div>

                      <div className="spc-preview-section">
                        <h4>Action plan</h4>
                        {editForm.action_plan.length === 0 && <p className="spc-preview-empty">No actions.</p>}
                        {editForm.action_plan.map((a, i) => (
                          <div className="spc-preview-card" key={i}>
                            <b>{i + 1}. <span className={`spc-priority-tag p-${a.priority.toLowerCase()}`}>{a.priority}</span> {a.title || 'Untitled action'}</b>
                            <p>{a.description}</p>
                          </div>
                        ))}
                      </div>

                      <div className="spc-preview-section">
                        <h4>Pricing recommendation</h4>
                        <p><b>{editForm.pricing_recommendation || '—'}</b></p>
                        <p>{editForm.pricing_recommendation_detail}</p>
                      </div>

                      {editForm.comparable_sales.length > 0 && (
                        <div className="spc-preview-section">
                          <h4>Comparable sales</h4>
                          <table className="spc-preview-table">
                            <thead><tr><th>Address</th><th>Type</th><th>Beds</th><th>Sold / asking</th></tr></thead>
                            <tbody>
                              {editForm.comparable_sales.map((c, i) => (
                                <tr key={i}><td>{c.address}</td><td>{c.property_type}</td><td>{c.beds}</td><td>{c.sold_asking}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    <div className="spc-save-bar">
                      <button className="spc-btn spc-btn-ghost" onClick={closeDetail}>Close</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="spc-field">
                      <label>Executive summary</label>
                      <textarea value={editForm.executive_summary} onChange={e => setEditForm({ ...editForm, executive_summary: e.target.value })} />
                    </div>

                    <div className="spc-section-title">Scores</div>
                    <div className="spc-scores-grid">
                      <div className="spc-field spc-score-field"><label>Overall</label><input type="number" min={0} max={100} value={editForm.overall_score} onChange={e => setEditForm({ ...editForm, overall_score: Number(e.target.value) })} /></div>
                      {(Object.keys(editForm.scores) as (keyof ReportEdit['scores'])[]).map(key => (
                        <div className="spc-field spc-score-field" key={key}><label>{key}</label><input type="number" min={0} max={100} value={editForm.scores[key]} onChange={e => setEditForm({ ...editForm, scores: { ...editForm.scores, [key]: Number(e.target.value) } })} /></div>
                      ))}
                    </div>

                    <div className="spc-section-title">Key findings ({editForm.key_findings.length})</div>
                    {editForm.key_findings.map((f, i) => (
                      <div className="spc-repeat-item" key={i}>
                        <div className="spc-repeat-item-head"><b>Finding {i + 1}</b><button className="spc-remove" onClick={() => setEditForm({ ...editForm, key_findings: editForm.key_findings.filter((_, idx) => idx !== i) })}>Remove</button></div>
                        <div className="spc-field"><label>Title</label><input value={f.title} onChange={e => { const next = [...editForm.key_findings]; next[i] = { ...f, title: e.target.value }; setEditForm({ ...editForm, key_findings: next }); }} /></div>
                        <div className="spc-field"><label>Description</label><textarea value={f.description} onChange={e => { const next = [...editForm.key_findings]; next[i] = { ...f, description: e.target.value }; setEditForm({ ...editForm, key_findings: next }); }} /></div>
                      </div>
                    ))}
                    <button className="spc-add" onClick={() => setEditForm({ ...editForm, key_findings: [...editForm.key_findings, { title: '', description: '', type: 'issue' }] })}>+ Add finding</button>

                    <div className="spc-section-title">Action plan ({editForm.action_plan.length})</div>
                    {editForm.action_plan.map((a, i) => (
                      <div className="spc-repeat-item" key={i}>
                        <div className="spc-repeat-item-head"><b>Action {i + 1}</b><button className="spc-remove" onClick={() => setEditForm({ ...editForm, action_plan: editForm.action_plan.filter((_, idx) => idx !== i) })}>Remove</button></div>
                        <div className="spc-row2">
                          <div className="spc-field"><label>Priority</label>
                            <select value={a.priority} onChange={e => { const next = [...editForm.action_plan]; next[i] = { ...a, priority: e.target.value }; setEditForm({ ...editForm, action_plan: next }); }}>
                              <option>URGENT</option><option>HIGH</option><option>MEDIUM</option>
                            </select>
                          </div>
                          <div className="spc-field"><label>Title</label><input value={a.title} onChange={e => { const next = [...editForm.action_plan]; next[i] = { ...a, title: e.target.value }; setEditForm({ ...editForm, action_plan: next }); }} /></div>
                        </div>
                        <div className="spc-field"><label>Description</label><textarea value={a.description} onChange={e => { const next = [...editForm.action_plan]; next[i] = { ...a, description: e.target.value }; setEditForm({ ...editForm, action_plan: next }); }} /></div>
                      </div>
                    ))}
                    <button className="spc-add" onClick={() => setEditForm({ ...editForm, action_plan: [...editForm.action_plan, { priority: 'MEDIUM', title: '', description: '', bullets: [] }] })}>+ Add action</button>

                    <div className="spc-section-title">Pricing</div>
                    <div className="spc-field"><label>Recommendation (headline)</label><input value={editForm.pricing_recommendation} onChange={e => setEditForm({ ...editForm, pricing_recommendation: e.target.value })} /></div>
                    <div className="spc-field"><label>Recommendation (detail)</label><textarea value={editForm.pricing_recommendation_detail} onChange={e => setEditForm({ ...editForm, pricing_recommendation_detail: e.target.value })} /></div>

                    <div className="spc-section-title">Comparable sales ({editForm.comparable_sales.length})</div>
                    {editForm.comparable_sales.map((c, i) => (
                      <div className="spc-repeat-item" key={i}>
                        <div className="spc-repeat-item-head"><b>Comparable {i + 1}</b><button className="spc-remove" onClick={() => setEditForm({ ...editForm, comparable_sales: editForm.comparable_sales.filter((_, idx) => idx !== i) })}>Remove</button></div>
                        <div className="spc-row2">
                          <div className="spc-field"><label>Address</label><input value={c.address} onChange={e => { const next = [...editForm.comparable_sales]; next[i] = { ...c, address: e.target.value }; setEditForm({ ...editForm, comparable_sales: next }); }} /></div>
                          <div className="spc-field"><label>Sold / asking</label><input value={c.sold_asking} onChange={e => { const next = [...editForm.comparable_sales]; next[i] = { ...c, sold_asking: e.target.value }; setEditForm({ ...editForm, comparable_sales: next }); }} /></div>
                        </div>
                      </div>
                    ))}
                    <button className="spc-add" onClick={() => setEditForm({ ...editForm, comparable_sales: [...editForm.comparable_sales, { address: '', beds: '', property_type: '', sold_asking: '' }] })}>+ Add comparable</button>

                    <div className="spc-save-bar">
                      {saveMsg && <span className="spc-save-msg">{saveMsg}</span>}
                      <button className="spc-btn spc-btn-ghost" onClick={closeDetail}>Close</button>
                      <button className="spc-btn spc-btn-primary" disabled={saving} onClick={saveEdit}>{saving ? 'Saving...' : 'Save & regenerate letter'}</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showManual && (
        <div className="spc-overlay" onClick={closeManual}>
          <div className="spc-modal spc-modal-sm" onClick={e => e.stopPropagation()}>
            <button className="spc-close" onClick={closeManual} aria-label="Close">✕</button>
            <h2>Add a prospect manually</h2>
            <p className="sub">For a listing that meets every criterion except having a clean, scrapeable address — type the real address in and it's used exactly as entered on the report and letter.</p>

            {manualSuccess ? (
              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: 16 }}>
                <p style={{ margin: '0 0 8px', fontWeight: 800, color: '#047857' }}>Created — property code {manualSuccess.property_code}</p>
                <a className="spc-link" href={manualSuccess.preview_url} target="_blank" rel="noreferrer">Open QR landing page →</a>
                <p style={{ fontSize: 12, color: '#8A8F98', margin: '8px 0 0' }}>That's the same page a scanned letter opens — it walks through confirm/payment like a real recipient would. Use "Preview full report" on the property card for the report/letter content itself.</p>
                <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                  <button className="spc-btn spc-btn-ghost" onClick={() => setManualSuccess(null)}>Add another</button>
                  <button className="spc-btn spc-btn-primary" onClick={closeManual}>Done</button>
                </div>
              </div>
            ) : (
              <>
                <div className="spc-field"><label>Rightmove URL</label><input value={manualForm.rightmove_url} onChange={e => setManualForm({ ...manualForm, rightmove_url: e.target.value })} placeholder="https://www.rightmove.co.uk/properties/..." /></div>
                <div className="spc-field"><label>Building name / number (optional)</label><input value={manualForm.building_name_or_number} onChange={e => setManualForm({ ...manualForm, building_name_or_number: e.target.value })} placeholder="The Old Rectory / 14" /></div>
                <div className="spc-field"><label>Street</label><input value={manualForm.street} onChange={e => setManualForm({ ...manualForm, street: e.target.value })} placeholder="Church Lane" /></div>
                <div className="spc-row2">
                  <div className="spc-field"><label>City</label><input value={manualForm.city} onChange={e => setManualForm({ ...manualForm, city: e.target.value })} placeholder="Manchester" /></div>
                  <div className="spc-field"><label>Postcode</label><input value={manualForm.postcode} onChange={e => setManualForm({ ...manualForm, postcode: e.target.value.toUpperCase() })} placeholder="M20 3AB" /></div>
                </div>
                <div className="spc-field"><label>County (optional)</label><input value={manualForm.county} onChange={e => setManualForm({ ...manualForm, county: e.target.value })} /></div>
                <div className="spc-row2">
                  <div className="spc-field"><label>Asking price (optional — read from listing if blank)</label><input type="number" value={manualForm.asking_price} onChange={e => setManualForm({ ...manualForm, asking_price: e.target.value })} /></div>
                  <div className="spc-field"><label>Days on market</label><input type="number" value={manualForm.listing_duration_days} onChange={e => setManualForm({ ...manualForm, listing_duration_days: e.target.value })} /></div>
                </div>
                {manualError && <p style={{ color: '#B91C1C', fontWeight: 700, fontSize: 13 }}>{manualError}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button className="spc-btn spc-btn-ghost" onClick={closeManual}>Cancel</button>
                  <button className="spc-btn spc-btn-primary" disabled={manualSubmitting} onClick={submitManual}>{manualSubmitting ? 'Generating report & letter...' : 'Generate report & letter'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

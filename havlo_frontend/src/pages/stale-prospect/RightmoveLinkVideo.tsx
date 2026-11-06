import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject, type CSSProperties } from 'react';
import { createPortal, flushSync } from 'react-dom';

// "▶ Watch how to find your Rightmove link · 15 sec", under the listing-link
// box on the pages where visitors paste their link: the ads pages
// (/assess, /g, /rm, /review; sellers and agents, AdsLanding.tsx), and /sell
// and /stale-listings/seller (StaleListingsLanding.tsx). It opens a player with the 15-second demo:
// a dialog beside the steps on a computer, the whole screen on a phone.
// "Got it, paste my link" closes it and puts the visitor in the box.

const VIDEO_MP4 = '/videos/rightmove-link-demo.mp4';
// For browsers without H.264 (some Linux builds of Chromium); MP4 first for Safari.
const VIDEO_WEBM = '/videos/rightmove-link-demo.webm';
const VIDEO_POSTER = '/videos/rightmove-link-demo-poster.jpg';

type TawkApi = { hideWidget?: () => void; showWidget?: () => void };

// The live-chat bubble sits above everything else on the page; keep it out of
// the way of the player's buttons while it's open.
function setChatBubbleHidden(hidden: boolean) {
  const api = (window as unknown as { Tawk_API?: TawkApi }).Tawk_API;
  try {
    if (hidden) api?.hideWidget?.();
    else api?.showWidget?.();
  } catch {
    // The chat widget isn't loaded yet.
  }
}

export const WatchRightmoveLinkVideo = ({
  align = 'center',
  onPasteLink,
  className = '',
  style,
}: {
  /** "start" where the form is left-aligned (/sell). */
  align?: 'center' | 'start';
  /** "Got it, paste my link": usually focuses the listing-link box. */
  onPasteLink?: () => void;
  className?: string;
  style?: CSSProperties;
}) => {
  // Mounted on the first open and kept, so later opens play at once.
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const show = () => {
    // Rendered synchronously so play() runs inside the tap itself: phones only
    // allow a video to start with sound from a tap.
    flushSync(() => {
      setMounted(true);
      setOpen(true);
    });
    const video = videoRef.current;
    if (video) {
      try { video.currentTime = 0; } catch { /* metadata not loaded yet */ }
      void video.play().catch(() => {
        // Refused (an autoplay rule): the controls are there to press play.
      });
    }
  };

  const hide = (thenPaste: boolean) => {
    videoRef.current?.pause();
    setOpen(false);
    if (thenPaste && onPasteLink) onPasteLink();
    else openerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        className={`rlv-link rlv-link-${align}${className ? ` ${className}` : ''}`}
        style={style}
        onClick={show}
        aria-haspopup="dialog"
      >
        <span className="rlv-play" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
        </span>
        <span className="rlv-label">
          <span className="rlv-label-long">Watch how to find your Rightmove link</span>
          <span className="rlv-label-short">Watch how to find your link</span>
        </span>
        <span className="rlv-length">15 sec</span>
      </button>
      {mounted &&
        createPortal(
          <RightmoveLinkVideoDialog open={open} videoRef={videoRef} onClose={() => hide(false)} onPasteLink={() => hide(true)} />,
          document.body,
        )}
      <RightmoveLinkVideoStyles />
    </>
  );
};

const RightmoveLinkVideoDialog = ({
  open,
  videoRef,
  onClose,
  onPasteLink,
}: {
  open: boolean;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  onClose: () => void;
  onPasteLink: () => void;
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // While open: the page behind doesn't scroll, the chat bubble steps aside,
  // Escape closes, and focus starts on the close button.
  useEffect(() => {
    if (!open) return undefined;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    setChatBubbleHidden(true);
    closeRef.current?.focus();
    // Capture phase: the video's own controls keep Escape to themselves once
    // they have focus, so listening as it bubbles would miss it there.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = overflow;
      setChatBubbleHidden(false);
      document.removeEventListener('keydown', onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Tab stays inside the dialog.
  const keepFocusInside = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items: HTMLElement[] = [];
    panelRef.current
      .querySelectorAll<HTMLElement>('button, video[controls], [href], [tabindex]:not([tabindex="-1"])')
      .forEach((el) => { if (!el.hasAttribute('disabled')) items.push(el); });
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="rlv-overlay" hidden={!open} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={panelRef}
        className="rlv-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={keepFocusInside}
      >
        <button ref={closeRef} type="button" className="rlv-close" onClick={onClose} aria-label="Close the video">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <video
          ref={videoRef}
          className="rlv-video"
          poster={VIDEO_POSTER}
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
          aria-label="How to find your Rightmove link (15-second video)"
        >
          <source src={VIDEO_MP4} type="video/mp4" />
          <source src={VIDEO_WEBM} type="video/webm" />
        </video>
        <div className="rlv-copy">
          <p className="rlv-eyebrow">15-second guide</p>
          <h2 id={titleId} className="rlv-title">How to find your Rightmove link</h2>
          <ol className="rlv-steps">
            <li>Find your home on Rightmove</li>
            <li>Tap share, then Copy link</li>
            <li>Come back here and paste it</li>
          </ol>
          <button type="button" className="rlv-done" onClick={onPasteLink}>Got it, paste my link</button>
        </div>
      </div>
    </div>
  );
};

const RightmoveLinkVideoStyles = () => (
  <style>{`
    .rlv-link{display:flex;width:fit-content;max-width:100%;align-items:center;gap:10px;min-height:44px;margin:10px auto 0;padding:4px 10px;background:none;border:none;border-radius:10px;cursor:pointer;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;line-height:1.3;color:#1F1F1E;text-align:left}
    .rlv-link-start{margin:0;padding-left:0}
    .rlv-link:hover .rlv-label{text-decoration:underline;text-underline-offset:3px}
    .rlv-link:focus-visible{outline:2px solid #A409D2;outline-offset:2px}
    .rlv-play{flex:none;width:30px;height:30px;border-radius:50%;background:#A409D2;color:#fff;display:inline-flex;align-items:center;justify-content:center}
    .rlv-play svg{margin-left:2px}
    .rlv-label-short{display:none}
    .rlv-length{flex:none;font-weight:500;color:#5B6474}
    .rlv-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(16,10,22,.72);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
    .rlv-overlay[hidden]{display:none}
    .rlv-dialog{position:relative;display:flex;align-items:center;gap:32px;max-width:780px;max-height:calc(100vh - 48px);padding:24px 40px 24px 24px;box-sizing:border-box;background:#fff;border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.35);font-family:'Inter',sans-serif;text-align:left}
    .rlv-video{display:block;flex:none;height:min(533px,calc(100vh - 96px));width:auto;aspect-ratio:9/16;border-radius:14px;background:#A409D2;object-fit:contain}
    .rlv-copy{display:flex;flex-direction:column;gap:16px;max-width:340px}
    .rlv-eyebrow{margin:0;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#A409D2}
    .rlv-title{margin:0;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:30px;line-height:115%;letter-spacing:-.02em;color:#1F1F1E}
    .rlv-steps{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px;list-style:decimal;font-size:15px;line-height:1.5;color:#344054}
    .rlv-steps li{display:list-item}
    .rlv-steps li::marker{color:#A409D2;font-weight:700}
    .rlv-done{margin-top:6px;height:52px;border:none;border-radius:12px;background:#0A0A0A;color:#fff;font-family:'Inter',sans-serif;font-weight:700;font-size:16px;cursor:pointer}
    .rlv-close{position:absolute;top:12px;right:12px;width:44px;height:44px;border-radius:50%;border:none;background:#F2F4F7;color:#1F1F1E;display:flex;align-items:center;justify-content:center;cursor:pointer}
    .rlv-done:focus-visible,.rlv-close:focus-visible{outline:2px solid #A409D2;outline-offset:2px}
    @media (max-width: 640px){
      .rlv-label-long{display:none}
      .rlv-label-short{display:inline}
      .rlv-overlay{padding:0;background:#12091A;align-items:stretch}
      .rlv-dialog{flex-direction:column;align-items:center;gap:0;width:100%;max-width:none;max-height:none;height:100%;padding:12px 16px calc(20px + env(safe-area-inset-bottom));border-radius:0;background:#12091A;box-shadow:none;overflow-y:auto}
      .rlv-close{top:10px;right:12px;background:rgba(255,255,255,.14);color:#fff}
      .rlv-copy{display:contents}
      .rlv-eyebrow{order:-2;align-self:flex-start;min-height:44px;display:flex;align-items:center;color:#E7C6F5}
      .rlv-title{order:-1;margin:2px 0 14px;font-size:22px;color:#fff;text-align:center}
      .rlv-steps{display:none}
      .rlv-video{width:min(100%,calc((100vh - 210px) * .5625));width:min(100%,calc((100dvh - 210px) * .5625));height:auto;aspect-ratio:9/16;border-radius:16px}
      .rlv-done{order:1;align-self:stretch;flex:none;margin-top:16px;background:#fff;color:#0A0A0A}
    }
  `}</style>
);

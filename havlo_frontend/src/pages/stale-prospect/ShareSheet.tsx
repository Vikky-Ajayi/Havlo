import { useEffect, useRef, useState, type ReactNode } from 'react';

// Share a link by WhatsApp, Instagram, X, Facebook, TikTok, Snapchat, email or
// by copying it. Instagram and TikTok have no way for a website to hand them a
// link, so on phones they go through the phone's own share sheet (which lists
// both apps); elsewhere the link is copied and the app's site opened to paste
// it into.

const enc = encodeURIComponent;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / no permission: the textarea fallback.
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

const canNativeShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

const Icon = ({ children, bg }: { children: ReactNode; bg: string }) => (
  <span className="shs-icon" style={{ background: bg }} aria-hidden="true">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  </span>
);

type Channel = { key: string; label: string; icon: ReactNode };

const CHANNELS: Channel[] = [
  {
    key: 'whatsapp', label: 'WhatsApp',
    icon: (
      <Icon bg="#25D366">
        <path d="M4.5 19.5l1.2-3.6A7.5 7.5 0 1 1 8.4 18.6z" />
        <path d="M9.3 8.8c.2 2.4 2.5 4.7 4.9 4.9l1-1.1 1.5.7-.3 1.4c-3.8.3-7.7-3.6-7.4-7.4l1.4-.3.7 1.5z" fill="#fff" stroke="none" />
      </Icon>
    ),
  },
  {
    key: 'instagram', label: 'Instagram',
    icon: (
      <Icon bg="linear-gradient(45deg,#F58529,#DD2A7B 50%,#8134AF 75%,#515BD4)">
        <rect x="4" y="4" width="16" height="16" rx="4.5" />
        <circle cx="12" cy="12" r="3.8" />
        <circle cx="17" cy="7" r="0.9" fill="#fff" stroke="none" />
      </Icon>
    ),
  },
  {
    key: 'x', label: 'X (Twitter)',
    icon: (
      <Icon bg="#000">
        <path d="M5 5l14 14M19 5L5 19" strokeWidth="2.4" />
      </Icon>
    ),
  },
  {
    key: 'facebook', label: 'Facebook',
    icon: (
      <Icon bg="#1877F2">
        <path d="M13.5 20v-7h2.4l.4-2.8h-2.8V8.6c0-.8.3-1.4 1.4-1.4h1.5V4.8a19 19 0 0 0-2.2-.1c-2.2 0-3.6 1.3-3.6 3.7v1.8H8.2V13h2.4v7" fill="#fff" stroke="none" />
      </Icon>
    ),
  },
  {
    key: 'tiktok', label: 'TikTok',
    icon: (
      <Icon bg="#000">
        <path d="M14.5 4v10.2a3.3 3.3 0 1 1-3.3-3.3" strokeWidth="2.2" />
        <path d="M14.5 4c.4 2.3 2 3.8 4.3 4" strokeWidth="2.2" />
      </Icon>
    ),
  },
  {
    key: 'snapchat', label: 'Snapchat',
    icon: (
      <span className="shs-icon" style={{ background: '#FFFC00' }} aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" stroke="#111" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M12 4c2.8 0 4.6 2 4.6 4.6v2.1l1.6-.5c.5 0 .7.6.2.9l-1.7.9c.4 1.7 1.7 3 3.1 3.5-.2.6-1.2.9-2.2 1-.2.5-.1 1-.5 1.1-.6.2-1.4-.2-2.3 0-.9.3-1.6 1.3-2.8 1.3s-1.9-1-2.8-1.3c-.9-.2-1.7.2-2.3 0-.4-.1-.3-.6-.5-1.1-1-.1-2-.4-2.2-1 1.4-.5 2.7-1.8 3.1-3.5l-1.7-.9c-.5-.3-.3-.9.2-.9l1.6.5V8.6C7.4 6 9.2 4 12 4z" />
        </svg>
      </span>
    ),
  },
  {
    key: 'email', label: 'Email',
    icon: (
      <Icon bg="#6B7280">
        <rect x="3.5" y="6" width="17" height="12" rx="2" />
        <path d="M4 7l8 6 8-6" />
      </Icon>
    ),
  },
  {
    key: 'copy', label: 'Copy link',
    icon: (
      <Icon bg="#A409D2">
        <path d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1.1 1.1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.1-1.1" />
      </Icon>
    ),
  },
];

export const ShareSheet = ({
  url,
  title,
  text,
  subtitle,
  error,
  onClose,
}: {
  url: string | null;
  title: string;
  text: string;
  subtitle?: string;
  error?: string;
  onClose: () => void;
}) => {
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const flash = (message: string) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 3500);
  };
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const share = async (key: string) => {
    if (!url) return;
    const open = (href: string) => window.open(href, '_blank', 'noopener,noreferrer');
    switch (key) {
      case 'whatsapp':
        open(`https://wa.me/?text=${enc(`${text} ${url}`)}`);
        return;
      case 'x':
        open(`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`);
        return;
      case 'facebook':
        open(`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`);
        return;
      case 'snapchat':
        open(`https://www.snapchat.com/scan?attachmentUrl=${enc(url)}`);
        return;
      case 'email':
        window.location.href = `mailto:?subject=${enc(title)}&body=${enc(`${text}\n\n${url}`)}`;
        return;
      case 'instagram':
      case 'tiktok': {
        const app = key === 'instagram' ? 'Instagram' : 'TikTok';
        if (canNativeShare()) {
          try {
            await navigator.share({ title, text, url });
            return;
          } catch (err) {
            if ((err as Error).name === 'AbortError') return;
          }
        }
        const copied = await copyText(url);
        flash(copied ? `Link copied. Paste it into a ${app} message or story.` : 'Copy the link below to share it.');
        open(key === 'instagram' ? 'https://www.instagram.com/' : 'https://www.tiktok.com/');
        return;
      }
      default: {
        const copied = await copyText(url);
        flash(copied ? 'Link copied.' : 'Copy the link below to share it.');
      }
    }
  };

  return (
    <div className="shs-backdrop" role="presentation" onClick={onClose}>
      <div className="shs-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="shs-head">
          <h2>{title}</h2>
          <button type="button" className="shs-close" aria-label="Close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {subtitle && <p className="shs-sub">{subtitle}</p>}
        {error ? (
          <p className="shs-error">{error}</p>
        ) : (
          <>
            <ul className="shs-grid">
              {CHANNELS.map((c) => (
                <li key={c.key}>
                  <button type="button" disabled={!url} onClick={() => share(c.key)}>
                    {c.icon}
                    <span>{c.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="shs-link">
              <input readOnly value={url || 'Creating your link…'} onFocus={(e) => e.target.select()} aria-label="Share link" />
              <button type="button" disabled={!url} onClick={() => share('copy')}>Copy</button>
            </div>
          </>
        )}
        {notice && <p className="shs-notice" role="status">{notice}</p>}
      </div>
      <style>{`
        .shs-backdrop{position:fixed;inset:0;background:rgba(17,17,17,.45);display:flex;align-items:center;justify-content:center;z-index:2000000001;padding:16px}
        .shs-sheet{background:#fff;border-radius:20px;width:100%;max-width:460px;padding:22px 22px 20px;box-shadow:0 20px 60px rgba(0,0,0,.18);font-family:'Inter',sans-serif}
        .shs-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .shs-head h2{margin:0;font-size:19px;font-weight:800;color:#202124;letter-spacing:-0.01em}
        .shs-close{background:#f3f4f6;border:none;border-radius:999px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#344054}
        .shs-sub{margin:8px 0 0;color:#556274;font-size:14px;line-height:1.5}
        .shs-error{margin:16px 0 0;color:#c02626;font-size:14px}
        .shs-grid{list-style:none;margin:18px 0 0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:14px 8px}
        .shs-grid button{width:100%;background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:7px;padding:4px 0;font-family:inherit;color:#344054;font-size:12.5px;font-weight:600}
        .shs-grid button:disabled{opacity:.45;cursor:default}
        .shs-grid button:not(:disabled):hover .shs-icon{transform:translateY(-2px)}
        .shs-icon{width:52px;height:52px;border-radius:999px;display:flex;align-items:center;justify-content:center;transition:transform .15s ease}
        .shs-link{display:flex;gap:8px;margin-top:20px}
        .shs-link input{flex:1;min-width:0;border:1px solid #e4e6eb;background:#f7f8fa;border-radius:10px;padding:11px 12px;font-size:13px;color:#344054;font-family:inherit}
        .shs-link button{border:none;background:#0a0a0a;color:#fff;border-radius:10px;padding:0 18px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit}
        .shs-link button:disabled{opacity:.5;cursor:default}
        .shs-notice{margin:12px 0 0;color:#0E7D4C;font-size:13.5px;font-weight:600}
        @media (max-width:560px){
          .shs-backdrop{align-items:flex-end;padding:0}
          .shs-sheet{max-width:none;border-radius:20px 20px 0 0;padding:20px 16px calc(18px + env(safe-area-inset-bottom))}
          .shs-icon{width:48px;height:48px}
        }
      `}</style>
    </div>
  );
};

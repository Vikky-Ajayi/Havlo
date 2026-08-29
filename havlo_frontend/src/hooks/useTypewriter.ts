import { useEffect, useState } from 'react';

interface TypewriterOptions {
  typingSpeedMs?: number;
  deletingSpeedMs?: number;
  pauseAfterTypedMs?: number;
  pauseAfterDeletedMs?: number;
}

/**
 * Continuously types out `text`, pauses, deletes it, pauses, then retypes —
 * looping forever. Respects prefers-reduced-motion by returning the full,
 * static text with no animation.
 */
export function useTypewriter(text: string, options: TypewriterOptions = {}): string {
  const {
    typingSpeedMs = 125,
    deletingSpeedMs = 65,
    pauseAfterTypedMs = 1800,
    pauseAfterDeletedMs = 500,
  } = options;

  const prefersReducedMotion = useMemoPrefersReducedMotion();
  const [length, setLength] = useState(prefersReducedMotion ? text.length : 0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) return;

    let timeoutId: number;

    if (!deleting && length < text.length) {
      timeoutId = window.setTimeout(() => setLength((l) => l + 1), typingSpeedMs);
    } else if (!deleting && length === text.length) {
      timeoutId = window.setTimeout(() => setDeleting(true), pauseAfterTypedMs);
    } else if (deleting && length > 0) {
      timeoutId = window.setTimeout(() => setLength((l) => l - 1), deletingSpeedMs);
    } else {
      timeoutId = window.setTimeout(() => setDeleting(false), pauseAfterDeletedMs);
    }

    return () => window.clearTimeout(timeoutId);
  }, [length, deleting, text, typingSpeedMs, deletingSpeedMs, pauseAfterTypedMs, pauseAfterDeletedMs, prefersReducedMotion]);

  return text.slice(0, length);
}

function useMemoPrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefers(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefers(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return prefers;
}

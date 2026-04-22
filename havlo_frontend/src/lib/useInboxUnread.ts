import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { buildWsUrl, type Conversation, type AdminConversation } from './api';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const cacheKey = (token: string, isAdmin: boolean) =>
  `havlo:inbox:conversations:${isAdmin ? 'admin' : 'user'}:${token.slice(-12)}`;

export const readCachedConversations = (
  token: string,
  isAdmin: boolean,
): (Conversation | AdminConversation)[] => {
  try {
    const raw = sessionStorage.getItem(cacheKey(token, isAdmin));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeCachedConversations = (
  token: string,
  isAdmin: boolean,
  rows: (Conversation | AdminConversation)[],
) => {
  try {
    sessionStorage.setItem(cacheKey(token, isAdmin), JSON.stringify(rows));
  } catch {
    // ignore quota errors
  }
};

const sumUnread = (rows: { unread_count?: number }[]): number =>
  rows.reduce((acc, r) => acc + (r.unread_count || 0), 0);

export const useInboxUnread = () => {
  const { token, user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const [count, setCount] = useState<number>(() => {
    if (!token) return 0;
    return sumUnread(readCachedConversations(token, isAdmin));
  });
  const tokenRef = useRef(token);
  const adminRef = useRef(isAdmin);

  useEffect(() => {
    tokenRef.current = token;
    adminRef.current = isAdmin;
  }, [token, isAdmin]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const path = isAdmin
        ? '/messaging/admin/conversations'
        : '/messaging/conversations';
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const rows = (Array.isArray(data) ? data : []) as (Conversation | AdminConversation)[];
      writeCachedConversations(token, isAdmin, rows);
      setCount(sumUnread(rows));
    } catch {
      // ignore network errors – keep cached value
    }
  }, [token, isAdmin]);

  // Hydrate from cache when token/admin changes, then fetch fresh.
  useEffect(() => {
    if (!token) {
      setCount(0);
      return;
    }
    setCount(sumUnread(readCachedConversations(token, isAdmin)));
    refresh();
  }, [token, isAdmin, refresh]);

  // Poll every 20s as fallback.
  useEffect(() => {
    if (!token) return;
    const id = window.setInterval(() => {
      refresh();
    }, 20000);
    return () => window.clearInterval(id);
  }, [token, refresh]);

  // Refresh whenever the inbox page broadcasts an update.
  useEffect(() => {
    if (!token) return;
    const handler = () => {
      if (!tokenRef.current) return;
      setCount(sumUnread(readCachedConversations(tokenRef.current, adminRef.current)));
    };
    window.addEventListener('havlo:inbox-updated', handler);
    return () => window.removeEventListener('havlo:inbox-updated', handler);
  }, [token]);

  // Listen on WebSocket for new messages (non-admin only).
  useEffect(() => {
    if (!token || isAdmin) return;
    let ws: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    const wsUrl = `${buildWsUrl('/messaging/ws/inbox')}?token=${encodeURIComponent(token)}`;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
        }, 20000);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'new_message') refresh();
        } catch {
          // ignore
        }
      };
      ws.onclose = () => {
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        if (!closed) reconnectTimer = setTimeout(connect, 4000);
      };
      ws.onerror = () => ws?.close();
    };
    connect();
    return () => {
      closed = true;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [token, isAdmin, refresh]);

  return { count, refresh };
};

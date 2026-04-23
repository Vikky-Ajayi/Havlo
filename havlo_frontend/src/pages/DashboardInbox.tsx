import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { ChevronLeft, Mail, MoreVertical, Pencil, SendHorizontal, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, buildWsUrl, type Conversation, type ConversationDetail, type AdminConversation, type AdminUser } from '../lib/api';
import { readCachedConversations, writeCachedConversations } from '../lib/useInboxUnread';

const broadcastInboxUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('havlo:inbox-updated'));
  }
};

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

type InboxConversation = Conversation & {
  user_full_name?: string;
  user_email?: string;
};

type LoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'unauthorized' | 'server' | 'network' | 'timeout';

const adminToInbox = (c: AdminConversation): InboxConversation => ({
  ...c,
  user_full_name: c.user.full_name,
  user_email: c.user.email,
});

export const DashboardInbox: React.FC = () => {
  const { token, user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const [adminTab, setAdminTab] = useState<'recent' | 'users'>('recent');
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [conversations, setConversations] = useState<InboxConversation[]>(() => {
    if (!token) return [];
    const cached = readCachedConversations(token, !!user?.is_admin);
    if (!cached.length) return [];
    return cached.map((c) =>
      'user' in (c as AdminConversation) ? adminToInbox(c as AdminConversation) : (c as InboxConversation),
    );
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(() => {
    if (!token) return true;
    return readCachedConversations(token, !!user?.is_admin).length === 0;
  });
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [sendError, setSendError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailCacheRef = useRef<Record<string, ConversationDetail>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  const loadTimeoutRef = useRef<number | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!menuOpenId) return;
    const close = () => setMenuOpenId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpenId]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const loadConversations = async () => {
    if (!token) return;
    const controller = new AbortController();
    const requestTimeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      if (isAdmin) {
        const res = await fetch(`${API_BASE}/messaging/admin/conversations`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
          },
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (res.status === 401 || res.status === 403) {
          setLoadState('unauthorized');
          setLoadError('Your session has expired. Please log in again.');
          setConversations([]);
          return;
        }
        if (!res.ok) {
          setLoadState('server');
          setLoadError((data && (data.detail || data.message)) || 'Server error while loading conversations.');
          setConversations([]);
          return;
        }
        const rows = (Array.isArray(data) ? data : []) as AdminConversation[];
        setConversations(rows.map(adminToInbox));
        writeCachedConversations(token, isAdmin, rows);
        broadcastInboxUpdate();
        if (rows.length === 0) {
          setLoadState('empty');
          setLoadError('');
        } else {
          setLoadState('ready');
          setLoadError('');
        }
      } else {
        const res = await fetch(`${API_BASE}/messaging/conversations`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
          },
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (res.status === 401 || res.status === 403) {
          setLoadState('unauthorized');
          setLoadError('Your session has expired. Please log in again.');
          setConversations([]);
          return;
        }
        if (res.status >= 500) {
          setLoadState('server');
          setLoadError((data && (data.detail || data.message)) || 'Server error while loading conversations.');
          setConversations([]);
          return;
        }
        if (!res.ok) {
          setLoadState('network');
          setLoadError((data && (data.detail || data.message)) || 'Could not load conversations.');
          setConversations([]);
          return;
        }
        const rows = (Array.isArray(data) ? data : []) as Conversation[];
        setConversations(rows);
        writeCachedConversations(token, isAdmin, rows);
        broadcastInboxUpdate();
        if (rows.length === 0) {
          setLoadState('empty');
          setLoadError('');
        } else {
          setLoadState('ready');
          setLoadError('');
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setLoadState('timeout');
        setLoadError('Loading took too long. Please refresh.');
      } else {
        setLoadState('network');
        setLoadError(err instanceof Error ? err.message : 'Network error while loading conversations.');
      }
      setConversations([]);
    } finally {
      clearTimeout(requestTimeout);
    }
  };

  const loadConversationDetail = async (conversationId: string, opts: { silent?: boolean } = {}) => {
    if (!token) return;
    const { silent } = opts;
    const hasCache = !!detailCacheRef.current[conversationId];
    if (!silent && !hasCache) {
      setDetailLoading(true);
      setDetailError('');
    }
    try {
      const payload = isAdmin
        ? await api.adminGetConversation(token, conversationId)
        : await api.getConversation(token, conversationId);
      detailCacheRef.current[conversationId] = payload;
      if (selectedIdRef.current === conversationId) {
        setDetail(payload);
        setDetailError('');
      }
    } catch (err: unknown) {
      if (selectedIdRef.current === conversationId) {
        setDetailError(err instanceof Error ? err.message : 'Could not load messages.');
        if (!silent && !hasCache) setDetail(null);
      }
      throw err;
    } finally {
      if (!silent && !hasCache && selectedIdRef.current === conversationId) {
        setDetailLoading(false);
      }
    }
  };

  const loadAdminUsers = async (q?: string) => {
    if (!token || !isAdmin) return;
    setAdminUsersLoading(true);
    setAdminUsersError('');
    try {
      const rows = await api.adminListUsers(token, { q: q?.trim() || undefined, only_with_threads: false });
      setAdminUsers(rows);
    } catch (err: unknown) {
      setAdminUsersError(err instanceof Error ? err.message : 'Failed to load users.');
      setAdminUsers([]);
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const startAdminConversationForUser = async (targetUser: AdminUser) => {
    if (!token) return;
    const resp = await api.adminStartConversation(token, {
      user_id: targetUser.id,
      sender_name: 'Havlo Advisory',
      team_member_initials: 'HA',
      team_member_color: '#0052B4',
      subject: `Conversation with ${targetUser.full_name || targetUser.email}`,
      initial_message: '',
    });
    setSelectedId(resp.id);
    setAdminTab('recent');
  };

  useEffect(() => {
    if (!token) return;
    const hasCached = readCachedConversations(token, isAdmin).length > 0;
    if (!hasCached) {
      setLoading(true);
      setLoadState('loading');
    } else {
      setLoading(false);
      setLoadState('ready');
    }
    if (loadTimeoutRef.current) {
      window.clearTimeout(loadTimeoutRef.current);
    }
    if (!hasCached) {
      loadTimeoutRef.current = window.setTimeout(() => {
        setLoading(false);
        setLoadState((prev) => (prev === 'loading' ? 'timeout' : prev));
        setLoadError((prev) => prev || 'Loading took too long. Please refresh.');
      }, 10000);
    }
    (async () => {
      await loadConversations();
      if (isAdmin) {
        await loadAdminUsers('');
      }
      setLoading(false);
      if (loadTimeoutRef.current) {
        window.clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    })();
    return () => {
      if (loadTimeoutRef.current) {
        window.clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError('');
      setDetailLoading(false);
      return;
    }
    if (!token) return;
    const cached = detailCacheRef.current[selectedId];
    if (cached) {
      setDetail(cached);
      setDetailError('');
      setDetailLoading(false);
      loadConversationDetail(selectedId, { silent: true }).catch(() => {});
    } else {
      setDetail(null);
      loadConversationDetail(selectedId).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, token, isAdmin]);

  useEffect(() => {
    if (!detail?.messages?.length) return;
    // Auto-scroll to the latest message whenever the visible list changes.
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, [detail?.messages]);

  // When opening a different conversation, instantly jump to the bottom (no smooth scroll).
  useEffect(() => {
    if (!selectedId || !detail?.id || detail.id !== selectedId) return;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ block: 'end' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, detail?.id]);

  // User WebSocket for real-time updates.
  useEffect(() => {
    if (!token || isAdmin) return;
    let ws: WebSocket | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const wsUrl = `${buildWsUrl('/messaging/ws/inbox')}?token=${encodeURIComponent(token)}`;

    const connectWs = () => {
      if (closed) return;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        pingInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20000);
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event !== 'new_message') return;
          const convId = data.conversation_id as string;
          const msg = data.message;

          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== convId) return c;
              const isActive = selectedIdRef.current === convId;
              return {
                ...c,
                last_message_at: msg.created_at,
                last_message_snippet: msg.content?.slice(0, 60) ?? null,
                unread_count: isActive ? c.unread_count : (c.unread_count ?? 0) + 1,
              };
            }),
          );

          if (selectedIdRef.current === convId) {
            await loadConversationDetail(convId, { silent: true }).catch(() => {});
          }
        } catch {
          // ignore malformed websocket payloads
        }
      };

      ws.onclose = () => {
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        if (!closed) {
          reconnectTimer = setTimeout(connectWs, 3000);
        }
      };

      ws.onerror = () => ws?.close();
    };

    connectWs();
    return () => {
      closed = true;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin]);

  // Admin fallback polling.
  useEffect(() => {
    if (!token || !isAdmin) return;
    const timer = setInterval(async () => {
      await loadConversations();
      if (selectedIdRef.current) {
        await loadConversationDetail(selectedIdRef.current, { silent: true }).catch(() => {});
      }
    }, 8000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedId || !messageText.trim()) return;
    const content = messageText.trim();
    const convId = selectedId;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const nowIso = new Date().toISOString();
    const optimistic = {
      id: tempId,
      content,
      sender_type: isAdmin ? 'team' : 'user',
      sender_name: isAdmin ? 'Havlo Advisory' : (user?.full_name || 'You'),
      created_at: nowIso,
      is_me: true,
    };
    setMessageText('');
    setSendError('');
    setDetail((prev) =>
      prev && prev.id === convId
        ? { ...prev, messages: [...prev.messages, optimistic as any] }
        : prev,
    );
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, last_message_at: nowIso, last_message_snippet: content.slice(0, 60) }
          : c,
      ),
    );
    setSending(true);
    try {
      const resp = isAdmin
        ? await api.adminSendMessage(token, convId, content)
        : await api.sendMessage(token, convId, content);
      const real = (resp as any)?.message;
      setDetail((prev) =>
        prev && prev.id === convId
          ? {
              ...prev,
              messages: prev.messages.map((m: any) => (m.id === tempId ? real || m : m)),
            }
          : prev,
      );
    } catch (err: unknown) {
      setDetail((prev) =>
        prev && prev.id === convId
          ? { ...prev, messages: prev.messages.filter((m: any) => m.id !== tempId) }
          : prev,
      );
      setMessageText(content);
      setSendError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
      messageInputRef.current?.focus();
    }
  };

  const handleRename = async () => {
    if (!token || !renameId) return;
    const subject = renameText.trim();
    if (!subject) {
      setActionError('Subject cannot be empty.');
      return;
    }
    setActionBusy(true);
    setActionError('');
    try {
      await api.renameConversation(token, renameId, subject);
      setConversations((prev) => prev.map((c) => (c.id === renameId ? { ...c, subject } : c)));
      setDetail((prev) => (prev && prev.id === renameId ? { ...prev, subject } : prev));
      setRenameId(null);
      setRenameText('');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to rename.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !deleteId) return;
    setActionBusy(true);
    setActionError('');
    const id = deleteId;
    try {
      await api.deleteConversation(token, id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
      }
      setDeleteId(null);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete.');
    } finally {
      setActionBusy(false);
    }
  };

  const formatDate = (raw: string) => new Date(raw).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const formatDateTime = (raw: string) =>
    new Date(raw).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

  const headerName = useMemo(() => {
    if (!detail) return '';
    if (isAdmin) {
      const c = conversations.find((x) => x.id === selectedId);
      return c?.user_full_name || c?.user_email || 'User';
    }
    return detail.team_member_name || 'Havlo Advisory';
  }, [detail, isAdmin, conversations, selectedId]);

  return (
    <DashboardLayout title="Inbox">
      <div className="flex h-full min-h-0 bg-white overflow-hidden">
        <div className={`w-full lg:w-[373px] flex-shrink-0 border-r border-[#F1F1F0] flex flex-col bg-white ${selectedId && 'hidden lg:flex'}`}>
          {isAdmin && (
            <div className="p-2 border-b border-[#F1F1F0] bg-white">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdminTab('recent')}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold ${
                    adminTab === 'recent' ? 'bg-black text-white' : 'bg-black/5 text-black'
                  }`}
                >
                  Recent conversations
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTab('users')}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold ${
                    adminTab === 'users' ? 'bg-black text-white' : 'bg-black/5 text-black'
                  }`}
                >
                  All users
                </button>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {loading ? (
              <div className="p-6 text-center text-sm text-black/50">Loading...</div>
            ) : loadError ? (
              <div className="p-6 text-center space-y-3">
                <div className={`text-sm ${loadState === 'unauthorized' ? 'text-amber-600' : 'text-red-500'}`}>{loadError}</div>
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setLoadState('loading');
                    loadConversations().finally(() => setLoading(false));
                  }}
                  className="inline-flex items-center rounded-full border border-black/20 px-4 py-2 text-xs font-semibold text-black hover:bg-black/5"
                >
                  Refresh
                </button>
              </div>
            ) : isAdmin && adminTab === 'users' ? (
              <div className="space-y-2 p-2">
                <input
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  placeholder="Search users"
                  className="w-full h-10 rounded-full bg-[#F4F4F4] px-4 text-sm font-semibold placeholder:text-black/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => loadAdminUsers(adminSearch)}
                  className="w-full rounded-full bg-black text-white py-2 text-xs font-semibold"
                >
                  Search
                </button>

                {adminUsersLoading ? (
                  <div className="p-4 text-center text-sm text-black/50">Loading users...</div>
                ) : adminUsersError ? (
                  <div className="p-4 text-center text-sm text-red-500">{adminUsersError}</div>
                ) : adminUsers.length === 0 ? (
                  <div className="p-4 text-center text-sm text-black/50">No users found.</div>
                ) : (
                  <div className="space-y-1">
                    {adminUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => startAdminConversationForUser(u)}
                        className="w-full rounded-lg p-3 text-left hover:bg-black/5"
                      >
                        <div className="text-sm font-semibold text-black truncate">{u.full_name || u.email}</div>
                        <div className="text-xs text-black/60 truncate">{u.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-black/50">
                {loadState === 'empty' ? 'No conversations yet.' : 'No conversations available.'}
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    setSelectedId(conv.id);
                    setConversations((prev) => {
                      const next = prev.map((c) =>
                        c.id === conv.id ? { ...c, unread_count: 0 } : c,
                      );
                      if (token) writeCachedConversations(token, isAdmin, next);
                      broadcastInboxUpdate();
                      return next;
                    });
                    // Fire-and-forget: tell the backend to reset unread immediately so
                    // the sidebar badge is in sync the next time anything refreshes.
                    if (token && !isAdmin) {
                      api.markConversationRead(token, conv.id).catch(() => {});
                    }
                  }}
                  className={`w-full flex items-start gap-3 p-4 rounded-lg transition-colors text-left ${
                    selectedId === conv.id ? 'bg-[#F4F4F4]' : 'hover:bg-gray-50'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm"
                    style={{ backgroundColor: conv.team_member_color || '#0052B4' }}
                  >
                    {conv.team_member_initials || 'HA'}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="font-semibold text-sm text-black truncate">
                        {isAdmin ? (conv.user_full_name || conv.user_email || 'User') : conv.team_member_name}
                      </span>
                      <span className="text-[10px] text-[#3A3C3E] whitespace-nowrap">{formatDate(conv.last_message_at)}</span>
                    </div>
                    <div className="text-xs font-medium text-[#3A3C3E] truncate">{conv.subject}</div>
                    <div className="text-[10px] text-[#3A3C3E]/60 truncate">{conv.last_message_snippet || 'No messages yet'}</div>
                  </div>
                  {conv.unread_count > 0 && (
                    <div className="w-5 h-5 rounded-full bg-[#A409D2] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {conv.unread_count}
                    </div>
                  )}
                  {!isAdmin && (
                    <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === conv.id ? null : conv.id);
                        }}
                        className="p-1 rounded-full hover:bg-black/10 inline-flex items-center justify-center cursor-pointer"
                        aria-label="Conversation actions"
                      >
                        <MoreVertical size={16} />
                      </span>
                      {menuOpenId === conv.id && (
                        <div className="absolute right-0 top-7 z-20 w-36 rounded-lg border border-black/10 bg-white shadow-lg py-1">
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(null);
                              setRenameId(conv.id);
                              setRenameText(conv.subject || '');
                              setActionError('');
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-semibold text-black hover:bg-black/5 flex items-center gap-2 cursor-pointer"
                          >
                            <Pencil size={14} /> Rename
                          </span>
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(null);
                              setDeleteId(conv.id);
                              setActionError('');
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 size={14} /> Delete
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className={`flex-1 min-h-0 flex flex-col bg-[#F4F5F4] ${!selectedId && 'hidden lg:flex'}`}>
          {selectedId ? (
            <>
              <div className="lg:hidden h-14 flex-shrink-0 px-2 flex items-center gap-2 bg-white border-b border-[#F1F1F0]">
                <button
                  onClick={() => setSelectedId(null)}
                  className="h-11 w-11 flex items-center justify-center -ml-1 rounded-full hover:bg-black/5 active:bg-black/10"
                  aria-label="Back to conversations"
                >
                  <ChevronLeft size={24} />
                </button>
                <span className="font-semibold text-sm flex-1 truncate">{headerName || (conversations.find((c) => c.id === selectedId)?.subject ?? '')}</span>
                {!isAdmin && selectedId && (
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === `__header__${selectedId}` ? null : `__header__${selectedId}`);
                      }}
                      className="h-11 w-11 flex items-center justify-center rounded-full hover:bg-black/5 active:bg-black/10"
                      aria-label="Conversation actions"
                    >
                      <MoreVertical size={20} />
                    </button>
                    {menuOpenId === `__header__${selectedId}` && (
                      <div className="absolute right-1 top-12 z-30 w-40 rounded-lg border border-black/10 bg-white shadow-lg py-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(null);
                            const conv = conversations.find((c) => c.id === selectedId);
                            setRenameId(selectedId);
                            setRenameText(conv?.subject || '');
                            setActionError('');
                          }}
                          className="w-full px-3 py-2.5 text-left text-sm font-medium text-black hover:bg-black/5 flex items-center gap-2"
                        >
                          <Pencil size={16} /> Rename
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(null);
                            setDeleteId(selectedId);
                            setActionError('');
                          }}
                          className="w-full px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 size={16} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div ref={messagesScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 custom-scrollbar">
                {detailLoading && !detail ? (
                  <div className="h-full flex items-center justify-center text-sm text-black/50">Loading messages…</div>
                ) : detailError && !detail ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                    <p className="text-sm text-red-500">{detailError}</p>
                    <button
                      type="button"
                      onClick={() => loadConversationDetail(selectedId).catch(() => {})}
                      className="inline-flex items-center rounded-full border border-black/20 px-4 py-2 text-xs font-semibold text-black hover:bg-black/5"
                    >
                      Retry
                    </button>
                  </div>
                ) : !detail ? (
                  <div className="h-full" />
                ) : detail.messages.length ? (
                  [...detail.messages]
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map((msg) => (
                    <div key={msg.id} className={`flex items-start gap-2 ${msg.is_me ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`max-w-[70%] space-y-1 ${msg.is_me ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`p-3 text-sm font-medium leading-relaxed ${
                            msg.is_me
                              ? 'bg-[#A409D2] text-white rounded-2xl rounded-tr-none'
                              : 'bg-white text-[#121212] rounded-2xl rounded-tl-none'
                          }`}
                        >
                          {msg.content}
                        </div>
                        <div className="text-[10px] text-[#121212]/60 px-1">{formatDateTime(msg.created_at)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-sm">
                      <Mail size={40} className="text-black" />
                    </div>
                    <p className="text-black/70 text-base max-w-[374px] mx-auto">Send a message to start the conversation.</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div
                className="flex-shrink-0 p-3 sm:p-4 bg-white border-t border-[#F1F1F0]"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
              >
                {sendError && <p className="text-red-500 text-xs font-body mb-2 text-center">{sendError}</p>}
                <form onSubmit={handleSendMessage} className="flex items-center gap-2 sm:gap-3 max-w-[837px] mx-auto">
                  <input
                    ref={messageInputRef}
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onFocus={() => {
                      window.setTimeout(() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                      }, 250);
                    }}
                    placeholder="Type a message"
                    autoComplete="off"
                    autoCorrect="on"
                    enterKeyHint="send"
                    style={{ fontSize: '16px' }}
                    className="flex-1 h-12 px-5 sm:px-6 bg-[#F4F4F4] rounded-full text-sm font-medium placeholder:text-black/40 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sending || !messageText.trim()}
                    className="w-12 h-12 flex-shrink-0 rounded-full bg-[#A409D2] flex items-center justify-center text-white hover:bg-[#8e08b6] transition-colors disabled:opacity-50"
                    aria-label="Send message"
                  >
                    <SendHorizontal size={22} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-sm">
                <Mail size={40} className="text-black" />
              </div>
              <p className="text-black/70 text-base max-w-[374px] mx-auto">No conversation selected.</p>
            </div>
          )}
        </div>
      </div>

      {renameId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => !actionBusy && setRenameId(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-black">Rename conversation</h3>
            <input
              type="text"
              autoFocus
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }}
              maxLength={255}
              className="w-full h-11 px-4 bg-[#F4F4F4] rounded-full text-sm font-medium focus:outline-none"
              placeholder="Conversation name"
            />
            {actionError && <p className="text-red-500 text-xs">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={actionBusy} onClick={() => setRenameId(null)} className="px-4 py-2 text-xs font-semibold text-black/70 hover:bg-black/5 rounded-full">Cancel</button>
              <button type="button" disabled={actionBusy || !renameText.trim()} onClick={handleRename} className="px-4 py-2 text-xs font-semibold bg-black text-white rounded-full disabled:opacity-50">{actionBusy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => !actionBusy && setDeleteId(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-black">Delete conversation?</h3>
            <p className="text-sm text-black/70">This will permanently remove the conversation and all of its messages. This action cannot be undone.</p>
            {actionError && <p className="text-red-500 text-xs">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={actionBusy} onClick={() => setDeleteId(null)} className="px-4 py-2 text-xs font-semibold text-black/70 hover:bg-black/5 rounded-full">Cancel</button>
              <button type="button" disabled={actionBusy} onClick={handleDelete} className="px-4 py-2 text-xs font-semibold bg-red-600 text-white rounded-full disabled:opacity-50">{actionBusy ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

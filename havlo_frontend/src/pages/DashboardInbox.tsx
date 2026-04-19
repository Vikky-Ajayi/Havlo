import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { ChevronLeft, SendHorizontal, Mail, Plus, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  api,
  buildWsUrl,
  type Conversation,
  type ConversationDetail,
  type AdminConversation,
  type AdminUser,
} from '../lib/api';

type InboxConversation = Conversation & {
  user_id?: string;
  user_full_name?: string;
  user_email?: string;
};

const adminToInbox = (c: AdminConversation): InboxConversation => ({
  ...c,
  team_member_name: c.user.full_name || c.user.email,
  team_member_initials:
    (c.user.full_name || c.user.email)
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?',
  team_member_color: c.team_member_color || '#A409D2',
  user_id: c.user.id,
  user_full_name: c.user.full_name,
  user_email: c.user.email,
});

export const DashboardInbox: React.FC = () => {
  const { token, user } = useAuth();
  const isAdmin = !!user?.is_admin;

  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Admin "new conversation" picker state
  const [pickerUsers, setPickerUsers] = useState<AdminUser[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerSelected, setPickerSelected] = useState<AdminUser | null>(null);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Non-admin "new conversation" — subject only
  const [simpleSubject, setSimpleSubject] = useState('');

  // ── Conversation list loader ───────────────────────────────────────────
  const refreshList = async () => {
    if (!token) return;
    try {
      if (isAdmin) {
        const data = await api.adminListAllConversations(token);
        setConversations(data.map(adminToInbox));
      } else {
        const data = await api.getConversations(token);
        setConversations(data);
      }
      setLoadError('');
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load conversations.');
    }
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    (async () => {
      await refreshList();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin]);

  useEffect(() => {
    if (conversations.length === 0) return;
    if (!selectedId || !conversations.some((c) => c.id === selectedId)) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  // ── Conversation detail loader ─────────────────────────────────────────
  useEffect(() => {
    if (!token || !selectedId) { setDetail(null); return; }
    (async () => {
      try {
        const data = isAdmin
          ? await api.adminGetConversation(token, selectedId)
          : await api.getConversation(token, selectedId);
        setDetail(data);
      } catch {
        setDetail(null);
      }
    })();
  }, [token, selectedId, isAdmin]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages]);

  // ── Live updates via WebSocket (non-admin only) ────────────────────────
  const selectedIdRef = useRef<string | null>(null);
  const detailRef = useRef<ConversationDetail | null>(null);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { detailRef.current = detail; }, [detail]);

  useEffect(() => {
    if (!token || isAdmin) return;
    let ws: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      try {
        ws = new WebSocket(`${buildWsUrl('/messaging/ws/inbox')}?token=${encodeURIComponent(token)}`);
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        attempts = 0;
        pingTimer = setInterval(() => {
          try { ws?.send(JSON.stringify({ type: 'ping' })); } catch { /* noop */ }
        }, 20000);
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.event !== 'new_message') return;
          const incoming = data.message;
          api.getConversations(token).then((c) => setConversations(c)).catch(() => {});
          if (selectedIdRef.current === data.conversation_id && detailRef.current) {
            const exists = detailRef.current.messages.some((m) => m.id === incoming.id);
            if (!exists) {
              setDetail({
                ...detailRef.current,
                messages: [
                  ...detailRef.current.messages,
                  {
                    id: incoming.id,
                    content: incoming.content,
                    sender_type: incoming.sender_type,
                    sender_name: incoming.sender_name,
                    created_at: incoming.created_at,
                    is_me: incoming.sender_type === 'user',
                  },
                ],
              });
            }
          }
        } catch { /* ignore malformed */ }
      };

      ws.onclose = () => {
        if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
        scheduleReconnect();
      };
      ws.onerror = () => { try { ws?.close(); } catch { /* noop */ } };
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      const delay = Math.min(30000, 1000 * Math.pow(2, attempts++));
      reconnectTimer = setTimeout(connect, delay);
    };

    connect();
    return () => {
      cancelled = true;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { ws?.close(); } catch { /* noop */ }
    };
  }, [token, isAdmin]);

  // ── Admin: poll the conversation list AND the open thread every 10s ────
  useEffect(() => {
    if (!token || !isAdmin) return;
    const id = setInterval(async () => {
      await refreshList();
      const sid = selectedIdRef.current;
      if (!sid) return;
      try {
        const fresh = await api.adminGetConversation(token, sid);
        const current = detailRef.current;
        if (!current || current.messages.length !== fresh.messages.length) {
          setDetail(fresh);
        }
      } catch { /* noop */ }
    }, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin]);

  // ── Send message ───────────────────────────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !token || !selectedId) return;
    setSending(true);
    setSendError('');
    try {
      const result = isAdmin
        ? await api.adminSendMessage(token, selectedId, messageText.trim())
        : await api.sendMessage(token, selectedId, messageText.trim());
      if (detail) {
        const msg = isAdmin
          ? { ...result.message, is_me: true }
          : result.message;
        setDetail({ ...detail, messages: [...detail.messages, msg] });
      }
      setMessageText('');
      refreshList();
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  // ── Non-admin: simple new conversation ─────────────────────────────────
  const handleSimpleCreate = async () => {
    if (!simpleSubject.trim() || !token) return;
    try {
      const result = await api.createConversation(token, simpleSubject.trim());
      setSelectedId(result.id);
      setShowNewConvo(false);
      setSimpleSubject('');
      await refreshList();
    } catch { /* noop */ }
  };

  // ── Admin: load users when picker opens / query changes ────────────────
  useEffect(() => {
    if (!isAdmin || !showNewConvo || !token) return;
    let cancelled = false;
    setPickerLoading(true);
    const t = setTimeout(async () => {
      try {
        const list = await api.adminListUsers(token, { q: pickerQuery || undefined });
        if (!cancelled) setPickerUsers(list);
      } catch {
        if (!cancelled) setPickerUsers([]);
      } finally {
        if (!cancelled) setPickerLoading(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [isAdmin, showNewConvo, token, pickerQuery]);

  const closePicker = () => {
    setShowNewConvo(false);
    setPickerSelected(null);
    setPickerQuery('');
    setNewSubject('');
    setNewMessage('');
    setCreateError('');
  };

  const handleAdminCreate = async () => {
    if (!token || !pickerSelected || !newSubject.trim()) {
      setCreateError('Pick a user and enter a subject.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const result = await api.adminStartConversation(token, {
        user_id: pickerSelected.id,
        subject: newSubject.trim(),
        initial_message: newMessage.trim() || undefined,
        sender_name: 'Havlo Advisory',
      });
      await refreshList();
      setSelectedId(result.id);
      closePicker();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to start conversation.');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch { return dateStr; }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' +
        d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch { return dateStr; }
  };

  const headerName = useMemo(() => {
    if (!detail) return '';
    if (isAdmin) {
      const conv = conversations.find((c) => c.id === selectedId);
      return conv?.user_full_name || conv?.user_email || detail.team_member_name || 'User';
    }
    return detail.team_member_name || 'Havlo Team';
  }, [detail, isAdmin, conversations, selectedId]);

  return (
    <DashboardLayout title="Inbox">
      <div className="flex h-[calc(100vh-64px)] bg-white overflow-hidden">
        <div className={`w-full lg:w-[373px] flex-shrink-0 border-r border-[#F1F1F0] flex flex-col bg-white ${selectedId && 'hidden lg:flex'}`}>
          <div className="p-3 border-b border-[#F1F1F0]">
            <button
              onClick={() => setShowNewConvo((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black text-white text-sm font-semibold hover:bg-black/90 transition-colors"
            >
              <Plus size={16} />
              New Conversation
            </button>
            {showNewConvo && !isAdmin && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={simpleSubject}
                  onChange={(e) => setSimpleSubject(e.target.value)}
                  placeholder="Subject..."
                  className="flex-1 h-10 px-3 rounded-lg border border-black/10 text-sm focus:outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleSimpleCreate()}
                />
                <button onClick={handleSimpleCreate} className="px-3 h-10 rounded-lg bg-[#A409D2] text-white text-sm font-medium">
                  Create
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {loading ? (
              <div className="p-6 text-center text-sm text-black/50">Loading...</div>
            ) : loadError ? (
              <div className="p-6 text-center text-sm text-red-500">{loadError}</div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-black/50">No conversations yet</div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`w-full flex items-start gap-3 p-4 rounded-lg transition-colors text-left ${
                    selectedId === conv.id ? 'bg-[#F4F4F4]' : 'hover:bg-gray-50'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm"
                    style={{ backgroundColor: conv.team_member_color || '#000' }}
                  >
                    {conv.team_member_initials || 'H'}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="font-semibold text-sm text-black truncate">
                        {isAdmin ? (conv.user_full_name || conv.user_email || 'User') : (conv.team_member_name || 'Havlo Team')}
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
                </button>
              ))
            )}
          </div>
        </div>

        <div className={`flex-1 flex flex-col bg-[#F4F5F4] ${!selectedId && 'hidden lg:flex'}`}>
          {detail ? (
            <>
              <div className="lg:hidden h-14 px-4 flex items-center gap-3 bg-white border-b border-[#F1F1F0]">
                <button onClick={() => setSelectedId(null)} className="p-1">
                  <ChevronLeft size={20} />
                </button>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs"
                  style={{ backgroundColor: detail.team_member_color || '#000' }}
                >
                  {detail.team_member_initials || 'H'}
                </div>
                <span className="font-semibold text-sm">{headerName}</span>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {detail.messages.length > 0 ? (
                  detail.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2 ${msg.is_me ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {!msg.is_me && (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-xs mt-1"
                          style={{ backgroundColor: detail.team_member_color || '#000' }}
                        >
                          {detail.team_member_initials || 'H'}
                        </div>
                      )}
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
                        <div className="text-[10px] text-[#121212]/60 px-1">
                          {formatTime(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-sm">
                      <Mail size={40} className="text-black" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-semibold text-black tracking-tight">Nothing Here Yet</h3>
                      <p className="text-black/70 text-base max-w-[374px] mx-auto">
                        Send a message to start the conversation.
                      </p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 bg-white border-t border-[#F1F1F0]">
                {sendError && <p className="text-red-500 text-xs font-body mb-2 text-center">{sendError}</p>}
                <form onSubmit={handleSendMessage} className="flex items-center gap-3 max-w-[837px] mx-auto">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type a message"
                      disabled={sending}
                      className="w-full h-12 px-6 bg-[#F4F4F4] rounded-full text-sm font-semibold italic placeholder:text-black/40 focus:outline-none disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending || !messageText.trim()}
                    className="w-12 h-12 rounded-full bg-[#A409D2] flex items-center justify-center text-white hover:bg-[#8e08b6] transition-colors disabled:opacity-50"
                  >
                    <SendHorizontal size={24} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-sm">
                <Mail size={40} className="text-black" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-black tracking-tight">Nothing Here Yet</h3>
                <p className="text-black/70 text-base max-w-[374px] mx-auto">
                  Stay tuned. We'll notify you when there are new matches, assessments, or activity on your properties.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Admin: New conversation modal with user picker */}
      {isAdmin && showNewConvo && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={closePicker}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/10">
              <h2 className="text-lg font-semibold text-black">Start a new conversation</h2>
              <button onClick={closePicker} className="p-1 rounded hover:bg-black/5">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 overflow-y-auto">
              {/* User picker */}
              <div>
                <label className="block text-xs font-semibold text-black/70 mb-2 uppercase tracking-wide">
                  Recipient
                </label>
                {pickerSelected ? (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#F4F4F4]">
                    <div>
                      <div className="text-sm font-semibold text-black">{pickerSelected.full_name}</div>
                      <div className="text-xs text-black/60">{pickerSelected.email}</div>
                    </div>
                    <button
                      onClick={() => setPickerSelected(null)}
                      className="text-xs text-[#A409D2] font-semibold hover:underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
                      <input
                        type="text"
                        value={pickerQuery}
                        onChange={(e) => setPickerQuery(e.target.value)}
                        placeholder="Search by name or email…"
                        className="w-full h-10 pl-9 pr-3 rounded-lg border border-black/10 text-sm focus:outline-none focus:border-[#A409D2]"
                      />
                    </div>
                    <div className="mt-2 max-h-48 overflow-y-auto border border-black/5 rounded-lg">
                      {pickerLoading ? (
                        <div className="p-3 text-center text-xs text-black/50">Loading users…</div>
                      ) : pickerUsers.length === 0 ? (
                        <div className="p-3 text-center text-xs text-black/50">No users found</div>
                      ) : (
                        pickerUsers.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => setPickerSelected(u)}
                            className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[#F4F4F4]"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-black truncate">{u.full_name}</div>
                              <div className="text-xs text-black/60 truncate">{u.email}</div>
                            </div>
                            <span className="text-[10px] uppercase tracking-wide text-black/50">{u.role}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-black/70 mb-2 uppercase tracking-wide">
                  Subject
                </label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="What is this about?"
                  className="w-full h-10 px-3 rounded-lg border border-black/10 text-sm focus:outline-none focus:border-[#A409D2]"
                />
              </div>

              {/* First message */}
              <div>
                <label className="block text-xs font-semibold text-black/70 mb-2 uppercase tracking-wide">
                  First message <span className="text-black/40 normal-case">(optional)</span>
                </label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Write a message to send right away…"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm focus:outline-none focus:border-[#A409D2] resize-none"
                />
              </div>

              {createError && <p className="text-red-500 text-xs">{createError}</p>}
            </div>

            <div className="px-5 py-4 border-t border-black/10 flex justify-end gap-2">
              <button
                onClick={closePicker}
                className="px-4 h-10 rounded-lg text-sm font-medium text-black/70 hover:bg-black/5"
              >
                Cancel
              </button>
              <button
                onClick={handleAdminCreate}
                disabled={creating || !pickerSelected || !newSubject.trim()}
                className="px-4 h-10 rounded-lg bg-[#A409D2] text-white text-sm font-semibold hover:bg-[#8e08b6] disabled:opacity-50"
              >
                {creating ? 'Starting…' : 'Start conversation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

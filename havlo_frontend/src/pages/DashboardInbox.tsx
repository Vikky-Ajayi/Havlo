import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { ChevronLeft, Mail, SendHorizontal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, buildWsUrl, type Conversation, type ConversationDetail, type AdminConversation } from '../lib/api';

type InboxConversation = Conversation & {
  user_full_name?: string;
  user_email?: string;
};

const adminToInbox = (c: AdminConversation): InboxConversation => ({
  ...c,
  user_full_name: c.user.full_name,
  user_email: c.user.email,
});

export const DashboardInbox: React.FC = () => {
  const { token, user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const loadConversations = async () => {
    if (!token) return;
    try {
      if (isAdmin) {
        const rows = await api.adminListAllConversations(token);
        setConversations(rows.map(adminToInbox));
      } else {
        const rows = await api.getConversations(token);
        setConversations(rows);
      }
      setLoadError('');
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load conversations.');
    }
  };

  const loadConversationDetail = async (conversationId: string) => {
    if (!token) return;
    const payload = isAdmin
      ? await api.adminGetConversation(token, conversationId)
      : await api.getConversation(token, conversationId);
    setDetail(payload);
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    (async () => {
      await loadConversations();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin]);

  useEffect(() => {
    if (!conversations.length) return;
    if (!selectedId || !conversations.some((c) => c.id === selectedId)) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  useEffect(() => {
    if (!selectedId || !token) return;
    loadConversationDetail(selectedId).catch(() => setDetail(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, token, isAdmin]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages]);

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
            await loadConversationDetail(convId);
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
        try {
          await loadConversationDetail(selectedIdRef.current);
        } catch {
          // ignore
        }
      }
    }, 8000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedId || !messageText.trim()) return;
    setSending(true);
    setSendError('');
    try {
      if (isAdmin) {
        await api.adminSendMessage(token, selectedId, messageText.trim());
      } else {
        await api.sendMessage(token, selectedId, messageText.trim());
      }
      setMessageText('');
      await loadConversationDetail(selectedId);
      await loadConversations();
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
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
      <div className="flex h-[calc(100vh-64px)] bg-white overflow-hidden">
        <div className={`w-full lg:w-[373px] flex-shrink-0 border-r border-[#F1F1F0] flex flex-col bg-white ${selectedId && 'hidden lg:flex'}`}>
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
                <span className="font-semibold text-sm">{headerName}</span>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {detail.messages.length ? (
                  detail.messages.map((msg) => (
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

              <div className="p-4 bg-white border-t border-[#F1F1F0]">
                {sendError && <p className="text-red-500 text-xs font-body mb-2 text-center">{sendError}</p>}
                <form onSubmit={handleSendMessage} className="flex items-center gap-3 max-w-[837px] mx-auto">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type a message"
                    disabled={sending}
                    className="flex-1 h-12 px-6 bg-[#F4F4F4] rounded-full text-sm font-semibold italic placeholder:text-black/40 focus:outline-none disabled:opacity-50"
                  />
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
              <p className="text-black/70 text-base max-w-[374px] mx-auto">No conversation selected.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  api,
  type AdminUser,
  type Conversation,
  type ConversationDetail,
  type Message,
} from '../lib/api';

type Filter = 'all' | 'with_threads';

const initials = (first: string, last: string) =>
  `${(first?.[0] || '').toUpperCase()}${(last?.[0] || '').toUpperCase()}` || '??';

const formatRelative = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });
};

export const AdminPanel: React.FC = () => {
  const { token, user, loading, logout } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);

  const [activeConv, setActiveConv] = useState<ConversationDetail | null>(null);
  const [convLoading, setConvLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const [showNewThread, setShowNewThread] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [creatingThread, setCreatingThread] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auth gate
  useEffect(() => {
    if (loading) return;
    if (!token) {
      navigate('/');
      return;
    }
    if (user && !user.is_admin) {
      navigate('/dashboard');
    }
  }, [loading, token, user, navigate]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    if (!token || !user?.is_admin) return;
    setUsersLoading(true);
    try {
      const list = await api.adminListUsers(token, {
        q: debouncedSearch || undefined,
        only_with_threads: filter === 'with_threads',
      });
      setUsers(list);
    } catch (e) {
      console.error('Failed to fetch admin users', e);
    } finally {
      setUsersLoading(false);
    }
  }, [token, debouncedSearch, filter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Poll users list every 15s for unread updates
  useEffect(() => {
    const id = setInterval(fetchUsers, 15000);
    return () => clearInterval(id);
  }, [fetchUsers]);

  const loadUserConversations = useCallback(
    async (u: AdminUser) => {
      if (!token) return;
      setSelectedUser(u);
      setActiveConv(null);
      setConversations([]);
      setConversationsLoading(true);
      try {
        const convs = await api.adminListUserConversations(token, u.id);
        setConversations(convs);
        if (convs.length > 0) {
          await openConversation(convs[0].id);
        }
      } catch (e) {
        console.error('Failed to fetch user conversations', e);
      } finally {
        setConversationsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  );

  const openConversation = useCallback(
    async (convId: string) => {
      if (!token) return;
      setConvLoading(true);
      try {
        const detail = await api.adminGetConversation(token, convId);
        setActiveConv(detail);
      } catch (e) {
        console.error('Failed to load conversation', e);
      } finally {
        setConvLoading(false);
      }
    },
    [token],
  );

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages.length]);

  const handleSend = async () => {
    if (!token || !activeConv || !draft.trim()) return;
    setSending(true);
    const content = draft.trim();
    try {
      const resp = await api.adminSendMessage(
        token,
        activeConv.id,
        content,
        user?.first_name ? `${user.first_name} ${user.last_name}` : 'Havlo Advisory',
      );
      setActiveConv((prev) =>
        prev ? { ...prev, messages: [...prev.messages, resp.message] } : prev,
      );
      setDraft('');
      // Refresh users list to clear unread badge
      fetchUsers();
    } catch (e: any) {
      alert(e.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleCreateThread = async () => {
    if (!token || !selectedUser || !newSubject.trim()) return;
    setCreatingThread(true);
    try {
      const resp = await api.adminStartConversation(token, {
        user_id: selectedUser.id,
        subject: newSubject.trim(),
        initial_message: newMessage.trim() || undefined,
        sender_name: user?.first_name ? `${user.first_name} ${user.last_name}` : 'Havlo Advisory',
      });
      setShowNewThread(false);
      setNewSubject('');
      setNewMessage('');
      // Reload conversations and open the new one
      const convs = await api.adminListUserConversations(token, selectedUser.id);
      setConversations(convs);
      await openConversation(resp.id);
      fetchUsers();
    } catch (e: any) {
      alert(e.message || 'Failed to create conversation');
    } finally {
      setCreatingThread(false);
    }
  };

  const totalUnread = useMemo(
    () => users.reduce((sum, u) => sum + (u.unread_count || 0), 0),
    [users],
  );

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0b0b0c] text-white/60">
        Loading admin…
      </div>
    );
  }

  if (!user.is_admin) return null;

  return (
    <div className="flex h-screen flex-col bg-[#0b0b0c] text-white font-body">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="font-display text-2xl font-black tracking-tight">Havlo</div>
          <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[11px] font-bold uppercase text-black">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-white/60">
            Signed in as <span className="text-white">{user.first_name} {user.last_name}</span>
          </span>
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Users column */}
        <aside className="flex w-[320px] flex-col border-r border-white/10">
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Users</h2>
              {totalUnread > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold">
                  {totalUnread} unread
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-3 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm placeholder:text-white/40 outline-none focus:border-white/40"
            />
            <div className="mt-3 flex gap-1 rounded-lg bg-white/5 p-1 text-xs">
              <button
                onClick={() => setFilter('all')}
                className={`flex-1 rounded-md px-2 py-1.5 font-semibold transition-colors ${
                  filter === 'all' ? 'bg-white text-black' : 'text-white/70 hover:text-white'
                }`}
              >
                All users
              </button>
              <button
                onClick={() => setFilter('with_threads')}
                className={`flex-1 rounded-md px-2 py-1.5 font-semibold transition-colors ${
                  filter === 'with_threads' ? 'bg-white text-black' : 'text-white/70 hover:text-white'
                }`}
              >
                With messages
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {usersLoading && users.length === 0 ? (
              <div className="p-6 text-center text-sm text-white/40">Loading users…</div>
            ) : users.length === 0 ? (
              <div className="p-6 text-center text-sm text-white/40">No users found.</div>
            ) : (
              users.map((u) => {
                const isSelected = selectedUser?.id === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => loadUserConversations(u)}
                    className={`flex w-full items-start gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors ${
                      isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-bold text-black">
                      {initials(u.first_name, u.last_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-semibold">
                          {u.full_name || u.email}
                        </div>
                        {u.unread_count > 0 && (
                          <span className="flex-shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold">
                            {u.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-white/50">{u.email}</div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-white/40">
                        <span className="capitalize">{u.role}</span>
                        <span>
                          {u.conversation_count > 0
                            ? formatRelative(u.last_message_at)
                            : 'No threads'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Conversations column */}
        <section className="flex w-[300px] flex-col border-r border-white/10 py-10 my-0">
          {!selectedUser ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-white/40">
              Select a user to see their conversations.
            </div>
          ) : (
            <>
              <div className="border-b border-white/10 p-4">
                <div className="text-xs uppercase tracking-wider text-white/40">Threads with</div>
                <div className="mt-1 truncate font-display text-lg font-bold">
                  {selectedUser.full_name || selectedUser.email}
                </div>
                <div className="truncate text-xs text-white/50">{selectedUser.email}</div>
                {selectedUser.phone && (
                  <div className="text-xs text-white/50">{selectedUser.phone}</div>
                )}
                <button
                  onClick={() => setShowNewThread(true)}
                  className="mt-3 w-full rounded-lg bg-white px-3 py-2 text-xs font-bold text-black hover:bg-white/90"
                >
                  + New conversation
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {conversationsLoading ? (
                  <div className="p-6 text-center text-sm text-white/40">Loading…</div>
                ) : conversations.length === 0 ? (
                  <div className="p-6 text-center text-sm text-white/40">
                    No conversations yet.
                  </div>
                ) : (
                  conversations.map((c) => {
                    const isActive = activeConv?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => openConversation(c.id)}
                        className={`block w-full border-b border-white/5 px-4 py-3 text-left transition-colors ${
                          isActive ? 'bg-white/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-semibold">{c.subject}</div>
                          {c.unread_count > 0 && (
                            <span className="flex-shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold">
                              {c.unread_count}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 truncate text-xs text-white/50">
                          {c.last_message_snippet || 'No messages yet'}
                        </div>
                        <div className="mt-1 text-[11px] text-white/40">
                          {formatRelative(c.last_message_at)}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </section>

        {/* Thread column */}
        <section className="flex flex-1 flex-col bg-[#111113] py-10 my-0">
          {!activeConv ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-white/40">
              {selectedUser
                ? 'Select a conversation, or create a new one.'
                : 'Pick a user to view messages.'}
            </div>
          ) : (
            <>
              <div className="border-b border-white/10 p-4">
                <div className="text-xs uppercase tracking-wider text-white/40">Subject</div>
                <div className="font-display text-lg font-bold">{activeConv.subject}</div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {convLoading ? (
                  <div className="text-center text-sm text-white/40">Loading messages…</div>
                ) : activeConv.messages.length === 0 ? (
                  <div className="text-center text-sm text-white/40">No messages yet.</div>
                ) : (
                  activeConv.messages.map((m: Message) => {
                    const isAdmin = m.is_me; // is_me=true since admin views as "team"
                    return (
                      <div
                        key={m.id}
                        className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                            isAdmin
                              ? 'rounded-br-sm bg-white text-black'
                              : 'rounded-bl-sm bg-white/10 text-white'
                          }`}
                        >
                          <div className="mb-1 text-[11px] font-semibold opacity-70">
                            {m.sender_name} · {formatTime(m.created_at)}
                          </div>
                          <div className="whitespace-pre-wrap">{m.content}</div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-white/10 p-4">
                <div className="flex gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Reply as Havlo Advisory…"
                    rows={2}
                    className="flex-1 resize-none rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm placeholder:text-white/40 outline-none focus:border-white/40"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !draft.trim()}
                    className="rounded-lg bg-white px-5 py-2 text-sm font-bold text-black hover:bg-white/90 disabled:opacity-40"
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
                <div className="mt-1 text-[11px] text-white/40">
                  Press Enter to send, Shift+Enter for newline. SMS sent if user has phone.
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* New thread modal */}
      {showNewThread && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#1a1a1c] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">New conversation</h3>
              <button
                onClick={() => setShowNewThread(false)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm text-white/60">
              Starting a thread with {selectedUser.full_name || selectedUser.email}
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/50">
                  Subject
                </label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. Following up on your enquiry"
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/50">
                  First message (optional)
                </label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={4}
                  placeholder="Hi! I wanted to reach out about…"
                  className="w-full resize-none rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/40"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowNewThread(false)}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateThread}
                disabled={creatingThread || !newSubject.trim()}
                className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black hover:bg-white/90 disabled:opacity-40"
              >
                {creatingThread ? 'Creating…' : 'Create thread'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { ChevronLeft, SendHorizontal, Mail, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, type Conversation, type ConversationDetail } from '../lib/api';

export const DashboardInbox: React.FC = () => {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await api.getConversations(token);
        setConversations(data);
        if (data.length > 0) {
          setSelectedId(data[0].id);
        }
      } catch (err: unknown) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load conversations.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token || !selectedId) { setDetail(null); return; }
    (async () => {
      try {
        const data = await api.getConversation(token, selectedId);
        setDetail(data);
      } catch {
        setDetail(null);
      }
    })();
  }, [token, selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !token || !selectedId) return;
    setSending(true);
    setSendError('');
    try {
      const result = await api.sendMessage(token, selectedId, messageText.trim());
      if (detail) {
        setDetail({ ...detail, messages: [...detail.messages, result.message] });
      }
      setMessageText('');
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleNewConversation = async () => {
    if (!newSubject.trim() || !token) return;
    try {
      const result = await api.createConversation(token, newSubject.trim());
      setSelectedId(result.id);
      setShowNewConvo(false);
      setNewSubject('');
      const data = await api.getConversations(token);
      setConversations(data);
    } catch {
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

  return (
    <DashboardLayout title="Inbox">
      <div className="flex h-[calc(100vh-64px)] bg-white overflow-hidden">
        <div className={`w-full lg:w-[373px] flex-shrink-0 border-r border-[#F1F1F0] flex flex-col bg-white ${selectedId && 'hidden lg:flex'}`}>
          <div className="p-3 border-b border-[#F1F1F0]">
            <button
              onClick={() => setShowNewConvo(!showNewConvo)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black text-white text-sm font-semibold hover:bg-black/90 transition-colors"
            >
              <Plus size={16} />
              New Conversation
            </button>
            {showNewConvo && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Subject..."
                  className="flex-1 h-10 px-3 rounded-lg border border-black/10 text-sm focus:outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleNewConversation()}
                />
                <button onClick={handleNewConversation} className="px-3 h-10 rounded-lg bg-[#A409D2] text-white text-sm font-medium">
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
                      <span className="font-semibold text-sm text-black truncate">{conv.team_member_name || 'Havlo Team'}</span>
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
                <span className="font-semibold text-sm">{detail.team_member_name || 'Havlo Team'}</span>
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
    </DashboardLayout>
  );
};

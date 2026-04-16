import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { ChevronLeft, SendHorizontal, Mail, User } from 'lucide-react';

interface Message {
  id: string;
  sender: string;
  senderInitials: string;
  senderColor: string;
  subject: string;
  snippet: string;
  date: string;
  messages: {
    text: string;
    time: string;
    isMe: boolean;
  }[];
}

const initialConversations: Message[] = [
  {
    id: '1',
    sender: 'Havlo Advisory',
    senderInitials: 'HA',
    senderColor: '#0052B4',
    subject: 'Your property matches are ready',
    snippet: "We've curated 3 properties in Spain and Portugal that...",
    date: '10 Apr',
    messages: [
      {
        text: "Hi John! Great news — we've curated 3 properties in Spain and Portugal that closely match your preferences.",
        time: '10 Apr, 9:14am',
        isMe: false
      },
      {
        text: "I'd love to walk you through them on a call. Are you free this week?",
        time: '10 Apr, 9:14am',
        isMe: false
      },
      {
        text: "Hello, Can I get help regarding how to get started with drop",
        time: '10 Apr, 10:14am',
        isMe: true
      }
    ]
  },
  {
    id: '2',
    sender: 'Relaunch Specialist Advisory',
    senderInitials: 'RS',
    senderColor: '#D46444',
    subject: 'Your elite mandate application is under review',
    snippet: 'Thank you for applying. Our private advisory team is ...',
    date: '9 Apr',
    messages: []
  },
  {
    id: '3',
    sender: 'Team Havlo — Mandate Review',
    senderInitials: 'RS',
    senderColor: '#602FD3',
    subject: 'Your elite mandate application is under review',
    snippet: 'Thank you for applying. Our private advisory team is re..',
    date: '9 Apr',
    messages: []
  },
  {
    id: '4',
    sender: 'Team Havlo',
    senderInitials: 'H',
    senderColor: '#000000',
    subject: 'Welcome to the Havlo network',
    snippet: "We're delighted to welcome you to our platform. Here's everything you need to know to get started…",
    date: '9 Apr',
    messages: []
  }
];

export const DashboardInbox: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(initialConversations[0].id);
  const [conversations] = useState<Message[]>(initialConversations);
  const [messageText, setMessageText] = useState('');

  const selectedConversation = conversations.find(c => c.id === selectedId);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    // In a real app, we'd update the state here
    setMessageText('');
  };

  return (
    <DashboardLayout title="Inbox">
      <div className="flex h-[calc(100vh-64px)] bg-white overflow-hidden">
        {/* Conversations List */}
        <div className={`w-full lg:w-[373px] flex-shrink-0 border-r border-[#F1F1F0] flex flex-col bg-white ${selectedId && 'hidden lg:flex'}`}>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`w-full flex items-start gap-3 p-4 rounded-lg transition-colors text-left ${
                  selectedId === conv.id ? 'bg-[#F4F4F4]' : 'hover:bg-gray-50'
                }`}
              >
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm"
                  style={{ backgroundColor: conv.senderColor }}
                >
                  {conv.senderInitials}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-semibold text-sm text-black truncate">{conv.sender}</span>
                    <span className="text-[10px] text-[#3A3C3E] whitespace-nowrap">{conv.date}</span>
                  </div>
                  <div className="text-xs font-medium text-[#3A3C3E] truncate">{conv.subject}</div>
                  <div className="text-[10px] text-[#3A3C3E]/60 truncate">{conv.snippet}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat View */}
        <div className={`flex-1 flex flex-col bg-[#F4F5F4] ${!selectedId && 'hidden lg:flex'}`}>
          {selectedConversation ? (
            <>
              {/* Chat Header (Mobile only) */}
              <div className="lg:hidden h-14 px-4 flex items-center gap-3 bg-white border-b border-[#F1F1F0]">
                <button onClick={() => setSelectedId(null)} className="p-1">
                  <ChevronLeft size={20} />
                </button>
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs"
                  style={{ backgroundColor: selectedConversation.senderColor }}
                >
                  {selectedConversation.senderInitials}
                </div>
                <span className="font-semibold text-sm">{selectedConversation.sender}</span>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {selectedConversation.messages.length > 0 ? (
                  selectedConversation.messages.map((msg, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-start gap-2 ${msg.isMe ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {!msg.isMe && (
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-xs mt-1"
                          style={{ backgroundColor: selectedConversation.senderColor }}
                        >
                          {selectedConversation.senderInitials}
                        </div>
                      )}
                      <div className={`max-w-[70%] space-y-1 ${msg.isMe ? 'items-end' : 'items-start'}`}>
                        <div 
                          className={`p-3 text-sm font-medium leading-relaxed ${
                            msg.isMe 
                              ? 'bg-[#A409D2] text-white rounded-2xl rounded-tr-none' 
                              : 'bg-white text-[#121212] rounded-2xl rounded-tl-none'
                          }`}
                        >
                          {msg.text}
                        </div>
                        <div className="text-[10px] text-[#121212]/60 px-1">
                          {msg.time}
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
                        Stay tuned. We’ll notify you when there are new matches, assessments, or activity on your properties.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="p-4 bg-white border-t border-[#F1F1F0]">
                <form onSubmit={handleSendMessage} className="flex items-center gap-3 max-w-[837px] mx-auto">
                  <div className="flex-1 relative">
                    <input 
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type a message"
                      className="w-full h-12 px-6 bg-[#F4F4F4] rounded-full text-sm font-semibold italic placeholder:text-black/40 focus:outline-none"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-12 h-12 rounded-full bg-[#A409D2] flex items-center justify-center text-white hover:bg-[#8e08b6] transition-colors"
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
                  Stay tuned. We’ll notify you when there are new matches, assessments, or activity on your properties.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

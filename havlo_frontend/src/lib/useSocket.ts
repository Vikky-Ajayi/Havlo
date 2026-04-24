import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

type Handlers = {
  onMessageNew?: (payload: { conversation_id: string; message: any }) => void;
  onMessageEdited?: (payload: { conversation_id: string; message: any }) => void;
  onMessageDeleted?: (payload: { conversation_id: string; message_id: string }) => void;
  onMessageRead?: (payload: { conversation_id: string; reader_user_id: string; message_ids: string[] }) => void;
  onTyping?: (payload: { conversation_id: string; user_id: string; is_typing: boolean }) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
};

export function useSocket(token: string | null, conversationId: string | null, handlers: Handlers) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!token) return;

    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      query: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => handlersRef.current.onConnected?.());
    socket.on('disconnect', () => handlersRef.current.onDisconnected?.());
    socket.on('message:new', (p: any) => handlersRef.current.onMessageNew?.(p));
    socket.on('message:edited', (p: any) => handlersRef.current.onMessageEdited?.(p));
    socket.on('message:deleted', (p: any) => handlersRef.current.onMessageDeleted?.(p));
    socket.on('message:read', (p: any) => handlersRef.current.onMessageRead?.(p));
    socket.on('typing', (p: any) => handlersRef.current.onTyping?.(p));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  // (Re)join the active conversation room whenever it changes.
  useEffect(() => {
    const s = socketRef.current;
    if (!s || !conversationId) return;
    const join = () => s.emit('join_conversation', { conversation_id: conversationId });
    if (s.connected) join();
    else s.once('connect', join);
    return () => {
      s.emit('leave_conversation', { conversation_id: conversationId });
    };
  }, [conversationId]);

  const emitTyping = (conversationId: string, isTyping: boolean) => {
    socketRef.current?.emit('typing', { conversation_id: conversationId, is_typing: isTyping });
  };

  return { socket: socketRef.current, emitTyping };
}

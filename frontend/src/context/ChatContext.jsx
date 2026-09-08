import React, { createContext, useContext, useState, useEffect } from 'react';
import { chatService } from '../services/chatService';
import { documentService } from '../services/documentService';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeDocument, setActiveDocument] = useState(null);
  const [messages, setMessages] = useState([]);
  
  // UI States
  const [isUploading, setIsUploading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch sessions when user changes or search queries
  const loadSessions = async (search = '') => {
    try {
      const data = await chatService.getSessions({ search });
      if (data.sessions) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error('[Load Sessions Failed]:', err.message);
    }
  };

  useEffect(() => {
    if (user) loadSessions(searchQuery);
  }, [user, searchQuery]);

  // 2. Select a session and load its messages
  const selectSession = async (sessionId) => {
    try {
      setActiveSessionId(sessionId);
      const data = await chatService.getMessages(sessionId);
      if (data.messages) {
        setMessages(data.messages);
      }
      if (data.session) {
        setActiveDocument({
          id: data.session.document_id,
          name: data.session.file_name || 'Attached Paper',
          status: 'ready'
        });
      }
    } catch (err) {
      console.error('[Select Session Failed]:', err.message);
    }
  };

  // 3. Upload a new PDF document
  const uploadDocument = async (file) => {
    setIsUploading(true);
    try {
      const result = await documentService.upload(file);
      const doc = {
        id: result.document_id,
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        status: 'ready'
      };
      setActiveDocument(doc);
      setActiveSessionId(null);
      setMessages([]);
      return doc;
    } finally {
      setIsUploading(false);
    }
  };

  // 4. Send Message with Live SSE Streaming
  const sendMessage = async (messageText) => {
    if (!messageText.trim() || !activeDocument || isStreaming) return;

    // Optimistic User Message
    const userMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString()
    };

    // Placeholder Assistant Message
    const assistantMsg = {
      id: `temp-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      metadata: { sources: [] },
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    try {
      await chatService.streamMessage({
        document_id: activeDocument.id,
        message: messageText,
        session_id: activeSessionId,
        onSources: (payload) => {
          if (!activeSessionId && payload.session_id) {
            setActiveSessionId(payload.session_id);
            loadSessions(); // Refresh sidebar with the newly created session
          }
          setMessages(prev => {
            const lastIndex = prev.length - 1;
            if (lastIndex < 0 || prev[lastIndex].role !== 'assistant') return prev;
            const updatedLast = {
              ...prev[lastIndex],
              metadata: {
                ...prev[lastIndex].metadata,
                sources: payload.sources
              }
            };
            return [...prev.slice(0, lastIndex), updatedLast];
          });
        },
        onToken: (token) => {
          setMessages(prev => {
            const lastIndex = prev.length - 1;
            if (lastIndex < 0 || prev[lastIndex].role !== 'assistant') return prev;
            const updatedLast = {
              ...prev[lastIndex],
              content: prev[lastIndex].content + token
            };
            return [...prev.slice(0, lastIndex), updatedLast];
          });
        },
        onDone: (payload) => {
          setIsStreaming(false);
          if (payload.session_id) setActiveSessionId(payload.session_id);
          loadSessions();
        },
        onError: (errMsg) => {
          console.error('[Stream Error]:', errMsg);
          setIsStreaming(false);
        }
      });
    } catch (err) {
      console.error('[Send Message Failed]:', err.message);
      setIsStreaming(false);
    }
  };

  // 5. New Research Chat Reset
  const newChat = () => {
    setActiveDocument(null);
    setActiveSessionId(null);
    setMessages([]);
  };

  // 6. Delete a session
  const deleteSession = async (sessionId) => {
    await chatService.deleteSession(sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      newChat();
    }
  };

  return (
    <ChatContext.Provider value={{
      sessions,
      activeSessionId,
      activeDocument,
      messages,
      isUploading,
      isStreaming,
      searchQuery,
      setSearchQuery,
      selectSession,
      uploadDocument,
      sendMessage,
      newChat,
      deleteSession,
      loadSessions
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);

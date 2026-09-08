import React, { useRef, useEffect } from 'react';
import MessageItem from './MessageItem';
import ChatInput from './ChatInput';
import { useChat } from '../../context/ChatContext';

export default function ChatWorkspace() {
  const { activeDocument, messages, isStreaming, newChat } = useChat();
  const feedBottomRef = useRef(null);

  // Auto-scroll to latest message as tokens stream in
  useEffect(() => {
    feedBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  return (
    <div className="chat-workspace">
      {/* 1. Document Header Chip */}
      <div className="doc-header-chip">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.2rem' }}>📄</span>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>
              {activeDocument?.name || 'Research Document'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {activeDocument?.size || 'Processed'} • <span style={{ color: 'var(--status-ready-text)', fontWeight: '600' }}>Ready for Q&A</span>
            </div>
          </div>
        </div>

        <button className="btn-secondary" onClick={newChat}>
          Change Paper
        </button>
      </div>

      {/* 2. Messages Feed */}
      <div className="chat-feed">
        {messages.map((msg, index) => (
          <MessageItem
            key={msg.id || index}
            message={msg}
            isStreaming={isStreaming && index === messages.length - 1}
          />
        ))}
        <div ref={feedBottomRef} />
      </div>

      {/* 3. Floating Bottom Input */}
      <ChatInput />
    </div>
  );
}

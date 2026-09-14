import { useRef, useEffect } from 'react';
import { FileText, RefreshCw, Sparkles } from 'lucide-react';
import MessageItem from './MessageItem';
import ChatInput from './ChatInput';
import { useChat } from '../../context/ChatContext';

export default function ChatWorkspace() {
  const { activeDocument, messages, isStreaming, newChat } = useChat();
  const feedBottomRef = useRef(null);

  // Auto-scroll to latest message only when messages exist or stream is updating
  useEffect(() => {
    if (messages.length > 0) {
      feedBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  return (
    <div className="chat-workspace">
      {/* 1. Document Header Chip */}
      <div className="doc-header-chip">
        <div className="doc-chip-left">
          <div className="doc-chip-icon">
            <FileText size={18} />
          </div>
          <div className="doc-chip-details">
            <span className="doc-chip-title" title={activeDocument?.name}>
              {activeDocument?.name || 'Research Document'}
            </span>
            <div className="doc-chip-meta">
              <span>{activeDocument?.size || 'Processed'}</span>
              <span className="doc-chip-bullet">•</span>
              <span className="doc-chip-status">Ready for Q&A</span>
            </div>
          </div>
        </div>

        <button 
          className="btn-change-paper" 
          onClick={newChat} 
          title="Change research paper"
        >
          <RefreshCw size={13} className="btn-change-icon" />
          <span>Change Paper</span>
        </button>
      </div>

      {/* 2. Messages Feed */}
      <div className="chat-feed">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <div className="empty-state-icon">
              <Sparkles size={26} />
            </div>
            <h3 className="empty-state-title">Ready to analyze</h3>
            <p className="empty-state-subtitle">
              Ask any question, request summaries, or extract key methodology citations from this paper.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <MessageItem
              key={msg.id || index}
              message={msg}
              isStreaming={isStreaming && index === messages.length - 1}
            />
          ))
        )}
        <div ref={feedBottomRef} />
      </div>

      {/* 3. Floating Bottom Input */}
      <ChatInput />
    </div>
  );
}


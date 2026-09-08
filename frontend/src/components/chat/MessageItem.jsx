import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Sparkles, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

export default function MessageItem({ message, isStreaming = false }) {
  const isUser = message.role === 'user';
  const sources = message.metadata?.sources || [];
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && (
        <div className="message-avatar bot-avatar">
          <Sparkles size={16} />
        </div>
      )}

      <div className="message-content">
        {isUser ? (
          <div className="user-bubble">
            {message.content}
          </div>
        ) : (
          <div className="assistant-card">
            {/* Grounded Sources Accordion (if sources returned by Pinecone) */}
            {sources.length > 0 && (
              <div className="citation-box">
                <button 
                  className="citation-header-btn"
                  onClick={() => setIsSourcesOpen(!isSourcesOpen)}
                >
                  <span>
                    📚 Grounded Sources ({sources.length} excerpt{sources.length > 1 ? 's' : ''} cited)
                  </span>
                  {isSourcesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {isSourcesOpen && (
                  <div className="citation-list">
                    {sources.map((source, idx) => (
                      <div key={idx} className="citation-chunk-card">
                        <div className="chunk-meta">
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                            Source #{idx + 1}
                          </span>
                          <span className="relevance-tag">
                            {source.relevance_score}% Match
                          </span>
                        </div>
                        <div className="chunk-text">
                          "{source.text}"
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Answer Content */}
            <ReactMarkdown>{message.content}</ReactMarkdown>

            {/* Streaming Cursor */}
            {isStreaming && <span className="streaming-cursor" />}

            {/* Copy Button Footer */}
            {!isStreaming && message.content && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={handleCopy}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    padding: '4px'
                  }}
                  title="Copy response"
                >
                  {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="message-avatar user-avatar">
          <User size={16} />
        </div>
      )}
    </div>
  );
}

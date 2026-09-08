import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export default function ChatInput() {
  const { sendMessage, isStreaming, messages } = useChat();
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);

  const samplePrompts = [
    'Summarize the core problem and proposed solution.',
    'Explain the methodology step-by-step.',
    'What are the key findings and conclusions?'
  ];

  // Auto-resize textarea height as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-input-wrapper">
      {/* Suggestion Pills (Shown if conversation has 0 messages yet) */}
      {messages.length === 0 && (
        <div className="suggestions-container">
          {samplePrompts.map((prompt, idx) => (
            <button
              key={idx}
              className="btn-suggestion"
              onClick={() => sendMessage(prompt)}
            >
              <Sparkles size={12} style={{ display: 'inline', marginRight: '4px' }} />
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="input-box">
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          rows={1}
          placeholder="Ask any question about this research paper (Enter to send, Shift+Enter for new line)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
        />

        <button
          type="submit"
          className="btn-send"
          disabled={!input.trim() || isStreaming}
          title="Send query"
        >
          <Send size={16} />
        </button>
      </form>

      <div className="disclaimer-text">
        AI responses are grounded in vector chunks from your uploaded paper • Verify critical citations
      </div>
    </div>
  );
}

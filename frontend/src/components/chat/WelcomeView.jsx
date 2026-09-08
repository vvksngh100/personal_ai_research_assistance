import React, { useState } from 'react';
import { UploadCloud, Loader2, AlertCircle } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export default function WelcomeView() {
  const { uploadDocument, isUploading } = useChat();
  const [errorMessage, setErrorMessage] = useState(null);

  const processFile = async (file) => {
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setErrorMessage('Only PDF documents are allowed.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 10MB limit.');
      return;
    }

    try {
      setErrorMessage(null);
      await uploadDocument(file);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to upload and vectorize paper.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="welcome-container">
      <h1 className="welcome-title">What are you researching today?</h1>
      <p className="welcome-subtitle">
        Upload a research paper (PDF up to 10MB) to start asking questions and analyzing citations.
      </p>

      {/* Upload Dropzone */}
      <div 
        className="dropzone-card"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{ pointerEvents: isUploading ? 'none' : 'auto' }}
      >
        <div className="dropzone-icon-box">
          {isUploading ? (
            <Loader2 size={32} className="spin-animation" />
          ) : (
            <UploadCloud size={32} />
          )}
        </div>

        {isUploading ? (
          <>
            <p className="dropzone-text" style={{ color: 'var(--brand-primary)' }}>
              Analyzing PDF & generating 768-dim embeddings...
            </p>
            <span className="dropzone-subtext">
              Chunking text and upserting vectors to Pinecone. This takes 5–10 seconds.
            </span>
          </>
        ) : (
          <>
            <p className="dropzone-text">
              Drop your PDF here, or{' '}
              <label className="dropzone-link">
                Browse Files
                <input 
                  type="file" 
                  accept="application/pdf" 
                  onChange={handleFileChange} 
                  style={{ display: 'none' }} 
                />
              </label>
            </p>
            <span className="dropzone-subtext">
              Supports academic papers, reports, and documentation up to 10MB
            </span>
          </>
        )}
      </div>

      {/* Error Message Pill */}
      {errorMessage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          backgroundColor: 'var(--status-failed-bg)',
          color: 'var(--status-failed-text)',
          border: '1px solid var(--status-failed-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.85rem',
          marginTop: '-16px'
        }}>
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

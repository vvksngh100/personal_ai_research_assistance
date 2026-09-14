import React, { useState } from 'react';
import { UploadCloud, Loader2, AlertCircle } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export default function WelcomeView() {
  const { uploadDocument, isUploading, uploadProgress } = useChat();
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
        Upload a PDF (up to 10MB) to start asking questions and analyzing citations.
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '360px' }}>
            <p className="dropzone-text" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
              {uploadProgress?.message || 'Analyzing PDF & generating embeddings...'}
            </p>

            {/* Smooth Progress Bar */}
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'var(--border-subtle)',
              borderRadius: '999px',
              overflow: 'hidden',
              margin: '12px 0 8px',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.max(5, Math.min(100, uploadProgress?.percentage || 5))}%`,
                backgroundColor: 'var(--brand-primary)',
                borderRadius: '999px',
                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span className="dropzone-subtext" style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
                {uploadProgress?.percentage ? `${uploadProgress.percentage}%` : 'Processing...'}
              </span>
              <span className="dropzone-subtext">
                {uploadProgress?.stage === 'indexing' ? 'Indexing vectors' : 'Generating embeddings'}
              </span>
            </div>
          </div>
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

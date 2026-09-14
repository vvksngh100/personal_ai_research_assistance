import React, { useEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const ModalContext = createContext(null);

export function Modal({
  isOpen,
  onClose,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  children
}) {
  // 1. Handle Escape Key
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEsc, onClose]);

  // 2. Lock Body Scroll while Open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <ModalContext.Provider value={{ onClose, size }}>
      <div 
        className="modal-backdrop" 
        onClick={(e) => {
          if (closeOnOverlayClick && e.target === e.currentTarget) {
            onClose();
          }
        }}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </ModalContext.Provider>,
    document.body
  );
}

export function ModalContent({ children, className = '' }) {
  const { size } = useContext(ModalContext);
  return (
    <div 
      className={`modal-card modal-size-${size} ${className}`}
      onClick={(e) => e.stopPropagation()} // Prevent clicking modal from closing backdrop
    >
      {children}
    </div>
  );
}

export function ModalHeader({ title, subtitle, showCloseButton = true, children }) {
  const { onClose } = useContext(ModalContext);
  return (
    <div className="modal-header">
      <div className="modal-header-text">
        {title && <h2 className="modal-title">{title}</h2>}
        {subtitle && <p className="modal-subtitle">{subtitle}</p>}
        {children}
      </div>
      {showCloseButton && (
        <button 
          className="modal-close-btn" 
          onClick={onClose}
          aria-label="Close modal"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

export function ModalBody({ children, className = '' }) {
  return (
    <div className={`modal-body ${className}`}>
      {children}
    </div>
  );
}

export function ModalFooter({ children, className = '' }) {
  return (
    <div className={`modal-footer ${className}`}>
      {children}
    </div>
  );
}

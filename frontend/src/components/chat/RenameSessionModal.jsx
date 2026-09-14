import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '../common/Modal';
import { useChat } from '../../context/ChatContext';

export default function RenameSessionModal({ isOpen, session, onClose }) {
  const { renameSession } = useChat();
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (session && isOpen) {
      setTitle(session.title || session.file_name || '');
      setError(null);
      setIsLoading(false);
    }
  }, [session, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please enter a session title');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await renameSession(session.id, trimmedTitle);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to rename session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalContent>
        <ModalHeader 
          title="Rename Research Session" 
          subtitle="Change the title for this research chat" 
        />
        <form onSubmit={handleSubmit}>
          <ModalBody>
            <div className="modal-field-group">
              <label htmlFor="rename-session-input" className="modal-field-label">
                Session Title
              </label>
              <input
                id="rename-session-input"
                type="text"
                className={`modal-input ${error ? 'error' : ''}`}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Methodology Analysis"
                autoFocus
                disabled={isLoading}
              />
              {error && (
                <span className="modal-field-error">
                  {error}
                </span>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              className="btn-modal-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary-action"
              disabled={isLoading || !title.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 size={15} className="spin-animation" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save</span>
              )}
            </button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

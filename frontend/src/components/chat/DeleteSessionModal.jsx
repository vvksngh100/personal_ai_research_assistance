import { useState } from 'react';
import { AlertTriangle, Trash2, FileText, Loader2 } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '../common/Modal';
import { useChat } from '../../context/ChatContext';

export default function DeleteSessionModal({ isOpen, session, onClose }) {
  const { deleteSession } = useChat();
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      await deleteSession(session.id);
      onClose();
    } catch (err) {
      console.error('[Delete Session Failed]:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalContent>
        <ModalHeader
          title="Delete Research Session"
          subtitle="Permanently remove this session"
        />
        <ModalBody>
          <div className="modal-danger-body">
            <div style={{display: 'flex', flexDirection: 'row', gap: '8px'}}>
              <div className="danger-icon-badge">
              <AlertTriangle size={20} />
            </div>
            <div className="modal-danger-text-container">
              <p className="modal-danger-prompt">
                Are you sure you want to delete this session?
              </p>
              
            </div>
            </div>
            <div>
              <div className="delete-target-preview">
                <div className="delete-target-title">
                  {session.title || session.file_name || 'Untitled Session'}
                </div>
                {session.file_name && (
                  <div className="delete-target-filename">
                    <FileText size={13} />
                    <span>{session.file_name}</span>
                  </div>
                )}
              </div>
              <p className="modal-danger-subtext">
                All conversation history and grounded citations will be permanently erased.
              </p>
            </div>
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
            type="button"
            className="btn-danger-action"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="spin-animation" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 size={15} />
                <span>Delete Session</span>
              </>
            )}
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

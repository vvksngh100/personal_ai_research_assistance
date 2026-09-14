import { useState, lazy, Suspense } from 'react';
import { Menu, GraduationCap, Plus, Loader2 } from 'lucide-react';
import Sidebar from './components/layout/Sidebar';
import WelcomeView from './components/chat/WelcomeView';
import { useChat } from './context/ChatContext';

// Lazy-loaded on-demand components
const ChatWorkspace = lazy(() => import('./components/chat/ChatWorkspace'));
const AuthModal = lazy(() => import('./components/auth/AuthModal'));

function WorkspaceFallback() {
  return (
    <div className="workspace-loading-fallback">
      <div className="fallback-spinner-container">
        <Loader2 size={28} className="spin-animation fallback-spinner" />
        <span className="fallback-loading-text">Loading Research Session...</span>
      </div>
    </div>
  );
}

function App() {
  const { activeDocument, newChat } = useChat();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Auth Modal State
  const [authModal, setAuthModal] = useState({ isOpen: false, mode: 'signin' });

  return (
    <div className="app-layout">
      {/* Sidebar triggers the modal */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenAuth={(mode) => setAuthModal({ isOpen: true, mode })}
      />

      <main className="app-main">
        {/* Mobile Navbar - pinned at the top */}
        <header className="mobile-top-bar">
          <button 
            className="btn-hamburger" 
            onClick={() => setIsMobileSidebarOpen(true)}
            aria-label="Open sidebar menu"
          >
            <Menu size={22} />
          </button>
          
          <div className="mobile-brand">
            <div className="brand-icon mobile-brand-icon">
              <GraduationCap size={16} />
            </div>
            <span className="brand-name mobile-brand-name">ScholarAI</span>
          </div>

          <div className="mobile-top-bar-actions">
            {activeDocument ? (
              <button 
                className="btn-mobile-new-chat" 
                onClick={newChat}
                title="Start a new research chat"
                aria-label="New chat"
              >
                <Plus size={18} />
              </button>
            ) : (
              <div className="mobile-top-bar-placeholder" />
            )}
          </div>
        </header>

        <div className="app-content-area">
          {!activeDocument ? (
            <WelcomeView />
          ) : (
            <Suspense fallback={<WorkspaceFallback />}>
              <ChatWorkspace />
            </Suspense>
          )}
        </div>
      </main>

      {/* Global Auth Modal - only mounted & fetched when triggered */}
      {authModal.isOpen && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={authModal.isOpen}
            onClose={() => setAuthModal(prev => ({ ...prev, isOpen: false }))}
            defaultMode={authModal.mode}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;

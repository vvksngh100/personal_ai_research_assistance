import React, { useState } from 'react';
import { Menu, GraduationCap } from 'lucide-react';
import Sidebar from './components/layout/Sidebar';
import WelcomeView from './components/chat/WelcomeView';
import ChatWorkspace from './components/chat/ChatWorkspace';
import { useChat } from './context/ChatContext';

function App() {
  const { activeDocument } = useChat();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenAuth={(mode) => alert(`Open ${mode} modal`)}
      />

      <main className="app-main">
        {/* Mobile Navbar */}
        <div className="mobile-top-bar">
          <button 
            className="btn-hamburger" 
            onClick={() => setIsMobileSidebarOpen(true)}
            aria-label="Open Navigation"
          >
            <Menu size={24} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="brand-icon" style={{ width: '28px', height: '28px' }}>
              <GraduationCap size={16} />
            </div>
            <span className="brand-name" style={{ fontSize: '1rem' }}>ScholarAI</span>
          </div>
          <div style={{ width: '24px' }} />
        </div>

        {/* View Switch: Welcome Screen vs Active Chat */}
        {!activeDocument ? <WelcomeView /> : <ChatWorkspace />}
      </main>
    </div>
  );
}

export default App;

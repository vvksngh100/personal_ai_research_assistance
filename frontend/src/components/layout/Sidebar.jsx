import React from 'react';
import { 
  GraduationCap, 
  Plus, 
  Search, 
  MessageSquare, 
  FileText, 
  Sun, 
  Moon, 
  User, 
  Trash2, 
  LogOut,
  X 
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ 
  isMobileOpen = false, 
  onCloseMobile, 
  onOpenAuth 
}) {
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const { 
    sessions, 
    activeSessionId, 
    activeDocument,
    selectSession, 
    newChat, 
    deleteSession,
    searchQuery,
    setSearchQuery 
  } = useChat();

  // "New Research Chat" is enabled only if there's an active session or document
  const isNewChatEnabled = Boolean(activeDocument || activeSessionId);

  const handleSelect = (id) => {
    selectSession(id);
    if (onCloseMobile) onCloseMobile();
  };

  const handleNew = () => {
    if (!isNewChatEnabled) return;
    newChat();
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div 
        className={`sidebar-backdrop ${isMobileOpen ? 'mobile-open' : ''}`} 
        onClick={onCloseMobile} 
      />

      <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* 1. Header & Brand */}
        <div className="sidebar-header">
          <div className="sidebar-brand" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="brand-icon">
                <GraduationCap size={22} />
              </div>
              <span className="brand-name">ScholarAI</span>
            </div>

            {onCloseMobile && (
              <button 
                onClick={onCloseMobile}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            )}
          </div>

          <button 
            className="btn-new-chat" 
            onClick={handleNew}
            disabled={!isNewChatEnabled}
            title={!isNewChatEnabled ? 'Already on a new session' : 'Start a new research chat'}
          >
            <Plus size={18} />
            New Research Chat
          </button>
        </div>

        {/* 2. Search Input */}
        <div className="sidebar-search-container">
          <div className="search-box">
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              className="search-input"
              placeholder="Search sessions or papers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* 3. Sessions List */}
        <div className="sidebar-sessions">
          <div className="section-label">Recent Sessions</div>

          {sessions.length === 0 ? (
            <div className="sessions-empty">
              No research sessions yet.<br />
              <span style={{ fontSize: '0.78rem' }}>Upload a paper to get started.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <div
                    key={session.id}
                    className={`session-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelect(session.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <MessageSquare size={16} color={isActive ? 'var(--brand-primary)' : 'var(--text-secondary)'} />
                      <div style={{ minWidth: 0 }}>
                        <div className="session-title">
                          {session.title || 'Untitled Session'}
                        </div>
                        {session.file_name && (
                          <div className="session-doc-name">
                            <FileText size={12} />
                            {session.file_name}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      className="btn-icon-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      title="Delete Session"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Footer: Auth & Appearance */}
        <div className="sidebar-footer">
          {!isAuthenticated ? (
            <div className="auth-buttons-grid">
              <button className="btn-signin" onClick={() => onOpenAuth('signin')}>
                Sign In
              </button>
              <button className="btn-signup" onClick={() => onOpenAuth('signup')}>
                Sign Up
              </button>
            </div>
          ) : (
            <div className="footer-user-row">
              <div className="user-profile-badge">
                <div className="user-avatar"><User size={16} /></div>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {user?.name || user?.username || 'Researcher'}
                </span>
              </div>
              <button className="btn-icon-delete" onClick={logout} title="Log Out">
                <LogOut size={16} />
              </button>
            </div>
          )}

          <div className="footer-user-row">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Appearance</span>
            <button
              className="btn-theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} color="#fbbf24" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

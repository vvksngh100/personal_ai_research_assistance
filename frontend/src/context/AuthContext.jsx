import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { getToken } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize Auth on Boot
  const initAuth = async () => {
    try {
      const token = getToken();
      if (!token) {
        // First-time visitor: generate guest token silently
        const guestData = await authService.getGuestToken();
        setIsGuest(true);
        setUser({ id: guestData.guest_id, isGuest: true });
      } else {
        // Try to fetch user profile
        try {
          const profileData = await authService.getProfile();
          setUser(profileData.user);
          setIsGuest(false);
        } catch {
          // Fallback to guest if token was a guest token
          setIsGuest(true);
        }
      }
    } catch (err) {
      console.error('[Auth Init Failed]:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initAuth();

    // Listen for 401 unauthorized events to re-bootstrap
    const handleUnauthorized = () => {
      setUser(null);
      initAuth();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (credentials) => {
    const data = await authService.login(credentials);
    setUser(data.user);
    setIsGuest(false);
    return data;
  };

  const register = async (details) => {
    const guestId = isGuest ? user?.id : null;
    const data = await authService.register({ ...details, guestId });
    setUser(data.user);
    setIsGuest(false);
    return data;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    initAuth(); // Revert back to fresh guest mode
  };

  return (
    <AuthContext.Provider value={{
      user,
      isGuest,
      isAuthenticated: Boolean(user && !isGuest),
      loading,
      login,
      register,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

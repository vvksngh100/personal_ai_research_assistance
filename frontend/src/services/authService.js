import { apiRequest, setToken, removeToken } from './api';

export const authService = {
  // 1. Fetch guest token for unauthenticated visitors
  async getGuestToken() {
    const data = await apiRequest('/api/auth/guest-id', { method: 'GET' });
    if (data.token) setToken(data.token);
    return data;
  },

  // 2. Register new user
  async register({ guestId, name, username, email, password }) {
    const data = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ guestId, name, username, email, password }),
    });
    if (data.token) setToken(data.token);
    return data;
  },

  // 3. Login existing user
  async login({ email, password }) {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) setToken(data.token);
    return data;
  },

  // 4. Fetch current user profile
  async getProfile() {
    return await apiRequest('/api/auth/me', { method: 'GET' });
  },

  // 5. Logout
  logout() {
    removeToken();
  }
};

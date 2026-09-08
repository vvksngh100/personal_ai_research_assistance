const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const getToken = () => localStorage.getItem('scholar_token');
export const setToken = (token) => localStorage.setItem('scholar_token', token);
export const removeToken = () => localStorage.removeItem('scholar_token');

export const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
  };

  // Attach token automatically if available
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If payload is not FormData, default to application/json
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized (Expired token)
  if (response.status === 401 && !endpoint.includes('/api/auth/guest-id')) {
    removeToken();
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

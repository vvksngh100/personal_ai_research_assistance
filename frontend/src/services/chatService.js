import { apiRequest, getToken } from './api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const chatService = {
  // 1. Fetch Sessions (with cursor pagination & search)
  async getSessions({ cursor, limit = 15, search, documentId } = {}) {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', limit);
    if (search) params.append('search', search);
    if (documentId) params.append('documentId', documentId);

    return await apiRequest(`/api/chat/sessions?${params.toString()}`, {
      method: 'GET',
    });
  },

  // 2. Fetch Messages within a session
  async getMessages(sessionId, { cursor, limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', limit);

    return await apiRequest(`/api/chat/messages/${sessionId}?${params.toString()}`, {
      method: 'GET',
    });
  },

  // 3. Delete Session
  async deleteSession(sessionId) {
    return await apiRequest(`/api/chat/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },

  // 4. Real-time SSE Chat Stream Reader
  async streamMessage({ document_id, message, session_id, onSources, onToken, onDone, onError }) {
    const token = getToken();

    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({
        document_id,
        message,
        session_id,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to start chat stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // Keep incomplete trailing fragment

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.type === 'sources' && onSources) onSources(payload);
            if (payload.type === 'token' && onToken) onToken(payload.text);
            if (payload.type === 'done' && onDone) onDone(payload);
            if (payload.type === 'error' && onError) onError(payload.error);
          } catch (e) {
            console.warn('[SSE Parse Warning]:', e.message);
          }
        }
      }
    }
  }
};

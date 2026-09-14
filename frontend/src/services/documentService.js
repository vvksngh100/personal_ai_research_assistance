import { apiRequest, getToken } from './api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const documentService = {
  // 1. Upload PDF with multipart form-data
  async upload(file) {
    const formData = new FormData();
    formData.append('file', file);

    return await apiRequest('/api/upload', {
      method: 'POST',
      body: formData,
    });
  },

  // 2. Pure Server-Sent Events (SSE) Stream Reader with auto-reconnect on socket interruptions
  async subscribeToProgress(documentId, { onProgress, onReady, onError }) {
    const token = getToken();
    let isCompleted = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isCompleted && attempts < maxAttempts) {
      try {
        attempts++;
        const response = await fetch(`${API_BASE_URL}/api/upload/progress/${documentId}`, {
          method: 'GET',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Accept': 'text/event-stream',
          },
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to connect to progress stream (HTTP ${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || ''; // Keep incomplete fragment

          for (const rawEvent of events) {
            const lines = rawEvent.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ')) {
                try {
                  const payload = JSON.parse(trimmed.slice(6));

                  if (onProgress && payload.percentage !== undefined) {
                    onProgress(payload);
                  }

                  if (payload.status === 'ready') {
                    isCompleted = true;
                    if (onReady) onReady(payload);
                    return;
                  }

                  if (payload.status === 'failed') {
                    isCompleted = true;
                    const error = new Error(payload.error || 'Document vectorization failed');
                    if (onError) onError(error);
                    return;
                  }
                } catch (parseErr) {
                  console.warn('[SSE Parse Warning]:', parseErr.message);
                }
              }
            }
          }
        }

        // If stream ended without an explicit status, wait briefly and retry if still not completed
        if (isCompleted) return;

      } catch (err) {
        if (isCompleted) return;
        console.warn(`[SSE Stream Notice (Attempt ${attempts}/${maxAttempts})]: Reconnecting to stream...`, err.message);

        if (attempts >= maxAttempts) {
          if (onError) onError(err);
          return;
        }

        // Wait 1.2s before auto-reconnecting to resume progress stream
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }
  },

  // 3. Fetch list of uploaded documents
  async getDocuments(page = 1, limit = 10) {
    return await apiRequest(`/api/upload?page=${page}&limit=${limit}`, {
      method: 'GET',
    });
  },

  // 4. Delete document
  async deleteDocument(id) {
    return await apiRequest(`/api/upload/${id}`, {
      method: 'DELETE',
    });
  }
};

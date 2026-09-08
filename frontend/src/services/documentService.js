import { apiRequest } from './api';

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

  // 2. Fetch list of uploaded documents
  async getDocuments(page = 1, limit = 10) {
    return await apiRequest(`/api/upload?page=${page}&limit=${limit}`, {
      method: 'GET',
    });
  },

  // 3. Delete document
  async deleteDocument(id) {
    return await apiRequest(`/api/upload/${id}`, {
      method: 'DELETE',
    });
  }
};

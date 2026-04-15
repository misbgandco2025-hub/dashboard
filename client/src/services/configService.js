import api from './api';

export const getDocumentTypes = (type) => api.get(`/config/documents/${type}`);
export const createDocumentType = (data) => api.post('/config/documents', data);
export const updateDocumentType = (id, data) => api.put(`/config/documents/${id}`, data);
export const deleteDocumentType = (id) => api.delete(`/config/documents/${id}`);

export const getStatusOptions = (type) => api.get(`/config/status-options/${type}`);
export const createStatusOption = (data) => api.post('/config/status-options', data);
export const updateStatusOption = (id, data) => api.put(`/config/status-options/${id}`, data);

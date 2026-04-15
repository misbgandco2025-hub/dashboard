import api from './api';

export const getVendors = (params) => api.get('/vendors', { params });
export const getVendorById = (id) => api.get(`/vendors/${id}`);
export const createVendor = (data) => api.post('/vendors', data);
export const updateVendor = (id, data) => api.put(`/vendors/${id}`, data);
export const deleteVendor = (id) => api.delete(`/vendors/${id}`);
export const getVendorStatistics = (id) => api.get(`/vendors/${id}/statistics`);

    import api from './api';

export const getFees = (params) => api.get('/fees', { params });
export const getFeeById = (id) => api.get(`/fees/${id}`);
export const createFee = (data) => api.post('/fees', data);
export const updateFee = (id, data) => api.put(`/fees/${id}`, data);
export const deleteFee = (id) => api.delete(`/fees/${id}`);
export const addFeePayment = (id, data) => api.post(`/fees/${id}/payment`, data);
export const waiveFee = (id, data) => api.put(`/fees/${id}/waive`, data);
export const getFeeAnalytics = (period = 'month') => api.get('/fees/analytics', { params: { period } });

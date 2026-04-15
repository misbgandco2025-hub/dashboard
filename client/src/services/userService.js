import api from './api';

export const getUsers = (params) => api.get('/users', { params });
export const getUserById = (id) => api.get(`/users/${id}`);
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deactivateUser = (id) => api.delete(`/users/${id}`);
export const resetPassword = (id, data) => api.put(`/users/${id}/reset-password`, data);
export const changeRole = (id, data) => api.put(`/users/${id}/change-role`, data);

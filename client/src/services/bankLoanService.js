import api from './api';

export const getBankLoans = (params) => api.get('/bank-loans', { params });
export const getBankLoanById = (id) => api.get(`/bank-loans/${id}`);
export const createBankLoan = (data) => api.post('/bank-loans', data);
export const updateBankLoan = (id, data) => api.put(`/bank-loans/${id}`, data);
export const deleteBankLoan = (id) => api.delete(`/bank-loans/${id}`);
export const updateBankLoanStatus = (id, data) => api.put(`/bank-loans/${id}/status`, data);
export const updateDocumentChecklist = (id, data) => api.put(`/bank-loans/${id}/documents`, data);
export const addQuery = (id, data) => api.post(`/bank-loans/${id}/queries`, data);
export const updateQuery = (id, queryId, data) => api.put(`/bank-loans/${id}/queries/${queryId}`, data);
export const addTimelineEntry = (id, data) => api.post(`/bank-loans/${id}/timeline`, data);
export const getTimeline = (id) => api.get(`/bank-loans/${id}/timeline`);
export const assignBankLoan = (id, data) => api.put(`/bank-loans/${id}/assign`, data);
export const updateAifCredentials = (id, data) => api.put(`/bank-loans/${id}/aif-credentials`, data);

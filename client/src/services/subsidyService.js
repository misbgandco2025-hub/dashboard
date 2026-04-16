import api from './api';

export const getSubsidies                = (params)            => api.get('/subsidies', { params });
export const getSubsidyById              = (id)                => api.get(`/subsidies/${id}`);
export const createSubsidy               = (data)              => api.post('/subsidies', data);
export const updateSubsidy               = (id, data)          => api.put(`/subsidies/${id}`, data);
export const deleteSubsidy               = (id)                => api.delete(`/subsidies/${id}`);
export const updateSubsidyStatus         = (id, data)          => api.put(`/subsidies/${id}/status`, data);
export const updateSubsidyDocumentChecklist = (id, data)       => api.put(`/subsidies/${id}/documents`, data);
export const addSubsidyQuery             = (id, data)          => api.post(`/subsidies/${id}/queries`, data);
export const updateSubsidyQuery          = (id, queryId, data) => api.put(`/subsidies/${id}/queries/${queryId}`, data);
export const addSubsidyTimelineEntry     = (id, data)          => api.post(`/subsidies/${id}/timeline`, data);
export const getSubsidyTimeline          = (id)                => api.get(`/subsidies/${id}/timeline`);
export const assignSubsidy               = (id, data)          => api.put(`/subsidies/${id}/assign`, data);
export const updateGocCredentials        = (id, data)          => api.put(`/subsidies/${id}/goc-credentials`, data);

// ── Typed helpers for nested field updates (all hit PUT /:id) ────────────────
export const updateSubsidyNhbDetails     = (id, nhbDetails)    => updateSubsidy(id, { nhbDetails });
export const updateSubsidyGocDetails     = (id, gocDetails)    => updateSubsidy(id, { gocDetails });
export const updateSubsidyPayment        = (id, paymentDetails) => updateSubsidy(id, { paymentDetails });
export const updateSubsidyVerification   = (id, data)          => updateSubsidy(id, data);

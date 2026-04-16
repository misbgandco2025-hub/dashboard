import api from './api';

export const getClientWiseReport   = (params) => api.get('/reports/client-wise',       { params });
export const getVendorWiseReport    = (params) => api.get('/reports/vendor-wise',        { params });
export const getStatusWiseReport    = (params) => api.get('/reports/status-wise',        { params });
export const getDateRangeReport     = (params) => api.get('/reports/date-range',         { params });
export const getPerformanceReport   = (params) => api.get('/reports/performance',        { params });
export const getAuditLogReport      = (params) => api.get('/reports/audit-log',          { params });
export const getSubsidyAnalytics    = (params) => api.get('/reports/subsidy-analytics',  { params });


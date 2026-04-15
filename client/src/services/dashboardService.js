import api from './api';

export const getDashboardSummary = (params) => api.get('/dashboard/summary', { params });
export const getVendorDistribution = (params) => api.get('/dashboard/vendor-distribution', { params });
export const getStatusDistribution = (params) => api.get('/dashboard/status-distribution', { params });
export const getMonthlyTrend = (params) => api.get('/dashboard/monthly-trend', { params });
export const getPerformanceMetrics = (params) => api.get('/dashboard/performance-metrics', { params });
export const getMyTasks = () => api.get('/dashboard/my-tasks');

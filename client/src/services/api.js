import axios from 'axios';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message || 'An error occurred';

    if (status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (status === 403) {
      toast.error('Access denied. You do not have permission for this action.');
      return Promise.reject(error);
    }

    if (status === 429) {
      toast.error('Too many requests. Please wait a moment and try again.');
      return Promise.reject(error);
    }

    if (!error.response) {
      toast.error('Network error. Please check your connection.');
    }

    return Promise.reject({ ...error, message });
  }
);

export default api;

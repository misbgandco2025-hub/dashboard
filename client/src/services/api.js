import axios from 'axios';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  withCredentials: true, // send the HTTP-only refresh-token cookie on every request
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // helps server-side CSRF detection
  },
});

// ── Request interceptor — attach in-memory JWT ────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Silent token refresh logic ────────────────────────────────────────────────
// If multiple requests fail with 401 simultaneously, only one refresh call is
// made; all other failed requests are queued and retried with the new token.

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

// ── Response interceptor — global error handling + silent refresh ─────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config;
    const message = error.response?.data?.message || error.message || 'An error occurred';

    // ── 401 — attempt a silent token refresh, then retry ──────────────────────
    if (status === 401 && !originalRequest._retry) {
      // If the refresh endpoint itself returned 401, give up immediately.
      if (originalRequest.url?.includes('/auth/refresh-token')) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until the in-flight refresh resolves.
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post('/auth/refresh-token');
        const newToken = data?.data?.accessToken;
        if (!newToken) throw new Error('No access token in refresh response');

        useAuthStore.getState().setToken(newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (status === 403) {
      toast.error('Access denied. You do not have permission for this action.');
      return Promise.reject({ ...error, message });
    }

    if (status === 429) {
      toast.error('Too many requests. Please wait a moment and try again.');
      return Promise.reject({ ...error, message });
    }

    if (!error.response) {
      toast.error('Network error. Please check your connection.');
    }

    return Promise.reject({ ...error, message });
  }
);

export default api;

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Auth store — security model:
 *
 *  • `user` and `isAuthenticated` are persisted to localStorage so the UI
 *    can render immediately on reload without waiting for a network round-trip.
 *
 *  • `token` (the JWT access token) is kept in memory ONLY — it is never
 *    written to localStorage, eliminating the XSS-exfiltration vector.
 *    On a cold page load the token starts null; the API interceptor in
 *    api.js will silently call /auth/refresh-token (using the HTTP-only
 *    refresh cookie) to obtain a fresh access token before the first real
 *    request is dispatched.
 */
const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,          // in-memory only — NOT included in partialize
      isAuthenticated: false,

      setAuth: (user, token) =>
        set({ user, token, isAuthenticated: true }),

      /** Update only the in-memory token (called after a silent refresh). */
      setToken: (token) => set({ token }),

      logout: () =>
        set({ user: null, token: null, isAuthenticated: false }),

      updateProfile: (data) =>
        set((state) => ({ user: { ...state.user, ...data } })),

      getRole: () => get().user?.role ?? null,
    }),
    {
      name: 'auth-storage',
      // Deliberately exclude `token` — it must never reach localStorage.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;

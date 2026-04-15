import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';

import Login from './pages/auth/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Vendors from './pages/Vendors';
import BankLoans from './pages/BankLoans';
import Subsidies from './pages/Subsidies';
import Reports from './pages/Reports';
import Configuration from './pages/Configuration';
import Users from './pages/Users';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="clients/*" element={<Clients />} />
          <Route path="vendors/*" element={<Vendors />} />
          <Route path="bank-loans/*" element={<BankLoans />} />
          <Route path="subsidies/*" element={<Subsidies />} />
          <Route path="reports/*" element={<Reports />} />
          <Route
            path="configuration/*"
            element={
              <ProtectedRoute requiredPage="configuration">
                <Configuration />
              </ProtectedRoute>
            }
          />
          <Route
            path="users/*"
            element={
              <ProtectedRoute requiredPage="users">
                <Users />
              </ProtectedRoute>
            }
          />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: { fontSize: '13px', borderRadius: '10px', fontFamily: 'Inter, sans-serif' },
        success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
      }}
    />
  </QueryClientProvider>
);

export default App;

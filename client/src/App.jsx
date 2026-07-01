// Top-level routing.
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { tokenStore } from './api/client.js';
import LoginPage from './pages/LoginPage.jsx';
import WorkerPortal from './pages/WorkerPortal.jsx';
import OwnerPortal from './pages/OwnerPortal.jsx';
import AdminLoginPage from './pages/AdminLoginPage.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

/** Redirects to /login if the user is not authenticated. */
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

/**
 * Redirects to /admin/login if there is no admin session. Fully independent
 * of the regular store login — an operator doesn't need a store account.
 */
function AdminProtectedRoute({ children }) {
  return tokenStore.getAdmin() ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/worker" replace /> : <LoginPage />}
      />
      <Route
        path="/worker"
        element={
          <ProtectedRoute>
            <WorkerPortal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner"
        element={
          <ProtectedRoute>
            <OwnerPortal />
          </ProtectedRoute>
        }
      />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <AdminProtectedRoute>
            <AdminDashboard />
          </AdminProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/worker' : '/login'} replace />} />
    </Routes>
  );
}

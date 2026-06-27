// Top-level routing.
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import WorkerPortal from './pages/WorkerPortal.jsx';
import OwnerPortal from './pages/OwnerPortal.jsx';

/** Redirects to /login if the user is not authenticated. */
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
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
      <Route path="*" element={<Navigate to={isAuthenticated ? '/worker' : '/login'} replace />} />
    </Routes>
  );
}

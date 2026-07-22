import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import MeetingDetailPage from './pages/MeetingDetailPage';


// Helper component to protect private routes
function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Navigation bar header
function Navbar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <nav style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', background: '#eee' }}>
      <div>
        <Link to="/dashboard" style={{ marginRight: '15px' }}>Dashboard</Link>
        <Link to="/upload">Upload Meeting</Link>
      </div>
      <div>
        <span style={{ marginRight: '15px' }}>Hi, {user.name}</span>
        <button onClick={logout}>Logout</button>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Navbar />
      <Routes>
        {/* Public Route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <UploadPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/meetings/:meetingId"
          element={
            <ProtectedRoute>
              <MeetingDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Default fallback route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}

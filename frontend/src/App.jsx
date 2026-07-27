import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LogOut, LayoutDashboard, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import MeetingDetailPage from './pages/MeetingDetailPage';
import RegisterPage from './pages/RegisterPage';

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
    const location = useLocation();

    if (!user) return null;

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
            <div className="mx-auto max-w-4xl flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-8">
                    <Link to="/dashboard" className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                            M
                        </div>
                        <span className="font-bold text-lg hidden sm:inline-block tracking-tight text-slate-900">
                            Meeting Assistant
                        </span>
                    </Link>
                    
                    <div className="flex items-center gap-1 text-sm font-medium">
                        <Link 
                            to="/dashboard" 
                            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                                location.pathname === '/dashboard' 
                                    ? 'bg-slate-100 text-slate-900' 
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                        >
                            <LayoutDashboard className="size-4" />
                            <span className="hidden sm:inline-block">Dashboard</span>
                        </Link>
                        <Link 
                            to="/upload" 
                            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                                location.pathname === '/upload' 
                                    ? 'bg-slate-100 text-slate-900' 
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                        >
                            <UploadCloud className="size-4" />
                            <span className="hidden sm:inline-block">Upload</span>
                        </Link>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-sm text-slate-500 hidden sm:block">
                        Hi, <span className="font-medium text-slate-900">{user.name}</span>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={logout} 
                        className="gap-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                    >
                        <LogOut className="size-4" />
                        <span className="hidden sm:inline-block">Logout</span>
                    </Button>
                </div>
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
                <Route path="/register" element={<RegisterPage />} />

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

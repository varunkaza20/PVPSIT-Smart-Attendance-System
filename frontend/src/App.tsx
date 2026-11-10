import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DashboardLayout } from './layouts/DashboardLayout';

// Pages
import { Login } from './pages/Login';
import { RegularAttendance } from './pages/RegularAttendance';
import { CustomAttendance } from './pages/CustomAttendance';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Dashboard } from './pages/Dashboard';
import { ViewAttendance } from './pages/ViewAttendance';

// Admin CRUD Pages
import { FacultyManagement } from './pages/admin/FacultyManagement';
import { StudentManagement } from './pages/admin/StudentManagement';
import { SubjectManagement } from './pages/admin/SubjectManagement';
import { TimetableManagement } from './pages/admin/TimetableManagement';

// Private Route Guard
const PrivateRoute: React.FC<{ children: React.ReactNode; allowedRoles?: ('ADMIN' | 'FACULTY')[] }> = ({
  children,
  allowedRoles
}) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-pvpsit-bg">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-pvpsit-blue border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm font-semibold text-slate-500">Loading PVPSIT System...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // If not authorized for this page, redirect to their default index
    return <Navigate to="/dashboard" replace />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
};

// Root Router Redirector
const RootRedirect: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Login */}
          <Route path="/login" element={<Login />} />

          {/* Root Redirect */}
          <Route path="/" element={<RootRedirect />} />

          <Route
            path="/dashboard"
            element={
              <PrivateRoute allowedRoles={['ADMIN', 'FACULTY']}>
                <Dashboard />
              </PrivateRoute>
            }
          />

          <Route
            path="/view-attendance"
            element={
              <PrivateRoute allowedRoles={['ADMIN', 'FACULTY']}>
                <ViewAttendance />
              </PrivateRoute>
            }
          />

          <Route
            path="/regular-attendance"
            element={
              <PrivateRoute allowedRoles={['ADMIN', 'FACULTY']}>
                <RegularAttendance />
              </PrivateRoute>
            }
          />
          <Route
            path="/custom-attendance"
            element={
              <PrivateRoute allowedRoles={['ADMIN', 'FACULTY']}>
                <CustomAttendance />
              </PrivateRoute>
            }
          />

          {/* Shared Pages */}
          <Route
            path="/reports"
            element={
              <PrivateRoute allowedRoles={['ADMIN', 'FACULTY']}>
                <Reports />
              </PrivateRoute>
            }
          />

          {/* Admin Restricted Pages */}
          <Route
            path="/settings"
            element={
              <PrivateRoute allowedRoles={['ADMIN']}>
                <Settings />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/faculty"
            element={
              <PrivateRoute allowedRoles={['ADMIN']}>
                <FacultyManagement />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/students"
            element={
              <PrivateRoute allowedRoles={['ADMIN']}>
                <StudentManagement />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/subjects"
            element={
              <PrivateRoute allowedRoles={['ADMIN']}>
                <SubjectManagement />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/timetable"
            element={
              <PrivateRoute allowedRoles={['ADMIN']}>
                <TimetableManagement />
              </PrivateRoute>
            }
          />

          {/* Catch All Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </AuthProvider>
  );
};

export default App;

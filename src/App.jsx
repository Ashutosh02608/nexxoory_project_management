import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { MessagingProvider } from './context/MessagingContext';

// Layout
import DashboardLayout from './components/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';

import { ROUTE_PERMISSIONS } from './config/rbac';
import { ErrorBoundary } from './components/ErrorBoundary';

import LoginPage from './pages/LoginPage';

// Protected pages
const DashboardDispatcher = lazy(() => import('./pages/DashboardDispatcher'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const TeamsPage = lazy(() => import('./pages/TeamsPage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MessagingProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Dashboard Shell */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<DashboardLayout />}>
                <Route index element={<DashboardDispatcher />} />
                <Route path="my-work" element={<Navigate to="/tasks" replace />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="teams" element={<ProtectedRoute allowedRoles={ROUTE_PERMISSIONS['/teams']}><TeamsPage /></ProtectedRoute>} />
                <Route path="employees" element={<ProtectedRoute allowedRoles={ROUTE_PERMISSIONS['/employees']}><EmployeesPage /></ProtectedRoute>} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="messages" element={<MessagesPage />} />
                <Route path="reports" element={<ProtectedRoute allowedRoles={ROUTE_PERMISSIONS['/reports']}><ReportsPage /></ProtectedRoute>} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        </MessagingProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}

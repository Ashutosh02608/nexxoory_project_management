import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';

// Layout
import DashboardLayout from './components/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';

import { ROUTE_PERMISSIONS } from './config/rbac';

// Pages
import AdminDashboardPage from './pages/AdminDashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import TasksPage from './pages/TasksPage';
import TeamsPage from './pages/TeamsPage';
import EmployeesPage from './pages/EmployeesPage';
import MyWorkPage from './pages/MyWorkPage';
import CalendarPage from './pages/CalendarPage';
import DocumentsPage from './pages/DocumentsPage';
import MessagesPage from './pages/MessagesPage';
import ReportsPage from './pages/ReportsPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Dashboard Shell */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="my-work" element={<ProtectedRoute allowedRoles={ROUTE_PERMISSIONS['/my-work']}><MyWorkPage /></ProtectedRoute>} />
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
    </AppProvider>
  );
}

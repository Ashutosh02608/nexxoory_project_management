import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';

// Layout
import DashboardLayout from './components/DashboardLayout';

// Pages
import AdminDashboardPage from './pages/AdminDashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import TasksPage from './pages/TasksPage';
import TeamsPage from './pages/TeamsPage';
import EmployeesPage from './pages/EmployeesPage';
import MyWorkPage from './pages/MyWorkPage';
import CalendarPage from './pages/CalendarPage';
import TimelinePage from './pages/TimelinePage';
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
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Dashboard Shell */}
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="my-work" element={<MyWorkPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

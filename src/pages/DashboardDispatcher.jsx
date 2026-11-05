import React from 'react';
import { useApp } from '../context/useApp';
import AdminDashboardPage from './AdminDashboardPage';
import TeamLeaderDashboard from './TeamLeaderDashboard';
import TeamMemberDashboard from './TeamMemberDashboard';

export default function DashboardDispatcher() {
  const { currentUser } = useApp();

  const role = currentUser?.role;

  if (role === 'admin') {
    return <AdminDashboardPage />;
  }

  if (role === 'project_manager') {
    return <TeamLeaderDashboard />;
  }

  // Default to Team Member Dashboard for individual contributors
  return <TeamMemberDashboard />;
}


import React from 'react';
import { useApp } from '../context/useApp';
import AdminDashboardPage from './AdminDashboardPage';
import TeamLeaderDashboard from './TeamLeaderDashboard';
import TeamMemberDashboard from './TeamMemberDashboard';
import ContentOverview from '../components/ContentOverview';

export default function DashboardDispatcher() {
  const { currentUser } = useApp();

  const role = currentUser?.role;

  if (role === 'admin') {
    return <><ContentOverview /><AdminDashboardPage /></>;
  }

  if (role === 'project_manager') {
    return <><ContentOverview /><TeamLeaderDashboard /></>;
  }

  // Default to Team Member Dashboard for individual contributors
  return <><ContentOverview /><TeamMemberDashboard /></>;
}


import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import SidebarNavigation from './SidebarNavigation';
import TopNavigation from './TopNavigation';
import GlobalSearchModal from './GlobalSearchModal';
import QuickCreateModal from './QuickCreateModal';

export default function DashboardLayout() {
  const location = useLocation();
  const isMessagesPage = location.pathname.startsWith('/messages');

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-main)]">
      {/* Sidebar */}
      <SidebarNavigation />

      {/* Main content viewport */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
        <TopNavigation />

        <main className={`flex-1 min-w-0 min-h-0 ${isMessagesPage ? 'overflow-hidden p-4' : 'overflow-y-auto p-4 sm:p-6 lg:p-8'}`}>
          <Outlet />
        </main>
      </div>

      {/* Global Overlays */}
      <GlobalSearchModal />
      <QuickCreateModal />
    </div>
  );
}


import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import SidebarNavigation from './SidebarNavigation';
import TopNavigation from './TopNavigation';
import GlobalSearchModal from './GlobalSearchModal';
import QuickCreateModal from './QuickCreateModal';
import { useApp } from '../context/AppContext';

export default function DashboardLayout() {
  const location = useLocation();
  const isMessagesPage = location.pathname.startsWith('/messages');
  const { mobileMenuOpen, setMobileMenuOpen } = useApp();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, setMobileMenuOpen]);

  // Handle escape key to close mobile drawer & prevent background scroll
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen, setMobileMenuOpen]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-main)]">
      {/* Desktop Sidebar (Hidden on mobile <768px) */}
      <div className="hidden md:flex shrink-0 h-full">
        <SidebarNavigation />
      </div>

      {/* Mobile Navigation Drawer with Backdrop */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative z-50 flex h-full">
            <SidebarNavigation isMobileDrawer={true} onCloseMobile={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content viewport */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
        <TopNavigation />

        <main className={`flex-1 min-w-0 min-h-0 ${isMessagesPage ? 'overflow-hidden p-2 sm:p-4' : 'overflow-y-auto p-3 sm:p-6 lg:p-8'}`}>
          <Outlet />
        </main>
      </div>

      {/* Global Overlays */}
      <GlobalSearchModal />
      <QuickCreateModal />
    </div>
  );
}


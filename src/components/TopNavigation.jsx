import React, { useState } from 'react';
import {
  Menu,
  Search,
  Plus,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  CheckCircle2,
  Trash2,
  Clock,
  LogOut,
  User
} from 'lucide-react';
import { useApp } from '../context/useApp';
import { useNavigate } from 'react-router-dom';
import logoImg from '../assets/nexxoory_logo.webp';
import { getInitials } from '../utils/avatar';

export default function TopNavigation() {
  const {
    theme,
    toggleTheme,
    currentUser,
    logout,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    removeNotification,
    setSearchOpen,
    setQuickCreateOpen,
    setMobileMenuOpen
  } = useApp();

  const navigate = useNavigate();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  const unreadCount = notifications.filter(n => (!n.userId || n.userId === currentUser?.id) && !n.read && n.type !== 'mention' && n.type !== 'message').length;

  const handleLogout = () => {
    setProfileDropdownOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 md:h-18 border-b border-[var(--border)] bg-[var(--surface)] px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors gap-2">
      {/* Mobile / Responsive Brand Badge & Search */}
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 max-w-xl">
        {/* Mobile Hamburger Drawer Trigger */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open navigation menu"
          className="md:hidden p-2 rounded-xl border border-[var(--border)] text-[var(--text-sec)] hover:bg-[var(--bg-main)] transition-colors cursor-pointer shrink-0"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="hidden sm:flex md:hidden items-center gap-1 shrink-0">
          <img src={logoImg} alt="Nexxoory" className="h-7 w-auto object-contain" />
        </div>

        {/* Search trigger button */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-sec)] text-xs sm:text-sm flex-1 min-w-0 hover:border-[#1E6091] dark:hover:border-[#38BDF8] transition-all shadow-xs cursor-pointer text-left"
        >
          <Search className="w-3.5 h-3.5 text-[var(--text-sec)] shrink-0" />
          <span className="truncate text-xs">Search...</span>
          <kbd className="hidden sm:inline-block ml-auto px-1.5 py-0.5 text-[10px] bg-[var(--surface)] border border-[var(--border)] rounded font-mono">⌘K</kbd>
        </button>
      </div>

      {/* Action controls */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Quick create action (Admin & PM only) */}
        {(currentUser?.role === 'admin' || currentUser?.role === 'project_manager') && (
          <button
            onClick={() => setQuickCreateOpen(true)}
            aria-label="Create New"
            className="flex items-center justify-center p-2 sm:px-3.5 sm:py-2 bg-[#1E6091] hover:bg-[#143A52] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline ml-1.5">Create New</span>
          </button>
        )}

        {/* Theme switch button */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-xl border border-[var(--border)] text-[var(--text-sec)] hover:text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications dropdown trigger */}
        <div className="relative">
          <button
            onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
            aria-label="Notifications"
            className="p-2 rounded-xl border border-[var(--border)] text-[var(--text-sec)] hover:text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors relative cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E05252] text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {notifDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl z-50 p-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-[var(--text-main)]">Notifications</h4>
                  {unreadCount > 0 && (
                    <span className="bg-[#1E6091]/10 text-[#1E6091] dark:text-[#38BDF8] text-xs font-semibold px-2 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs text-[#1E6091] dark:text-[#38BDF8] hover:underline cursor-pointer font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border)] py-1">
                {notifications.length === 0 ? (
                  <div className="text-center py-6 text-sm text-[var(--text-sec)]">
                    No notifications
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`p-3 flex items-start justify-between gap-3 hover:bg-[var(--bg-main)] rounded-xl transition-colors ${!n.read ? 'bg-[#1E6091]/5' : ''}`}
                    >
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => {
                          markNotificationRead(n.id);
                          if (n.link) navigate(n.link);
                          setNotifDropdownOpen(false);
                        }}
                      >
                        <p className="text-xs font-semibold text-[var(--text-main)]">{n.title}</p>
                        <p className="text-xs text-[var(--text-sec)] mt-0.5">{n.message}</p>
                        <span className="text-[10px] text-[var(--text-sec)] flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" /> {n.timestamp}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {!n.read && (
                          <button
                            title="Mark as read"
                            onClick={() => markNotificationRead(n.id)}
                            className="p-1 text-[var(--text-sec)] hover:text-[#16A36A] cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          title="Delete"
                          onClick={() => removeNotification(n.id)}
                          className="p-1 text-[var(--text-sec)] hover:text-[#E05252] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-[var(--border)] text-center">
                <button
                  onClick={() => {
                    navigate('/notifications');
                    setNotifDropdownOpen(false);
                  }}
                  className="text-xs font-medium text-[#1E6091] dark:text-[#38BDF8] hover:underline cursor-pointer"
                >
                  View all in Notification Center →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile & Logout Dropdown */}
        {currentUser && (
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2.5 p-1.5 pl-2.5 border border-[var(--border)] rounded-xl hover:bg-[var(--bg-main)] transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-[#1E6091] text-white text-[11px] font-bold flex items-center justify-center shrink-0 tracking-wider">
                {getInitials(currentUser.name)}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold leading-tight text-[var(--text-main)]">{currentUser.name}</p>
                <p className="text-[10px] text-[#1E6091] dark:text-[#38BDF8] font-bold capitalize">
                  {currentUser.role?.replace('_', ' ')}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-sec)]" />
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl z-50 p-2">
                <div className="px-3 py-2 border-b border-[var(--border)] mb-1">
                  <p className="text-xs font-bold text-[var(--text-main)] truncate">{currentUser.name}</p>
                  <p className="text-[10px] text-[var(--text-sec)] truncate">{currentUser.email}</p>
                </div>

                <div className="space-y-1">
                  <button
                    onClick={() => {
                      navigate('/settings');
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs text-[var(--text-main)] hover:bg-[var(--bg-main)] cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-[var(--text-sec)]" />
                    <span>Account Settings</span>
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs text-rose-500 hover:bg-rose-500/10 cursor-pointer font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

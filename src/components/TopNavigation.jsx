import React, { useState } from 'react';
import {
  Search,
  Plus,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  UserCheck,
  CheckCircle2,
  Trash2,
  Clock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import logoImg from '../assets/nexxoory_logo.webp';

export default function TopNavigation() {
  const {
    theme,
    toggleTheme,
    currentUser,
    users,
    switchUser,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    removeNotification,
    setSearchOpen,
    setQuickCreateOpen
  } = useApp();

  const navigate = useNavigate();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="h-18 border-b border-[var(--border)] bg-[var(--surface)] px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* Mobile / Responsive Brand Badge & Search */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="md:hidden flex items-center gap-2">
          <img src={logoImg} alt="Nexxoory" className="h-9 w-auto object-contain" />
        </div>

        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-3 px-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-sec)] text-sm w-full max-w-md hover:border-[#1E6091] dark:hover:border-[#38BDF8] transition-all shadow-xs cursor-pointer text-left"
        >
          <Search className="w-4 h-4 text-[var(--text-sec)]" />
          <span className="flex-1 text-xs">Search projects, tasks, employees...</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-[var(--surface)] border border-[var(--border)] rounded font-mono">⌘K</kbd>
        </button>
      </div>

      {/* Action controls */}
      <div className="flex items-center gap-3">
        {/* Quick create action */}
        <button
          onClick={() => setQuickCreateOpen(true)}
          className="flex items-center gap-2 bg-[#1E6091] hover:bg-[#143A52] text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Create New</span>
        </button>

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

        {/* Demo Switch User Role Dropdown */}
        <div className="relative">
          <button
            onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
            className="flex items-center gap-2.5 p-1.5 pl-2.5 border border-[var(--border)] rounded-xl hover:bg-[var(--bg-main)] transition-colors cursor-pointer"
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-7 h-7 rounded-full object-cover border border-[#1E6091]"
            />
            <div className="text-left hidden md:block">
              <p className="text-xs font-bold leading-tight text-[var(--text-main)]">{currentUser.name}</p>
              <p className="text-[10px] text-[#1E6091] dark:text-[#38BDF8] font-bold capitalize">{currentUser.role.replace('_', ' ')}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-sec)]" />
          </button>

          {roleDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl z-50 p-2">
              <div className="px-3 py-2 border-b border-[var(--border)] mb-1">
                <p className="text-[10px] uppercase font-bold text-[var(--text-sec)] tracking-wider">Demo Role Switcher</p>
                <p className="text-xs text-[var(--text-sec)]">Simulate role-based views:</p>
              </div>
              <div className="space-y-1">
                {users.slice(0, 3).map(u => (
                  <button
                    key={u.id}
                    onClick={() => {
                      switchUser(u.id);
                      setRoleDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${u.id === currentUser.id ? 'bg-[#1E6091]/10 text-[#1E6091] dark:text-[#38BDF8] font-bold' : 'hover:bg-[var(--bg-main)] text-[var(--text-main)]'}`}
                  >
                    <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full object-cover" />
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate font-semibold">{u.name}</p>
                      <p className="text-[10px] text-[var(--text-sec)] capitalize">{u.role.replace('_', ' ')}</p>
                    </div>
                    {u.id === currentUser.id && <UserCheck className="w-4 h-4 text-[#1E6091]" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

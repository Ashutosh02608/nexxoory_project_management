import React, { useState, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useMessaging } from '../context/MessagingContext';
import { getRoleNavigation } from '../config/rbac';
import logoImg from '../assets/nexxoory_logo.webp';

export default function SidebarNavigation() {
  const [collapsed, setCollapsed] = useState(false);
  const { currentUser } = useApp();
  const messaging = useMessaging();

  const navItems = getRoleNavigation(currentUser?.role);

  const msgUnread = useMemo(() => {
    if (!messaging || !currentUser) return 0;
    try {
      const convs = messaging.getConversationsForUser(currentUser.id, currentUser.role);
      return convs.reduce((sum, c) => sum + messaging.getUnreadCount(c.id, currentUser.id), 0);
    } catch { return 0; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messaging?.messages, currentUser?.id]);

  return (
    <aside
      className={`border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-300 flex flex-col justify-between select-none relative z-20 ${
        collapsed ? 'w-24' : 'w-72'
      }`}
    >
      <div>
        {/* Spotlight Shadow Header */}
        <div className="relative border-b border-[var(--border)] bg-gradient-to-b from-[var(--bg-main)] to-[var(--surface)] p-4 flex flex-col items-center overflow-hidden">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1E6091]/15 via-transparent to-transparent pointer-events-none" />

          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Toggle sidebar width"
            className="absolute top-3 right-3 p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-sec)] hover:bg-[var(--surface)] transition-colors cursor-pointer shadow-xs z-10"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {!collapsed ? (
            <div className="w-full flex items-center justify-center py-2 relative z-10">
              {/* Outer box with multi-layer spotlight glow & shadow */}
              <div className="relative group">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#1E6091] via-[#52B69A] to-[#34A0A4] opacity-35 blur-md group-hover:opacity-60 transition duration-500" />
                <div className="relative p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[0_10px_25px_-5px_rgba(30,96,145,0.35),0_8px_10px_-6px_rgba(30,96,145,0.2)]">
                  <img
                    src={logoImg}
                    alt="Logo"
                    className="h-24 w-auto max-w-[220px] object-contain drop-shadow"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-2 relative z-10">
              <div className="relative group">
                <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-[#1E6091] to-[#52B69A] opacity-30 blur-sm group-hover:opacity-50 transition" />
                <div className="relative p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-[0_4px_14px_rgba(30,96,145,0.3)]">
                  <img
                    src={logoImg}
                    alt="Logo"
                    className="h-12 w-auto object-contain"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation items */}
        <nav className="p-3 space-y-1.5 overflow-y-auto max-h-[calc(100vh-10rem)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isMessages = item.path === '/messages';
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-[#1E6091] text-white shadow-md shadow-[#1E6091]/25 font-bold'
                      : 'text-[var(--text-sec)] hover:text-[var(--text-main)] hover:bg-[var(--bg-main)]'
                  } ${collapsed ? 'justify-center px-0' : ''}`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {/* Unread badge */}
                {isMessages && msgUnread > 0 && !collapsed && (
                  <span className="ml-auto bg-[#635BFF] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center leading-none">
                    {msgUnread > 99 ? '99+' : msgUnread}
                  </span>
                )}
                {isMessages && msgUnread > 0 && collapsed && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#635BFF] rounded-full" />
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

import React, { useState, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  Trash2,
  Clock,
  Check,
  Filter,
  ArrowRight,
  FolderKanban,
  ListTodo,
  Megaphone,
  MessageSquare,
  CalendarDays,
  Inbox
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function NotificationsPage() {
  const { notifications = [], markNotificationRead, markAllNotificationsRead, removeNotification, currentUser } = useApp();
  const navigate = useNavigate();

  // Tab filter: 'ALL', 'UNREAD', 'READ', 'TASK', 'PROJECT', 'ANNOUNCEMENT'
  const [activeFilter, setActiveFilter] = useState('ALL');

  // Filter notifications belonging to the logged-in user and exclude any chat/messaging mentions
  const userNotifications = useMemo(() => {
    return notifications.filter(n => (!n.userId || n.userId === currentUser?.id) && n.type !== 'mention' && n.type !== 'message');
  }, [notifications, currentUser?.id]);

  const filtered = useMemo(() => {
    return userNotifications.filter(n => {
      if (activeFilter === 'UNREAD') return !n.read;
      if (activeFilter === 'READ') return n.read;
      if (activeFilter === 'TASK') return n.type === 'task';
      if (activeFilter === 'PROJECT') return n.type === 'project';
      if (activeFilter === 'ANNOUNCEMENT') return n.type === 'announcement';
      return true;
    });
  }, [userNotifications, activeFilter]);

  const unreadCount = useMemo(() => {
    return userNotifications.filter(n => !n.read).length;
  }, [userNotifications]);

  const handleNotificationClick = async (n, e) => {
    if (e) e.stopPropagation();
    if (!n.read) {
      await markNotificationRead(n.id);
    }
    // Deep-link to actual target resource
    if (n.link && n.link !== '/notifications') {
      navigate(n.link);
    } else if (n.type === 'project') {
      navigate('/projects');
    } else if (n.type === 'task') {
      navigate('/tasks');
    } else if (n.type === 'event' || n.type === 'calendar_event') {
      navigate('/calendar');
    } else if (n.type === 'announcement' || n.type === 'message' || n.type === 'mention') {
      navigate('/messages');
    } else {
      navigate('/');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'project':
        return <FolderKanban className="w-4 h-4 text-[#1E6091]" />;
      case 'task':
        return <ListTodo className="w-4 h-4 text-emerald-500" />;
      case 'announcement':
        return <Megaphone className="w-4 h-4 text-amber-500" />;
      case 'message':
      case 'mention':
        return <MessageSquare className="w-4 h-4 text-[#635BFF]" />;
      case 'event':
      case 'calendar_event':
        return <CalendarDays className="w-4 h-4 text-purple-500" />;
      default:
        return <Bell className="w-4 h-4 text-[#1E6091]" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">Notification Center</h1>
            {unreadCount > 0 && (
              <span className="bg-[#EF4444] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount} new
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-sec)] mt-0.5">
            Real-time feed of task assignments, project updates, announcements, and team mentions.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllNotificationsRead}
            className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-main)] text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Check className="w-4 h-4 text-[#16A36A]" />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'ALL', label: 'All' },
          { id: 'UNREAD', label: `Unread (${unreadCount})` },
          { id: 'READ', label: 'Read' },
          { id: 'TASK', label: 'Tasks' },
          { id: 'PROJECT', label: 'Projects' },
          { id: 'ANNOUNCEMENT', label: 'Announcements' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeFilter === tab.id
                ? 'bg-[#1E6091] text-white shadow-xs'
                : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-sec)] hover:text-[var(--text-main)] hover:bg-[var(--bg-main)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List Feed */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)] shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-main)] border border-[var(--border)] flex items-center justify-center text-[var(--text-sec)]">
              <Inbox className="w-6 h-6 opacity-40" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-main)]">No notifications found</p>
              <p className="text-xs text-[var(--text-sec)] mt-0.5">
                {activeFilter === 'UNREAD' ? 'You have caught up with all updates.' : 'There are no items matching this filter.'}
              </p>
            </div>
          </div>
        ) : (
          filtered.map(n => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`p-4 flex items-start justify-between gap-4 transition-colors cursor-pointer group ${
                !n.read ? 'bg-[#1E6091]/5 hover:bg-[#1E6091]/10' : 'hover:bg-[var(--bg-main)]'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <div className="mt-0.5 p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-2xs shrink-0">
                  {getNotificationIcon(n.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-xs truncate ${!n.read ? 'font-bold text-[var(--text-main)]' : 'font-semibold text-[var(--text-sec)]'}`}>
                      {n.title || (n.type ? `${n.type.toUpperCase()} Notification` : 'System Update')}
                    </h4>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-[#EF4444] shrink-0" title="Unread" />
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-sec)] mt-1 leading-relaxed break-words">
                    {n.message}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--text-sec)]">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3" /> {n.timestamp || 'Just now'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleNotificationClick(n, e)}
                      className="text-[#1E6091] group-hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                    >
                      <span>View Details</span> <ArrowRight className="w-2.5 h-2.5 inline" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0 self-center" onClick={(e) => e.stopPropagation()}>
                {!n.read && (
                  <button
                    onClick={() => markNotificationRead(n.id)}
                    className="p-1.5 rounded-lg text-[var(--text-sec)] hover:text-[#10B981] hover:bg-emerald-500/10 cursor-pointer transition-colors"
                    title="Mark as Read"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => removeNotification(n.id)}
                  className="p-1.5 rounded-lg text-[var(--text-sec)] hover:text-[#EF4444] hover:bg-rose-500/10 cursor-pointer transition-colors"
                  title="Delete Notification"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Bell, CheckCircle2, Trash2, Clock, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function NotificationsPage() {
  const { notifications, markNotificationRead, markAllNotificationsRead, removeNotification } = useApp();
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'UNREAD', 'TASK', 'PROJECT'

  const filtered = notifications.filter(n => {
    if (filter === 'UNREAD') return !n.read;
    if (filter === 'TASK') return n.type === 'task';
    if (filter === 'PROJECT') return n.type === 'project';
    return true;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">Notification Center</h1>
          <p className="text-xs sm:text-sm text-[var(--text-sec)] mt-0.5">
            Audit feed of system assignments, status changes, mentions, and milestones.
          </p>
        </div>

        <button
          onClick={markAllNotificationsRead}
          className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-main)] text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Check className="w-4 h-4 text-[#16A36A]" />
          <span>Mark All Read</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['ALL', 'UNREAD', 'TASK', 'PROJECT'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              filter === f ? 'bg-[#635BFF] text-white shadow-xs' : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-sec)] hover:text-[var(--text-main)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Notifications Feed */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)] shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-sec)]">
            No notifications match your current filter.
          </div>
        ) : (
          filtered.map(n => (
            <div
              key={n.id}
              className={`p-4 flex items-start justify-between gap-4 transition-colors ${!n.read ? 'bg-[#635BFF]/5' : ''}`}
            >
              <div className="flex items-start gap-3">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.read ? 'bg-[#635BFF]' : 'bg-transparent'}`} />
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-main)]">{n.title}</h4>
                  <p className="text-xs text-[var(--text-sec)] mt-0.5">{n.message}</p>
                  <span className="text-[10px] text-[var(--text-sec)] flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" /> {n.timestamp}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {!n.read && (
                  <button
                    onClick={() => markNotificationRead(n.id)}
                    className="p-1.5 rounded-lg text-[var(--text-sec)] hover:text-[#16A36A] hover:bg-[var(--bg-main)] cursor-pointer"
                    title="Mark Read"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => removeNotification(n.id)}
                  className="p-1.5 rounded-lg text-[var(--text-sec)] hover:text-[#E05252] hover:bg-rose-500/10 cursor-pointer"
                  title="Delete"
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


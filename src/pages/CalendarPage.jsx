import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, ChevronLeft, ChevronRight, X, MapPin } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function CalendarPage() {
  const { events, updateEvent, removeEvent, projects } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState('November 2026');

  // New Event Form State
  const [formData, setFormData] = useState({
    title: '',
    type: 'meeting',
    startDate: '2026-11-05T10:00:00',
    location: 'Meeting Room Alpha'
  });

  const handleCreate = (e) => {
    e.preventDefault();
    updateEvent({
      ...formData,
      endDate: formData.startDate,
      attendees: ['usr-admin', 'usr-pm']
    });
    setModalOpen(false);
  };

  // 30 days grid generator for November 2026
  const daysInMonth = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">Calendar & Milestones</h1>
          <p className="text-xs sm:text-sm text-[var(--text-sec)] mt-0.5">
            Synchronized sprint planning, milestone deadlines, architecture reviews, and team standups.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-[#635BFF] hover:bg-[#4942D9] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Event</span>
        </button>
      </div>

      {/* Calendar Navigation header */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-[#635BFF]" />
          <h2 className="font-bold text-base text-[var(--text-main)]">{currentMonth}</h2>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Month Days Grid */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs">
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-[var(--text-sec)]">
          <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {daysInMonth.map(day => {
            const dateStr = `2026-11-${day < 10 ? '0' + day : day}`;
            const dayEvents = events.filter(e => e.startDate.startsWith(dateStr));

            return (
              <div
                key={day}
                className="min-h-[90px] p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] hover:border-[#635BFF] transition-all flex flex-col justify-between"
              >
                <span className="text-xs font-bold text-[var(--text-main)]">{day}</span>

                <div className="space-y-1 my-1 overflow-y-auto max-h-[60px]">
                  {dayEvents.map(evt => (
                    <div
                      key={evt.id}
                      className={`p-1 rounded text-[9px] font-semibold truncate ${
                        evt.type === 'milestone' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                        evt.type === 'deadline' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' :
                        'bg-indigo-500/10 text-[#635BFF] border border-indigo-500/20'
                      }`}
                      title={`${evt.title} (${evt.location || ''})`}
                    >
                      {evt.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Events List Agenda */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
        <h3 className="font-bold text-sm text-[var(--text-main)] mb-3">Upcoming Agenda</h3>
        <div className="space-y-2.5">
          {events.map(e => (
            <div key={e.id} className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#635BFF]">{e.type}</span>
                <h4 className="text-xs font-bold text-[var(--text-main)] mt-0.5">{e.title}</h4>
                <p className="text-[11px] text-[var(--text-sec)] flex items-center gap-2 mt-0.5">
                  <Clock className="w-3 h-3" /> {e.startDate.replace('T', ' at ')}
                  {e.location && <span>• <MapPin className="w-3 h-3 inline" /> {e.location}</span>}
                </p>
              </div>

              <button
                onClick={() => removeEvent(e.id)}
                className="text-xs text-[var(--text-sec)] hover:text-[#E05252] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Schedule Event Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <h3 className="font-bold text-base text-[var(--text-main)]">Schedule Event</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Architecture Sync"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                >
                  <option value="meeting">Meeting</option>
                  <option value="milestone">Milestone</option>
                  <option value="deadline">Deadline</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Start Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Location / Room</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs bg-[#635BFF] hover:bg-[#4942D9] text-white font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  Confirm Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


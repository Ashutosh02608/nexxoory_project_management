import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
  Loader2,
  Trash2,
  Edit2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEPARTMENTS } from '../constants/departments';

const EVENT_TYPES = [
  { value: 'meeting', label: 'Meeting', color: '#635BFF', bg: 'bg-[#635BFF]/10 text-[#635BFF] border-[#635BFF]/20' },
  { value: 'deadline', label: 'Project Deadline', color: '#EF4444', bg: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
  { value: 'milestone', label: 'Milestone', color: '#F59E0B', bg: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  { value: 'team_event', label: 'Team Event', color: '#10B981', bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  { value: 'company_event', label: 'Company Event', color: '#3B82F6', bg: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  { value: 'reminder', label: 'Reminder', color: '#8B5CF6', bg: 'bg-purple-500/10 text-purple-600 border-purple-500/20' }
];

export default function CalendarPage() {
  const { events, updateEvent, removeEvent, projects, teams, users, currentUser } = useApp();

  // Navigation State: default to today
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day'
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Modal / Detail State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [detailEvent, setDetailEvent] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'meeting',
    startDate: '2026-11-05',
    startTime: '10:00',
    endDate: '2026-11-05',
    endTime: '11:00',
    isAllDay: false,
    projectId: '',
    teamId: '',
    location: 'Meeting Room Alpha',
    attendees: []
  });

  // Filter events according to user RBAC visibility
  const userTeamIds = teams
    .filter(tm => tm.memberIds?.includes(currentUser?.id) || tm.leaderId === currentUser?.id)
    .map(tm => tm.id);
  const userProjectIds = projects
    .filter(p => p.managerId === currentUser?.id || (p.teamId && userTeamIds.includes(p.teamId)))
    .map(p => p.id);

  const canCreateEvent = currentUser?.role === 'admin' || currentUser?.role === 'project_manager';

  const canEditEvent = (evt) => {
    if (!currentUser || !evt) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'project_manager') {
      return (
        evt.creatorId === currentUser.id ||
        (evt.teamId && teams.some(t => t.id === evt.teamId && t.leaderId === currentUser.id)) ||
        (evt.projectId && projects.some(p => p.id === evt.projectId && p.managerId === currentUser.id))
      );
    }
    // Team member: strictly read-only
    return false;
  };

  const visibleEvents = events.filter(e => {
    // Audience filter
    if (currentUser?.role !== 'admin') {
      const isCompanyWide = e.type === 'company_event' || (!e.projectId && !e.teamId && !e.department && (!e.attendees || e.attendees.length === 0));
      if (isCompanyWide) {
        // visible to all active employees
        return true;
      }
      const isCreator = e.creatorId === currentUser?.id;
      const isAttendee = Array.isArray(e.attendees) && e.attendees.includes(currentUser?.id);
      const isTeamEvent = e.teamId && userTeamIds.includes(e.teamId);
      const isProjectEvent = e.projectId && userProjectIds.includes(e.projectId);
      const isDepartmentEvent = e.department && currentUser?.department && e.department.toLowerCase() === currentUser.department.toLowerCase();

      if (!isCreator && !isAttendee && !isTeamEvent && !isProjectEvent && !isDepartmentEvent) {
        return false;
      }
    }

    // Type filter
    if (typeFilter !== 'ALL' && e.type !== typeFilter) return false;
    return true;
  });

  // Date navigation helpers
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') next.setMonth(next.getMonth() - 1);
    else if (viewMode === 'week') next.setDate(next.getDate() - 7);
    else next.setDate(next.getDate() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') next.setMonth(next.getMonth() + 1);
    else if (viewMode === 'week') next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Form open helpers
  const openCreateModal = () => {
    setEditingEvent(null);
    setErrorMsg('');
    const dStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    setFormData({
      title: '',
      description: '',
      type: 'meeting',
      startDate: dStr,
      startTime: '10:00',
      endDate: dStr,
      endTime: '11:00',
      isAllDay: false,
      projectId: '',
      teamId: '',
      department: '',
      location: 'Meeting Room Alpha',
      attendees: []
    });
    setModalOpen(true);
  };

  const openEditModal = (evt) => {
    setEditingEvent(evt);
    setDetailEvent(null);
    setErrorMsg('');
    const sDate = evt.startDate ? new Date(evt.startDate) : new Date();
    const eDate = evt.endDate ? new Date(evt.endDate) : sDate;

    setFormData({
      title: evt.title || '',
      description: evt.description || '',
      type: evt.type || 'meeting',
      startDate: evt.date || sDate.toISOString().split('T')[0],
      startTime: evt.time || sDate.toTimeString().substring(0, 5),
      endDate: eDate.toISOString().split('T')[0],
      endTime: eDate.toTimeString().substring(0, 5),
      isAllDay: !!evt.isAllDay,
      projectId: evt.projectId || '',
      teamId: evt.teamId || '',
      department: evt.department || '',
      location: evt.location || 'Virtual',
      attendees: evt.attendees || []
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Date/time validation: End cannot be earlier than start
    const startIso = formData.isAllDay
      ? `${formData.startDate}T00:00:00`
      : `${formData.startDate}T${formData.startTime || '00:00'}:00`;
    const endIso = formData.isAllDay
      ? `${formData.endDate}T23:59:59`
      : `${formData.endDate}T${formData.endTime || '23:59'}:00`;

    if (new Date(endIso).getTime() < new Date(startIso).getTime()) {
      setErrorMsg('End date/time cannot be earlier than start date/time');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateEvent({
        id: editingEvent ? editingEvent.id : undefined,
        title: formData.title,
        description: formData.description,
        type: formData.type,
        startDate: startIso,
        endDate: endIso,
        isAllDay: formData.isAllDay,
        projectId: formData.projectId || null,
        teamId: formData.teamId || null,
        department: formData.department || null,
        location: formData.location || 'Virtual',
        attendees: formData.attendees || []
      });
      setModalOpen(false);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      await removeEvent(id);
      setDetailEvent(null);
    }
  };

  // Month grid calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Grid days (with leading empty padding)
  const monthCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    monthCells.push(null);
  }
  for (let d = 1; d <= totalDaysInMonth; d++) {
    monthCells.push(d);
  }

  // Week view calculations
  const currDayOfWeek = currentDate.getDay();
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currDayOfWeek);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    return day;
  });

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

        {canCreateEvent && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-[#635BFF] hover:bg-[#4942D9] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Event</span>
          </button>
        )}
      </div>

      {/* Calendar Controls & Navigation Bar */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-[#635BFF]" />
          <h2 className="font-bold text-base text-[var(--text-main)]">
            {viewMode === 'month' && monthName}
            {viewMode === 'week' && `Week of ${weekDays[0].toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            {viewMode === 'day' && currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h2>
          <button
            onClick={handleToday}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--surface)] cursor-pointer"
          >
            Today
          </button>
        </div>

        {/* View Switcher & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Event Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
          >
            <option value="ALL">All Event Types</option>
            {EVENT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {/* View Mode Buttons */}
          <div className="flex bg-[var(--bg-main)] p-0.5 rounded-xl border border-[var(--border)]">
            {['month', 'week', 'day'].map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize cursor-pointer transition-colors ${
                  viewMode === m ? 'bg-[#635BFF] text-white shadow-xs' : 'text-[var(--text-sec)] hover:text-[var(--text-main)]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Prev / Next */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs">
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-[var(--text-sec)]">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {monthCells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="min-h-[100px] p-2 rounded-xl bg-[var(--bg-main)]/30 border border-transparent opacity-30" />;
              }

              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = visibleEvents.filter(e => {
                const sDate = e.startDate?.split('T')[0] || e.date;
                const eDate = e.endDate?.split('T')[0] || sDate;
                return dateStr >= sDate && dateStr <= eDate;
              });

              const isToday = new Date().toISOString().split('T')[0] === dateStr;

              return (
                <div
                  key={`day-${day}`}
                  className={`min-h-[100px] p-2 rounded-xl border transition-all flex flex-col justify-between ${
                    isToday ? 'border-[#635BFF] bg-[#635BFF]/5' : 'border-[var(--border)] bg-[var(--bg-main)] hover:border-[#635BFF]/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isToday ? 'text-[#635BFF]' : 'text-[var(--text-main)]'}`}>
                      {day}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[var(--border)] text-[var(--text-sec)] font-bold">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 my-1 overflow-y-auto max-h-[70px]">
                    {dayEvents.map(evt => {
                      const meta = EVENT_TYPES.find(t => t.value === evt.type) || EVENT_TYPES[0];
                      return (
                        <div
                          key={evt.id}
                          onClick={() => setDetailEvent(evt)}
                          className={`p-1 rounded text-[9px] font-semibold truncate cursor-pointer transition-transform hover:scale-[1.02] border ${meta.bg}`}
                          title={`${evt.title} (${evt.location || ''})`}
                        >
                          {evt.isAllDay && <span className="font-bold mr-1">[All-Day]</span>}
                          {evt.title}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs">
          <div className="grid grid-cols-7 gap-3">
            {weekDays.map((d, i) => {
              const dateStr = d.toISOString().split('T')[0];
              const dayEvents = visibleEvents.filter(e => {
                const sDate = e.startDate?.split('T')[0] || e.date;
                const eDate = e.endDate?.split('T')[0] || sDate;
                return dateStr >= sDate && dateStr <= eDate;
              });

              return (
                <div key={i} className="min-h-[300px] p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] flex flex-col">
                  <div className="border-b border-[var(--border)] pb-2 mb-2 text-center">
                    <p className="text-[10px] font-bold text-[var(--text-sec)] uppercase">{d.toLocaleDateString('default', { weekday: 'short' })}</p>
                    <p className="text-sm font-bold text-[var(--text-main)]">{d.getDate()}</p>
                  </div>
                  <div className="space-y-2 flex-1 overflow-y-auto">
                    {dayEvents.map(evt => {
                      const meta = EVENT_TYPES.find(t => t.value === evt.type) || EVENT_TYPES[0];
                      return (
                        <div
                          key={evt.id}
                          onClick={() => setDetailEvent(evt)}
                          className={`p-2 rounded-lg border text-xs cursor-pointer hover:shadow-xs ${meta.bg}`}
                        >
                          <p className="font-bold truncate">{evt.title}</p>
                          <p className="text-[10px] opacity-80 mt-0.5 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {evt.isAllDay ? 'All Day' : evt.time || '10:00'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DAY VIEW */}
      {viewMode === 'day' && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs">
          <div className="border-b border-[var(--border)] pb-3 mb-4">
            <h3 className="text-base font-bold text-[var(--text-main)]">
              {currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h3>
          </div>
          <div className="space-y-3">
            {visibleEvents
              .filter(e => {
                const curStr = currentDate.toISOString().split('T')[0];
                const sDate = e.startDate?.split('T')[0] || e.date;
                const eDate = e.endDate?.split('T')[0] || sDate;
                return curStr >= sDate && curStr <= eDate;
              })
              .map(evt => {
                const meta = EVENT_TYPES.find(t => t.value === evt.type) || EVENT_TYPES[0];
                return (
                  <div
                    key={evt.id}
                    onClick={() => setDetailEvent(evt)}
                    className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] hover:border-[#635BFF] flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${meta.bg}`}>
                        {meta.label}
                      </span>
                      <h4 className="text-sm font-bold text-[var(--text-main)] mt-1.5">{evt.title}</h4>
                      {evt.description && <p className="text-xs text-[var(--text-sec)] mt-1">{evt.description}</p>}
                      <div className="flex items-center gap-4 text-xs text-[var(--text-sec)] mt-2">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {evt.isAllDay ? 'All Day' : evt.time}
                        </span>
                        {evt.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {evt.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Upcoming Agenda Feed */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
        <h3 className="font-bold text-sm text-[var(--text-main)] mb-3">All Scheduled Events</h3>
        <div className="space-y-2.5">
          {visibleEvents.length === 0 ? (
            <p className="text-xs text-[var(--text-sec)]">No events match the selected filter.</p>
          ) : (
            visibleEvents.map(e => {
              const meta = EVENT_TYPES.find(t => t.value === e.type) || EVENT_TYPES[0];
              return (
                <div key={e.id} className="p-3.5 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] flex items-center justify-between">
                  <div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${meta.bg}`}>
                      {meta.label}
                    </span>
                    <h4 className="text-xs font-bold text-[var(--text-main)] mt-1.5">{e.title}</h4>
                    <p className="text-[11px] text-[var(--text-sec)] flex items-center gap-2 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {e.isAllDay ? `${e.date} (All-Day)` : e.startDate ? e.startDate.replace('T', ' at ') : e.date}
                      {e.location && <span>• <MapPin className="w-3 h-3 inline" /> {e.location}</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDetailEvent(e)}
                      className="text-xs text-[#635BFF] font-semibold hover:underline cursor-pointer px-2 py-1"
                    >
                      View
                    </button>
                    {canEditEvent(e) && (
                      <button
                        onClick={() => openEditModal(e)}
                        className="text-xs text-[var(--text-sec)] hover:text-[#635BFF] cursor-pointer p-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canEditEvent(e) && (
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="text-xs text-[var(--text-sec)] hover:text-red-500 cursor-pointer p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* EVENT DETAILS MODAL */}
      {detailEvent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <div>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                  EVENT_TYPES.find(t => t.value === detailEvent.type)?.bg || ''
                }`}>
                  {EVENT_TYPES.find(t => t.value === detailEvent.type)?.label}
                </span>
                <h3 className="font-bold text-lg text-[var(--text-main)] mt-1">{detailEvent.title}</h3>
              </div>
              <button onClick={() => setDetailEvent(null)} className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {detailEvent.description && (
                <div>
                  <h4 className="font-bold text-[var(--text-sec)] mb-1 uppercase text-[10px]">Description</h4>
                  <p className="text-[var(--text-main)] bg-[var(--bg-main)] p-3 rounded-xl border border-[var(--border)]">
                    {detailEvent.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                  <span className="text-[10px] font-bold text-[var(--text-sec)] uppercase block mb-1">Time & Duration</span>
                  <p className="font-semibold text-[var(--text-main)]">
                    {detailEvent.isAllDay ? 'All Day Event' : `${detailEvent.date} at ${detailEvent.time}`}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                  <span className="text-[10px] font-bold text-[var(--text-sec)] uppercase block mb-1">Location / Link</span>
                  <p className="font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#635BFF]" />
                    {detailEvent.location || 'Virtual Meeting'}
                  </p>
                </div>
              </div>

              {detailEvent.projectId && (
                <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                  <span className="text-[10px] font-bold text-[var(--text-sec)] uppercase block mb-1">Associated Project</span>
                  <p className="font-semibold text-[var(--text-main)]">
                    {projects.find(p => p.id === detailEvent.projectId)?.name || 'Project'}
                  </p>
                </div>
              )}

              {detailEvent.teamId && (
                <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                  <span className="text-[10px] font-bold text-[var(--text-sec)] uppercase block mb-1">Assigned Team</span>
                  <p className="font-semibold text-[var(--text-main)]">
                    {teams.find(tm => tm.id === detailEvent.teamId)?.name || 'Team'}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-[var(--border)] flex justify-between items-center">
                {canEditEvent(detailEvent) ? (
                  <button
                    onClick={() => handleDelete(detailEvent.id)}
                    className="px-3 py-1.5 text-xs text-red-500 font-semibold hover:bg-red-500/10 rounded-lg cursor-pointer"
                  >
                    Delete Event
                  </button>
                ) : <div />}
                <div className="flex gap-2">
                  {canEditEvent(detailEvent) && (
                    <button
                      onClick={() => openEditModal(detailEvent)}
                      className="px-4 py-2 text-xs bg-[#635BFF] text-white font-semibold rounded-lg hover:bg-[#4942D9] cursor-pointer"
                    >
                      Edit Event
                    </button>
                  )}
                  <button
                    onClick={() => setDetailEvent(null)}
                    className="px-4 py-2 text-xs border border-[var(--border)] text-[var(--text-main)] rounded-lg hover:bg-[var(--bg-main)] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULE / EDIT EVENT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <h3 className="font-bold text-base text-[var(--text-main)]">
                {editingEvent ? 'Edit Event' : 'Schedule New Event'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
                  {errorMsg}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Architecture Review & Sprint Sync"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Event agenda and details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                />
              </div>

              {/* Event Type & All Day */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Event Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  >
                    {EVENT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-main)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isAllDay}
                      onChange={(e) => setFormData({ ...formData, isAllDay: e.target.checked })}
                      className="rounded text-[#635BFF] cursor-pointer"
                    />
                    <span>All-Day Event</span>
                  </label>
                </div>
              </div>

              {/* Dates & Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  />
                </div>
                {!formData.isAllDay && (
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Start Time *</label>
                    <input
                      type="time"
                      required
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  />
                </div>
                {!formData.isAllDay && (
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">End Time *</label>
                    <input
                      type="time"
                      required
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Project, Team & Department Associations */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Project (Optional)</label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    className="w-full px-2 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  >
                    <option value="">None</option>
                    {(currentUser?.role === 'admin' ? projects : projects.filter(p => userProjectIds.includes(p.id))).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Team (Optional)</label>
                  <select
                    value={formData.teamId}
                    onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                    className="w-full px-2 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  >
                    <option value="">None</option>
                    {(currentUser?.role === 'admin' ? teams : teams.filter(t => userTeamIds.includes(t.id))).map(tm => (
                      <option key={tm.id} value={tm.id}>{tm.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-2 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  >
                    <option value="">All / None</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Specific Attendees Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[var(--text-main)]">Specific Attendees (Optional)</label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        const activeUserIds = users.filter(u => u.status !== 'Inactive').map(u => u.id);
                        setFormData({ ...formData, attendees: activeUserIds });
                      }}
                      className="text-[#635BFF] hover:underline font-semibold cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-[var(--text-sec)]">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, attendees: [] });
                      }}
                      className="text-[var(--text-sec)] hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="max-h-28 overflow-y-auto border border-[var(--border)] rounded-lg p-2 bg-[var(--bg-main)] space-y-1">
                  {users.filter(u => u.status !== 'Inactive').map(u => {
                    const isChecked = Array.isArray(formData.attendees) && formData.attendees.includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center gap-2 text-xs text-[var(--text-main)] hover:bg-[var(--surface)] p-1 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, attendees: [...(formData.attendees || []), u.id] });
                            } else {
                              setFormData({ ...formData, attendees: (formData.attendees || []).filter(id => id !== u.id) });
                            }
                          }}
                          className="rounded text-[#635BFF] cursor-pointer"
                        />
                        <span className="font-medium">{u.name}</span>
                        <span className="text-[10px] text-[var(--text-sec)]">({u.role?.replace('_', ' ')} · {u.department})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Location / Meeting Link</label>
                <input
                  type="text"
                  placeholder="e.g. Google Meet, Room Alpha, or Zoom Link"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[var(--border)] flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 text-xs bg-[#635BFF] hover:bg-[#4942D9] text-white font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Event...</span>
                    </>
                  ) : (
                    <span>{editingEvent ? 'Save Changes' : 'Confirm Event'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

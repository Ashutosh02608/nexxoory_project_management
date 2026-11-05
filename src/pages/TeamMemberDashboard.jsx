import React, { useMemo } from 'react';
import {
  CheckSquare,
  FolderKanban,
  Clock,
  ArrowRight,
  Calendar,
  PlayCircle
} from 'lucide-react';
import { useApp } from '../context/useApp';
import { ScopeRules } from '../config/rbac';
import { useNavigate } from 'react-router-dom';
import { asDate } from '../utils/dateHelpers';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from 'recharts';

const TASK_STATUS_COLORS = {
  'Completed': '#16A36A',
  'In Progress': '#635BFF',
  'To Do': '#8B5CF6',
  'In Review': '#E9A23B',
  'Backlog': '#9AA0B2',
  'Blocked': '#EF4444'
};

export default function TeamMemberDashboard() {
  const { currentUser, projects = [], tasks = [], teams = [], updateTask } = useApp();
  const navigate = useNavigate();

  // Scoped projects using centralized RBAC
  const myProjects = useMemo(() => {
    return ScopeRules.filterProjects(projects, currentUser, teams);
  }, [projects, currentUser, teams]);

  // Scoped tasks (individual + team assignments)
  const myTasks = useMemo(() => {
    return ScopeRules.filterTasks(tasks, currentUser, teams, myProjects);
  }, [tasks, currentUser, teams, myProjects]);

  // Counters for personal work
  const completedTasks = myTasks.filter(t => t.status === 'Completed').length;
  const inProgressTasks = myTasks.filter(t => t.status === 'In Progress' || t.status === 'In Review').length;
  const todoTasks = myTasks.filter(t => t.status === 'To Do' || t.status === 'Backlog').length;
  const overdueTasks = myTasks.filter(t => t.status !== 'Completed' && t.dueDate && asDate(t.dueDate) < asDate()).length;

  // Personal Task Status Distribution for Donut Chart
  const statusChartData = useMemo(() => {
    const counts = myTasks.reduce((acc, t) => {
      const s = t.status || 'To Do';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(counts).map(k => ({ name: k, value: counts[k] }));
  }, [myTasks]);

  // Today's Work: Overdue or Due within 48h or In Progress
  const todayTasks = useMemo(() => {
    const now = asDate();
    const inTwoDays = asDate(now.getTime() + 2 * 86400000);
    return myTasks.filter(t => {
      if (t.status === 'Completed') return false;
      if (t.status === 'In Progress') return true;
      if (t.dueDate) {
        const d = asDate(t.dueDate);
        return d <= inTwoDays;
      }
      return false;
    }).slice(0, 5);
  }, [myTasks]);

  // Upcoming Deadlines: next upcoming personal tasks & project milestones
  const upcomingDeadlines = useMemo(() => {
    return myTasks
      .filter(t => t.dueDate && t.status !== 'Completed')
      .sort((a, b) => asDate(a.dueDate) - asDate(b.dueDate))
      .slice(0, 6);
  }, [myTasks]);

  const handleQuickStatusChange = async (task, newStatus) => {
    try {
      await updateTask({
        ...task,
        status: newStatus,
        progress: newStatus === 'Completed' ? 100 : task.progress
      });
    } catch (e) {
      console.warn('Could not update task status:', e);
    }
  };

  const todayStr = asDate().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* A. Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
        <div>
          <span className="text-[11px] font-bold text-[#1E6091] uppercase tracking-wider">Workspace Dashboard</span>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight mt-1">
            Hello, {currentUser?.name}
          </h1>
          <p className="text-xs text-[var(--text-sec)] mt-1">
            {todayStr} • {currentUser?.designation || 'Team Member'} ({currentUser?.department || 'Engineering'}) • {inProgressTasks} tasks in progress
          </p>
        </div>

        {/* Quick Action Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/tasks')}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1E6091] hover:bg-[#143A52] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-colors"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>My Work</span>
          </button>
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-main)] hover:bg-[var(--border)] text-[var(--text-main)] border border-[var(--border)] text-xs font-semibold rounded-xl cursor-pointer transition-colors"
          >
            <FolderKanban className="w-3.5 h-3.5 text-[#1E6091]" />
            <span>My Projects</span>
          </button>
          <button
            onClick={() => navigate('/calendar')}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-main)] hover:bg-[var(--border)] text-[var(--text-main)] border border-[var(--border)] text-xs font-semibold rounded-xl cursor-pointer transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 text-purple-600" />
            <span>Calendar</span>
          </button>
        </div>
      </div>

      {/* B. My Work Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <span className="text-[10px] font-bold text-[var(--text-sec)] uppercase block mb-1">My Tasks</span>
          <p className="text-2xl font-bold text-[var(--text-main)]">{myTasks.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <span className="text-[10px] font-bold text-[#8B5CF6] uppercase block mb-1">To Do</span>
          <p className="text-2xl font-bold text-[#8B5CF6]">{todoTasks}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <span className="text-[10px] font-bold text-[#635BFF] uppercase block mb-1">In Progress</span>
          <p className="text-2xl font-bold text-[#635BFF]">{inProgressTasks}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <span className="text-[10px] font-bold text-[#16A36A] uppercase block mb-1">Completed</span>
          <p className="text-2xl font-bold text-[#16A36A]">{completedTasks}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <span className="text-[10px] font-bold text-[#EF4444] uppercase block mb-1">Overdue</span>
          <p className="text-2xl font-bold text-[#EF4444]">{overdueTasks}</p>
        </div>
      </div>

      {/* E & Personal Chart Row: Today's Work + Status Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* E. Today's Focus Work */}
        <div className="lg:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-[#1E6091]" />
              <h3 className="text-sm font-bold text-[var(--text-main)]">Today's Focus & Urgent Tasks</h3>
            </div>
            <button
              onClick={() => navigate('/tasks')}
              className="text-xs font-semibold text-[#1E6091] hover:underline flex items-center gap-1 cursor-pointer"
            >
              Open Workspace <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {todayTasks.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-sec)]">
              No pressing deadlines or in-progress tasks today. Great job!
            </div>
          ) : (
            <div className="space-y-3">
              {todayTasks.map(t => {
                const proj = projects.find(p => p.id === t.projectId);
                const isOverdue = t.dueDate && asDate(t.dueDate) < asDate();

                return (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] flex items-center justify-between gap-3"
                  >
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                          t.priority === 'High' || t.priority === 'Critical'
                            ? 'bg-rose-500/10 text-rose-600'
                            : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          {t.priority || 'Medium'}
                        </span>
                        <span className="text-[10px] text-[var(--text-sec)]">{proj?.name || 'General Task'}</span>
                      </div>
                      <h4 className="text-xs font-bold text-[var(--text-main)] truncate mt-1">{t.title}</h4>
                      <p className={`text-[10px] mt-0.5 ${isOverdue ? 'text-red-500 font-bold' : 'text-[var(--text-sec)]'}`}>
                        Due: {t.dueDate ? asDate(t.dueDate).toLocaleDateString() : 'No date'}
                      </p>
                    </div>

                    {/* Quick action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {t.status !== 'In Progress' && (
                        <button
                          onClick={() => handleQuickStatusChange(t, 'In Progress')}
                          className="px-2.5 py-1 text-[10px] font-bold bg-[#635BFF]/10 text-[#635BFF] hover:bg-[#635BFF]/20 rounded-lg cursor-pointer"
                        >
                          Start
                        </button>
                      )}
                      <button
                        onClick={() => handleQuickStatusChange(t, 'Completed')}
                        className="px-2.5 py-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded-lg cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Task Status Donut */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)] mb-4">
              <CheckSquare className="w-4 h-4 text-[#1E6091]" />
              <h3 className="text-sm font-bold text-[var(--text-main)]">My Work Breakdown</h3>
            </div>

            {statusChartData.length === 0 ? (
              <div className="py-16 text-center text-xs text-[var(--text-sec)]">
                No tasks to display.
              </div>
            ) : (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={65}
                      innerRadius={38}
                      paddingAngle={3}
                    >
                      {statusChartData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={TASK_STATUS_COLORS[entry.name] || '#1E6091'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-[var(--border)] text-[10px]">
            {statusChartData.map(item => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TASK_STATUS_COLORS[item.name] || '#1E6091' }} />
                <span className="text-[var(--text-sec)] truncate">{item.name}:</span>
                <span className="font-bold text-[var(--text-main)]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* D & F Row: My Projects + Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* D. My Projects */}
        <div className="lg:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-[#1E6091]" />
              <h3 className="text-sm font-bold text-[var(--text-main)]">My Assigned Projects</h3>
            </div>
            <button
              onClick={() => navigate('/projects')}
              className="text-xs font-semibold text-[#1E6091] hover:underline flex items-center gap-1 cursor-pointer"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {myProjects.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-sec)]">
              You are not currently assigned to any active projects.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {myProjects.map(p => {
                const pTasks = myTasks.filter(t => t.projectId === p.id);
                const pDone = pTasks.filter(t => t.status === 'Completed').length;
                const prog = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : (p.progress || 0);

                return (
                  <div
                    key={p.id}
                    onClick={() => navigate('/projects')}
                    className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] hover:border-[#1E6091] cursor-pointer transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">
                          {p.status}
                        </span>
                        <span className="text-[10px] text-[var(--text-sec)]">
                          Due {p.dueDate ? asDate(p.dueDate).toLocaleDateString() : 'TBD'}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-[var(--text-main)]">{p.name}</h4>
                      <p className="text-[10px] text-[var(--text-sec)] mt-1 line-clamp-1">{p.description || 'No description provided'}</p>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] font-bold text-[var(--text-sec)] mb-1">
                        <span>Progress</span>
                        <span>{prog}%</span>
                      </div>
                      <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                        <div className="h-full bg-[#1E6091] rounded-full" style={{ width: `${prog}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* F. Upcoming Deadlines */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)] mb-4">
              <Clock className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-[var(--text-main)]">Upcoming Deadlines</h3>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--text-sec)]">
                No upcoming deadlines on your personal schedule.
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingDeadlines.map(d => {
                  const isOver = asDate(d.dueDate) < asDate();
                  return (
                    <div
                      key={d.id}
                      className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] flex items-center justify-between"
                    >
                      <div className="overflow-hidden">
                        <h4 className="text-xs font-bold text-[var(--text-main)] truncate">{d.title}</h4>
                        <span className="text-[10px] text-[var(--text-sec)]">{d.status}</span>
                      </div>
                      <span className={`text-[10px] font-bold whitespace-nowrap ml-2 ${isOver ? 'text-red-500' : 'text-[var(--text-sec)]'}`}>
                        {asDate(d.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/calendar')}
            className="w-full mt-4 py-2 border border-[var(--border)] hover:bg-[var(--bg-main)] text-xs font-semibold text-[var(--text-main)] rounded-xl cursor-pointer transition-colors text-center"
          >
            View Calendar Schedule
          </button>
        </div>
      </div>
    </div>
  );
}


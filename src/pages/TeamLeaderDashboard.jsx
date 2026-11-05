import React, { useMemo, useState } from 'react';
import {
  Users2,
  FolderKanban,
  Clock,
  ArrowRight,
  Plus,
  ListTodo,
  CheckSquare
} from 'lucide-react';
import { useApp } from '../context/useApp';
import { getInitials } from '../utils/avatar';
import { useNavigate } from 'react-router-dom';
import { asDate } from '../utils/dateHelpers';
import {
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const TASK_STATUS_COLORS = {
  'Completed': '#16A36A',
  'In Progress': '#635BFF',
  'To Do': '#8B5CF6',
  'In Review': '#E9A23B',
  'Backlog': '#9AA0B2',
  'Blocked': '#EF4444'
};

export default function TeamLeaderDashboard() {
  const { currentUser, projects = [], tasks = [], teams = [], users = [], setQuickCreateOpen } = useApp();
  const navigate = useNavigate();

  const [taskFilter, setTaskFilter] = useState('ALL');

  // Scope: Teams led by currentUser
  const ledTeams = useMemo(() => {
    return teams.filter(t => t.leaderId === currentUser?.id);
  }, [teams, currentUser?.id]);

  const ledTeamIds = useMemo(() => ledTeams.map(t => t.id), [ledTeams]);

  // Unique member IDs across all led teams
  const teamMemberIds = useMemo(() => {
    const ids = new Set();
    ledTeams.forEach(t => {
      (t.memberIds || []).forEach(uid => ids.add(uid));
    });
    return Array.from(ids);
  }, [ledTeams]);

  // Projects managed by Leader OR assigned to teams led by Leader
  const managedProjects = useMemo(() => {
    return projects.filter(p =>
      p.managerId === currentUser?.id ||
      (p.teamId && ledTeamIds.includes(p.teamId))
    );
  }, [projects, currentUser?.id, ledTeamIds]);

  const managedProjectIds = useMemo(() => managedProjects.map(p => p.id), [managedProjects]);

  // Tasks in Leader's scope:
  // - Directly assigned to Leader
  // - Assigned to a team led by Leader
  // - In a project managed by Leader
  const scopedTasks = useMemo(() => {
    return tasks.filter(t =>
      t.assigneeId === currentUser?.id ||
      (t.teamId && ledTeamIds.includes(t.teamId)) ||
      (t.projectId && managedProjectIds.includes(t.projectId))
    );
  }, [tasks, currentUser?.id, ledTeamIds, managedProjectIds]);

  // Counters
  const completedTasks = scopedTasks.filter(t => t.status === 'Completed').length;
  const pendingTasks = scopedTasks.filter(t => t.status !== 'Completed').length;
  const overdueTasks = scopedTasks.filter(t => t.status !== 'Completed' && t.dueDate && asDate(t.dueDate) < asDate()).length;

  // Task Status Distribution Chart Data
  const statusChartData = useMemo(() => {
    const counts = scopedTasks.reduce((acc, t) => {
      const s = t.status || 'To Do';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(counts).map(k => ({ name: k, value: counts[k] }));
  }, [scopedTasks]);

  // Team Workload Data: members in led teams
  const workloadData = useMemo(() => {
    const memberUsers = users.filter(u => teamMemberIds.includes(u.id));
    return memberUsers.map(member => {
      const memberTasks = scopedTasks.filter(t => t.assigneeId === member.id);
      const total = memberTasks.length;
      const done = memberTasks.filter(t => t.status === 'Completed').length;
      const inProg = memberTasks.filter(t => t.status === 'In Progress').length;
      const overdue = memberTasks.filter(t => t.status !== 'Completed' && t.dueDate && asDate(t.dueDate) < asDate()).length;
      return {
        member,
        total,
        done,
        inProg,
        overdue
      };
    });
  }, [users, teamMemberIds, scopedTasks]);

  // Filtered task management list
  const filteredTasks = useMemo(() => {
    return scopedTasks.filter(t => {
      if (taskFilter === 'TODO') return t.status === 'To Do' || t.status === 'Backlog';
      if (taskFilter === 'IN_PROGRESS') return t.status === 'In Progress' || t.status === 'In Review';
      if (taskFilter === 'COMPLETED') return t.status === 'Completed';
      if (taskFilter === 'OVERDUE') return t.status !== 'Completed' && t.dueDate && asDate(t.dueDate) < asDate();
      return true;
    });
  }, [scopedTasks, taskFilter]);

  // Upcoming Deadlines (Projects & Tasks sorted)
  const upcomingDeadlines = useMemo(() => {
    const items = [];
    managedProjects.forEach(p => {
      if (p.dueDate && p.status !== 'Completed') {
        items.push({
          id: `p-${p.id}`,
          title: p.name,
          type: 'Project',
          dueDate: p.dueDate,
          priority: p.priority || 'Medium',
          status: p.status
        });
      }
    });
    scopedTasks.forEach(t => {
      if (t.dueDate && t.status !== 'Completed') {
        items.push({
          id: `t-${t.id}`,
          title: t.title,
          type: 'Task',
          dueDate: t.dueDate,
          priority: t.priority || 'Medium',
          status: t.status
        });
      }
    });
    return items.sort((a, b) => asDate(a.dueDate) - asDate(b.dueDate)).slice(0, 8);
  }, [managedProjects, scopedTasks]);

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
          <span className="text-[11px] font-bold text-[#635BFF] uppercase tracking-wider">Team Leader Overview</span>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight mt-1">
            Welcome back, {currentUser?.name}
          </h1>
          <p className="text-xs text-[var(--text-sec)] mt-1">
            {todayStr} • Leading {ledTeams.length} {ledTeams.length === 1 ? 'team' : 'teams'} across {managedProjects.length} {managedProjects.length === 1 ? 'project' : 'projects'} • {pendingTasks} pending tasks
          </p>
        </div>

        {/* Quick Action Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setQuickCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#635BFF] hover:bg-[#4942D9] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-main)] hover:bg-[var(--border)] text-[var(--text-main)] border border-[var(--border)] text-xs font-semibold rounded-xl cursor-pointer transition-colors"
          >
            <FolderKanban className="w-3.5 h-3.5 text-[#1E6091]" />
            <span>Projects</span>
          </button>
          <button
            onClick={() => navigate('/teams')}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-main)] hover:bg-[var(--border)] text-[var(--text-main)] border border-[var(--border)] text-xs font-semibold rounded-xl cursor-pointer transition-colors"
          >
            <Users2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Teams</span>
          </button>
        </div>
      </div>

      {/* B. Overview Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <span className="text-[10px] font-bold text-[var(--text-sec)] uppercase block mb-1">Team Members</span>
          <p className="text-2xl font-bold text-[var(--text-main)]">{teamMemberIds.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <span className="text-[10px] font-bold text-[var(--text-sec)] uppercase block mb-1">Active Projects</span>
          <p className="text-2xl font-bold text-[var(--text-main)]">{managedProjects.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <span className="text-[10px] font-bold text-[var(--text-sec)] uppercase block mb-1">Total Tasks</span>
          <p className="text-2xl font-bold text-[var(--text-main)]">{scopedTasks.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <span className="text-[10px] font-bold text-[#16A36A] uppercase block mb-1">Completed</span>
          <p className="text-2xl font-bold text-[#16A36A]">{completedTasks}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <span className="text-[10px] font-bold text-[#E9A23B] uppercase block mb-1">Pending</span>
          <p className="text-2xl font-bold text-[#E9A23B]">{pendingTasks}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <span className="text-[10px] font-bold text-[#EF4444] uppercase block mb-1">Overdue</span>
          <p className="text-2xl font-bold text-[#EF4444]">{overdueTasks}</p>
        </div>
      </div>

      {/* C & Charts Row: Projects + Task Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Managed Projects List */}
        <div className="lg:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-[#1E6091]" />
                <h3 className="text-sm font-bold text-[var(--text-main)]">Managed Projects</h3>
              </div>
              <button
                onClick={() => navigate('/projects')}
                className="text-xs font-semibold text-[#635BFF] hover:underline flex items-center gap-1 cursor-pointer"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {managedProjects.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--text-sec)]">
                No active projects assigned to your managed teams.
              </div>
            ) : (
              <div className="space-y-3">
                {managedProjects.slice(0, 4).map(p => {
                  const pTasks = scopedTasks.filter(t => t.projectId === p.id);
                  const pDone = pTasks.filter(t => t.status === 'Completed').length;
                  const prog = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : (p.progress || 0);

                  return (
                    <div
                      key={p.id}
                      onClick={() => navigate('/projects')}
                      className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] hover:border-[#635BFF]/60 cursor-pointer transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-[var(--text-main)]">{p.name}</h4>
                          <p className="text-[10px] text-[var(--text-sec)] mt-0.5">
                            Due {p.dueDate ? asDate(p.dueDate).toLocaleDateString() : 'TBD'} • {pTasks.length} tasks ({pDone} done)
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          p.status === 'Completed'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                          <div className="h-full bg-[#1E6091] rounded-full transition-all duration-300" style={{ width: `${prog}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--text-sec)]">{prog}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Task Status Distribution Chart */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)] mb-4">
              <CheckSquare className="w-4 h-4 text-[#635BFF]" />
              <h3 className="text-sm font-bold text-[var(--text-main)]">Task Status Breakdown</h3>
            </div>

            {statusChartData.length === 0 ? (
              <div className="py-16 text-center text-xs text-[var(--text-sec)]">
                No tasks available to chart.
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
                        <Cell key={`cell-${idx}`} fill={TASK_STATUS_COLORS[entry.name] || '#635BFF'} />
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
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TASK_STATUS_COLORS[item.name] || '#635BFF' }} />
                <span className="text-[var(--text-sec)] truncate">{item.name}:</span>
                <span className="font-bold text-[var(--text-main)]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* D. Team Task Management Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)] mb-4">
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-[#635BFF]" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">Team Tasks</h3>
            <span className="text-xs text-[var(--text-sec)]">({filteredTasks.length})</span>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'TODO', label: 'To Do' },
              { id: 'IN_PROGRESS', label: 'In Progress' },
              { id: 'COMPLETED', label: 'Completed' },
              { id: 'OVERDUE', label: 'Overdue' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setTaskFilter(f.id)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  taskFilter === f.id
                    ? 'bg-[#635BFF] text-white'
                    : 'bg-[var(--bg-main)] text-[var(--text-sec)] hover:text-[var(--text-main)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-main)] border-b border-[var(--border)] text-[var(--text-sec)] uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Task Name</th>
                <th className="py-2.5 px-3">Project</th>
                <th className="py-2.5 px-3">Assignee</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-xs text-[var(--text-sec)]">
                    No tasks found matching this filter.
                  </td>
                </tr>
              ) : (
                filteredTasks.slice(0, 8).map(task => {
                  const proj = projects.find(p => p.id === task.projectId);
                  const assignee = users.find(u => u.id === task.assigneeId);
                  const isOverdue = task.status !== 'Completed' && task.dueDate && asDate(task.dueDate) < asDate();

                  return (
                    <tr
                      key={task.id}
                      onClick={() => navigate('/tasks')}
                      className="hover:bg-[var(--bg-main)] transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-semibold text-[var(--text-main)] max-w-xs truncate">
                        {task.title}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-sec)]">{proj?.name || 'Unassigned'}</td>
                      <td className="py-2.5 px-3 text-[var(--text-main)] font-medium">
                        {assignee?.name || 'Unassigned'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          task.priority === 'High' || task.priority === 'Critical'
                            ? 'bg-rose-500/10 text-rose-600'
                            : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          {task.priority || 'Medium'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] font-semibold text-[var(--text-sec)]">{task.status}</span>
                      </td>
                      <td className={`py-2.5 px-3 font-medium ${isOverdue ? 'text-red-600 font-bold' : 'text-[var(--text-sec)]'}`}>
                        {task.dueDate ? asDate(task.dueDate).toLocaleDateString() : 'None'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* E & F: Team Workload + Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Workload */}
        <div className="lg:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)] mb-4">
            <Users2 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">Team Workload Distribution</h3>
          </div>

          {workloadData.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-sec)]">
              No team members assigned to your led teams.
            </div>
          ) : (
            <div className="space-y-3">
              {workloadData.map(item => (
                <div
                  key={item.member.id}
                  className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#635BFF] text-white text-xs font-bold flex items-center justify-center">
                      {getInitials(item.member.name)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-main)]">{item.member.name}</h4>
                      <p className="text-[10px] text-[var(--text-sec)]">{item.member.designation || 'Team Member'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[var(--text-sec)] block">Tasks</span>
                      <span className="text-xs font-bold text-[var(--text-main)]">{item.total}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-emerald-600 block">Done</span>
                      <span className="text-xs font-bold text-emerald-600">{item.done}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[#635BFF] block">In Progress</span>
                      <span className="text-xs font-bold text-[#635BFF]">{item.inProg}</span>
                    </div>
                    {item.overdue > 0 && (
                      <div>
                        <span className="text-[9px] uppercase font-bold text-red-500 block">Overdue</span>
                        <span className="text-xs font-bold text-red-500">{item.overdue}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)] mb-4">
              <Clock className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-[var(--text-main)]">Upcoming Deadlines</h3>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--text-sec)]">
                No upcoming deadlines in your scope.
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
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                          d.type === 'Project' ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        }`}>
                          {d.type}
                        </span>
                        <h4 className="text-xs font-bold text-[var(--text-main)] truncate mt-1">{d.title}</h4>
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
            Open Full Calendar
          </button>
        </div>
      </div>
    </div>
  );
}


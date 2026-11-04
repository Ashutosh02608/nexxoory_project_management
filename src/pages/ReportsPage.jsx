import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  Filter,
  X,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ListTodo,
  FolderKanban,
  Users2,
  Calendar,
  ArrowUpRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ScopeRules } from '../config/rbac';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from 'recharts';

export default function ReportsPage() {
  const { projects = [], tasks = [], teams = [], users = [], currentUser } = useApp();
  const navigate = useNavigate();

  // Role-scoped base datasets
  const scopedProjects = useMemo(() => {
    return ScopeRules.filterProjects(projects, currentUser);
  }, [projects, currentUser]);

  const scopedTasks = useMemo(() => {
    const allowedProjectIds = new Set(scopedProjects.map(p => p.id));
    if (currentUser?.role === 'admin') return tasks;
    if (currentUser?.role === 'project_manager') {
      return tasks.filter(t => allowedProjectIds.has(t.projectId) || t.assigneeId === currentUser?.id);
    }
    // Team member: assigned tasks or tasks in their permitted projects
    return tasks.filter(t => t.assigneeId === currentUser?.id || allowedProjectIds.has(t.projectId));
  }, [tasks, scopedProjects, currentUser]);

  // Filters State
  const [dateRange, setDateRange] = useState('ALL'); // 'ALL', '7_DAYS', '30_DAYS', 'THIS_MONTH'
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [projectStatusFilter, setProjectStatusFilter] = useState('ALL');
  const [taskStatusFilter, setTaskStatusFilter] = useState('ALL');

  const hasActiveFilters = dateRange !== 'ALL' || projectFilter !== 'ALL' || teamFilter !== 'ALL' || projectStatusFilter !== 'ALL' || taskStatusFilter !== 'ALL';

  const clearFilters = () => {
    setDateRange('ALL');
    setProjectFilter('ALL');
    setTeamFilter('ALL');
    setProjectStatusFilter('ALL');
    setTaskStatusFilter('ALL');
  };

  // Helper date checker
  const isWithinDateRange = (dateStr) => {
    if (!dateStr || dateRange === 'ALL') return true;
    const itemDate = new Date(dateStr);
    if (isNaN(itemDate.getTime())) return true;
    const now = new Date();
    const diffDays = Math.ceil((itemDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (dateRange === '7_DAYS') return diffDays >= -7 && diffDays <= 7;
    if (dateRange === '30_DAYS') return diffDays >= -30 && diffDays <= 30;
    if (dateRange === 'THIS_MONTH') {
      return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    }
    return true;
  };

  // Filtered Datasets
  const filteredProjects = useMemo(() => {
    return scopedProjects.filter(p => {
      if (projectFilter !== 'ALL' && p.id !== projectFilter) return false;
      if (teamFilter !== 'ALL' && p.teamId !== teamFilter) return false;
      if (projectStatusFilter !== 'ALL' && p.status?.toLowerCase() !== projectStatusFilter.toLowerCase()) return false;
      if (!isWithinDateRange(p.dueDate)) return false;
      return true;
    });
  }, [scopedProjects, projectFilter, teamFilter, projectStatusFilter, dateRange]);

  const filteredTasks = useMemo(() => {
    return scopedTasks.filter(t => {
      if (projectFilter !== 'ALL' && t.projectId !== projectFilter) return false;
      if (teamFilter !== 'ALL' && t.teamId !== teamFilter) return false;
      if (taskStatusFilter !== 'ALL' && t.status?.toLowerCase() !== taskStatusFilter.toLowerCase()) return false;
      if (!isWithinDateRange(t.dueDate)) return false;
      return true;
    });
  }, [scopedTasks, projectFilter, teamFilter, taskStatusFilter, dateRange]);

  // Project Status Overview Calculation
  const projectStatusData = useMemo(() => {
    const counts = { 'Not Started': 0, 'In Progress': 0, 'On Hold': 0, 'Completed': 0 };
    filteredProjects.forEach(p => {
      const s = p.status || 'Not Started';
      if (counts[s] !== undefined) counts[s]++;
      else if (s.toLowerCase().includes('progress')) counts['In Progress']++;
      else if (s.toLowerCase().includes('hold')) counts['On Hold']++;
      else if (s.toLowerCase().includes('complete') || s.toLowerCase().includes('done')) counts['Completed']++;
      else counts['Not Started']++;
    });

    const total = filteredProjects.length;
    return [
      { name: 'In Progress', value: counts['In Progress'], color: '#3B82F6', pct: total ? Math.round((counts['In Progress'] / total) * 100) : 0 },
      { name: 'Completed', value: counts['Completed'], color: '#10B981', pct: total ? Math.round((counts['Completed'] / total) * 100) : 0 },
      { name: 'On Hold', value: counts['On Hold'], color: '#F59E0B', pct: total ? Math.round((counts['On Hold'] / total) * 100) : 0 },
      { name: 'Not Started', value: counts['Not Started'], color: '#94A3B8', pct: total ? Math.round((counts['Not Started'] / total) * 100) : 0 },
    ];
  }, [filteredProjects]);

  // Task Completion Overview Calculation
  const taskStatusData = useMemo(() => {
    const now = new Date();
    let todo = 0, inProg = 0, inReview = 0, completed = 0, overdue = 0;

    filteredTasks.forEach(t => {
      const isDone = t.status === 'Completed' || t.status === 'Done';
      if (isDone) {
        completed++;
        return;
      }
      const isOverdue = t.dueDate && new Date(t.dueDate) < now;
      if (isOverdue) {
        overdue++;
        return;
      }
      if (t.status === 'In Progress') inProg++;
      else if (t.status === 'In Review') inReview++;
      else todo++;
    });

    const total = filteredTasks.length;
    return [
      { name: 'To Do', value: todo, color: '#94A3B8', pct: total ? Math.round((todo / total) * 100) : 0 },
      { name: 'In Progress', value: inProg, color: '#3B82F6', pct: total ? Math.round((inProg / total) * 100) : 0 },
      { name: 'In Review', value: inReview, color: '#8B5CF6', pct: total ? Math.round((inReview / total) * 100) : 0 },
      { name: 'Completed', value: completed, color: '#10B981', pct: total ? Math.round((completed / total) * 100) : 0 },
      { name: 'Overdue', value: overdue, color: '#EF4444', pct: total ? Math.round((overdue / total) * 100) : 0 },
    ];
  }, [filteredTasks]);

  // Upcoming Deadlines Calculation (Projects & Tasks)
  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const items = [];

    // Projects
    filteredProjects.forEach(p => {
      if (!p.dueDate || p.status === 'Completed') return;
      const d = new Date(p.dueDate);
      const isOverdue = d < now;
      const isSoon = d >= now && d <= sevenDaysLater;
      if (isOverdue || isSoon) {
        const mgr = users.find(u => u.id === p.managerId)?.name || 'Unassigned';
        items.push({
          id: p.id,
          name: p.name,
          type: 'Project',
          associatedProject: p.name,
          assigned: mgr,
          dueDate: p.dueDate,
          status: p.status,
          isOverdue,
          isSoon
        });
      }
    });

    // Tasks
    filteredTasks.forEach(t => {
      if (!t.dueDate || t.status === 'Completed' || t.status === 'Done') return;
      const d = new Date(t.dueDate);
      const isOverdue = d < now;
      const isSoon = d >= now && d <= sevenDaysLater;
      if (isOverdue || isSoon) {
        const projName = projects.find(p => p.id === t.projectId)?.name || 'Direct Task';
        const assignee = users.find(u => u.id === t.assigneeId)?.name || 'Unassigned';
        items.push({
          id: t.id,
          name: t.title,
          type: 'Task',
          associatedProject: projName,
          assigned: assignee,
          dueDate: t.dueDate,
          status: t.status,
          isOverdue,
          isSoon
        });
      }
    });

    return items.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 10);
  }, [filteredProjects, filteredTasks, users, projects]);

  // Team Workload Calculation
  const teamWorkload = useMemo(() => {
    const now = new Date();
    return teams.map(team => {
      const teamTasks = scopedTasks.filter(t => t.teamId === team.id);
      const completed = teamTasks.filter(t => t.status === 'Completed' || t.status === 'Done').length;
      const overdue = teamTasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'Completed' && t.status !== 'Done').length;
      const pending = teamTasks.length - completed;
      const pct = teamTasks.length > 0 ? Math.round((completed / teamTasks.length) * 100) : 0;

      return {
        id: team.id,
        name: team.name,
        totalTasks: teamTasks.length,
        completed,
        pending,
        overdue,
        pct
      };
    }).filter(t => t.totalTasks > 0 || teamFilter === 'ALL');
  }, [teams, scopedTasks, teamFilter]);

  // Functional CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Record Type',
      'Name',
      'Associated Project',
      'Assigned Manager / Employee',
      'Status',
      'Priority',
      'Completion %',
      'Due Date'
    ];

    const projectRows = filteredProjects.map(p => {
      const mgr = users.find(u => u.id === p.managerId)?.name || 'Unassigned';
      return [
        'Project',
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${mgr}"`,
        `"${p.status}"`,
        `"${p.priority}"`,
        `${p.progress || 0}%`,
        `"${p.dueDate || 'N/A'}"`
      ].join(',');
    });

    const taskRows = filteredTasks.map(t => {
      const proj = projects.find(p => p.id === t.projectId)?.name || 'General';
      const assignee = users.find(u => u.id === t.assigneeId)?.name || 'Unassigned';
      return [
        'Task',
        `"${t.title.replace(/"/g, '""')}"`,
        `"${proj.replace(/"/g, '""')}"`,
        `"${assignee}"`,
        `"${t.status}"`,
        `"${t.priority}"`,
        t.status === 'Completed' ? '100%' : '0%',
        `"${t.dueDate || 'N/A'}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...projectRows, ...taskRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `nexxoory_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">Project & Delivery Intelligence</h1>
          <p className="text-xs sm:text-sm text-[var(--text-sec)] mt-0.5">
            Operational status, milestones, upcoming deadlines, and team capacity tracking.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center justify-center gap-2 bg-[#1E6091] hover:bg-[#164e77] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export Portfolio CSV</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-main)]">
            <Filter className="w-4 h-4 text-[#1E6091]" />
            <span>Report Filters</span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-[#1E6091] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Clear Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Date Range */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-[var(--text-sec)] mb-1">Time Horizon</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[#1E6091]"
            >
              <option value="ALL">All Dates</option>
              <option value="7_DAYS">± 7 Days</option>
              <option value="30_DAYS">± 30 Days</option>
              <option value="THIS_MONTH">This Month</option>
            </select>
          </div>

          {/* Project */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-[var(--text-sec)] mb-1">Project</label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[#1E6091]"
            >
              <option value="ALL">All Projects ({scopedProjects.length})</option>
              {scopedProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Team */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-[var(--text-sec)] mb-1">Squad / Team</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[#1E6091]"
            >
              <option value="ALL">All Teams ({teams.length})</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Project Status */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-[var(--text-sec)] mb-1">Project Status</label>
            <select
              value={projectStatusFilter}
              onChange={(e) => setProjectStatusFilter(e.target.value)}
              className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[#1E6091]"
            >
              <option value="ALL">All Statuses</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          {/* Task Status */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-[var(--text-sec)] mb-1">Task Status</label>
            <select
              value={taskStatusFilter}
              onChange={(e) => setTaskStatusFilter(e.target.value)}
              className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[#1E6091]"
            >
              <option value="ALL">All Tasks</option>
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="In Review">In Review</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Row 1: Status Distribution Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Project Status Overview */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-[#1E6091]" />
                Project Status Overview
              </h3>
              <span className="text-xs font-semibold text-[var(--text-sec)] bg-[var(--bg-main)] px-2.5 py-0.5 rounded-full border border-[var(--border)]">
                {filteredProjects.length} Projects Total
              </span>
            </div>
            <p className="text-xs text-[var(--text-sec)] mb-4">Distribution across execution lifecycle phases</p>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-[var(--text-sec)]">
              No matching projects for selected filters
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="h-52 w-52 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      formatter={(val, name) => [`${val} (${projectStatusData.find(d => d.name === name)?.pct}%)`, name]}
                      contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '11px' }}
                    />
                    <Pie
                      data={projectStatusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {projectStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex-1 w-full space-y-2">
                {projectStatusData.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-medium text-[var(--text-main)]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text-main)]">{item.value}</span>
                      <span className="text-[10px] text-[var(--text-sec)] w-9 text-right">({item.pct}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Task Completion Overview */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-[#1E6091]" />
                Task Completion Overview
              </h3>
              <span className="text-xs font-semibold text-[var(--text-sec)] bg-[var(--bg-main)] px-2.5 py-0.5 rounded-full border border-[var(--border)]">
                {filteredTasks.length} Tasks Total
              </span>
            </div>
            <p className="text-xs text-[var(--text-sec)] mb-4">Current state and overdue status across tasks</p>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-[var(--text-sec)]">
              No matching tasks for selected filters
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="h-52 w-52 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      formatter={(val, name) => [`${val} (${taskStatusData.find(d => d.name === name)?.pct}%)`, name]}
                      contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '11px' }}
                    />
                    <Pie
                      data={taskStatusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {taskStatusData.map((entry, index) => (
                        <Cell key={`task-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex-1 w-full space-y-2">
                {taskStatusData.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-medium text-[var(--text-main)]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text-main)]">{item.value}</span>
                      <span className="text-[10px] text-[var(--text-sec)] w-9 text-right">({item.pct}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Project Delivery Report */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            Project Delivery & Milestone Health
          </h3>
          <span className="text-xs text-[var(--text-sec)] font-semibold">{filteredProjects.length} initiatives</span>
        </div>
        <p className="text-xs text-[var(--text-sec)] mb-4">Milestone completion, manager accountability, and task execution progress</p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-sec)] uppercase font-semibold text-[10px]">
                <th className="pb-2">Project</th>
                <th className="pb-2">Manager</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Priority</th>
                <th className="pb-2">Tasks (Done / Total)</th>
                <th className="pb-2 w-36">Progress</th>
                <th className="pb-2 text-right">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-xs text-[var(--text-sec)]">
                    No active projects found matching the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredProjects.map(p => {
                  const pTasks = scopedTasks.filter(t => t.projectId === p.id);
                  const doneTasks = pTasks.filter(t => t.status === 'Completed' || t.status === 'Done').length;
                  const mgrName = users.find(u => u.id === p.managerId)?.name || 'Unassigned';

                  return (
                    <tr key={p.id} className="hover:bg-[var(--bg-main)]/50 transition-colors">
                      <td className="py-3 font-semibold text-[var(--text-main)]">
                        <button
                          onClick={() => navigate('/projects')}
                          className="hover:text-[#1E6091] hover:underline flex items-center gap-1 cursor-pointer text-left font-bold"
                        >
                          <span>{p.name}</span>
                          <ArrowUpRight className="w-3 h-3 text-[var(--text-sec)] inline" />
                        </button>
                      </td>
                      <td className="py-3 text-[var(--text-sec)]">{mgrName}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          p.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
                          p.status === 'In Progress' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' :
                          p.status === 'On Hold' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' :
                          'bg-[var(--bg-main)] text-[var(--text-sec)] border-[var(--border)]'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 font-medium text-[var(--text-main)]">{p.priority || 'Medium'}</td>
                      <td className="py-3 text-[var(--text-sec)]">
                        {doneTasks} / {pTasks.length}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-[var(--border)] h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-[#1E6091] h-full rounded-full transition-all"
                              style={{ width: `${p.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-[var(--text-main)] w-7 text-right">
                            {p.progress || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-medium text-[var(--text-sec)]">
                        {p.dueDate || 'No Date'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: Upcoming Deadlines & Team Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Deadlines */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Critical & Upcoming Deadlines (Next 7 Days)
            </h3>
            <span className="text-xs text-[var(--text-sec)] font-semibold">{upcomingDeadlines.length} items</span>
          </div>
          <p className="text-xs text-[var(--text-sec)] mb-4">Highlighted items requiring immediate delivery focus</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-sec)] uppercase font-semibold text-[10px]">
                  <th className="pb-2">Item</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Assigned</th>
                  <th className="pb-2">Due Date</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {upcomingDeadlines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-[var(--text-sec)]">
                      No overdue or imminent deadlines within this window.
                    </td>
                  </tr>
                ) : (
                  upcomingDeadlines.map((item, idx) => (
                    <tr key={`${item.type}-${item.id}-${idx}`} className="hover:bg-[var(--bg-main)]/50 transition-colors">
                      <td className="py-2.5 font-semibold text-[var(--text-main)] max-w-[160px] truncate" title={item.name}>
                        {item.name}
                      </td>
                      <td className="py-2.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          item.type === 'Project' ? 'bg-[#1E6091]/10 text-[#1E6091]' : 'bg-purple-500/10 text-purple-600'
                        }`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="py-2.5 text-[var(--text-sec)]">{item.assigned}</td>
                      <td className="py-2.5 font-medium">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.isOverdue ? 'bg-red-500/15 text-red-600' : 'bg-amber-500/15 text-amber-700'
                        }`}>
                          {item.dueDate} {item.isOverdue ? '(Overdue)' : ''}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="text-[10px] font-semibold text-[var(--text-sec)]">
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Team Workload Overview */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
              <Users2 className="w-4 h-4 text-[#1E6091]" />
              Team Workload & Capacity Tracking
            </h3>
            <span className="text-xs text-[var(--text-sec)] font-semibold">{teams.length} Squads</span>
          </div>
          <p className="text-xs text-[var(--text-sec)] mb-4">Task distribution, pending load, and delivery velocity across teams</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-sec)] uppercase font-semibold text-[10px]">
                  <th className="pb-2">Squad / Team</th>
                  <th className="pb-2">Total Tasks</th>
                  <th className="pb-2">Done</th>
                  <th className="pb-2">Pending</th>
                  <th className="pb-2">Overdue</th>
                  <th className="pb-2 text-right">Completion %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {teamWorkload.map(tw => (
                  <tr key={tw.id} className="hover:bg-[var(--bg-main)]/50 transition-colors">
                    <td className="py-3 font-semibold text-[var(--text-main)]">{tw.name}</td>
                    <td className="py-3 font-bold text-[var(--text-main)]">{tw.totalTasks}</td>
                    <td className="py-3 text-emerald-600 font-semibold">{tw.completed}</td>
                    <td className="py-3 text-[var(--text-sec)] font-semibold">{tw.pending}</td>
                    <td className="py-3">
                      {tw.overdue > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-600">
                          {tw.overdue}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--text-sec)]">0</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-[var(--border)] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-[#10B981] h-full rounded-full"
                            style={{ width: `${tw.pct}%` }}
                          />
                        </div>
                        <span className="font-bold text-[var(--text-main)] text-[10px] w-6">{tw.pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

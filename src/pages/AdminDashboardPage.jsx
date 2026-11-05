import React, { useState, useMemo, useCallback } from 'react';
import {
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users2,
  TrendingUp,
  ArrowRight,
  Layers,
  Calendar,
  X
} from 'lucide-react';
import { useApp } from '../context/useApp';
import { asDate } from '../utils/dateHelpers';

function CustomBarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl shadow-xl text-xs space-y-1">
      <p className="font-bold text-[var(--text-main)]">{data.fullName}</p>
      <p className="text-[var(--text-sec)]">Status: <span className="font-semibold text-[var(--text-main)]">{data.status}</span></p>
      <p className="text-[#635BFF] font-bold">Progress: {data.progress}%</p>
      <p className="text-[var(--text-sec)]">Tasks: {data.completedTasks} / {data.totalTasks} completed</p>
      <p className="text-[10px] text-[var(--text-sec)]">Due: {data.dueDate}</p>
      <p className="text-[10px] text-[#635BFF] font-semibold pt-1 border-t border-[var(--border)]">Click to open project →</p>
    </div>
  );
}
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboardPage() {
  const { projects = [], tasks = [], teams = [], users = [], announcements = [] } = useApp() || {};
  const navigate = useNavigate();

  // Dashboard Filters State
  const [dateRange, setDateRange] = useState('ALL'); // 'TODAY', '7D', '30D', '90D', 'YEAR', 'ALL'
  const [projectStatusFilter, setProjectStatusFilter] = useState('ALL');
  const [projectTeamFilter, setProjectTeamFilter] = useState('ALL');
  const [selectedTaskStatus, setSelectedTaskStatus] = useState(null); // Filter task views by clicking donut or legend

  // Date-range evaluation helper
  const now = useMemo(() => asDate(), []);
  const filterByDateRange = useCallback((itemDateStr) => {
    if (!itemDateStr || dateRange === 'ALL') return true;
    const itemDate = asDate(itemDateStr);
    if (isNaN(itemDate.getTime())) return true;
    const diffTime = now.getTime() - itemDate.getTime();
    const diffDays = diffTime / (1000 * 3600 * 24);

    switch (dateRange) {
      case 'TODAY':
        return diffDays >= 0 && diffDays <= 1;
      case '7D':
        return diffDays >= 0 && diffDays <= 7;
      case '30D':
        return diffDays >= 0 && diffDays <= 30;
      case '90D':
        return diffDays >= 0 && diffDays <= 90;
      case 'YEAR':
        return diffDays >= 0 && diffDays <= 365;
      default:
        return true;
    }
  }, [dateRange, now]);

  // Scoped & Filtered Projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesDate = filterByDateRange(p.createdAt || p.startDate);
      const matchesStatus = projectStatusFilter === 'ALL' || p.status === projectStatusFilter;
      const matchesTeam = projectTeamFilter === 'ALL' || p.teamId === projectTeamFilter;
      return matchesDate && matchesStatus && matchesTeam;
    });
  }, [projects, projectStatusFilter, projectTeamFilter, filterByDateRange]);

  // Scoped & Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => filterByDateRange(t.createdAt || t.startDate));
  }, [tasks, filterByDateRange]);

  // DERIVED DYNAMIC METRICS FROM REAL DATASETS
  const totalProjects = filteredProjects.length;
  const activeProjects = filteredProjects.filter(p => p.status === 'In Progress' || p.status === 'Planning').length;
  const completedProjects = filteredProjects.filter(p => p.status === 'Completed').length;
  const overdueProjects = filteredProjects.filter(p => p.status === 'Overdue' || (p.dueDate && asDate(p.dueDate) < now && p.status !== 'Completed')).length;
  const totalEmployees = users.length;
  const activeTeams = teams.length;

  // Task Status Distribution Chart Data
  const taskStatusCounts = useMemo(() => {
    return filteredTasks.reduce((acc, t) => {
      if (t?.status) {
        acc[t.status] = (acc[t.status] || 0) + 1;
      }
      return acc;
    }, {});
  }, [filteredTasks]);

  const pieData = useMemo(() => {
    return Object.keys(taskStatusCounts).map(status => ({
      name: status,
      value: taskStatusCounts[status]
    }));
  }, [taskStatusCounts]);

  const PIE_COLORS = {
    'Completed': '#16A36A',
    'In Progress': '#635BFF',
    'To Do': '#8B5CF6',
    'In Review': '#E9A23B',
    'Blocked': '#E05252',
    'Backlog': '#9AA0B2'
  };

  // Real-time Project Progress & Milestone Tracking calculation
  // Computes progress dynamically from actual tasks if project tasks exist
  const projectHealthData = useMemo(() => {
    return filteredProjects.map(p => {
      const pTasks = tasks.filter(t => t.projectId === p.id);
      let calculatedProgress = Number(p.progress) || 0;
      if (pTasks.length > 0) {
        const completedTasksCount = pTasks.filter(t => t.status === 'Completed').length;
        calculatedProgress = Math.round((completedTasksCount / pTasks.length) * 100);
      }
      return {
        id: p.id,
        fullName: p.name || 'Project',
        name: (p.name || 'Project').length > 14 ? (p.name || 'Project').substring(0, 12) + '...' : (p.name || 'Project'),
        progress: calculatedProgress,
        status: p.status,
        totalTasks: pTasks.length,
        completedTasks: pTasks.filter(t => t.status === 'Completed').length,
        dueDate: p.dueDate ? asDate(p.dueDate).toLocaleDateString() : 'N/A'
      };
    });
  }, [filteredProjects, tasks]);

  // Overdue Tasks
  const overdueTasks = useMemo(() => {
    return filteredTasks.filter(t => t.status !== 'Completed' && t.dueDate && asDate(t.dueDate) < now);
  }, [filteredTasks, now]);

  // Active status filtered tasks for interactive detail list
  const activeFilteredTasksList = useMemo(() => {
    if (!selectedTaskStatus) return [];
    return filteredTasks.filter(t => t.status === selectedTaskStatus);
  }, [filteredTasks, selectedTaskStatus]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome & Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">Executive Dashboard</h1>
          <p className="text-xs sm:text-sm text-[var(--text-sec)] mt-0.5">
            Real-time multi-project performance metrics, team velocity, and task pipelines.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date-range Filter Dropdown */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text-main)] shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-[#635BFF]" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent text-xs font-semibold outline-none cursor-pointer"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="7D">Last 7 Days</option>
              <option value="30D">Last 30 Days</option>
              <option value="90D">Last 90 Days</option>
              <option value="YEAR">This Year</option>
            </select>
          </div>

          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-main)] shadow-xs transition-colors cursor-pointer"
          >
            <span>View All Projects</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Projects Card */}
        <div
          onClick={() => navigate('/projects')}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs hover:border-[#635BFF]/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[var(--text-sec)] mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider group-hover:text-[#635BFF] transition-colors">Total Projects</span>
            <FolderKanban className="w-4 h-4 text-[#635BFF]" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-main)]">{totalProjects}</p>
          <span className="text-[10px] text-[var(--text-sec)] mt-1 block">Tracked portfolio →</span>
        </div>

        {/* Active Card */}
        <div
          onClick={() => navigate('/projects?status=In Progress')}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs hover:border-[#635BFF]/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[var(--text-sec)] mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider group-hover:text-[#635BFF] transition-colors">Active</span>
            <Clock className="w-4 h-4 text-[#635BFF]" />
          </div>
          <p className="text-2xl font-bold text-[#635BFF]">{activeProjects}</p>
          <span className="text-[10px] text-[var(--text-sec)] mt-1 block">In execution →</span>
        </div>

        {/* Completed Card */}
        <div
          onClick={() => navigate('/projects?status=Completed')}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs hover:border-[#16A36A]/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[var(--text-sec)] mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider group-hover:text-[#16A36A] transition-colors">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-[#16A36A]" />
          </div>
          <p className="text-2xl font-bold text-[#16A36A]">{completedProjects}</p>
          <span className="text-[10px] text-[var(--text-sec)] mt-1 block">Shipped successfully →</span>
        </div>

        {/* Overdue Card */}
        <div
          onClick={() => navigate('/projects?status=Overdue')}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs hover:border-[#E05252]/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[var(--text-sec)] mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider group-hover:text-[#E05252] transition-colors">Overdue</span>
            <AlertTriangle className="w-4 h-4 text-[#E05252]" />
          </div>
          <p className="text-2xl font-bold text-[#E05252]">{overdueProjects}</p>
          <span className="text-[10px] text-[#E05252] mt-1 block">Needs attention →</span>
        </div>

        {/* Employees Card */}
        <div
          onClick={() => navigate('/employees')}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs hover:border-[#8B5CF6]/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[var(--text-sec)] mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider group-hover:text-[#8B5CF6] transition-colors">Employees</span>
            <Users2 className="w-4 h-4 text-[#8B5CF6]" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-main)]">{totalEmployees}</p>
          <span className="text-[10px] text-[var(--text-sec)] mt-1 block">Staff directory →</span>
        </div>

        {/* Teams Card */}
        <div
          onClick={() => navigate('/teams')}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs hover:border-[#E9A23B]/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[var(--text-sec)] mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider group-hover:text-[#E9A23B] transition-colors">Teams</span>
            <Layers className="w-4 h-4 text-[#E9A23B]" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-main)]">{activeTeams}</p>
          <span className="text-[10px] text-[var(--text-sec)] mt-1 block">Agile squads →</span>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Health & Milestone Delivery Progress */}
        <div className="lg:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-sm text-[var(--text-main)]">Project Progress & Milestone Tracking</h3>
              <p className="text-xs text-[var(--text-sec)]">Live completion percentage across all portfolio initiatives</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Project Status Filter */}
              <select
                value={projectStatusFilter}
                onChange={(e) => setProjectStatusFilter(e.target.value)}
                className="text-xs px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
                <option value="Overdue">Overdue</option>
              </select>

              {/* Team Filter */}
              <select
                value={projectTeamFilter}
                onChange={(e) => setProjectTeamFilter(e.target.value)}
                className="text-xs px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
              >
                <option value="ALL">All Teams</option>
                {teams.map(tm => (
                  <option key={tm.id} value={tm.id}>{tm.name}</option>
                ))}
              </select>

              <TrendingUp className="w-4 h-4 text-[#635BFF] shrink-0 hidden sm:block" />
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {projectHealthData.length === 0 ? (
              <div className="text-center text-xs text-[var(--text-sec)]">
                <p>No project data available for current filters</p>
                <p className="text-[10px] mt-1">Try resetting filters to view progress analytics.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={projectHealthData}
                  margin={{ top: 15, right: 20, left: -20, bottom: 5 }}
                  barCategoryGap="30%"
                  barGap={8}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(140, 145, 160, 0.15)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-sec)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-sec)' }} domain={[0, 100]} />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar
                    dataKey="progress"
                    name="Progress %"
                    fill="#635BFF"
                    maxBarSize={48}
                    radius={[6, 6, 0, 0]}
                    onClick={(data) => {
                      if (data?.id) navigate(`/projects?projectId=${data.id}`);
                    }}
                    cursor="pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Task Distribution Status Donut */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm text-[var(--text-main)]">Task Status Distribution</h3>
              <p className="text-xs text-[var(--text-sec)]">{filteredTasks.length} total tasks tracked across all sprints</p>
            </div>
            {selectedTaskStatus && (
              <button
                onClick={() => setSelectedTaskStatus(null)}
                className="flex items-center gap-1 text-[10px] font-semibold text-[#635BFF] bg-[#635BFF]/10 hover:bg-[#635BFF]/20 px-2 py-0.5 rounded-lg cursor-pointer"
              >
                <span>Clear: {selectedTaskStatus}</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="h-52 w-full flex items-center justify-center my-2">
            {pieData.length === 0 ? (
              <div className="text-center text-xs text-[var(--text-sec)]">
                <p>No tasks recorded</p>
                <p className="text-[10px] mt-1">Status pipeline is empty</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    onClick={(entry) => {
                      if (entry?.name) {
                        setSelectedTaskStatus(prev => prev === entry.name ? null : entry.name);
                      }
                    }}
                    cursor="pointer"
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[entry.name] || '#635BFF'}
                        stroke={selectedTaskStatus === entry.name ? '#1E6091' : 'none'}
                        strokeWidth={selectedTaskStatus === entry.name ? 3 : 0}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Interactive Legend */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[var(--border)] min-h-[40px]">
            {pieData.length === 0 ? (
              <span className="text-[11px] text-[var(--text-sec)] col-span-2 text-center">0 task categories</span>
            ) : (
              pieData.map(item => {
                const isSelected = selectedTaskStatus === item.name;
                return (
                  <div
                    key={item.name}
                    onClick={() => setSelectedTaskStatus(prev => prev === item.name ? null : item.name)}
                    className={`flex items-center gap-2 p-1 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#635BFF]/15 font-bold' : 'hover:bg-[var(--bg-main)]'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[item.name] || '#635BFF' }} />
                    <span className="text-[var(--text-sec)] truncate">{item.name}</span>
                    <span className="font-semibold ml-auto text-[var(--text-main)]">{item.value}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Interactive Selected Tasks Detail Strip */}
      {selectedTaskStatus && (
        <div className="bg-[var(--surface)] border border-[#635BFF]/30 rounded-2xl p-4 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[selectedTaskStatus] || '#635BFF' }} />
              <h4 className="text-xs font-bold text-[var(--text-main)]">
                Tasks with Status: "{selectedTaskStatus}" ({activeFilteredTasksList.length})
              </h4>
            </div>
            <button
              onClick={() => navigate(`/tasks?status=${encodeURIComponent(selectedTaskStatus)}`)}
              className="text-xs text-[#635BFF] hover:underline font-semibold cursor-pointer"
            >
              Open in Tasks Page →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {activeFilteredTasksList.length === 0 ? (
              <p className="text-xs text-[var(--text-sec)] col-span-3 py-2">No tasks found for this status.</p>
            ) : (
              activeFilteredTasksList.slice(0, 6).map(t => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/tasks?taskId=${t.id}`)}
                  className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] hover:border-[#635BFF]/50 transition cursor-pointer"
                >
                  <p className="text-xs font-semibold text-[var(--text-main)] truncate">{t.title}</p>
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-sec)] mt-1">
                    <span>Priority: {t.priority}</span>
                    <span>Due: {t.dueDate || 'No date'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Lower Row: Recent Projects & Overdue/Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects Table */}
        <div className="lg:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-[var(--text-main)]">Recent Projects</h3>
            <button onClick={() => navigate('/projects')} className="text-xs text-[#635BFF] hover:underline cursor-pointer">
              Manage all →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[550px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-sec)] uppercase font-semibold text-[10px]">
                  <th className="pb-2.5">Project</th>
                  <th className="pb-2.5">Status</th>
                  <th className="pb-2.5">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="py-6 text-center text-[var(--text-sec)]">
                      No projects available. Create your first project to begin tracking.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.slice(0, 5).map(p => {
                    return (
                      <tr
                        key={p.id}
                        onClick={() => navigate(`/projects?projectId=${p.id}`)}
                        className="hover:bg-[var(--bg-main)] transition-colors cursor-pointer group"
                      >
                        <td className="py-3 font-semibold text-[var(--text-main)] group-hover:text-[#635BFF] max-w-xs truncate pr-4">
                          {p.name}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            p.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                            p.status === 'In Progress' ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' :
                            p.status === 'Overdue' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                            'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 text-[var(--text-sec)]">
                          {p.dueDate ? asDate(p.dueDate).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Announcements & Overdue Tasks */}
        <div className="space-y-6">
          {/* Overdue alerts */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-[var(--text-main)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#E05252]" />
                Overdue Tasks ({overdueTasks.length})
              </h3>
              {overdueTasks.length > 0 && (
                <button
                  onClick={() => navigate('/tasks?status=Overdue')}
                  className="text-xs text-[#E05252] hover:underline font-semibold cursor-pointer"
                >
                  View all →
                </button>
              )}
            </div>

            {overdueTasks.length === 0 ? (
              <p className="text-xs text-[var(--text-sec)] py-2">No overdue tasks. All deadlines honored!</p>
            ) : (
              <div className="space-y-2">
                {overdueTasks.slice(0, 4).map(ot => (
                  <div
                    key={ot.id}
                    onClick={() => navigate(`/tasks?taskId=${ot.id}`)}
                    className="p-2.5 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:border-rose-500/50 transition cursor-pointer"
                  >
                    <p className="text-xs font-semibold text-[var(--text-main)] truncate">{ot.title}</p>
                    <p className="text-[10px] text-rose-600 mt-0.5">Due: {ot.dueDate} • Priority: {ot.priority}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Announcements */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-[var(--text-main)]">Company Announcements</h3>
              <button
                onClick={() => navigate('/messages')}
                className="text-xs text-[#635BFF] hover:underline font-semibold cursor-pointer"
              >
                Discussions →
              </button>
            </div>
            {announcements.length === 0 ? (
              <p className="text-xs text-[var(--text-sec)] py-2">No recent announcements posted.</p>
            ) : (
              <div className="space-y-3">
                {announcements.slice(0, 3).map(ann => (
                  <div
                    key={ann.id}
                    onClick={() => navigate('/messages')}
                    className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] hover:border-[#635BFF]/40 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#635BFF]/10 text-[#635BFF]">
                        {ann.tag}
                      </span>
                      <span className="text-[10px] text-[var(--text-sec)]">{ann.date}</span>
                    </div>
                    <h4 className="text-xs font-bold text-[var(--text-main)]">{ann.title}</h4>
                    <p className="text-[11px] text-[var(--text-sec)] mt-1 line-clamp-2">{ann.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


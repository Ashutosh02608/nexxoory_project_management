import React from 'react';
import {
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users2,
  TrendingUp,
  ArrowUpRight,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
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
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboardPage() {
  const { projects, tasks, teams, users, announcements, events } = useApp();
  const navigate = useNavigate();

  // DERIVED DYNAMIC METRICS FROM REAL DATASETS
  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 'In Progress' || p.status === 'Planning').length;
  const completedProjects = projects.filter(p => p.status === 'Completed').length;
  const overdueProjects = projects.filter(p => p.status === 'Overdue' || (new Date(p.dueDate) < new Date() && p.status !== 'Completed')).length;
  const totalEmployees = users.length;
  const activeTeams = teams.length;

  // Task Status Distribution Chart Data
  const taskStatusCounts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.keys(taskStatusCounts).map(status => ({
    name: status,
    value: taskStatusCounts[status]
  }));

  const PIE_COLORS = {
    'Completed': '#16A36A',
    'In Progress': '#635BFF',
    'To Do': '#8B5CF6',
    'In Review': '#E9A23B',
    'Blocked': '#E05252',
    'Backlog': '#9AA0B2'
  };

  // Team Workload Data
  const teamWorkload = teams.map(team => {
    const teamTasks = tasks.filter(t => t.teamId === team.id);
    return {
      name: team.name.split(' ')[0],
      tasks: teamTasks.length,
      completed: teamTasks.filter(t => t.status === 'Completed').length
    };
  });

  // Project Completion progress
  const projectHealthData = projects.map(p => ({
    name: p.name.length > 12 ? p.name.substring(0, 10) + '...' : p.name,
    progress: p.progress,
    budgetSpentPercent: Math.round((p.spent / p.budget) * 100)
  }));

  // Overdue Tasks
  const overdueTasks = tasks.filter(t => t.status !== 'Completed' && new Date(t.dueDate) < new Date());

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-main)] shadow-xs transition-colors cursor-pointer"
          >
            <span>View All Projects</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-sec)] mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Projects</span>
            <FolderKanban className="w-4 h-4 text-[#635BFF]" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-main)]">{totalProjects}</p>
          <span className="text-[10px] text-[var(--text-sec)] mt-1 block">Tracked portfolio</span>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-sec)] mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active</span>
            <Clock className="w-4 h-4 text-[#635BFF]" />
          </div>
          <p className="text-2xl font-bold text-[#635BFF]">{activeProjects}</p>
          <span className="text-[10px] text-[var(--text-sec)] mt-1 block">In execution</span>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-sec)] mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-[#16A36A]" />
          </div>
          <p className="text-2xl font-bold text-[#16A36A]">{completedProjects}</p>
          <span className="text-[10px] text-[var(--text-sec)] mt-1 block">Shipped successfully</span>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-sec)] mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Overdue</span>
            <AlertTriangle className="w-4 h-4 text-[#E05252]" />
          </div>
          <p className="text-2xl font-bold text-[#E05252]">{overdueProjects}</p>
          <span className="text-[10px] text-[#E05252] mt-1 block">Needs attention</span>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-sec)] mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Employees</span>
            <Users2 className="w-4 h-4 text-[#8B5CF6]" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-main)]">{totalEmployees}</p>
          <span className="text-[10px] text-[var(--text-sec)] mt-1 block">Staff directory</span>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-sec)] mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Teams</span>
            <Layers className="w-4 h-4 text-[#E9A23B]" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-main)]">{activeTeams}</p>
          <span className="text-[10px] text-[var(--text-sec)] mt-1 block">Agile squads</span>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Health & Budget Progress */}
        <div className="lg:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm text-[var(--text-main)]">Project Progress vs Budget Utilization</h3>
              <p className="text-xs text-[var(--text-sec)]">Comparing actual completion percentage with budget drawdown</p>
            </div>
            <TrendingUp className="w-4 h-4 text-[#635BFF]" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectHealthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(140, 145, 160, 0.15)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-sec)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-sec)' }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'var(--text-main)'
                  }}
                />
                <Bar dataKey="progress" name="Progress %" fill="#635BFF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="budgetSpentPercent" name="Budget Spent %" fill="#E9A23B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Task Distribution Status Donut */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-[var(--text-main)]">Task Status Distribution</h3>
            <p className="text-xs text-[var(--text-sec)]">{tasks.length} total tasks tracked across all sprints</p>
          </div>

          <div className="h-52 w-full flex items-center justify-center my-2">
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
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name] || '#635BFF'} />
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
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[var(--border)]">
            {pieData.map(item => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[item.name] || '#635BFF' }} />
                <span className="text-[var(--text-sec)] truncate">{item.name}</span>
                <span className="font-semibold ml-auto text-[var(--text-main)]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-sec)] uppercase font-semibold text-[10px]">
                  <th className="pb-2.5">Project</th>
                  <th className="pb-2.5">Status</th>
                  <th className="pb-2.5">Progress</th>
                  <th className="pb-2.5">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {projects.slice(0, 4).map(p => (
                  <tr key={p.id} className="hover:bg-[var(--bg-main)] transition-colors">
                    <td className="py-3 font-semibold text-[var(--text-main)] max-w-xs truncate pr-4">
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
                    <td className="py-3 pr-4 w-36">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-[var(--border)] h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#635BFF] h-full rounded-full" style={{ width: `${p.progress}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-[var(--text-sec)]">{p.progress}%</span>
                      </div>
                    </td>
                    <td className="py-3 text-[var(--text-sec)]">
                      {p.dueDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Announcements & Overdue Tasks */}
        <div className="space-y-6">
          {/* Overdue alerts */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
            <h3 className="font-semibold text-sm text-[var(--text-main)] mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#E05252]" />
              Overdue Tasks ({overdueTasks.length})
            </h3>

            {overdueTasks.length === 0 ? (
              <p className="text-xs text-[var(--text-sec)] py-2">No overdue tasks. All deadlines honored!</p>
            ) : (
              <div className="space-y-2">
                {overdueTasks.map(ot => (
                  <div key={ot.id} className="p-2.5 rounded-lg border border-rose-500/20 bg-rose-500/5">
                    <p className="text-xs font-semibold text-[var(--text-main)] truncate">{ot.title}</p>
                    <p className="text-[10px] text-rose-600 mt-0.5">Due: {ot.dueDate} • Priority: {ot.priority}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Announcements */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
            <h3 className="font-semibold text-sm text-[var(--text-main)] mb-3">Company Announcements</h3>
            <div className="space-y-3">
              {announcements.map(ann => (
                <div key={ann.id} className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#635BFF]/10 text-[#635BFF]">
                      {ann.tag}
                    </span>
                    <span className="text-[10px] text-[var(--text-sec)]">{ann.date}</span>
                  </div>
                  <h4 className="text-xs font-bold text-[var(--text-main)]">{ann.title}</h4>
                  <p className="text-[11px] text-[var(--text-sec)] mt-1">{ann.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


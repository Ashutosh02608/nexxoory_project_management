import React from 'react';
import { BarChart3, Download, TrendingUp, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
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

export default function ReportsPage() {
  const { projects, tasks, teams, users } = useApp();

  // Export CSV simulation using actual mock state
  const handleExportCSV = () => {
    const headers = 'ID,Name,Status,Priority,Progress,Budget,DueDate\n';
    const rows = projects.map(p =>
      `"${p.id}","${p.name}","${p.status}","${p.priority}",${p.progress},${p.budget},"${p.dueDate}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexxoory_portfolio_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Performance breakdown
  const teamPerformance = teams.map(t => {
    const tTasks = tasks.filter(task => task.teamId === t.id);
    const completed = tTasks.filter(task => task.status === 'Completed').length;
    return {
      team: t.name.split(' ')[0],
      totalTasks: tTasks.length,
      completionRate: tTasks.length > 0 ? Math.round((completed / tTasks.length) * 100) : 0
    };
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">Executive Reports & Intelligence</h1>
          <p className="text-xs sm:text-sm text-[var(--text-sec)] mt-0.5">
            Cross-department velocity, milestone burn-up curves, and CSV audit downloads.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 bg-[#16A36A] hover:bg-[#128354] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export Portfolio CSV</span>
        </button>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Completion Rate */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
          <h3 className="font-bold text-sm text-[var(--text-main)] mb-1">Squad Velocity & Completion (%)</h3>
          <p className="text-xs text-[var(--text-sec)] mb-4">Percentage of delivered deliverables by cross-functional team</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(140, 145, 160, 0.15)" />
                <XAxis dataKey="team" tick={{ fontSize: 11, fill: 'var(--text-sec)' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-sec)' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="completionRate" name="Completion Rate (%)" fill="#635BFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Budget vs Allocation Table */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
          <h3 className="font-bold text-sm text-[var(--text-main)] mb-1">Financial Allocation & Burn</h3>
          <p className="text-xs text-[var(--text-sec)] mb-4">Capital drawdown against planned project budgets</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-sec)] uppercase font-semibold text-[10px]">
                  <th className="pb-2">Project</th>
                  <th className="pb-2">Budget</th>
                  <th className="pb-2">Utilized</th>
                  <th className="pb-2 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {projects.map(p => {
                  const variance = p.budget - (p.spent || 0);
                  return (
                    <tr key={p.id}>
                      <td className="py-2.5 font-semibold text-[var(--text-main)]">{p.name}</td>
                      <td className="py-2.5">${p.budget?.toLocaleString()}</td>
                      <td className="py-2.5">${(p.spent || 0).toLocaleString()}</td>
                      <td className={`py-2.5 text-right font-bold ${variance < 0 ? 'text-[#E05252]' : 'text-[#16A36A]'}`}>
                        ${variance.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


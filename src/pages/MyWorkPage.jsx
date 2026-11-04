import React, { useState } from 'react';
import { CheckSquare, Clock, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getInitials } from '../utils/avatar';
import { ScopeRules } from '../config/rbac';

export default function MyWorkPage() {
  const { currentUser, tasks, projects, teams, updateTask } = useApp();

  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks', 'projects', 'history'

  // Current user's scoped tasks and projects via centralized ScopeRules
  const myProjects = ScopeRules.filterProjects(projects, currentUser, teams);
  const myTasks = ScopeRules.filterTasks(tasks, currentUser, teams, myProjects);

  const pendingTasks = myTasks.filter(t => t.status !== 'Completed');
  const completedTasks = myTasks.filter(t => t.status === 'Completed');
  const overdueTasks = myTasks.filter(t => t.status !== 'Completed' && new Date(t.dueDate) < new Date());

  const handleUpdateStatus = (task, newStatus) => {
    updateTask({
      ...task,
      status: newStatus,
      progress: newStatus === 'Completed' ? 100 : task.progress
    });
  };

  const handleUpdateProgress = (task, newProgress) => {
    updateTask({
      ...task,
      progress: Number(newProgress),
      status: Number(newProgress) === 100 ? 'Completed' : task.status
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Personalized Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#1E6091] text-white text-sm font-bold flex items-center justify-center shrink-0 border-2 border-[#1E6091] tracking-wider">
            {getInitials(currentUser?.name)}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">My Workspace</h1>
            <p className="text-xs sm:text-sm text-[var(--text-sec)]">
              Welcome back, {currentUser?.name} ({currentUser?.designation})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs">
            <span className="text-[var(--text-sec)] mr-1.5">Efficiency Score:</span>
            <span className="font-bold text-[#16A36A]">98.4%</span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-sec)] mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Assigned Tasks</span>
            <CheckSquare className="w-4 h-4 text-[#635BFF]" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-main)]">{myTasks.length}</p>
          <span className="text-[10px] text-[var(--text-sec)]">{pendingTasks.length} pending action</span>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-sec)] mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-[#16A36A]" />
          </div>
          <p className="text-2xl font-bold text-[#16A36A]">{completedTasks.length}</p>
          <span className="text-[10px] text-[var(--text-sec)]">Successfully resolved</span>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-sec)] mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Overdue</span>
            <AlertTriangle className="w-4 h-4 text-[#E05252]" />
          </div>
          <p className="text-2xl font-bold text-[#E05252]">{overdueTasks.length}</p>
          <span className="text-[10px] text-[#E05252]">Immediate focus</span>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-sec)] mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">My Projects</span>
            <Clock className="w-4 h-4 text-[#8B5CF6]" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-main)]">{myProjects.length}</p>
          <span className="text-[10px] text-[var(--text-sec)]">Assigned portfolios</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] space-x-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${activeTab === 'tasks' ? 'border-[#635BFF] text-[#635BFF]' : 'border-transparent text-[var(--text-sec)] hover:text-[var(--text-main)]'}`}
        >
          My Tasks ({pendingTasks.length})
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${activeTab === 'projects' ? 'border-[#635BFF] text-[#635BFF]' : 'border-transparent text-[var(--text-sec)] hover:text-[var(--text-main)]'}`}
        >
          My Projects ({myProjects.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${activeTab === 'history' ? 'border-[#635BFF] text-[#635BFF]' : 'border-transparent text-[var(--text-sec)] hover:text-[var(--text-main)]'}`}
        >
          Completed Work ({completedTasks.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          {pendingTasks.length === 0 ? (
            <div className="text-center py-12 bg-[var(--surface)] border border-[var(--border)] rounded-2xl">
              <CheckCircle2 className="w-10 h-10 text-[#16A36A] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[var(--text-main)]">Inbox zero! No pending tasks.</p>
              <p className="text-xs text-[var(--text-sec)] mt-1">Great job keeping your assignments clear.</p>
            </div>
          ) : (
            pendingTasks.map(t => (
              <div
                key={t.id}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#635BFF]/10 text-[#635BFF]">
                      {t.priority}
                    </span>
                    <span className="text-xs text-[var(--text-sec)]">Due: {t.dueDate}</span>
                  </div>
                  <h3 className="font-bold text-sm text-[var(--text-main)]">{t.title}</h3>
                  <p className="text-xs text-[var(--text-sec)] mt-0.5">{t.description}</p>
                </div>

                <div className="flex items-center gap-4">
                  {/* Progress slider */}
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={t.progress}
                      onChange={(e) => handleUpdateProgress(t, e.target.value)}
                      className="w-24 accent-[#635BFF]"
                    />
                    <span className="text-xs font-bold w-9 text-right">{t.progress}%</span>
                  </div>

                  {/* Status update select */}
                  <select
                    value={t.status}
                    onChange={(e) => handleUpdateStatus(t, e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] font-semibold outline-none cursor-pointer"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="In Review">In Review</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myProjects.map(p => (
            <div key={p.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[#635BFF]">{p.status}</span>
                <span className="text-xs text-[var(--text-sec)]">Due {p.dueDate}</span>
              </div>
              <h3 className="font-bold text-sm text-[var(--text-main)]">{p.name}</h3>
              <p className="text-xs text-[var(--text-sec)] mt-1">{p.description}</p>
              <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
                <span>Progress</span>
                <span className="font-semibold text-[#635BFF]">{p.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-2">
          {completedTasks.map(t => (
            <div key={t.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#16A36A]" />
                <span className="text-xs font-semibold text-[var(--text-main)]">{t.title}</span>
              </div>
              <span className="text-[10px] text-[var(--text-sec)]">Completed on {t.dueDate}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


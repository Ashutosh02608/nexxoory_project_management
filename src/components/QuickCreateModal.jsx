import React, { useState } from 'react';
import { X, FolderKanban, ListTodo, Users, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function QuickCreateModal() {
  const { quickCreateOpen, setQuickCreateOpen, updateProject, updateTask, updateTeam, projects, users } = useApp();
  const [tab, setTab] = useState('task'); // 'task', 'project', 'team'

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskProjectId, setTaskProjectId] = useState(projects[0]?.id || '');
  const [taskAssigneeId, setTaskAssigneeId] = useState(users[0]?.id || '');
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [taskDueDate, setTaskDueDate] = useState('');

  // Project form state
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projPriority, setProjPriority] = useState('Medium');
  const [projBudget, setProjBudget] = useState(50000);
  const [projDueDate, setProjDueDate] = useState('');

  // Team form state
  const [teamName, setTeamName] = useState('');
  const [teamDept, setTeamDept] = useState('Frontend Core');
  const [teamLeader, setTeamLeader] = useState(users[0]?.id || '');

  if (!quickCreateOpen) return null;

  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!taskTitle) return;
    updateTask({
      title: taskTitle,
      projectId: taskProjectId,
      assigneeId: taskAssigneeId,
      priority: taskPriority,
      status: 'To Do',
      dueDate: taskDueDate || '2026-11-30',
      startDate: new Date().toISOString().split('T')[0],
      progress: 0,
      labels: ['General'],
      subtasks: [],
      comments: []
    });
    setTaskTitle('');
    setQuickCreateOpen(false);
  };

  const handleCreateProject = (e) => {
    e.preventDefault();
    if (!projName) return;
    updateProject({
      name: projName,
      description: projDesc || 'Newly initiated Nexxoory enterprise solution track.',
      managerId: users[0]?.id || 'usr-admin',
      priority: projPriority,
      status: 'Planning',
      startDate: new Date().toISOString().split('T')[0],
      dueDate: projDueDate || '2026-12-31',
      progress: 0,
      budget: Number(projBudget) || 50000,
      spent: 0,
      tags: ['General', 'Sprint']
    });
    setProjName('');
    setProjDesc('');
    setQuickCreateOpen(false);
  };

  const handleCreateTeam = (e) => {
    e.preventDefault();
    if (!teamName) return;
    updateTeam({
      name: teamName,
      department: teamDept,
      leaderId: teamLeader,
      description: 'Specialized agile delivery group.',
      memberIds: [teamLeader],
      projectIds: []
    });
    setTeamName('');
    setQuickCreateOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#635BFF]" />
            <h3 className="font-semibold text-sm text-[var(--text-main)]">Quick Create</h3>
          </div>
          <button onClick={() => setQuickCreateOpen(false)} className="p-1 rounded-md text-[var(--text-sec)] hover:bg-[var(--bg-main)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-[var(--border)] bg-[var(--bg-main)] p-1 gap-1">
          <button
            onClick={() => setTab('task')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'task' ? 'bg-[var(--surface)] text-[#635BFF] shadow-xs' : 'text-[var(--text-sec)] hover:text-[var(--text-main)]'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" /> Task
          </button>
          <button
            onClick={() => setTab('project')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'project' ? 'bg-[var(--surface)] text-[#635BFF] shadow-xs' : 'text-[var(--text-sec)] hover:text-[var(--text-main)]'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" /> Project
          </button>
          <button
            onClick={() => setTab('team')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'team' ? 'bg-[var(--surface)] text-[#635BFF] shadow-xs' : 'text-[var(--text-sec)] hover:text-[var(--text-main)]'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Team
          </button>
        </div>

        {/* Content body */}
        <div className="p-5">
          {tab === 'task' && (
            <form onSubmit={handleCreateTask} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement token refresh policy"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none focus:border-[#635BFF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Associated Project</label>
                  <select
                    value={taskProjectId}
                    onChange={(e) => setTaskProjectId(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Assignee</label>
                  <select
                    value={taskAssigneeId}
                    onChange={(e) => setTaskAssigneeId(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none"
                  >
                  </input>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickCreateOpen(false)}
                  className="px-3 py-1.5 text-xs text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-[#635BFF] hover:bg-[#4942D9] text-white font-medium rounded-lg shadow-sm"
                >
                  Create Task
                </button>
              </div>
            </form>
          )}

          {tab === 'project' && (
            <form onSubmit={handleCreateProject} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Next-Gen Mobile App"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none focus:border-[#635BFF]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Objectives and scope summary..."
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none focus:border-[#635BFF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Budget ($)</label>
                  <input
                    type="number"
                    value={projBudget}
                    onChange={(e) => setProjBudget(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Target Due Date</label>
                  <input
                    type="date"
                    value={projDueDate}
                    onChange={(e) => setProjDueDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickCreateOpen(false)}
                  className="px-3 py-1.5 text-xs text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-[#635BFF] hover:bg-[#4942D9] text-white font-medium rounded-lg shadow-sm"
                >
                  Launch Project
                </button>
              </div>
            </form>
          )}

          {tab === 'team' && (
            <form onSubmit={handleCreateTeam} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Team Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cloud Operations Group"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none focus:border-[#635BFF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Department</label>
                  <select
                    value={teamDept}
                    onChange={(e) => setTeamDept(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none"
                  >
                    <option value="Frontend Core">Frontend Core</option>
                    <option value="DevOps & Infrastructure">DevOps & Infrastructure</option>
                    <option value="Design Studio">Design Studio</option>
                    <option value="Product Delivery">Product Delivery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Team Leader</label>
                  <select
                    value={teamLeader}
                    onChange={(e) => setTeamLeader(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickCreateOpen(false)}
                  className="px-3 py-1.5 text-xs text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-[#635BFF] hover:bg-[#4942D9] text-white font-medium rounded-lg shadow-sm"
                >
                  Form Team
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}


import React, { useState } from 'react';
import {
  ListTodo,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  MoreVertical,
  Edit2,
  Trash2,
  User,
  Calendar,
  Layers,
  ChevronDown,
  X,
  MessageSquare
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const COLUMNS = [
  { id: 'Backlog', label: 'Backlog', color: '#9AA0B2' },
  { id: 'To Do', label: 'To Do', color: '#8B5CF6' },
  { id: 'In Progress', label: 'In Progress', color: '#635BFF' },
  { id: 'In Review', label: 'In Review', color: '#E9A23B' },
  { id: 'Blocked', label: 'Blocked', color: '#E05252' },
  { id: 'Completed', label: 'Completed', color: '#16A36A' }
];

export default function TasksPage() {
  const { tasks, updateTask, removeTask, projects, users, teams, currentUser, permissions } = useApp();

  const [viewMode, setViewMode] = useState('kanban'); // 'kanban', 'list', 'table'
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Modal / Drawer state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeTaskDrawer, setActiveTaskDrawer] = useState(null);
  const [commentInput, setCommentInput] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: '',
    assigneeId: '',
    teamId: '',
    priority: 'Medium',
    status: 'To Do',
    startDate: '',
    dueDate: '',
    progress: 0,
    labels: 'Frontend'
  });

  const openCreateModal = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      projectId: projects[0]?.id || '',
      assigneeId: users[0]?.id || '',
      teamId: teams[0]?.id || '',
      priority: 'Medium',
      status: 'To Do',
      startDate: new Date().toISOString().split('T')[0],
      dueDate: '2026-11-20',
      progress: 0,
      labels: 'Core, Sprint'
    });
    setModalOpen(true);
  };

  const openEditModal = (t) => {
    setEditingTask(t);
    setFormData({
      ...t,
      labels: Array.isArray(t.labels) ? t.labels.join(', ') : t.labels || ''
    });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      id: editingTask ? editingTask.id : undefined,
      progress: Number(formData.progress) || 0,
      labels: typeof formData.labels === 'string' ? formData.labels.split(',').map(s => s.trim()).filter(Boolean) : formData.labels,
      subtasks: editingTask ? editingTask.subtasks : [],
      comments: editingTask ? editingTask.comments : []
    };
    updateTask(payload);
    setModalOpen(false);
  };

  // Drag and drop handlers for Kanban columns
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== targetStatus) {
      updateTask({
        ...task,
        status: targetStatus,
        progress: targetStatus === 'Completed' ? 100 : task.progress
      });
    }
  };

  // Comment adding
  const handleAddComment = (e) => {
    e.preventDefault();
    if (!commentInput.trim() || !activeTaskDrawer) return;
    const newComment = {
      id: `c-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      text: commentInput,
      timestamp: 'Just now'
    };
    const updated = {
      ...activeTaskDrawer,
      comments: [...(activeTaskDrawer.comments || []), newComment]
    };
    updateTask(updated);
    setActiveTaskDrawer(updated);
    setCommentInput('');
  };

  // Subtask toggling
  const handleToggleSubtask = (subId) => {
    if (!activeTaskDrawer) return;
    const subtasks = activeTaskDrawer.subtasks.map(s => s.id === subId ? { ...s, completed: !s.completed } : s);
    const completedCount = subtasks.filter(s => s.completed).length;
    const progress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : activeTaskDrawer.progress;

    const updated = {
      ...activeTaskDrawer,
      subtasks,
      progress,
      status: progress === 100 ? 'Completed' : activeTaskDrawer.status
    };
    updateTask(updated);
    setActiveTaskDrawer(updated);
  };

  // Filters
  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase()));
    const matchesProject = projectFilter === 'ALL' || t.projectId === projectFilter;
    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
    return matchesSearch && matchesProject && matchesPriority;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">Tasks Management</h1>
          <p className="text-xs sm:text-sm text-[var(--text-sec)] mt-0.5">
            Track backlogs, drag & drop sprint workflows, assign workloads, and post updates.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-[#635BFF] hover:bg-[#4942D9] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Control Bar: Filters, Search, View Mode */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[var(--text-sec)]" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-[var(--text-main)] outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Project filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
          >
            <option value="ALL">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>

          {/* View Toggles */}
          <div className="flex items-center border border-[var(--border)] rounded-lg p-0.5 bg-[var(--bg-main)]">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${viewMode === 'kanban' ? 'bg-[var(--surface)] text-[#635BFF] shadow-xs' : 'text-[var(--text-sec)]'}`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${viewMode === 'list' ? 'bg-[var(--surface)] text-[#635BFF] shadow-xs' : 'text-[var(--text-sec)]'}`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Board View with Drag & Drop */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4 select-none">
          {COLUMNS.map(col => {
            const columnTasks = filteredTasks.filter(t => t.status === col.id);
            return (
              <div
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
                className="w-72 shrink-0 bg-[var(--bg-main)] border border-[var(--border)] rounded-2xl flex flex-col max-h-[calc(100vh-16rem)]"
              >
                {/* Column Header */}
                <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="font-bold text-xs text-[var(--text-main)]">{col.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-sec)] font-semibold">
                      {columnTasks.length}
                    </span>
                  </div>
                </div>

                {/* Task Cards Column */}
                <div className="p-2 space-y-2.5 overflow-y-auto flex-1">
                  {columnTasks.map(task => {
                    const assignee = users.find(u => u.id === task.assigneeId);
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onClick={() => setActiveTaskDrawer(task)}
                        className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3.5 shadow-xs hover:border-[#635BFF] cursor-grab active:cursor-grabbing transition-all space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                            task.priority === 'Urgent' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                            task.priority === 'High' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                            'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
                          }`}>
                            {task.priority}
                          </span>
                          <span className="text-[10px] text-[var(--text-sec)]">Due {task.dueDate.substring(5)}</span>
                        </div>

                        <h4 className="font-semibold text-xs text-[var(--text-main)] line-clamp-2">{task.title}</h4>

                        {/* Progress */}
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-[var(--text-sec)] mb-1">
                            <span>Progress</span>
                            <span className="font-semibold">{task.progress}%</span>
                          </div>
                          <div className="w-full bg-[var(--border)] h-1 rounded-full overflow-hidden">
                            <div className="bg-[#635BFF] h-full rounded-full" style={{ width: `${task.progress}%` }} />
                          </div>
                        </div>

                        {/* Card footer */}
                        <div className="flex items-center justify-between pt-1 border-t border-[var(--border)] text-[10px] text-[var(--text-sec)]">
                          <div className="flex items-center gap-1.5">
                            {assignee ? (
                              <img src={assignee.avatar} alt={assignee.name} className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                            <span className="truncate max-w-[80px]">{assignee?.name.split(' ')[0] || 'Unassigned'}</span>
                          </div>

                          {(task.subtasks?.length > 0 || task.comments?.length > 0) && (
                            <div className="flex items-center gap-2">
                              {task.subtasks?.length > 0 && <span>✓ {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}</span>}
                              {task.comments?.length > 0 && <span className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3" /> {task.comments.length}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-main)] border-b border-[var(--border)] text-[var(--text-sec)] uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-4">Task</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Assignee</th>
                <th className="py-3 px-4">Progress</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredTasks.map(t => {
                const assignee = users.find(u => u.id === t.assigneeId);
                return (
                  <tr key={t.id} className="hover:bg-[var(--bg-main)] transition-colors">
                    <td className="py-3 px-4 font-semibold text-[var(--text-main)]">
                      <button onClick={() => setActiveTaskDrawer(t)} className="hover:text-[#635BFF] cursor-pointer text-left">
                        {t.title}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-sec)]">
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-[11px]">{t.priority}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {assignee && <img src={assignee.avatar} alt={assignee.name} className="w-5 h-5 rounded-full object-cover" />}
                        <span>{assignee?.name || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 w-36">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-[var(--border)] h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#635BFF] h-full rounded-full" style={{ width: `${t.progress}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-[var(--text-sec)]">{t.progress}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-sec)]">{t.dueDate}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditModal(t)} className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete task "${t.title}"?`)) removeTask(t.id);
                          }}
                          className="p-1 rounded text-[var(--text-sec)] hover:text-[#E05252] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Task Detail Drawer */}
      {activeTaskDrawer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
          <div className="bg-[var(--surface)] border-l border-[var(--border)] w-full max-w-lg h-full shadow-2xl flex flex-col p-6 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#635BFF]">Task Drawer</span>
              <button onClick={() => setActiveTaskDrawer(null)} className="p-1 rounded hover:bg-[var(--bg-main)] text-[var(--text-sec)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 flex-1">
              <div>
                <h3 className="text-base font-bold text-[var(--text-main)]">{activeTaskDrawer.title}</h3>
                <p className="text-xs text-[var(--text-sec)] mt-1">{activeTaskDrawer.description || 'No description provided.'}</p>
              </div>

              {/* Status and priority chips */}
              <div className="flex flex-wrap gap-2 text-xs">
                <div className="px-2.5 py-1 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                  <span className="text-[var(--text-sec)] text-[10px] block">Status</span>
                  <select
                    value={activeTaskDrawer.status}
                    onChange={(e) => {
                      const updated = { ...activeTaskDrawer, status: e.target.value };
                      updateTask(updated);
                      setActiveTaskDrawer(updated);
                    }}
                    className="bg-transparent font-semibold text-[var(--text-main)] outline-none"
                  >
                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>

                <div className="px-2.5 py-1 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                  <span className="text-[var(--text-sec)] text-[10px] block">Progress</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={activeTaskDrawer.progress}
                    onChange={(e) => {
                      const updated = { ...activeTaskDrawer, progress: Number(e.target.value) };
                      updateTask(updated);
                      setActiveTaskDrawer(updated);
                    }}
                    className="w-24 accent-[#635BFF]"
                  />
                  <span className="ml-2 font-bold text-[11px]">{activeTaskDrawer.progress}%</span>
                </div>
              </div>

              {/* Subtasks Section */}
              <div className="pt-3 border-t border-[var(--border)]">
                <h4 className="text-xs font-bold text-[var(--text-main)] mb-2">Checklist & Subtasks</h4>
                {activeTaskDrawer.subtasks?.length === 0 ? (
                  <p className="text-xs text-[var(--text-sec)]">No checklist items defined.</p>
                ) : (
                  <div className="space-y-1.5">
                    {activeTaskDrawer.subtasks?.map(sub => (
                      <div
                        key={sub.id}
                        onClick={() => handleToggleSubtask(sub.id)}
                        className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-main)] hover:bg-[var(--border)] cursor-pointer text-xs transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={sub.completed}
                          onChange={() => {}}
                          className="rounded text-[#635BFF] cursor-pointer"
                        />
                        <span className={sub.completed ? 'line-through text-[var(--text-sec)]' : 'text-[var(--text-main)]'}>
                          {sub.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments Section */}
              <div className="pt-3 border-t border-[var(--border)]">
                <h4 className="text-xs font-bold text-[var(--text-main)] mb-2">Discussion Activity</h4>
                <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                  {activeTaskDrawer.comments?.length === 0 ? (
                    <p className="text-xs text-[var(--text-sec)]">No comments yet. Start the conversation!</p>
                  ) : (
                    activeTaskDrawer.comments?.map(c => (
                      <div key={c.id} className="p-2.5 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-[var(--text-main)]">{c.userName}</span>
                          <span className="text-[10px] text-[var(--text-sec)]">{c.timestamp}</span>
                        </div>
                        <p className="text-[var(--text-sec)]">{c.text}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Comment Input */}
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Write a message..."
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  />
                  <button type="submit" className="px-3 py-2 text-xs font-semibold bg-[#635BFF] text-white rounded-lg hover:bg-[#4942D9] cursor-pointer">
                    Post
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <h3 className="font-bold text-base text-[var(--text-main)]">
                {editingTask ? 'Edit Task' : 'Create New Task'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Description</label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Project</label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  >
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Assignee</label>
                  <select
                    value={formData.assigneeId}
                    onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  >
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  />
                </div>
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
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


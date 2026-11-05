import React, { useRef, useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  FolderKanban,
  Search,
  Plus,
  LayoutGrid,
  List,
  Table as TableIcon,
  Trash2,
  Edit2,
  Eye,
  X,
  Loader2,
  CheckCircle2,
  Check,
  Layers
} from 'lucide-react';
import { useApp } from '../context/useApp';
import { getInitials } from '../utils/avatar';
import { ScopeRules } from '../config/rbac';
import ContentSchedule, { ContentFields } from '../components/ContentSchedule';
import AgencyWorkspaceHeader from '../components/AgencyWorkspaceHeader';
import { editableContent } from '../utils/contentFields';
import { getProjectDeliverables, isSocialProject } from '../../shared/delivery';
import { projectTypes, deliverySchedules } from '../../shared/serviceTypes';

export default function ProjectsPage() {
  const { projects, tasks, updateProject, updateTask, removeProject, users, teams, currentUser, permissions } = useApp();
  const [searchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState('content');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [detailsProject, setDetailsProject] = useState(null);
  const [updatingDeliverableId, setUpdatingDeliverableId] = useState(null);
  const [deliverableActionMsg, setDeliverableActionMsg] = useState('');
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Synchronize URL search params
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const statusParam = searchParams.get('status');
      if (statusParam) setStatusFilter(statusParam);
      const projectIdParam = searchParams.get('projectId');
      if (projectIdParam && projects.length > 0) {
        const match = projects.find(p => p.id === projectIdParam);
        if (match) setDetailsProject(match);
      }
    });
    return () => { active = false; };
  }, [searchParams, projects]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    managerId: '',
    teamId: '',
    priority: 'Medium',
    status: 'In Progress',
    startDate: '',
    dueDate: '',
    progress: 0,
    tags: 'Frontend, React'
  });

  const handleMarkDeliverableDone = React.useCallback(async (deliverableItem, projectObj) => {
    if (updatingDeliverableId) return;
    setUpdatingDeliverableId(deliverableItem.id);
    setDeliverableActionMsg('');
    try {
      const isSocial = isSocialProject(projectObj.content);
      const todayDate = new Date().toISOString().slice(0, 10);
      const taskObj = deliverableItem.task;
      const prevContent = taskObj?.content || {};
      const targetContentType = isSocial && !['Post', 'Reel', 'AI Reel'].includes(prevContent.contentType)
        ? deliverableItem.type
        : prevContent.contentType;

      const contentUpdates = isSocial
        ? {
            ...prevContent,
            ...(targetContentType ? { contentType: targetContentType } : {}),
            designStatus: 'Completed',
            approvalStatus: 'Approved',
            postStatus: 'Published',
            publishedDate: prevContent.publishedDate || todayDate
          }
        : {
            ...prevContent,
            designStatus: 'Completed',
            designDate: prevContent.designDate || todayDate
          };

      await updateTask({
        id: deliverableItem.id,
        status: 'Completed',
        progress: 100,
        content: contentUpdates
      });
      setDeliverableActionMsg(`Deliverable "${deliverableItem.name}" delivered!`);
    } catch (err) {
      setDeliverableActionMsg(`Error: ${err.message || 'Could not update'}`);
    } finally {
      setUpdatingDeliverableId(null);
    }
  }, [updatingDeliverableId, updateTask]);

  const openCreateModal = () => {
    setEditingProject(null);
    setSubmitError('');
    setFormData({
      name: '',
      description: '',
      projectType: 'Social Media Marketing',
      managerId: users[0]?.id || '',
      teamId: teams[0]?.id || '',
      priority: 'Medium',
      status: 'In Progress',
      startDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      progress: 0,
      tags: 'Frontend, Design',
      content: { projectType: 'Social Media Marketing' }
    });
    setModalOpen(true);
  };

  const openEditModal = (p) => {
    setEditingProject(p);
    setSubmitError('');
    setFormData({
      ...p,
      projectType: p.content?.projectType || 'Other',
      tags: Array.isArray(p.tags) ? p.tags.join(', ') : p.tags || '',
      content: { ...p.content, projectType: p.content?.projectType || 'Other' }
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        ...formData,
        content: editableContent(formData.content, true),
        id: editingProject ? editingProject.id : undefined,
        budget: 0,
        progress: Number(formData.progress) || 0,
        spent: 0,
        tags: typeof formData.tags === 'string' ? formData.tags.split(',').map(s => s.trim()).filter(Boolean) : formData.tags
      };

      await updateProject(payload);
      setModalOpen(false);
    } catch (err) {
      setSubmitError(err.message || 'Failed to save project');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Scoped projects based on user role and assignment
  const scopedProjects = ScopeRules.filterProjects(projects, currentUser, teams);

  // Filtered projects
  const filtered = scopedProjects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || p.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="agency-workspace space-y-6 max-w-7xl mx-auto">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <AgencyWorkspaceHeader project />
        </div>

        {permissions.canCreateProject && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-[#635BFF] hover:bg-[#4942D9] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        )}
      </div>

      {/* Control Bar: Filters, Search, Views */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[var(--text-sec)]" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-[var(--text-main)] outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status select */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="In Progress">In Progress</option>
            <option value="In Review">In Review</option>
            <option value="Completed">Completed</option>
            <option value="Planning">Planning</option>
            <option value="Overdue">Overdue</option>
          </select>

          {/* Priority select */}
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
            <button aria-pressed={viewMode === 'content'} className={`px-3 py-1.5 text-xs font-semibold rounded-md ${viewMode === 'content' ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs' : 'text-[var(--text-sec)]'}`} onClick={() => setViewMode('content')}>Content</button>
            <button
              onClick={() => setViewMode('grid')}
              aria-label="Project grid view"
              className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-[var(--surface)] text-[#635BFF] shadow-xs' : 'text-[var(--text-sec)]'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              aria-label="Project list view"
              className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-[var(--surface)] text-[#635BFF] shadow-xs' : 'text-[var(--text-sec)]'}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              aria-label="Project table view"
              className={`p-1.5 rounded-md ${viewMode === 'table' ? 'bg-[var(--surface)] text-[#635BFF] shadow-xs' : 'text-[var(--text-sec)]'}`}
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'content' && <ContentSchedule projectMode />}
      {viewMode === 'grid' && (
        filtered.length === 0 ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-12 text-center">
            <FolderKanban className="w-10 h-10 text-[var(--text-sec)] mx-auto mb-3 opacity-40" />
            <h3 className="font-bold text-sm text-[var(--text-main)]">No projects found</h3>
            <p className="text-xs text-[var(--text-sec)] mt-1 mb-4">Get started by creating your first enterprise project.</p>
            {permissions.canCreateProject && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 bg-[#635BFF] hover:bg-[#4942D9] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Project</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(p => {
            const manager = users.find(u => u.id === p.managerId);
            const team = teams.find(t => t.id === p.teamId);
            const deliveryInfo = getProjectDeliverables(p, tasks);
            return (
              <div
                key={p.id}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs hover:border-[#635BFF]/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      p.priority === 'Urgent' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                      p.priority === 'High' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                      'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
                    }`}>
                      {p.priority} Priority
                    </span>
                    <span className="text-[10px] text-[var(--text-sec)]">{p.status}</span>
                  </div>

                  <h3
                    onClick={() => setDetailsProject(p)}
                    className="font-bold text-base text-[var(--text-main)] hover:text-[#635BFF] cursor-pointer transition-colors"
                  >
                    {p.name}
                  </h3>
                  <p className="text-xs text-[var(--text-sec)] mt-1.5 line-clamp-2">{p.description}</p>

                  {/* Delivery Status Info */}
                  <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
                    <span className="text-[var(--text-sec)] text-[11px]">Deliverables</span>
                    <span className="font-semibold text-[var(--text-main)]">
                      {deliveryInfo.completed} / {deliveryInfo.total} delivered
                    </span>
                  </div>

                  {/* Meta details */}
                  <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-sec)]">
                    <span>Due: {p.dueDate}</span>
                    <span className="font-semibold text-[#635BFF]">{p.priority} Priority</span>
                  </div>
                </div>

                {/* Footer with avatars & actions */}
                <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {manager && (
                      <div
                        title={`Manager: ${manager.name}`}
                        className="w-6 h-6 rounded-full bg-[#1E6091] text-white text-[10px] font-bold flex items-center justify-center shrink-0 border border-[#1E6091] tracking-wider"
                      >
                        {getInitials(manager.name)}
                      </div>
                    )}
                    <span className="text-[11px] text-[var(--text-sec)] truncate max-w-[120px]">
                      {team ? team.name : 'Unassigned'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDetailsProject(p)}
                      title="View Details"
                      className="p-1.5 rounded-lg text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {permissions.canEditProject(p) && (
                      <button
                        onClick={() => openEditModal(p)}
                        title="Edit Project"
                        className="p-1.5 rounded-lg text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {permissions.isAdmin && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete project "${p.name}"?`)) removeProject(p.id);
                        }}
                        title="Delete Project"
                        className="p-1.5 rounded-lg text-[var(--text-sec)] hover:text-[#E05252] hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )
      )}

      {/* List / Table View */}
      {(viewMode === 'list' || viewMode === 'table') && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-main)] border-b border-[var(--border)] text-[var(--text-sec)] uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Project Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-[var(--bg-main)] transition-colors">
                    <td className="py-3 px-4 font-semibold text-[var(--text-main)]">
                      <button onClick={() => setDetailsProject(p)} className="hover:text-[#635BFF] cursor-pointer text-left">
                        {p.name}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-sec)]">
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-medium">{p.priority}</span>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-sec)]">{p.dueDate}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDetailsProject(p)}
                          className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {permissions.canEditProject(p) && (
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {permissions.isAdmin && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete project "${p.name}"?`)) removeProject(p.id);
                            }}
                            className="p-1 rounded text-[var(--text-sec)] hover:text-[#E05252] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Project Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-label={editingProject ? 'Edit project' : 'Create project'} className="workflow-form-dialog bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <h3 className="font-bold text-base text-[var(--text-main)]">
                {editingProject ? 'Edit Project' : 'Create New Project'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && <p role="alert">{submitError}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Project Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[#635BFF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Project Type</label>
                  <select
                    value={formData.content?.projectType || formData.projectType || 'Other'}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setFormData({
                        ...formData,
                        projectType: newType,
                        content: { ...(formData.content || {}), projectType: newType }
                      });
                    }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[#635BFF]"
                  >
                    {projectTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Delivery Schedule</label>
                <select
                  value={formData.content?.deliverySchedule || 'Monthly Deliverables'}
                  onChange={(e) => {
                    const newSched = e.target.value;
                    setFormData({
                      ...formData,
                      content: { ...(formData.content || {}), deliverySchedule: newSched }
                    });
                  }}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[#635BFF]"
                >
                  {deliverySchedules.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Description</label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[#635BFF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Project Manager</label>
                  <select
                    value={formData.managerId}
                    onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Assigned Team</label>
                  <select
                    value={formData.teamId}
                    onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  >
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  >
                    <option value="Planning">Planning</option>
                    <option value="In Progress">In Progress</option>
                    <option value="In Review">In Review</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
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
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Progress %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.progress}
                    onChange={(e) => setFormData({ ...formData, progress: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  />
                </div>
              </div>

              <ContentFields project value={formData.content} onChange={content => setFormData({ ...formData, content })} />
              <div className="workflow-form-actions pt-3 border-t border-[var(--border)] flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs bg-[#635BFF] hover:bg-[#4942D9] text-white font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-70 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Project</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Details Drawer/Modal */}
      {detailsProject && (() => {
        const dInfo = getProjectDeliverables(detailsProject, tasks);
        return (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#635BFF] tracking-wider">Project Specification & Delivery</span>
                  <h3 className="font-bold text-lg text-[var(--text-main)]">{detailsProject.name}</h3>
                  <p className="text-xs text-[var(--text-sec)]">
                    Service: {detailsProject.content?.projectType || 'Other'} · Client: {detailsProject.content?.clientName || '—'}
                  </p>
                </div>
                <button onClick={() => setDetailsProject(null)} className="p-1 text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {deliverableActionMsg && (
                <p role="status" className="text-xs font-semibold text-emerald-600 mb-2 p-2 bg-emerald-500/10 rounded-lg">
                  {deliverableActionMsg}
                </p>
              )}

              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-sec)] uppercase">Overview</h4>
                  <p className="text-xs text-[var(--text-main)] mt-1">{detailsProject.description}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-3 border-y border-[var(--border)] text-xs">
                  <div>
                    <span className="text-[var(--text-sec)] block text-[10px]">Project Type</span>
                    <span className="font-semibold text-[#635BFF]">{detailsProject.content?.projectType || 'Other'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-sec)] block text-[10px]">Delivery Schedule</span>
                    <span className="font-semibold text-purple-600">{detailsProject.content?.deliverySchedule || 'Monthly Deliverables'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-sec)] block text-[10px]">Status</span>
                    <span className="font-semibold text-[var(--text-main)]">{detailsProject.status}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-sec)] block text-[10px]">Priority</span>
                    <span className="font-semibold text-[var(--text-main)]">{detailsProject.priority}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-sec)] block text-[10px]">Overall Progress</span>
                    <span className="font-semibold text-[#635BFF]">{detailsProject.progress}%</span>
                  </div>
                </div>

                {/* Delivery Progress Section */}
                <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#635BFF]" />
                      <span>Deliverables Breakdown</span>
                    </h4>
                    <span className="text-xs font-bold text-emerald-600">{dInfo.completed} of {dInfo.total} Delivered</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                    <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                      <span className="text-[10px] text-[var(--text-sec)] block">Total</span>
                      <strong className="text-sm text-[var(--text-main)]">{dInfo.total}</strong>
                    </div>
                    <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                      <span className="text-[10px] text-[var(--text-sec)] block">Completed</span>
                      <strong className="text-sm text-emerald-600">{dInfo.completed}</strong>
                    </div>
                    <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                      <span className="text-[10px] text-[var(--text-sec)] block">In Progress</span>
                      <strong className="text-sm text-blue-600">{dInfo.inProgress}</strong>
                    </div>
                    <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                      <span className="text-[10px] text-[var(--text-sec)] block">Remaining</span>
                      <strong className="text-sm text-amber-600">{dInfo.remaining}</strong>
                    </div>
                    <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                      <span className="text-[10px] text-[var(--text-sec)] block">Overdue</span>
                      <strong className="text-sm text-rose-600">{dInfo.overdue}</strong>
                    </div>
                  </div>
                </div>

                {/* Deliverables Breakdown: Monthly vs. One-Time */}
                {(() => {
                  const renderDeliverablesGroup = (title, items) => (
                    <div className="space-y-2 mt-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-sec)]">
                          {title} ({items.filter(i => i.isDelivered).length} of {items.length})
                        </h4>
                      </div>
                      {items.length === 0 ? (
                        <div className="p-3 text-center border border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--text-sec)]">
                          No {title.toLowerCase()} recorded.
                        </div>
                      ) : (
                        <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)] max-h-48 overflow-y-auto">
                          {items.map(item => {
                            const assignee = users.find(u => u.id === item.assigneeId);
                            const isUpdating = updatingDeliverableId === item.id;
                            return (
                              <div key={item.id} className="p-2.5 flex items-center justify-between gap-3 text-xs hover:bg-[var(--bg-main)]/50">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
                                      item.isDelivered ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                      item.status === 'In Progress' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                      item.status === 'Overdue' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                                      'bg-gray-500/10 text-gray-500 border-gray-500/20'
                                    }`}>
                                      {item.status}
                                    </span>
                                    <Link
                                      to={`/tasks?taskId=${item.id}&projectId=${detailsProject.id}`}
                                      className="font-semibold text-[var(--text-main)] hover:text-[#635BFF] hover:underline truncate"
                                    >
                                      {item.name}
                                    </Link>
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] text-[var(--text-sec)]">
                                    <span>Type: <strong>{item.type}</strong></span>
                                    {assignee && <span>Assignee: <strong>{assignee.name}</strong></span>}
                                    <span>Target: {item.targetDate || '—'}</span>
                                    {item.actualDate && <span className="text-emerald-600">Delivered: {item.actualDate}</span>}
                                  </div>
                                </div>

                                <div>
                                  {item.isDelivered ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                                      <Check className="w-3 h-3" />
                                      <span>Delivered</span>
                                    </span>
                                  ) : (
                                    <button
                                      disabled={isUpdating || (currentUser?.role === 'team_member' && item.assigneeId !== currentUser?.id)}
                                      onClick={() => handleMarkDeliverableDone(item, detailsProject)}
                                      className="px-2.5 py-1 text-[11px] font-semibold bg-[#635BFF] hover:bg-[#4942D9] text-white rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                    >
                                      {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                      <span>Mark Done</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );

                  return (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
                          Project Deliverables Breakdown
                        </h4>
                        <Link
                          to={`/tasks?projectId=${detailsProject.id}`}
                          className="text-[11px] text-[#635BFF] hover:underline font-semibold"
                        >
                          Manage in Tasks →
                        </Link>
                      </div>
                      {renderDeliverablesGroup('Monthly Deliverables', dInfo.monthlyDeliverables)}
                      {renderDeliverablesGroup('One-Time Deliverables', dInfo.oneTimeDeliverables)}
                    </div>
                  );
                })()}

                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-sec)] uppercase mb-2">Team & Governance</h4>
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-[10px] text-[var(--text-sec)] block">Manager:</span>
                      <span className="font-medium text-[var(--text-main)]">
                        {users.find(u => u.id === detailsProject.managerId)?.name || 'Unassigned'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-sec)] block">Assigned Squad:</span>
                      <span className="font-medium text-[var(--text-main)]">
                        {teams.find(t => t.id === detailsProject.teamId)?.name || 'Direct Allocation'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => { setDetailsProject(null); setDeliverableActionMsg(''); }}
                    className="px-4 py-2 text-xs bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border)] rounded-lg hover:bg-[var(--border)] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}


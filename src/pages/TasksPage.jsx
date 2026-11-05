import React, { useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  User,
  X,
  MessageSquare,
  Loader2,
  SlidersHorizontal
} from 'lucide-react';
import { useApp } from '../context/useApp';
import { getInitials } from '../utils/avatar';
import { ScopeRules } from '../config/rbac';
import ContentSchedule, { ContentFields } from '../components/ContentSchedule';
import AgencyWorkspaceHeader from '../components/AgencyWorkspaceHeader';
import { editableContent } from '../utils/contentFields';
import { getTaskTypesForProjectType, getAllowedDeliveryCategories, contentTypes } from '../../shared/serviceTypes';
import { isSocialProject } from '../../shared/delivery';

const COLUMNS = [
  { id: 'Backlog', label: 'Backlog', color: '#9AA0B2' },
  { id: 'To Do', label: 'To Do', color: '#8B5CF6' },
  { id: 'In Progress', label: 'In Progress', color: '#635BFF' },
  { id: 'In Review', label: 'In Review', color: '#E9A23B' },
  { id: 'Blocked', label: 'Blocked', color: '#E05252' },
  { id: 'Completed', label: 'Completed', color: '#16A36A' }
];

export default function TasksPage() {
  const { tasks, updateTask, projects, users, teams, currentUser, permissions } = useApp();
  const [searchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState('content');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'ALL');
  const [advancedFilters, setAdvancedFilters] = useState({
    designer: '',
    type: '',
    approval: '',
    publishing: ''
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const clearAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setProjectFilter('ALL');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setAdvancedFilters({
      designer: '',
      type: '',
      approval: '',
      publishing: ''
    });
  };

  const hasActiveFilters = Boolean(
    search ||
    projectFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    priorityFilter !== 'ALL' ||
    advancedFilters.designer ||
    advancedFilters.type ||
    advancedFilters.approval ||
    advancedFilters.publishing
  );

  // Modal / Details state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [sharedDetailsTask, setSharedDetailsTask] = useState(null);
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input by 150ms to ensure smooth typing without lag
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 150);
    return () => clearTimeout(timer);
  }, [search]);

  // Handle URL params
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const sParam = searchParams.get('status');
      if (sParam) setStatusFilter(sParam);
      const tIdParam = searchParams.get('taskId');
      if (tIdParam && tasks.length > 0) {
        const match = tasks.find(t => t.id === tIdParam);
        if (match) setSharedDetailsTask(match);
      }
    });
    return () => { active = false; };
  }, [searchParams, tasks]);

  const [assignmentType, setAssignmentType] = useState('individual'); // 'individual' | 'team'
  const [employeeSearch, setEmployeeSearch] = useState('');

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
    setSubmitError('');
    setEmployeeSearch('');
    setAssignmentType('individual');
    
    // Default project respecting PM permissions
    const defaultProject = currentUser?.role === 'project_manager'
      ? projects.find(p => p.managerId === currentUser.id) || projects[0]
      : projects[0];

    const initialTaskTypes = getTaskTypesForProjectType(defaultProject?.content?.projectType);
    const initialDue = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const isSocial = isSocialProject(defaultProject?.content);

    setFormData({
      title: '',
      description: '',
      projectId: defaultProject?.id || '',
      assigneeId: users[0]?.id || '',
      teamId: '',
      priority: 'Medium',
      status: 'To Do',
      startDate: new Date().toISOString().split('T')[0],
      dueDate: initialDue,
      progress: 0,
      labels: 'Core, Sprint',
      content: {
        contentType: initialTaskTypes[0] || 'Post',
        ...(isSocial ? { postDate: initialDue } : {})
      }
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
      const selectedProj = projects.find(p => p.id === formData.projectId);
      const isSocial = isSocialProject(selectedProj?.content);
      const content = { ...(formData.content || {}) };
      
      // Auto-populate postDate for social project tasks if missing
      if (isSocial && !content.postDate && formData.dueDate) {
        content.postDate = formData.dueDate;
      }

      const payload = {
        ...formData,
        content: editableContent(content),
        id: editingTask ? editingTask.id : undefined,
        progress: Number(formData.progress) || 0,
        labels: typeof formData.labels === 'string' ? formData.labels.split(',').map(s => s.trim()).filter(Boolean) : formData.labels,
        subtasks: editingTask ? editingTask.subtasks : [],
        comments: editingTask ? editingTask.comments : []
      };
      await updateTask(payload);
      setModalOpen(false);
    } catch (err) {
      setSubmitError(err.message || 'Failed to save task');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Drag and drop handlers for Kanban columns
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const buildCompletedTaskUpdate = React.useCallback((task, targetStatus) => {
    const isCompleted = targetStatus === 'Completed';
    const proj = projects.find(p => p.id === task.projectId);
    const isSocial = isSocialProject(proj?.content);
    const prevContent = task.content || {};
    const today = new Date().toISOString().slice(0, 10);

    let updatedContent = { ...prevContent };
    if (isCompleted) {
      if (!isSocial) {
        updatedContent.designStatus = 'Completed';
        if (!updatedContent.designDate) updatedContent.designDate = today;
      }
    } else {
      if (updatedContent.designStatus === 'Completed') {
        updatedContent.designStatus = 'In Progress';
      }
      if (isSocial && updatedContent.postStatus === 'Published') {
        updatedContent.postStatus = 'Scheduled';
      }
    }

    return {
      ...task,
      status: targetStatus,
      progress: isCompleted ? 100 : task.progress === 100 ? 50 : task.progress,
      content: updatedContent
    };
  }, [projects]);

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== targetStatus) {
      const updated = buildCompletedTaskUpdate(task, targetStatus);
      updateTask(updated);
    }
  };

  // Role-based scoped tasks and projects
  const scopedProjects = ScopeRules.filterProjects(projects, currentUser, teams);
  const scopedTasks = ScopeRules.filterTasks(tasks, currentUser, teams, scopedProjects);

  // Filters
  const filteredTasks = scopedTasks.filter(t => {
    const query = debouncedSearch.toLowerCase().trim();
    const taskProj = projects.find(p => p.id === t.projectId);
    const matchesSearch = !query ||
      t.title.toLowerCase().includes(query) ||
      (t.description && t.description.toLowerCase().includes(query)) ||
      (taskProj && taskProj.name.toLowerCase().includes(query)) ||
      (t.content?.contentType && t.content.contentType.toLowerCase().includes(query));
    const matchesProject = projectFilter === 'ALL'
      ? true
      : projectFilter === 'UNPLANNED'
        ? !t.projectId
        : t.projectId === projectFilter;
    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;

    // Advanced filters
    const matchesAssignee = !advancedFilters.designer || t.assigneeId === advancedFilters.designer;
    const matchesType = !advancedFilters.type || t.content?.contentType === advancedFilters.type;
    const matchesApproval = !advancedFilters.approval || (t.content?.approvalStatus || 'Pending') === advancedFilters.approval;
    const matchesPublishing = !advancedFilters.publishing || (t.content?.postStatus || 'Not Scheduled') === advancedFilters.publishing;

    return matchesSearch && matchesProject && matchesPriority && matchesStatus &&
      matchesAssignee && matchesType && matchesApproval && matchesPublishing;
  });

  return (
    <div className="agency-workspace space-y-6 max-w-7xl mx-auto">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <AgencyWorkspaceHeader member={currentUser?.role === 'team_member'} />
        </div>

        {/* Team Member Role restriction notice */}
        {permissions.isTeamMember ? (
          <div className="text-xs text-[var(--text-sec)] bg-[var(--bg-main)] px-3 py-1.5 rounded-xl border border-[var(--border)]">
            Viewing workspace tasks
          </div>
        ) : (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-[#635BFF] hover:bg-[#4942D9] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        )}
      </div>

      {/* Structured Filter Toolbar */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs space-y-2.5">
        {/* ROW 1: Search + Core Dropdowns (Project, Status, Priority, Assignee) + Content/Kanban Switcher */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {/* Search Tasks (takes remaining width) */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-[var(--bg-main)] px-3 py-1.5 rounded-lg border border-[var(--border)]">
            <Search className="w-4 h-4 text-[var(--text-sec)] shrink-0" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-[var(--text-main)] outline-none"
            />
          </div>

          {/* Desktop/Tablet Row 1 dropdowns */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {/* Project */}
            <select
              aria-label="Project filter"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none min-w-[125px]"
            >
              <option value="ALL">All Projects</option>
              <option value="UNPLANNED">Unplanned Tasks</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Status */}
            <select
              aria-label="Status filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none min-w-[115px]"
            >
              <option value="ALL">All Statuses</option>
              {COLUMNS.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>

            {/* Priority */}
            <select
              aria-label="Priority filter"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none min-w-[105px]"
            >
              <option value="ALL">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>

            {/* Assignee */}
            <select
              aria-label="Assignee filter"
              value={advancedFilters.designer}
              onChange={(e) => setAdvancedFilters(prev => ({ ...prev, designer: e.target.value }))}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none min-w-[120px]"
            >
              <option value="">All Assignees</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Mobile Filter Toggle + View Switcher */}
          <div className="flex items-center gap-2 justify-between sm:justify-end">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(prev => !prev)}
              className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-xs font-semibold text-[var(--text-main)] cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--text-sec)]" />
              <span>Filters</span>
              {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-[#635BFF]" />}
            </button>

            {/* Content / Kanban view switcher */}
            <div className="flex items-center border border-[var(--border)] rounded-lg p-0.5 bg-[var(--bg-main)] shrink-0">
              <button
                aria-pressed={viewMode === 'content'}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  viewMode === 'content' ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs' : 'text-[var(--text-sec)] hover:text-[var(--text-main)]'
                }`}
                onClick={() => setViewMode('content')}
              >
                Content
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  viewMode === 'kanban' ? 'bg-[var(--surface)] text-[#635BFF] shadow-xs' : 'text-[var(--text-sec)] hover:text-[var(--text-main)]'
                }`}
              >
                Kanban
              </button>
            </div>
          </div>
        </div>

        {/* ROW 2 (Desktop/Tablet): Content Type, Approval Status, Post Status, Clear Filters */}
        <div className="hidden sm:flex items-center gap-2 pt-1 border-t border-[var(--border)]/60">
          {/* Content Type */}
          <select
            aria-label="Content Type filter"
            value={advancedFilters.type}
            onChange={(e) => setAdvancedFilters(prev => ({ ...prev, type: e.target.value }))}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none min-w-[130px]"
          >
            <option value="">All Content Types</option>
            {contentTypes.map(ct => (
              <option key={ct} value={ct}>{ct}</option>
            ))}
          </select>

          {/* Approval Status */}
          <select
            aria-label="Approval Status filter"
            value={advancedFilters.approval}
            onChange={(e) => setAdvancedFilters(prev => ({ ...prev, approval: e.target.value }))}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none min-w-[125px]"
          >
            <option value="">All Approvals</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Changes Requested">Changes Requested</option>
          </select>

          {/* Post Status */}
          <select
            aria-label="Post Status filter"
            value={advancedFilters.publishing}
            onChange={(e) => setAdvancedFilters(prev => ({ ...prev, publishing: e.target.value }))}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none min-w-[125px]"
          >
            <option value="">All Post Status</option>
            <option value="Not Scheduled">Not Scheduled</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Published">Published</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Clear Filters (Desktop) */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-[#635BFF] hover:underline font-semibold px-2 py-1 cursor-pointer whitespace-nowrap ml-auto"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* MOBILE FILTERS EXPANDABLE DRAWER */}
        {mobileFiltersOpen && (
          <div className="sm:hidden pt-3 border-t border-[var(--border)] grid grid-cols-1 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-sec)] uppercase mb-1">Project</label>
              <select
                aria-label="Mobile Project filter"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
              >
                <option value="ALL">All Projects</option>
                <option value="UNPLANNED">Unplanned Tasks</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-sec)] uppercase mb-1">Status</label>
                <select
                  aria-label="Mobile Status filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  {COLUMNS.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--text-sec)] uppercase mb-1">Priority</label>
                <select
                  aria-label="Mobile Priority filter"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[var(--text-sec)] uppercase mb-1">Assignee</label>
              <select
                aria-label="Mobile Assignee filter"
                value={advancedFilters.designer}
                onChange={(e) => setAdvancedFilters(prev => ({ ...prev, designer: e.target.value }))}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
              >
                <option value="">All Assignees</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-sec)] uppercase mb-1">Type</label>
                <select
                  aria-label="Mobile Content Type filter"
                  value={advancedFilters.type}
                  onChange={(e) => setAdvancedFilters(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full text-xs px-2.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                >
                  <option value="">All Content Types</option>
                  {contentTypes.map(ct => (
                    <option key={ct} value={ct}>{ct}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--text-sec)] uppercase mb-1">Approval</label>
                <select
                  aria-label="Mobile Approval Status filter"
                  value={advancedFilters.approval}
                  onChange={(e) => setAdvancedFilters(prev => ({ ...prev, approval: e.target.value }))}
                  className="w-full text-xs px-2.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                >
                  <option value="">All Approvals</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Changes Requested">Changes Requested</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[var(--text-sec)] uppercase mb-1">Post Status</label>
              <select
                aria-label="Mobile Post Status filter"
                value={advancedFilters.publishing}
                onChange={(e) => setAdvancedFilters(prev => ({ ...prev, publishing: e.target.value }))}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
              >
                <option value="">All Post Status</option>
                <option value="Not Scheduled">Not Scheduled</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Published">Published</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {hasActiveFilters && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs text-[#635BFF] hover:underline font-semibold py-1 cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Views */}
      <ContentSchedule
        searchTerm={debouncedSearch}
        hideSearch
        hideToolbar
        externalMonth="ALL"
        externalFilters={{ projectFilter, statusFilter, priorityFilter, ...advancedFilters }}
        onAdvancedFilterChange={(newFilters) => setAdvancedFilters(prev => ({ ...prev, ...newFilters }))}
        externalEditing={sharedDetailsTask}
        onCloseExternalEditing={() => setSharedDetailsTask(null)}
      />

      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 select-none pb-4">
          {COLUMNS.map(col => {
            const columnTasks = filteredTasks.filter(t => t.status === col.id);
            return (
              <div
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
                className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-2xl flex flex-col min-h-[320px] max-h-[calc(100vh-16rem)] min-w-0"
              >
                {/* Column Header */}
                <div className="p-3 border-b border-[var(--border)] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                    <span className="font-bold text-xs text-[var(--text-main)] truncate">{col.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-sec)] font-semibold shrink-0">
                      {columnTasks.length}
                    </span>
                  </div>
                </div>

                {/* Task Cards Column */}
                <div className="p-2 space-y-2.5 overflow-y-auto flex-1">
                  {columnTasks.length === 0 ? (
                    <div className="py-8 text-center text-[11px] text-[var(--text-sec)]">
                      No tasks in {col.label}
                    </div>
                  ) : (
                    columnTasks.map(task => {
                    const assignee = users.find(u => u.id === task.assigneeId);
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onClick={() => setSharedDetailsTask(task)}
                        className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs hover:border-[#635BFF] cursor-grab active:cursor-grabbing transition-all space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                            task.priority === 'Urgent' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                            task.priority === 'High' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                            'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
                          }`}>
                            {task.priority}
                          </span>
                          <span className="text-[10px] text-[var(--text-sec)] truncate">
                            Due {task.dueDate ? String(task.dueDate).substring(5) : 'N/A'}
                          </span>
                        </div>

                        <h4 className="font-semibold text-xs text-[var(--text-main)] line-clamp-2 leading-snug">{task.title}</h4>

                        {/* Card footer */}
                        <div className="flex items-center justify-between pt-1 border-t border-[var(--border)] text-[10px] text-[var(--text-sec)]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {assignee ? (
                              <div className="w-5 h-5 rounded-full bg-[#1E6091] text-white text-[9px] font-bold flex items-center justify-center shrink-0 tracking-wider">
                                {getInitials(assignee.name)}
                              </div>
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                            <span className="truncate max-w-[80px]">{assignee?.name.split(' ')[0] || 'Unassigned'}</span>
                          </div>

                          {(task.subtasks?.length > 0 || task.comments?.length > 0) && (
                            <div className="flex items-center gap-2 shrink-0">
                              {task.subtasks?.length > 0 && <span>✓ {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}</span>}
                              {task.comments?.length > 0 && <span className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3" /> {task.comments.length}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-label={editingTask ? 'Edit task' : 'Create task'} className="workflow-form-dialog bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <h3 className="font-bold text-base text-[var(--text-main)]">
                {editingTask ? 'Edit Task' : 'Create New Task'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && <p role="alert">{submitError}</p>}
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

              {/* Project Selection (RBAC scoped for PM) & Dynamic Task Type & Delivery Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Associated Project</label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => {
                      const newProjId = e.target.value;
                      const selectedProj = projects.find(p => p.id === newProjId);
                      const projType = selectedProj?.content?.projectType || 'Other';
                      const allowedTypes = getTaskTypesForProjectType(projType);
                      const allowedCats = getAllowedDeliveryCategories(selectedProj?.content?.deliverySchedule);
                      const currentType = formData.content?.contentType;
                      const validTaskType = allowedTypes.includes(currentType) ? currentType : (allowedTypes[0] || 'General Task');
                      const currentCat = formData.content?.deliveryCategory;
                      const validCat = allowedCats.includes(currentCat) ? currentCat : (allowedCats[0] || 'Monthly Deliverable');
                      setFormData({
                        ...formData,
                        projectId: newProjId,
                        content: { ...(formData.content || {}), contentType: validTaskType, deliveryCategory: validCat }
                      });
                    }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  >
                    <option value="">None (Unplanned / Ad-hoc Task)</option>
                    {projects
                      .filter(p => currentUser?.role === 'admin' || p.managerId === currentUser?.id)
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.content?.projectType || 'Other'})</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Task Type <span className="text-[10px] text-[var(--text-sec)] font-normal">({projects.find(p => p.id === formData.projectId)?.content?.projectType || 'General'})</span>
                  </label>
                  {(() => {
                    const selProj = projects.find(p => p.id === formData.projectId);
                    const pType = selProj?.content?.projectType || 'Other';
                    const availableTypes = getTaskTypesForProjectType(pType);
                    return (
                      <select
                        value={formData.content?.contentType || availableTypes[0] || 'General Task'}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            content: { ...(formData.content || {}), contentType: e.target.value }
                          });
                        }}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[#635BFF]"
                      >
                        {availableTypes.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Delivery Category
                  </label>
                  {(() => {
                    const selProj = projects.find(p => p.id === formData.projectId);
                    const sched = selProj?.content?.deliverySchedule || 'Monthly Deliverables';
                    const allowedCats = getAllowedDeliveryCategories(sched);
                    return (
                      <select
                        value={formData.content?.deliveryCategory || allowedCats[0] || 'Monthly Deliverable'}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            content: { ...(formData.content || {}), deliveryCategory: e.target.value }
                          });
                        }}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[#635BFF]"
                      >
                        {allowedCats.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
              </div>

              {/* ASSIGNMENT: INDIVIDUAL VS TEAM */}
              <div className="border border-[var(--border)] bg-[var(--bg-main)]/50 p-3.5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--text-main)]">Task Assignment</label>
                  <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAssignmentType('individual');
                        setFormData(prev => ({ ...prev, teamId: '', assigneeId: prev.assigneeId || users[0]?.id || '' }));
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        assignmentType === 'individual' ? 'bg-[#635BFF] text-white shadow-xs' : 'text-[var(--text-sec)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      Individual
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignmentType('team');
                        const defaultTeam = teams[0]?.id || '';
                        setFormData(prev => ({ ...prev, teamId: prev.teamId || defaultTeam }));
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        assignmentType === 'team' ? 'bg-[#635BFF] text-white shadow-xs' : 'text-[var(--text-sec)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      Team
                    </button>
                  </div>
                </div>

                {/* Individual assignment: employee selector */}
                {assignmentType === 'individual' && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Search active employee name, department, or role..."
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] outline-none"
                    />
                    <div className="max-h-36 overflow-y-auto space-y-1.5 border border-[var(--border)] rounded-lg p-1.5 bg-[var(--surface)]">
                      {users
                        .filter(u => u.status === 'Active')
                        .filter(u => u.name.toLowerCase().includes(employeeSearch.toLowerCase()) || u.department.toLowerCase().includes(employeeSearch.toLowerCase()))
                        .map(u => {
                          const isSelected = formData.assigneeId === u.id;
                          return (
                            <div
                              key={u.id}
                              onClick={() => setFormData({ ...formData, assigneeId: u.id, teamId: '' })}
                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                                isSelected ? 'bg-[#635BFF]/10 border border-[#635BFF]' : 'hover:bg-[var(--bg-main)]'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-[#1E6091] text-white text-[9px] font-bold flex items-center justify-center shrink-0 tracking-wider">
                                  {getInitials(u.name)}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-[var(--text-main)] leading-tight">{u.name}</p>
                                  <p className="text-[10px] text-[var(--text-sec)]">{u.designation} • {u.department}</p>
                                </div>
                              </div>
                              {isSelected && <span className="text-[10px] font-bold text-[#635BFF]">Selected</span>}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Team assignment: Team selector + optional responsible member */}
                {assignmentType === 'team' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-sec)] mb-1">Assigned Team *</label>
                      <select
                        required
                        value={formData.teamId}
                        onChange={(e) => {
                          const tid = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            teamId: tid,
                            // If current assignee is not in the new team, clear it
                            assigneeId: teams.find(t => t.id === tid)?.memberIds?.includes(prev.assigneeId) ? prev.assigneeId : ''
                          }));
                        }}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] outline-none focus:border-[#635BFF]"
                      >
                        <option value="">Select Team</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({t.department})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-sec)] mb-1">
                        Responsible Team Member <span className="text-[10px] font-normal text-[var(--text-sec)]">(Optional)</span>
                      </label>
                      <select
                        value={formData.assigneeId || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, assigneeId: e.target.value || '' }))}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] outline-none focus:border-[#635BFF]"
                      >
                        <option value="">Whole Team (Unassigned to specific member)</option>
                        {users
                          .filter(u => teams.find(t => t.id === formData.teamId)?.memberIds?.includes(u.id))
                          .map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.designation})</option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}
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

              <ContentFields
                value={formData.content}
                projectType={projects.find(p => p.id === formData.projectId)?.content?.projectType}
                member={currentUser?.role === 'team_member'}
                onChange={content => setFormData({ ...formData, content })}
              />
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
                    <span>Save Task</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


import React, { useRef, useState } from 'react';
import { X, FolderKanban, ListTodo, Users, Megaphone, Loader2 } from 'lucide-react';
import { useApp } from '../context/useApp';
import { DEPARTMENTS, DEFAULT_DEPARTMENT } from '../constants/departments';

export default function QuickCreateModal() {
  const {
    quickCreateOpen,
    setQuickCreateOpen,
    updateProject,
    updateTask,
    updateTeam,
    publishAnnouncement,
    projects,
    users,
    currentUser
  } = useApp();

  const [tab, setTab] = useState('task'); // 'task', 'project', 'team', 'announcement'
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canCreateProject = currentUser?.role === 'admin' || currentUser?.role === 'project_manager';
  const canCreateTeam = currentUser?.role === 'admin';
  const canCreateTask = currentUser?.role === 'admin' || currentUser?.role === 'project_manager';
  const canCreateAnnouncement = currentUser?.role === 'admin';

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
  const [projDueDate, setProjDueDate] = useState('');

  // Team form state
  const [teamName, setTeamName] = useState('');
  const [teamDept, setTeamDept] = useState(DEFAULT_DEPARTMENT);
  const [teamLeader, setTeamLeader] = useState(users[0]?.id || '');

  // Announcement form state (Admin only)
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annTag, setAnnTag] = useState('General');
  const [annDept, setAnnDept] = useState('');

  if (!quickCreateOpen) return null;

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskTitle) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await updateTask({
        title: taskTitle,
        projectId: taskProjectId || null,
        assigneeId: taskAssigneeId || null,
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
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create task');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projName) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await updateProject({
        name: projName,
        description: projDesc,
        priority: projPriority,
        status: 'Planning',
        dueDate: projDueDate || '2026-12-31',
        startDate: new Date().toISOString().split('T')[0],
        progress: 0,
        budget: 0,
        spent: 0,
        managerId: currentUser.id,
        teamId: null,
        tags: ['Core']
      });
      setProjName('');
      setProjDesc('');
      setQuickCreateOpen(false);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create project');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!teamName) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await updateTeam({
        name: teamName,
        department: teamDept,
        leaderId: teamLeader,
        description: 'Specialized agile delivery squad.',
        memberIds: [teamLeader],
        color: '#635BFF'
      });
      setTeamName('');
      setQuickCreateOpen(false);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create team');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!annTitle) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await publishAnnouncement({
        title: annTitle,
        content: annContent,
        tag: annTag,
        targetDepartment: annDept || null
      });
      setAnnTitle('');
      setAnnContent('');
      setQuickCreateOpen(false);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to publish announcement');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
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
          <button onClick={() => setQuickCreateOpen(false)} className="p-1 rounded-md text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-[var(--border)] bg-[var(--bg-main)] p-1 gap-1">
          {canCreateTask && (
            <button
              onClick={() => { setTab('task'); setErrorMsg(''); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tab === 'task' ? 'bg-[var(--surface)] text-[#635BFF] shadow-xs' : 'text-[var(--text-sec)] hover:text-[var(--text-main)]'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" /> Task
            </button>
          )}
          {canCreateProject && (
            <button
              onClick={() => { setTab('project'); setErrorMsg(''); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tab === 'project' ? 'bg-[var(--surface)] text-[#635BFF] shadow-xs' : 'text-[var(--text-sec)] hover:text-[var(--text-main)]'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" /> Project
            </button>
          )}
          {canCreateTeam && (
            <button
              onClick={() => { setTab('team'); setErrorMsg(''); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tab === 'team' ? 'bg-[var(--surface)] text-[#635BFF] shadow-xs' : 'text-[var(--text-sec)] hover:text-[var(--text-main)]'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Team
            </button>
          )}
          {canCreateAnnouncement && (
            <button
              onClick={() => { setTab('announcement'); setErrorMsg(''); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tab === 'announcement' ? 'bg-[var(--surface)] text-[#635BFF] shadow-xs' : 'text-[var(--text-sec)] hover:text-[var(--text-main)]'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" /> Announcement
            </button>
          )}
        </div>

        {/* Content body */}
        <div className="p-5">
          {errorMsg && (
            <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
              {errorMsg}
            </div>
          )}

          {/* TASK TAB */}
          {tab === 'task' && (
            <form onSubmit={handleCreateTask} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement OIDC token exchange"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none"
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
                    <option value="">None (Unplanned Task)</option>
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
                    <option value="">Unassigned</option>
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
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setQuickCreateOpen(false)}
                  className="px-3 py-1.5 text-xs text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs bg-[#635BFF] hover:bg-[#4942D9] text-white font-medium rounded-lg shadow-sm cursor-pointer disabled:opacity-70 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Task</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* PROJECT TAB */}
          {tab === 'project' && (
            <form onSubmit={handleCreateProject} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Next-Gen Cloud Platform"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Strategic mission and core deliverables..."
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Priority</label>
                  <select
                    value={projPriority}
                    onChange={(e) => setProjPriority(e.target.value)}
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
                    value={projDueDate}
                    onChange={(e) => setProjDueDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setQuickCreateOpen(false)}
                  className="px-3 py-1.5 text-xs text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs bg-[#635BFF] hover:bg-[#4942D9] text-white font-medium rounded-lg shadow-sm cursor-pointer disabled:opacity-70 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deploying...</span>
                    </>
                  ) : (
                    <span>Launch Project</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TEAM TAB */}
          {tab === 'team' && (
            <form onSubmit={handleCreateTeam} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Team Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cloud Operations Group"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none"
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
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
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
                  disabled={isSubmitting}
                  onClick={() => setQuickCreateOpen(false)}
                  className="px-3 py-1.5 text-xs text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs bg-[#635BFF] hover:bg-[#4942D9] text-white font-medium rounded-lg shadow-sm cursor-pointer disabled:opacity-70 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Forming...</span>
                    </>
                  ) : (
                    <span>Form Team</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ANNOUNCEMENT TAB (ADMIN ONLY) */}
          {tab === 'announcement' && (
            <form onSubmit={handleCreateAnnouncement} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Announcement Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Townhall & Sprint Showcase"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Content / Message</label>
                <textarea
                  rows="3"
                  placeholder="Full announcement broadcasted to employee notification feed..."
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Category Tag</label>
                  <select
                    value={annTag}
                    onChange={(e) => setAnnTag(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none"
                  >
                    <option value="General">General</option>
                    <option value="Important">Important</option>
                    <option value="HR & Culture">HR & Culture</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Event">Event</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-main)] mb-1">Target Department</label>
                  <select
                    value={annDept}
                    onChange={(e) => setAnnDept(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none"
                  >
                    <option value="">All Company (All Employees)</option>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setQuickCreateOpen(false)}
                  className="px-3 py-1.5 text-xs text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs bg-[#635BFF] hover:bg-[#4942D9] text-white font-medium rounded-lg shadow-sm cursor-pointer disabled:opacity-70 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Broadcasting...</span>
                    </>
                  ) : (
                    <span>Broadcast</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Mail, Briefcase, Building, X, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useApp } from '../context/useApp';
import { UsersAPI } from '../services/api';
import { getInitials } from '../utils/avatar';
import { DEPARTMENTS, DEFAULT_DEPARTMENT } from '../constants/departments';

export default function EmployeesPage() {
  const { users, updateUser, removeUser, tasks, permissions } = useApp();

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [activeProfile, setActiveProfile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Delete Confirmation & Reassignment Modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSummary, setDeleteSummary] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [projectReassignments, setProjectReassignments] = useState({});
  const [teamReassignments, setTeamReassignments] = useState({});
  const [deleteError, setDeleteError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    designation: '',
    department: DEFAULT_DEPARTMENT,
    role: 'team_member',
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setSubmitError('');
    setFormData({
      name: '',
      email: '',
      designation: '',
      department: DEFAULT_DEPARTMENT,
      role: 'team_member',
      status: 'Active',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
    });
    setModalOpen(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setSubmitError('');
    setFormData(u);
    setModalOpen(true);
  };

  const openDeleteModal = async (u) => {
    setDeleteTarget(u);
    setDeleteError('');
    setDeleteLoading(true);
    setProjectReassignments({});
    setTeamReassignments({});
    try {
      const summary = await UsersAPI.getDeleteSummary(u.id);
      setDeleteSummary(summary);
    } catch (err) {
      setDeleteError('Failed to load user dependencies: ' + err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await removeUser(deleteTarget.id, projectReassignments, teamReassignments);
      setDeleteTarget(null);
      setDeleteSummary(null);
    } catch (err) {
      setDeleteError(err.message || 'Failed to complete employee retirement');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await updateUser({
        ...formData,
        id: editingUser ? editingUser.id : undefined
      });
      setModalOpen(false);
    } catch (err) {
      setSubmitError(err.message || 'Failed to save employee record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter(u => {
    if (u.status === 'Inactive' || u.name === 'Deleted Employee') return false;
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.designation.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === 'ALL' || u.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">Staff & Directory</h1>
          <p className="text-xs sm:text-sm text-[var(--text-sec)] mt-0.5">
            Internal team members, functional departments, roles, and assigned workloads.
          </p>
        </div>

        {permissions.canManageEmployees && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-[#635BFF] hover:bg-[#4942D9] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        )}
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[var(--text-sec)]" />
          <input
            type="text"
            placeholder="Search by name, email, designation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-[var(--text-main)] outline-none"
          />
        </div>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
        >
          <option value="ALL">All Departments</option>
          {DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
      </div>

      {/* Employees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map(u => {
          const userTasks = tasks.filter(t => t.assigneeId === u.id);
          const activeTasks = userTasks.filter(t => t.status !== 'Completed').length;

          return (
            <div
              key={u.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs hover:border-[#635BFF]/50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#1E6091] text-white text-sm font-bold flex items-center justify-center shrink-0 border border-[#1E6091] tracking-wider">
                      {getInitials(u.name)}
                    </div>
                    <div>
                      <h3
                        onClick={() => setActiveProfile(u)}
                        className="font-bold text-sm text-[var(--text-main)] hover:text-[#635BFF] cursor-pointer"
                      >
                        {u.name}
                      </h3>
                      <p className="text-xs text-[var(--text-sec)]">{u.designation}</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    {u.status}
                  </span>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-[var(--text-sec)]">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" />
                    <span className="truncate">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5" />
                    <span>{u.department}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5" />
                    <span className="capitalize">{u.role.replace('_', ' ')}</span>
                  </div>
                </div>

                {/* Workload metric */}
                <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
                  <span className="text-[var(--text-sec)] text-[11px]">Active Tasks:</span>
                  <span className="font-bold text-[var(--text-main)]">{activeTasks} ongoing</span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
                <button
                  onClick={() => setActiveProfile(u)}
                  className="text-xs text-[#635BFF] font-semibold hover:underline cursor-pointer"
                >
                  View Profile
                </button>

                {permissions.canManageEmployees && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(u)}
                      className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openDeleteModal(u)}
                      className="p-1 rounded text-[var(--text-sec)] hover:text-[#E05252] cursor-pointer"
                      title="Retire & Delete Employee"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Employee Details Modal */}
      {activeProfile && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#635BFF]">Employee Record</span>
              <button onClick={() => setActiveProfile(null)} className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-[#1E6091] text-white text-base font-bold flex items-center justify-center shrink-0 border-2 border-[#1E6091] tracking-wider">
                {getInitials(activeProfile.name)}
              </div>
              <div>
                <h3 className="font-bold text-base text-[var(--text-main)]">{activeProfile.name}</h3>
                <p className="text-xs text-[#635BFF] font-semibold">{activeProfile.designation}</p>
                <p className="text-xs text-[var(--text-sec)]">{activeProfile.department}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                <span className="text-[10px] uppercase font-bold text-[var(--text-sec)] block mb-1">Assigned Tasks</span>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {tasks.filter(t => t.assigneeId === activeProfile.id).map(t => (
                    <div key={t.id} className="flex items-center justify-between py-1">
                      <span className="truncate max-w-[260px] font-medium">{t.title}</span>
                      <span className="text-[10px] text-[var(--text-sec)]">{t.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--border)] flex justify-end">
              <button
                onClick={() => setActiveProfile(null)}
                className="px-4 py-2 text-xs bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] rounded-lg hover:bg-[var(--border)] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <h3 className="font-bold text-base text-[var(--text-main)]">
                {editingUser ? 'Edit Employee' : 'Add Employee'}
              </h3>
              <button
                disabled={isSubmitting}
                onClick={() => setModalOpen(false)}
                className="p-1 text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitError && (
              <div className="mb-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Designation</label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Role Permission</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  >
                    <option value="team_member">Team Member</option>
                    <option value="project_manager">Project Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex justify-end gap-2">
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
                    <span>Save Employee</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Safe Deletion & Reassignment Workflow Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <div className="flex items-center gap-2 text-[#E05252]">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-bold text-sm text-[var(--text-main)]">Safe Account Retirement: {deleteTarget.name}</h3>
              </div>
              <button
                onClick={() => { setDeleteTarget(null); setDeleteSummary(null); }}
                className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deleteLoading && !deleteSummary ? (
              <div className="py-12 flex flex-col items-center justify-center text-[var(--text-sec)] gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#635BFF]" />
                <span className="text-xs">Analyzing employee assignments and dependencies...</span>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {deleteError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{deleteError}</span>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                  <p className="font-semibold mb-1">Integrity Assurance</p>
                  <p className="opacity-90 leading-relaxed">
                    Account access will be permanently revoked and credentials invalidated. Historical messages, documents, comments, and reports will remain preserved under <strong>"Deleted Employee"</strong>.
                  </p>
                </div>

                {/* Managed Projects Reassignment Requirement */}
                {deleteSummary?.managedProjects?.length > 0 && (
                  <div className="space-y-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-main)]">
                    <label className="font-bold text-[var(--text-main)] block">
                      ⚠️ Projects Requiring Ownership Reassignment ({deleteSummary.managedProjects.length})
                    </label>
                    <p className="text-[11px] text-[var(--text-sec)]">
                      Assign a new Project Manager before completing retirement:
                    </p>
                    {deleteSummary.managedProjects.map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-2 py-1">
                        <span className="font-medium text-[var(--text-main)] truncate max-w-[200px]">{p.name}</span>
                        <select
                          required
                          value={projectReassignments[p.id] || ''}
                          onChange={e => setProjectReassignments({ ...projectReassignments, [p.id]: e.target.value })}
                          className="px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] outline-none"
                        >
                          <option value="">Select New Manager...</option>
                          {users
                            .filter(u => u.id !== deleteTarget.id && u.status !== 'Inactive' && u.name !== 'Deleted Employee')
                            .map(u => (
                              <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>
                            ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {/* Led Teams Reassignment Requirement */}
                {deleteSummary?.ledTeams?.length > 0 && (
                  <div className="space-y-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-main)]">
                    <label className="font-bold text-[var(--text-main)] block">
                      ⚠️ Teams Requiring Leader Reassignment ({deleteSummary.ledTeams.length})
                    </label>
                    <p className="text-[11px] text-[var(--text-sec)]">
                      Assign an eligible replacement Project Manager:
                    </p>
                    {deleteSummary.ledTeams.map(t => (
                      <div key={t.id} className="flex items-center justify-between gap-2 py-1">
                        <span className="font-medium text-[var(--text-main)] truncate max-w-[200px]">{t.name}</span>
                        <select
                          required
                          value={teamReassignments[t.id] || ''}
                          onChange={e => setTeamReassignments({ ...teamReassignments, [t.id]: e.target.value })}
                          className="px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] outline-none"
                        >
                          <option value="">Select New Project Manager...</option>
                          {users
                            .filter(u => u.id !== deleteTarget.id && u.status !== 'Inactive' && u.name !== 'Deleted Employee')
                            .map(u => (
                              <option key={u.id} value={u.id}>{u.name} ({u.designation})</option>
                            ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {/* Impact Summary */}
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-[var(--bg-main)] rounded-xl border border-[var(--border)]">
                    <div className="font-bold text-base text-[var(--text-main)]">{deleteSummary?.assignedTasks?.length || 0}</div>
                    <div className="text-[11px] text-[var(--text-sec)]">Tasks become Unassigned</div>
                  </div>
                  <div className="p-3 bg-[var(--bg-main)] rounded-xl border border-[var(--border)]">
                    <div className="font-bold text-base text-[var(--text-main)]">{deleteSummary?.memberTeams?.length || 0}</div>
                    <div className="text-[11px] text-[var(--text-sec)]">Active Team memberships removed</div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--border)] flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={deleteLoading}
                    onClick={() => { setDeleteTarget(null); setDeleteSummary(null); }}
                    className="px-4 py-2 text-xs text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      deleteLoading ||
                      (deleteSummary?.managedProjects?.some(p => !projectReassignments[p.id])) ||
                      (deleteSummary?.ledTeams?.some(t => !teamReassignments[t.id]))
                    }
                    onClick={handleConfirmDelete}
                    className="px-5 py-2 text-xs bg-[#E05252] hover:bg-[#c93b3b] text-white font-semibold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {deleteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Confirm Account Retirement</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


import React, { useState } from 'react';
import { Users2, Plus, Edit2, Trash2, X, ArrowRight, Loader2 } from 'lucide-react';
import { useApp } from '../context/useApp';
import { getInitials } from '../utils/avatar';
import { DEPARTMENTS, DEFAULT_DEPARTMENT } from '../constants/departments';

export default function TeamsPage() {
  const { teams, updateTeam, removeTeam, users, projects, tasks, permissions } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [activeTeamDetail, setActiveTeamDetail] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    department: DEFAULT_DEPARTMENT,
    leaderId: '',
    description: '',
    memberIds: [],
    color: '#635BFF'
  });

  const openCreateModal = () => {
    setEditingTeam(null);
    setSubmitError('');
    setFormData({
      name: '',
      department: DEFAULT_DEPARTMENT,
      leaderId: users[0]?.id || '',
      description: 'Agile team executing modern modular architectures.',
      memberIds: [users[0]?.id || ''],
      color: '#635BFF'
    });
    setModalOpen(true);
  };

  const openEditModal = (t) => {
    setEditingTeam(t);
    setSubmitError('');
    setFormData({
      name: t.name,
      department: t.department,
      leaderId: t.leaderId,
      description: t.description,
      memberIds: t.memberIds || [],
      color: t.color || '#635BFF'
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await updateTeam({
        ...formData,
        id: editingTeam ? editingTeam.id : undefined,
        projectIds: editingTeam ? editingTeam.projectIds : []
      });
      setModalOpen(false);
    } catch (err) {
      setSubmitError(err.message || 'Failed to save squad');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMemberSelection = (userId) => {
    const list = formData.memberIds || [];
    if (list.includes(userId)) {
      setFormData({ ...formData, memberIds: list.filter(id => id !== userId) });
    } else {
      setFormData({ ...formData, memberIds: [...list, userId] });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">Teams & Squads</h1>
          <p className="text-xs sm:text-sm text-[var(--text-sec)] mt-0.5">
            Cross-functional engineering pods, resource allocations, and squad workloads.
          </p>
        </div>

        {permissions.canManageTeams && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-[#635BFF] hover:bg-[#4942D9] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Form Team</span>
          </button>
        )}
      </div>

      {/* Team Cards Grid */}
      {teams.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-12 text-center">
          <Users2 className="w-10 h-10 text-[var(--text-sec)] mx-auto mb-3 opacity-40" />
          <h3 className="font-bold text-sm text-[var(--text-main)]">No teams configured</h3>
          <p className="text-xs text-[var(--text-sec)] mt-1 mb-4">Organize staff into high-velocity functional squads.</p>
          {permissions.canManageTeams && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 bg-[#635BFF] hover:bg-[#4942D9] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Form Team</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map(team => {
          const leader = users.find(u => u.id === team.leaderId);
          const memberList = users.filter(u => team.memberIds?.includes(u.id));
          const teamTasks = tasks.filter(t => t.teamId === team.id);
          const completedTasks = teamTasks.filter(t => t.status === 'Completed').length;
          const assignedProjects = projects.filter(p => team.projectIds?.includes(p.id) || p.teamId === team.id);

          return (
            <div
              key={team.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs hover:border-[#635BFF]/50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#635BFF]/10 text-[#635BFF] uppercase tracking-wider">
                    {team.department}
                  </span>
                  <div className="flex items-center gap-1">
                    {permissions.canManageTeams && (
                      <>
                        <button
                          onClick={() => openEditModal(team)}
                          className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete squad "${team.name}"?`)) removeTeam(team.id);
                          }}
                          className="p-1 rounded text-[var(--text-sec)] hover:text-[#E05252] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <h3
                  onClick={() => setActiveTeamDetail(team)}
                  className="font-bold text-base text-[var(--text-main)] hover:text-[#635BFF] cursor-pointer transition-colors"
                >
                  {team.name}
                </h3>
                <p className="text-xs text-[var(--text-sec)] mt-1 line-clamp-2">{team.description}</p>

                {/* Team Leader Badge */}
                {leader && (
                  <div className="mt-4 p-2.5 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#1E6091] text-white text-[10px] font-bold flex items-center justify-center shrink-0 border border-[#1E6091] tracking-wider">
                      {getInitials(leader.name)}
                    </div>
                    <div className="overflow-hidden text-xs">
                      <span className="text-[10px] text-[var(--text-sec)] block leading-none">Project Manager</span>
                      <span className="font-semibold text-[var(--text-main)] truncate">{leader.name}</span>
                    </div>
                  </div>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[var(--border)] text-xs text-[var(--text-sec)]">
                  <div>
                    <span className="text-[10px] block">Active Tasks</span>
                    <span className="font-bold text-[var(--text-main)]">{teamTasks.length} ({completedTasks} done)</span>
                  </div>
                  <div>
                    <span className="text-[10px] block">Projects</span>
                    <span className="font-bold text-[var(--text-main)]">{assignedProjects.length}</span>
                  </div>
                </div>
              </div>

              {/* Members preview */}
              <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
                <div className="flex -space-x-2 overflow-hidden">
                  {memberList.slice(0, 4).map(m => (
                    <div
                      key={m.id}
                      title={m.name}
                      className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#1E6091] text-white text-[9px] font-bold ring-2 ring-[var(--surface)] tracking-wider"
                    >
                      {getInitials(m.name)}
                    </div>
                  ))}
                  {memberList.length > 4 && (
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--bg-main)] border border-[var(--border)] text-[9px] font-bold text-[var(--text-sec)]">
                      +{memberList.length - 4}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setActiveTeamDetail(team)}
                  className="text-xs text-[#635BFF] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Details <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Team Details Modal */}
      {activeTeamDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#635BFF] tracking-wider">Squad Profile</span>
                <h3 className="font-bold text-lg text-[var(--text-main)]">{activeTeamDetail.name}</h3>
              </div>
              <button onClick={() => setActiveTeamDetail(null)} className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-[var(--text-sec)]">{activeTeamDetail.description}</p>

              <div>
                <h4 className="text-xs font-bold text-[var(--text-main)] mb-2">Team Members ({activeTeamDetail.memberIds?.length || 0})</h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {users.filter(u => activeTeamDetail.memberIds?.includes(u.id)).map(u => (
                    <div key={u.id} className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-main)] text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#1E6091] text-white text-[9px] font-bold flex items-center justify-center shrink-0 tracking-wider">
                          {getInitials(u.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--text-main)]">{u.name}</p>
                          <p className="text-[10px] text-[var(--text-sec)]">{u.designation}</p>
                        </div>
                      </div>
                      {u.id === activeTeamDetail.leaderId && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#635BFF]/10 text-[#635BFF] font-bold">Leader</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Team Assigned Tasks */}
              <div>
                <h4 className="text-xs font-bold text-[var(--text-main)] mb-2">
                  Assigned Team Tasks ({tasks.filter(t => t.teamId === activeTeamDetail.id).length})
                </h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {tasks.filter(t => t.teamId === activeTeamDetail.id).length === 0 ? (
                    <p className="text-xs text-[var(--text-sec)]">No tasks assigned to this team.</p>
                  ) : (
                    tasks.filter(t => t.teamId === activeTeamDetail.id).map(tk => (
                      <div key={tk.id} className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-xs">
                        <div>
                          <p className="font-semibold text-[var(--text-main)]">{tk.title}</p>
                          <p className="text-[10px] text-[var(--text-sec)]">
                            {tk.assigneeId ? `Assignee: ${users.find(u => u.id === tk.assigneeId)?.name || 'Member'}` : 'Entire Squad'} • Due: {tk.dueDate}
                          </p>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                          tk.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500' :
                          tk.status === 'In Progress' ? 'bg-[#635BFF]/10 text-[#635BFF]' :
                          'bg-amber-500/10 text-amber-500'
                        }`}>
                          {tk.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setActiveTeamDetail(null)}
                  className="px-4 py-2 text-xs bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] rounded-lg hover:bg-[var(--border)] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Form Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <h3 className="font-bold text-base text-[var(--text-main)]">
                {editingTeam ? 'Edit Squad' : 'Create New Squad'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && <p role="alert" className="text-sm text-red-600">{submitError}</p>}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Squad Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Project Manager</label>
                  <select
                    value={formData.leaderId}
                    onChange={(e) => setFormData({ ...formData, leaderId: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  >
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Mission / Description</label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1.5">Assign Members</label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 border border-[var(--border)] rounded-lg bg-[var(--bg-main)]">
                  {users.map(u => (
                    <label key={u.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.memberIds.includes(u.id)}
                        onChange={() => toggleMemberSelection(u.id)}
                        className="rounded text-[#635BFF]"
                      />
                      <span className="truncate">{u.name}</span>
                    </label>
                  ))}
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
                    <span>Save Squad</span>
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


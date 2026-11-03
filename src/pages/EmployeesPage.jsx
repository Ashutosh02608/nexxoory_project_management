import React, { useState } from 'react';
import { UserCircle2, Plus, Search, Edit2, Trash2, Mail, Briefcase, Building, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function EmployeesPage() {
  const { users, updateUser, removeUser, tasks, projects, permissions } = useApp();

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [activeProfile, setActiveProfile] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    designation: '',
    department: 'Frontend Core',
    role: 'team_member',
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      designation: '',
      department: 'Frontend Core',
      role: 'team_member',
      status: 'Active',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
    });
    setModalOpen(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setFormData(u);
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateUser({
      ...formData,
      id: editingUser ? editingUser.id : undefined
    });
    setModalOpen(false);
  };

  const filteredUsers = users.filter(u => {
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
          <option value="Executive">Executive</option>
          <option value="Product Delivery">Product Delivery</option>
          <option value="Frontend Core">Frontend Core</option>
          <option value="DevOps & Infrastructure">DevOps & Infrastructure</option>
          <option value="Design Studio">Design Studio</option>
          <option value="Quality Assurance">Quality Assurance</option>
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
                    <img src={u.avatar} alt={u.name} className="w-12 h-12 rounded-full object-cover border border-[#635BFF]" />
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
                      onClick={() => {
                        if (window.confirm(`Remove employee ${u.name}?`)) removeUser(u.id);
                      }}
                      className="p-1 rounded text-[var(--text-sec)] hover:text-[#E05252] cursor-pointer"
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
              <img src={activeProfile.avatar} alt={activeProfile.name} className="w-16 h-16 rounded-full object-cover border-2 border-[#635BFF]" />
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
              <button onClick={() => setModalOpen(false)} className="p-1 text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

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
                    <option value="Executive">Executive</option>
                    <option value="Product Delivery">Product Delivery</option>
                    <option value="Frontend Core">Frontend Core</option>
                    <option value="DevOps & Infrastructure">DevOps & Infrastructure</option>
                    <option value="Design Studio">Design Studio</option>
                    <option value="Quality Assurance">Quality Assurance</option>
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
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs bg-[#635BFF] hover:bg-[#4942D9] text-white font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


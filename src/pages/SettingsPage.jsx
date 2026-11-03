import React, { useState } from 'react';
import { User, Moon, Shield, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AuthAPI } from '../services/api';
import { getInitials } from '../utils/avatar';

export default function SettingsPage() {
  const { currentUser, updateUser, theme, toggleTheme } = useApp();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'security', 'appearance'
  const [name, setName] = useState(currentUser?.name || '');
  const [email] = useState(currentUser?.email || '');
  const [designation, setDesignation] = useState(currentUser?.designation || '');

  // Password Change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    updateUser({
      ...currentUser,
      name,
      designation
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdMsg('');
    setPwdError('');

    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPwdError('Password must be at least 8 characters long');
      return;
    }

    setPwdLoading(true);
    try {
      await AuthAPI.changePassword(currentPassword, newPassword);
      setPwdMsg('Password updated successfully! Please re-login with new credentials.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwdError(err.message || 'Failed to change password. Verify current password.');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">Organization & Personal Settings</h1>
        <p className="text-xs sm:text-sm text-[var(--text-sec)] mt-0.5">
          Configure profile details, theme appearance, security credentials, and account settings.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] space-x-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${activeTab === 'profile' ? 'border-[#1E6091] text-[#1E6091] dark:text-[#38BDF8]' : 'border-transparent text-[var(--text-sec)]'}`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${activeTab === 'security' ? 'border-[#1E6091] text-[#1E6091] dark:text-[#38BDF8]' : 'border-transparent text-[var(--text-sec)]'}`}
        >
          Security & Password
        </button>
        <button
          onClick={() => setActiveTab('appearance')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${activeTab === 'appearance' ? 'border-[#1E6091] text-[#1E6091] dark:text-[#38BDF8]' : 'border-transparent text-[var(--text-sec)]'}`}
        >
          Appearance
        </button>
      </div>

      {/* Profile Form */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-[var(--border)]">
            <div className="w-16 h-16 rounded-full bg-[#1E6091] text-white text-lg font-bold flex items-center justify-center shrink-0 border-2 border-[#1E6091] tracking-wider">
              {getInitials(currentUser?.name)}
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--text-main)]">{currentUser?.name}</h3>
              <p className="text-xs text-[var(--text-sec)] capitalize">{currentUser?.role?.replace('_', ' ')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Email Address (Managed)</label>
              <input
                type="email"
                disabled
                value={email}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-sec)] opacity-70 outline-none cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Designation</label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <span className="text-xs text-[#16A36A] font-semibold">{savedNotice ? 'Profile changes saved!' : ''}</span>
            <button
              type="submit"
              className="px-5 py-2 text-xs bg-[#1E6091] hover:bg-[#143A52] text-white font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Save Profile
            </button>
          </div>
        </form>
      )}

      {/* Security & Password Tab */}
      {activeTab === 'security' && (
        <form onSubmit={handleChangePassword} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs space-y-4 max-w-xl">
          <div>
            <h3 className="font-bold text-sm text-[var(--text-main)] mb-1">Update Password</h3>
            <p className="text-xs text-[var(--text-sec)]">
              Ensure your account uses a strong password with at least 8 characters.
            </p>
          </div>

          {pwdError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{pwdError}</span>
            </div>
          )}

          {pwdMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{pwdMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={pwdLoading}
              className="px-5 py-2 text-xs bg-[#1E6091] hover:bg-[#143A52] text-white font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {pwdLoading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      )}

      {/* Appearance Tab */}
      {activeTab === 'appearance' && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-[var(--text-main)]">Color Scheme</h3>
              <p className="text-xs text-[var(--text-sec)]">Switch between light and dark themes.</p>
            </div>
            <button
              onClick={toggleTheme}
              className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold hover:bg-[var(--bg-main)] transition-colors cursor-pointer flex items-center gap-2"
            >
              <Moon className="w-4 h-4" />
              <span>Current: {theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { User, Moon, Shield, Volume2, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AuthAPI } from '../services/api';
import { getInitials } from '../utils/avatar';
import { SOUND_PROFILES, getSoundPreferences, saveSoundPreferences, playSound } from '../utils/soundEffects';

export default function SettingsPage() {
  const { currentUser, updateUser, theme, toggleTheme } = useApp();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'security', 'appearance', 'sounds'
  const [name, setName] = useState(currentUser?.name || '');
  const [email] = useState(currentUser?.email || '');
  const [designation, setDesignation] = useState(currentUser?.designation || '');

  // Sound preferences state
  const [soundPrefs, setSoundPrefs] = useState(() => getSoundPreferences(currentUser?.id));
  const [soundSavedNotice, setSoundSavedNotice] = useState(false);

  const handleUpdateSoundPrefs = (patch) => {
    const updated = { ...soundPrefs, ...patch };
    setSoundPrefs(updated);
    saveSoundPreferences(currentUser?.id, updated);
    setSoundSavedNotice(true);
    setTimeout(() => setSoundSavedNotice(false), 2000);
  };

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
        <button
          onClick={() => setActiveTab('sounds')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${activeTab === 'sounds' ? 'border-[#1E6091] text-[#1E6091] dark:text-[#38BDF8]' : 'border-transparent text-[var(--text-sec)]'}`}
        >
          Sound Alerts
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

      {/* Sound Alerts Tab */}
      {activeTab === 'sounds' && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
            <div>
              <h3 className="font-bold text-sm text-[var(--text-main)]">Audible Chimes & Alerts</h3>
              <p className="text-xs text-[var(--text-sec)]">
                Synthesized client-side via Web Audio API. Instant, zero external sound files.
              </p>
            </div>
            {soundSavedNotice && (
              <span className="text-xs text-[#16A36A] font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Preferences saved
              </span>
            )}
          </div>

          {/* Notifications Chime */}
          <div className="space-y-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-main)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[#1E6091]" />
                <span className="font-semibold text-xs text-[var(--text-main)]">System Notifications Chime</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={soundPrefs.notificationsEnabled}
                  onChange={(e) => handleUpdateSoundPrefs({ notificationsEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1E6091]"></div>
              </label>
            </div>

            {soundPrefs.notificationsEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-sec)] mb-1">Sound Tone</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={soundPrefs.notificationSound}
                      onChange={(e) => handleUpdateSoundPrefs({ notificationSound: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] outline-none"
                    >
                      {Object.values(SOUND_PROFILES).map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => playSound(soundPrefs.notificationSound, soundPrefs.notificationVolume)}
                      className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] cursor-pointer"
                      title="Test Notification Sound"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-[var(--text-sec)] mb-1">
                    <span>Volume</span>
                    <span>{soundPrefs.notificationVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={soundPrefs.notificationVolume}
                    onChange={(e) => handleUpdateSoundPrefs({ notificationVolume: Number(e.target.value) })}
                    className="w-full accent-[#1E6091] cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Messaging Chime */}
          <div className="space-y-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-main)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[#16A36A]" />
                <span className="font-semibold text-xs text-[var(--text-main)]">New Direct / Channel Message Chime</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={soundPrefs.messagesEnabled}
                  onChange={(e) => handleUpdateSoundPrefs({ messagesEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#16A36A]"></div>
              </label>
            </div>

            {soundPrefs.messagesEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-sec)] mb-1">Sound Tone</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={soundPrefs.messageSound}
                      onChange={(e) => handleUpdateSoundPrefs({ messageSound: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] outline-none"
                    >
                      {Object.values(SOUND_PROFILES).map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => playSound(soundPrefs.messageSound, soundPrefs.messageVolume)}
                      className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] cursor-pointer"
                      title="Test Message Sound"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-[var(--text-sec)] mb-1">
                    <span>Volume</span>
                    <span>{soundPrefs.messageVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={soundPrefs.messageVolume}
                    onChange={(e) => handleUpdateSoundPrefs({ messageVolume: Number(e.target.value) })}
                    className="w-full accent-[#16A36A] cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { Settings as SettingsIcon, User, Moon, Shield, Bell, Building, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function SettingsPage() {
  const { currentUser, updateUser, theme, toggleTheme } = useApp();

  const [activeTab, setActiveTab] = useState('profile');
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [designation, setDesignation] = useState(currentUser.designation);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    updateUser({
      ...currentUser,
      name,
      email,
      designation
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">Organization & Personal Settings</h1>
        <p className="text-xs sm:text-sm text-[var(--text-sec)] mt-0.5">
          Configure profile details, theme appearance, enterprise notifications, and credential access.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] space-x-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${activeTab === 'profile' ? 'border-[#635BFF] text-[#635BFF]' : 'border-transparent text-[var(--text-sec)]'}`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('appearance')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${activeTab === 'appearance' ? 'border-[#635BFF] text-[#635BFF]' : 'border-transparent text-[var(--text-sec)]'}`}
        >
          Appearance
        </button>
        <button
          onClick={() => setActiveTab('organization')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${activeTab === 'organization' ? 'border-[#635BFF] text-[#635BFF]' : 'border-transparent text-[var(--text-sec)]'}`}
        >
          Organization
        </button>
      </div>

      {/* Profile Form */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-[var(--border)]">
            <img src={currentUser.avatar} alt={currentUser.name} className="w-16 h-16 rounded-full object-cover border-2 border-[#635BFF]" />
            <div>
              <h3 className="font-bold text-sm text-[var(--text-main)]">{currentUser.name}</h3>
              <p className="text-xs text-[var(--text-sec)] capitalize">{currentUser.role.replace('_', ' ')}</p>
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
              <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
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
            {savedNotice ? (
              <span className="text-xs text-[#16A36A] flex items-center gap-1 font-semibold">
                <Check className="w-4 h-4" /> Preferences saved in localStorage!
              </span>
            ) : <span />}

            <button
              type="submit"
              className="px-5 py-2 text-xs bg-[#635BFF] hover:bg-[#4942D9] text-white font-semibold rounded-lg shadow-xs cursor-pointer"
            >
              Update Profile
            </button>
          </div>
        </form>
      )}

      {/* Appearance Settings */}
      {activeTab === 'appearance' && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-[var(--text-main)]">Theme & Visual Experience</h3>
          <p className="text-xs text-[var(--text-sec)]">
            Toggle high-contrast enterprise dark mode or clean minimal daylight mode.
          </p>

          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
            <div>
              <p className="font-semibold text-xs text-[var(--text-main)]">Dark Mode</p>
              <p className="text-[10px] text-[var(--text-sec)]">Currently {theme === 'dark' ? 'enabled' : 'disabled'}</p>
            </div>
            <button
              onClick={toggleTheme}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#635BFF] text-white cursor-pointer"
            >
              Toggle ({theme === 'dark' ? 'Light' : 'Dark'})
            </button>
          </div>
        </div>
      )}

      {/* Organization Settings */}
      {activeTab === 'organization' && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-[var(--text-main)]">Nexxoory Enterprise Instance</h3>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
              <span className="text-[var(--text-sec)] block text-[10px]">Workspace Identifier</span>
              <span className="font-mono font-bold text-[var(--text-main)]">org-nexxoory-solutions-production</span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
              <span className="text-[var(--text-sec)] block text-[10px]">Execution Mode</span>
              <span className="font-semibold text-[#16A36A]">Client-Side React SPA with Reactive LocalStorage</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


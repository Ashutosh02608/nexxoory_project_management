import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock,
  Mail,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import logoImg from '../assets/nexxoory_logo.webp';

export default function LoginPage() {
  const { users, switchUser } = useApp();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('login'); // 'login', 'forgot', 'reset'
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || 'usr-admin');
  const [email, setEmail] = useState('admin@nexxoory.com');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  // Cursor position for background spotlight
  const [cursorPos, setCursorPos] = useState({ x: -1000, y: -1000 });

  const handleMouseMove = (e) => {
    setCursorPos({ x: e.clientX, y: e.clientY });
  };

  const handlePersonaSelect = (user) => {
    setSelectedUserId(user.id);
    setEmail(user.email);
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    switchUser(selectedUserId);
    navigate('/');
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    setSuccessMsg(`Recovery token sent to ${email}`);
    setTimeout(() => {
      setActiveTab('reset');
      setSuccessMsg('');
    }, 1200);
  };

  const handleResetSubmit = (e) => {
    e.preventDefault();
    setSuccessMsg('Password updated! Redirecting...');
    setTimeout(() => {
      switchUser(selectedUserId);
      navigate('/');
    }, 1000);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="h-screen w-screen bg-[var(--bg-main)] flex flex-col justify-between overflow-hidden relative select-none p-4 sm:p-6"
    >
      
      {/* 1. CURSOR SPOTLIGHT LAYER: Layered behind the login card (z-0) */}
      <div
        className="fixed pointer-events-none rounded-full blur-2xl transition-transform duration-75 ease-out -translate-x-1/2 -translate-y-1/2 z-0"
        style={{
          left: `${cursorPos.x}px`,
          top: `${cursorPos.y}px`,
          width: '450px',
          height: '450px',
          background: 'radial-gradient(circle, rgba(30, 96, 145, 0.22) 0%, rgba(82, 182, 154, 0.08) 45%, transparent 75%)'
        }}
      />

      {/* 2. ISOLATED AUTONOMOUS BACKGROUND ANIMATIONS (Drift, Orbit, and Ambient Beams) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Animated Drifting Dot Matrix Grid */}
        <div
          className="absolute inset-0 opacity-[0.45] dark:opacity-[0.25] animate-grid-drift"
          style={{
            backgroundImage: `radial-gradient(var(--text-sec) 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />

        {/* Ambient Pulsing Glow Beams */}
        <div className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[850px] h-[450px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1E6091]/30 via-[#52B69A]/15 to-transparent blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#52B69A]/20 blur-3xl animate-pulse-reverse" />
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#1E6091]/20 blur-3xl animate-pulse-slow" />

        {/* Revolving Concentric Orbital Rings */}
        <div className="absolute top-1/2 left-1/2 w-[620px] h-[620px] rounded-full border border-[#1E6091]/20 dark:border-[#38BDF8]/15 animate-orbit-cw pointer-events-none">
          <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#1E6091] shadow-[0_0_10px_#1E6091]" />
        </div>

        <div className="absolute top-1/2 left-1/2 w-[860px] h-[860px] rounded-full border border-dashed border-[#52B69A]/25 dark:border-[#52B69A]/15 animate-orbit-ccw pointer-events-none">
          <span className="absolute bottom-0 right-1/4 translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-[#52B69A] shadow-[0_0_8px_#52B69A]" />
        </div>

        <div className="absolute top-1/2 left-1/2 w-[1100px] h-[1100px] rounded-full border border-[#1E6091]/10 pointer-events-none animate-orbit-cw">
          <span className="absolute top-1/3 left-0 -translate-x-1/2 w-3 h-3 rounded-full bg-[#34A0A4]/60 blur-[1px]" />
        </div>

        {/* Subtle Tech Coordinates */}
        <div className="absolute top-12 left-12 text-[var(--border)] font-mono text-[10px] select-none opacity-60">
          + 24.198° N // NEXXOORY_SYSTEMS
        </div>
        <div className="absolute bottom-12 right-12 text-[var(--border)] font-mono text-[10px] select-none opacity-60">
          SECURE_NODE_01 // 99.98%
        </div>
      </div>

      {/* Top compact brand header */}
      <header className="flex items-center justify-between max-w-5xl mx-auto w-full shrink-0 relative z-20">
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
            <img src={logoImg} alt="Logo" className="h-7 w-auto object-contain" />
          </div>
          <span className="font-extrabold text-xs tracking-wider text-[var(--text-main)] uppercase">
            Nexxoory Solutions
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[var(--text-sec)]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Demo Environment</span>
        </div>
      </header>

      {/* Center Login Card Container (Opaque Solid Card Layered High at z-20 with Shadow Masking) */}
      <main className="flex items-center justify-center shrink-0 relative z-20">
        <div className="w-full max-w-sm sm:max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-3xl shadow-[0_20px_45px_-12px_rgba(30,96,145,0.28)] p-6 sm:p-7 relative z-20">
          
          {/* Logo with Spotlight Glow */}
          <div className="flex flex-col items-center mb-4">
            <div className="relative group mb-2">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#1E6091] via-[#52B69A] to-[#34A0A4] opacity-35 blur-md group-hover:opacity-60 transition duration-500" />
              <div className="relative p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[0_8px_20px_-4px_rgba(30,96,145,0.3)]">
                <img
                  src={logoImg}
                  alt="Nexxoory"
                  className="h-16 w-auto object-contain drop-shadow"
                />
              </div>
            </div>

            <h1 className="text-lg font-extrabold text-[var(--text-main)] tracking-tight">
              {activeTab === 'login' && 'Sign in to Nexxoory'}
              {activeTab === 'forgot' && 'Reset Password'}
              {activeTab === 'reset' && 'Create New Password'}
            </h1>
            <p className="text-[11px] text-[var(--text-sec)] text-center mt-0.5">
              {activeTab === 'login' && 'Select a demo persona or enter account credentials.'}
              {activeTab === 'forgot' && 'Enter your email to receive recovery instructions.'}
              {activeTab === 'reset' && 'Enter your replacement credential.'}
            </p>
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[11px] font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1-Click Role Switch */}
          {activeTab === 'login' && (
            <div className="mb-3.5">
              <span className="text-[9px] font-bold text-[var(--text-sec)] uppercase tracking-wider block mb-1.5">
                Quick Role Switch
              </span>
              <div className="grid grid-cols-3 gap-2">
                {users.slice(0, 3).map((u) => {
                  const isSelected = selectedUserId === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handlePersonaSelect(u)}
                      className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#1E6091] dark:border-[#38BDF8] bg-[#1E6091]/10 shadow-xs'
                          : 'border-[var(--border)] bg-[var(--bg-main)] hover:border-[#1E6091]/40'
                      }`}
                    >
                      <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full object-cover border border-[#1E6091]" />
                      <div className="text-center leading-tight">
                        <p className="text-[10px] font-bold text-[var(--text-main)] truncate max-w-[70px]">{u.name.split(' ')[0]}</p>
                        <p className="text-[8px] text-[#1E6091] dark:text-[#38BDF8] font-semibold capitalize truncate max-w-[70px]">
                          {u.role === 'project_manager' ? 'PM' : u.role.replace('_', ' ')}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* LOGIN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-main)] mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-[var(--text-sec)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[#1E6091]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-[var(--text-main)]">Password</label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('forgot')}
                    className="text-[10px] text-[#1E6091] dark:text-[#38BDF8] hover:underline cursor-pointer"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-[var(--text-sec)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-8 pr-9 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[#1E6091]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-sec)] hover:text-[var(--text-main)] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-sec)]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded text-[#1E6091]"
                  />
                  <span>Remember me</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-gradient-to-r from-[#1E6091] to-[#143A52] hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[#1E6091]/25 mt-1"
              >
                <span>Enter Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {activeTab === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-main)] mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-[var(--text-sec)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-[#1E6091] hover:bg-[#143A52] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Send Reset Link</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className="text-[11px] text-[var(--text-sec)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  ← Back to sign in
                </button>
              </div>
            </form>
          )}

          {/* RESET PASSWORD FORM */}
          {activeTab === 'reset' && (
            <form onSubmit={handleResetSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-main)] mb-1">New Password</label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-[var(--text-sec)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="New password"
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text-main)] mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-[var(--text-sec)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="Confirm password"
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-[#1E6091] hover:bg-[#143A52] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Update & Launch</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[10px] text-[var(--text-sec)] shrink-0 py-1 relative z-20">
        <p>© 2026 Nexxoory Solutions Pvt. Ltd. • Project Management Suite</p>
      </footer>
    </div>
  );
}

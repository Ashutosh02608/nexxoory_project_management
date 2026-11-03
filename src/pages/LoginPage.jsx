import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock,
  Mail,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AuthAPI } from '../services/api';
import logoImg from '../assets/nexxoory_logo.webp';

export default function LoginPage() {
  const { login, users } = useApp();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('login'); // 'login', 'forgot', 'reset'
  const [email, setEmail] = useState('admin@nexxoory.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Cursor position for background spotlight using direct transform & lerp for zero lag + buttery smoothness
  const spotlightRef = useRef(null);
  const targetPos = useRef({ x: -1000, y: -1000 });
  const currentPos = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    let animId;
    const updateSpotlight = () => {
      // 0.22 lerp smoothing factor
      currentPos.current.x += (targetPos.current.x - currentPos.current.x) * 0.22;
      currentPos.current.y += (targetPos.current.y - currentPos.current.y) * 0.22;

      if (spotlightRef.current) {
        spotlightRef.current.style.transform = `translate3d(${currentPos.current.x}px, ${currentPos.current.y}px, 0) translate(-50%, -50%)`;
      }
      animId = requestAnimationFrame(updateSpotlight);
    };

    animId = requestAnimationFrame(updateSpotlight);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleMouseMove = (e) => {
    targetPos.current.x = e.clientX;
    targetPos.current.y = e.clientY;
  };

  const handlePersonaSelect = (user) => {
    setEmail(user.email);
    setPassword('admin123');
    setErrorMsg('');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await AuthAPI.forgotPassword(email);
      setSuccessMsg(res.message || 'If an account exists, a recovery token has been processed.');
      if (res.data?.devToken) {
        setResetToken(res.data.devToken);
      }
      setTimeout(() => {
        setActiveTab('reset');
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message || 'Unable to request password recovery.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await AuthAPI.resetPassword(resetToken, newPassword);
      setSuccessMsg('Password successfully updated! Redirecting to login...');
      setTimeout(() => {
        setActiveTab('login');
        setPassword(newPassword);
        setSuccessMsg('');
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reset password. Token may be expired or invalid.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="h-screen w-screen bg-[var(--bg-main)] flex flex-col justify-between overflow-hidden relative select-none p-4 sm:p-6"
    >
      {/* 1. CURSOR SPOTLIGHT LAYER */}
      <div
        ref={spotlightRef}
        className="fixed top-0 left-0 pointer-events-none rounded-full blur-2xl z-0 will-change-transform"
        style={{
          width: '450px',
          height: '450px',
          transform: 'translate3d(-1000px, -1000px, 0) translate(-50%, -50%)',
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

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="Nexxoory" className="h-10 w-auto object-contain" />
        </div>
        <div className="text-xs text-[var(--text-sec)]">
          Production Security: <span className="font-semibold text-[#16A36A]">Argon2id + JWT</span>
        </div>
      </header>

      {/* Main Card Viewport */}
      <div className="relative z-10 flex items-center justify-center flex-1 my-auto">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-8 backdrop-blur-md">
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
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">
              {activeTab === 'login' && 'Sign in to Nexxoory'}
              {activeTab === 'forgot' && 'Reset Your Password'}
              {activeTab === 'reset' && 'Create New Password'}
            </h2>
            <p className="text-xs text-[var(--text-sec)] mt-1">
              {activeTab === 'login' && 'Enter your organizational credentials'}
              {activeTab === 'forgot' && 'Enter registered email to generate recovery token'}
              {activeTab === 'reset' && 'Provide valid reset token and new credentials'}
            </p>
          </div>

          {/* Feedback alerts */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--text-sec)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@nexxoory.com"
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[#1E6091] transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[var(--text-main)]">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('forgot');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="text-[11px] text-[#1E6091] dark:text-[#38BDF8] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-sec)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[#1E6091] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-sec)] hover:text-[var(--text-main)]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 rounded-xl bg-[#1E6091] hover:bg-[#143A52] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Authenticate</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {activeTab === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--text-sec)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@nexxoory.com"
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-[#1E6091] hover:bg-[#143A52] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : 'Generate Recovery Token'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="text-xs text-[var(--text-sec)] hover:underline cursor-pointer"
                >
                  ← Back to login
                </button>
              </div>
            </form>
          )}

          {/* RESET PASSWORD FORM */}
          {activeTab === 'reset' && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Recovery Token</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[var(--text-sec)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Paste 64-char hex token"
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-sec)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-[#16A36A] hover:bg-[#128354] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Updating...' : 'Set New Password'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="text-xs text-[var(--text-sec)] hover:underline cursor-pointer"
                >
                  ← Cancel and return to login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <footer className="relative z-10 text-center text-[11px] text-[var(--text-sec)]">
        &copy; 2026 Nexxoory Solutions. Enterprise Project Delivery Architecture.
      </footer>
    </div>
  );
}

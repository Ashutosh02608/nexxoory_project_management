// Web Audio API Sound Synthesizer for system chime alerts
// Zero external asset dependencies - runs 100% locally in browser

let audioCtx = null;
export let audioInitialized = false;

export function initAudioSystem() {
  if (typeof window === 'undefined') return;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx) {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => {
        audioInitialized = true;
      }).catch(() => {});
    } else if (audioCtx.state === 'running') {
      audioInitialized = true;
    }
  }
}

// Global user interaction listener to unlock AudioContext across modern browser autoplay policies
if (typeof window !== 'undefined') {
  const unlockEvents = ['click', 'touchstart', 'keydown'];
  const handleUnlock = () => {
    initAudioSystem();
    if (audioCtx && audioCtx.state === 'running') {
      unlockEvents.forEach(evt => window.removeEventListener(evt, handleUnlock, true));
    }
  };
  unlockEvents.forEach(evt => window.addEventListener(evt, handleUnlock, { capture: true, passive: true }));
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    initAudioSystem();
  } else if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export const SOUND_PROFILES = {
  default: { id: 'default', label: 'Default Bell' },
  soft_bell: { id: 'soft_bell', label: 'Soft Bell' },
  digital: { id: 'digital', label: 'Digital Beep' },
  subtle_pop: { id: 'subtle_pop', label: 'Subtle Pop' },
  classic_chime: { id: 'classic_chime', label: 'Classic Chime' }
};

export const getSoundPreferences = (userId) => {
  const fallback = {
    notificationsEnabled: true,
    notificationSound: 'default',
    notificationVolume: 70,
    messagesEnabled: true,
    messageSound: 'classic_chime',
    messageVolume: 70
  };
  if (!userId || typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(`nx_sound_prefs_${userId}`);
    if (raw) return { ...fallback, ...JSON.parse(raw) };
  } catch (e) {
    console.error('Failed reading sound preferences', e);
  }
  return fallback;
};

export const saveSoundPreferences = (userId, prefs) => {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`nx_sound_prefs_${userId}`, JSON.stringify(prefs));
  } catch (e) {
    console.error('Failed saving sound preferences', e);
  }
};

export function playSound(soundKey = 'default', volumePercent = 70) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const masterGain = ctx.createGain();
    const vol = Math.max(0, Math.min(100, volumePercent)) / 100 * 0.35; // gentle ceiling
    masterGain.gain.setValueAtTime(vol, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (soundKey) {
      case 'soft_bell': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); // A5
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.8);
        break;
      }
      case 'digital': {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(659.25, now); // E5
        osc1.frequency.setValueAtTime(987.77, now + 0.08); // B5
        gain1.gain.setValueAtTime(vol, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        osc1.connect(gain1);
        gain1.connect(masterGain);
        osc1.start(now);
        osc1.stop(now + 0.25);
        break;
      }
      case 'subtle_pop': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);
        gain.gain.setValueAtTime(vol * 1.2, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }
      case 'classic_chime': {
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.setValueAtTime(vol * 0.8, now + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.4);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.4);
        });
        break;
      }
      case 'default':
      default: {
        // Crisp dual ding
        const notes = [587.33, 880]; // D5, A5
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.setValueAtTime(vol, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 0.5);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.5);
        });
        break;
      }
    }
  } catch (err) {
    console.warn('Audio playback restricted or not supported:', err);
  }
}

export function playNotificationChime(userId) {
  if (!userId) return;
  const prefs = getSoundPreferences(userId);
  if (!prefs.notificationsEnabled) return;
  playSound(prefs.notificationSound, prefs.notificationVolume);
}

export function playMessageChime(userId) {
  if (!userId) return;
  const prefs = getSoundPreferences(userId);
  if (!prefs.messagesEnabled) return;
  playSound(prefs.messageSound, prefs.messageVolume);
}

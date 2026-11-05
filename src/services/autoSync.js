/**
 * Centralized Application Event Bus & Cross-Tab Auto-Synchronization Engine.
 * Provides:
 * - Type-safe event dispatch and subscription.
 * - BroadcastChannel / localStorage fallback for multi-tab state sync.
 * - Debounced synchronization and loop-prevention.
 */

const SYNC_CHANNEL_NAME = 'nx_auto_sync_channel';
const STORAGE_SYNC_KEY = 'nx_auto_sync_event';

class AutoSyncBus {
  constructor() {
    this.listeners = new Map();
    this.channel = null;
    this.clientId = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `tab_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

    // Initialize BroadcastChannel if supported
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          this._handleIncoming(event.data);
        };
      } catch (e) {
        console.warn('[AUTO_SYNC] BroadcastChannel init failed, using storage fallback:', e);
      }
    }

    // Fallback: storage event listener for multi-tab sync across standard browsers
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_SYNC_KEY && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            this._handleIncoming(data);
          } catch {
            // Ignore malformed json
          }
        }
      });
    }
  }

  _handleIncoming(payload) {
    if (!payload || payload.senderId === this.clientId) return;
    const { event, data } = payload;
    if (!event) return;
    this._dispatchLocal(event, data, true);
  }

  _dispatchLocal(event, data, isRemote = false) {
    const handlers = this.listeners.get(event);
    if (handlers && handlers.size > 0) {
      handlers.forEach(fn => {
        try {
          fn(data, { isRemote, event });
        } catch (err) {
          console.error(`[AUTO_SYNC ERROR] Handler failed for "${event}":`, err);
        }
      });
    }

    // Also trigger wildcards or global observers
    const allHandlers = this.listeners.get('*');
    if (allHandlers && allHandlers.size > 0) {
      allHandlers.forEach(fn => {
        try {
          fn(event, data, { isRemote });
        } catch (err) {
          console.error(`[AUTO_SYNC ERROR] Wildcard handler failed for "${event}":`, err);
        }
      });
    }
  }

  /**
   * Subscribe to a specific sync event.
   * @param {string} event - Event name or '*'
   * @param {Function} handler - Callback(data, meta)
   * @returns {Function} Unsubscribe cleanup function
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);

    return () => {
      const set = this.listeners.get(event);
      if (set) {
        set.delete(handler);
        if (set.size === 0) this.listeners.delete(event);
      }
    };
  }

  /**
   * Emit an event locally and propagate across tabs.
   * @param {string} event - Event name
   * @param {any} data - Event payload
   * @param {boolean} broadcast - Broadcast to other tabs
   */
  emit(event, data = {}, broadcast = true) {
    // 1. Dispatch locally immediately
    this._dispatchLocal(event, data, false);

    // 2. Broadcast across tabs
    if (broadcast && typeof window !== 'undefined') {
      const payload = {
        senderId: this.clientId,
        timestamp: Date.now(),
        event,
        data
      };

      if (this.channel) {
        try {
          this.channel.postMessage(payload);
          return;
        } catch (e) {
          console.warn('[AUTO_SYNC] BroadcastChannel send failed:', e);
        }
      }

      // Storage fallback when the channel is unavailable or sending fails.
      try {
        localStorage.setItem(STORAGE_SYNC_KEY, JSON.stringify(payload));
      } catch {
        // storage quota exceeded or disabled
      }
    }
  }
}

export const autoSyncBus = new AutoSyncBus();

/**
 * Standardized Auto-Sync Event Types
 */
export const SYNC_EVENTS = {
  // Projects
  PROJECT_CREATED: 'project:created',
  PROJECT_UPDATED: 'project:updated',
  PROJECT_DELETED: 'project:deleted',

  // Tasks
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_DELETED: 'task:deleted',

  // Teams & Employees
  TEAM_UPDATED: 'team:updated',
  TEAM_DELETED: 'team:deleted',
  USER_UPDATED: 'user:updated',
  USER_DELETED: 'user:deleted',

  // Documents
  DOCUMENT_UPDATED: 'document:updated',
  DOCUMENT_DELETED: 'document:deleted',
  DOCUMENT_ACCESS_UPDATED: 'document:access_updated',

  // Calendar
  CALENDAR_EVENT_UPDATED: 'calendar:updated',
  CALENDAR_EVENT_DELETED: 'calendar:deleted',

  // Notifications & Announcements
  NOTIFICATION_READ: 'notification:read',
  NOTIFICATION_ALL_READ: 'notification:all_read',
  NOTIFICATION_DELETED: 'notification:deleted',
  NOTIFICATION_CREATED: 'notification:created',
  ANNOUNCEMENT_CREATED: 'announcement:created',
  ANNOUNCEMENT_DELETED: 'announcement:deleted',

  // Messaging
  MESSAGE_SENT: 'message:sent',
  MESSAGE_UPDATED: 'message:updated',
  MESSAGE_REACTION: 'message:reaction',
  CONVERSATION_UPDATED: 'conversation:updated',

  // General App Sync
  APP_REFRESH: 'app:refresh',
  REALTIME_EVENT: 'realtime:event'
};


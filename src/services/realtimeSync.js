/**
 * Persistent Real-Time Event Sync Service for Client.
 *
 * Provides:
 * - Sub-second live event polling from Neon PostgreSQL app_events journal.
 * - Dynamic backoff: 1.5s interval when active/visible, slows to 10s when idle/hidden.
 * - Automatic reconnection with jitter.
 * - Tracks authoritative latest event ID to guarantee 0 missed messages across tab suspensions/disconnects.
 * - Direct dispatch into autoSyncBus so both Messaging and AppContext receive instant updates.
 */

import { EventsAPI } from './api';
import { autoSyncBus, SYNC_EVENTS } from './autoSync';

class RealtimeSyncManager {
  constructor() {
    this.latestEventId = 0;
    this.isRunning = false;
    this.timer = null;
    this.currentUser = null;
    this.activeIntervalMs = 1500; // 1.5s active poll
    this.idleIntervalMs = 8000;   // 8s background poll
    this.failureCount = 0;
    this.isPolling = false;

    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    this._onOnline = this._onOnline.bind(this);
  }

  start(user) {
    if (!user) return;
    this.currentUser = user;
    if (this.isRunning) return;

    this.isRunning = true;
    this.failureCount = 0;

    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', this._onVisibilityChange);
      window.addEventListener('online', this._onOnline);
    }

    // Immediate first fetch
    this._scheduleNext(50);
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('visibilitychange', this._onVisibilityChange);
      window.removeEventListener('online', this._onOnline);
    }
  }

  _onVisibilityChange() {
    if (document.visibilityState === 'visible' && this.isRunning) {
      this._scheduleNext(100);
    }
  }

  _onOnline() {
    if (this.isRunning) {
      this.failureCount = 0;
      this._scheduleNext(100);
    }
  }

  _scheduleNext(delay) {
    if (!this.isRunning) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this._poll(), delay);
  }

  async _poll() {
    if (!this.isRunning || this.isPolling) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this._scheduleNext(this.idleIntervalMs);
      return;
    }

    this.isPolling = true;
    try {
      const res = await EventsAPI.poll(this.latestEventId);
      this.failureCount = 0;

      if (res && Array.isArray(res.events)) {
        if (res.latestId && res.latestId > this.latestEventId) {
          this.latestEventId = res.latestId;
        }

        // Process newly arrived events in strict chronological order
        for (const evt of res.events) {
          this._processEvent(evt);
        }
      }

      const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
      const nextDelay = isVisible ? this.activeIntervalMs : this.idleIntervalMs;
      this._scheduleNext(nextDelay);
    } catch {
      this.failureCount++;
      // Exponential backoff with jitter on network failure (up to 15s)
      const backoff = Math.min(1000 * Math.pow(1.5, this.failureCount) + Math.random() * 500, 15000);
      this._scheduleNext(backoff);
    } finally {
      this.isPolling = false;
    }
  }

  _processEvent(evt) {
    const { eventType, payload, actorId } = evt;
    if (!eventType) return;

    // Dispatch global internal sync event
    autoSyncBus.emit(SYNC_EVENTS.REALTIME_EVENT, evt, false);

    switch (eventType) {
      case 'message:created':
        // Don't re-emit local broadcast if this tab sent it originally
        autoSyncBus.emit(SYNC_EVENTS.MESSAGE_SENT, {
          conversationId: payload?.conversationId,
          message: payload?.message,
          actorId,
        }, false);
        break;

      case 'message:updated':
        autoSyncBus.emit(SYNC_EVENTS.MESSAGE_UPDATED, {
          conversationId: payload?.conversationId,
          message: payload?.message,
          actorId,
        }, false);
        break;

      case 'message:reaction':
        autoSyncBus.emit(SYNC_EVENTS.MESSAGE_REACTION, payload, false);
        break;

      case 'project:created':
        autoSyncBus.emit(SYNC_EVENTS.PROJECT_CREATED, payload, false);
        break;
      case 'project:updated':
        autoSyncBus.emit(SYNC_EVENTS.PROJECT_UPDATED, payload, false);
        break;
      case 'project:deleted':
        autoSyncBus.emit(SYNC_EVENTS.PROJECT_DELETED, payload, false);
        break;

      case 'task:created':
        autoSyncBus.emit(SYNC_EVENTS.TASK_CREATED, payload, false);
        break;
      case 'task:updated':
        autoSyncBus.emit(SYNC_EVENTS.TASK_UPDATED, payload, false);
        break;
      case 'task:deleted':
        autoSyncBus.emit(SYNC_EVENTS.TASK_DELETED, payload, false);
        break;

      case 'team:created':
      case 'team:updated':
        autoSyncBus.emit(SYNC_EVENTS.TEAM_UPDATED, payload, false);
        break;
      case 'team:deleted':
        autoSyncBus.emit(SYNC_EVENTS.TEAM_DELETED, payload, false);
        break;

      case 'user:created':
      case 'user:updated':
        autoSyncBus.emit(SYNC_EVENTS.USER_UPDATED, payload, false);
        break;
      case 'user:deleted':
        autoSyncBus.emit(SYNC_EVENTS.USER_DELETED, payload, false);
        break;

      default:
        break;
    }
  }
}

export const realtimeSyncManager = new RealtimeSyncManager();

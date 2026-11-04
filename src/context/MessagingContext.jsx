/**
 * MessagingContext — Frontend-only localStorage messaging layer
 * Manages: conversations, messages, reactions, replies, read states, settings
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from './AppContext';

const MessagingContext = createContext(null);

const LS_KEY = 'nx_messaging_v1';

// ─── Stable ID helpers ─────────────────────────────────────────────────────
export const convId = {
  dm: (a, b) => `dm_${[a, b].sort().join('_')}`,
  project: (projectId) => `proj_${projectId}`,
  dept: (dept) => `dept_${dept.toLowerCase().replace(/\s+/g, '_')}`,
  announcements: () => 'channel_announcements',
};

// ─── Blank state factory ───────────────────────────────────────────────────
function blankState() {
  return {
    conversations: {},  // id → ConversationRecord
    messages: {},       // conversationId → Message[]
    readStates: {},     // conversationId → { userId → lastReadTs }
    settings: {},       // conversationId → { userId → { muted, pinned } }
  };
}

function loadFromLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return blankState();
    return JSON.parse(raw);
  } catch {
    return blankState();
  }
}

function saveToLS(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[Messaging] localStorage save failed', e);
  }
}

// ─── Derive project participants ──────────────────────────────────────────
function getProjectParticipants(project, teams, users) {
  const ids = new Set();
  if (project.managerId) ids.add(project.managerId);
  if (project.assignedManagerId) ids.add(project.assignedManagerId);
  (project.memberIds || []).forEach(id => ids.add(id));
  // team members
  (project.teamId ? [project.teamId] : []).forEach(tid => {
    const team = teams.find(t => t.id === tid);
    if (team) {
      (team.memberIds || []).forEach(mid => ids.add(mid));
      if (team.leaderId) ids.add(team.leaderId);
    }
  });
  return [...ids].filter(Boolean);
}

// ─── Provider ─────────────────────────────────────────────────────────────
export function MessagingProvider({ children }) {
  const { currentUser, users, projects, teams, addLocalNotification } = useApp();
  const [state, setState] = useState(() => loadFromLS());
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist on every change
  useEffect(() => {
    saveToLS(state);
  }, [state]);

  // ── Auto-generate / sync conversations whenever projects/users/teams change
  useEffect(() => {
    if (!users?.length) return;
    setState(prev => {
      const next = { ...prev, conversations: { ...prev.conversations } };

      // 1. Announcements channel (singleton)
      const annId = convId.announcements();
      if (!next.conversations[annId]) {
        next.conversations[annId] = {
          id: annId,
          type: 'announcements',
          name: 'Company Announcements',
          participantIds: users.filter(u => u.status !== 'inactive').map(u => u.id),
          isReadOnly: true,   // non-admins can't post
          createdAt: new Date().toISOString(),
          icon: '📢',
        };
      } else {
        // Sync participant list (active users only)
        next.conversations[annId] = {
          ...next.conversations[annId],
          participantIds: users.filter(u => u.status !== 'inactive').map(u => u.id),
        };
      }

      // 2. Department groups — derived from users.department
      const depts = [...new Set(users.filter(u => u.department).map(u => u.department))];
      depts.forEach(dept => {
        const cid = convId.dept(dept);
        const members = users.filter(u => u.department === dept && u.status !== 'inactive').map(u => u.id);
        if (!next.conversations[cid]) {
          next.conversations[cid] = {
            id: cid,
            type: 'department',
            name: `${dept} — Department Group`,
            department: dept,
            participantIds: members,
            isReadOnly: false,
            createdAt: new Date().toISOString(),
            icon: '🏢',
          };
        } else {
          next.conversations[cid] = {
            ...next.conversations[cid],
            participantIds: members,
          };
        }
      });

      // 3. Project groups — one per project
      (projects || []).forEach(project => {
        const cid = convId.project(project.id);
        const participants = getProjectParticipants(project, teams || [], users);
        const isArchived = project.status === 'archived' || project.status === 'completed';
        if (!next.conversations[cid]) {
          next.conversations[cid] = {
            id: cid,
            type: 'project',
            name: `${project.name} — Project Group`,
            projectId: project.id,
            participantIds: participants,
            isReadOnly: isArchived,
            createdAt: project.createdAt || new Date().toISOString(),
            icon: '📁',
          };
        } else {
          // Sync membership, preserve messages
          next.conversations[cid] = {
            ...next.conversations[cid],
            name: `${project.name} — Project Group`,
            participantIds: participants,
            isReadOnly: isArchived,
          };
        }
      });

      return next;
    });
  }, [users, projects, teams]);

  // ── Helper: add notification to AppContext notifications
  const pushNotification = useCallback((recipientId, text, conversationId) => {
    if (!addLocalNotification) return;
    const notif = {
      id: `notif_msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: 'message',
      message: text,
      conversationId,
      userId: recipientId,
      read: false,
      createdAt: new Date().toISOString(),
    };
    addLocalNotification(notif);
  }, [addLocalNotification]);

  // ── Send message
  const sendMessage = useCallback((conversationId, text, replyToId = null) => {
    if (!currentUser || !text?.trim()) return null;
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      conversationId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      text: text.trim(),
      replyToId,
      reactions: {},
      edited: false,
      deleted: false,
      timestamp: new Date().toISOString(),
    };
    setState(prev => {
      const msgs = [...(prev.messages[conversationId] || []), msg];
      return { ...prev, messages: { ...prev.messages, [conversationId]: msgs } };
    });

    // Notify other participants (not sender, not muted)
    const conv = stateRef.current.conversations[conversationId];
    if (conv) {
      (conv.participantIds || []).forEach(pid => {
        if (pid === currentUser.id) return;
        const userSettings = stateRef.current.settings[conversationId]?.[pid] || {};
        if (userSettings.muted) return;
        pushNotification(pid, `${currentUser.name}: ${text.slice(0, 60)}`, conversationId);
      });
    }

    return msg;
  }, [currentUser, pushNotification]);

  // ── Edit message
  const editMessage = useCallback((conversationId, messageId, newText) => {
    setState(prev => {
      const msgs = (prev.messages[conversationId] || []).map(m =>
        m.id === messageId && m.senderId === currentUser?.id
          ? { ...m, text: newText, edited: true }
          : m
      );
      return { ...prev, messages: { ...prev.messages, [conversationId]: msgs } };
    });
  }, [currentUser]);

  // ── Delete message
  const deleteMessage = useCallback((conversationId, messageId) => {
    setState(prev => {
      const msgs = (prev.messages[conversationId] || []).map(m =>
        m.id === messageId && m.senderId === currentUser?.id
          ? { ...m, deleted: true, text: '' }
          : m
      );
      return { ...prev, messages: { ...prev.messages, [conversationId]: msgs } };
    });
  }, [currentUser]);

  // ── Add / toggle reaction
  const addReaction = useCallback((conversationId, messageId, emoji) => {
    if (!currentUser) return;
    setState(prev => {
      const msgs = (prev.messages[conversationId] || []).map(m => {
        if (m.id !== messageId) return m;
        const reactors = m.reactions[emoji] || [];
        const already = reactors.includes(currentUser.id);
        return {
          ...m,
          reactions: {
            ...m.reactions,
            [emoji]: already
              ? reactors.filter(id => id !== currentUser.id)
              : [...reactors, currentUser.id],
          },
        };
      });
      return { ...prev, messages: { ...prev.messages, [conversationId]: msgs } };
    });
  }, [currentUser]);

  // ── Mark read
  const markRead = useCallback((conversationId) => {
    if (!currentUser) return;
    setState(prev => {
      const rs = { ...prev.readStates };
      rs[conversationId] = { ...(rs[conversationId] || {}), [currentUser.id]: new Date().toISOString() };
      return { ...prev, readStates: rs };
    });
  }, [currentUser]);

  // ── Start / get DM conversation
  const startDM = useCallback((otherUserId) => {
    const cid = convId.dm(currentUser.id, otherUserId);
    setState(prev => {
      if (prev.conversations[cid]) return prev;
      const other = users.find(u => u.id === otherUserId);
      return {
        ...prev,
        conversations: {
          ...prev.conversations,
          [cid]: {
            id: cid,
            type: 'dm',
            name: other?.name || 'Direct Message',
            participantIds: [currentUser.id, otherUserId],
            isReadOnly: false,
            createdAt: new Date().toISOString(),
            icon: null,
          },
        },
      };
    });
    return cid;
  }, [currentUser, users]);

  // ── Pin / unpin
  const pinConversation = useCallback((conversationId, pinned) => {
    if (!currentUser) return;
    setState(prev => {
      const s = { ...prev.settings };
      s[conversationId] = {
        ...(s[conversationId] || {}),
        [currentUser.id]: { ...(s[conversationId]?.[currentUser.id] || {}), pinned },
      };
      return { ...prev, settings: s };
    });
  }, [currentUser]);

  // ── Mute / unmute
  const muteConversation = useCallback((conversationId, muted) => {
    if (!currentUser) return;
    setState(prev => {
      const s = { ...prev.settings };
      s[conversationId] = {
        ...(s[conversationId] || {}),
        [currentUser.id]: { ...(s[conversationId]?.[currentUser.id] || {}), muted },
      };
      return { ...prev, settings: s };
    });
  }, [currentUser]);

  // ── Publish announcement (admin only)
  const publishAnnouncement = useCallback((title, content, priority = 'normal') => {
    if (currentUser?.role !== 'admin') return;
    const annId = convId.announcements();
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      conversationId: annId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      text: content,
      title,
      priority,
      reactions: {},
      edited: false,
      deleted: false,
      timestamp: new Date().toISOString(),
      isAnnouncement: true,
    };
    setState(prev => {
      const msgs = [...(prev.messages[annId] || []), msg];
      return { ...prev, messages: { ...prev.messages, [annId]: msgs } };
    });

    // Notify all active users
    users.filter(u => u.status !== 'inactive' && u.id !== currentUser.id).forEach(u => {
      pushNotification(u.id, `📢 ${title}: ${content.slice(0, 50)}`, annId);
    });
  }, [currentUser, users, pushNotification]);

  // ── Derived helpers
  const getConversationsForUser = useCallback((userId, role) => {
    const convs = Object.values(stateRef.current.conversations);
    return convs.filter(c => {
      if (c.type === 'announcements') return true;
      if (role === 'admin') return true;
      return (c.participantIds || []).includes(userId);
    });
  }, []);

  const getMessages = useCallback((conversationId) => {
    return stateRef.current.messages[conversationId] || [];
  }, []);

  const getUnreadCount = useCallback((conversationId, userId) => {
    const msgs = stateRef.current.messages[conversationId] || [];
    const lastRead = stateRef.current.readStates[conversationId]?.[userId];
    if (!lastRead) return msgs.filter(m => !m.deleted && m.senderId !== userId).length;
    return msgs.filter(m => !m.deleted && m.senderId !== userId && m.timestamp > lastRead).length;
  }, []);

  const getUserSetting = useCallback((conversationId, userId) => {
    return stateRef.current.settings[conversationId]?.[userId] || {};
  }, []);

  const getLastMessage = useCallback((conversationId) => {
    const msgs = stateRef.current.messages[conversationId] || [];
    const visible = msgs.filter(m => !m.deleted);
    return visible[visible.length - 1] || null;
  }, []);

  const value = {
    // State (reactive)
    conversations: state.conversations,
    messages: state.messages,
    readStates: state.readStates,
    settings: state.settings,
    // Actions
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    markRead,
    startDM,
    pinConversation,
    muteConversation,
    publishAnnouncement,
    // Derived
    getConversationsForUser,
    getMessages,
    getUnreadCount,
    getUserSetting,
    getLastMessage,
    convId,
  };

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}

export function useMessaging() {
  const ctx = useContext(MessagingContext);
  if (!ctx) throw new Error('useMessaging must be used within MessagingProvider');
  return ctx;
}

/** Neon-backed messaging state and actions. */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from './AppContext';
import { ConversationsAPI } from '../services/api';
import { autoSyncBus, SYNC_EVENTS } from '../services/autoSync';
import { playMessageChime } from '../utils/soundEffects';

const MessagingContext = createContext(null);

const CACHE_KEY_PREFIX = 'nx_msg_cache_';

function getCache(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCache(userId, data) {
  if (!userId) return;
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}${userId}`, JSON.stringify(data));
  } catch (e) {
    console.warn('[MESSAGING] Failed to cache messages locally:', e);
  }
}

export function MessagingProvider({ children }) {
  const { currentUser } = useApp();
  
  // Instant local cache hydration for sub-second first-paint
  const initialCache = getCache(currentUser?.id);

  const [conversations, setConversations] = useState(() => initialCache?.conversations || {});
  const [messages, setMessages] = useState(() => initialCache?.messages || {});
  const [settings, setSettings] = useState(() => initialCache?.settings || {});
  const [loading, setLoading] = useState(() => !initialCache?.conversations || Object.keys(initialCache.conversations).length === 0);
  const mounted = useRef(false);
  const fetching = useRef(false);
  const syncing = useRef(false);
  const syncCursor = useRef(initialCache?.syncCursor || null);

  // Stable Set of known message IDs to strictly prevent repeated chimes or startup triggers
  const knownMessageIdsRef = useRef(new Set());
  const messagesBaselineEstablishedRef = useRef(false);

  const fetchConversations = useCallback(async (silent = false) => {
    if (!currentUser) return null;
    if (fetching.current) return null;
    fetching.current = true;
    if (!silent && mounted.current && Object.keys(conversations).length === 0) setLoading(true);
    try {
      const data = await ConversationsAPI.getAll();
      if (!data || !mounted.current) return data;
      const nextConversations = {};
      const nextSettings = {};
      (data.conversations || []).forEach((conversation) => {
        const normalized = {
          ...conversation,
          type: conversation.type === 'direct' ? 'dm' : conversation.type,
          participantIds: conversation.participantIds || [],
        };
        nextConversations[normalized.id] = normalized;
        nextSettings[normalized.id] = {
          pinned: Boolean(normalized.pinned),
          muted: Boolean(normalized.muted),
          lastReadAt: normalized.lastReadAt || null,
        };
      });
      setConversations(nextConversations);
      setMessages(data.messages || {});
      setSettings(nextSettings);
      syncCursor.current = data.syncCursor || new Date().toISOString();

      // Seed known message IDs baseline during initial startup load
      if (!messagesBaselineEstablishedRef.current) {
        if (data.messages && typeof data.messages === 'object') {
          Object.values(data.messages).forEach(list => {
            if (Array.isArray(list)) {
              list.forEach(m => {
                if (m?.id) knownMessageIdsRef.current.add(m.id);
              });
            }
          });
        }
        messagesBaselineEstablishedRef.current = true;
      }

      // Persist to local fast cache
      saveCache(currentUser.id, {
        conversations: nextConversations,
        messages: data.messages || {},
        settings: nextSettings,
        syncCursor: syncCursor.current
      });

      return data;
    } catch (error) {
      console.error('[MESSAGING] Unable to load conversations:', error);
      throw error;
    } finally {
      fetching.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    mounted.current = true;
    if (currentUser) {
      knownMessageIdsRef.current = new Set();
      messagesBaselineEstablishedRef.current = false;
      fetchConversations().catch(() => { });
    } else {
      setConversations({});
      setMessages({});
      setSettings({});
      setLoading(false);
      knownMessageIdsRef.current = new Set();
      messagesBaselineEstablishedRef.current = false;
    }
    return () => { mounted.current = false; };
  }, [currentUser, fetchConversations]);

  // Incremental sync: do not download full conversation history on every poll.
  const syncMessages = useCallback(async () => {
    if (!currentUser || syncing.current || !syncCursor.current) return;
    syncing.current = true;
    try {
      const data = await ConversationsAPI.sync(syncCursor.current);
      if (!mounted.current || !data) return;

      if (data.syncCursor) syncCursor.current = data.syncCursor;

      if (Array.isArray(data.conversations) && data.conversations.length) {
        const nextSettings = {};
        const normalizedConversations = data.conversations.map(conversation => {
          const normalized = {
            ...conversation,
            type: conversation.type === 'direct' ? 'dm' : conversation.type,
            participantIds: conversation.participantIds || [],
          };
          nextSettings[normalized.id] = {
            pinned: Boolean(normalized.pinned),
            muted: Boolean(normalized.muted),
            lastReadAt: normalized.lastReadAt || null,
          };
          return normalized;
        });
        setConversations(previous => {
          const next = { ...previous };
          normalizedConversations.forEach(conversation => {
            next[conversation.id] = { ...next[conversation.id], ...conversation };
          });
          return next;
        });
        setSettings(previous => ({ ...previous, ...nextSettings }));
      }

      if (Array.isArray(data.messages) && data.messages.length) {
        let hasIncomingFromOther = false;
        setMessages(previous => {
          const next = { ...previous };
          data.messages.forEach(message => {
            const list = next[message.conversationId] || [];
            const index = list.findIndex(item => item.id === message.id);
            if (index >= 0) {
              const updated = [...list];
              updated[index] = { ...updated[index], ...message };
              next[message.conversationId] = updated;
            } else {
              next[message.conversationId] = [...list, message];
              // Check if genuinely new unseen message ID from another user
              if (message.id && !knownMessageIdsRef.current.has(message.id)) {
                knownMessageIdsRef.current.add(message.id);
                if (message.senderId !== currentUser?.id) {
                  hasIncomingFromOther = true;
                }
              }
            }
          });
          return next;
        });
        if (hasIncomingFromOther && messagesBaselineEstablishedRef.current && currentUser?.id) {
          playMessageChime(currentUser.id);
        }
      }
    } catch (error) {
      // Only warn on application-level errors; suppress aborted network polls during hot-reloads or page navigation
      if (error?.name !== 'TypeError' || !error.message?.includes('fetch resource')) {
        console.warn('[MESSAGING] Incremental sync failed:', error);
      }
    } finally {
      syncing.current = false;
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return undefined;

    // Listen to autoSync bus for instant cross-tab message updates
    const unsub = autoSyncBus.on(SYNC_EVENTS.MESSAGE_SENT, () => {
      syncMessages();
    });

    const poll = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) syncMessages();
    };
    const timer = window.setInterval(poll, 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) syncMessages();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsub();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [currentUser, syncMessages]);

  const sendMessage = useCallback(async (conversationId, text, replyToId = null) => {
    const cleanText = text?.trim();
    if (!currentUser || !conversationId || !cleanText) return null;

    const temporaryId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticMessage = {
      id: temporaryId,
      conversationId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      text: cleanText,
      replyToId,
      timestamp: new Date().toISOString(),
      edited: false,
      deleted: false,
      reactions: {},
      pending: true,
    };

    setMessages(previous => ({
      ...previous,
      [conversationId]: [...(previous[conversationId] || []), optimisticMessage],
    }));
    setConversations(previous => ({
      ...previous,
      [conversationId]: {
        ...previous[conversationId],
        lastMessage: cleanText.slice(0, 200),
        lastMessageAt: optimisticMessage.timestamp,
      },
    }));

    try {
      const message = await ConversationsAPI.sendMessage({ conversationId, text: cleanText, replyToId });
      if (!message) throw new Error('The server did not return the sent message.');
      setMessages(previous => ({
        ...previous,
        [conversationId]: (previous[conversationId] || []).map(item =>
          item.id === temporaryId ? message : item
        ),
      }));
      autoSyncBus.emit(SYNC_EVENTS.MESSAGE_SENT, { conversationId, message });
      return message;
    } catch (error) {
      setMessages(previous => ({
        ...previous,
        [conversationId]: (previous[conversationId] || []).filter(item => item.id !== temporaryId),
      }));
      throw error;
    }
  }, [currentUser]);

  const editMessage = useCallback(async (conversationId, messageId, newText) => {
    const cleanText = newText?.trim();
    if (!cleanText) return false;
    const previousMessage = (messages[conversationId] || []).find(item => item.id === messageId);
    if (!previousMessage) return false;

    setMessages(previous => ({
      ...previous,
      [conversationId]: (previous[conversationId] || []).map(message =>
        message.id === messageId ? { ...message, text: cleanText, edited: true, pending: true } : message
      ),
    }));

    try {
      const result = await ConversationsAPI.editMessage(messageId, cleanText);
      setMessages(previous => ({
        ...previous,
        [conversationId]: (previous[conversationId] || []).map(message =>
          message.id === messageId ? { ...message, ...(result || {}), text: cleanText, edited: true, pending: false } : message
        ),
      }));
      return true;
    } catch (error) {
      setMessages(previous => ({
        ...previous,
        [conversationId]: (previous[conversationId] || []).map(message =>
          message.id === messageId ? previousMessage : message
        ),
      }));
      throw error;
    }
  }, [messages]);

  const deleteMessage = useCallback(async () => {
    throw new Error('Message deletion is permanently disabled.');
  }, []);

  const addReaction = useCallback(async (conversationId, messageId, emoji) => {
    if (!currentUser || !emoji) return false;
    const previousMessage = (messages[conversationId] || []).find(item => item.id === messageId);
    const previousReactions = previousMessage?.reactions || {};

    setMessages(previous => ({
      ...previous,
      [conversationId]: (previous[conversationId] || []).map(message => {
        if (message.id !== messageId) return message;
        const reactions = { ...(message.reactions || {}) };
        const users = reactions[emoji] || [];
        reactions[emoji] = users.includes(currentUser.id)
          ? users.filter(id => id !== currentUser.id)
          : [...users, currentUser.id];
        if (!reactions[emoji].length) delete reactions[emoji];
        return { ...message, reactions };
      }),
    }));

    try {
      await ConversationsAPI.react(messageId, emoji);
      return true;
    } catch (error) {
      setMessages(previous => ({
        ...previous,
        [conversationId]: (previous[conversationId] || []).map(message =>
          message.id === messageId ? { ...message, reactions: previousReactions } : message
        ),
      }));
      throw error;
    }
  }, [currentUser, messages]);

  const markRead = useCallback(async (conversationId) => {
    if (!currentUser || !conversationId) return;
    const readAt = new Date().toISOString();
    setSettings(prev => ({ ...prev, [conversationId]: { ...(prev[conversationId] || {}), lastReadAt: readAt } }));
    try {
      await ConversationsAPI.updateSettings({ conversationId, markRead: true });
    } catch (error) {
      console.warn('[MESSAGING] Unable to persist read state:', error);
    }
  }, [currentUser]);

  const startDM = useCallback(async (targetUserId) => {
    if (!currentUser || !targetUserId || targetUserId === currentUser.id) return null;
    const conversationId = await ConversationsAPI.startDM(targetUserId);
    if (!conversationId) throw new Error('The server did not return a conversation ID.');
    await syncMessages();
    return conversationId;
  }, [currentUser, syncMessages]);

  const updateSetting = useCallback(async (conversationId, patch) => {
    const previous = settings[conversationId] || {};
    setSettings(current => ({ ...current, [conversationId]: { ...previous, ...patch } }));
    try {
      await ConversationsAPI.updateSettings({ conversationId, ...patch });
    } catch (error) {
      setSettings(current => ({ ...current, [conversationId]: previous }));
      throw error;
    }
  }, [settings]);
  const pinConversation = useCallback((id, pinned) => updateSetting(id, { pinned }), [updateSetting]);
  const muteConversation = useCallback((id, muted) => updateSetting(id, { muted }), [updateSetting]);

  const publishAnnouncement = useCallback(async (title, content, priority = 'normal') => {
    if (currentUser?.role !== 'admin') throw new Error('Only administrators can publish announcements.');
    let channel = Object.values(conversations).find(item => item.type === 'announcements');
    if (!channel) {
      const data = await fetchConversations(true);
      channel = (data?.conversations || []).find(item => item.type === 'announcements');
    }
    if (!channel) throw new Error('Company Announcements channel is unavailable.');
    const message = await ConversationsAPI.sendMessage({
      conversationId: channel.id, title, text: content, priority, isAnnouncement: true,
    });
    if (message) {
      setMessages(prev => ({ ...prev, [channel.id]: [...(prev[channel.id] || []), message] }));
    }
    return message;
  }, [currentUser, conversations, fetchConversations]);

  const getConversationsForUser = useCallback((userId, role) =>
    Object.values(conversations).filter(conversation =>
      role === 'admin' || (conversation.participantIds || []).includes(userId)
    ), [conversations]);
  const getMessages = useCallback(id => messages[id] || [], [messages]);
  const getUnreadCount = useCallback((conversationId, userId) => {
    const lastReadAt = settings[conversationId]?.lastReadAt;
    return (messages[conversationId] || []).filter(message => {
      if (message.deleted || message.senderId === userId) return false;
      if (!lastReadAt) return true;
      return new Date(message.timestamp).getTime() > new Date(lastReadAt).getTime();
    }).length;
  }, [messages, settings]);
  const getUserSetting = useCallback(id => settings[id] || {}, [settings]);
  const getLastMessage = useCallback(id => {
    const list = messages[id] || [];
    return [...list].reverse().find(message => !message.deleted) || null;
  }, [messages]);

  const value = {
    conversations, messages, settings, loading,
    refreshConversations: fetchConversations,
    syncMessages,
    sendMessage, editMessage, deleteMessage, addReaction, markRead, startDM,
    pinConversation, muteConversation, publishAnnouncement,
    getConversationsForUser, getMessages, getUnreadCount, getUserSetting, getLastMessage,
  };
  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}

export function useMessaging() {
  const context = useContext(MessagingContext);
  if (!context) throw new Error('useMessaging must be used within MessagingProvider');
  return context;
}

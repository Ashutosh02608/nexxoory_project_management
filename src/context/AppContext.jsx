import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AuthAPI,
  DataAPI,
  UsersAPI,
  TeamsAPI,
  ProjectsAPI,
  TasksAPI,
  DocumentsAPI,
  CalendarAPI,
  NotificationsAPI,
  AnnouncementsAPI,
  attemptSilentRefresh,
  clearAccessToken
} from '../services/api';
import { autoSyncBus, SYNC_EVENTS } from '../services/autoSync';
import { playNotificationChime } from '../utils/soundEffects';
import { AppContext } from './appContextValue';

for (let index = localStorage.length - 1; index >= 0; index -= 1) {
  const key = localStorage.key(index);
  if (key?.startsWith('nx_app_data_cache_') || key?.startsWith('nx_msg_cache_')) {
    localStorage.removeItem(key);
  }
}

function saveAppCache(userId, data) {
  void userId;
  void data;
}

export function AppProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('nx_theme') || 'light');
  
  // Real authenticated user state (restored via server /api/v1/auth/refresh)
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Global Sync Status: 'synced' | 'updating' | 'error'
  const [syncStatus, setSyncStatus] = useState('synced');
  const [syncError, setSyncError] = useState(null);
  const syncTimeoutRef = useRef(null);
  const isSyncingRef = useRef(false);
  const lastSyncHashRef = useRef('');

  // Notification Chime Tracker: stable Set of known notification IDs
  const knownNotificationIdsRef = useRef(new Set());
  const notifBaselineEstablishedRef = useRef(false);

  // Application Data States (Hydrate instantly from local cache if available)
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [events, setEvents] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [folderPermissions, setFolderPermissions] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('nx_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('nx_sidebar_collapsed', String(next));
      } catch (e) {
        console.warn('Failed to save sidebar preference', e);
      }
      return next;
    });
  }, []);

  const setUpdatingState = useCallback(() => {
    setSyncStatus('updating');
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
  }, []);

  const setSyncedState = useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      setSyncStatus('synced');
      setSyncError(null);
    }, 400);
  }, []);

  const setErrorState = useCallback((err) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    setSyncStatus('error');
    setSyncError(err?.message || 'Sync failed');
  }, []);

  // Synchronize theme to root class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('nx_theme', theme);
  }, [theme]);

  // Fetch all backend datasets when authenticated in a single batch query
  const refreshAppData = useCallback(async (silent = false) => {
    if (!currentUser || isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (!silent) setUpdatingState();
    try {
      const data = await DataAPI.bootstrap();
      if (data) {
        // Evaluate new non-messaging notifications for sound chime
        const incomingNotifs = data.notifications || [];
        if (!notifBaselineEstablishedRef.current) {
          // Initial baseline load: record existing IDs without playing chime
          incomingNotifs.forEach(n => {
            if (n?.id) knownNotificationIdsRef.current.add(n.id);
          });
          notifBaselineEstablishedRef.current = true;
        } else {
          // Check for genuinely new non-messaging, unread notifications belonging to currentUser
          let hasNewNotif = false;
          incomingNotifs.forEach(n => {
            if (!n?.id) return;
            if (!knownNotificationIdsRef.current.has(n.id)) {
              knownNotificationIdsRef.current.add(n.id);
              // Only trigger chime if unread, matches currentUser, and is NOT a messaging/chat notification
              const isForUser = !n.userId || n.userId === currentUser.id;
              const isNonMessaging = n.type !== 'message' && n.type !== 'mention' && n.type !== 'chat';
              if (isForUser && !n.read && isNonMessaging) {
                hasNewNotif = true;
              }
            }
          });
          if (hasNewNotif) {
            playNotificationChime(currentUser.id);
          }
        }

        // Fast shallow hash comparison to prevent unnecessary state triggers and re-renders
        const hash = `${(data.projects || []).length}_${(data.tasks || []).length}_${(data.teams || []).length}_${(data.documents || []).length}_${(data.events || []).length}_${(data.notifications || []).length}_${data.projects?.[0]?.updatedAt || ''}_${data.tasks?.[0]?.updatedAt || ''}`;
        
        if (hash !== lastSyncHashRef.current || !silent) {
          lastSyncHashRef.current = hash;
          setUsers(data.users || []);
          setTeams(data.teams || []);
          setProjects(data.projects || []);
          setTasks(data.tasks || []);
          setDocuments(data.documents || []);
          setFolderPermissions(data.folderPermissions || []);
          setEvents(data.events || []);
          setNotifications(data.notifications || []);
          setAnnouncements(data.announcements || []);
          setConversations(data.conversations || []);
          saveAppCache(currentUser.id, data);
        }
      }
      setSyncedState();
    } catch (err) {
      if (!silent) {
        console.error('[REFRESH APP DATA ERROR]', err);
        setErrorState(err);
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [currentUser, setUpdatingState, setSyncedState, setErrorState]);

  // Synchronize targeted entity on event bus notification
  useEffect(() => {
    if (!currentUser) return;

    const unsubs = [
      autoSyncBus.on(SYNC_EVENTS.PROJECT_CREATED, async () => {
        try {
          const list = await ProjectsAPI.getAll();
          setProjects(list);
          setSyncedState();
        } catch { refreshAppData(true); }
      }),
      autoSyncBus.on(SYNC_EVENTS.PROJECT_UPDATED, async () => {
        try {
          const list = await ProjectsAPI.getAll();
          setProjects(list);
          setSyncedState();
        } catch { refreshAppData(true); }
      }),
      autoSyncBus.on(SYNC_EVENTS.PROJECT_DELETED, ({ id }) => {
        if (id) setProjects(prev => prev.filter(p => p.id !== id));
      }),

      autoSyncBus.on(SYNC_EVENTS.TASK_CREATED, async () => {
        try {
          const list = await TasksAPI.getAll();
          setTasks(list);
          setSyncedState();
        } catch { refreshAppData(true); }
      }),
      autoSyncBus.on(SYNC_EVENTS.TASK_UPDATED, async () => {
        try {
          const list = await TasksAPI.getAll();
          setTasks(list);
          setSyncedState();
        } catch { refreshAppData(true); }
      }),
      autoSyncBus.on(SYNC_EVENTS.TASK_DELETED, ({ id }) => {
        if (id) setTasks(prev => prev.filter(t => t.id !== id));
      }),

      autoSyncBus.on(SYNC_EVENTS.TEAM_UPDATED, async () => {
        try {
          const list = await TeamsAPI.getAll();
          setTeams(list);
          setSyncedState();
        } catch { refreshAppData(true); }
      }),
      autoSyncBus.on(SYNC_EVENTS.TEAM_DELETED, ({ id }) => {
        if (id) setTeams(prev => prev.filter(t => t.id !== id));
      }),

      autoSyncBus.on(SYNC_EVENTS.USER_UPDATED, async ({ user }) => {
        try {
          const list = await UsersAPI.getAll();
          setUsers(list);
          if (user && user.id === currentUser?.id) {
            setCurrentUser(user);
          }
          setSyncedState();
        } catch { refreshAppData(true); }
      }),
      autoSyncBus.on(SYNC_EVENTS.USER_DELETED, ({ id }) => {
        if (id) setUsers(prev => prev.filter(u => u.id !== id));
      }),

      autoSyncBus.on(SYNC_EVENTS.DOCUMENT_UPDATED, async () => {
        try {
          const list = await DocumentsAPI.getAll();
          setDocuments(list);
          setSyncedState();
        } catch { refreshAppData(true); }
      }),
      autoSyncBus.on(SYNC_EVENTS.DOCUMENT_DELETED, ({ id }) => {
        if (id) setDocuments(prev => prev.filter(d => d.id !== id));
      }),

      autoSyncBus.on(SYNC_EVENTS.CALENDAR_EVENT_UPDATED, async () => {
        try {
          const [evList, notifList] = await Promise.all([
            CalendarAPI.getAll(),
            NotificationsAPI.getAll()
          ]);
          setEvents(evList);
          setNotifications(notifList);
          setSyncedState();
        } catch { refreshAppData(true); }
      }),
      autoSyncBus.on(SYNC_EVENTS.CALENDAR_EVENT_DELETED, async ({ id }) => {
        if (id) setEvents(prev => prev.filter(e => e.id !== id));
        try {
          const notifList = await NotificationsAPI.getAll();
          setNotifications(notifList);
        } catch { /* ignore */ }
      }),

      autoSyncBus.on(SYNC_EVENTS.NOTIFICATION_CREATED, async () => {
        try {
          const list = await NotificationsAPI.getAll();
          setNotifications(list);
          // Evaluate new notification IDs
          let hasNew = false;
          list.forEach(n => {
            if (n?.id && !knownNotificationIdsRef.current.has(n.id)) {
              knownNotificationIdsRef.current.add(n.id);
              const isForUser = !n.userId || n.userId === currentUser.id;
              const isNonMessaging = n.type !== 'message' && n.type !== 'mention' && n.type !== 'chat';
              if (isForUser && !n.read && isNonMessaging) {
                hasNew = true;
              }
            }
          });
          if (hasNew && currentUser?.id) {
            playNotificationChime(currentUser.id);
          }
          setSyncedState();
        } catch { refreshAppData(true); }
      }),
      autoSyncBus.on(SYNC_EVENTS.NOTIFICATION_READ, ({ id }) => {
        if (id) setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      }),
      autoSyncBus.on(SYNC_EVENTS.NOTIFICATION_ALL_READ, () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }),
      autoSyncBus.on(SYNC_EVENTS.NOTIFICATION_DELETED, ({ id }) => {
        if (id) setNotifications(prev => prev.filter(n => n.id !== id));
      }),

      autoSyncBus.on(SYNC_EVENTS.APP_REFRESH, () => {
        refreshAppData(true);
      })
    ];

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [currentUser, refreshAppData, setSyncedState]);

  // Session restoration on page load strictly via silent refresh endpoint
  const restoreSession = useCallback(async () => {
    setIsAuthLoading(true);
    try {
      const refreshed = await attemptSilentRefresh();
      if (refreshed?.user) {
        setCurrentUser(refreshed.user);
      } else {
        setCurrentUser(null);
      }
    } catch  {
      setCurrentUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(restoreSession);
  }, [restoreSession]);

  useEffect(() => {
    if (currentUser) {
      // Reset notification tracking baseline when user switches
      knownNotificationIdsRef.current = new Set();
      notifBaselineEstablishedRef.current = false;
      void Promise.resolve().then(() => refreshAppData(false));

      // Low-frequency fallback. Local mutations use the event bus.
      const syncInterval = setInterval(() => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          refreshAppData(true);
        }
      }, 30000);

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          refreshAppData(true);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        clearInterval(syncInterval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } else {
      queueMicrotask(() => {
        setUsers([]);
        setTeams([]);
        setProjects([]);
        setTasks([]);
        setDocuments([]);
        setEvents([]);
        setNotifications([]);
        setConversations([]);
      });
    }
  }, [currentUser, refreshAppData]);

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Real Authentication methods
  const login = async (email, password) => {
    const data = await AuthAPI.login(email, password);
    if (!data?.user) {
      throw new Error('Authentication failed: Missing user profile');
    }
    setCurrentUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await AuthAPI.logout();
    } catch (err) {
      console.warn('Logout API failed:', err.message);
    } finally {
      clearAccessToken();
      setCurrentUser(null);
    }
  };

  // BACKEND CRUD HANDLERS WITH CENTRALIZED AUTO-SYNC
  const updateProject = async (project) => {
    setUpdatingState();
    try {
      if (project.id) {
        await ProjectsAPI.update(project);
      } else {
        await ProjectsAPI.create(project);
      }
      const updated = await ProjectsAPI.getAll();
      setProjects(updated);
      autoSyncBus.emit(project.id ? SYNC_EVENTS.PROJECT_UPDATED : SYNC_EVENTS.PROJECT_CREATED, { project });
      setSyncedState();
      return updated;
    } catch (err) {
      setErrorState(err);
      throw err;
    }
  };

  const removeProject = async (id) => {
    setUpdatingState();
    try {
      await ProjectsAPI.delete(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      autoSyncBus.emit(SYNC_EVENTS.PROJECT_DELETED, { id });
      setSyncedState();
    } catch (err) {
      setErrorState(err);
      throw err;
    }
  };

  const updateTask = async (task) => {
    setUpdatingState();
    try {
      // Optimistic local update for instant UI feedback (zero lag on drag-and-drop)
      if (task.id) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...task } : t));
        await TasksAPI.update(task);
      } else {
        await TasksAPI.create(task);
      }
      const updated = await TasksAPI.getAll();
      setTasks(updated);
      autoSyncBus.emit(task.id ? SYNC_EVENTS.TASK_UPDATED : SYNC_EVENTS.TASK_CREATED, { task });
      setSyncedState();
      return updated;
    } catch (err) {
      setErrorState(err);
      throw err;
    }
  };

  const removeTask = async (id) => {
    setUpdatingState();
    try {
      await TasksAPI.delete(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      autoSyncBus.emit(SYNC_EVENTS.TASK_DELETED, { id });
      setSyncedState();
    } catch (err) {
      setErrorState(err);
      throw err;
    }
  };

  const updateTeam = async (team) => {
    setUpdatingState();
    try {
      if (team.id) {
        await TeamsAPI.update(team);
      } else {
        await TeamsAPI.create(team);
      }
      const updated = await TeamsAPI.getAll();
      setTeams(updated);
      autoSyncBus.emit(SYNC_EVENTS.TEAM_UPDATED, { team });
      setSyncedState();
      return updated;
    } catch (err) {
      setErrorState(err);
      throw err;
    }
  };

  const removeTeam = async (id) => {
    setUpdatingState();
    try {
      await TeamsAPI.delete(id);
      setTeams(prev => prev.filter(t => t.id !== id));
      autoSyncBus.emit(SYNC_EVENTS.TEAM_DELETED, { id });
      setSyncedState();
    } catch (err) {
      setErrorState(err);
      throw err;
    }
  };

  const updateUser = async (user) => {
    setUpdatingState();
    try {
      let saved;
      if (user.id && user.id !== 'usr-temp') {
        saved = await UsersAPI.update(user);
      } else {
        saved = await UsersAPI.create(user);
      }
      const updated = await UsersAPI.getAll();
      setUsers(updated);
      if (currentUser?.id === user.id && saved) {
        setCurrentUser(saved);
      }
      autoSyncBus.emit(SYNC_EVENTS.USER_UPDATED, { user: saved || user });
      setSyncedState();
      return saved;
    } catch (err) {
      setErrorState(err);
      throw err;
    }
  };

  const removeUser = async (id, projectReassignments = {}, teamReassignments = {}) => {
    setUpdatingState();
    try {
      await UsersAPI.delete(id, projectReassignments, teamReassignments);
      await refreshAppData(true);
      autoSyncBus.emit(SYNC_EVENTS.USER_DELETED, { id });
      setSyncedState();
    } catch (err) {
      setErrorState(err);
      throw err;
    }
  };

  const updateDocument = async (doc) => {
    setUpdatingState();
    try {
      if (doc.id) {
        await DocumentsAPI.update(doc);
      } else {
        await DocumentsAPI.create(doc);
      }
      const updated = await DocumentsAPI.getAll();
      setDocuments(updated);
      autoSyncBus.emit(SYNC_EVENTS.DOCUMENT_UPDATED, { doc });
      setSyncedState();
      return updated;
    } catch (err) {
      setErrorState(err);
      throw err;
    }
  };

  const removeDocument = async (id) => {
    setUpdatingState();
    try {
      await DocumentsAPI.delete(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
      autoSyncBus.emit(SYNC_EVENTS.DOCUMENT_DELETED, { id });
      setSyncedState();
    } catch (err) {
      setErrorState(err);
      throw err;
    }
  };

  const assignDocumentAccess = async (id, userIds) => {
    setUpdatingState();
    try {
      await DocumentsAPI.assignFileAccess(id, userIds);
      setDocuments(prev => prev.map(d => d.id === id ? { ...d, assignedUserIds: userIds } : d));
      autoSyncBus.emit(SYNC_EVENTS.DOCUMENT_ACCESS_UPDATED, { id, userIds });
      setSyncedState();
    } catch (err) {
      setErrorState(err);
      throw err;
    }
  };

  const assignFolderAccess = async (folderKey, userIds) => {
    setUpdatingState();
    try {
      await DocumentsAPI.assignFolderAccess(folderKey, userIds);
      setFolderPermissions(prev => {
        const filtered = prev.filter(fp => fp.folderKey !== folderKey);
        const newlyAdded = userIds.map(uid => ({ folderKey, userId: uid }));
        return [...filtered, ...newlyAdded];
      });
      autoSyncBus.emit(SYNC_EVENTS.DOCUMENT_ACCESS_UPDATED, { folderKey, userIds });
      setSyncedState();
    } catch (err) {
      setErrorState(err);
      throw err;
    }
  };

  const updateEvent = async (event) => {
    setUpdatingState();
    try {
      if (event.id) {
        await CalendarAPI.update(event);
      } else {
        await CalendarAPI.create(event);
      }
      const [updatedEvents, updatedNotifs] = await Promise.all([
        CalendarAPI.getAll(),
        NotificationsAPI.getAll()
      ]);
      setEvents(updatedEvents);
      setNotifications(updatedNotifs);
      autoSyncBus.emit(SYNC_EVENTS.CALENDAR_EVENT_UPDATED, { event });
      autoSyncBus.emit(SYNC_EVENTS.NOTIFICATION_CREATED, {});
      setSyncedState();
      return updatedEvents;
    } catch (err) {
      setErrorState(err);
      throw err;
    }
  };

  const removeEvent = async (id) => {
    setUpdatingState();
    try {
      await CalendarAPI.delete(id);
      setEvents(prev => prev.filter(e => e.id !== id));
      try {
        const updatedNotifs = await NotificationsAPI.getAll();
        setNotifications(updatedNotifs);
      } catch { /* ignore */ }
      autoSyncBus.emit(SYNC_EVENTS.CALENDAR_EVENT_DELETED, { id });
      autoSyncBus.emit(SYNC_EVENTS.NOTIFICATION_CREATED, {});
      setSyncedState();
    } catch (err) {
      setErrorState(err);
      throw err;
    }
  };

  const markNotificationRead = async (id) => {
    try {
      await NotificationsAPI.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      autoSyncBus.emit(SYNC_EVENTS.NOTIFICATION_READ, { id });
    } catch (err) {
      console.warn('Mark notification read failed:', err);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await NotificationsAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      autoSyncBus.emit(SYNC_EVENTS.NOTIFICATION_ALL_READ, {});
    } catch (err) {
      console.warn('Mark all notifications read failed:', err);
    }
  };

  const removeNotification = async (id) => {
    try {
      await NotificationsAPI.delete(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      autoSyncBus.emit(SYNC_EVENTS.NOTIFICATION_DELETED, { id });
    } catch (err) {
      console.warn('Delete notification failed:', err);
    }
  };

  // Frontend-only: add a local notification (used by messaging layer)
  const addLocalNotification = (notif) => {
    setNotifications(prev => [notif, ...prev]);
    autoSyncBus.emit(SYNC_EVENTS.NOTIFICATION_CREATED, { notif });
  };

  const publishAnnouncement = async (announcement) => {
    setUpdatingState();
    try {
      await AnnouncementsAPI.create(announcement);
      await refreshAppData(true);
      autoSyncBus.emit(SYNC_EVENTS.ANNOUNCEMENT_CREATED, { announcement });
      setSyncedState();
    } catch (err) {
      setErrorState(err);
      throw err;
    }
  };

  const removeAnnouncement = async (id) => {
    setUpdatingState();
    try {
      await AnnouncementsAPI.delete(id);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      autoSyncBus.emit(SYNC_EVENTS.ANNOUNCEMENT_DELETED, { id });
      setSyncedState();
    } catch (err) {
      setErrorState(err);
      throw err;
    }
  };

  const resetToInitialData = () => {
    window.location.reload();
  };

  // Authoritative permissions derived from authenticated currentUser
  const role = currentUser?.role || 'team_member';
  const permissions = {
    isAuthenticated: !!currentUser,
    isAdmin: role === 'admin',
    isPM: role === 'project_manager' || role === 'admin',
    isTeamMember: role === 'team_member',
    canManageAllProjects: role === 'admin',
    canCreateProject: role === 'admin' || role === 'project_manager',
    canManageEmployees: role === 'admin',
    canManageTeams: role === 'admin',
    canViewAllReports: role === 'admin' || role === 'project_manager',
    canEditProject: (project) => {
      if (role === 'admin') return true;
      if (role === 'project_manager' && project.managerId === currentUser?.id) return true;
      return false;
    },
    canEditTask: (task) => {
      if (role === 'admin' || role === 'project_manager') return true;
      return task.assigneeId === currentUser?.id;
    }
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        currentUser,
        isAuthLoading,
        login,
        logout,
        users,
        projects,
        tasks,
        teams,
        events,
        documents,
        folderPermissions,
        conversations,
        notifications,
        announcements,
        permissions,
        searchOpen,
        setSearchOpen,
        quickCreateOpen,
        setQuickCreateOpen,
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar,
        mobileMenuOpen,
        setMobileMenuOpen,
        updateProject,
        removeProject,
        updateTask,
        removeTask,
        updateTeam,
        removeTeam,
        updateUser,
        removeUser,
        updateDocument,
        removeDocument,
        assignDocumentAccess,
        assignFolderAccess,
        updateEvent,
        removeEvent,
        markNotificationRead,
        markAllNotificationsRead,
        removeNotification,
        addLocalNotification,
        publishAnnouncement,
        removeAnnouncement,
        resetToInitialData,
        refreshAppData,
        syncStatus,
        syncError
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

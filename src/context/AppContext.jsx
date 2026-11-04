import React, { createContext, useState, useEffect, useCallback } from 'react';
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
  ConversationsAPI,
  attemptSilentRefresh,
  clearAccessToken
} from '../services/api';

export const AppContext = createContext();

export function AppProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('nx_theme') || 'light');
  
  // Real authenticated user state (restored via server /api/v1/auth/refresh)
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Application Data States (Authoritative from Backend Database)
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
  const refreshAppData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await DataAPI.bootstrap();
      if (data) {
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
      }
    } catch (err) {
      console.error('[REFRESH APP DATA ERROR]', err);
    }
  }, [currentUser]);

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
    } catch (err) {
      setCurrentUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (currentUser) {
      refreshAppData();
    } else {
      setUsers([]);
      setTeams([]);
      setProjects([]);
      setTasks([]);
      setDocuments([]);
      setEvents([]);
      setNotifications([]);
      setConversations([]);
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

  // BACKEND CRUD HANDLERS
  const updateProject = async (project) => {
    if (project.id) {
      await ProjectsAPI.update(project);
    } else {
      await ProjectsAPI.create(project);
    }
    const updated = await ProjectsAPI.getAll();
    setProjects(updated);
    return updated;
  };

  const removeProject = async (id) => {
    await ProjectsAPI.delete(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const updateTask = async (task) => {
    // Optimistic local update for instant UI feedback (zero lag on drag-and-drop)
    if (task.id) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...task } : t));
      await TasksAPI.update(task);
    } else {
      const created = await TasksAPI.create(task);
      if (created) {
        setTasks(prev => [created, ...prev]);
        return created;
      }
    }
    const updated = await TasksAPI.getAll();
    setTasks(updated);
    return updated;
  };

  const removeTask = async (id) => {
    await TasksAPI.delete(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTeam = async (team) => {
    if (team.id) {
      await TeamsAPI.update(team);
    } else {
      await TeamsAPI.create(team);
    }
    const updated = await TeamsAPI.getAll();
    setTeams(updated);
    return updated;
  };

  const removeTeam = async (id) => {
    await TeamsAPI.delete(id);
    setTeams(prev => prev.filter(t => t.id !== id));
  };

  const updateUser = async (user) => {
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
    return saved;
  };

  const removeUser = async (id) => {
    await UsersAPI.delete(id);
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const updateDocument = async (doc) => {
    if (doc.id) {
      await DocumentsAPI.update(doc);
    } else {
      await DocumentsAPI.create(doc);
    }
    const updated = await DocumentsAPI.getAll();
    setDocuments(updated);
    return updated;
  };

  const removeDocument = async (id) => {
    await DocumentsAPI.delete(id);
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const assignDocumentAccess = async (id, userIds) => {
    await DocumentsAPI.assignFileAccess(id, userIds);
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, assignedUserIds: userIds } : d));
  };

  const assignFolderAccess = async (folderKey, userIds) => {
    await DocumentsAPI.assignFolderAccess(folderKey, userIds);
    setFolderPermissions(prev => {
      const filtered = prev.filter(fp => fp.folderKey !== folderKey);
      const newlyAdded = userIds.map(uid => ({ folderKey, userId: uid }));
      return [...filtered, ...newlyAdded];
    });
  };

  const updateEvent = async (event) => {
    if (event.id) {
      await CalendarAPI.update(event);
    } else {
      await CalendarAPI.create(event);
    }
    const updated = await CalendarAPI.getAll();
    setEvents(updated);
    return updated;
  };

  const removeEvent = async (id) => {
    await CalendarAPI.delete(id);
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const markNotificationRead = async (id) => {
    await NotificationsAPI.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsRead = async () => {
    await NotificationsAPI.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const removeNotification = async (id) => {
    await NotificationsAPI.delete(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Frontend-only: add a local notification (used by messaging layer)
  const addLocalNotification = (notif) => {
    setNotifications(prev => [notif, ...prev]);
  };

  const publishAnnouncement = async (announcement) => {
    await AnnouncementsAPI.create(announcement);
    await refreshAppData();
  };

  const removeAnnouncement = async (id) => {
    await AnnouncementsAPI.delete(id);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
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
        refreshAppData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export { useApp } from './useApp';

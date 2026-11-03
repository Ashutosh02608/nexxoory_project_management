import React, { createContext, useContext, useState, useEffect } from 'react';
import { StorageService, initStorage, resetToInitialData } from '../services/storageService';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // Initialize storage once
  initStorage();

  const [theme, setThemeState] = useState(() => StorageService.getTheme());
  const [currentUser, setCurrentUserState] = useState(() => {
    const uid = StorageService.getCurrentUserId();
    return StorageService.getUserById(uid) || StorageService.getUsers()[0];
  });

  const [users, setUsers] = useState(() => StorageService.getUsers());
  const [projects, setProjects] = useState(() => StorageService.getProjects());
  const [tasks, setTasks] = useState(() => StorageService.getTasks());
  const [teams, setTeams] = useState(() => StorageService.getTeams());
  const [events, setEvents] = useState(() => StorageService.getEvents());
  const [documents, setDocuments] = useState(() => StorageService.getDocuments());
  const [conversations, setConversations] = useState(() => StorageService.getConversations());
  const [notifications, setNotifications] = useState(() => StorageService.getNotifications());
  const [announcements] = useState(() => StorageService.getAnnouncements());

  // Search dialog global state
  const [searchOpen, setSearchOpen] = useState(false);
  // Quick Create Modal global state
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  // Sync theme to root class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    StorageService.setTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const switchUser = (userId) => {
    StorageService.setCurrentUserId(userId);
    const user = StorageService.getUserById(userId);
    setCurrentUserState(user);
  };

  // CRUD WRAPPERS TO UPDATE BOTH STORAGE & REACT STATE
  const updateProject = (project) => {
    const updated = StorageService.saveProject(project);
    setProjects(StorageService.getProjects());
    return updated;
  };

  const removeProject = (id) => {
    StorageService.deleteProject(id);
    setProjects(StorageService.getProjects());
  };

  const updateTask = (task) => {
    const updated = StorageService.saveTask(task);
    setTasks(StorageService.getTasks());
    return updated;
  };

  const removeTask = (id) => {
    StorageService.deleteTask(id);
    setTasks(StorageService.getTasks());
  };

  const updateTeam = (team) => {
    const updated = StorageService.saveTeam(team);
    setTeams(StorageService.getTeams());
    return updated;
  };

  const removeTeam = (id) => {
    StorageService.deleteTeam(id);
    setTeams(StorageService.getTeams());
  };

  const updateUser = (user) => {
    const updated = StorageService.saveUser(user);
    setUsers(StorageService.getUsers());
    if (currentUser?.id === user.id) setCurrentUserState(updated);
    return updated;
  };

  const removeUser = (id) => {
    StorageService.deleteUser(id);
    setUsers(StorageService.getUsers());
  };

  const updateDocument = (doc) => {
    const updated = StorageService.saveDocument(doc);
    setDocuments(StorageService.getDocuments());
    return updated;
  };

  const removeDocument = (id) => {
    StorageService.deleteDocument(id);
    setDocuments(StorageService.getDocuments());
  };

  const updateEvent = (event) => {
    const updated = StorageService.saveEvent(event);
    setEvents(StorageService.getEvents());
    return updated;
  };

  const removeEvent = (id) => {
    StorageService.deleteEvent(id);
    setEvents(StorageService.getEvents());
  };

  const markNotificationRead = (id) => {
    StorageService.markNotificationAsRead(id);
    setNotifications(StorageService.getNotifications());
  };

  const markAllNotificationsRead = () => {
    StorageService.markAllNotificationsAsRead();
    setNotifications(StorageService.getNotifications());
  };

  const removeNotification = (id) => {
    StorageService.deleteNotification(id);
    setNotifications(StorageService.getNotifications());
  };

  // Permission checks based on currentUser.role
  const role = currentUser?.role || 'team_member';
  const permissions = {
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
      if (role === 'project_manager' && project.managerId === currentUser.id) return true;
      return false;
    },
    canEditTask: (task) => {
      if (role === 'admin' || role === 'project_manager') return true;
      return task.assigneeId === currentUser.id;
    }
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        currentUser,
        switchUser,
        users,
        projects,
        tasks,
        teams,
        events,
        documents,
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
        updateEvent,
        removeEvent,
        markNotificationRead,
        markAllNotificationsRead,
        removeNotification,
        resetToInitialData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);


import {
  INITIAL_USERS,
  INITIAL_TEAMS,
  INITIAL_PROJECTS,
  INITIAL_TASKS,
  INITIAL_CALENDAR_EVENTS,
  INITIAL_DOCUMENTS,
  INITIAL_CONVERSATIONS,
  INITIAL_MESSAGES,
  INITIAL_NOTIFICATIONS,
  INITIAL_ANNOUNCEMENTS
} from '../data/initialData';

const STORAGE_KEYS = {
  USERS: 'nx_users',
  TEAMS: 'nx_teams',
  PROJECTS: 'nx_projects',
  TASKS: 'nx_tasks',
  EVENTS: 'nx_events',
  DOCUMENTS: 'nx_documents',
  CONVERSATIONS: 'nx_conversations',
  MESSAGES: 'nx_messages',
  NOTIFICATIONS: 'nx_notifications',
  ANNOUNCEMENTS: 'nx_announcements',
  CURRENT_USER_ID: 'nx_current_user_id',
  THEME: 'nx_theme'
};

const getItem = (key, fallback) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    console.error('LocalStorage read error:', e);
    return fallback;
  }
};

const setItem = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }
};

export const initStorage = () => {
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) setItem(STORAGE_KEYS.USERS, INITIAL_USERS);
  if (!localStorage.getItem(STORAGE_KEYS.TEAMS)) setItem(STORAGE_KEYS.TEAMS, INITIAL_TEAMS);
  if (!localStorage.getItem(STORAGE_KEYS.PROJECTS)) setItem(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS);
  if (!localStorage.getItem(STORAGE_KEYS.TASKS)) setItem(STORAGE_KEYS.TASKS, INITIAL_TASKS);
  if (!localStorage.getItem(STORAGE_KEYS.EVENTS)) setItem(STORAGE_KEYS.EVENTS, INITIAL_CALENDAR_EVENTS);
  if (!localStorage.getItem(STORAGE_KEYS.DOCUMENTS)) setItem(STORAGE_KEYS.DOCUMENTS, INITIAL_DOCUMENTS);
  if (!localStorage.getItem(STORAGE_KEYS.CONVERSATIONS)) setItem(STORAGE_KEYS.CONVERSATIONS, INITIAL_CONVERSATIONS);
  if (!localStorage.getItem(STORAGE_KEYS.MESSAGES)) setItem(STORAGE_KEYS.MESSAGES, INITIAL_MESSAGES);
  if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) setItem(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
  if (!localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS)) setItem(STORAGE_KEYS.ANNOUNCEMENTS, INITIAL_ANNOUNCEMENTS);
  if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID)) setItem(STORAGE_KEYS.CURRENT_USER_ID, 'usr-admin');
  if (!localStorage.getItem(STORAGE_KEYS.THEME)) setItem(STORAGE_KEYS.THEME, 'light');
};

export const resetToInitialData = () => {
  setItem(STORAGE_KEYS.USERS, INITIAL_USERS);
  setItem(STORAGE_KEYS.TEAMS, INITIAL_TEAMS);
  setItem(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS);
  setItem(STORAGE_KEYS.TASKS, INITIAL_TASKS);
  setItem(STORAGE_KEYS.EVENTS, INITIAL_CALENDAR_EVENTS);
  setItem(STORAGE_KEYS.DOCUMENTS, INITIAL_DOCUMENTS);
  setItem(STORAGE_KEYS.CONVERSATIONS, INITIAL_CONVERSATIONS);
  setItem(STORAGE_KEYS.MESSAGES, INITIAL_MESSAGES);
  setItem(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
  setItem(STORAGE_KEYS.ANNOUNCEMENTS, INITIAL_ANNOUNCEMENTS);
  window.location.reload();
};

export const StorageService = {
  // USERS
  getUsers: () => getItem(STORAGE_KEYS.USERS, INITIAL_USERS),
  getUserById: (id) => getItem(STORAGE_KEYS.USERS, INITIAL_USERS).find(u => u.id === id),
  saveUser: (user) => {
    const users = getItem(STORAGE_KEYS.USERS, INITIAL_USERS);
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) users[index] = user;
    else users.push({ ...user, id: `usr-${Date.now()}` });
    setItem(STORAGE_KEYS.USERS, users);
    return user;
  },
  deleteUser: (id) => {
    const users = getItem(STORAGE_KEYS.USERS, INITIAL_USERS).filter(u => u.id !== id);
    setItem(STORAGE_KEYS.USERS, users);
  },

  // CURRENT AUTH / ROLE
  getCurrentUserId: () => getItem(STORAGE_KEYS.CURRENT_USER_ID, 'usr-admin'),
  setCurrentUserId: (id) => setItem(STORAGE_KEYS.CURRENT_USER_ID, id),

  // THEME
  getTheme: () => getItem(STORAGE_KEYS.THEME, 'light'),
  setTheme: (theme) => setItem(STORAGE_KEYS.THEME, theme),

  // PROJECTS
  getProjects: () => getItem(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS),
  getProjectById: (id) => getItem(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS).find(p => p.id === id),
  saveProject: (project) => {
    const list = getItem(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS);
    if (project.id) {
      const idx = list.findIndex(p => p.id === project.id);
      if (idx >= 0) list[idx] = project;
      else list.push(project);
    } else {
      project.id = `proj-${Date.now()}`;
      list.unshift(project);
    }
    setItem(STORAGE_KEYS.PROJECTS, list);
    return project;
  },
  deleteProject: (id) => {
    const list = getItem(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS).filter(p => p.id !== id);
    setItem(STORAGE_KEYS.PROJECTS, list);
  },

  // TASKS
  getTasks: () => getItem(STORAGE_KEYS.TASKS, INITIAL_TASKS),
  getTaskById: (id) => getItem(STORAGE_KEYS.TASKS, INITIAL_TASKS).find(t => t.id === id),
  saveTask: (task) => {
    const list = getItem(STORAGE_KEYS.TASKS, INITIAL_TASKS);
    if (task.id) {
      const idx = list.findIndex(t => t.id === task.id);
      if (idx >= 0) list[idx] = task;
      else list.push(task);
    } else {
      task.id = `task-${Date.now()}`;
      task.comments = task.comments || [];
      task.subtasks = task.subtasks || [];
      list.unshift(task);
    }
    setItem(STORAGE_KEYS.TASKS, list);
    return task;
  },
  deleteTask: (id) => {
    const list = getItem(STORAGE_KEYS.TASKS, INITIAL_TASKS).filter(t => t.id !== id);
    setItem(STORAGE_KEYS.TASKS, list);
  },

  // TEAMS
  getTeams: () => getItem(STORAGE_KEYS.TEAMS, INITIAL_TEAMS),
  getTeamById: (id) => getItem(STORAGE_KEYS.TEAMS, INITIAL_TEAMS).find(t => t.id === id),
  saveTeam: (team) => {
    const list = getItem(STORAGE_KEYS.TEAMS, INITIAL_TEAMS);
    if (team.id) {
      const idx = list.findIndex(t => t.id === team.id);
      if (idx >= 0) list[idx] = team;
      else list.push(team);
    } else {
      team.id = `team-${Date.now()}`;
      team.memberIds = team.memberIds || [];
      team.projectIds = team.projectIds || [];
      list.push(team);
    }
    setItem(STORAGE_KEYS.TEAMS, list);
    return team;
  },
  deleteTeam: (id) => {
    const list = getItem(STORAGE_KEYS.TEAMS, INITIAL_TEAMS).filter(t => t.id !== id);
    setItem(STORAGE_KEYS.TEAMS, list);
  },

  // DOCUMENTS
  getDocuments: () => getItem(STORAGE_KEYS.DOCUMENTS, INITIAL_DOCUMENTS),
  saveDocument: (doc) => {
    const list = getItem(STORAGE_KEYS.DOCUMENTS, INITIAL_DOCUMENTS);
    if (doc.id) {
      const idx = list.findIndex(d => d.id === doc.id);
      if (idx >= 0) list[idx] = doc;
      else list.push(doc);
    } else {
      doc.id = `doc-${Date.now()}`;
      list.unshift(doc);
    }
    setItem(STORAGE_KEYS.DOCUMENTS, list);
    return doc;
  },
  deleteDocument: (id) => {
    const list = getItem(STORAGE_KEYS.DOCUMENTS, INITIAL_DOCUMENTS).filter(d => d.id !== id);
    setItem(STORAGE_KEYS.DOCUMENTS, list);
  },

  // CALENDAR EVENTS
  getEvents: () => getItem(STORAGE_KEYS.EVENTS, INITIAL_CALENDAR_EVENTS),
  saveEvent: (event) => {
    const list = getItem(STORAGE_KEYS.EVENTS, INITIAL_CALENDAR_EVENTS);
    if (event.id) {
      const idx = list.findIndex(e => e.id === event.id);
      if (idx >= 0) list[idx] = event;
      else list.push(event);
    } else {
      event.id = `evt-${Date.now()}`;
      list.push(event);
    }
    setItem(STORAGE_KEYS.EVENTS, list);
    return event;
  },
  deleteEvent: (id) => {
    const list = getItem(STORAGE_KEYS.EVENTS, INITIAL_CALENDAR_EVENTS).filter(e => e.id !== id);
    setItem(STORAGE_KEYS.EVENTS, list);
  },

  // MESSAGES & CONVERSATIONS
  getConversations: () => getItem(STORAGE_KEYS.CONVERSATIONS, INITIAL_CONVERSATIONS),
  getMessages: (conversationId) => {
    const dict = getItem(STORAGE_KEYS.MESSAGES, INITIAL_MESSAGES);
    return dict[conversationId] || [];
  },
  sendMessage: (conversationId, message) => {
    const dict = getItem(STORAGE_KEYS.MESSAGES, INITIAL_MESSAGES);
    if (!dict[conversationId]) dict[conversationId] = [];
    const newMsg = {
      ...message,
      id: `msg-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reactions: []
    };
    dict[conversationId].push(newMsg);
    setItem(STORAGE_KEYS.MESSAGES, dict);

    // update conversation lastMessage
    const convs = getItem(STORAGE_KEYS.CONVERSATIONS, INITIAL_CONVERSATIONS);
    const conv = convs.find(c => c.id === conversationId);
    if (conv) {
      conv.lastMessage = newMsg.text;
      conv.lastMessageTime = newMsg.timestamp;
      setItem(STORAGE_KEYS.CONVERSATIONS, convs);
    }
    return newMsg;
  },
  toggleReaction: (conversationId, messageId, emoji) => {
    const dict = getItem(STORAGE_KEYS.MESSAGES, INITIAL_MESSAGES);
    if (!dict[conversationId]) return;
    const msg = dict[conversationId].find(m => m.id === messageId);
    if (msg) {
      msg.reactions = msg.reactions || [];
      const idx = msg.reactions.indexOf(emoji);
      if (idx >= 0) msg.reactions.splice(idx, 1);
      else msg.reactions.push(emoji);
      setItem(STORAGE_KEYS.MESSAGES, dict);
    }
  },

  // NOTIFICATIONS
  getNotifications: () => getItem(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS),
  markNotificationAsRead: (id) => {
    const list = getItem(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    const notif = list.find(n => n.id === id);
    if (notif) notif.read = true;
    setItem(STORAGE_KEYS.NOTIFICATIONS, list);
  },
  markAllNotificationsAsRead: () => {
    const list = getItem(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS).map(n => ({ ...n, read: true }));
    setItem(STORAGE_KEYS.NOTIFICATIONS, list);
  },
  deleteNotification: (id) => {
    const list = getItem(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS).filter(n => n.id !== id);
    setItem(STORAGE_KEYS.NOTIFICATIONS, list);
  },

  // ANNOUNCEMENTS
  getAnnouncements: () => getItem(STORAGE_KEYS.ANNOUNCEMENTS, INITIAL_ANNOUNCEMENTS)
};


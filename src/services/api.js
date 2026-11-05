/**
 * Centralized HTTP Client with Secure In-Memory Token Management
 * - Access token stored strictly in private module memory (NEVER in localStorage/sessionStorage).
 * - Automatic refresh interception on 401s using HttpOnly cookie credentials.
 * - CSRF / Origin headers attached to state-changing requests.
 */

import { editableContent } from '../utils/contentFields';

let inMemoryAccessToken = null;
let activeRefreshPromise = null;
const activeDataRequests = new Map();

export function setAccessToken(token) {
  inMemoryAccessToken = token;
}

export function getAccessToken() {
  return inMemoryAccessToken;
}

export function clearAccessToken() {
  inMemoryAccessToken = null;
}

const API_BASE_URL = '';

/**
 * Standard fetch wrapper with automatic Authorization and credentials support.
 * Guarantees single-flight refresh and single-retry on 401.
 */
export async function apiRequest(endpoint, options = {}, isRetry = false) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // Standard CSRF prevention header
    ...(options.headers || {}),
  };

  if (inMemoryAccessToken) {
    headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  const config = {
    ...options,
    headers,
    credentials: 'include', // Send and receive HttpOnly cookies
    signal: options.signal || AbortSignal.timeout(20000),
  };

  let response = await fetch(url, config);

  // If unauthorized and this is not already a login/refresh request or a retry
  if (
    response.status === 401 &&
    !isRetry &&
    !endpoint.includes('/auth/login') &&
    !endpoint.includes('/auth/refresh')
  ) {
    const refreshed = await attemptSilentRefresh();
    if (refreshed?.accessToken) {
      // Retry original request exactly once with new token
      return apiRequest(endpoint, options, true);
    }
  }

  const contentType = response.headers.get('content-type');
  let data = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  }

  if (!response.ok) {
    const errorMsg = data?.error?.message || response.statusText || 'Request failed';
    const error = new Error(errorMsg);
    error.status = response.status;
    error.code = data?.error?.code;
    error.details = data?.error?.details;
    throw error;
  }

  return data;
}

/**
 * Silent session refresh using HttpOnly cookie credentials.
 * Implements single-flight request de-duplication across concurrent callers.
 */
export async function attemptSilentRefresh() {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        clearAccessToken();
        return null;
      }

      const json = await response.json();
      if (json.success && json.data?.accessToken) {
        setAccessToken(json.data.accessToken);
        return json.data;
      }
      clearAccessToken();
      return null;
    } catch  {
      clearAccessToken();
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

export const AuthAPI = {
  login: async (email, password) => {
    const res = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.data?.accessToken) {
      setAccessToken(res.data.accessToken);
    }
    return res.data;
  },

  logout: async () => {
    try {
      await apiRequest('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      clearAccessToken();
    }
  },

  getMe: async () => {
    const res = await apiRequest('/api/v1/auth/me', { method: 'GET' });
    return res.data?.user;
  },

  forgotPassword: async (email) => {
    return await apiRequest('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  verifyOtp: async (email, otp) => {
    return await apiRequest('/api/v1/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  },

  resetPassword: async (token, newPassword) => {
    return await apiRequest('/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  },

  changePassword: async (currentPassword, newPassword) => {
    return await apiRequest('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
};

// Unified Data Gateway Helper
async function dataRequest(entity, action, payload = {}) {
  if (payload.content && ['projects', 'tasks'].includes(entity)) payload = { ...payload, content: editableContent(payload.content, entity === 'projects') };
  const requestPayload = action === 'create' && !payload.clientMutationId
    ? { ...payload, clientMutationId: crypto.randomUUID() }
    : payload;
  const isRead = action === 'list' || action === 'get' || action === 'sync' || action === 'delete-summary';
  const requestKey = isRead ? JSON.stringify([entity, action, requestPayload]) : null;
  if (requestKey && activeDataRequests.has(requestKey)) return activeDataRequests.get(requestKey);
  const request = apiRequest('/api/v1/data', {
    method: 'POST',
    body: JSON.stringify({ entity, action, payload: requestPayload })
  }).then(res => res.data).finally(() => {
    if (requestKey) activeDataRequests.delete(requestKey);
  });
  if (requestKey) activeDataRequests.set(requestKey, request);
  return request;
}

export const DataAPI = {
  bootstrap: async () => await dataRequest('bootstrap', 'get'),
};

export const UsersAPI = {
  getAll: async () => (await dataRequest('users', 'list'))?.users || [],
  create: async (data) => (await dataRequest('users', 'create', data))?.user,
  update: async (data) => (await dataRequest('users', 'update', data))?.user,
  getDeleteSummary: async (id) => await dataRequest('users', 'delete-summary', { id }),
  delete: async (id, projectReassignments = {}, teamReassignments = {}) =>
    await dataRequest('users', 'delete', { id, projectReassignments, teamReassignments }),
};

export const TeamsAPI = {
  getAll: async () => (await dataRequest('teams', 'list'))?.teams || [],
  create: async (data) => (await dataRequest('teams', 'create', data))?.team,
  update: async (data) => await dataRequest('teams', 'update', data),
  delete: async (id) => await dataRequest('teams', 'delete', { id }),
};

export const ProjectsAPI = {
  getAll: async () => (await dataRequest('projects', 'list'))?.projects || [],
  create: async (data) => (await dataRequest('projects', 'create', data))?.project,
  update: async (data) => await dataRequest('projects', 'update', data),
  delete: async (id) => await dataRequest('projects', 'delete', { id }),
};

export const TasksAPI = {
  getAll: async () => (await dataRequest('tasks', 'list'))?.tasks || [],
  create: async (data) => (await dataRequest('tasks', 'create', data))?.task,
  update: async (data) => await dataRequest('tasks', 'update', data),
  delete: async (id) => await dataRequest('tasks', 'delete', { id }),
};

export const DocumentsAPI = {
  getAll: async () => (await dataRequest('documents', 'list'))?.documents || [],
  create: async (data) => (await dataRequest('documents', 'create', data))?.document,
  getFile: async (id) => await dataRequest('documents', 'get-file', { id }),
  update: async (data) => await dataRequest('documents', 'update', data),
  delete: async (id) => await dataRequest('documents', 'delete', { id }),
  assignFileAccess: async (id, userIds) => await dataRequest('documents', 'assign-file-access', { id, userIds }),
  assignFolderAccess: async (folderKey, userIds) => await dataRequest('documents', 'assign-folder-access', { folderKey, userIds }),
};

export const CalendarAPI = {
  getAll: async () => (await dataRequest('calendar-events', 'list'))?.events || [],
  create: async (data) => (await dataRequest('calendar-events', 'create', data))?.event,
  update: async (data) => await dataRequest('calendar-events', 'update', data),
  delete: async (id) => await dataRequest('calendar-events', 'delete', { id }),
};

export const NotificationsAPI = {
  getAll: async () => (await dataRequest('notifications', 'list'))?.notifications || [],
  markRead: async (id) => await dataRequest('notifications', 'update', { id }),
  markAllRead: async () => await dataRequest('notifications', 'update', { markAll: true }),
  delete: async (id) => await dataRequest('notifications', 'delete', { id }),
};

export const AnnouncementsAPI = {
  getAll: async () => (await dataRequest('announcements', 'list'))?.announcements || [],
  create: async (data) => (await dataRequest('announcements', 'create', data))?.announcement,
  delete: async (id) => await dataRequest('announcements', 'delete', { id }),
};

export const ConversationsAPI = {
  getAll: async () => (await dataRequest('conversations', 'list')) || { conversations: [], messages: {}, syncCursor: null },
  sync: async (since) => (await dataRequest('conversations', 'sync', { since })) || { conversations: [], messages: [], syncCursor: since },
  sendMessage: async (payload) => (await dataRequest('conversations', 'create', payload))?.message,
  editMessage: async (messageId, text) => (await dataRequest('conversations', 'edit', { messageId, text }))?.message,
  deleteMessage: async (messageId) => await dataRequest('conversations', 'delete', { messageId }),
  react: async (messageId, emoji) => await dataRequest('conversations', 'react', { messageId, emoji }),
  startDM: async (targetUserId) => (await dataRequest('conversations', 'start-dm', { targetUserId }))?.conversationId,
  updateSettings: async (payload) => await dataRequest('conversations', 'update-settings', payload),
};


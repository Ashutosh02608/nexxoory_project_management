/**
 * Centralized Role-Based Access Control (RBAC) System
 * Defines role navigation, route access matrices, action policies, and scope filters.
 */

import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  ListTodo,
  Users2,
  UserCircle2,
  CalendarDays,
  GanttChartSquare,
  FolderArchive,
  MessageSquare,
  BarChart3,
  Bell,
  Settings
} from 'lucide-react';

export const ROLES = {
  ADMIN: 'admin',
  PROJECT_MANAGER: 'project_manager',
  TEAM_MEMBER: 'team_member',
};

/**
 * 6. Navigation Structure
 */
export const ROLE_NAVIGATION = {
  [ROLES.ADMIN]: [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Projects', path: '/projects', icon: FolderKanban },
    { label: 'Tasks', path: '/tasks', icon: ListTodo },
    { label: 'Teams', path: '/teams', icon: Users2 },
    { label: 'Employees', path: '/employees', icon: UserCircle2 },
    { label: 'Calendar', path: '/calendar', icon: CalendarDays },
    { label: 'Documents', path: '/documents', icon: FolderArchive },
    { label: 'Discussions', path: '/messages', icon: MessageSquare },
    { label: 'Reports', path: '/reports', icon: BarChart3 },
    { label: 'Notifications', path: '/notifications', icon: Bell },
    { label: 'Settings', path: '/settings', icon: Settings },
  ],
  [ROLES.PROJECT_MANAGER]: [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'My Projects', path: '/projects', icon: FolderKanban },
    { label: 'Tasks', path: '/tasks', icon: ListTodo },
    { label: 'Teams', path: '/teams', icon: Users2 },
    { label: 'Calendar', path: '/calendar', icon: CalendarDays },
    { label: 'Documents', path: '/documents', icon: FolderArchive },
    { label: 'Discussions', path: '/messages', icon: MessageSquare },
    { label: 'Reports', path: '/reports', icon: BarChart3 },
    { label: 'Notifications', path: '/notifications', icon: Bell },
    { label: 'Personal Settings', path: '/settings', icon: Settings },
  ],
  [ROLES.TEAM_MEMBER]: [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'My Work', path: '/my-work', icon: CheckSquare },
    { label: 'My Projects', path: '/projects', icon: FolderKanban },
    { label: 'My Tasks', path: '/tasks', icon: ListTodo },
    { label: 'Calendar', path: '/calendar', icon: CalendarDays },
    { label: 'Documents', path: '/documents', icon: FolderArchive },
    { label: 'Discussions', path: '/messages', icon: MessageSquare },
    { label: 'Notifications', path: '/notifications', icon: Bell },
    { label: 'Personal Settings', path: '/settings', icon: Settings },
  ],
};

/**
 * Route-level access permissions
 */
export const ROUTE_PERMISSIONS = {
  '/': [ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.TEAM_MEMBER],
  '/my-work': [ROLES.TEAM_MEMBER],
  '/projects': [ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.TEAM_MEMBER],
  '/tasks': [ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.TEAM_MEMBER],
  '/teams': [ROLES.ADMIN, ROLES.PROJECT_MANAGER],
  '/employees': [ROLES.ADMIN],
  '/calendar': [ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.TEAM_MEMBER],
  '/documents': [ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.TEAM_MEMBER],
  '/messages': [ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.TEAM_MEMBER],
  '/reports': [ROLES.ADMIN, ROLES.PROJECT_MANAGER],
  '/notifications': [ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.TEAM_MEMBER],
  '/settings': [ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.TEAM_MEMBER],
};

/**
 * 4. Consolidated Permission Matrix Actions
 */
export const ACTION_PERMISSIONS = {
  ORG_DASHBOARD: [ROLES.ADMIN],
  CREATE_PROJECT: [ROLES.ADMIN, ROLES.PROJECT_MANAGER],
  DELETE_PROJECT: [ROLES.ADMIN],
  CREATE_TASK: [ROLES.ADMIN, ROLES.PROJECT_MANAGER],
  DELETE_TASK: [ROLES.ADMIN],
  CREATE_TEAM: [ROLES.ADMIN],
  MANAGE_TEAM_MEMBERS: [ROLES.ADMIN],
  MANAGE_EMPLOYEES: [ROLES.ADMIN],
  MANAGE_ORG_EVENTS: [ROLES.ADMIN],
  MANAGE_MILESTONES: [ROLES.ADMIN, ROLES.PROJECT_MANAGER],
  PUBLISH_ORG_ANNOUNCEMENT: [ROLES.ADMIN],
  PUBLISH_PROJECT_ANNOUNCEMENT: [ROLES.ADMIN, ROLES.PROJECT_MANAGER],
  VIEW_ORG_REPORTS: [ROLES.ADMIN],
  VIEW_PROJECT_REPORTS: [ROLES.ADMIN, ROLES.PROJECT_MANAGER],
  EXPORT_PROJECT_CSV: [ROLES.ADMIN, ROLES.PROJECT_MANAGER],
  SYSTEM_SETTINGS: [ROLES.ADMIN],
  GLOBAL_QUICK_CREATE: [ROLES.ADMIN, ROLES.PROJECT_MANAGER],
};

/**
 * Helper to fetch navigation for a role
 */
export function getRoleNavigation(role) {
  return ROLE_NAVIGATION[role] || ROLE_NAVIGATION[ROLES.TEAM_MEMBER];
}

/**
 * Check if a role can access a specific route
 */
export function canAccessRoute(role, route) {
  if (!role) return false;
  const allowedRoles = ROUTE_PERMISSIONS[route];
  if (!allowedRoles) return true;
  return allowedRoles.includes(role);
}

/**
 * Check if a role can perform an action
 */
export function canPerformAction(role, action) {
  if (!role) return false;
  const allowedRoles = ACTION_PERMISSIONS[action];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}

/**
 * Data Scoping Rules
 */
export const ScopeRules = {
  // Projects visible to user
  filterProjects: (projects = [], user) => {
    if (!user) return [];
    if (user.role === ROLES.ADMIN) return projects;
    if (user.role === ROLES.PROJECT_MANAGER) {
      return projects.filter(p => p.managerId === user.id || p.assignedManagerId === user.id);
    }
    // Team member: projects where member's teams or personal assignment apply
    return projects.filter(p => p.memberIds?.includes(user.id) || p.tags?.includes(user.department));
  },

  // Project Edit check
  canEditProject: (project, user) => {
    if (!user || !project) return false;
    if (user.role === ROLES.ADMIN) return true;
    if (user.role === ROLES.PROJECT_MANAGER) {
      return project.managerId === user.id || project.assignedManagerId === user.id;
    }
    return false;
  },

  // Task Edit check
  canEditTask: (task, user) => {
    if (!user || !task) return false;
    if (user.role === ROLES.ADMIN) return true;
    if (user.role === ROLES.PROJECT_MANAGER) return true;
    // Team member can only edit own assigned tasks
    return task.assigneeId === user.id;
  },

  // Task Progress update check
  canUpdateTaskProgress: (task, user) => {
    if (!user || !task) return false;
    if (user.role === ROLES.ADMIN || user.role === ROLES.PROJECT_MANAGER) return true;
    return task.assigneeId === user.id;
  }
};

// Centrally maintained mock sign-in accounts exclusively for authentication
export const DEMO_SIGNIN_ACCOUNTS = [
  {
    id: 'usr-admin',
    name: 'Administrator',
    email: 'admin@nexxoory.com',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    designation: 'System Administrator',
    department: 'Administration',
    status: 'Active'
  }
];

export const INITIAL_USERS = DEMO_SIGNIN_ACCOUNTS;

// Real application empty datasets (zero mock data)
export const INITIAL_DEPARTMENTS = [];
export const INITIAL_TEAMS = [];
export const INITIAL_PROJECTS = [];
export const INITIAL_TASKS = [];
export const INITIAL_CALENDAR_EVENTS = [];
export const INITIAL_DOCUMENTS = [];
export const INITIAL_CONVERSATIONS = [];
export const INITIAL_MESSAGES = {};
export const INITIAL_NOTIFICATIONS = [];
export const INITIAL_ANNOUNCEMENTS = [];

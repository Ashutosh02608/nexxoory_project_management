export const INITIAL_USERS = [
  {
    id: 'usr-admin',
    name: 'Alexandra Vance',
    email: 'admin@nexxoory.com',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    designation: 'VP of Engineering',
    department: 'Executive',
    status: 'Active'
  },
  {
    id: 'usr-pm',
    name: 'Marcus Sterling',
    email: 'pm@nexxoory.com',
    role: 'project_manager',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    designation: 'Senior Technical PM',
    department: 'Product Delivery',
    status: 'Active'
  },
  {
    id: 'usr-member',
    name: 'Elena Rostova',
    email: 'dev@nexxoory.com',
    role: 'team_member',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    designation: 'Senior Frontend Architect',
    department: 'Frontend Core',
    status: 'Active'
  },
  {
    id: 'usr-4',
    name: 'David Chen',
    email: 'david.c@nexxoory.com',
    role: 'team_member',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    designation: 'Cloud Systems Engineer',
    department: 'DevOps & Infrastructure',
    status: 'Active'
  },
  {
    id: 'usr-5',
    name: 'Sophia Patel',
    email: 'sophia.p@nexxoory.com',
    role: 'team_member',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    designation: 'Product Designer (UI/UX)',
    department: 'Design Studio',
    status: 'Active'
  },
  {
    id: 'usr-6',
    name: 'Liam Gallagher',
    email: 'liam.g@nexxoory.com',
    role: 'team_member',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    designation: 'QA Automation Lead',
    department: 'Quality Assurance',
    status: 'Active'
  }
];

export const INITIAL_DEPARTMENTS = [
  'Executive',
  'Product Delivery',
  'Frontend Core',
  'DevOps & Infrastructure',
  'Design Studio',
  'Quality Assurance'
];

export const INITIAL_TEAMS = [
  {
    id: 'team-1',
    name: 'Design System & UI',
    leaderId: 'usr-5',
    department: 'Design Studio',
    description: 'Core design tokens, components, accessibility, and visual guidelines.',
    memberIds: ['usr-5', 'usr-member'],
    projectIds: ['proj-1', 'proj-3'],
    color: '#635BFF'
  },
  {
    id: 'team-2',
    name: 'Frontend Core Platform',
    leaderId: 'usr-member',
    department: 'Frontend Core',
    description: 'React SPA architecture, real-time client state, and performance.',
    memberIds: ['usr-member', 'usr-pm'],
    projectIds: ['proj-1', 'proj-2'],
    color: '#16A36A'
  },
  {
    id: 'team-3',
    name: 'Cloud & Infrastructure',
    leaderId: 'usr-4',
    department: 'DevOps & Infrastructure',
    description: 'Multi-region Kubernetes deployment, CI/CD pipelines, and telemetry.',
    memberIds: ['usr-4', 'usr-admin'],
    projectIds: ['proj-2', 'proj-4'],
    color: '#E9A23B'
  },
  {
    id: 'team-4',
    name: 'Mobile Solutions Group',
    leaderId: 'usr-pm',
    department: 'Product Delivery',
    description: 'Cross-platform iOS and Android enterprise dashboard applications.',
    memberIds: ['usr-pm', 'usr-6', 'usr-member'],
    projectIds: ['proj-3'],
    color: '#8B5CF6'
  }
];

export const INITIAL_PROJECTS = [
  {
    id: 'proj-1',
    name: 'Nexxoory Portal 2.0',
    description: 'Unified enterprise SaaS experience with automated analytics and responsive dashboard architecture.',
    managerId: 'usr-pm',
    teamId: 'team-2',
    priority: 'High',
    status: 'In Progress',
    startDate: '2026-10-01',
    dueDate: '2026-12-15',
    progress: 68,
    budget: 145000,
    spent: 98000,
    tags: ['Frontend', 'Vite', 'React']
  },
  {
    id: 'proj-2',
    name: 'Multi-Cloud Edge Gateway',
    description: 'Low-latency routing, edge compute caching, and federated security services for global workloads.',
    managerId: 'usr-admin',
    teamId: 'team-3',
    priority: 'Urgent',
    status: 'In Progress',
    startDate: '2026-09-15',
    dueDate: '2026-11-20',
    progress: 82,
    budget: 210000,
    spent: 172000,
    tags: ['DevOps', 'Cloud', 'Kubernetes']
  },
  {
    id: 'proj-3',
    name: 'Design System & Token Studio',
    description: 'Next-gen enterprise UI library with Radix primitives, WCAG 2.2 compliance, and theme generator.',
    managerId: 'usr-pm',
    teamId: 'team-1',
    priority: 'Medium',
    status: 'In Review',
    startDate: '2026-08-01',
    dueDate: '2026-11-10',
    progress: 95,
    budget: 65000,
    spent: 61500,
    tags: ['Design', 'Tokens', 'UI/UX']
  },
  {
    id: 'proj-4',
    name: 'AI Analytics Copilot',
    description: 'Contextual project insights, automated risk detection, and milestone probability modeling.',
    managerId: 'usr-pm',
    teamId: 'team-2',
    priority: 'Low',
    status: 'Planning',
    startDate: '2026-11-15',
    dueDate: '2027-02-28',
    progress: 15,
    budget: 95000,
    spent: 12000,
    tags: ['AI', 'Analytics', 'Predictive']
  },
  {
    id: 'proj-5',
    name: 'SOC2 Type II Compliance Audit',
    description: 'Security control verification, data retention automation, and external auditor verification.',
    managerId: 'usr-admin',
    teamId: 'team-3',
    priority: 'High',
    status: 'Completed',
    startDate: '2026-06-01',
    dueDate: '2026-10-15',
    progress: 100,
    budget: 80000,
    spent: 78500,
    tags: ['Security', 'Compliance']
  },
  {
    id: 'proj-6',
    name: 'Client Billing Integration Hub',
    description: 'Stripe & SAP ledger reconciliation engine for automated billing subscriptions.',
    managerId: 'usr-pm',
    teamId: 'team-2',
    priority: 'Urgent',
    status: 'Overdue',
    startDate: '2026-08-15',
    dueDate: '2026-10-25',
    progress: 55,
    budget: 110000,
    spent: 92000,
    tags: ['Billing', 'Finance']
  }
];

export const INITIAL_TASKS = [
  {
    id: 'task-101',
    title: 'Finalize Dark Theme Contrast Ratios',
    description: 'Audit all UI components against WCAG AA standards in dark mode state.',
    projectId: 'proj-3',
    assigneeId: 'usr-5',
    teamId: 'team-1',
    priority: 'High',
    status: 'Completed',
    startDate: '2026-10-10',
    dueDate: '2026-10-22',
    progress: 100,
    labels: ['Design', 'Accessibility'],
    subtasks: [
      { id: 'sub-1', title: 'Audit button hover states', completed: true },
      { id: 'sub-2', title: 'Check sidebar contrast', completed: true }
    ],
    comments: [
      { id: 'c-1', userId: 'usr-5', userName: 'Sophia Patel', userAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', text: 'All contrast scores passed with 7:1 ratio!', timestamp: '2026-10-22 14:30' }
    ]
  },
  {
    id: 'task-102',
    title: 'Migrate Kanban Board to LocalStorage Persistence',
    description: 'Ensure drag and drop reordering updates column positions and stores state.',
    projectId: 'proj-1',
    assigneeId: 'usr-member',
    teamId: 'team-2',
    priority: 'Urgent',
    status: 'In Progress',
    startDate: '2026-10-20',
    dueDate: '2026-11-05',
    progress: 75,
    labels: ['Frontend', 'State'],
    subtasks: [
      { id: 'sub-3', title: 'Draft mock service interface', completed: true },
      { id: 'sub-4', title: 'Implement drag event handlers', completed: true },
      { id: 'sub-5', title: 'Add localStorage hydrate checks', completed: false }
    ],
    comments: [
      { id: 'c-2', userId: 'usr-pm', userName: 'Marcus Sterling', userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', text: 'Looking super smooth in local staging.', timestamp: '2026-11-01 09:15' }
    ]
  },
  {
    id: 'task-103',
    title: 'Provision Cloud Edge DNS Anycast',
    description: 'Setup Cloudflare Terraform records and configure SSL handshake terminates.',
    projectId: 'proj-2',
    assigneeId: 'usr-4',
    teamId: 'team-3',
    priority: 'High',
    status: 'In Progress',
    startDate: '2026-10-25',
    dueDate: '2026-11-08',
    progress: 60,
    labels: ['Cloud', 'Network'],
    subtasks: [
      { id: 'sub-6', title: 'Write terraform scripts', completed: true },
      { id: 'sub-7', title: 'Execute zero-downtime cutover', completed: false }
    ],
    comments: []
  },
  {
    id: 'task-104',
    title: 'Construct Role-Based Route Guards',
    description: 'Centralize frontend permission policies for Admin, PM, and Team Member roles.',
    projectId: 'proj-1',
    assigneeId: 'usr-member',
    teamId: 'team-2',
    priority: 'Medium',
    status: 'To Do',
    startDate: '2026-11-01',
    dueDate: '2026-11-12',
    progress: 20,
    labels: ['Frontend', 'Security'],
    subtasks: [
      { id: 'sub-8', title: 'Define permission matrix', completed: true },
      { id: 'sub-9', title: 'Attach Route wrapper', completed: false }
    ],
    comments: []
  },
  {
    id: 'task-105',
    title: 'Stripe Webhook Signature Verification',
    description: 'Reconcile event triggers for customer subscriptions and invoice failures.',
    projectId: 'proj-6',
    assigneeId: 'usr-member',
    teamId: 'team-2',
    priority: 'Urgent',
    status: 'Blocked',
    startDate: '2026-10-15',
    dueDate: '2026-10-26',
    progress: 40,
    labels: ['Finance', 'API'],
    subtasks: [
      { id: 'sub-10', title: 'Mock test payloads', completed: true }
    ],
    comments: [
      { id: 'c-3', userId: 'usr-admin', userName: 'Alexandra Vance', userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', text: 'Blocked waiting for banking API test credentials.', timestamp: '2026-10-28 11:00' }
    ]
  },
  {
    id: 'task-106',
    title: 'Implement AI Model Inference Cache',
    description: 'Architect vector embedding cache layer with redis simulator.',
    projectId: 'proj-4',
    assigneeId: 'usr-4',
    teamId: 'team-3',
    priority: 'Low',
    status: 'Backlog',
    startDate: '2026-11-20',
    dueDate: '2026-12-05',
    progress: 0,
    labels: ['AI', 'Performance'],
    subtasks: [],
    comments: []
  },
  {
    id: 'task-107',
    title: 'Publish Nexxoory UI Component Documentation',
    description: 'Create interactive Storybook or showcase page for shared team consumption.',
    projectId: 'proj-3',
    assigneeId: 'usr-5',
    teamId: 'team-1',
    priority: 'Medium',
    status: 'In Review',
    startDate: '2026-10-28',
    dueDate: '2026-11-09',
    progress: 90,
    labels: ['Docs', 'UI'],
    subtasks: [
      { id: 'sub-11', title: 'Generate Markdown tables', completed: true },
      { id: 'sub-12', title: 'Add interactive preview widgets', completed: true }
    ],
    comments: []
  }
];

export const INITIAL_CALENDAR_EVENTS = [
  {
    id: 'evt-1',
    title: 'Sprint Planning & Grooming',
    type: 'meeting',
    startDate: '2026-11-04T10:00:00',
    endDate: '2026-11-04T11:30:00',
    projectId: 'proj-1',
    attendees: ['usr-pm', 'usr-member', 'usr-5'],
    location: 'Meeting Room Alpha / Virtual'
  },
  {
    id: 'evt-2',
    title: 'Design System v2.0 Release Candidate',
    type: 'milestone',
    startDate: '2026-11-10T17:00:00',
    endDate: '2026-11-10T18:00:00',
    projectId: 'proj-3',
    attendees: ['usr-5', 'usr-pm', 'usr-admin'],
    location: 'Production Pipeline'
  },
  {
    id: 'evt-3',
    title: 'Architecture Review: Cloud Gateway',
    type: 'meeting',
    startDate: '2026-11-06T14:00:00',
    endDate: '2026-11-06T15:30:00',
    projectId: 'proj-2',
    attendees: ['usr-admin', 'usr-4', 'usr-pm'],
    location: 'Conference Room C'
  },
  {
    id: 'evt-4',
    title: 'Nexxoory Portal 2.0 Feature Freeze',
    type: 'deadline',
    startDate: '2026-11-15T23:59:00',
    endDate: '2026-11-15T23:59:00',
    projectId: 'proj-1',
    attendees: ['usr-pm', 'usr-member'],
    location: 'Portal 2.0 Repo'
  }
];

export const INITIAL_DOCUMENTS = [
  {
    id: 'doc-1',
    name: 'Enterprise Architecture & Style Blueprint.pdf',
    folder: 'Architecture',
    size: '4.8 MB',
    type: 'PDF',
    updatedAt: '2026-10-24',
    projectId: 'proj-1',
    author: 'Alexandra Vance',
    content: 'Comprehensive architectural specifications for the Nexxoory distributed enterprise platform.'
  },
  {
    id: 'doc-2',
    name: 'Design_Tokens_Specifications_v2.json',
    folder: 'Design Assets',
    size: '240 KB',
    type: 'JSON',
    updatedAt: '2026-11-01',
    projectId: 'proj-3',
    author: 'Sophia Patel',
    content: 'Standardized design token definitions covering colors, elevation, radii, and typography scales.'
  },
  {
    id: 'doc-3',
    name: 'SOC2_Compliance_Controls_Checklist.xlsx',
    folder: 'Security & Legal',
    size: '1.2 MB',
    type: 'XLSX',
    updatedAt: '2026-10-14',
    projectId: 'proj-5',
    author: 'Alexandra Vance',
    content: 'Control status matrix auditing identity validation, token lifecycles, and audit telemetry.'
  },
  {
    id: 'doc-4',
    name: 'Frontend_State_Persistence_Spec.md',
    folder: 'Engineering Specs',
    size: '95 KB',
    type: 'MD',
    updatedAt: '2026-10-30',
    projectId: 'proj-1',
    author: 'Elena Rostova',
    content: 'Engineering design notes detailing localStorage hydration and mock sync mechanisms.'
  }
];

export const INITIAL_CONVERSATIONS = [
  {
    id: 'conv-1',
    name: 'Nexxoory Portal 2.0 Sync',
    type: 'project',
    projectId: 'proj-1',
    participants: ['usr-admin', 'usr-pm', 'usr-member', 'usr-5'],
    unreadCount: 2,
    lastMessage: 'Let us make sure the dark theme toggle updates CSS variables instantaneously.',
    lastMessageTime: '10:14 AM'
  },
  {
    id: 'conv-2',
    name: 'Frontend Core Platform',
    type: 'team',
    teamId: 'team-2',
    participants: ['usr-member', 'usr-pm'],
    unreadCount: 0,
    lastMessage: 'All unit test runners passing cleanly on Vite 8 build pipeline.',
    lastMessageTime: 'Yesterday'
  },
  {
    id: 'conv-3',
    name: 'Marcus Sterling',
    type: 'direct',
    participants: ['usr-admin', 'usr-pm'],
    unreadCount: 1,
    lastMessage: 'Marcus, could you review the revised milestone deadlines for Q4?',
    lastMessageTime: 'Nov 02'
  },
  {
    id: 'conv-4',
    name: 'Sophia Patel',
    type: 'direct',
    participants: ['usr-admin', 'usr-5'],
    unreadCount: 0,
    lastMessage: 'Brand color hex codes aligned to spec #635BFF and #4942D9.',
    lastMessageTime: 'Oct 31'
  }
];

export const INITIAL_MESSAGES = {
  'conv-1': [
    {
      id: 'msg-1',
      senderId: 'usr-pm',
      senderName: 'Marcus Sterling',
      senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      text: 'Good morning team! We are on track for the v2.0 portal milestone.',
      timestamp: '09:45 AM',
      reactions: ['👍', '🚀']
    },
    {
      id: 'msg-2',
      senderId: 'usr-member',
      senderName: 'Elena Rostova',
      senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      text: 'Kanban board state transitions are smooth with localStorage backup.',
      timestamp: '09:50 AM',
      reactions: ['❤️']
    },
    {
      id: 'msg-3',
      senderId: 'usr-admin',
      senderName: 'Alexandra Vance',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      text: 'Let us make sure the dark theme toggle updates CSS variables instantaneously.',
      timestamp: '10:14 AM',
      reactions: []
    }
  ],
  'conv-2': [
    {
      id: 'msg-4',
      senderId: 'usr-member',
      senderName: 'Elena Rostova',
      senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      text: 'All unit test runners passing cleanly on Vite 8 build pipeline.',
      timestamp: 'Yesterday 16:30',
      reactions: ['🙌']
    }
  ],
  'conv-3': [
    {
      id: 'msg-5',
      senderId: 'usr-admin',
      senderName: 'Alexandra Vance',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      text: 'Marcus, could you review the revised milestone deadlines for Q4?',
      timestamp: 'Nov 02 11:20',
      reactions: []
    }
  ],
  'conv-4': [
    {
      id: 'msg-6',
      senderId: 'usr-5',
      senderName: 'Sophia Patel',
      senderAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
      text: 'Brand color hex codes aligned to spec #635BFF and #4942D9.',
      timestamp: 'Oct 31 15:00',
      reactions: ['✨']
    }
  ]
};

export const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-1',
    title: 'Task Assigned',
    message: 'You have been assigned to "Construct Role-Based Route Guards".',
    timestamp: '15 mins ago',
    read: false,
    type: 'task',
    link: '/tasks'
  },
  {
    id: 'notif-2',
    title: 'Project Status Updated',
    message: 'Nexxoory Portal 2.0 progress reached 68%.',
    timestamp: '2 hours ago',
    read: false,
    type: 'project',
    link: '/projects'
  },
  {
    id: 'notif-3',
    title: 'Upcoming Milestone Deadline',
    message: 'Design System & Token Studio due in 7 days.',
    timestamp: 'Yesterday',
    read: true,
    type: 'deadline',
    link: '/calendar'
  },
  {
    id: 'notif-4',
    title: 'System Announcement',
    message: 'Scheduled maintenance window this Saturday 02:00 UTC.',
    timestamp: '2 days ago',
    read: true,
    type: 'announcement',
    link: '/dashboard'
  }
];

export const INITIAL_ANNOUNCEMENTS = [
  {
    id: 'ann-1',
    title: 'Nexxoory Q4 All-Hands Meeting',
    content: 'Join executive leadership this Thursday for the global roadmap and product reveal.',
    date: '2026-11-05',
    author: 'Alexandra Vance',
    tag: 'Company Event'
  },
  {
    id: 'ann-2',
    title: 'SOC2 Type II Audit Completed Successfully',
    content: 'Security verification completed with zero findings. Commendations to the DevOps team!',
    date: '2026-10-28',
    author: 'Alexandra Vance',
    tag: 'Milestone'
  }
];


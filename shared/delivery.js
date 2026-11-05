export function isSocialProject(content = {}) {
  return content.projectType === 'Social Media Marketing' || (!content.projectType && ['postTarget', 'reelTarget', 'aiReelTarget'].some(key => content[key] > 0));
}

export const SOCIAL_DELIVERABLE_TYPES = ['Post', 'Reel', 'AI Reel'];

export const deliveryUnits = {
  'Brand Identity': 'brand assets',
  'Google Business Page & Cloud Storage': 'setup / maintenance tasks',
  'Website Development': 'pages / milestones',
  'Search Engine Optimization': 'SEO deliverables',
  'Video and Photo Shoots': 'shoot deliverables',
  'Custom Web Application': 'features / milestones',
  'Influencer Collaborations': 'collaborations',
  'Domain and Hosting': 'setup / renewal tasks',
  'Mobile App Development': 'features / releases',
  'Graphic Design': 'creative assets',
  'Other': 'deliverables'
};

/**
 * Resolves effective deliverable type for a task within its project context.
 */
export function getDeliverableType(task = {}, project = {}) {
  const isSocial = isSocialProject(project?.content);
  const rawType = task?.content?.contentType;

  if (isSocial) {
    if (SOCIAL_DELIVERABLE_TYPES.includes(rawType)) return rawType;
    const title = String(task?.title || '');
    if (/ai\s*reel/i.test(title)) return 'AI Reel';
    if (/reel/i.test(title)) return 'Reel';
    return 'Post';
  }

  return rawType || project?.content?.projectType || 'Deliverable';
}

/**
 * Resolves whether a task is a Monthly Deliverable or a One-Time Deliverable.
 */
export function getTaskDeliveryCategory(task = {}, project = {}) {
  const explicit = task?.content?.deliveryCategory;
  if (explicit === 'Monthly Deliverable' || explicit === 'One-Time Deliverable') {
    return explicit;
  }
  const schedule = project?.content?.deliverySchedule;
  if (schedule === 'One-Time Deliverables') {
    return 'One-Time Deliverable';
  }
  if (schedule === 'Both') {
    // If not specified in Both, social content defaults to Monthly, non-social to One-Time
    return isSocialProject(project?.content) ? 'Monthly Deliverable' : 'One-Time Deliverable';
  }
  return 'Monthly Deliverable';
}

/**
 * Check if a task is delivered according to service-specific rules.
 * For Social Media Marketing:
 *   - Deliverable type is one of ['Post', 'Reel', 'AI Reel']
 *   - postStatus === 'Published' OR (status === 'Completed' and publishedDate exists)
 *   - publishedDate must be set
 *   - If month is provided, publishedDate must start with that month
 * For Other Services:
 *   - designStatus === 'Completed' OR status === 'Completed'
 *   - actual completion date (designDate, or dueDate/updatedAt) must be set
 *   - If month is provided, the completion date must start with that month
 */
export function isTaskDelivered(task, project, month = null) {
  if (!task || !project || task.projectId !== project.id) return false;
  const isSocial = isSocialProject(project.content);
  const content = task.content || {};

  if (isSocial) {
    const isPublished = content.postStatus === 'Published';
    if (!isPublished) return false;
    const pubDate = String(content.publishedDate || '').slice(0, 10);
    if (!pubDate) return false;
    if (month && !pubDate.startsWith(month)) return false;
    return true;
  } else {
    const isCompleted = content.designStatus === 'Completed' || task.status === 'Completed';
    if (!isCompleted) return false;
    const compDate = String(content.designDate || task.dueDate || task.updatedAt || '').slice(0, 10);
    if (!compDate) return false;
    if (month && !compDate.startsWith(month)) return false;
    return true;
  }
}

/**
 * Monthly completed delivery count for non-social services (backward compatible signature).
 */
export function serviceDelivery(project, tasks = [], month = '') {
  return tasks.filter(task => {
    if (getTaskDeliveryCategory(task, project) !== 'Monthly Deliverable') return false;
    return isTaskDelivered(task, project, month);
  }).length;
}

/**
 * Monthly total commitment target for a project.
 * Excludes one-time only projects.
 */
export function deliveryTarget(content = {}) {
  const schedule = content.deliverySchedule || 'Monthly Deliverables';
  if (schedule === 'One-Time Deliverables') return 0;
  return isSocialProject(content)
    ? (content.postTarget || 0) + (content.reelTarget || 0) + (content.aiReelTarget || 0)
    : (content.serviceTarget || 0);
}

/**
 * Get project deliverable counts and breakdown, separating Monthly and One-Time deliverables.
 */
export function getProjectDeliverables(project, tasks = [], _selectedMonth = '') {
  if (!project) {
    return {
      deliverables: [],
      monthlyDeliverables: [],
      oneTimeDeliverables: [],
      total: 0,
      completed: 0,
      inProgress: 0,
      remaining: 0,
      overdue: 0,
      progressPercent: 0,
      monthly: { total: 0, completed: 0, inProgress: 0, remaining: 0, overdue: 0, progressPercent: 0 },
      oneTime: { total: 0, completed: 0, inProgress: 0, remaining: 0, overdue: 0, progressPercent: 0 }
    };
  }

  const projectTasks = tasks.filter(t => t.projectId === project.id);
  const isSocial = isSocialProject(project.content);
  const todayStr = new Date().toISOString().slice(0, 10);

  const deliverables = projectTasks.map(t => {
    const c = t.content || {};
    const deliveryCategory = getTaskDeliveryCategory(t, project);
    const delivered = isTaskDelivered(t, project);
    const targetDate = String(t.dueDate || c.postDate || '').slice(0, 10);
    const actualDate = isSocial
      ? String(c.publishedDate || (delivered ? t.dueDate : '') || '').slice(0, 10)
      : String(c.designDate || (delivered ? t.dueDate : '') || '').slice(0, 10);

    let status = 'Not Started';
    if (delivered) {
      status = 'Completed';
    } else if (c.designStatus === 'In Review' || t.status === 'In Review') {
      status = 'In Review';
    } else if (c.designStatus === 'In Progress' || t.status === 'In Progress' || c.postStatus === 'Scheduled') {
      status = 'In Progress';
    } else if (targetDate && targetDate < todayStr && !delivered) {
      status = 'Overdue';
    } else if (t.status === 'To Do' || !t.status || t.status === 'Backlog') {
      status = 'Not Started';
    } else {
      status = t.status;
    }

    return {
      id: t.id,
      name: t.title,
      type: getDeliverableType(t, project),
      rawType: c.contentType,
      category: isSocial ? 'Social Content' : 'Service Deliverable',
      deliveryCategory,
      assigneeId: t.assigneeId,
      targetDate,
      actualDate,
      status,
      isDelivered: delivered,
      task: t
    };
  });

  const monthlyDeliverables = deliverables.filter(d => d.deliveryCategory === 'Monthly Deliverable');
  const oneTimeDeliverables = deliverables.filter(d => d.deliveryCategory === 'One-Time Deliverable');

  const calcBucket = (items) => {
    const total = items.length;
    const completed = items.filter(d => d.isDelivered).length;
    const inProgress = items.filter(d => !d.isDelivered && (d.status === 'In Progress' || d.status === 'In Review')).length;
    const remaining = Math.max(0, total - completed);
    const overdue = items.filter(d => !d.isDelivered && d.status === 'Overdue').length;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, remaining, overdue, progressPercent };
  };

  const monthly = calcBucket(monthlyDeliverables);
  const oneTime = calcBucket(oneTimeDeliverables);

  const total = deliverables.length;
  const completed = deliverables.filter(d => d.isDelivered).length;
  const inProgress = deliverables.filter(d => !d.isDelivered && (d.status === 'In Progress' || d.status === 'In Review')).length;
  const remaining = Math.max(0, total - completed);
  const overdue = deliverables.filter(d => !d.isDelivered && d.status === 'Overdue').length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : (project.progress || 0);

  return {
    deliverables,
    monthlyDeliverables,
    oneTimeDeliverables,
    total,
    completed,
    inProgress,
    remaining,
    overdue,
    progressPercent,
    monthly,
    oneTime
  };
}

/**
 * Calculates monthly delivery stats for a project in a given month.
 */
export function getMonthlyProjectStats(project, tasks = [], month = '') {
  if (!project) return { target: 0, delivered: 0, remaining: 0, oneTimeDelivered: 0, breakdown: {}, schedule: 'Monthly Deliverables' };
  const isSocial = isSocialProject(project.content);
  const c = project.content || {};
  const schedule = c.deliverySchedule || 'Monthly Deliverables';

  // One-time deliverables delivered in total
  const oneTimeTasks = tasks.filter(t => t.projectId === project.id && getTaskDeliveryCategory(t, project) === 'One-Time Deliverable');
  const oneTimeDelivered = oneTimeTasks.filter(t => isTaskDelivered(t, project)).length;
  const oneTimeTarget = c.oneTimeTarget || oneTimeTasks.length || 0;
  const oneTimeRemaining = Math.max(0, oneTimeTarget - oneTimeDelivered);

  // If project is purely One-Time Deliverables, monthly commitment is 0
  if (schedule === 'One-Time Deliverables') {
    return {
      schedule,
      target: 0,
      delivered: 0,
      remaining: 0,
      oneTimeDelivered,
      oneTimeTarget,
      oneTimeRemaining,
      breakdown: {}
    };
  }

  // Monthly tasks only
  const monthlyTasks = tasks.filter(t => t.projectId === project.id && getTaskDeliveryCategory(t, project) === 'Monthly Deliverable');

  if (isSocial) {
    const postDelivered = monthlyTasks.filter(t => getDeliverableType(t, project) === 'Post' && isTaskDelivered(t, project, month)).length;
    const reelDelivered = monthlyTasks.filter(t => getDeliverableType(t, project) === 'Reel' && isTaskDelivered(t, project, month)).length;
    const aiReelDelivered = monthlyTasks.filter(t => getDeliverableType(t, project) === 'AI Reel' && isTaskDelivered(t, project, month)).length;
    const totalDelivered = postDelivered + reelDelivered + aiReelDelivered;
    const target = (c.postTarget || 0) + (c.reelTarget || 0) + (c.aiReelTarget || 0);
    const remaining = Math.max(0, target - totalDelivered);

    return {
      schedule,
      target,
      delivered: totalDelivered,
      remaining,
      oneTimeDelivered,
      oneTimeTarget,
      oneTimeRemaining,
      breakdown: {
        Post: { delivered: postDelivered, target: c.postTarget || 0 },
        Reel: { delivered: reelDelivered, target: c.reelTarget || 0 },
        'AI Reel': { delivered: aiReelDelivered, target: c.aiReelTarget || 0 },
      }
    };
  } else {
    const delivered = monthlyTasks.filter(t => isTaskDelivered(t, project, month)).length;
    const target = c.serviceTarget || 0;
    const remaining = Math.max(0, target - delivered);
    return {
      schedule,
      target,
      delivered,
      remaining,
      oneTimeDelivered,
      oneTimeTarget,
      oneTimeRemaining,
      unit: deliveryUnits[c.projectType] || 'deliverables'
    };
  }
}

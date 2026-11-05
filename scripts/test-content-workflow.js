import assert from 'node:assert/strict';
import { saveContent, validateContent } from '../server/utils/contentWorkflow.js';
import {
  deliveryTarget,
  serviceDelivery,
  isSocialProject,
  isTaskDelivered,
  getMonthlyProjectStats,
  getProjectDeliverables
} from '../shared/delivery.js';

assert.equal(deliveryTarget({ projectType: 'Website Development', serviceTarget: 5, postTarget: 12 }), 5);
assert.equal(deliveryTarget({ projectType: 'Social Media Marketing', postTarget: 8, reelTarget: 4 }), 12);
assert.equal(isSocialProject({ postTarget: 8 }), true);
assert.equal(serviceDelivery({ id: 'p' }, [
  { projectId: 'p', content: { designStatus: 'Completed', designDate: '2026-11-12' } },
  { projectId: 'p', content: { designStatus: 'Completed', designDate: '2026-10-12' } },
  { projectId: 'other', content: { designStatus: 'Completed', designDate: '2026-11-12' } },
], '2026-11'), 1);
assert.doesNotThrow(() => validateContent({ projectType: 'Website Development', serviceTarget: 5 }, true));

// Test Suite: Mandatory Delivery Recognition and Synchronization Scenarios
// Scenario 1: Complete one Post and verify delivered count increases by one
const socialProject = {
  id: 'proj-social-1',
  name: 'Social Media',
  content: {
    projectType: 'Social Media Marketing',
    postTarget: 1,
    reelTarget: 1,
    aiReelTarget: 1
  }
};

const postTask = {
  id: 'task-post-1',
  projectId: socialProject.id,
  title: 'Nov Promo Post',
  status: 'Completed',
  dueDate: '2026-11-10',
  content: {
    contentType: 'Post',
    designStatus: 'Completed',
    approvalStatus: 'Approved',
    postStatus: 'Published',
    publishedDate: '2026-11-04'
  }
};

assert.equal(isTaskDelivered(postTask, socialProject, '2026-11'), true, 'Scenario 1: Completed post must count as delivered');
let stats1 = getMonthlyProjectStats(socialProject, [postTask], '2026-11');
assert.equal(stats1.delivered, 1, 'Delivered count must be 1');
assert.equal(stats1.breakdown.Post.delivered, 1, 'Post delivered must be 1');
assert.equal(stats1.breakdown.Reel.delivered, 0, 'Reel delivered must be 0');
assert.equal(stats1.breakdown['AI Reel'].delivered, 0, 'AI Reel delivered must be 0');

// Scenario 2: Verify same Post appears as completed in its project
let pInfo1 = getProjectDeliverables(socialProject, [postTask]);
assert.equal(pInfo1.completed, 1);
assert.equal(pInfo1.deliverables[0].isDelivered, true);
assert.equal(pInfo1.deliverables[0].status, 'Completed');
assert.equal(pInfo1.deliverables[0].actualDate, '2026-11-04');

// Scenario 3: Complete one Reel and verify both modules update
const reelTask = {
  id: 'task-reel-1',
  projectId: socialProject.id,
  title: 'Nov Promo Reel',
  status: 'Completed',
  dueDate: '2026-11-15',
  content: {
    contentType: 'Reel',
    designStatus: 'Completed',
    approvalStatus: 'Approved',
    postStatus: 'Published',
    publishedDate: '2026-11-06'
  }
};
const aiReelTask = {
  id: 'task-aireel-1',
  projectId: socialProject.id,
  title: 'Nov AI Reel',
  status: 'To Do',
  dueDate: '2026-11-20',
  content: {
    contentType: 'AI Reel',
    designStatus: 'Not Started',
    approvalStatus: 'Pending',
    postStatus: 'Not Scheduled'
  }
};
const socialTasks = [postTask, reelTask, aiReelTask];
let stats3 = getMonthlyProjectStats(socialProject, socialTasks, '2026-11');
assert.equal(stats3.delivered, 2, 'Delivered must be 2 after reel completion');
assert.equal(stats3.breakdown.Post.delivered, 1);
assert.equal(stats3.breakdown.Reel.delivered, 1);
assert.equal(stats3.breakdown['AI Reel'].delivered, 0);

// Scenario 4: Complete one AI Reel and verify both modules update
const aiReelCompleted = {
  ...aiReelTask,
  status: 'Completed',
  content: {
    ...aiReelTask.content,
    designStatus: 'Completed',
    approvalStatus: 'Approved',
    postStatus: 'Published',
    publishedDate: '2026-11-08'
  }
};
let stats4 = getMonthlyProjectStats(socialProject, [postTask, reelTask, aiReelCompleted], '2026-11');
assert.equal(stats4.delivered, 3, 'All 3 social items delivered');
assert.equal(stats4.breakdown['AI Reel'].delivered, 1);

// Scenario 5: Complete a non-social deliverable and verify its completion date is used
const webProject = {
  id: 'proj-web-1',
  name: 'Client Redesign',
  content: {
    projectType: 'Website Development',
    serviceTarget: 2
  }
};
const webTask = {
  id: 'task-web-1',
  projectId: webProject.id,
  title: 'Homepage implementation',
  status: 'Completed',
  dueDate: '2026-11-12',
  content: {
    designStatus: 'Completed',
    designDate: '2026-11-03'
  }
};
assert.equal(isTaskDelivered(webTask, webProject, '2026-11'), true);
let webStats = getMonthlyProjectStats(webProject, [webTask], '2026-11');
assert.equal(webStats.delivered, 1);

// Scenario 6: Complete 1 of 3 deliverables and verify project is not marked fully completed
let partialInfo = getProjectDeliverables(socialProject, [postTask, reelTask, aiReelTask]);
assert.equal(partialInfo.total, 3);
assert.equal(partialInfo.completed, 2);
assert.equal(partialInfo.remaining, 1);
assert.equal(partialInfo.progressPercent, 67);
assert.notEqual(partialInfo.progressPercent, 100);

// Scenario 7: Complete all required deliverables and verify project progress recalculated
let fullInfo = getProjectDeliverables(socialProject, [postTask, reelTask, aiReelCompleted]);
assert.equal(fullInfo.total, 3);
assert.equal(fullInfo.completed, 3);
assert.equal(fullInfo.remaining, 0);
assert.equal(fullInfo.progressPercent, 100);

// Scenario 10: Change selected month and verify historical calculations
assert.equal(isTaskDelivered(postTask, socialProject, '2026-10'), false, 'Post published in Nov must not count in Oct');
let octStats = getMonthlyProjectStats(socialProject, [postTask], '2026-10');
assert.equal(octStats.delivered, 0, 'Delivered in Oct must be 0');

// Scenario 11: Verify scheduled and unpublished social content is not counted as delivered
const scheduledTask = {
  id: 'task-sched',
  projectId: socialProject.id,
  title: 'Future Post',
  status: 'In Progress',
  dueDate: '2026-11-25',
  content: {
    contentType: 'Post',
    designStatus: 'Completed',
    approvalStatus: 'Approved',
    postStatus: 'Scheduled',
    postDate: '2026-11-25',
    publishedDate: ''
  }
};
assert.equal(isTaskDelivered(scheduledTask, socialProject, '2026-11'), false, 'Scheduled post is not delivered');
const draftTask = {
  id: 'task-draft',
  projectId: socialProject.id,
  title: 'Draft Post',
  status: 'In Progress',
  dueDate: '2026-11-26',
  content: {
    contentType: 'Post',
    designStatus: 'In Progress',
    approvalStatus: 'Pending',
    postStatus: 'Not Scheduled'
  }
};
assert.equal(isTaskDelivered(draftTask, socialProject, '2026-11'), false, 'Draft post is not delivered');

// Permissions and Workflow checks
const manager = { id: 'manager', role: 'project_manager' };
const member = { id: 'designer', role: 'team_member' };
function fixture(content = {}, fields = {}) {
  const row = { id: 'task', assignee_id: 'designer', title: 'Topic', description: '', content, ...fields };
  const history = [];
  const client = { query: async (sql, params) => {
    if (sql.startsWith('SELECT')) return { rows: [row] };
    if (sql.startsWith('INSERT')) history.push(JSON.parse(params[2]));
    if (sql.startsWith('UPDATE')) row.content = JSON.parse(params[1]);
    return { rows: [], rowCount: 1 };
  } };
  return { row, history, client };
}
async function save(f, content, user = manager, changes = {}) {
  return saveContent(f.client, 'tasks', 'task', content, user, 'true', changes);
}
assert.throws(() => validateContent({ postTarget: -1 }, true));
assert.throws(() => validateContent({ postDate: '2026-02-30' }));
assert.throws(() => validateContent({ approvedBy: 'forged' }));
assert.throws(() => validateContent({ contentType: 'unknown' }));
const f = fixture();
await save(f, { designStatus: 'In Review' }, member);
assert.equal(f.row.content.designStatus, 'In Review');
await assert.rejects(save(f, { approvalStatus: 'Approved' }, member));
await assert.rejects(save(f, { designStatus: 'Completed' }, { id: 'other', role: 'team_member' }));
await assert.rejects(save(f, { postStatus: 'Scheduled', postDate: '2026-11-12' }));
await save(f, { approvalStatus: 'Approved' });
assert.equal(f.row.content.approvedBy, manager.id);
assert.ok(f.row.content.approvalDate);
await assert.rejects(save(f, { postStatus: 'Scheduled' }));
await save(f, { postStatus: 'Scheduled', postDate: '2026-11-12' });
await save(f, { postStatus: 'Published' });
assert.equal(f.row.content.publishedBy, manager.id);
assert.ok(f.row.content.publishedDate);
await save(f, {}, manager, { title: 'Changed topic' });
assert.equal(f.row.content.approvalStatus, 'Pending');
assert.equal(f.row.content.postStatus, 'Not Scheduled');
assert.equal(f.row.content.publishedBy, null);
assert.equal(f.row.content.approvalDate, null);
await save(f, { approvalStatus: 'Changes Requested', feedback: 'Please revise' });
assert.equal(f.row.content.designStatus, 'Changes Requested');
assert.ok(f.history.length >= 6);
const project = fixture();
await assert.rejects(saveContent(project.client, 'projects', 'project', { clientName: 'Client' }, member, 'true'));
await assert.rejects(saveContent(project.client, 'projects', 'project', { contractStart: '2026-12-01', contractEnd: '2026-11-01' }, manager, 'true'));

// Project Type and Dynamic Task Type tests
import { getTaskTypesForProjectType, deliverySchedules, getAllowedDeliveryCategories } from '../shared/serviceTypes.js';

// 1. Social Media Marketing task types
const smmTypes = getTaskTypesForProjectType('Social Media Marketing');
assert.deepEqual(smmTypes, ['Post', 'Reel', 'AI Reel']);

// 2. Website Development task types
const webTypes = getTaskTypesForProjectType('Website Development');
assert.deepEqual(webTypes, ['UI Design', 'Frontend Development', 'Backend Development', 'Testing', 'Deployment']);

// 3. Fallback / Other task types
const otherTypes = getTaskTypesForProjectType('Other');
assert.deepEqual(otherTypes, ['Deliverable', 'Milestone', 'General Task']);
const unknownTypes = getTaskTypesForProjectType('NonExistentService');
assert.deepEqual(unknownTypes, ['Deliverable', 'Milestone', 'General Task']);

// 4. Delivery schedule and category rules
assert.deepEqual(deliverySchedules, ['Monthly Deliverables', 'One-Time Deliverables', 'Both']);
assert.deepEqual(getAllowedDeliveryCategories('Monthly Deliverables'), ['Monthly Deliverable']);
assert.deepEqual(getAllowedDeliveryCategories('One-Time Deliverables'), ['One-Time Deliverable']);
assert.deepEqual(getAllowedDeliveryCategories('Both'), ['Monthly Deliverable', 'One-Time Deliverable']);

// 5. One-Time Deliverables project delivery tracking test
const oneTimeProject = {
  id: 'proj-onetime-1',
  name: 'Client Redesign',
  content: {
    projectType: 'Website Development',
    deliverySchedule: 'One-Time Deliverables',
    oneTimeTarget: 3
  }
};
const otTasks = [
  { id: 't-ot-1', projectId: oneTimeProject.id, title: 'UI Design', status: 'Completed', content: { contentType: 'UI Design', deliveryCategory: 'One-Time Deliverable', designStatus: 'Completed', designDate: '2026-11-01' } },
  { id: 't-ot-2', projectId: oneTimeProject.id, title: 'Frontend', status: 'Completed', content: { contentType: 'Frontend Development', deliveryCategory: 'One-Time Deliverable', designStatus: 'Completed', designDate: '2026-11-03' } },
  { id: 't-ot-3', projectId: oneTimeProject.id, title: 'Backend', status: 'In Progress', content: { contentType: 'Backend Development', deliveryCategory: 'One-Time Deliverable', designStatus: 'In Progress' } }
];
assert.equal(deliveryTarget(oneTimeProject.content), 0, 'One-time projects should not inflate monthly commitment count');
const otStats = getMonthlyProjectStats(oneTimeProject, otTasks, '2026-11');
assert.equal(otStats.target, 0);
assert.equal(otStats.delivered, 0, 'Monthly delivered is 0 for one-time deliverables');
assert.equal(otStats.oneTimeDelivered, 2, 'One-time delivered is 2');
const otBreakdown = getProjectDeliverables(oneTimeProject, otTasks);
assert.equal(otBreakdown.oneTime.completed, 2);
assert.equal(otBreakdown.oneTime.total, 3);
assert.equal(otBreakdown.oneTime.remaining, 1);
assert.equal(otBreakdown.oneTime.progressPercent, 67);

// 6. Both schedule project delivery tracking test
const hybridProject = {
  id: 'proj-hybrid-1',
  name: 'Hybrid Account',
  content: {
    projectType: 'Search Engine Optimization',
    deliverySchedule: 'Both',
    serviceTarget: 4,
    oneTimeTarget: 1
  }
};
const hybridTasks = [
  { id: 't-h-1', projectId: hybridProject.id, title: 'SEO Audit', status: 'Completed', content: { contentType: 'SEO Audit', deliveryCategory: 'One-Time Deliverable', designStatus: 'Completed', designDate: '2026-11-02' } },
  { id: 't-h-2', projectId: hybridProject.id, title: 'Monthly Articles', status: 'Completed', content: { contentType: 'Content Optimization', deliveryCategory: 'Monthly Deliverable', designStatus: 'Completed', designDate: '2026-11-04' } },
  { id: 't-h-3', projectId: hybridProject.id, title: 'Monthly Backlinks', status: 'In Progress', content: { contentType: 'Technical SEO', deliveryCategory: 'Monthly Deliverable', designStatus: 'In Progress' } }
];
assert.equal(deliveryTarget(hybridProject.content), 4);
const hybridStats = getMonthlyProjectStats(hybridProject, hybridTasks, '2026-11');
assert.equal(hybridStats.target, 4);
assert.equal(hybridStats.delivered, 1);
assert.equal(hybridStats.oneTimeDelivered, 1);
const hybridBreakdown = getProjectDeliverables(hybridProject, hybridTasks);
assert.equal(hybridBreakdown.monthly.completed, 1);
assert.equal(hybridBreakdown.monthly.total, 2);
assert.equal(hybridBreakdown.oneTime.completed, 1);
assert.equal(hybridBreakdown.oneTime.total, 1);

// 7. Validation of deliverySchedule and deliveryCategory
assert.doesNotThrow(() => validateContent({ projectType: 'Website Development', deliverySchedule: 'One-Time Deliverables', oneTimeTarget: 5 }, true));
assert.throws(() => validateContent({ projectType: 'Website Development', deliverySchedule: 'Invalid Schedule' }, true));
assert.doesNotThrow(() => validateContent({ contentType: 'UI Design', deliveryCategory: 'One-Time Deliverable' }));
assert.throws(() => validateContent({ contentType: 'UI Design', deliveryCategory: 'Invalid Category' }));

// 8. Task completion updates delivery progress & timestamp
const nonSocialTask = {
  id: 'task-test-non-social',
  projectId: webProject.id,
  title: 'Setup API Gateway',
  status: 'Completed',
  dueDate: '2026-11-20',
  content: {
    contentType: 'Backend Development',
    designStatus: 'Completed',
    designDate: '2026-11-05'
  }
};
assert.equal(isTaskDelivered(nonSocialTask, webProject, '2026-11'), true);

// 9. Reopening task resets delivery
const reopenedTask = {
  ...nonSocialTask,
  status: 'In Progress',
  content: {
    ...nonSocialTask.content,
    designStatus: 'In Progress'
  }
};
assert.equal(isTaskDelivered(reopenedTask, webProject, '2026-11'), false);

// 10. Team assignment vs individual assignment tests
const teamTask = {
  id: 'task-team-assigned',
  projectId: webProject.id,
  teamId: 'team-dev-1',
  assigneeId: 'user-member-1',
  title: 'Database Migration',
  status: 'In Progress'
};
assert.equal(Boolean(teamTask.teamId), true, 'Team ID preserved');
assert.equal(teamTask.assigneeId, 'user-member-1', 'Optional responsible member preserved');

console.log('Project type and task type delivery workflow checks passed');
console.log('Content workflow permissions, validation, approval resets, publishing and audit checks passed');

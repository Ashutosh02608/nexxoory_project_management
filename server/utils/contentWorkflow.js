import { contentTypes, projectTypes, deliverySchedules, deliveryCategories } from '../../shared/serviceTypes.js';
export { contentTypes };
export const designStatuses = ['Not Started', 'In Progress', 'In Review', 'Changes Requested', 'Completed'];
export const approvalStatuses = ['Pending', 'Approved', 'Changes Requested'];
export const publishingStatuses = ['Not Scheduled', 'Scheduled', 'Published', 'Cancelled'];
export class ContentWorkflowError extends Error {}

export function validateContent(content, project = false) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) throw new Error('Content must be an object');
  const strings = project ? ['clientName', 'internalNotes', 'brief'] : ['feedback'];
  const dates = project ? ['contractStart', 'contractEnd'] : ['designDate', 'postDate', 'publishedDate'];
  const enums = project
    ? { projectType: projectTypes, deliverySchedule: deliverySchedules }
    : { contentType: contentTypes, designStatus: designStatuses, approvalStatus: approvalStatuses, postStatus: publishingStatuses, deliveryCategory: deliveryCategories };
  const targets = project ? ['postTarget', 'reelTarget', 'aiReelTarget', 'serviceTarget', 'oneTimeTarget'] : [];
  for (const [key, value] of Object.entries(content)) {
    if (strings.includes(key)) {
      if (typeof value !== 'string' || value.length > 10000) throw new Error(`Invalid ${key}`);
    } else if (dates.includes(key)) {
      if (value !== '' && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error(`Invalid ${key}`);
    } else if (targets.includes(key)) {
      if (!Number.isInteger(value) || value < 0 || value > 10000) throw new Error(`Invalid ${key}`);
    } else if (enums[key]) {
      if (!enums[key].includes(value)) throw new Error(`Invalid ${key}`);
    } else throw new Error(`Unknown content field: ${key}`);
  }
  return content;
}

export async function saveContent(client, entity, id, content, user, scope, taskChanges = {}) {
  try {
  if (!content && !Object.keys(taskChanges).length) return;
  content ||= {};
  validateContent(content, entity === 'projects');
  const table = entity === 'projects' ? 'projects' : 'tasks';
  const existing = await client.query(`SELECT t.* FROM ${table} t WHERE t.id = $1 AND ${scope} FOR UPDATE`, [id, user.id, user.role]);
  const row = existing.rows[0];
  if (!row) throw new Error('Record unavailable');
  const previous = row.content || {};
  const changed = Object.keys(content).filter(key => content[key] !== previous[key]);
  const materialChanged = entity === 'tasks' && ['title', 'description', 'assigneeId'].some(key => Object.hasOwn(taskChanges, key) && taskChanges[key] !== row[{ title: 'title', description: 'description', assigneeId: 'assignee_id' }[key]]);
  if (user.role === 'team_member' && (entity === 'projects' || row.assignee_id !== user.id || changed.some(key => !['designStatus', 'designDate'].includes(key)))) throw new Error('You cannot change these content fields');
  const next = { ...previous, ...content };
  if (entity === 'projects') {
    if (next.contractStart && next.contractEnd && next.contractEnd < next.contractStart) throw new Error('Contract end must follow its start');
  } else {
    if (changed.includes('designStatus') && next.designStatus === 'Completed' && !next.designDate) next.designDate = new Date().toISOString().slice(0, 10);
    if ((materialChanged || changed.some(key => ['designStatus', 'designDate', 'contentType'].includes(key))) && previous.approvalStatus === 'Approved') {
      next.approvalStatus = 'Pending'; next.approvalDate = null; next.approvedBy = null;
      next.postStatus = 'Not Scheduled'; next.publishedDate = ''; next.publishedBy = null;
    }
    if (['Scheduled', 'Published'].includes(next.postStatus) && next.approvalStatus !== 'Approved') throw new Error('Approval is required before scheduling or publishing');
    if (next.postStatus === 'Scheduled' && !next.postDate) throw new Error('Choose a publication date');
    if (next.approvalStatus === 'Approved' && previous.approvalStatus !== 'Approved') {
      next.approvalDate = new Date().toISOString(); next.approvedBy = user.id;
    } else if (next.approvalStatus !== 'Approved') { next.approvalDate = null; next.approvedBy = null; }
    if (next.postStatus === 'Published' && previous.postStatus !== 'Published') {
      next.publishedDate ||= new Date().toISOString().slice(0, 10); next.publishedBy = user.id;
    }
    if (next.postStatus !== 'Published') { next.publishedDate = ''; next.publishedBy = null; }
    if (next.approvalStatus === 'Changes Requested') next.designStatus = 'Changes Requested';
    if (changed.length || materialChanged) await client.query('INSERT INTO content_workflow_history (task_id, actor_id, changes) VALUES ($1, $2, $3)', [id, user.id, JSON.stringify({ before: previous, after: next, taskChanges })]);
  }
  await client.query(`UPDATE ${table} SET content = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id, JSON.stringify(next)]);
  } catch (error) {
    if (error.code) throw error;
    throw new ContentWorkflowError(error.message);
  }
}

import { authenticateRequest } from '../../server/middleware/auth.js';
import { handleCors, validateCsrf, sendSuccess, sendError } from '../../server/utils/response.js';
import { query, transaction } from '../../server/config/db.js';
import argon2 from 'argon2';
import { saveContent, validateContent, ContentWorkflowError } from '../../server/utils/contentWorkflow.js';
import { getTaskTypesForProjectType, getAllowedDeliveryCategories } from '../../shared/serviceTypes.js';

const isUuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);

/**
 * Unified Backend Dispatcher: Handles all entities via single endpoint /api/v1/data
 * Payload structure:
 * POST /api/v1/data
 * Body: { entity: 'users'|'teams'|'projects'|'tasks'|'documents'|'calendar-events'|'notifications'|'conversations', action: 'list'|'create'|'update'|'delete', payload: {...} }
 */
export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  const authUser = await authenticateRequest(req, res);
  if (!authUser) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only POST is accepted for unified data gateway');
  }
  if (!validateCsrf(req, res)) return;

  const { entity, action = 'list', payload = {} } = req.body || {};

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > 21 * 1024 * 1024) {
    return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'Request payload exceeds the maximum size');
  }
  if (typeof entity !== 'string' || typeof action !== 'string' || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Entity, action, and payload are invalid');
  }

  if (!entity) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Field "entity" is required');
  }

  try {
    switch (entity) {
      case 'bootstrap':
        return await handleBootstrap(authUser, res);
      case 'users':
        return await handleUsers(action, payload, authUser, res);
      case 'teams':
        return await handleTeams(action, payload, authUser, res);
      case 'projects':
        return await handleProjects(action, payload, authUser, res);
      case 'tasks':
        return await handleTasks(action, payload, authUser, res);
      case 'documents':
        return await handleDocuments(action, payload, authUser, res);
      case 'calendar-events':
        return await handleCalendar(action, payload, authUser, res);
      case 'notifications':
        return await handleNotifications(action, payload, authUser, res);
      case 'announcements':
        return await handleAnnouncements(action, payload, authUser, res);
      case 'conversations':
        return await handleConversations(action, payload, authUser, res);
      default:
        return sendError(res, 400, 'UNKNOWN_ENTITY', `Entity "${entity}" is not recognized`);
    }
  } catch (err) {
    if (err instanceof ContentWorkflowError) return sendError(res, 400, 'CONTENT_WORKFLOW_ERROR', err.message);
    console.error('[UNIFIED API ERROR]', err.name, err.code);
    return sendError(res, 500, 'SERVER_ERROR', 'The operation could not be completed');
  }
}

// -------------------------------------------------------------
// BOOTSTRAP ALL DATA (Single high-speed round-trip)
// -------------------------------------------------------------
function taskScope(user, role, readOnly = false) {
  return `(
    ${role} = 'admin'
    OR (${role} = 'project_manager' AND (
      t.assignee_id = ${user}
      OR EXISTS (SELECT 1 FROM projects p WHERE p.id = t.project_id AND (
        p.manager_id = ${user} OR EXISTS (
          SELECT 1 FROM teams pt WHERE pt.id = p.primary_team_id AND pt.leader_id = ${user}
        )
      ))
      OR EXISTS (SELECT 1 FROM teams tm WHERE tm.id = t.team_id AND tm.leader_id = ${user})
    ))
    OR (${role} = 'team_member' AND (
      t.assignee_id = ${user}
      ${readOnly ? `OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = t.team_id AND tm.user_id = ${user}) OR EXISTS (SELECT 1 FROM teams tm WHERE tm.id = t.team_id AND tm.leader_id = ${user})` : ''}
    ))
  )`;
}

function projectScope(alias, user, role) {
  return `(
    ${role} = 'admin'
    OR ${alias}.manager_id = ${user}
    OR EXISTS (
      SELECT 1 FROM teams scope_team
      WHERE scope_team.id = ${alias}.primary_team_id
        AND (scope_team.leader_id = ${user} OR EXISTS (
          SELECT 1 FROM team_members scope_member
          WHERE scope_member.team_id = scope_team.id AND scope_member.user_id = ${user}
        ))
    )
    OR EXISTS (
      SELECT 1 FROM project_teams scope_pt
      JOIN teams scope_team ON scope_team.id = scope_pt.team_id
      WHERE scope_pt.project_id = ${alias}.id
        AND (scope_team.leader_id = ${user} OR EXISTS (
          SELECT 1 FROM team_members scope_member
          WHERE scope_member.team_id = scope_team.id AND scope_member.user_id = ${user}
        ))
    )
  )`;
}

function documentScope(alias, user, role) {
  return `(
    ${role} = 'admin'
    OR ${alias}.author_id = ${user}
    OR ${user} = ANY(COALESCE(${alias}.assigned_user_ids, ARRAY[]::uuid[]))
    OR EXISTS (
      SELECT 1 FROM folder_permissions scope_fp
      WHERE scope_fp.folder_key = ${alias}.folder AND scope_fp.user_id = ${user}
    )
    OR (${alias}.project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects scope_project
      WHERE scope_project.id = ${alias}.project_id
        AND ${projectScope('scope_project', user, role)}
    ))
  )`;
}

async function handleBootstrap(authUser, res) {
  const result = await query(`
    SELECT json_build_object(
      'users', COALESCE((
        SELECT json_agg(u)
        FROM (
          SELECT id, name, email, role, designation, department, status, avatar_url, created_at
          FROM users
          ORDER BY created_at ASC
        ) u
      ), '[]'::json),

      'teams', COALESCE((
        SELECT json_agg(sub.t_obj)
        FROM (
          SELECT json_build_object(
            'id', t.id,
            'name', t.name,
            'department', t.department,
            'leaderId', t.leader_id,
            'description', t.description,
            'color', t.color,
            'createdAt', t.created_at,
            'memberIds', COALESCE(
              (SELECT json_agg(tm.user_id) FROM team_members tm WHERE tm.team_id = t.id),
              '[]'::json
            )
          ) as t_obj
          FROM teams t
          ORDER BY t.created_at ASC
        ) sub
      ), '[]'::json),

      'projects', COALESCE((
        SELECT json_agg(sub.p_obj)
        FROM (
          SELECT json_build_object(
            'id', p.id,
            'name', p.name,
            'content', CASE WHEN $2 = 'team_member' THEN p.content - 'internalNotes' ELSE p.content END,
            'description', p.description,
            'managerId', p.manager_id,
            'teamId', p.primary_team_id,
            'priority', p.priority,
            'status', p.status,
            'startDate', p.start_date,
            'dueDate', p.due_date,
            'progress', p.progress,
            'budget', p.budget::numeric,
            'spent', p.spent::numeric,
            'tags', COALESCE(to_jsonb(p.tags), '[]'::jsonb)
          ) as p_obj
          FROM projects p
          WHERE ${projectScope('p', '$1', '$2')}
          ORDER BY p.created_at DESC
        ) sub
      ), '[]'::json),

      'tasks', COALESCE((
        SELECT json_agg(sub.t_obj)
        FROM (
          SELECT json_build_object(
            'id', t.id,
            'title', t.title,
            'content', t.content,
            'description', t.description,
            'projectId', t.project_id,
            'assigneeId', t.assignee_id,
            'teamId', t.team_id,
            'priority', t.priority,
            'status', t.status,
            'startDate', t.start_date,
            'dueDate', t.due_date,
            'progress', t.progress,
            'labels', COALESCE(to_jsonb(t.labels), '[]'::jsonb),
            'subtasks', COALESCE(
              (SELECT json_agg(json_build_object('id', s.id, 'title', s.title, 'completed', s.completed))
               FROM subtasks s WHERE s.task_id = t.id),
              '[]'::json
            ),
            'comments', COALESCE(
              (SELECT json_agg(json_build_object('id', c.id, 'userId', c.user_id, 'userName', u.name, 'text', c.text, 'timestamp', to_char(c.created_at, 'YYYY-MM-DD HH24:MI')))
               FROM task_comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.task_id = t.id),
              '[]'::json
            )
          ) as t_obj
          FROM tasks t
          WHERE ${taskScope('$1', '$2', true)}
          ORDER BY t.kanban_order ASC, t.created_at DESC
        ) sub
      ), '[]'::json),

      'documents', COALESCE((
        SELECT json_agg(sub.d_obj)
        FROM (
          SELECT json_build_object(
            'id', d.id,
            'name', d.name,
            'folder', d.folder,
            'projectId', d.project_id,
            'size', concat(round((d.size_bytes::numeric / 1048576), 1), ' MB'),
            'type', CASE WHEN d.mime_type LIKE '%pdf%' THEN 'pdf' ELSE 'doc' END,
            'author', COALESCE(u.name, 'System'),
            'authorId', d.author_id,
            'assignedUserIds', COALESCE(to_jsonb(d.assigned_user_ids), '[]'::jsonb),
            'date', to_char(d.created_at, 'YYYY-MM-DD'),
            'updatedAt', to_char(d.updated_at, 'YYYY-MM-DD')
          ) as d_obj
          FROM documents d
          LEFT JOIN users u ON u.id = d.author_id
          WHERE ${documentScope('d', '$1', '$2')}
          ORDER BY d.created_at DESC
        ) sub
      ), '[]'::json),

      'folderPermissions', COALESCE((
        SELECT json_agg(json_build_object('id', fp.id, 'folderKey', fp.folder_key, 'userId', fp.user_id))
        FROM folder_permissions fp
        WHERE $2 = 'admin' OR fp.user_id = $1
      ), '[]'::json),

      'events', COALESCE((
        SELECT json_agg(sub.e_obj)
        FROM (
          SELECT json_build_object(
            'id', e.id,
            'title', e.title,
            'description', COALESCE(e.description, ''),
            'type', e.type,
            'startDate', e.start_date,
            'endDate', e.end_date,
            'date', to_char(e.start_date, 'YYYY-MM-DD'),
            'time', to_char(e.start_date, 'HH24:MI'),
            'isAllDay', COALESCE(e.is_all_day, false),
            'projectId', e.project_id,
            'teamId', e.team_id,
            'location', COALESCE(e.location, 'Virtual'),
            'creatorId', e.creator_id,
            'attendees', COALESCE(
              (SELECT json_agg(ea.user_id) FROM calendar_event_attendees ea WHERE ea.event_id = e.id),
              '[]'::json
            )
          ) as e_obj
          FROM calendar_events e
          WHERE $2 = 'admin'
             OR e.creator_id = $1
             OR EXISTS (SELECT 1 FROM calendar_event_attendees ea WHERE ea.event_id = e.id AND ea.user_id = $1)
             OR (e.department IS NOT NULL AND e.department = (SELECT department FROM users WHERE id = $1))
             OR EXISTS (SELECT 1 FROM teams et WHERE et.id = e.team_id AND (et.leader_id = $1 OR EXISTS
                (SELECT 1 FROM team_members etm WHERE etm.team_id = et.id AND etm.user_id = $1)))
             OR EXISTS (SELECT 1 FROM projects ep WHERE ep.id = e.project_id AND ${projectScope('ep', '$1', '$2')})
          ORDER BY e.start_date ASC
        ) sub
      ), '[]'::json),

      'notifications', COALESCE((
        SELECT json_agg(sub.n_obj)
        FROM (
          SELECT json_build_object(
            'id', n.id,
            'title', n.title,
            'message', n.message,
            'type', n.type,
            'read', n.is_read,
            'link', n.link,
            'timestamp', to_char(n.created_at, 'HH12:MI AM')
          ) as n_obj
          FROM notifications n
          WHERE n.user_id = $1
          ORDER BY n.created_at DESC
        ) sub
      ), '[]'::json),

      'announcements', COALESCE((
        SELECT json_agg(sub.a_obj)
        FROM (
          SELECT json_build_object(
            'id', a.id,
            'title', a.title,
            'content', a.content,
            'tag', a.tag,
            'targetDepartment', a.target_department,
            'author', COALESCE(u.name, 'Admin'),
            'publishedDate', to_char(a.created_at, 'YYYY-MM-DD')
          ) as a_obj
          FROM announcements a
          LEFT JOIN users u ON u.id = a.author_id
          ORDER BY a.created_at DESC
        ) sub
      ), '[]'::json),

      'conversations', COALESCE((
        SELECT json_agg(sub.c_obj)
        FROM (
          SELECT json_build_object(
            'id', c.id,
            'name', c.name,
            'type', c.type,
            'unread', 0
          ) as c_obj
          FROM conversations c
          JOIN conversation_participants cp ON cp.conversation_id = c.id
          WHERE cp.user_id = $1
        ) sub
      ), '[]'::json)
    ) as payload;
  `, [authUser.id, authUser.role]);

  const data = result.rows[0]?.payload || {};

  return sendSuccess(res, {
    users: data.users || [],
    teams: data.teams || [],
    projects: data.projects || [],
    tasks: data.tasks || [],
    documents: data.documents || [],
    events: data.events || [],
    notifications: data.notifications || [],
    announcements: data.announcements || [],
    conversations: data.conversations || []
  }, 'Bootstrap data retrieved');
}

// -------------------------------------------------------------
// USERS HANDLER
// -------------------------------------------------------------
async function handleUsers(action, payload, authUser, res) {
  if (action === 'list') {
    const result = await query(`
      SELECT id, name, email, role, designation, department, status, avatar_url, created_at
      FROM users ORDER BY created_at ASC;
    `);
    return sendSuccess(res, { users: result.rows }, 'Users retrieved');
  }

  if (action === 'create') {
    if (authUser.role !== 'admin') {
      return sendError(res, 403, 'FORBIDDEN', 'Only administrators can create users');
    }
    const { name, email, password, role, designation, department, status, clientMutationId } = payload;
    if (!name || !email) return sendError(res, 400, 'VALIDATION_ERROR', 'Name and email required');
    if (!isUuid(clientMutationId)) return sendError(res, 400, 'VALIDATION_ERROR', 'A valid mutation ID is required');

    const priorMutation = await query(`
      SELECT id, name, email, role, designation, department, status, created_at
      FROM users WHERE id = $1 AND LOWER(email) = LOWER($2)
    `, [clientMutationId, email.trim()]);
    if (priorMutation.rows[0]) return sendSuccess(res, { user: priorMutation.rows[0] }, 'User already created');

    const existing = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (existing.rows.length > 0) return sendError(res, 409, 'EMAIL_EXISTS', 'Email already registered');

    const passwordHash = await argon2.hash(password || 'Password123!', {
      type: argon2.argon2id, memoryCost: 2 ** 16, timeCost: 3, parallelism: 1
    });

    const insertResult = await query(`
      INSERT INTO users (id, name, email, password_hash, role, designation, department, status)
      VALUES ($8, $1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, email, role, designation, department, status, created_at;
    `, [
      name.trim(), email.trim().toLowerCase(), passwordHash,
      role || 'team_member', designation || 'Team Contributor', department || 'Development', status || 'Active', clientMutationId
    ]);

    const newUser = insertResult.rows[0];
    await query(`INSERT INTO user_settings (user_id, theme) VALUES ($1, 'light') ON CONFLICT DO NOTHING;`, [newUser.id]);
    return sendSuccess(res, { user: newUser }, 'User created', 201);
  }

  if (action === 'update') {
    const { id, name, designation, department, role, status } = payload;
    if (!id) return sendError(res, 400, 'VALIDATION_ERROR', 'User ID required');
    if (authUser.role !== 'admin' && authUser.id !== id) return sendError(res, 403, 'FORBIDDEN', 'Unauthorized');

    const updates = [];
    const values = [id];
    let p = 2;
    if (name) { updates.push(`name = $${p++}`); values.push(name.trim()); }
    if (designation) { updates.push(`designation = $${p++}`); values.push(designation.trim()); }

    if (authUser.role === 'admin') {
      if (department) { updates.push(`department = $${p++}`); values.push(department.trim()); }
      if (role) { updates.push(`role = $${p++}`); values.push(role); }
      if (status) { updates.push(`status = $${p++}`); values.push(status); }
    }
    if (updates.length === 0) return sendError(res, 400, 'VALIDATION_ERROR', 'Nothing to update');
    updates.push('updated_at = CURRENT_TIMESTAMP');

    const result = await query(`
      UPDATE users SET ${updates.join(', ')} WHERE id = $1
      RETURNING id, name, email, role, designation, department, status, updated_at;
    `, values);
    return sendSuccess(res, { user: result.rows[0] }, 'User updated');
  }

  if (action === 'delete-summary') {
    if (authUser.role !== 'admin') return sendError(res, 403, 'FORBIDDEN', 'Admin only');
    const { id } = payload;
    if (!id) return sendError(res, 400, 'VALIDATION_ERROR', 'User ID is required');

    // Projects managed by user
    const managedProjectsRes = await query(`SELECT id, name FROM projects WHERE manager_id = $1;`, [id]);
    // Teams led by user
    const ledTeamsRes = await query(`SELECT id, name FROM teams WHERE leader_id = $1;`, [id]);
    // Tasks assigned to user
    const assignedTasksRes = await query(`SELECT id, title, status FROM tasks WHERE assignee_id = $1;`, [id]);
    // Teams user is member of
    const memberTeamsRes = await query(`
      SELECT t.id, t.name FROM teams t
      JOIN team_members tm ON tm.team_id = t.id
      WHERE tm.user_id = $1;
    `, [id]);
    // Upcoming calendar events created by user
    const upcomingEventsRes = await query(`
      SELECT id, title, start_date FROM calendar_events
      WHERE creator_id = $1 AND start_date >= CURRENT_TIMESTAMP;
    `, [id]);

    return sendSuccess(res, {
      managedProjects: managedProjectsRes.rows,
      ledTeams: ledTeamsRes.rows,
      assignedTasks: assignedTasksRes.rows,
      memberTeams: memberTeamsRes.rows,
      upcomingEvents: upcomingEventsRes.rows,
      requiresReassignment: managedProjectsRes.rows.length > 0 || ledTeamsRes.rows.length > 0
    }, 'Deletion summary retrieved');
  }

  if (action === 'delete') {
    if (authUser.role !== 'admin') return sendError(res, 403, 'FORBIDDEN', 'Admin only');
    const { id, projectReassignments = {}, teamReassignments = {} } = payload;
    if (!id) return sendError(res, 400, 'VALIDATION_ERROR', 'User ID required');
    if (id === authUser.id) return sendError(res, 400, 'INVALID_ACTION', 'Cannot delete active admin account');

    // Verify user exists
    const userCheck = await query(`SELECT id, name, email FROM users WHERE id = $1;`, [id]);
    if (!userCheck.rows.length) return sendError(res, 404, 'NOT_FOUND', 'User not found');

    // Check project management responsibilities
    const managedProjects = await query(`SELECT id, name FROM projects WHERE manager_id = $1;`, [id]);
    for (const proj of managedProjects.rows) {
      if (!projectReassignments[proj.id]) {
        return sendError(res, 400, 'REASSIGNMENT_REQUIRED', `Project "${proj.name}" requires manager reassignment before deletion.`);
      }
    }

    // Check team leader responsibilities
    const ledTeams = await query(`SELECT id, name FROM teams WHERE leader_id = $1;`, [id]);
    for (const team of ledTeams.rows) {
      if (!teamReassignments[team.id]) {
        return sendError(res, 400, 'REASSIGNMENT_REQUIRED', `Team "${team.name}" requires leader reassignment before deletion.`);
      }
    }

    // Execute atomic safe retirement/deletion transaction
    await transaction(async (client) => {
      // 1. Reassign projects
      for (const [projId, newManagerId] of Object.entries(projectReassignments)) {
        await client.query(`UPDATE projects SET manager_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`, [newManagerId, projId]);
      }

      // 2. Reassign teams
      for (const [teamId, newLeaderId] of Object.entries(teamReassignments)) {
        await client.query(`UPDATE teams SET leader_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`, [newLeaderId, teamId]);
      }

      // 3. Unassign tasks assigned to this employee
      await client.query(`UPDATE tasks SET assignee_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE assignee_id = $1;`, [id]);

      // 4. Remove from active team memberships
      await client.query(`DELETE FROM team_members WHERE user_id = $1;`, [id]);

      // 5. Update DM conversation names and remove from active participants
      await client.query(`
        UPDATE conversations
        SET name = 'DM with Deleted Employee'
        WHERE type = 'direct'
          AND id IN (
            SELECT conversation_id FROM conversation_participants WHERE user_id = $1
          );
      `, [id]);
      await client.query(`DELETE FROM conversation_participants WHERE user_id = $1;`, [id]);

      // 6. Remove explicit document permissions
      await client.query(`DELETE FROM folder_permissions WHERE user_id = $1;`, [id]);

      // 7. Revoke all refresh tokens
      await client.query(`UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1;`, [id]);

      // 8. Soft-retire user: update name, status to Inactive, wipe password hash
      await client.query(`
        UPDATE users
        SET name = 'Deleted Employee',
            status = 'Inactive',
            password_hash = '!DELETED_' || gen_random_uuid(),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `, [id]);
    });

    // Invalidate auth memory cache

    return sendSuccess(res, { id, deleted: true }, 'Employee account successfully retired');
  }

  return sendError(res, 400, 'UNKNOWN_ACTION', `Action "${action}" not supported`);
}

// -------------------------------------------------------------
// TEAMS HANDLER
// -------------------------------------------------------------
async function handleTeams(action, payload, authUser, res) {
  if (action === 'list') {
    const result = await query(`
      SELECT t.id, t.name, t.department, t.leader_id, t.description, t.color, t.created_at,
             COALESCE(json_agg(tm.user_id) FILTER (WHERE tm.user_id IS NOT NULL), '[]') as member_ids
      FROM teams t LEFT JOIN team_members tm ON tm.team_id = t.id
      GROUP BY t.id ORDER BY t.created_at ASC;
    `);
    const teams = result.rows.map(r => ({
      id: r.id, name: r.name, department: r.department, leaderId: r.leader_id,
      description: r.description, color: r.color, memberIds: r.member_ids, createdAt: r.created_at
    }));
    return sendSuccess(res, { teams }, 'Teams retrieved');
  }

  if (action === 'create') {
    if (authUser.role !== 'admin') return sendError(res, 403, 'FORBIDDEN', 'Admin only');
    const { name, department, leaderId, description, color, memberIds, clientMutationId } = payload;
    if (typeof name !== 'string' || !name.trim()) return sendError(res, 400, 'VALIDATION_ERROR', 'Team name is required');
    if (!isUuid(clientMutationId)) return sendError(res, 400, 'VALIDATION_ERROR', 'A valid mutation ID is required');
    const t = await transaction(async (client) => {
      const insert = await client.query(`
        INSERT INTO teams (id, name, department, leader_id, description, color)
        VALUES ($6, $1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
        RETURNING *;
      `, [name.trim(), department, leaderId || null, description || '', color || '#635BFF', clientMutationId]);
      const wasInserted = Boolean(insert.rows[0]);
      const existing = wasInserted ? insert : await client.query('SELECT * FROM teams WHERE id = $1', [clientMutationId]);
      const team = existing.rows[0];
      if (!team) return null;
      if (wasInserted && Array.isArray(memberIds)) {
        for (const uid of memberIds) {
          await client.query(`INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [team.id, uid]);
        }
      }
      return team;
    });
    if (!t) return sendError(res, 409, 'IDEMPOTENCY_CONFLICT', 'Mutation ID is already in use');
    return sendSuccess(res, { team: { id: t.id, name: t.name, department: t.department, leaderId: t.leader_id, memberIds: memberIds || [] } }, 'Team created', 201);
  }

  if (action === 'update') {
    if (authUser.role !== 'admin') return sendError(res, 403, 'FORBIDDEN', 'Admin only');
    const { id, name, department, leaderId, description, color, memberIds } = payload;
    const updated = await transaction(async (client) => {
      const result = await client.query(`
        UPDATE teams SET name = COALESCE($2, name), department = COALESCE($3, department),
        leader_id = CASE WHEN $7 THEN $4 ELSE leader_id END,
        description = COALESCE($5, description), color = COALESCE($6, color),
        updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id;
      `, [id, name?.trim(), department, leaderId || null, description, color, Object.hasOwn(payload, 'leaderId')]);
      if (!result.rows.length) return false;
      if (Array.isArray(memberIds)) {
        await client.query('DELETE FROM team_members WHERE team_id = $1;', [id]);
        for (const uid of memberIds) {
          await client.query(`INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [id, uid]);
        }
      }
      return true;
    });
    if (!updated) return sendError(res, 404, 'NOT_FOUND', 'Team not found');
    return sendSuccess(res, { id }, 'Team updated');
  }

  if (action === 'delete') {
    if (authUser.role !== 'admin') return sendError(res, 403, 'FORBIDDEN', 'Admin only');
    await query('DELETE FROM teams WHERE id = $1', [payload.id]);
    return sendSuccess(res, { id: payload.id }, 'Team deleted');
  }
}

// -------------------------------------------------------------
// PROJECTS HANDLER
// -------------------------------------------------------------
async function handleProjects(action, payload, authUser, res) {
  if (payload.content) { try { validateContent(payload.content, true); } catch (error) { return sendError(res, 400, 'VALIDATION_ERROR', error.message); } }
  if (action === 'list') {
    const result = await query(`
      SELECT p.* FROM projects p
      WHERE ${projectScope('p', '$1', '$2')}
      ORDER BY p.created_at DESC;
    `, [authUser.id, authUser.role]);
    const projects = result.rows.map(r => ({
      id: r.id, name: r.name, description: r.description, managerId: r.manager_id, teamId: r.primary_team_id,
      priority: r.priority, status: r.status, startDate: r.start_date, dueDate: r.due_date,
      progress: r.progress, budget: Number(r.budget), spent: Number(r.spent), tags: r.tags || [],
      content: authUser.role === 'team_member' ? Object.fromEntries(Object.entries(r.content || {}).filter(([key]) => key !== 'internalNotes')) : r.content || {}
    }));
    return sendSuccess(res, { projects }, 'Projects retrieved');
  }

  if (action === 'create') {
    if (authUser.role !== 'admin' && authUser.role !== 'project_manager') return sendError(res, 403, 'FORBIDDEN', 'Unauthorized');
    const { name, description, managerId, teamId, priority, status, startDate, dueDate, progress, budget, tags, clientMutationId } = payload;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 200) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Project name must contain 1 to 200 characters');
    }
    if (!isUuid(clientMutationId)) return sendError(res, 400, 'VALIDATION_ERROR', 'A valid mutation ID is required');
    if (authUser.role === 'project_manager' && teamId) {
      const ledTeam = await query('SELECT 1 FROM teams WHERE id = $1 AND leader_id = $2', [teamId, authUser.id]);
      if (!ledTeam.rows.length) return sendError(res, 403, 'FORBIDDEN', 'You can only assign teams you lead');
    }
    const effectiveManagerId = authUser.role === 'admin' ? (managerId || authUser.id) : authUser.id;
    const created = await transaction(async (client) => {
      const result = await client.query(`
      INSERT INTO projects (id, name, description, manager_id, primary_team_id, priority, status, start_date, due_date, progress, budget, tags)
      VALUES ($12, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO NOTHING RETURNING *;
    `, [name.trim(), description || '', effectiveManagerId, teamId || null, priority || 'Medium', status || 'Planning',
      startDate || new Date().toISOString().split('T')[0], dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      progress || 0, budget || 0, tags || [], clientMutationId]);
      const wasInserted = Boolean(result.rows[0]);
      if (wasInserted) await saveContent(client, 'projects', clientMutationId, payload.content, authUser, projectScope('t', '$2', '$3'));
      const existing = wasInserted ? result : await client.query(`
        SELECT p.* FROM projects p WHERE p.id = $1 AND ${projectScope('p', '$2', '$3')}
      `, [clientMutationId, authUser.id, authUser.role]);
      const project = existing.rows[0];
      if (!project) return null;

    // Create notification for assigned manager
    if (wasInserted && project.manager_id && project.manager_id !== authUser.id) {
      await client.query(`
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES ($1, $2, $3, 'project', '/projects');
      `, [project.manager_id, `Assigned to Project: ${project.name}`, `You have been assigned as the manager for ${project.name}`]);
    }

    // Create the project's messaging room as part of project creation.
      const existingRoom = await client.query(`
      SELECT id FROM conversations
      WHERE type = 'project' AND project_id = $1
      LIMIT 1;
    `, [project.id]);
    let conversationId = existingRoom.rows[0]?.id;

    if (!conversationId) {
        const room = await client.query(`
        INSERT INTO conversations (name, type, project_id, is_read_only)
        VALUES ($1, 'project', $2, false)
        RETURNING id;
      `, [`${project.name} — Project Group`, project.id]);
      conversationId = room.rows[0].id;
    }

    // Include the project manager and members of every assigned team.
      await client.query(`
      INSERT INTO conversation_participants (conversation_id, user_id)
      SELECT $1, u.id
      FROM users u
      WHERE u.id = $2 AND u.status != 'Inactive'
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    `, [conversationId, project.manager_id]);

      await client.query(`
      INSERT INTO conversation_participants (conversation_id, user_id)
      SELECT $1, tm.user_id
      FROM project_teams pt
      JOIN team_members tm ON tm.team_id = pt.team_id
      JOIN users u ON u.id = tm.user_id
      WHERE pt.project_id = $2 AND u.status != 'Inactive'
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    `, [conversationId, project.id]);

      return { project, conversationId };
    });
    if (!created) return sendError(res, 409, 'IDEMPOTENCY_CONFLICT', 'Mutation ID is already in use');
    return sendSuccess(res, created, 'Project and messaging group created', 201);
  }

  if (action === 'update') {
    const { id, name, description, managerId, teamId, priority, status, dueDate, progress, budget, spent, tags } = payload;
    const allowed = await query(`SELECT 1 FROM projects p WHERE p.id = $1 AND ${projectScope('p', '$2', '$3')}`, [id, authUser.id, authUser.role]);
    if (!allowed.rows.length || authUser.role === 'team_member') return sendError(res, 403, 'FORBIDDEN', 'You cannot update this project');
    if (authUser.role !== 'admin' && managerId && managerId !== authUser.id) return sendError(res, 403, 'FORBIDDEN', 'You cannot reassign this project');
    if (authUser.role !== 'admin' && teamId) {
      const ledTeam = await query('SELECT 1 FROM teams WHERE id = $1 AND leader_id = $2', [teamId, authUser.id]);
      if (!ledTeam.rows.length) return sendError(res, 403, 'FORBIDDEN', 'You can only assign teams you lead');
    }
    const updated = await transaction(async (client) => {
      const result = await client.query(`
      UPDATE projects SET name = COALESCE($2, name), description = COALESCE($3, description),
      manager_id = CASE WHEN $13 THEN $4 ELSE manager_id END,
      primary_team_id = CASE WHEN $14 THEN $5 ELSE primary_team_id END,
      priority = COALESCE($6, priority), status = COALESCE($7, status), due_date = COALESCE($8, due_date),
      progress = COALESCE($9, progress), budget = COALESCE($10, budget), spent = COALESCE($11, spent), tags = COALESCE($12, tags),
      updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id;
    `, [id, name?.trim(), description, managerId || null, teamId || null, priority, status, dueDate, progress, budget, spent, tags,
      Object.hasOwn(payload, 'managerId'), Object.hasOwn(payload, 'teamId')]);
      if (!result.rows.length) return null;

      await saveContent(client, 'projects', id, payload.content, authUser, projectScope('t', '$2', '$3'));

      // Resynchronize project group conversation & membership
      const existingRoom = await client.query("SELECT id FROM conversations WHERE type = 'project' AND project_id = $1 LIMIT 1;", [id]);
      let conversationId = existingRoom.rows[0]?.id;
      const isReadOnly = ['archived', 'completed'].includes(String(status || '').toLowerCase());

      if (!conversationId) {
        const room = await client.query(`
        INSERT INTO conversations (name, type, project_id, is_read_only)
        VALUES ($1, 'project', $2, $3)
        RETURNING id;
      `, [`${name || 'Project'} — Project Group`, id, isReadOnly]);
      conversationId = room.rows[0].id;
      } else if (name || status) {
        await client.query("UPDATE conversations SET name = COALESCE($1, name), is_read_only = $2 WHERE id = $3;", [name ? `${name} — Project Group` : null, isReadOnly, conversationId]);
      }

      if (managerId) {
        await client.query(`
        INSERT INTO conversation_participants (conversation_id, user_id)
        SELECT $1, id FROM users WHERE id = $2 AND status != 'Inactive'
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
      `, [conversationId, managerId]);
      }

      if (teamId) {
        await client.query(`
        INSERT INTO conversation_participants (conversation_id, user_id)
        SELECT $1, tm.user_id FROM team_members tm
        JOIN users u ON u.id = tm.user_id
        WHERE tm.team_id = $2 AND u.status != 'Inactive'
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
      `, [conversationId, teamId]);
      }
      return { conversationId };
    });

    if (!updated) return sendError(res, 404, 'NOT_FOUND', 'Project not found');
    return sendSuccess(res, { id, conversationId: updated.conversationId }, 'Project updated');
  }

  if (action === 'delete') {
    if (authUser.role !== 'admin') return sendError(res, 403, 'FORBIDDEN', 'Admin only');
    await query('DELETE FROM projects WHERE id = $1', [payload.id]);
    return sendSuccess(res, { id: payload.id }, 'Project deleted');
  }
}

// -------------------------------------------------------------
// TASKS HANDLER
// -------------------------------------------------------------
async function handleTasks(action, payload, authUser, res) {
  if (payload.content) { try { validateContent(payload.content); } catch (error) { return sendError(res, 400, 'VALIDATION_ERROR', error.message); } }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Task payload must be an object');
  }
  if (['update', 'delete'].includes(action) && !isUuid(payload.id)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'A valid task ID is required');
  }
  if (['create', 'update'].includes(action)) {
    if ((action === 'create' || Object.hasOwn(payload, 'projectId')) && !isUuid(payload.projectId)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'A valid project ID is required');
    }
    if (['assigneeId', 'teamId'].some(key => payload[key] && !isUuid(payload[key]))) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid assignee or team ID');
    }
    if ((action === 'create' || Object.hasOwn(payload, 'title')) &&
        (typeof payload.title !== 'string' || !payload.title.trim() || payload.title.length > 255)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Task title must contain 1 to 255 characters');
    }
    if (Object.hasOwn(payload, 'progress') &&
        (!Number.isInteger(payload.progress) || payload.progress < 0 || payload.progress > 100)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Task progress must be an integer from 0 to 100');
    }
  }

  if (action === 'list') {
    const result = await query(`
      SELECT t.*,
        COALESCE((SELECT json_agg(json_build_object('id', s.id, 'title', s.title, 'completed', s.completed)) FROM subtasks s WHERE s.task_id = t.id), '[]') as subtasks,
        COALESCE((SELECT json_agg(json_build_object('id', c.id, 'userId', c.user_id, 'userName', u.name, 'text', c.text, 'timestamp', to_char(c.created_at, 'YYYY-MM-DD HH24:MI')))
                  FROM task_comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.task_id = t.id), '[]') as comments
      FROM tasks t WHERE ${taskScope('$1', '$2', true)} ORDER BY t.kanban_order ASC, t.created_at DESC;
    `, [authUser.id, authUser.role]);
    const tasks = result.rows.map(r => ({
      id: r.id, title: r.title, description: r.description, projectId: r.project_id, assigneeId: r.assignee_id,
      teamId: r.team_id, priority: r.priority, status: r.status, startDate: r.start_date, dueDate: r.due_date,
      progress: r.progress, labels: r.labels || [], subtasks: r.subtasks || [], comments: r.comments || [], content: r.content || {}
    }));
    return sendSuccess(res, { tasks }, 'Tasks retrieved');
  }

  if (action === 'create') {
    if (!['admin', 'project_manager'].includes(authUser.role)) {
      return sendError(res, 403, 'FORBIDDEN', 'You cannot create tasks');
    }
    const { title, description, projectId, assigneeId, teamId, priority, status, startDate, dueDate, progress, labels, clientMutationId } = payload;
    if (!isUuid(clientMutationId)) return sendError(res, 400, 'VALIDATION_ERROR', 'A valid mutation ID is required');

    // Validate Task Type and Delivery Category against Project Type and Delivery Schedule if projectId is provided
    if (projectId) {
      const projCheck = await query(`SELECT content FROM projects WHERE id = $1`, [projectId]);
      const pRow = projCheck.rows[0];
      if (pRow) {
        if (payload.content?.contentType) {
          const allowedTaskTypes = getTaskTypesForProjectType(pRow.content?.projectType);
          if (!allowedTaskTypes.includes(payload.content.contentType)) {
            return sendError(res, 400, 'VALIDATION_ERROR', `Task type "${payload.content.contentType}" is not valid for project type "${pRow.content?.projectType || 'Other'}"`);
          }
        }
        if (payload.content?.deliveryCategory) {
          const allowedCategories = getAllowedDeliveryCategories(pRow.content?.deliverySchedule);
          if (!allowedCategories.includes(payload.content.deliveryCategory)) {
            return sendError(res, 400, 'VALIDATION_ERROR', `Delivery category "${payload.content.deliveryCategory}" is not allowed for project schedule "${pRow.content?.deliverySchedule || 'Monthly Deliverables'}"`);
          }
        }
      }
    }

    const task = await transaction(async client => {
      const result = await client.query(`
      INSERT INTO tasks (id, title, description, project_id, assignee_id, team_id, priority, status, start_date, due_date, progress, labels)
      SELECT $14, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      WHERE $13 = 'admin' OR (
        EXISTS (
          SELECT 1 FROM projects p WHERE p.id = $3 AND (
            p.manager_id = $12 OR EXISTS (
              SELECT 1 FROM teams pt WHERE pt.id = p.primary_team_id AND pt.leader_id = $12
            )
          )
        )
        AND ($5::uuid IS NULL OR EXISTS (SELECT 1 FROM teams WHERE id = $5 AND leader_id = $12))
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING *;
    `, [title, description || '', projectId || null, assigneeId || null, teamId || null, priority || 'Medium', status || 'To Do',
      startDate || new Date().toISOString().split('T')[0], dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      progress || 0, labels || ['General'], authUser.id, authUser.role, clientMutationId]);
      const wasInserted = Boolean(result.rows[0]);
      const existing = wasInserted ? result : await client.query(`
        SELECT t.* FROM tasks t WHERE t.id = $1 AND ${taskScope('$2', '$3', true)}
      `, [clientMutationId, authUser.id, authUser.role]);
      const r = existing.rows[0];
      if (!r) return null;
      if (wasInserted) await saveContent(client, 'tasks', r.id, payload.content, authUser, taskScope('$2', '$3', true));

      const normalizedTask = {
        id: r.id,
        title: r.title,
        description: r.description,
        projectId: r.project_id,
        assigneeId: r.assignee_id,
        teamId: r.team_id,
        priority: r.priority,
        status: r.status,
        startDate: r.start_date ? new Date(r.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        dueDate: r.due_date ? new Date(r.due_date).toISOString().split('T')[0] : new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        progress: r.progress || 0,
        labels: r.labels || [],
        subtasks: [],
        comments: []
      };

      // Create notification for assigned user
      if (wasInserted && normalizedTask.assigneeId && normalizedTask.assigneeId !== authUser.id) {
        await client.query(`
          INSERT INTO notifications (user_id, title, message, type, link)
          VALUES ($1, $2, $3, 'task', '/tasks');
        `, [normalizedTask.assigneeId, `Task Assigned: ${normalizedTask.title}`, `You have been assigned to task "${normalizedTask.title}"`]);
      }

      return normalizedTask;
    });
    if (!task) return sendError(res, 403, 'FORBIDDEN', 'You cannot create tasks in this project or team');
    return sendSuccess(res, { task }, 'Task created', 201);
  }

  if (action === 'update') {
    const { id, title, description, projectId, assigneeId, teamId, priority, status, dueDate, progress, labels, comments } = payload;
    if (authUser.role === 'team_member') {
      const current = await query(`SELECT t.* FROM tasks t WHERE t.id = $1 AND t.assignee_id = $2`, [id, authUser.id]);
      const row = current.rows[0];
      if (!row) return sendError(res, 403, 'FORBIDDEN', 'Only your assigned tasks can be updated');
      const protectedFields = { title: 'title', description: 'description', projectId: 'project_id', assigneeId: 'assignee_id', teamId: 'team_id', priority: 'priority', dueDate: 'due_date', labels: 'labels' };
      for (const [key, column] of Object.entries(protectedFields)) {
        const stored = key === 'dueDate' && row[column] ? new Date(row[column]).toISOString().slice(0, 10) : row[column];
        const proposed = key === 'dueDate' && payload[key] ? String(payload[key]).slice(0, 10) : payload[key];
        if (Object.hasOwn(payload, key) && JSON.stringify(proposed ?? null) !== JSON.stringify(stored ?? null)) return sendError(res, 403, 'FORBIDDEN', `You cannot change ${key}`);
      }
    }
    const updated = await transaction(async client => {
      await saveContent(client, 'tasks', id, payload.content, authUser, taskScope('$2', '$3', true), Object.fromEntries(['title', 'description', 'assigneeId'].filter(key => Object.hasOwn(payload, key)).map(key => [key, payload[key]])));
      const result = await client.query(`
      UPDATE tasks t SET title = COALESCE($2, title), description = COALESCE($3, description), project_id = CASE WHEN $12 THEN $4 ELSE project_id END,
      assignee_id = CASE WHEN $13 THEN $5 ELSE assignee_id END,
      team_id = CASE WHEN $14 THEN $6 ELSE team_id END, priority = COALESCE($7, priority), status = COALESCE($8, status), due_date = COALESCE($9, due_date),
      progress = COALESCE($10, progress), labels = COALESCE($11, labels), updated_at = CURRENT_TIMESTAMP WHERE t.id = $1
      AND ${taskScope('$15', '$16')}
      AND ($16 = 'admin' OR (
        (NOT $12 OR $4 IS NOT DISTINCT FROM t.project_id OR ($16 = 'project_manager' AND EXISTS
          (SELECT 1 FROM projects WHERE id = $4 AND manager_id = $15)))
        AND (NOT $14 OR $6 IS NOT DISTINCT FROM t.team_id OR ($16 = 'project_manager' AND ($6 IS NULL OR EXISTS
          (SELECT 1 FROM teams WHERE id = $6 AND leader_id = $15))))
        AND ($16 <> 'team_member' OR NOT $13 OR $5 IS NOT DISTINCT FROM t.assignee_id)
      ));
    `, [id, title, description, projectId || null, assigneeId || null, teamId || null, priority, status, dueDate, progress, labels,
      Object.hasOwn(payload, 'projectId'), Object.hasOwn(payload, 'assigneeId'), Object.hasOwn(payload, 'teamId'),
      authUser.id, authUser.role]);
      if (result.rowCount === 0) return false;

      if (Array.isArray(comments) && comments.length > 0) {
        const last = comments[comments.length - 1];
        if (last?.text && typeof last.id === 'string' && /^c-\d+$/.test(last.id)) {
          await client.query(`INSERT INTO task_comments (task_id, user_id, text) VALUES ($1, $2, $3);`, [id, authUser.id, last.text]);
        }
      }
      return true;
    });
    if (!updated) return sendError(res, 404, 'NOT_FOUND', 'Task not found or unavailable');
    return sendSuccess(res, { id }, 'Task updated');
  }

  if (action === 'delete') {
    if (authUser.role !== 'admin') {
      return sendError(res, 403, 'FORBIDDEN', 'You cannot delete tasks');
    }
    const result = await query(
      `DELETE FROM tasks t WHERE t.id = $1 AND ${taskScope('$2', '$3')}`,
      [payload.id, authUser.id, authUser.role]
    );
    if (result.rowCount === 0) return sendError(res, 404, 'NOT_FOUND', 'Task not found or unavailable');
    return sendSuccess(res, { id: payload.id }, 'Task deleted');
  }
  return sendError(res, 400, 'UNKNOWN_ACTION', 'Action is not supported for tasks');
}

// -------------------------------------------------------------
// DOCUMENTS HANDLER
// -------------------------------------------------------------
async function handleDocuments(action, payload, authUser, res) {
  if (action === 'list') {
    const result = await query(`
      SELECT d.id, d.name, d.folder, d.project_id, d.size_bytes, d.mime_type,
             d.author_id, d.assigned_user_ids, d.created_at, d.updated_at, u.name as author_name
      FROM documents d LEFT JOIN users u ON u.id = d.author_id
      WHERE ${documentScope('d', '$1', '$2')}
      ORDER BY d.created_at DESC;
    `, [authUser.id, authUser.role]);
    const documents = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      folder: r.folder,
      projectId: r.project_id,
      size: `${(r.size_bytes / 1024 / 1024).toFixed(1)} MB`,
      type: r.mime_type.includes('pdf') ? 'pdf' : 'doc',
      author: r.author_name || 'System',
      authorId: r.author_id,
      assignedUserIds: r.assigned_user_ids || [],
      date: new Date(r.created_at).toISOString().split('T')[0],
      updatedAt: new Date(r.updated_at || r.created_at).toISOString().split('T')[0]
    }));
    const fpRes = await query(`
      SELECT folder_key as "folderKey", user_id as "userId" FROM folder_permissions
      WHERE $2 = 'admin' OR user_id = $1;
    `, [authUser.id, authUser.role]);
    return sendSuccess(res, { documents, folderPermissions: fpRes.rows }, 'Documents retrieved');
  }

  if (action === 'create') {
    const { name, folder, projectId, type, mimeType, fileBase64, sizeBytes, assignedUserIds, clientMutationId } = payload;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 255) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Document name must contain 1 to 255 characters');
    }
    if (!isUuid(clientMutationId)) return sendError(res, 400, 'VALIDATION_ERROR', 'A valid mutation ID is required');
    if (typeof fileBase64 !== 'string' || !fileBase64) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Document content is required');
    }
    if (projectId) {
      const projectAccess = await query(`SELECT 1 FROM projects p WHERE p.id = $1 AND ${projectScope('p', '$2', '$3')}`, [projectId, authUser.id, authUser.role]);
      if (!projectAccess.rows.length) return sendError(res, 403, 'FORBIDDEN', 'You cannot upload to this project');
    }
    const cleaned = fileBase64.replace(/^data:[^;]+;base64,/, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned) || cleaned.length % 4 !== 0) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Document content is not valid Base64');
    }
    const buf = Buffer.from(cleaned, 'base64');

    if (buf.length > 15 * 1024 * 1024) {
      return sendError(res, 400, 'PAYLOAD_TOO_LARGE', 'Document size exceeds maximum 15MB limit');
    }

    if (sizeBytes != null && Number(sizeBytes) !== buf.length) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Document size does not match its content');
    }
    const allowedMimeTypes = new Set([
      'application/pdf', 'text/plain', 'text/csv',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png', 'image/jpeg', 'image/webp', 'application/octet-stream'
    ]);
    const resolvedMime = mimeType || (type?.toLowerCase().includes('pdf') ? 'application/pdf' : 'application/octet-stream');
    if (!allowedMimeTypes.has(resolvedMime)) return sendError(res, 400, 'UNSUPPORTED_FILE_TYPE', 'Document type is not supported');
    const result = await query(`
      INSERT INTO documents (id, name, folder, project_id, size_bytes, mime_type, file_data, author_id, assigned_user_ids)
      VALUES ($9, $1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING
      RETURNING id, name, folder, project_id, size_bytes, mime_type, author_id, assigned_user_ids, created_at, updated_at;
    `, [name.trim(), folder || (projectId ? 'Project Document' : 'General'), projectId || null, buf.length, resolvedMime, buf, authUser.id,
      authUser.role === 'admin' && Array.isArray(assignedUserIds) ? assignedUserIds : [], clientMutationId]);
    if (!result.rows[0]) {
      const existing = await query(`
        SELECT id, name, folder, project_id, size_bytes, mime_type, author_id, assigned_user_ids, created_at, updated_at
        FROM documents d WHERE d.id = $1 AND ${documentScope('d', '$2', '$3')}
      `, [clientMutationId, authUser.id, authUser.role]);
      if (!existing.rows[0]) return sendError(res, 409, 'IDEMPOTENCY_CONFLICT', 'Mutation ID is already in use');
      return sendSuccess(res, { document: existing.rows[0] }, 'Document already created', 200);
    }
    return sendSuccess(res, { document: result.rows[0] }, 'Document created', 201);
  }

  if (action === 'get-file') {
    const { id } = payload;
    if (!id) return sendError(res, 400, 'VALIDATION_ERROR', 'Document ID required');
    const docRes = await query(`
      SELECT id, name, mime_type, size_bytes, file_data, project_id, author_id, assigned_user_ids
      FROM documents
      WHERE id = $1 AND ${documentScope('documents', '$2', '$3')};
    `, [id, authUser.id, authUser.role]);
    if (!docRes.rows[0]) return sendError(res, 404, 'NOT_FOUND', 'Document not found');
    const doc = docRes.rows[0];

    // Authorization check: Admin, Author, or Assigned
    const isAuthorized = authUser.role === 'admin'
      || doc.author_id === authUser.id
      || (doc.assigned_user_ids && doc.assigned_user_ids.includes(authUser.id));

    // Also check project membership if linked to project
    let hasProjectAccess = false;
    if (doc.project_id) {
      const pmRes = await query(`
        SELECT 1 FROM project_teams pt
        JOIN team_members tm ON tm.team_id = pt.team_id
        WHERE pt.project_id = $1 AND tm.user_id = $2
        UNION
        SELECT 1 FROM projects WHERE id = $1 AND manager_id = $2;
      `, [doc.project_id, authUser.id]);
      hasProjectAccess = Boolean(pmRes.rows[0]);
    }

    if (!isAuthorized && !hasProjectAccess) {
      return sendError(res, 403, 'FORBIDDEN', 'Access denied to document binary');
    }

    const base64Data = doc.file_data ? doc.file_data.toString('base64') : '';
    return sendSuccess(res, {
      id: doc.id,
      name: doc.name,
      mimeType: doc.mime_type,
      sizeBytes: doc.size_bytes,
      fileBase64: base64Data
    }, 'File data retrieved');
  }

  if (action === 'update') {
    const { id, name, folder, projectId, assignedUserIds } = payload;
    const result = await query(`
      UPDATE documents d
      SET name = COALESCE($2, name),
          folder = COALESCE($3, folder),
          project_id = CASE WHEN $8 THEN $4 ELSE project_id END,
          assigned_user_ids = CASE WHEN $7 = 'admin' THEN COALESCE($5, assigned_user_ids) ELSE assigned_user_ids END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND ${documentScope('d', '$6', '$7')}
      RETURNING id;
    `, [id, name?.trim(), folder, projectId || null, Array.isArray(assignedUserIds) ? assignedUserIds : null,
      authUser.id, authUser.role, Object.hasOwn(payload, 'projectId')]);
    if (!result.rows.length) return sendError(res, 404, 'NOT_FOUND', 'Document not found or unavailable');
    return sendSuccess(res, { id }, 'Document updated');
  }

  if (action === 'assign-file-access') {
    if (authUser.role !== 'admin') {
      return sendError(res, 403, 'FORBIDDEN', 'Only Admin can manage file access permissions');
    }
    const { id, userIds } = payload;
    const result = await query(`
      UPDATE documents SET assigned_user_ids = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1;
    `, [id, userIds || []]);
    if (!result.rowCount) return sendError(res, 404, 'NOT_FOUND', 'Document not found');
    return sendSuccess(res, { id, userIds }, 'File access permissions updated');
  }

  if (action === 'assign-folder-access') {
    if (authUser.role !== 'admin') {
      return sendError(res, 403, 'FORBIDDEN', 'Only Admin can manage folder access permissions');
    }
    const { folderKey, userIds } = payload;
    await transaction(async (client) => {
      await client.query(`DELETE FROM folder_permissions WHERE folder_key = $1;`, [folderKey]);
      if (Array.isArray(userIds)) {
        for (const uid of userIds) {
          await client.query(`INSERT INTO folder_permissions (folder_key, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [folderKey, uid]);
        }
      }
    });
    return sendSuccess(res, { folderKey, userIds }, 'Folder access permissions updated');
  }

  if (action === 'delete') {
    const result = await query(`
      DELETE FROM documents d WHERE d.id = $1
        AND ($3 = 'admin' OR d.author_id = $2)
    `, [payload.id, authUser.id, authUser.role]);
    if (!result.rowCount) return sendError(res, 404, 'NOT_FOUND', 'Document not found or unavailable');
    return sendSuccess(res, { id: payload.id }, 'Document deleted');
  }
}

// -------------------------------------------------------------
// CALENDAR HANDLER
// -------------------------------------------------------------
async function handleCalendar(action, payload, authUser, res) {
  if (action === 'list') {
    // Return all events along with their attendees, project, and team links
    const result = await query(`
      SELECT e.*,
        COALESCE((
          SELECT json_agg(a.user_id)
          FROM calendar_event_attendees a
          WHERE a.event_id = e.id
        ), '[]'::json) AS attendees
      FROM calendar_events e
      WHERE $2 = 'admin'
         OR e.creator_id = $1
         OR EXISTS (SELECT 1 FROM calendar_event_attendees ea WHERE ea.event_id = e.id AND ea.user_id = $1)
         OR (e.department IS NOT NULL AND e.department = (SELECT department FROM users WHERE id = $1))
         OR EXISTS (SELECT 1 FROM teams et WHERE et.id = e.team_id AND (et.leader_id = $1 OR EXISTS
            (SELECT 1 FROM team_members etm WHERE etm.team_id = et.id AND etm.user_id = $1)))
         OR EXISTS (SELECT 1 FROM projects ep WHERE ep.id = e.project_id AND ${projectScope('ep', '$1', '$2')})
      ORDER BY e.start_date ASC;
    `, [authUser.id, authUser.role]);

    const events = result.rows.map(r => {
      const sDate = r.start_date ? new Date(r.start_date) : null;
      const eDate = r.end_date ? new Date(r.end_date) : sDate;

      // Extract local date components safely
      const dateStr = sDate ? sDate.toLocaleDateString('en-CA') : '';
      const timeStr = sDate ? sDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '';

      return {
        id: r.id,
        title: r.title,
        description: r.description || '',
        type: r.type,
        startDate: sDate ? sDate.toISOString() : '',
        endDate: eDate ? eDate.toISOString() : '',
        date: dateStr,
        time: timeStr,
        location: r.location,
        isAllDay: Boolean(r.is_all_day),
        projectId: r.project_id,
        teamId: r.team_id,
        department: r.department,
        creatorId: r.creator_id,
        attendees: r.attendees || []
      };
    });

    return sendSuccess(res, { events }, 'Events retrieved');
  }

  if (action === 'create') {
    // RBAC: Team Member cannot create events
    if (authUser.role === 'team_member') {
      return sendError(res, 403, 'FORBIDDEN', 'Team members do not have permission to create calendar events');
    }

    const {
      title,
      description,
      type,
      startDate,
      endDate,
      date,
      time,
      location,
      isAllDay,
      projectId,
      teamId,
      department,
      attendees,
      clientMutationId
    } = payload;
    if (!isUuid(clientMutationId)) return sendError(res, 400, 'VALIDATION_ERROR', 'A valid mutation ID is required');

    // RBAC: Team Leader (project_manager) restrictions
    if (authUser.role === 'project_manager') {
      if (type === 'company_event') {
        return sendError(res, 403, 'FORBIDDEN', 'Only administrators can create company-wide events');
      }
      if (teamId) {
        const teamCheck = await query(`SELECT 1 FROM teams WHERE id = $1 AND leader_id = $2;`, [teamId, authUser.id]);
        if (!teamCheck.rows.length) {
          return sendError(res, 403, 'FORBIDDEN', 'Team leaders can only create events for teams they lead');
        }
      }
      if (projectId) {
        const projCheck = await query(`
          SELECT 1 FROM projects WHERE id = $1 AND manager_id = $2
          UNION
          SELECT 1 FROM project_teams pt
          JOIN teams t ON t.id = pt.team_id
          WHERE pt.project_id = $1 AND t.leader_id = $2;
        `, [projectId, authUser.id]);
        if (!projCheck.rows.length) {
          return sendError(res, 403, 'FORBIDDEN', 'Team leaders can only create events for assigned projects');
        }
      }
    }

    // Parse valid timestamp with safe fallbacks
    let startTimestamp;
    if (startDate) {
      startTimestamp = new Date(startDate);
    } else if (date) {
      startTimestamp = new Date(`${date}T${time || '09:00'}:00`);
    } else {
      startTimestamp = new Date();
    }

    if (isNaN(startTimestamp.getTime())) return sendError(res, 400, 'VALIDATION_ERROR', 'Event start date is invalid');

    let endTimestamp = endDate ? new Date(endDate) : new Date(startTimestamp.getTime() + 3600000);
    if (isNaN(endTimestamp.getTime())) return sendError(res, 400, 'VALIDATION_ERROR', 'Event end date is invalid');
    if (endTimestamp < startTimestamp) return sendError(res, 400, 'VALIDATION_ERROR', 'Event end must be after its start');

    const validTypes = ['meeting', 'milestone', 'deadline', 'team_event', 'company_event', 'reminder'];
    const eventType = validTypes.includes(type?.toLowerCase()) ? type.toLowerCase() : 'meeting';

    const result = await query(`
      INSERT INTO calendar_events (
        id, title, description, type, start_date, end_date, location,
        is_all_day, project_id, team_id, department, creator_id
      )
      VALUES ($12, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO NOTHING
      RETURNING *;
    `, [
      title || 'Untitled Event',
      description || '',
      eventType,
      startTimestamp,
      endTimestamp,
      location || 'Virtual',
      !!isAllDay,
      projectId || null,
      teamId || null,
      department || null,
      authUser.id,
      clientMutationId
    ]);

    let r = result.rows[0];
    if (!r) {
      const existing = await query('SELECT * FROM calendar_events WHERE id = $1 AND creator_id = $2', [clientMutationId, authUser.id]);
      r = existing.rows[0];
      if (!r) return sendError(res, 409, 'IDEMPOTENCY_CONFLICT', 'Mutation ID is already in use');
      const existingAttendees = await query('SELECT user_id FROM calendar_event_attendees WHERE event_id = $1', [r.id]);
      const existingStart = new Date(r.start_date);
      const existingEnd = new Date(r.end_date);
      return sendSuccess(res, { event: {
        id: r.id, title: r.title, description: r.description, type: r.type,
        startDate: existingStart.toISOString(), endDate: existingEnd.toISOString(),
        date: existingStart.toLocaleDateString('en-CA'),
        time: existingStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        location: r.location, isAllDay: r.is_all_day, projectId: r.project_id,
        teamId: r.team_id, department: r.department, creatorId: r.creator_id,
        attendees: existingAttendees.rows.map(row => row.user_id)
      } }, 'Event already created');
    }

    // Store attendees
    const safeAttendees = Array.isArray(attendees) ? attendees : [];
    for (const uid of safeAttendees) {
      await query(`
        INSERT INTO calendar_event_attendees (event_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [r.id, uid]);
    }

    // Determine target recipient IDs for notifications
    const recipientIds = new Set();

    const isCompanyWide = eventType === 'company_event' || (!projectId && !teamId && !department && safeAttendees.length === 0);

    if (isCompanyWide) {
      const allUsers = await query(`SELECT id FROM users WHERE status != 'Inactive';`);
      allUsers.rows.forEach(u => recipientIds.add(u.id));
    } else {
      // 1. Department members
      if (department) {
        const deptUsers = await query(`SELECT id FROM users WHERE department = $1 AND status != 'Inactive';`, [department]);
        deptUsers.rows.forEach(u => recipientIds.add(u.id));
      }
      // 2. Team members
      if (teamId) {
        const teamUsers = await query(`
          SELECT user_id FROM team_members tm
          JOIN users u ON u.id = tm.user_id
          WHERE tm.team_id = $1 AND u.status != 'Inactive'
          UNION
          SELECT leader_id FROM teams WHERE id = $1 AND leader_id IS NOT NULL;
        `, [teamId]);
        teamUsers.rows.forEach(u => recipientIds.add(u.user_id));
      }
      // 3. Project participants
      if (projectId) {
        const projUsers = await query(`
          SELECT tm.user_id
          FROM project_teams pt
          JOIN team_members tm ON tm.team_id = pt.team_id
          JOIN users u ON u.id = tm.user_id
          WHERE pt.project_id = $1 AND u.status != 'Inactive'
          UNION
          SELECT manager_id FROM projects WHERE id = $1 AND manager_id IS NOT NULL;
        `, [projectId]);
        projUsers.rows.forEach(u => recipientIds.add(u.user_id));
      }
      // 4. Explicit attendees
      safeAttendees.forEach(uid => recipientIds.add(uid));
    }

    // Exclude creator from receiving own creation notification
    recipientIds.delete(authUser.id);

    // Format readable time string for message
    const formattedDate = startTimestamp.toLocaleDateString('en-CA');
    const formattedTime = isAllDay ? 'All Day' : startTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    for (const recipientId of recipientIds) {
      await query(`
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES ($1, $2, $3, 'calendar_event', '/calendar');
      `, [
        recipientId,
        `New Event: ${r.title}`,
        `${r.title} scheduled for ${formattedDate} (${formattedTime}).`
      ]);
    }

    const sDate = new Date(r.start_date);
    const eDate = new Date(r.end_date);

    return sendSuccess(res, {
      event: {
        id: r.id,
        title: r.title,
        description: r.description,
        type: r.type,
        startDate: sDate.toISOString(),
        endDate: eDate.toISOString(),
        date: sDate.toLocaleDateString('en-CA'),
        time: sDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        location: r.location,
        isAllDay: r.is_all_day,
        projectId: r.project_id,
        teamId: r.team_id,
        department: r.department,
        creatorId: r.creator_id,
        attendees: safeAttendees
      }
    }, 'Event created', 201);
  }

  if (action === 'update') {
    // RBAC: Team Member cannot edit events
    if (authUser.role === 'team_member') {
      return sendError(res, 403, 'FORBIDDEN', 'Team members do not have permission to edit calendar events');
    }

    const {
      id,
      title,
      description,
      type,
      startDate,
      endDate,
      location,
      isAllDay,
      projectId,
      teamId,
      department,
      attendees
    } = payload;

    if (!id) return sendError(res, 400, 'VALIDATION_ERROR', 'Event ID is required');

    // Check authorization for Team Leader
    const prevRes = await query(`SELECT * FROM calendar_events WHERE id = $1;`, [id]);
    const prevEvent = prevRes.rows[0];
    if (!prevEvent) return sendError(res, 404, 'NOT_FOUND', 'Event not found');

    if (authUser.role === 'project_manager') {
      const isCreator = prevEvent.creator_id === authUser.id;
      let hasTeamAuth = false;
      if (prevEvent.team_id) {
        const teamCheck = await query(`SELECT 1 FROM teams WHERE id = $1 AND leader_id = $2;`, [prevEvent.team_id, authUser.id]);
        hasTeamAuth = Boolean(teamCheck.rows.length);
      }
      let hasProjectAuth = false;
      if (prevEvent.project_id) {
        const projCheck = await query(`
          SELECT 1 FROM projects WHERE id = $1 AND manager_id = $2
          UNION
          SELECT 1 FROM project_teams pt
          JOIN teams t ON t.id = pt.team_id
          WHERE pt.project_id = $1 AND t.leader_id = $2;
        `, [prevEvent.project_id, authUser.id]);
        hasProjectAuth = Boolean(projCheck.rows.length);
      }

      if (!isCreator && !hasTeamAuth && !hasProjectAuth) {
        return sendError(res, 403, 'FORBIDDEN', 'You do not have authorization to edit this event');
      }
    }

    const validTypes = ['meeting', 'milestone', 'deadline', 'team_event', 'company_event', 'reminder'];
    if (type === 'company_event' && authUser.role !== 'admin') {
      return sendError(res, 403, 'FORBIDDEN', 'Only administrators can create company-wide events');
    }
    const eventType = type == null
      ? null
      : (validTypes.includes(String(type).toLowerCase()) ? String(type).toLowerCase() : null);
    if (type != null && !eventType) return sendError(res, 400, 'VALIDATION_ERROR', 'Unsupported event type');

    const startTimestamp = startDate == null ? null : new Date(startDate);
    const endTimestamp = endDate == null ? null : new Date(endDate);
    if ((startTimestamp && Number.isNaN(startTimestamp.getTime())) || (endTimestamp && Number.isNaN(endTimestamp.getTime()))) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Event dates are invalid');
    }
    const effectiveStart = startTimestamp || new Date(prevEvent.start_date);
    const effectiveEnd = endTimestamp || new Date(prevEvent.end_date);
    if (effectiveEnd < effectiveStart) return sendError(res, 400, 'VALIDATION_ERROR', 'Event end must be after its start');

    if (authUser.role === 'project_manager' && teamId && teamId !== prevEvent.team_id) {
      const ledTeam = await query('SELECT 1 FROM teams WHERE id = $1 AND leader_id = $2', [teamId, authUser.id]);
      if (!ledTeam.rows.length) return sendError(res, 403, 'FORBIDDEN', 'You can only move events to teams you lead');
    }
    if (authUser.role === 'project_manager' && projectId && projectId !== prevEvent.project_id) {
      const managedProject = await query(`SELECT 1 FROM projects p WHERE p.id = $1 AND ${projectScope('p', '$2', '$3')}`, [projectId, authUser.id, authUser.role]);
      if (!managedProject.rows.length) return sendError(res, 403, 'FORBIDDEN', 'You cannot move events to that project');
    }

    const updateRes = await query(`
      UPDATE calendar_events
      SET title = COALESCE($2, title),
          description = COALESCE($3, description),
          type = COALESCE($4, type),
          start_date = COALESCE($5, start_date),
          end_date = COALESCE($6, end_date),
          location = COALESCE($7, location),
          is_all_day = COALESCE($8, is_all_day),
          project_id = CASE WHEN $12 THEN $9 ELSE project_id END,
          team_id = CASE WHEN $13 THEN $10 ELSE team_id END,
          department = CASE WHEN $14 THEN $11 ELSE department END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `, [
      id,
      title,
      description,
      eventType,
      startTimestamp,
      endTimestamp,
      location,
      isAllDay,
      projectId || null,
      teamId || null,
      department || null,
      Object.hasOwn(payload, 'projectId'),
      Object.hasOwn(payload, 'teamId'),
      Object.hasOwn(payload, 'department')
    ]);

    const updatedEvent = updateRes.rows[0];

    if (Array.isArray(attendees)) {
      await query(`DELETE FROM calendar_event_attendees WHERE event_id = $1;`, [id]);
      for (const uid of attendees) {
        await query(`
          INSERT INTO calendar_event_attendees (event_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING;
        `, [id, uid]);
      }
    }

    // Notify participants about the update
    const recipientIds = new Set();
    const effectiveType = updatedEvent.type;
    const atts = await query(`SELECT user_id FROM calendar_event_attendees WHERE event_id = $1;`, [id]);
    const isCompanyWide = effectiveType === 'company_event' || (!updatedEvent.project_id && !updatedEvent.team_id && !updatedEvent.department && atts.rows.length === 0);

    if (isCompanyWide) {
      const allUsers = await query(`SELECT id FROM users WHERE status != 'Inactive';`);
      allUsers.rows.forEach(u => recipientIds.add(u.id));
    } else {
      if (updatedEvent.department) {
        const deptUsers = await query(`SELECT id FROM users WHERE department = $1 AND status != 'Inactive';`, [updatedEvent.department]);
        deptUsers.rows.forEach(u => recipientIds.add(u.id));
      }
      if (updatedEvent.team_id) {
        const teamUsers = await query(`
          SELECT user_id FROM team_members tm
          JOIN users u ON u.id = tm.user_id
          WHERE tm.team_id = $1 AND u.status != 'Inactive'
          UNION
          SELECT leader_id FROM teams WHERE id = $1 AND leader_id IS NOT NULL;
        `, [updatedEvent.team_id]);
        teamUsers.rows.forEach(u => recipientIds.add(u.user_id));
      }
      if (updatedEvent.project_id) {
        const projUsers = await query(`
          SELECT tm.user_id
          FROM project_teams pt
          JOIN team_members tm ON tm.team_id = pt.team_id
          JOIN users u ON u.id = tm.user_id
          WHERE pt.project_id = $1 AND u.status != 'Inactive'
          UNION
          SELECT manager_id FROM projects WHERE id = $1 AND manager_id IS NOT NULL;
        `, [updatedEvent.project_id]);
        projUsers.rows.forEach(u => recipientIds.add(u.user_id));
      }
      atts.rows.forEach(a => recipientIds.add(a.user_id));
    }

    recipientIds.delete(authUser.id);

    const sDate = new Date(updatedEvent.start_date);
    const dateFormatted = sDate.toLocaleDateString('en-CA');
    const timeFormatted = updatedEvent.is_all_day ? 'All Day' : sDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    for (const recipientId of recipientIds) {
      await query(`
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES ($1, $2, $3, 'calendar_event', '/calendar');
      `, [
        recipientId,
        `Event Updated: ${updatedEvent.title}`,
        `${updatedEvent.title} has been updated. Scheduled for ${dateFormatted} (${timeFormatted}).`
      ]);
    }

    return sendSuccess(res, { id }, 'Event updated');
  }

  if (action === 'delete') {
    // RBAC: Team Member cannot delete events
    if (authUser.role === 'team_member') {
      return sendError(res, 403, 'FORBIDDEN', 'Team members do not have permission to delete calendar events');
    }

    const { id } = payload;
    if (!id) return sendError(res, 400, 'VALIDATION_ERROR', 'Event ID is required');

    // Fetch details before deletion to check authorization & notify attendees
    const evtRes = await query(`SELECT * FROM calendar_events WHERE id = $1;`, [id]);
    const evt = evtRes.rows[0];
    if (!evt) return sendError(res, 404, 'NOT_FOUND', 'Event not found');

    if (authUser.role === 'project_manager') {
      const isCreator = evt.creator_id === authUser.id;
      let hasTeamAuth = false;
      if (evt.team_id) {
        const teamCheck = await query(`SELECT 1 FROM teams WHERE id = $1 AND leader_id = $2;`, [evt.team_id, authUser.id]);
        hasTeamAuth = Boolean(teamCheck.rows.length);
      }
      let hasProjectAuth = false;
      if (evt.project_id) {
        const projCheck = await query(`
          SELECT 1 FROM projects WHERE id = $1 AND manager_id = $2
          UNION
          SELECT 1 FROM project_teams pt
          JOIN teams t ON t.id = pt.team_id
          WHERE pt.project_id = $1 AND t.leader_id = $2;
        `, [evt.project_id, authUser.id]);
        hasProjectAuth = Boolean(projCheck.rows.length);
      }

      if (!isCreator && !hasTeamAuth && !hasProjectAuth) {
        return sendError(res, 403, 'FORBIDDEN', 'You do not have authorization to delete this event');
      }
    }

    if (evt) {
      const recipientIds = new Set();
      const atts = await query(`SELECT user_id FROM calendar_event_attendees WHERE event_id = $1;`, [id]);
      const isCompanyWide = evt.type === 'company_event' || (!evt.project_id && !evt.team_id && !evt.department && atts.rows.length === 0);

      if (isCompanyWide) {
        const allUsers = await query(`SELECT id FROM users WHERE status != 'Inactive';`);
        allUsers.rows.forEach(u => recipientIds.add(u.id));
      } else {
        if (evt.department) {
          const deptUsers = await query(`SELECT id FROM users WHERE department = $1 AND status != 'Inactive';`, [evt.department]);
          deptUsers.rows.forEach(u => recipientIds.add(u.id));
        }
        if (evt.team_id) {
          const teamUsers = await query(`
            SELECT user_id FROM team_members tm
            JOIN users u ON u.id = tm.user_id
            WHERE tm.team_id = $1 AND u.status != 'Inactive'
            UNION
            SELECT leader_id FROM teams WHERE id = $1 AND leader_id IS NOT NULL;
          `, [evt.team_id]);
          teamUsers.rows.forEach(u => recipientIds.add(u.user_id));
        }
        if (evt.project_id) {
          const projUsers = await query(`
            SELECT tm.user_id
            FROM project_teams pt
            JOIN team_members tm ON tm.team_id = pt.team_id
            JOIN users u ON u.id = tm.user_id
            WHERE pt.project_id = $1 AND u.status != 'Inactive'
            UNION
            SELECT manager_id FROM projects WHERE id = $1 AND manager_id IS NOT NULL;
          `, [evt.project_id]);
          projUsers.rows.forEach(u => recipientIds.add(u.user_id));
        }
        atts.rows.forEach(a => recipientIds.add(a.user_id));
      }

      recipientIds.delete(authUser.id);

      for (const recipientId of recipientIds) {
        await query(`
          INSERT INTO notifications (user_id, title, message, type, link)
          VALUES ($1, $2, $3, 'calendar_event', '/calendar');
        `, [
          recipientId,
          `Event Cancelled: ${evt.title}`,
          `The scheduled event "${evt.title}" has been cancelled.`
        ]);
      }
    }

    await query('DELETE FROM calendar_events WHERE id = $1', [id]);
    return sendSuccess(res, { id }, 'Event deleted');
  }
}

// -------------------------------------------------------------
// NOTIFICATIONS HANDLER
// -------------------------------------------------------------
async function handleNotifications(action, payload, authUser, res) {
  if (action === 'list') {
    const result = await query(`SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC;`, [authUser.id]);
    const notifications = result.rows.map(r => ({
      id: r.id, title: r.title, message: r.message, type: r.type, read: r.is_read, link: r.link,
      timestamp: new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));
    return sendSuccess(res, { notifications }, 'Notifications retrieved');
  }

  if (action === 'update') {
    if (payload.markAll) {
      await query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1;`, [authUser.id]);
    } else if (payload.id) {
      await query(`UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2;`, [payload.id, authUser.id]);
    }
    return sendSuccess(res, null, 'Notifications updated');
  }

  if (action === 'delete') {
    await query(`DELETE FROM notifications WHERE id = $1 AND user_id = $2;`, [payload.id, authUser.id]);
    return sendSuccess(res, { id: payload.id }, 'Notification deleted');
  }
}

// -------------------------------------------------------------
// ANNOUNCEMENTS HANDLER
// -------------------------------------------------------------
async function handleAnnouncements(action, payload, authUser, res) {
  if (action === 'list') {
    const result = await query(`
      SELECT a.*, u.name as author_name
      FROM announcements a
      LEFT JOIN users u ON u.id = a.author_id
      ORDER BY a.created_at DESC;
    `);
    const announcements = result.rows.map(r => ({
      id: r.id,
      title: r.title,
      content: r.content,
      tag: r.tag,
      targetDepartment: r.target_department,
      author: r.author_name || 'Admin',
      publishedDate: r.published_date
        ? new Date(r.published_date).toISOString().split('T')[0]
        : new Date(r.created_at).toISOString().split('T')[0]
    }));
    return sendSuccess(res, { announcements }, 'Announcements retrieved');
  }

  if (action === 'create') {
    if (authUser.role !== 'admin') {
      return sendError(res, 403, 'FORBIDDEN', 'Only Admin can publish announcements');
    }
    const { title, content, tag, targetDepartment, clientMutationId } = payload;
    if (!isUuid(clientMutationId)) return sendError(res, 400, 'VALIDATION_ERROR', 'A valid mutation ID is required');
    if (typeof title !== 'string' || !title.trim()) return sendError(res, 400, 'VALIDATION_ERROR', 'Announcement title is required');
    const saved = await transaction(async (client) => {
      const result = await client.query(`
        INSERT INTO announcements (id, title, content, tag, target_department, author_id)
        VALUES ($6, $1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING RETURNING *;
      `, [title.trim(), content || '', tag || 'General', targetDepartment || null, authUser.id, clientMutationId]);
      if (!result.rows[0]) {
        const existing = await client.query('SELECT * FROM announcements WHERE id = $1 AND author_id = $2', [clientMutationId, authUser.id]);
        return { announcement: existing.rows[0], created: false };
      }
      await client.query(`
        INSERT INTO notifications (user_id, title, message, type, link)
        SELECT id, $1, $2, 'announcement', '/messages' FROM users
        WHERE status = 'Active' AND ($4::text IS NULL OR department = $4);
      `, [`Company Announcement: ${title.trim()}`, content || title.trim(), null, targetDepartment]);
      return { announcement: result.rows[0], created: true };
    });
    if (!saved.announcement) return sendError(res, 409, 'IDEMPOTENCY_CONFLICT', 'Mutation ID is already in use');
    return sendSuccess(res, { announcement: saved.announcement }, saved.created ? 'Announcement published' : 'Announcement already published', saved.created ? 201 : 200);
  }

  if (action === 'delete') {
    if (authUser.role !== 'admin') {
      return sendError(res, 403, 'FORBIDDEN', 'Only Admin can delete announcements');
    }
    await query('DELETE FROM announcements WHERE id = $1;', [payload.id]);
    return sendSuccess(res, { id: payload.id }, 'Announcement deleted');
  }
}

// -------------------------------------------------------------
// CONVERSATIONS HANDLER (Neon DB Backend)
// -------------------------------------------------------------
let lastCoreChannelsSync = 0;
const CORE_CHANNELS_SYNC_INTERVAL_MS = 60000;

async function handleConversations(action, payload, authUser, res) {
  const ensureCoreChannels = async (force = false) => {
    const now = Date.now();
    if (!force && (now - lastCoreChannelsSync < CORE_CHANNELS_SYNC_INTERVAL_MS)) {
      return;
    }
    lastCoreChannelsSync = now;
    // Company-wide announcement channel.
    let announcement = await query(`
      SELECT id FROM conversations WHERE type = 'announcements' LIMIT 1;
    `);
    let announcementId = announcement.rows[0]?.id;
    if (!announcementId) {
      announcement = await query(`
        INSERT INTO conversations (name, type, is_read_only)
        VALUES ('Company Announcements', 'announcements', true)
        RETURNING id;
      `);
      announcementId = announcement.rows[0].id;
    }
    await query(`
      INSERT INTO conversation_participants (conversation_id, user_id)
      SELECT $1, id FROM users WHERE status != 'Inactive'
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    `, [announcementId]);

    // One channel per department; membership follows current department assignment.
    const departments = await query(`
      SELECT DISTINCT department FROM users
      WHERE department IS NOT NULL AND department <> '' AND status != 'Inactive';
    `);
    for (const { department } of departments.rows) {
      let room = await query(`
        SELECT id FROM conversations
        WHERE type = 'department' AND department = $1 LIMIT 1;
      `, [department]);
      let roomId = room.rows[0]?.id;
      if (!roomId) {
        room = await query(`
          INSERT INTO conversations (name, type, department, is_read_only)
          VALUES ($1, 'department', $2, false) RETURNING id;
        `, [`${department} — Department Group`, department]);
        roomId = room.rows[0].id;
      }
      await query(`
        INSERT INTO conversation_participants (conversation_id, user_id)
        SELECT $1, id FROM users
        WHERE department = $2 AND status != 'Inactive'
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
      `, [roomId, department]);
    }

    // Ensure project channels exist and sync their assigned team members.
    const projects = await query(`
      SELECT id, name, status, manager_id FROM projects;
    `);
    for (const project of projects.rows) {
      let room = await query(`
        SELECT id FROM conversations
        WHERE type = 'project' AND project_id = $1 LIMIT 1;
      `, [project.id]);
      let roomId = room.rows[0]?.id;
      const readOnly = ['archived', 'completed'].includes(String(project.status || '').toLowerCase());
      if (!roomId) {
        room = await query(`
          INSERT INTO conversations (name, type, project_id, is_read_only)
          VALUES ($1, 'project', $2, $3) RETURNING id;
        `, [`${project.name} — Project Group`, project.id, readOnly]);
        roomId = room.rows[0].id;
      } else {
        await query(`
          UPDATE conversations SET name = $1, is_read_only = $2 WHERE id = $3;
        `, [`${project.name} — Project Group`, readOnly, roomId]);
      }
      if (project.manager_id) {
        await query(`
          INSERT INTO conversation_participants (conversation_id, user_id)
          SELECT $1, id FROM users WHERE id = $2 AND status != 'Inactive'
          ON CONFLICT (conversation_id, user_id) DO NOTHING;
        `, [roomId, project.manager_id]);
      }
      await query(`
        INSERT INTO conversation_participants (conversation_id, user_id)
        SELECT $1, tm.user_id
        FROM project_teams pt
        JOIN team_members tm ON tm.team_id = pt.team_id
        JOIN users u ON u.id = tm.user_id
        WHERE pt.project_id = $2 AND u.status != 'Inactive'
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
      `, [roomId, project.id]);
    }
  };

  if (action === 'list') {
    await ensureCoreChannels();
    // Capture the cursor before reading messages so concurrent sends are picked up by sync.
    const cursorResult = await query('SELECT NOW() AS "syncCursor";');
    const conversationsResult = await query(`
      SELECT c.id, c.name,
        CASE WHEN c.type = 'direct' THEN 'dm' ELSE c.type::text END AS type,
        c.department, c.project_id AS "projectId",
        c.is_read_only AS "isReadOnly", c.created_at AS "createdAt",
        c.last_message AS "lastMessage", c.last_message_at AS "lastMessageAt",
        cp.is_pinned AS pinned, cp.is_muted AS muted,
        cp.last_read_at AS "lastReadAt",
        COALESCE((SELECT json_agg(p.user_id) FROM conversation_participants p
                  WHERE p.conversation_id = c.id), '[]'::json) AS "participantIds"
      FROM conversations c
      JOIN conversation_participants cp
        ON cp.conversation_id = c.id AND cp.user_id = $1
      ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC;
    `, [authUser.id]);

    const conversations = conversationsResult.rows;
    const messages = {};
    if (conversations.length) {
      const ids = conversations.map(conversation => conversation.id);
      // Optimized: limit initial retrieval to most recent 50 messages per conversation to guarantee instant load
      const messageResult = await query(`
        SELECT m.id, m.conversation_id AS "conversationId",
          m.sender_id AS "senderId", COALESCE(u.name, 'Unknown User') AS "senderName",
          m.text, m.reply_to_id AS "replyToId", m.is_edited AS edited,
          m.is_deleted AS deleted, m.title, m.priority,
          m.is_announcement AS "isAnnouncement", m.created_at AS timestamp,
          COALESCE((
            SELECT json_object_agg(reaction.emoji, reaction.user_ids)
            FROM (
              SELECT emoji, json_agg(user_id) AS user_ids
              FROM message_reactions WHERE message_id = m.id GROUP BY emoji
            ) reaction
          ), '{}'::json) AS reactions
        FROM (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at DESC) as rn
          FROM messages
          WHERE conversation_id = ANY($1::uuid[])
        ) m
        LEFT JOIN users u ON u.id = m.sender_id
        WHERE m.rn <= 50
        ORDER BY m.created_at ASC;
      `, [ids]);
      conversations.forEach(conversation => { messages[conversation.id] = []; });
      messageResult.rows.forEach(message => messages[message.conversationId].push(message));
    }
    return sendSuccess(res, { conversations, messages, syncCursor: cursorResult.rows[0].syncCursor }, 'Conversations retrieved');
  }

  // Incremental sync: only conversation metadata and messages changed since cursor.
  if (action === 'sync') {
    const since = payload.since && !Number.isNaN(Date.parse(payload.since))
      ? new Date(payload.since)
      : new Date(0);

    const cursorResult = await query('SELECT NOW() AS "syncCursor";');
    const conversationsResult = await query(`
      SELECT c.id, c.name,
        CASE WHEN c.type = 'direct' THEN 'dm' ELSE c.type::text END AS type,
        c.department, c.project_id AS "projectId",
        c.is_read_only AS "isReadOnly", c.created_at AS "createdAt",
        c.last_message AS "lastMessage", c.last_message_at AS "lastMessageAt",
        cp.is_pinned AS pinned, cp.is_muted AS muted,
        cp.last_read_at AS "lastReadAt",
        COALESCE((SELECT json_agg(p.user_id) FROM conversation_participants p
                  WHERE p.conversation_id = c.id), '[]'::json) AS "participantIds"
      FROM conversations c
      JOIN conversation_participants cp
        ON cp.conversation_id = c.id AND cp.user_id = $1
      WHERE c.created_at > $2 OR c.last_message_at > $2
      ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC;
    `, [authUser.id, since]);

    const changedResult = await query(`
      SELECT m.id, m.conversation_id AS "conversationId",
        m.sender_id AS "senderId", COALESCE(u.name, 'Unknown User') AS "senderName",
        m.text, m.reply_to_id AS "replyToId", m.is_edited AS edited,
        m.is_deleted AS deleted, m.title, m.priority,
        m.is_announcement AS "isAnnouncement", m.created_at AS timestamp,
        m.updated_at AS "updatedAt",
        COALESCE((
          SELECT json_object_agg(reaction.emoji, reaction.user_ids)
          FROM (
            SELECT emoji, json_agg(user_id) AS user_ids
            FROM message_reactions WHERE message_id = m.id GROUP BY emoji
          ) reaction
        ), '{}'::json) AS reactions
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.updated_at > $1
        AND EXISTS (
          SELECT 1 FROM conversation_participants cp
          WHERE cp.conversation_id = m.conversation_id AND cp.user_id = $2
        )
      ORDER BY m.created_at ASC;
    `, [since, authUser.id]);
    const changedMessages = changedResult.rows;

    return sendSuccess(res, {
      conversations: conversationsResult.rows,
      messages: changedMessages,
      syncCursor: cursorResult.rows[0].syncCursor,
    }, 'Messaging updates retrieved');
  }

  if (action === 'create') {
    const { conversationId, text, replyToId = null, title = null, priority = 'normal', clientMutationId } = payload;
    if (!conversationId || (!text?.trim() && !title?.trim())) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Conversation and message content are required');
    }
    if (!isUuid(clientMutationId)) return sendError(res, 400, 'VALIDATION_ERROR', 'A valid mutation ID is required');
    const [conversationResult, membership, reply] = await Promise.all([
      query(`SELECT id, type, is_read_only FROM conversations WHERE id = $1;`, [conversationId]),
      query(`SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2;`, [conversationId, authUser.id]),
      replyToId
        ? query(`SELECT id FROM messages WHERE id = $1 AND conversation_id = $2 AND is_deleted = false;`, [replyToId, conversationId])
        : Promise.resolve({ rows: [{ id: null }] }),
    ]);
    const conversation = conversationResult.rows[0];
    if (!conversation) return sendError(res, 404, 'NOT_FOUND', 'Conversation not found');
    if (conversation.is_read_only && !(conversation.type === 'announcements' && authUser.role === 'admin')) {
      return sendError(res, 403, 'FORBIDDEN', 'This conversation is read-only');
    }
    if (conversation.type === 'announcements' && authUser.role !== 'admin') {
      return sendError(res, 403, 'FORBIDDEN', 'Only administrators can publish announcements');
    }
    if (!membership.rows.length && authUser.role !== 'admin') {
      return sendError(res, 403, 'FORBIDDEN', 'You are not a participant in this conversation');
    }
    if (replyToId && !reply.rows.length) {
      return sendError(res, 400, 'INVALID_REPLY', 'Reply target is invalid');
    }
    const announcement = conversation.type === 'announcements';
    const validPriority = ['normal', 'important', 'urgent'].includes(priority) ? priority : 'normal';
    const message = await transaction(async (client) => {
      const inserted = await client.query(`
        INSERT INTO messages (
          id, conversation_id, sender_id, text, reply_to_id, title, priority, is_announcement
        ) VALUES ($8, $1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
        RETURNING id, conversation_id AS "conversationId", sender_id AS "senderId",
          text, reply_to_id AS "replyToId", is_edited AS edited, is_deleted AS deleted,
          title, priority, is_announcement AS "isAnnouncement", created_at AS timestamp;
      `, [conversationId, authUser.id, text || '', replyToId, announcement ? title : null, validPriority, announcement, clientMutationId]);
      const wasInserted = Boolean(inserted.rows[0]);
      const existing = wasInserted ? inserted : await client.query(`
        SELECT id, conversation_id AS "conversationId", sender_id AS "senderId", text,
          reply_to_id AS "replyToId", is_edited AS edited, is_deleted AS deleted,
          title, priority, is_announcement AS "isAnnouncement", created_at AS timestamp
        FROM messages WHERE id = $1 AND sender_id = $2 AND conversation_id = $3;
      `, [clientMutationId, authUser.id, conversationId]);
      const savedMessage = existing.rows[0];
      if (!savedMessage) return null;
      if (!wasInserted) return savedMessage;
      await client.query(`
        UPDATE conversations SET last_message = $1, last_message_at = CURRENT_TIMESTAMP WHERE id = $2;
      `, [(title || text || '').slice(0, 200), conversationId]);
      if (announcement) {
        await client.query(`
          INSERT INTO notifications (user_id, title, message, type, link)
          SELECT cp.user_id, $3, $4, 'announcement'::notification_type, '/messages'
          FROM conversation_participants cp
          WHERE cp.conversation_id = $1 AND cp.user_id <> $2 AND cp.is_muted = false
          ON CONFLICT DO NOTHING;
        `, [conversationId, authUser.id, 'New Company Announcement', (title || text || '').slice(0, 200)]);
      }
      return savedMessage;
    });
    if (!message) return sendError(res, 409, 'IDEMPOTENCY_CONFLICT', 'Mutation ID is already in use');
    message.senderName = authUser.name;
    message.reactions = {};

    return sendSuccess(res, { message }, 'Message sent', 201);
  }

  if (action === 'edit') {
    const { messageId, text } = payload;
    if (!messageId || !text?.trim()) return sendError(res, 400, 'VALIDATION_ERROR', 'Message ID and text are required');

    // 1. Fetch the target message
    const targetRes = await query(`
      SELECT id, conversation_id, sender_id, created_at, is_deleted
      FROM messages
      WHERE id = $1;
    `, [messageId]);

    if (!targetRes.rows.length) {
      return sendError(res, 404, 'NOT_FOUND', 'Message not found');
    }

    const msg = targetRes.rows[0];

    // 2. Must belong to the currently authenticated user
    if (msg.sender_id !== authUser.id) {
      return sendError(res, 403, 'FORBIDDEN', 'You can only edit your own messages');
    }

    // 3. Cannot edit deleted messages
    if (msg.is_deleted) {
      return sendError(res, 400, 'INVALID_STATE', 'Cannot edit a deleted message');
    }

    // 4. Must be within the 10-minute window of original creation
    const messageAgeMs = Date.now() - new Date(msg.created_at).getTime();
    const tenMinutesMs = 10 * 60 * 1000;
    if (messageAgeMs > tenMinutesMs) {
      return sendError(res, 403, 'TIME_LIMIT_EXCEEDED', 'Messages can only be edited within 10 minutes of sending');
    }

    // 5. Must be the user's most recent message in this conversation
    const newerRes = await query(`
      SELECT id FROM messages
      WHERE conversation_id = $1 AND sender_id = $2 AND created_at > $3 AND is_deleted = false
      LIMIT 1;
    `, [msg.conversation_id, authUser.id, msg.created_at]);

    if (newerRes.rows.length > 0) {
      return sendError(res, 403, 'NOT_LATEST_MESSAGE', 'Only your most recent message in this conversation can be edited');
    }

    // 6. User must still be an authorized participant
    const partRes = await query(`
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = $1 AND user_id = $2;
    `, [msg.conversation_id, authUser.id]);

    if (!partRes.rows.length && authUser.role !== 'admin') {
      return sendError(res, 403, 'FORBIDDEN', 'You are not a participant in this conversation');
    }

    // 7. Update content preserving sender, conversation, and original created_at
    const result = await query(`
      UPDATE messages
      SET text = $1, is_edited = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, text, is_edited AS edited, updated_at;
    `, [text.trim(), messageId]);

    return sendSuccess(res, { message: result.rows[0] }, 'Message edited');
  }

  if (action === 'delete') {
    return sendError(res, 403, 'FORBIDDEN', 'Message deletion is disabled');
  }

  if (action === 'react') {
    const { messageId, emoji } = payload;
    if (!messageId || !emoji || emoji.length > 20) return sendError(res, 400, 'VALIDATION_ERROR', 'Valid message ID and emoji are required');
    const allowed = await query(`
      SELECT m.id FROM messages m
      JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = $1 AND cp.user_id = $2 AND m.is_deleted = false;
    `, [messageId, authUser.id]);
    if (!allowed.rows.length) return sendError(res, 403, 'FORBIDDEN', 'Cannot react to this message');
    const removed = await query(`
      DELETE FROM message_reactions
      WHERE message_id = $1 AND user_id = $2 AND emoji = $3 RETURNING message_id;
    `, [messageId, authUser.id, emoji]);
    if (!removed.rows.length) {
      await query(`
        INSERT INTO message_reactions (message_id, user_id, emoji)
        VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;
      `, [messageId, authUser.id, emoji]);
    }
    await query(`UPDATE messages SET updated_at = CURRENT_TIMESTAMP WHERE id = $1;`, [messageId]);
    return sendSuccess(res, { messageId, emoji }, 'Reaction updated');
  }

  if (action === 'start-dm') {
    const { targetUserId } = payload;
    if (!targetUserId || targetUserId === authUser.id) return sendError(res, 400, 'VALIDATION_ERROR', 'A different target user is required');
    const target = await query(`
      SELECT id, name FROM users WHERE id = $1 AND status != 'Inactive';
    `, [targetUserId]);
    if (!target.rows[0]) return sendError(res, 404, 'NOT_FOUND', 'User not found or inactive');
    const result = await transaction(async (client) => {
      const pairKey = [authUser.id, targetUserId].sort().join(':');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0));', [pairKey]);
      const existing = await client.query(`
        SELECT c.id FROM conversations c
        JOIN conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = $1
        JOIN conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = $2
        WHERE c.type = 'direct'
          AND (SELECT COUNT(*) FROM conversation_participants p WHERE p.conversation_id = c.id) = 2
        LIMIT 1;
      `, [authUser.id, targetUserId]);
      if (existing.rows[0]) return { conversationId: existing.rows[0].id, created: false };
      const created = await client.query(`
        INSERT INTO conversations (name, type) VALUES ($1, 'direct') RETURNING id;
      `, [`DM with ${target.rows[0].name}`]);
      const conversationId = created.rows[0].id;
      await client.query(`
        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES ($1, $2), ($1, $3) ON CONFLICT (conversation_id, user_id) DO NOTHING;
      `, [conversationId, authUser.id, targetUserId]);
      return { conversationId, created: true };
    });
    return sendSuccess(res, { conversationId: result.conversationId }, result.created ? 'Direct conversation created' : 'Direct conversation exists', result.created ? 201 : 200);
  }

  if (action === 'update-settings') {
    const { conversationId, pinned, muted, markRead } = payload;
    if (!conversationId) return sendError(res, 400, 'VALIDATION_ERROR', 'Conversation ID is required');

    let member = await query(`
      SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2;
    `, [conversationId, authUser.id]);

    if (!member.rows.length) {
      return sendError(res, 403, 'FORBIDDEN', 'You are not a participant in this conversation');
    }

    await query(`
      UPDATE conversation_participants
      SET is_pinned = COALESCE($1, is_pinned),
          is_muted = COALESCE($2, is_muted),
          last_read_at = CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE last_read_at END
      WHERE conversation_id = $4 AND user_id = $5;
    `, [pinned ?? null, muted ?? null, Boolean(markRead), conversationId, authUser.id]);
    return sendSuccess(res, { conversationId }, 'Conversation settings updated');
  }

  return sendError(res, 400, 'UNKNOWN_ACTION', 'Unsupported conversation action');
}

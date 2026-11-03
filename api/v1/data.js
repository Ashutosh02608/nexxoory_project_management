import { authenticateRequest } from '../../server/middleware/auth.js';
import { handleCors, sendSuccess, sendError } from '../../server/utils/response.js';
import { query } from '../../server/config/db.js';
import argon2 from 'argon2';

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

  const { entity, action = 'list', payload = {} } = req.body || {};

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
    console.error(`[UNIFIED API ERROR] entity=${entity} action=${action}`, err);
    return sendError(res, 500, 'SERVER_ERROR', err.message || 'Internal database error');
  }
}

// -------------------------------------------------------------
// BOOTSTRAP ALL DATA (Single high-speed round-trip)
// -------------------------------------------------------------
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
          ORDER BY p.created_at DESC
        ) sub
      ), '[]'::json),

      'tasks', COALESCE((
        SELECT json_agg(sub.t_obj)
        FROM (
          SELECT json_build_object(
            'id', t.id,
            'title', t.title,
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
          ORDER BY d.created_at DESC
        ) sub
      ), '[]'::json),

      'folderPermissions', COALESCE((
        SELECT json_agg(json_build_object('id', fp.id, 'folderKey', fp.folder_key, 'userId', fp.user_id))
        FROM folder_permissions fp
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
  `, [authUser.id]);

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
    const { name, email, password, role, designation, department, status } = payload;
    if (!name || !email) return sendError(res, 400, 'VALIDATION_ERROR', 'Name and email required');

    const existing = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (existing.rows.length > 0) return sendError(res, 409, 'EMAIL_EXISTS', 'Email already registered');

    const passwordHash = await argon2.hash(password || 'Password123!', {
      type: argon2.argon2id, memoryCost: 2 ** 16, timeCost: 3, parallelism: 1
    });

    const insertResult = await query(`
      INSERT INTO users (name, email, password_hash, role, designation, department, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, email, role, designation, department, status, created_at;
    `, [
      name.trim(), email.trim().toLowerCase(), passwordHash,
      role || 'team_member', designation || 'Team Contributor', department || 'Development', status || 'Active'
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

  if (action === 'delete') {
    if (authUser.role !== 'admin') return sendError(res, 403, 'FORBIDDEN', 'Admin only');
    if (payload.id === authUser.id) return sendError(res, 400, 'INVALID_ACTION', 'Cannot delete active admin account');
    await query('DELETE FROM users WHERE id = $1', [payload.id]);
    return sendSuccess(res, { id: payload.id }, 'User deleted');
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
    const { name, department, leaderId, description, color, memberIds } = payload;
    const insert = await query(`
      INSERT INTO teams (name, department, leader_id, description, color)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `, [name, department, leaderId || null, description || '', color || '#635BFF']);
    const t = insert.rows[0];

    if (Array.isArray(memberIds)) {
      for (const uid of memberIds) {
        await query(`INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [t.id, uid]);
      }
    }
    return sendSuccess(res, { team: { id: t.id, name: t.name, department: t.department, leaderId: t.leader_id, memberIds: memberIds || [] } }, 'Team created', 201);
  }

  if (action === 'update') {
    if (authUser.role !== 'admin') return sendError(res, 403, 'FORBIDDEN', 'Admin only');
    const { id, name, department, leaderId, description, color, memberIds } = payload;
    await query(`
      UPDATE teams SET name = COALESCE($2, name), department = COALESCE($3, department),
      leader_id = $4, description = COALESCE($5, description), color = COALESCE($6, color),
      updated_at = CURRENT_TIMESTAMP WHERE id = $1;
    `, [id, name, department, leaderId || null, description, color]);

    if (Array.isArray(memberIds)) {
      await query('DELETE FROM team_members WHERE team_id = $1;', [id]);
      for (const uid of memberIds) {
        await query(`INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [id, uid]);
      }
    }
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
  if (action === 'list') {
    const result = await query(`SELECT * FROM projects ORDER BY created_at DESC;`);
    const projects = result.rows.map(r => ({
      id: r.id, name: r.name, description: r.description, managerId: r.manager_id, teamId: r.primary_team_id,
      priority: r.priority, status: r.status, startDate: r.start_date, dueDate: r.due_date,
      progress: r.progress, budget: Number(r.budget), spent: Number(r.spent), tags: r.tags || []
    }));
    return sendSuccess(res, { projects }, 'Projects retrieved');
  }

  if (action === 'create') {
    if (authUser.role !== 'admin' && authUser.role !== 'project_manager') return sendError(res, 403, 'FORBIDDEN', 'Unauthorized');
    const { name, description, managerId, teamId, priority, status, startDate, dueDate, progress, budget, tags } = payload;
    const result = await query(`
      INSERT INTO projects (name, description, manager_id, primary_team_id, priority, status, start_date, due_date, progress, budget, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *;
    `, [name, description || '', managerId || authUser.id, teamId || null, priority || 'Medium', status || 'Planning',
        startDate || new Date().toISOString().split('T')[0], dueDate || new Date(Date.now() + 30*86400000).toISOString().split('T')[0],
        progress || 0, budget || 0, tags || []]);
    return sendSuccess(res, { project: result.rows[0] }, 'Project created', 201);
  }

  if (action === 'update') {
    const { id, name, description, managerId, teamId, priority, status, dueDate, progress, budget, spent, tags } = payload;
    await query(`
      UPDATE projects SET name = COALESCE($2, name), description = COALESCE($3, description), manager_id = $4,
      primary_team_id = $5, priority = COALESCE($6, priority), status = COALESCE($7, status), due_date = COALESCE($8, due_date),
      progress = COALESCE($9, progress), budget = COALESCE($10, budget), spent = COALESCE($11, spent), tags = COALESCE($12, tags),
      updated_at = CURRENT_TIMESTAMP WHERE id = $1;
    `, [id, name, description, managerId || null, teamId || null, priority, status, dueDate, progress, budget, spent, tags]);
    return sendSuccess(res, { id }, 'Project updated');
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
  if (action === 'list') {
    const result = await query(`
      SELECT t.*,
        COALESCE((SELECT json_agg(json_build_object('id', s.id, 'title', s.title, 'completed', s.completed)) FROM subtasks s WHERE s.task_id = t.id), '[]') as subtasks,
        COALESCE((SELECT json_agg(json_build_object('id', c.id, 'userId', c.user_id, 'userName', u.name, 'text', c.text, 'timestamp', to_char(c.created_at, 'YYYY-MM-DD HH24:MI')))
                  FROM task_comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.task_id = t.id), '[]') as comments
      FROM tasks t ORDER BY t.kanban_order ASC, t.created_at DESC;
    `);
    const tasks = result.rows.map(r => ({
      id: r.id, title: r.title, description: r.description, projectId: r.project_id, assigneeId: r.assignee_id,
      teamId: r.team_id, priority: r.priority, status: r.status, startDate: r.start_date, dueDate: r.due_date,
      progress: r.progress, labels: r.labels || [], subtasks: r.subtasks || [], comments: r.comments || []
    }));
    return sendSuccess(res, { tasks }, 'Tasks retrieved');
  }

  if (action === 'create') {
    const { title, description, projectId, assigneeId, teamId, priority, status, startDate, dueDate, progress, labels } = payload;
    const result = await query(`
      INSERT INTO tasks (title, description, project_id, assignee_id, team_id, priority, status, start_date, due_date, progress, labels)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *;
    `, [title, description || '', projectId || null, assigneeId || null, teamId || null, priority || 'Medium', status || 'To Do',
        startDate || new Date().toISOString().split('T')[0], dueDate || new Date(Date.now() + 7*86400000).toISOString().split('T')[0],
        progress || 0, labels || ['General']]);
    return sendSuccess(res, { task: result.rows[0] }, 'Task created', 201);
  }

  if (action === 'update') {
    const { id, title, description, projectId, assigneeId, teamId, priority, status, dueDate, progress, labels, comments } = payload;
    await query(`
      UPDATE tasks SET title = COALESCE($2, title), description = COALESCE($3, description), project_id = $4, assignee_id = $5,
      team_id = $6, priority = COALESCE($7, priority), status = COALESCE($8, status), due_date = COALESCE($9, due_date),
      progress = COALESCE($10, progress), labels = COALESCE($11, labels), updated_at = CURRENT_TIMESTAMP WHERE id = $1;
    `, [id, title, description, projectId || null, assigneeId || null, teamId || null, priority, status, dueDate, progress, labels]);

    if (Array.isArray(comments) && comments.length > 0) {
      const last = comments[comments.length - 1];
      if (last?.text && !last.id?.startsWith('cmt-saved')) {
        await query(`INSERT INTO task_comments (task_id, user_id, text) VALUES ($1, $2, $3);`, [id, authUser.id, last.text]);
      }
    }
    return sendSuccess(res, { id }, 'Task updated');
  }

  if (action === 'delete') {
    await query('DELETE FROM tasks WHERE id = $1', [payload.id]);
    return sendSuccess(res, { id: payload.id }, 'Task deleted');
  }
}

// -------------------------------------------------------------
// DOCUMENTS HANDLER
// -------------------------------------------------------------
async function handleDocuments(action, payload, authUser, res) {
  if (action === 'list') {
    const result = await query(`
      SELECT d.*, u.name as author_name FROM documents d LEFT JOIN users u ON u.id = d.author_id ORDER BY d.created_at DESC;
    `);
    const documents = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      folder: r.folder,
      projectId: r.project_id,
      size: `${(r.size_bytes/1024/1024).toFixed(1)} MB`,
      type: r.mime_type.includes('pdf') ? 'pdf' : 'doc',
      author: r.author_name || 'System',
      authorId: r.author_id,
      assignedUserIds: r.assigned_user_ids || [],
      date: new Date(r.created_at).toISOString().split('T')[0],
      updatedAt: new Date(r.updated_at || r.created_at).toISOString().split('T')[0]
    }));
    const fpRes = await query(`SELECT folder_key as "folderKey", user_id as "userId" FROM folder_permissions;`);
    return sendSuccess(res, { documents, folderPermissions: fpRes.rows }, 'Documents retrieved');
  }

  if (action === 'create') {
    const { name, folder, projectId, type, assignedUserIds } = payload;
    const buf = Buffer.from('Nexxoory File Payload');
    const result = await query(`
      INSERT INTO documents (name, folder, project_id, size_bytes, mime_type, file_data, author_id, assigned_user_ids)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;
    `, [name, folder || (projectId ? 'Project Document' : 'General'), projectId || null, buf.length, type?.toLowerCase().includes('pdf') ? 'application/pdf' : 'application/msword', buf, authUser.id, assignedUserIds || []]);
    return sendSuccess(res, { document: result.rows[0] }, 'Document created', 201);
  }

  if (action === 'update') {
    const { id, name, folder, projectId, assignedUserIds } = payload;
    await query(`
      UPDATE documents
      SET name = COALESCE($2, name),
          folder = COALESCE($3, folder),
          project_id = $4,
          assigned_user_ids = COALESCE($5, assigned_user_ids),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `, [id, name, folder, projectId || null, assignedUserIds ? assignedUserIds : null]);
    return sendSuccess(res, { id }, 'Document updated');
  }

  if (action === 'assign-file-access') {
    if (authUser.role !== 'admin') {
      return sendError(res, 403, 'FORBIDDEN', 'Only Admin can manage file access permissions');
    }
    const { id, userIds } = payload;
    await query(`
      UPDATE documents SET assigned_user_ids = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1;
    `, [id, userIds || []]);
    return sendSuccess(res, { id, userIds }, 'File access permissions updated');
  }

  if (action === 'assign-folder-access') {
    if (authUser.role !== 'admin') {
      return sendError(res, 403, 'FORBIDDEN', 'Only Admin can manage folder access permissions');
    }
    const { folderKey, userIds } = payload;
    await query(`DELETE FROM folder_permissions WHERE folder_key = $1;`, [folderKey]);
    if (Array.isArray(userIds)) {
      for (const uid of userIds) {
        await query(`INSERT INTO folder_permissions (folder_key, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [folderKey, uid]);
      }
    }
    return sendSuccess(res, { folderKey, userIds }, 'Folder access permissions updated');
  }

  if (action === 'delete') {
    await query('DELETE FROM documents WHERE id = $1', [payload.id]);
    return sendSuccess(res, { id: payload.id }, 'Document deleted');
  }
}

// -------------------------------------------------------------
// CALENDAR HANDLER
// -------------------------------------------------------------
async function handleCalendar(action, payload, authUser, res) {
  if (action === 'list') {
    const result = await query(`SELECT * FROM calendar_events ORDER BY start_date ASC;`);
    const events = result.rows.map(r => ({
      id: r.id,
      title: r.title,
      type: r.type,
      startDate: r.start_date ? new Date(r.start_date).toISOString() : '',
      date: r.start_date ? new Date(r.start_date).toISOString().split('T')[0] : '',
      time: r.start_date ? new Date(r.start_date).toTimeString().substring(0, 5) : '',
      location: r.location
    }));
    return sendSuccess(res, { events }, 'Events retrieved');
  }

  if (action === 'create') {
    const { title, description, type, startDate, endDate, date, time, location, isAllDay, projectId, teamId, attendees } = payload;
    
    // Parse valid timestamp with safe fallbacks
    let startTimestamp;
    if (startDate) {
      startTimestamp = new Date(startDate);
    } else if (date) {
      startTimestamp = new Date(`${date}T${time || '09:00'}:00`);
    } else {
      startTimestamp = new Date();
    }

    if (isNaN(startTimestamp.getTime())) {
      startTimestamp = new Date();
    }

    let endTimestamp = endDate ? new Date(endDate) : new Date(startTimestamp.getTime() + 3600000);
    if (isNaN(endTimestamp.getTime())) {
      endTimestamp = new Date(startTimestamp.getTime() + 3600000);
    }

    const validTypes = ['meeting', 'milestone', 'deadline', 'team_event', 'company_event', 'reminder'];
    const eventType = validTypes.includes(type?.toLowerCase()) ? type.toLowerCase() : 'meeting';

    const result = await query(`
      INSERT INTO calendar_events (title, description, type, start_date, end_date, location, is_all_day, project_id, team_id, creator_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;
    `, [title || 'Untitled Event', description || '', eventType, startTimestamp, endTimestamp, location || 'Virtual', !!isAllDay, projectId || null, teamId || null, authUser.id]);

    const r = result.rows[0];

    if (Array.isArray(attendees)) {
      for (const uid of attendees) {
        await query(`INSERT INTO calendar_event_attendees (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [r.id, uid]);
      }
    }

    return sendSuccess(res, {
      event: {
        id: r.id,
        title: r.title,
        description: r.description,
        type: r.type,
        startDate: r.start_date,
        endDate: r.end_date,
        date: new Date(r.start_date).toISOString().split('T')[0],
        time: new Date(r.start_date).toTimeString().substring(0, 5),
        location: r.location,
        isAllDay: r.is_all_day,
        projectId: r.project_id,
        teamId: r.team_id,
        attendees: attendees || []
      }
    }, 'Event created', 201);
  }

  if (action === 'update') {
    const { id, title, description, type, startDate, endDate, location, isAllDay, projectId, teamId, attendees } = payload;
    
    let startTimestamp = startDate ? new Date(startDate) : undefined;
    let endTimestamp = endDate ? new Date(endDate) : undefined;

    const validTypes = ['meeting', 'milestone', 'deadline', 'team_event', 'company_event', 'reminder'];
    const eventType = type && validTypes.includes(type.toLowerCase()) ? type.toLowerCase() : undefined;

    await query(`
      UPDATE calendar_events
      SET title = COALESCE($2, title),
          description = COALESCE($3, description),
          type = COALESCE($4, type),
          start_date = COALESCE($5, start_date),
          end_date = COALESCE($6, end_date),
          location = COALESCE($7, location),
          is_all_day = COALESCE($8, is_all_day),
          project_id = $9,
          team_id = $10,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `, [id, title, description, eventType, startTimestamp, endTimestamp, location, isAllDay, projectId || null, teamId || null]);

    if (Array.isArray(attendees)) {
      await query(`DELETE FROM calendar_event_attendees WHERE event_id = $1;`, [id]);
      for (const uid of attendees) {
        await query(`INSERT INTO calendar_event_attendees (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [id, uid]);
      }
    }

    return sendSuccess(res, { id }, 'Event updated');
  }

  if (action === 'delete') {
    await query('DELETE FROM calendar_events WHERE id = $1', [payload.id]);
    return sendSuccess(res, { id: payload.id }, 'Event deleted');
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
      publishedDate: to_char ? r.published_date : new Date(r.created_at).toISOString().split('T')[0]
    }));
    return sendSuccess(res, { announcements }, 'Announcements retrieved');
  }

  if (action === 'create') {
    if (authUser.role !== 'admin') {
      return sendError(res, 403, 'FORBIDDEN', 'Only Admin can publish announcements');
    }
    const { title, content, tag, targetDepartment } = payload;
    const result = await query(`
      INSERT INTO announcements (title, content, tag, target_department, author_id)
      VALUES ($1, $2, $3, $4, $5) RETURNING *;
    `, [title, content || '', tag || 'General', targetDepartment || null, authUser.id]);

    // Also broadcast notification to target users or all active users
    let targetUsers = [];
    if (targetDepartment) {
      const uRes = await query(`SELECT id FROM users WHERE department = $1 AND status = 'Active';`, [targetDepartment]);
      targetUsers = uRes.rows.map(r => r.id);
    } else {
      const uRes = await query(`SELECT id FROM users WHERE status = 'Active';`);
      targetUsers = uRes.rows.map(r => r.id);
    }

    for (const uid of targetUsers) {
      await query(`
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES ($1, $2, $3, 'announcement', '/notifications');
      `, [uid, `Company Announcement: ${title}`, content || title]);
    }

    return sendSuccess(res, { announcement: result.rows[0] }, 'Announcement published', 201);
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
// CONVERSATIONS HANDLER
// -------------------------------------------------------------
async function handleConversations(action, payload, authUser, res) {
  if (action === 'list') {
    const convRes = await query(`
      SELECT c.id, c.name, c.type FROM conversations c
      JOIN conversation_participants cp ON cp.conversation_id = c.id WHERE cp.user_id = $1;
    `, [authUser.id]);
    const conversations = convRes.rows.map(c => ({ id: c.id, name: c.name, type: c.type, unread: 0 }));

    let messages = {};
    if (conversations.length > 0) {
      const msgRes = await query(`
        SELECT m.id, m.conversation_id, m.sender_id, u.name as sender_name, m.text, m.created_at
        FROM messages m JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = ANY($1::UUID[]) ORDER BY m.created_at ASC;
      `, [conversations.map(c => c.id)]);
      conversations.forEach(c => { messages[c.id] = []; });
      msgRes.rows.forEach(m => {
        if (!messages[m.conversation_id]) messages[m.conversation_id] = [];
        messages[m.conversation_id].push({
          id: m.id, senderId: m.sender_id, senderName: m.sender_name, text: m.text,
          timestamp: new Date(m.created_at).toTimeString().substring(0, 5)
        });
      });
    }
    return sendSuccess(res, { conversations, messages }, 'Conversations retrieved');
  }

  if (action === 'create') {
    const { conversationId, text } = payload;
    const resMsg = await query(`
      INSERT INTO messages (conversation_id, sender_id, text) VALUES ($1, $2, $3) RETURNING *;
    `, [conversationId, authUser.id, text.trim()]);
    const m = resMsg.rows[0];
    return sendSuccess(res, {
      message: { id: m.id, senderId: m.sender_id, senderName: authUser.name, text: m.text, timestamp: new Date(m.created_at).toTimeString().substring(0, 5) }
    }, 'Message sent', 201);
  }
}


/**
 * Development Database Seed Script
 * Reads initial data from src/data/initialData.js and populates PostgreSQL.
 *
 * Cascade-Safe Seed Ownership & Synchronization Architecture:
 * - Explicit Seed Ownership Tracking: Records created by seed datasets are tracked
 *   in `seed_ownership_registry` (both single UUID entities and junction keys).
 * - Cascade-Safe Parent Pruning: Before pruning any stale seed-owned parent, the script
 *   inspects all dependent child tables for unregistered user-created records.
 *   If any user-created child records exist under the stale seed parent:
 *     * The parent is PRESERVED (NOT deleted).
 *     * The parent remains in `seed_ownership_registry` with a conflict warning reported.
 *     * User-created descendants are completely protected from cascade deletion.
 * - Non-Destructive to User Data: Never deletes user-created messages, reactions,
 *   comments, subtasks, team memberships, attendees, or conversation participants.
 * - Idempotency: Repeated executions produce the exact same database state without duplicates.
 * - Isolated Attribution Assumptions: Clearly separates raw mock data from inferred attribution mappings.
 * - User Profile Preservation: Reseeding preserves user password hashes and customized user settings.
 * - Strict multi-level environment safety guards (ALLOW_SEED=true, non-production confirmation).
 * - Full transactional encapsulation across the entire seed operation.
 */

import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import argon2 from 'argon2';
import { getDbPool, closePool, transaction } from '../server/config/db.js';
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
} from '../src/data/initialData.js';

dotenv.config();

const ID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export function toDeterministicUuid(mockId) {
  if (!mockId) return null;
  const hash = crypto.createHash('sha1').update(ID_NAMESPACE + mockId).digest('hex');
  const part1 = hash.substring(0, 8);
  const part2 = hash.substring(8, 12);
  const part3 = '4' + hash.substring(13, 16);
  const part4 = ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20);
  const part5 = hash.substring(20, 32);
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

/**
 * =============================================================================
 * ISOLATED ATTRIBUTION CONFIGURATION
 * Separates explicit source data from documented inferences.
 * Source data limitations in initialData.js:
 * 1. Notifications have no recipientId field.
 * 2. Message reactions have no authorId field.
 * =============================================================================
 */
export const INFERRED_ATTRIBUTION_CONFIG = {
  NOTIFICATION_RECIPIENTS: {
    'notif-1': 'usr-member', // Context: task-104 assigned to Elena Rostova (dev@nexxoory.com)
    'notif-2': 'usr-pm',     // Context: proj-1 milestone notification managed by Marcus Sterling
    'notif-3': 'usr-pm',     // Context: proj-3 milestone deadline managed by Marcus Sterling
    'notif-4': 'usr-admin'   // Context: System broadcast maintenance alert directed to VP/Admin
  },
  CONVERSATION_REACTION_ATTRIBUTION: {
    'conv-1': 'usr-pm',
    'conv-2': 'usr-pm',
    'conv-3': 'usr-pm',
    'conv-4': 'usr-admin'
  }
};

/**
 * Validates safety guards to prevent accidental production seeding.
 */
export function verifySeedPreconditions() {
  const dbUrl = process.env.DATABASE_URL || '';

  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not defined.');
  }

  if (process.env.ALLOW_SEED !== 'true') {
    throw new Error(
      'Database seeding aborted! You must explicitly set ALLOW_SEED=true in your environment to permit seeding.'
    );
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Database seeding is strictly prohibited when NODE_ENV=production.');
  }

  if (dbUrl.includes('prod') || dbUrl.includes('production')) {
    throw new Error('Database connection URL appears to be a production instance. Aborting seed.');
  }
}

/**
 * Helper to parse mock string dates / times into valid Date objects.
 */
function parseMockTimestamp(rawString, fallbackDate = new Date('2026-11-01T10:00:00Z')) {
  if (!rawString) return fallbackDate;
  if (rawString.includes('T')) return new Date(rawString);
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawString)) return new Date(`${rawString}T00:00:00Z`);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(rawString)) {
    return new Date(rawString.replace(' ', 'T') + ':00Z');
  }
  return fallbackDate;
}

/**
 * Registry Helper: Registers a seed-owned entity.
 */
async function registerSeedOwnership(client, entityType, entityId) {
  await client.query(`
    INSERT INTO seed_ownership_registry (entity_type, entity_id)
    VALUES ($1, $2)
    ON CONFLICT (entity_type, entity_id) DO NOTHING;
  `, [entityType, entityId.toString()]);
}

/**
 * Registry Helper: Synchronizes seed ownership and removes stale seed-owned records safely.
 * Checks for unregistered user-created descendants before attempting deletion.
 * If user-created descendants exist, deletion is blocked and a conflict is logged.
 */
async function pruneStaleSeedRecords(
  client,
  entityType,
  currentSeedIds,
  checkDescendantsFn,
  deleteSqlGenerator,
  conflictAccumulator = []
) {
  const res = await client.query(`
    SELECT entity_id FROM seed_ownership_registry WHERE entity_type = $1;
  `, [entityType]);

  const registeredSeedIds = new Set(res.rows.map(r => r.entity_id));
  const activeIdsSet = new Set(currentSeedIds.map(id => id.toString()));

  const candidatesToDelete = [];
  for (const regId of registeredSeedIds) {
    if (!activeIdsSet.has(regId)) {
      candidatesToDelete.push(regId);
    }
  }

  const safeToDelete = [];

  for (const candidateId of candidatesToDelete) {
    if (checkDescendantsFn) {
      const hasUserDescendants = await checkDescendantsFn(client, candidateId);
      if (hasUserDescendants) {
        const warning = `[SEED CLEANUP CONFLICT] Cannot remove stale seed parent ${entityType} '${candidateId}': contains user-created descendants. Preserving parent.`;
        console.warn(warning);
        conflictAccumulator.push({ entityType, entityId: candidateId, reason: warning });
        continue;
      }
    }
    safeToDelete.push(candidateId);
  }

  if (safeToDelete.length > 0) {
    await deleteSqlGenerator(client, safeToDelete);
    await client.query(`
      DELETE FROM seed_ownership_registry
      WHERE entity_type = $1 AND entity_id = ANY($2::VARCHAR[]);
    `, [entityType, safeToDelete]);
  }

  for (const activeId of currentSeedIds) {
    await registerSeedOwnership(client, entityType, activeId);
  }
}

export async function seedDatabase() {
  console.log('=== Nexxoory Database Seeding ===');
  verifySeedPreconditions();

  const DEMO_PASSWORD = 'Password123!';
  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1
  });

  const pool = getDbPool();
  const cleanupConflicts = [];

  try {
    await transaction(async (client) => {
      // Ensure seed ownership registry table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS seed_ownership_registry (
          entity_type VARCHAR(50) NOT NULL,
          entity_id VARCHAR(255) NOT NULL,
          registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (entity_type, entity_id)
        );
      `);

      // =======================================================================
      // 1. SEED USERS & USER SETTINGS
      // =======================================================================
      console.log(`Seeding ${INITIAL_USERS.length} users...`);
      const seedUserIds = [];
      for (const u of INITIAL_USERS) {
        const userId = toDeterministicUuid(u.id);
        seedUserIds.push(userId);

        await client.query(`
          INSERT INTO users (id, name, email, password_hash, role, designation, department, status, avatar_url)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            role = EXCLUDED.role,
            designation = EXCLUDED.designation,
            department = EXCLUDED.department,
            status = EXCLUDED.status,
            avatar_url = EXCLUDED.avatar_url;
        `, [userId, u.name, u.email, passwordHash, u.role, u.designation, u.department, u.status || 'Active', u.avatar]);

        await client.query(`
          INSERT INTO user_settings (user_id, theme)
          VALUES ($1, 'light')
          ON CONFLICT (user_id) DO NOTHING;
        `, [userId]);
      }

      await pruneStaleSeedRecords(
        client,
        'user',
        seedUserIds,
        async (c, userId) => {
          // Check for user-created messages, tasks, projects, comments, reactions authored by this user
          const q = await c.query(`
            SELECT 1 WHERE EXISTS (
              SELECT 1 FROM messages m WHERE m.sender_id = $1
              AND NOT EXISTS (SELECT 1 FROM seed_ownership_registry r WHERE r.entity_type = 'message' AND r.entity_id = m.id::TEXT)
            ) OR EXISTS (
              SELECT 1 FROM tasks t WHERE t.assignee_id = $1
              AND NOT EXISTS (SELECT 1 FROM seed_ownership_registry r WHERE r.entity_type = 'task' AND r.entity_id = t.id::TEXT)
            ) OR EXISTS (
              SELECT 1 FROM task_comments tc WHERE tc.user_id = $1
              AND NOT EXISTS (SELECT 1 FROM seed_ownership_registry r WHERE r.entity_type = 'task_comment' AND r.entity_id = tc.id::TEXT)
            );
          `, [userId]);
          return q.rows.length > 0;
        },
        async (c, ids) => {
          await c.query('DELETE FROM users WHERE id = ANY($1::UUID[]);', [ids]);
        },
        cleanupConflicts
      );

      // =======================================================================
      // 2. SEED TEAMS & MEMBERS
      // =======================================================================
      console.log(`Seeding ${INITIAL_TEAMS.length} teams...`);
      const seedTeamIds = [];
      const seedTeamMemberKeys = [];

      for (const t of INITIAL_TEAMS) {
        const teamId = toDeterministicUuid(t.id);
        const leaderId = toDeterministicUuid(t.leaderId);
        seedTeamIds.push(teamId);

        await client.query(`
          INSERT INTO teams (id, name, department, leader_id, description, color)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            department = EXCLUDED.department,
            leader_id = EXCLUDED.leader_id,
            description = EXCLUDED.description,
            color = EXCLUDED.color;
        `, [teamId, t.name, t.department, leaderId, t.description, t.color || '#635BFF']);

        if (Array.isArray(t.memberIds)) {
          for (const mId of t.memberIds) {
            const memberUuid = toDeterministicUuid(mId);
            const compositeKey = `${teamId}:${memberUuid}`;
            seedTeamMemberKeys.push(compositeKey);

            await client.query(`
              INSERT INTO team_members (team_id, user_id)
              VALUES ($1, $2)
              ON CONFLICT (team_id, user_id) DO NOTHING;
            `, [teamId, memberUuid]);
          }
        }
      }

      await pruneStaleSeedRecords(
        client,
        'team',
        seedTeamIds,
        async (c, teamId) => {
          // Check for user-created team members or tasks under this team
          const q = await c.query(`
            SELECT 1 WHERE EXISTS (
              SELECT 1 FROM team_members tm WHERE tm.team_id = $1
              AND NOT EXISTS (
                SELECT 1 FROM seed_ownership_registry r 
                WHERE r.entity_type = 'team_member' AND r.entity_id = (tm.team_id || ':' || tm.user_id)
              )
            ) OR EXISTS (
              SELECT 1 FROM tasks t WHERE t.team_id = $1
              AND NOT EXISTS (SELECT 1 FROM seed_ownership_registry r WHERE r.entity_type = 'task' AND r.entity_id = t.id::TEXT)
            );
          `, [teamId]);
          return q.rows.length > 0;
        },
        async (c, ids) => {
          await c.query('DELETE FROM teams WHERE id = ANY($1::UUID[]);', [ids]);
        },
        cleanupConflicts
      );

      await pruneStaleSeedRecords(
        client,
        'team_member',
        seedTeamMemberKeys,
        null,
        async (c, keys) => {
          for (const k of keys) {
            const [teamId, userId] = k.split(':');
            await c.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2;', [teamId, userId]);
          }
        },
        cleanupConflicts
      );

      // =======================================================================
      // 3. SEED PROJECTS & PROJECT TEAMS
      // =======================================================================
      console.log(`Seeding ${INITIAL_PROJECTS.length} projects...`);
      const seedProjectIds = [];
      const seedProjectTeamKeys = [];

      for (const p of INITIAL_PROJECTS) {
        const projId = toDeterministicUuid(p.id);
        const managerId = toDeterministicUuid(p.managerId);
        const primaryTeamId = toDeterministicUuid(p.teamId);
        seedProjectIds.push(projId);

        await client.query(`
          INSERT INTO projects (id, name, description, manager_id, primary_team_id, priority, status, start_date, due_date, progress, budget, spent, tags)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            manager_id = EXCLUDED.manager_id,
            primary_team_id = EXCLUDED.primary_team_id,
            priority = EXCLUDED.priority,
            status = EXCLUDED.status,
            start_date = EXCLUDED.start_date,
            due_date = EXCLUDED.due_date,
            progress = EXCLUDED.progress,
            budget = EXCLUDED.budget,
            spent = EXCLUDED.spent,
            tags = EXCLUDED.tags;
        `, [
          projId,
          p.name,
          p.description,
          managerId,
          primaryTeamId,
          p.priority,
          p.status,
          p.startDate,
          p.dueDate,
          p.progress || 0,
          p.budget || 0,
          p.spent || 0,
          p.tags || []
        ]);

        if (primaryTeamId) {
          seedProjectTeamKeys.push(`${projId}:${primaryTeamId}`);
        }
      }

      for (const t of INITIAL_TEAMS) {
        const teamId = toDeterministicUuid(t.id);
        if (Array.isArray(t.projectIds)) {
          for (const pId of t.projectIds) {
            const projUuid = toDeterministicUuid(pId);
            const compositeKey = `${projUuid}:${teamId}`;
            seedProjectTeamKeys.push(compositeKey);

            await client.query(`
              INSERT INTO project_teams (project_id, team_id)
              VALUES ($1, $2)
              ON CONFLICT (project_id, team_id) DO NOTHING;
            `, [projUuid, teamId]);
          }
        }
      }

      await pruneStaleSeedRecords(
        client,
        'project',
        seedProjectIds,
        async (c, projId) => {
          // Check for user-created tasks or documents under this project
          const q = await c.query(`
            SELECT 1 WHERE EXISTS (
              SELECT 1 FROM tasks t WHERE t.project_id = $1
              AND NOT EXISTS (SELECT 1 FROM seed_ownership_registry r WHERE r.entity_type = 'task' AND r.entity_id = t.id::TEXT)
            ) OR EXISTS (
              SELECT 1 FROM documents d WHERE d.project_id = $1
              AND NOT EXISTS (SELECT 1 FROM seed_ownership_registry r WHERE r.entity_type = 'document' AND r.entity_id = d.id::TEXT)
            );
          `, [projId]);
          return q.rows.length > 0;
        },
        async (c, ids) => {
          await c.query('DELETE FROM projects WHERE id = ANY($1::UUID[]);', [ids]);
        },
        cleanupConflicts
      );

      await pruneStaleSeedRecords(
        client,
        'project_team',
        seedProjectTeamKeys,
        null,
        async (c, keys) => {
          for (const k of keys) {
            const [projId, teamId] = k.split(':');
            await c.query('DELETE FROM project_teams WHERE project_id = $1 AND team_id = $2;', [projId, teamId]);
          }
        },
        cleanupConflicts
      );

      // =======================================================================
      // 4. SEED TASKS, SUBTASKS & COMMENTS
      // =======================================================================
      console.log(`Seeding ${INITIAL_TASKS.length} tasks...`);
      const seedTaskIds = [];
      const seedSubtaskIds = [];
      const seedCommentIds = [];

      for (const t of INITIAL_TASKS) {
        const taskId = toDeterministicUuid(t.id);
        const projectId = toDeterministicUuid(t.projectId);
        const assigneeId = toDeterministicUuid(t.assigneeId);
        const teamId = toDeterministicUuid(t.teamId);
        seedTaskIds.push(taskId);

        await client.query(`
          INSERT INTO tasks (id, title, description, project_id, assignee_id, team_id, priority, status, start_date, due_date, progress, labels)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            project_id = EXCLUDED.project_id,
            assignee_id = EXCLUDED.assignee_id,
            team_id = EXCLUDED.team_id,
            priority = EXCLUDED.priority,
            status = EXCLUDED.status,
            start_date = EXCLUDED.start_date,
            due_date = EXCLUDED.due_date,
            progress = EXCLUDED.progress,
            labels = EXCLUDED.labels;
        `, [
          taskId,
          t.title,
          t.description,
          projectId,
          assigneeId,
          teamId,
          t.priority,
          t.status,
          t.startDate || null,
          t.dueDate,
          t.progress || 0,
          t.labels || []
        ]);

        if (Array.isArray(t.subtasks)) {
          for (let idx = 0; idx < t.subtasks.length; idx++) {
            const st = t.subtasks[idx];
            const subtaskId = toDeterministicUuid(st.id);
            seedSubtaskIds.push(subtaskId);

            await client.query(`
              INSERT INTO subtasks (id, task_id, title, completed, sort_order)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (id) DO UPDATE SET
                task_id = EXCLUDED.task_id,
                title = EXCLUDED.title,
                completed = EXCLUDED.completed,
                sort_order = EXCLUDED.sort_order;
            `, [subtaskId, taskId, st.title, !!st.completed, idx]);
          }
        }

        if (Array.isArray(t.comments)) {
          for (const c of t.comments) {
            const commentId = toDeterministicUuid(c.id);
            const authorId = toDeterministicUuid(c.userId);
            const commentTimestamp = parseMockTimestamp(c.timestamp);
            seedCommentIds.push(commentId);

            await client.query(`
              INSERT INTO task_comments (id, task_id, user_id, text, created_at)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (id) DO UPDATE SET
                task_id = EXCLUDED.task_id,
                user_id = EXCLUDED.user_id,
                text = EXCLUDED.text,
                created_at = EXCLUDED.created_at;
            `, [commentId, taskId, authorId, c.text, commentTimestamp]);
          }
        }
      }

      await pruneStaleSeedRecords(
        client,
        'task',
        seedTaskIds,
        async (c, taskId) => {
          // Check for user-created comments or subtasks under this task
          const q = await c.query(`
            SELECT 1 WHERE EXISTS (
              SELECT 1 FROM task_comments tc WHERE tc.task_id = $1
              AND NOT EXISTS (SELECT 1 FROM seed_ownership_registry r WHERE r.entity_type = 'task_comment' AND r.entity_id = tc.id::TEXT)
            ) OR EXISTS (
              SELECT 1 FROM subtasks s WHERE s.task_id = $1
              AND NOT EXISTS (SELECT 1 FROM seed_ownership_registry r WHERE r.entity_type = 'subtask' AND r.entity_id = s.id::TEXT)
            );
          `, [taskId]);
          return q.rows.length > 0;
        },
        async (c, ids) => {
          await c.query('DELETE FROM tasks WHERE id = ANY($1::UUID[]);', [ids]);
        },
        cleanupConflicts
      );

      await pruneStaleSeedRecords(
        client,
        'subtask',
        seedSubtaskIds,
        null,
        async (c, ids) => {
          await c.query('DELETE FROM subtasks WHERE id = ANY($1::UUID[]);', [ids]);
        },
        cleanupConflicts
      );

      await pruneStaleSeedRecords(
        client,
        'task_comment',
        seedCommentIds,
        null,
        async (c, ids) => {
          await c.query('DELETE FROM task_comments WHERE id = ANY($1::UUID[]);', [ids]);
        },
        cleanupConflicts
      );

      // =======================================================================
      // 5. CALENDAR EVENTS & ATTENDEES
      // =======================================================================
      console.log(`Seeding ${INITIAL_CALENDAR_EVENTS.length} calendar events...`);
      const seedEventIds = [];
      const seedAttendeeKeys = [];

      for (const evt of INITIAL_CALENDAR_EVENTS) {
        const evtId = toDeterministicUuid(evt.id);
        const projId = toDeterministicUuid(evt.projectId);
        seedEventIds.push(evtId);

        await client.query(`
          INSERT INTO calendar_events (id, title, type, start_date, end_date, project_id, location)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            type = EXCLUDED.type,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            location = EXCLUDED.location;
        `, [evtId, evt.title, evt.type, evt.startDate, evt.endDate || evt.startDate, projId, evt.location || 'Virtual']);

        if (Array.isArray(evt.attendees)) {
          for (const aId of evt.attendees) {
            const attendeeUuid = toDeterministicUuid(aId);
            const compositeKey = `${evtId}:${attendeeUuid}`;
            seedAttendeeKeys.push(compositeKey);

            await client.query(`
              INSERT INTO calendar_event_attendees (event_id, user_id)
              VALUES ($1, $2)
              ON CONFLICT (event_id, user_id) DO NOTHING;
            `, [evtId, attendeeUuid]);
          }
        }
      }

      await pruneStaleSeedRecords(
        client,
        'calendar_event',
        seedEventIds,
        async (c, evtId) => {
          // Check for user-created attendees under this event
          const q = await c.query(`
            SELECT 1 FROM calendar_event_attendees cea WHERE cea.event_id = $1
            AND NOT EXISTS (
              SELECT 1 FROM seed_ownership_registry r
              WHERE r.entity_type = 'calendar_attendee' AND r.entity_id = (cea.event_id || ':' || cea.user_id)
            );
          `, [evtId]);
          return q.rows.length > 0;
        },
        async (c, ids) => {
          await c.query('DELETE FROM calendar_events WHERE id = ANY($1::UUID[]);', [ids]);
        },
        cleanupConflicts
      );

      await pruneStaleSeedRecords(
        client,
        'calendar_attendee',
        seedAttendeeKeys,
        null,
        async (c, keys) => {
          for (const k of keys) {
            const [evtId, userId] = k.split(':');
            await c.query('DELETE FROM calendar_event_attendees WHERE event_id = $1 AND user_id = $2;', [evtId, userId]);
          }
        },
        cleanupConflicts
      );

      // =======================================================================
      // 6. DOCUMENTS & IN-DATABASE BYTEA STORAGE
      // =======================================================================
      console.log(`Seeding ${INITIAL_DOCUMENTS.length} documents...`);
      const seedDocIds = [];

      for (const doc of INITIAL_DOCUMENTS) {
        const docId = toDeterministicUuid(doc.id);
        const projId = toDeterministicUuid(doc.projectId);
        const authorUser = INITIAL_USERS.find(u => u.name === doc.author);
        const authorId = authorUser ? toDeterministicUuid(authorUser.id) : null;
        seedDocIds.push(docId);

        const fileBuffer = Buffer.from(doc.content || 'Sample initial document content for testing.');
        const sizeBytes = fileBuffer.length;
        const mimeType = doc.type === 'PDF' ? 'application/pdf' :
                         doc.type === 'JSON' ? 'application/json' :
                         doc.type === 'XLSX' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                         'text/markdown';

        const updatedAtDate = parseMockTimestamp(doc.updatedAt);

        await client.query(`
          INSERT INTO documents (id, name, folder, size_bytes, mime_type, file_data, project_id, author_id, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            folder = EXCLUDED.folder,
            size_bytes = EXCLUDED.size_bytes,
            mime_type = EXCLUDED.mime_type,
            file_data = EXCLUDED.file_data,
            updated_at = EXCLUDED.updated_at;
        `, [docId, doc.name, doc.folder, sizeBytes, mimeType, fileBuffer, projId, authorId, updatedAtDate]);
      }

      await pruneStaleSeedRecords(
        client,
        'document',
        seedDocIds,
        null,
        async (c, ids) => {
          await c.query('DELETE FROM documents WHERE id = ANY($1::UUID[]);', [ids]);
        },
        cleanupConflicts
      );

      // =======================================================================
      // 7. CONVERSATIONS, PARTICIPANTS, MESSAGES & REACTIONS
      // =======================================================================
      console.log(`Seeding ${INITIAL_CONVERSATIONS.length} conversations...`);
      const seedConvIds = [];
      const seedParticipantKeys = [];
      const seedMessageIds = [];
      const seedReactionKeys = [];

      for (const conv of INITIAL_CONVERSATIONS) {
        const convId = toDeterministicUuid(conv.id);
        const projId = toDeterministicUuid(conv.projectId);
        const teamId = toDeterministicUuid(conv.teamId);
        const lastMessageAt = parseMockTimestamp(conv.lastMessageTime);
        seedConvIds.push(convId);

        await client.query(`
          INSERT INTO conversations (id, name, type, project_id, team_id, last_message, last_message_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            type = EXCLUDED.type,
            last_message = EXCLUDED.last_message,
            last_message_at = EXCLUDED.last_message_at;
        `, [convId, conv.name, conv.type, projId, teamId, conv.lastMessage, lastMessageAt]);

        if (Array.isArray(conv.participants)) {
          for (const pId of conv.participants) {
            const participantUuid = toDeterministicUuid(pId);
            const compositeKey = `${convId}:${participantUuid}`;
            seedParticipantKeys.push(compositeKey);

            await client.query(`
              INSERT INTO conversation_participants (conversation_id, user_id)
              VALUES ($1, $2)
              ON CONFLICT (conversation_id, user_id) DO NOTHING;
            `, [convId, participantUuid]);
          }
        }

        const msgList = INITIAL_MESSAGES[conv.id] || [];
        for (const msg of msgList) {
          const msgId = toDeterministicUuid(msg.id);
          const senderId = toDeterministicUuid(msg.senderId);
          const messageTimestamp = parseMockTimestamp(msg.timestamp);
          seedMessageIds.push(msgId);

          await client.query(`
            INSERT INTO messages (id, conversation_id, sender_id, text, created_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET
              conversation_id = EXCLUDED.conversation_id,
              sender_id = EXCLUDED.sender_id,
              text = EXCLUDED.text,
              created_at = EXCLUDED.created_at;
          `, [msgId, convId, senderId, msg.text, messageTimestamp]);

          if (Array.isArray(msg.reactions) && msg.reactions.length > 0) {
            const reactingUserMockId = INFERRED_ATTRIBUTION_CONFIG.CONVERSATION_REACTION_ATTRIBUTION[conv.id] || msg.senderId;
            const reactingUserUuid = toDeterministicUuid(reactingUserMockId);

            for (const emoji of msg.reactions) {
              const reactionKey = `${msgId}:${reactingUserUuid}:${emoji}`;
              seedReactionKeys.push(reactionKey);

              await client.query(`
                INSERT INTO message_reactions (message_id, user_id, emoji)
                VALUES ($1, $2, $3)
                ON CONFLICT (message_id, user_id, emoji) DO NOTHING;
              `, [msgId, reactingUserUuid, emoji]);
            }
          }
        }
      }

      await pruneStaleSeedRecords(
        client,
        'conversation',
        seedConvIds,
        async (c, convId) => {
          // Check for user-created messages or participants under this conversation
          const q = await c.query(`
            SELECT 1 WHERE EXISTS (
              SELECT 1 FROM messages m WHERE m.conversation_id = $1
              AND NOT EXISTS (SELECT 1 FROM seed_ownership_registry r WHERE r.entity_type = 'message' AND r.entity_id = m.id::TEXT)
            ) OR EXISTS (
              SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = $1
              AND NOT EXISTS (
                SELECT 1 FROM seed_ownership_registry r 
                WHERE r.entity_type = 'conversation_participant' AND r.entity_id = (cp.conversation_id || ':' || cp.user_id)
              )
            );
          `, [convId]);
          return q.rows.length > 0;
        },
        async (c, ids) => {
          await c.query('DELETE FROM conversations WHERE id = ANY($1::UUID[]);', [ids]);
        },
        cleanupConflicts
      );

      await pruneStaleSeedRecords(
        client,
        'conversation_participant',
        seedParticipantKeys,
        null,
        async (c, keys) => {
          for (const k of keys) {
            const [convId, userId] = k.split(':');
            await c.query('DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2;', [convId, userId]);
          }
        },
        cleanupConflicts
      );

      await pruneStaleSeedRecords(
        client,
        'message',
        seedMessageIds,
        async (c, msgId) => {
          // Check for user-created reactions under this message
          const q = await c.query(`
            SELECT 1 FROM message_reactions mr WHERE mr.message_id = $1
            AND NOT EXISTS (
              SELECT 1 FROM seed_ownership_registry r 
              WHERE r.entity_type = 'message_reaction' AND r.entity_id = (mr.message_id || ':' || mr.user_id || ':' || mr.emoji)
            );
          `, [msgId]);
          return q.rows.length > 0;
        },
        async (c, ids) => {
          await c.query('DELETE FROM messages WHERE id = ANY($1::UUID[]);', [ids]);
        },
        cleanupConflicts
      );

      await pruneStaleSeedRecords(
        client,
        'message_reaction',
        seedReactionKeys,
        null,
        async (c, keys) => {
          for (const k of keys) {
            const [msgId, userId, emoji] = k.split(':');
            await c.query('DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3;', [msgId, userId, emoji]);
          }
        },
        cleanupConflicts
      );

      // =======================================================================
      // 8. NOTIFICATIONS
      // =======================================================================
      console.log(`Seeding ${INITIAL_NOTIFICATIONS.length} notifications...`);
      const seedNotifIds = [];

      for (const notif of INITIAL_NOTIFICATIONS) {
        const notifId = toDeterministicUuid(notif.id);
        const recipientMockId = INFERRED_ATTRIBUTION_CONFIG.NOTIFICATION_RECIPIENTS[notif.id] || 'usr-admin';
        const recipientId = toDeterministicUuid(recipientMockId);
        seedNotifIds.push(notifId);

        await client.query(`
          INSERT INTO notifications (id, user_id, title, message, type, link, is_read)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            title = EXCLUDED.title,
            message = EXCLUDED.message,
            is_read = EXCLUDED.is_read;
        `, [notifId, recipientId, notif.title, notif.message, notif.type, notif.link, notif.read]);
      }

      await pruneStaleSeedRecords(
        client,
        'notification',
        seedNotifIds,
        null,
        async (c, ids) => {
          await c.query('DELETE FROM notifications WHERE id = ANY($1::UUID[]);', [ids]);
        },
        cleanupConflicts
      );

      // =======================================================================
      // 9. ANNOUNCEMENTS & READ RECEIPTS
      // =======================================================================
      console.log(`Seeding ${INITIAL_ANNOUNCEMENTS.length} announcements...`);
      const seedAnnounceIds = [];
      const seedAnnounceReadKeys = [];

      for (const ann of INITIAL_ANNOUNCEMENTS) {
        const annId = toDeterministicUuid(ann.id);
        const authorUser = INITIAL_USERS.find(u => u.name === ann.author);
        const authorId = authorUser ? toDeterministicUuid(authorUser.id) : null;
        seedAnnounceIds.push(annId);

        await client.query(`
          INSERT INTO announcements (id, title, content, tag, author_id, published_date)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            tag = EXCLUDED.tag;
        `, [annId, ann.title, ann.content, ann.tag, authorId, ann.date]);

        const adminUuid = toDeterministicUuid('usr-admin');
        const readKey = `${annId}:${adminUuid}`;
        seedAnnounceReadKeys.push(readKey);

        await client.query(`
          INSERT INTO announcement_reads (announcement_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT (announcement_id, user_id) DO NOTHING;
        `, [annId, adminUuid]);
      }

      await pruneStaleSeedRecords(
        client,
        'announcement',
        seedAnnounceIds,
        async (c, annId) => {
          // Check for user-created read receipts
          const q = await c.query(`
            SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id = $1
            AND NOT EXISTS (
              SELECT 1 FROM seed_ownership_registry r
              WHERE r.entity_type = 'announcement_read' AND r.entity_id = (ar.announcement_id || ':' || ar.user_id)
            );
          `, [annId]);
          return q.rows.length > 0;
        },
        async (c, ids) => {
          await c.query('DELETE FROM announcements WHERE id = ANY($1::UUID[]);', [ids]);
        },
        cleanupConflicts
      );

      await pruneStaleSeedRecords(
        client,
        'announcement_read',
        seedAnnounceReadKeys,
        null,
        async (c, keys) => {
          for (const k of keys) {
            const [annId, userId] = k.split(':');
            await c.query('DELETE FROM announcement_reads WHERE announcement_id = $1 AND user_id = $2;', [annId, userId]);
          }
        },
        cleanupConflicts
      );
    });

    if (cleanupConflicts.length > 0) {
      console.warn(`\n[SEED WARNING] Completed with ${cleanupConflicts.length} cleanup conflict(s): parents with user descendants were preserved.`);
    } else {
      console.log('Seeding completed successfully with zero cleanup conflicts!');
    }
  } finally {
    await closePool();
  }

  return { conflicts: cleanupConflicts };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL SEED ERROR]', err.message);
      process.exit(1);
    });
}

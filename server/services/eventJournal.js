/**
 * Real-Time Event Publisher & Event Journal Helper.
 * Appends authorized events to Neon PostgreSQL app_events journal
 * so connected clients can poll/stream events with exact ordering and 0 lost messages.
 */

import { query } from '../config/db.js';

/**
 * Record an event to app_events.
 * Can be executed inside an existing client transaction or standalone query.
 *
 * @param {object} event
 * @param {string} event.eventType - e.g. 'message:created', 'task:updated', etc.
 * @param {string} event.entityType - e.g. 'message', 'conversation', 'task', 'project'
 * @param {string} event.entityId - ID of entity
 * @param {string|null} event.actorId - ID of user triggering action
 * @param {object} event.payload - JSON payload
 * @param {string} [event.audienceType='global'] - 'global', 'user', 'conversation', 'project', 'team'
 * @param {string|null} [event.audienceId=null] - Target ID if audienceType is not 'global'
 * @param {object} [dbClient=null] - Optional PostgreSQL client if in transaction
 */
export async function recordAppEvent(event, dbClient = null) {
  const {
    eventType,
    entityType,
    entityId,
    actorId = null,
    payload = {},
    audienceType = 'global',
    audienceId = null,
  } = event;

  const sql = `
    INSERT INTO app_events (
      event_type, entity_type, entity_id, actor_id, payload, audience_type, audience_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, event_type AS "eventType", entity_type AS "entityType",
              entity_id AS "entityId", actor_id AS "actorId", payload,
              audience_type AS "audienceType", audience_id AS "audienceId",
              created_at AS "createdAt";
  `;
  const params = [
    eventType,
    entityType,
    String(entityId),
    actorId,
    JSON.stringify(payload),
    audienceType,
    audienceId ? String(audienceId) : null,
  ];

  if (dbClient) {
    const res = await dbClient.query(sql, params);
    return res.rows[0];
  }

  const res = await query(sql, params);
  return res.rows[0];
}

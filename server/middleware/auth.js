import { verifyAccessToken } from '../utils/jwt.js';
import { query } from '../config/db.js';
import { sendError } from '../utils/response.js';

// In-memory cache for validated user auth records to prevent redundant DB roundtrips (TTL: 60s)
const userCache = new Map();

/**
 * Extracts Bearer token from Authorization header, validates JWT,
 * and fetches the authoritative user record from PostgreSQL (or memory cache).
 * Verifies account is active and not suspended.
 */
export async function authenticateRequest(req, res) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 401, 'UNAUTHORIZED', 'Authentication token is required');
    return null;
  }

  const token = authHeader.substring(7).trim();
  const decoded = verifyAccessToken(token);

  if (!decoded || !decoded.sub) {
    sendError(res, 401, 'TOKEN_EXPIRED', 'Access token is invalid or has expired');
    return null;
  }

  try {
    const cached = userCache.get(decoded.sub);
    if (cached && Date.now() - cached.timestamp < 60000) {
      if (cached.user.status !== 'Active') {
        sendError(res, 403, 'ACCOUNT_INACTIVE', `Account access is disabled (Status: ${cached.user.status})`);
        return null;
      }
      return cached.user;
    }

    // Authoritative lookup from PostgreSQL to prevent stale roles or deactivated logins
    const result = await query(
      `SELECT id, name, email, role, designation, department, status, avatar_url 
       FROM users 
       WHERE id = $1;`,
      [decoded.sub]
    );

    if (result.rows.length === 0) {
      sendError(res, 401, 'USER_NOT_FOUND', 'User account does not exist');
      return null;
    }

    const user = result.rows[0];
    userCache.set(decoded.sub, { user, timestamp: Date.now() });

    if (user.status !== 'Active') {
      sendError(
        res,
        403,
        'ACCOUNT_INACTIVE',
        `Account access is disabled (Status: ${user.status})`
      );
      return null;
    }

    req.user = user;
    return user;
  } catch (error) {
    console.error('[AUTH MIDDLEWARE DB ERROR]', error.name);
    sendError(res, 500, 'SERVER_ERROR', 'Internal authentication error');
    return null;
  }
}

/**
 * Higher-order middleware checking if the authenticated user has one of the allowed roles.
 */
export function requireRole(...allowedRoles) {
  return (req, res) => {
    if (!req.user) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication is required');
      return false;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(res, 403, 'FORBIDDEN', 'Insufficient permissions for this action');
      return false;
    }

    return true;
  };
}


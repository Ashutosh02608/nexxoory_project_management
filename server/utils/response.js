import { env } from '../config/env.js';
import crypto from 'crypto';

function isAllowedOrigin(origin) {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const deploymentOrigins = process.env.VERCEL === '1'
      ? [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
        .filter(Boolean).map((host) => `https://${host}`)
      : [];
    return [env.FRONTEND_URL, ...env.ALLOWED_ORIGINS, ...deploymentOrigins].some((allowed) => {
      try {
        return parsed.origin === new URL(allowed).origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export function sendJson(res, statusCode, body, headers = {}) {
  if (!res.getHeader?.('X-Request-Id')) res.setHeader('X-Request-Id', crypto.randomUUID());
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  for (const [k, v] of Object.entries(headers)) {
    res.setHeader(k, v);
  }
  res.end(JSON.stringify(body));
}

export function sendSuccess(res, data = {}, message = undefined, statusCode = 200, headers = {}) {
  const payload = { success: true, data };
  if (message) payload.message = message;
  sendJson(res, statusCode, payload, headers);
}

export function sendError(res, statusCode, code, message, details = undefined) {
  const payload = {
    success: false,
    error: {
      code,
      message,
    },
  };
  if (details) payload.error.details = details;
  sendJson(res, statusCode, payload);
}

export function handleCors(req, res) {
  const origin = req.headers.origin;
  
  // Allow exact configured origins and this project's platform-provided deployment URLs.
  const allowedOrigin = isAllowedOrigin(origin);

  // Reject unauthorized origins for state-changing requests
  if (origin && !allowedOrigin) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: { code: 'FORBIDDEN_ORIGIN', message: 'CORS policy violation: unauthorized origin' } }));
    return true;
  }

  // Set credentialed CORS headers when origin is authorized
  if (origin && allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true; // Handled preflight
  }
  return false;
}

/**
 * Validates CSRF defense on state-changing API requests.
 * Enforces X-Requested-With header + matching Origin/Referer when available.
 */
export function validateCsrf(req, res) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return true;
  }

  const customHeader = req.headers['x-requested-with'];
  if (customHeader !== 'XMLHttpRequest') {
    sendError(res, 403, 'CSRF_VALIDATION_FAILED', 'Missing required custom CSRF request header');
    return false;
  }

  const origin = req.headers.origin;
  if (origin) {
    if (!isAllowedOrigin(origin)) {
      sendError(res, 403, 'CSRF_ORIGIN_INVALID', 'Cross-origin request rejected');
      return false;
    }
  }

  return true;
}

export async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      // Cap at 1MB to avoid DoS
      if (raw.length > 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch  {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}


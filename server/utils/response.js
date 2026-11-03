import { env } from '../config/env.js';

export function sendJson(res, statusCode, body, headers = {}) {
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
  
  // Whitelist resolution: in production, strictly match FRONTEND_URL.
  // In development, allow configured ALLOWED_ORIGINS (e.g. localhost:5173, 127.0.0.1:5173).
  const isAllowedOrigin = env.isProduction
    ? origin === env.FRONTEND_URL
    : env.ALLOWED_ORIGINS.includes(origin) || origin === env.FRONTEND_URL;

  // Reject unauthorized origins for state-changing requests
  if (origin && !isAllowedOrigin) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: { code: 'FORBIDDEN_ORIGIN', message: 'CORS policy violation: unauthorized origin' } }));
    return true;
  }

  // Set credentialed CORS headers when origin is authorized
  if (origin && isAllowedOrigin) {
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
    const isAllowed = env.isProduction
      ? origin === env.FRONTEND_URL
      : env.ALLOWED_ORIGINS.includes(origin) || origin === env.FRONTEND_URL;
    if (!isAllowed) {
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
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}


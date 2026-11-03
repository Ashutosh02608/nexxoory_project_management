import { AuthService } from '../../../server/services/authService.js';
import { loginSchema } from '../../../server/schemas/auth.schema.js';
import { handleCors, validateCsrf, parseJsonBody, sendSuccess, sendError } from '../../../server/utils/response.js';
import { buildRefreshCookie } from '../../../server/utils/cookies.js';
import { checkRateLimit, getClientIp } from '../../../server/middleware/rateLimit.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only POST method is allowed');
  }

  if (!validateCsrf(req, res)) return;

  // Rate Limiting: 5 attempts per minute per IP
  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit(`login:${clientIp}`, 5, 60);

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.resetSeconds.toString());
    return sendError(
      res,
      429,
      'TOO_MANY_REQUESTS',
      `Too many failed login attempts. Please try again in ${rateLimit.resetSeconds} seconds.`
    );
  }

  try {
    const rawBody = await parseJsonBody(req);
    const parsed = loginSchema.safeParse(rawBody);

    if (!parsed.success) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid login request payload', parsed.error.errors);
    }

    const { email, password } = parsed.data;
    const { user, accessToken, rawRefreshToken } = await AuthService.login(email, password, clientIp);

    // Set HttpOnly, Secure refresh cookie
    const cookieHeader = buildRefreshCookie(rawRefreshToken);
    res.setHeader('Set-Cookie', cookieHeader);

    return sendSuccess(res, {
      user,
      accessToken,
    }, 'Authentication successful');
  } catch (err) {
    if (err.message === 'INVALID_CREDENTIALS') {
      return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    if (err.customCode) {
      return sendError(res, err.status || 403, err.customCode, err.customMessage);
    }
    console.error('[LOGIN API ERROR]', err.name);
    return sendError(res, 500, 'SERVER_ERROR', 'Internal authentication error');
  }
}


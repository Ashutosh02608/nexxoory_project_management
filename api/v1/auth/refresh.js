import { AuthService } from '../../../server/services/authService.js';
import { handleCors, validateCsrf, sendSuccess, sendError } from '../../../server/utils/response.js';
import { buildRefreshCookie, clearRefreshCookie, getCookiesFromReq, REFRESH_COOKIE_NAME } from '../../../server/utils/cookies.js';
import { getClientIp } from '../../../server/middleware/rateLimit.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only POST method is allowed');
  }

  if (!validateCsrf(req, res)) return;

  try {
    const cookies = getCookiesFromReq(req);
    const rawRefreshToken = cookies[REFRESH_COOKIE_NAME];

    if (!rawRefreshToken) {
      return sendError(res, 401, 'MISSING_REFRESH_TOKEN', 'No refresh token provided in session');
    }

    const clientIp = getClientIp(req);
    const result = await AuthService.refresh(rawRefreshToken, clientIp);

    // Set new rotated refresh cookie
    res.setHeader('Set-Cookie', buildRefreshCookie(result.rawRefreshToken));

    return sendSuccess(res, {
      user: result.user,
      accessToken: result.accessToken,
    }, 'Session refreshed successfully');
  } catch (err) {
    // If token reuse was detected or token is invalid, clear the cookie
    res.setHeader('Set-Cookie', clearRefreshCookie());

    if (err.message === 'TOKEN_REUSE_DETECTED') {
      return sendError(
        res,
        401,
        'TOKEN_COMPROMISED',
        'Session security check failed. Token reuse detected. Please log in again.'
      );
    }
    if (err.message === 'EXPIRED_REFRESH_TOKEN') {
      return sendError(res, 401, 'SESSION_EXPIRED', 'Your session has expired. Please log in again.');
    }
    if (err.message === 'USER_NOT_ACTIVE') {
      return sendError(res, 403, 'ACCOUNT_DISABLED', 'Account is no longer active');
    }

    return sendError(res, 401, 'INVALID_REFRESH_TOKEN', 'Session is invalid. Please log in again.');
  }
}


import { AuthService } from '../../../server/services/authService.js';
import { handleCors, validateCsrf, sendSuccess, sendError } from '../../../server/utils/response.js';
import { clearRefreshCookie, getCookiesFromReq, REFRESH_COOKIE_NAME } from '../../../server/utils/cookies.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only POST method is allowed');
  }

  if (!validateCsrf(req, res)) return;

  try {
    const cookies = getCookiesFromReq(req);
    const rawRefreshToken = cookies[REFRESH_COOKIE_NAME];

    if (rawRefreshToken) {
      await AuthService.logout(rawRefreshToken);
    }

    // Clear the refresh token cookie
    res.setHeader('Set-Cookie', clearRefreshCookie());

    return sendSuccess(res, { loggedOut: true }, 'Successfully logged out');
  } catch (err) {
    console.error('[LOGOUT API ERROR]', err.name);
    // Still clear the cookie regardless of server error
    res.setHeader('Set-Cookie', clearRefreshCookie());
    return sendSuccess(res, { loggedOut: true }, 'Logged out');
  }
}


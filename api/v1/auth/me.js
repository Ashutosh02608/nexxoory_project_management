import { authenticateRequest } from '../../../server/middleware/auth.js';
import { handleCors, sendSuccess, sendError } from '../../../server/utils/response.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only GET method is allowed');
  }

  const user = await authenticateRequest(req, res);
  if (!user) return; // Error response already sent by middleware

  return sendSuccess(res, { user }, 'User identity verified');
}


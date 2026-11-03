import { AuthService } from '../../../server/services/authService.js';
import { changePasswordSchema } from '../../../server/schemas/auth.schema.js';
import { authenticateRequest } from '../../../server/middleware/auth.js';
import { handleCors, validateCsrf, parseJsonBody, sendSuccess, sendError } from '../../../server/utils/response.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only POST method is allowed');
  }

  if (!validateCsrf(req, res)) return;

  const user = await authenticateRequest(req, res);
  if (!user) return; // Handled by middleware

  try {
    const rawBody = await parseJsonBody(req);
    const parsed = changePasswordSchema.safeParse(rawBody);

    if (!parsed.success) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid payload', parsed.error.errors);
    }

    const { currentPassword, newPassword } = parsed.data;
    await AuthService.changePassword(user.id, currentPassword, newPassword);

    return sendSuccess(res, { passwordChanged: true }, 'Password changed successfully. Please log in again.');
  } catch (err) {
    if (err.message === 'INCORRECT_CURRENT_PASSWORD') {
      return sendError(res, 400, 'INCORRECT_PASSWORD', 'The current password you provided is incorrect');
    }
    console.error('[CHANGE PASSWORD API ERROR]', err.name);
    return sendError(res, 500, 'SERVER_ERROR', 'Failed to change password');
  }
}


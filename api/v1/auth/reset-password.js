import { AuthService } from '../../../server/services/authService.js';
import { resetPasswordSchema } from '../../../server/schemas/auth.schema.js';
import { handleCors, validateCsrf, parseJsonBody, sendSuccess, sendError } from '../../../server/utils/response.js';
import { checkRateLimit, getClientIp } from '../../../server/middleware/rateLimit.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only POST method is allowed');
  }

  if (!validateCsrf(req, res)) return;

  // Rate Limiting: 5 attempts per 10 minutes per IP
  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit(`reset-pwd:${clientIp}`, 5, 600);

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.resetSeconds.toString());
    return sendError(
      res,
      429,
      'TOO_MANY_REQUESTS',
      `Too many reset attempts. Please try again in ${rateLimit.resetSeconds} seconds.`
    );
  }

  try {
    const rawBody = await parseJsonBody(req);
    const parsed = resetPasswordSchema.safeParse(rawBody);

    if (!parsed.success) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid payload', parsed.error.errors);
    }

    const { token, newPassword } = parsed.data;
    await AuthService.resetPassword(token, newPassword);

    return sendSuccess(res, { passwordReset: true }, 'Password has been successfully updated');
  } catch (err) {
    if (err.message === 'INVALID_TOKEN') {
      return sendError(res, 400, 'INVALID_TOKEN', 'The reset token is invalid');
    }
    if (err.message === 'TOKEN_ALREADY_USED') {
      return sendError(res, 400, 'TOKEN_ALREADY_USED', 'This reset token has already been used');
    }
    if (err.message === 'TOKEN_EXPIRED') {
      return sendError(res, 400, 'TOKEN_EXPIRED', 'The reset token has expired');
    }
    console.error('[RESET PASSWORD API ERROR]', err.name);
    return sendError(res, 500, 'SERVER_ERROR', 'Failed to reset password');
  }
}


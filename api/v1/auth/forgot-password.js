import { AuthService } from '../../../server/services/authService.js';
import { forgotPasswordSchema } from '../../../server/schemas/auth.schema.js';
import { handleCors, validateCsrf, parseJsonBody, sendSuccess, sendError } from '../../../server/utils/response.js';
import { checkRateLimit, getClientIp } from '../../../server/middleware/rateLimit.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only POST method is allowed');
  }

  if (!validateCsrf(req, res)) return;

  // Rate Limiting: 3 requests per 5 minutes per IP
  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit(`forgot-pwd:${clientIp}`, 3, 300);

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.resetSeconds.toString());
    return sendError(
      res,
      429,
      'TOO_MANY_REQUESTS',
      `Too many recovery requests. Please try again in ${rateLimit.resetSeconds} seconds.`
    );
  }

  try {
    const rawBody = await parseJsonBody(req);
    const parsed = forgotPasswordSchema.safeParse(rawBody);

    if (!parsed.success) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid email address', parsed.error.errors);
    }

    const { email } = parsed.data;
    await AuthService.requestPasswordReset(email);

    // Generic response to prevent email enumeration
    const responsePayload = {
      messageSent: true,
    };

    return sendSuccess(
      res,
      responsePayload,
      'If an active account exists for that email, password recovery instructions have been initiated.'
    );
  } catch (err) {
    console.error('[FORGOT PASSWORD API ERROR]', err.name, err.code);
    return sendError(res, 500, 'SERVER_ERROR', 'Failed to process password recovery request');
  }
}


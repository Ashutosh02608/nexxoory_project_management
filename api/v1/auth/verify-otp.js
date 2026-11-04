import { AuthService } from '../../../server/services/authService.js';
import { verifyOtpSchema } from '../../../server/schemas/auth.schema.js';
import { handleCors, validateCsrf, parseJsonBody, sendSuccess, sendError } from '../../../server/utils/response.js';
import { checkRateLimit, getClientIp } from '../../../server/middleware/rateLimit.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only POST method is allowed');
  }

  if (!validateCsrf(req, res)) return;

  // Rate Limiting: 5 attempts per 5 minutes per IP
  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit(`verify-otp:${clientIp}`, 5, 300);

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.resetSeconds.toString());
    return sendError(
      res,
      429,
      'TOO_MANY_REQUESTS',
      `Too many verification attempts. Please try again in ${rateLimit.resetSeconds} seconds.`
    );
  }

  try {
    const rawBody = await parseJsonBody(req);
    const parsed = verifyOtpSchema.safeParse(rawBody);

    if (!parsed.success) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid OTP verification request', parsed.error.errors);
    }

    const { email, otp } = parsed.data;
    const result = await AuthService.verifyOtp(email, otp);

    return sendSuccess(res, result, 'OTP successfully verified');
  } catch (err) {
    if (err.message === 'INVALID_OTP') {
      return sendError(res, 400, 'INVALID_OTP', 'The entered 6-digit OTP is invalid');
    }
    if (err.message === 'OTP_EXPIRED') {
      return sendError(res, 400, 'OTP_EXPIRED', 'The OTP has expired. Please request a new code.');
    }
    console.error('Verify OTP Error:', err);
    return sendError(res, 500, 'SERVER_ERROR', 'An error occurred during verification');
  }
}


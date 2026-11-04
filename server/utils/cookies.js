import { stringifySetCookie, parseCookie } from 'cookie';
import { env } from '../config/env.js';

export const REFRESH_COOKIE_NAME = 'nx_refresh_token';

/**
 * Creates HttpOnly, Secure, SameSite=Strict Set-Cookie header for refresh tokens.
 */
export function buildRefreshCookie(token, maxAgeSeconds = env.REFRESH_TOKEN_EXPIRES_DAYS * 86400) {
  return stringifySetCookie({
    name: REFRESH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: maxAgeSeconds,
    domain: env.COOKIE_DOMAIN,
  });
}

/**
 * Creates clearing Set-Cookie header for logout.
 */
export function clearRefreshCookie() {
  return stringifySetCookie({
    name: REFRESH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 0,
    domain: env.COOKIE_DOMAIN,
  });
}

/**
 * Parses cookies from incoming request headers.
 */
export function getCookiesFromReq(req) {
  const cookieHeader = req.headers.cookie || req.headers.Cookie || '';
  return parseCookie(cookieHeader);
}


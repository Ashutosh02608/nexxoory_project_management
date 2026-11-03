/**
 * Shared PostgreSQL rate limiter with fallback to in-memory sliding window.
 * Ensures distributed protection against brute force and credential stuffing across serverless instances.
 */

import { query } from '../config/db.js';
import { env } from '../config/env.js';

const memTracker = new Map();

/**
 * Checks in-memory sliding window rate limit.
 */
function checkMemoryRateLimit(key, maxAttempts, windowSeconds) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  if (!memTracker.has(key)) {
    memTracker.set(key, []);
  }

  const timestamps = memTracker.get(key);
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (validTimestamps.length >= maxAttempts) {
    const oldest = validTimestamps[0];
    const resetSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetSeconds: Math.max(1, resetSeconds),
    };
  }

  validTimestamps.push(now);
  memTracker.set(key, validTimestamps);

  return {
    allowed: true,
    remaining: maxAttempts - validTimestamps.length,
    resetSeconds: windowSeconds,
  };
}

/**
 * Checks shared persistent rate limit via PostgreSQL.
 * Atomically upserts attempt count and computes reset time.
 * Falls back to in-memory rate limiting when database connection is unavailable.
 */
export async function checkRateLimit(key, maxAttempts = 5, windowSeconds = 60) {
  if (!env.DATABASE_URL) {
    return checkMemoryRateLimit(key, maxAttempts, windowSeconds);
  }

  try {
    const expireAt = new Date(Date.now() + windowSeconds * 1000);

    // Atomic PostgreSQL rate limit UPSERT:
    // If key expired, reset points to 1 and update expire_at.
    // If key active, increment points and preserve original expire_at.
    const res = await query(
      `INSERT INTO rate_limits (key, points, expire_at)
       VALUES ($1, 1, $2)
       ON CONFLICT (key) DO UPDATE
       SET 
         points = CASE 
           WHEN rate_limits.expire_at <= CURRENT_TIMESTAMP THEN 1 
           ELSE rate_limits.points + 1 
         END,
         expire_at = CASE 
           WHEN rate_limits.expire_at <= CURRENT_TIMESTAMP THEN $2 
           ELSE rate_limits.expire_at 
         END
       RETURNING points, expire_at;`,
      [key, expireAt]
    );

    const row = res.rows[0];
    const points = row.points;
    const dbExpire = new Date(row.expire_at);
    const resetSeconds = Math.max(1, Math.ceil((dbExpire.getTime() - Date.now()) / 1000));

    if (points > maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetSeconds,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, maxAttempts - points),
      resetSeconds,
    };
  } catch (err) {
    // Graceful fallback to in-memory limiter on transient DB failure
    console.warn('[RATE LIMIT] DB rate limit check failed, falling back to memory:', err.message);
    return checkMemoryRateLimit(key, maxAttempts, windowSeconds);
  }
}

/**
 * Extracts validated client IP.
 * Prioritizes standard trusted reverse-proxy headers (e.g. Vercel x-real-ip)
 * and takes the leftmost client IP from x-forwarded-for.
 */
export function getClientIp(req) {
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    return realIp.trim();
  }

  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }

  return req.socket?.remoteAddress || '127.0.0.1';
}


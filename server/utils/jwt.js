import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const JWT_ISSUER = 'nexxoory-auth';
const JWT_AUDIENCE = 'nexxoory-app';

/**
 * Generates short-lived Access Token containing minimal user payload.
 * Valid for 15 minutes.
 */
export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: 'HS256',
    }
  );
}

/**
 * Verifies access token cryptographically.
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256'],
    });
  } catch  {
    return null;
  }
}

/**
 * Generates an unguessable 256-bit cryptographically secure random token string.
 */
export function generateSecureRandomToken(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Hashes an opaque token using SHA-256 before database storage.
 */
export function hashOpaqueToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Performs timing-safe comparison of two hash strings.
 */
export function timingSafeHashCompare(hashA, hashB) {
  if (typeof hashA !== 'string' || typeof hashB !== 'string') return false;
  const bufA = Buffer.from(hashA, 'hex');
  const bufB = Buffer.from(hashB, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}


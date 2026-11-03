import crypto from 'crypto';
import { query, transaction } from '../config/db.js';
import { env } from '../config/env.js';
import {
  signAccessToken,
  generateSecureRandomToken,
  hashOpaqueToken,
  timingSafeHashCompare,
} from '../utils/jwt.js';
import { verifyPassword, hashPassword } from '../utils/security.js';

export class AuthService {
  /**
   * Authenticates user via email and password.
   * Generates new access token and cryptographically secure refresh token family.
   */
  static async login(email, password, clientIp = null) {
    // 1. Fetch user by email
    const userRes = await query(
      `SELECT id, name, email, password_hash, role, designation, department, status, avatar_url 
       FROM users 
       WHERE email = $1;`,
      [email.toLowerCase()]
    );

    // Generic error to prevent user enumeration
    if (userRes.rows.length === 0) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const user = userRes.rows[0];

    // Check account status
    if (user.status !== 'Active') {
      const err = new Error(`ACCOUNT_${user.status.toUpperCase()}`);
      err.status = 403;
      err.customCode = `ACCOUNT_${user.status.toUpperCase()}`;
      err.customMessage = `Account access is restricted (Status: ${user.status})`;
      throw err;
    }

    // 2. Verify password with Argon2id
    const isPasswordValid = await verifyPassword(user.password_hash, password);
    if (!isPasswordValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // 3. Issue Access Token & Refresh Token Family
    const accessToken = signAccessToken(user);
    const rawRefreshToken = generateSecureRandomToken(32);
    const refreshTokenHash = hashOpaqueToken(rawRefreshToken);
    const familyId = crypto.randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, family, is_revoked, expires_at, created_ip)
       VALUES ($1, $2, $3, false, $4, $5);`,
      [user.id, refreshTokenHash, familyId, expiresAt, clientIp]
    );

    // Clean user object before returning (remove password_hash, standardize avatar)
    const { password_hash, avatar_url, ...safeUser } = user;
    safeUser.avatar = avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150';
    safeUser.avatar_url = safeUser.avatar;

    return {
      user: safeUser,
      accessToken,
      rawRefreshToken,
    };
  }

  /**
   * Refreshes access token with full refresh-token rotation and reuse detection.
   * Concurrency-safe: family-wide lock on family UUID prevents race conditions.
   * On reuse, family revocation is committed before raising security error.
   */
  static async refresh(rawRefreshToken, clientIp = null) {
    if (!rawRefreshToken) {
      throw new Error('MISSING_TOKEN');
    }

    const providedHash = hashOpaqueToken(rawRefreshToken);

    const txResult = await transaction(async (client) => {
      // 1. Find the token row in DB
      const tokenRes = await client.query(
        `SELECT id, user_id, token_hash, family, is_revoked, expires_at 
         FROM refresh_tokens 
         WHERE token_hash = $1 
         FOR UPDATE;`,
        [providedHash]
      );

      if (tokenRes.rows.length === 0) {
        return { status: 'INVALID_REFRESH_TOKEN' };
      }

      const tokenRow = tokenRes.rows[0];

      // Concurrency lock: lock all rows in the same family to serialize concurrent refresh requests
      await client.query(
        `SELECT id FROM refresh_tokens WHERE family = $1 FOR UPDATE;`,
        [tokenRow.family]
      );

      // 2. Security: Reuse Detection!
      // If a token that was already revoked/rotated is used again, compromise is detected!
      // Revoke the ENTIRE token family immediately and COMMIT transaction.
      if (tokenRow.is_revoked) {
        await client.query(
          `UPDATE refresh_tokens SET is_revoked = true WHERE family = $1;`,
          [tokenRow.family]
        );
        return { status: 'TOKEN_REUSE_DETECTED', family: tokenRow.family };
      }

      // Check expiration
      if (new Date() > new Date(tokenRow.expires_at)) {
        await client.query(
          `UPDATE refresh_tokens SET is_revoked = true WHERE id = $1;`,
          [tokenRow.id]
        );
        return { status: 'EXPIRED_REFRESH_TOKEN' };
      }

      // Verify user is still Active
      const userRes = await client.query(
        `SELECT id, name, email, role, designation, department, status, avatar_url 
         FROM users 
         WHERE id = $1;`,
        [tokenRow.user_id]
      );

      if (userRes.rows.length === 0 || userRes.rows[0].status !== 'Active') {
        return { status: 'USER_NOT_ACTIVE' };
      }

      const user = userRes.rows[0];

      // Mark the consumed token as revoked (Rotated)
      await client.query(
        `UPDATE refresh_tokens SET is_revoked = true WHERE id = $1;`,
        [tokenRow.id]
      );

      // Issue NEW rotated refresh token in the SAME family
      const newRawRefreshToken = generateSecureRandomToken(32);
      const newRefreshTokenHash = hashOpaqueToken(newRawRefreshToken);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);

      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, family, is_revoked, expires_at, created_ip)
         VALUES ($1, $2, $3, false, $4, $5);`,
        [user.id, newRefreshTokenHash, tokenRow.family, expiresAt, clientIp]
      );

      const newAccessToken = signAccessToken(user);

      const { password_hash, avatar_url, ...safeUser } = user;
      safeUser.avatar = avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150';
      safeUser.avatar_url = safeUser.avatar;

      return {
        status: 'SUCCESS',
        user: safeUser,
        accessToken: newAccessToken,
        rawRefreshToken: newRawRefreshToken,
      };
    });

    if (txResult.status === 'TOKEN_REUSE_DETECTED') {
      console.warn(`[SECURITY ALERT] Refresh token reuse detected. Family revoked: ${txResult.family}`);
      throw new Error('TOKEN_REUSE_DETECTED');
    }

    if (txResult.status !== 'SUCCESS') {
      throw new Error(txResult.status);
    }

    return {
      user: txResult.user,
      accessToken: txResult.accessToken,
      rawRefreshToken: txResult.rawRefreshToken,
    };
  }

  /**
   * Logs out user by revoking the refresh token.
   */
  static async logout(rawRefreshToken) {
    if (!rawRefreshToken) return;
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    await query(
      `UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1;`,
      [tokenHash]
    );
  }

  /**
   * Creates a password reset token. Always succeeds generic to prevent user enumeration.
   */
  static async requestPasswordReset(email) {
    const userRes = await query(
      `SELECT id, email, status FROM users WHERE email = $1;`,
      [email.toLowerCase()]
    );

    // Return generic success regardless of whether email exists
    if (userRes.rows.length === 0 || userRes.rows[0].status !== 'Active') {
      return { tokenCreated: false };
    }

    const user = userRes.rows[0];
    const rawResetToken = generateSecureRandomToken(32);
    const tokenHash = hashOpaqueToken(rawResetToken);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + env.PASSWORD_RESET_EXPIRES_MINUTES);

    // Invalidate existing active reset tokens for this user
    await query(
      `UPDATE password_reset_tokens SET is_used = true WHERE user_id = $1 AND is_used = false;`,
      [user.id]
    );

    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, is_used, expires_at)
       VALUES ($1, $2, false, $3);`,
      [user.id, tokenHash, expiresAt]
    );

    // In production without an email provider configured, do not print secret in response or production logs
    if (!env.isProduction) {
      console.log(`[DEV ONLY] Password reset token for ${email}: ${rawResetToken}`);
    }

    return { tokenCreated: true, rawResetToken: env.isProduction ? undefined : rawResetToken };
  }

  /**
   * Validates reset token and updates password using Argon2id.
   */
  static async resetPassword(rawToken, newPassword) {
    if (!rawToken || !newPassword) {
      throw new Error('INVALID_INPUT');
    }

    const tokenHash = hashOpaqueToken(rawToken);

    return await transaction(async (client) => {
      const resetRes = await client.query(
        `SELECT id, user_id, is_used, expires_at 
         FROM password_reset_tokens 
         WHERE token_hash = $1 
         FOR UPDATE;`,
        [tokenHash]
      );

      if (resetRes.rows.length === 0) {
        throw new Error('INVALID_TOKEN');
      }

      const resetRow = resetRes.rows[0];

      if (resetRow.is_used) {
        throw new Error('TOKEN_ALREADY_USED');
      }

      if (new Date() > new Date(resetRow.expires_at)) {
        throw new Error('TOKEN_EXPIRED');
      }

      // Hash new password with Argon2id
      const newHash = await hashPassword(newPassword);

      // Update user password
      await client.query(
        `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
        [newHash, resetRow.user_id]
      );

      // Mark reset token as used
      await client.query(
        `UPDATE password_reset_tokens SET is_used = true WHERE id = $1;`,
        [resetRow.id]
      );

      // Revoke all existing refresh sessions for security
      await client.query(
        `UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1;`,
        [resetRow.user_id]
      );

      return true;
    });
  }

  /**
   * Changes password for an authenticated user.
   * Atomically updates password and revokes all refresh token sessions in one transaction.
   */
  static async changePassword(userId, currentPassword, newPassword) {
    const userRes = await query(
      `SELECT password_hash FROM users WHERE id = $1;`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      throw new Error('USER_NOT_FOUND');
    }

    const isValid = await verifyPassword(userRes.rows[0].password_hash, currentPassword);
    if (!isValid) {
      throw new Error('INCORRECT_CURRENT_PASSWORD');
    }

    const newHash = await hashPassword(newPassword);

    return await transaction(async (client) => {
      // 1. Update password
      await client.query(
        `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
        [newHash, userId]
      );

      // 2. Revoke all active refresh sessions for this user
      await client.query(
        `UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1;`,
        [userId]
      );

      return true;
    });
  }
}


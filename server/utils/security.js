import argon2 from 'argon2';

/**
 * Argon2id password hashing using OWASP recommended settings.
 */
export async function hashPassword(plainPassword) {
  return argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB
    timeCost: 3,
    parallelism: 1,
  });
}

/**
 * Verifies plaintext password against stored Argon2id hash.
 */
export async function verifyPassword(storedHash, plainPassword) {
  try {
    return await argon2.verify(storedHash, plainPassword);
  } catch  {
    return false;
  }
}


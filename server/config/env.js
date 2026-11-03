import dotenv from 'dotenv';

dotenv.config();

function getRequiredEnv(key, fallback = undefined) {
  const value = process.env[key] || fallback;
  if (!value) {
    throw new Error(`[CONFIG ERROR] Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  PORT: process.env.PORT || '3000',
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? getRequiredEnv('JWT_SECRET') : 'nexxoory-dev-access-jwt-secret-key-32chars-min!'),
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || (process.env.NODE_ENV === 'production' ? getRequiredEnv('JWT_REFRESH_SECRET') : 'nexxoory-dev-refresh-secret-key-32chars-min!'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  REFRESH_TOKEN_EXPIRES_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10),
  PASSWORD_RESET_EXPIRES_MINUTES: parseInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES || '30', 10),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173')
    .split(',')
    .map((o) => o.trim()),
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
};


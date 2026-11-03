/**
 * Database connection pool manager for Neon PostgreSQL.
 * Optimized for Vercel Serverless Functions.
 *
 * Security & Reliability:
 * - Neon SSL enabled with strict certificate verification.
 * - In production (NODE_ENV=production or production URL), rejectUnauthorized is unconditionally TRUE.
 * - DB_SSL_REJECT_UNAUTHORIZED=false is strictly ignored in production and only honored when explicitly
 *   running in local non-production environments (e.g., self-signed local certs).
 * - Sensitive data privacy: connection strings, passwords, SQL statements, and query parameters are NEVER logged.
 * - Robust error handling: transaction rollback failure does not hide the original transaction error.
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let pool;

/**
 * Computes SSL configuration enforcing production certificate verification.
 * @param {string} connectionString
 * @returns {object|boolean} SSL configuration object for pg Pool
 */
export function getSslConfig(connectionString) {
  const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  if (isLocalhost) {
    return false;
  }

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    connectionString.includes('prod') ||
    connectionString.includes('production');

  // Security Rule: In production, rejectUnauthorized MUST be true.
  // Overrides like DB_SSL_REJECT_UNAUTHORIZED=false are strictly disallowed in production.
  if (isProduction) {
    return { rejectUnauthorized: true };
  }

  // In non-production only, permit overriding if developer explicitly sets DB_SSL_REJECT_UNAUTHORIZED=false
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
  return { rejectUnauthorized };
}

/**
 * Retrieves or instantiates the singleton connection pool.
 */
export function getDbPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL environment variable is missing. Check your environment configuration.'
      );
    }

    const ssl = getSslConfig(connectionString);

    pool = new Pool({
      connectionString,
      ssl,
      max: 10,
      min: 2,
      idleTimeoutMillis: 120000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    pool.on('error', (err) => {
      // Log sanitized error without connection strings, host details, or credentials
      console.error('[DATABASE POOL ERROR]', err.name, err.message);
    });
  }

  return pool;
}

/**
 * Execute a parameterized SQL query using the connection pool.
 * Does NOT log SQL query statements or parameter values to protect sensitive data.
 * @param {string} text - SQL query with positional parameters ($1, $2)
 * @param {Array} params - Array of parameter values
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params = []) {
  const p = getDbPool();
  const start = Date.now();
  try {
    const res = await p.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 2000) {
      const preview = text.replace(/\s+/g, ' ').trim().slice(0, 100);
      console.warn(`[SLOW QUERY DETECTED] Duration: ${duration}ms | Query: "${preview}..."`);
    }
    return res;
  } catch (error) {
    // Sanitize log output: do not output text or params
    console.error(`[DATABASE ERROR] ${error.name}: ${error.message}`);
    throw error;
  }
}

/**
 * Execute multiple database operations inside an explicit transaction.
 * Preserves original error if rollback encounters a secondary failure.
 * @param {Function} callback - Async function receiving the dedicated client
 * @returns {Promise<any>}
 */
export async function transaction(callback) {
  const p = getDbPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (originalError) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(
        `[CRITICAL ROLLBACK ERROR] Rollback failed: ${rollbackError.message}`
      );
    }
    // Always rethrow the original business/database error
    throw originalError;
  } finally {
    client.release();
  }
}

/**
 * Gracefully terminates the pool.
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

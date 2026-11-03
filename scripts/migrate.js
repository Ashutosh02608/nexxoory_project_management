/**
 * Database Migration Runner
 * Executes pending SQL migrations in transactional order.
 *
 * Reliability & Safety Features:
 * - Uses PostgreSQL transaction advisory lock (pg_advisory_xact_lock) to serialize runs.
 * - Validates migration filenames strictly (`^\d{3}_[a-zA-Z0-9_-]+\.sql$`) and rejects duplicate version prefixes.
 * - Tracks applied migrations reliably in `schema_migrations`.
 * - Transactional per-migration execution (rolls back on failure).
 * - Safe release of lock and database connections in try/finally.
 * - Never drops production tables or resets database.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getDbPool, closePool } from '../server/config/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.resolve(__dirname, '../database/migrations');

// Unique 64-bit integer advisory lock key for Nexxoory migrations
const ADVISORY_LOCK_ID = 7482910384729102n;

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getExecutedMigrations(client) {
  const result = await client.query('SELECT version FROM schema_migrations ORDER BY id ASC;');
  return new Set(result.rows.map(row => row.version));
}

function loadAndValidateMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found at: ${MIGRATIONS_DIR}`);
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    throw new Error(`No migration SQL files detected in ${MIGRATIONS_DIR}`);
  }

  const seenVersions = new Map();
  const validFiles = [];

  for (const file of files) {
    const match = file.match(/^(\d{3})_([a-zA-Z0-9_-]+)\.sql$/);
    if (!match) {
      throw new Error(`Invalid migration filename format: "${file}". Expected format: 001_name.sql`);
    }

    const version = match[1];
    if (seenVersions.has(version)) {
      throw new Error(`Duplicate migration version detected: "${version}" in "${file}" and "${seenVersions.get(version)}"`);
    }

    seenVersions.set(version, file);
    validFiles.push({ version, name: file, path: path.join(MIGRATIONS_DIR, file) });
  }

  return validFiles;
}

export async function runMigrations() {
  console.log('=== Nexxoory Database Migration Runner ===');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not defined.');
  }

  const pool = getDbPool();
  const client = await pool.connect();

  try {
    // Acquire session advisory lock to prevent concurrent migration runs
    console.log('Acquiring migration advisory lock...');
    await client.query('SELECT pg_advisory_lock($1);', [ADVISORY_LOCK_ID.toString()]);

    try {
      await ensureMigrationTable(client);
      const executed = await getExecutedMigrations(client);
      const migrationFiles = loadAndValidateMigrationFiles();

      let appliedCount = 0;

      for (const m of migrationFiles) {
        if (executed.has(m.version)) {
          console.log(`[ALREADY APPLIED] Migration ${m.name} (v${m.version})`);
          continue;
        }

        console.log(`[EXECUTING] Migration ${m.name}...`);
        const sql = fs.readFileSync(m.path, 'utf8');

        // Execute single migration inside explicit transaction
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (version, name) VALUES ($1, $2);',
            [m.version, m.name]
          );
          await client.query('COMMIT');
          console.log(`[COMMITTED] Migration ${m.name}`);
          appliedCount++;
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`[MIGRATION FAILED] ${m.name}:`, err.message);
          throw err;
        }
      }

      console.log(`\nMigration run completed. Applied: ${appliedCount} new migration(s).`);
    } finally {
      // Always release advisory lock
      await client.query('SELECT pg_advisory_unlock($1);', [ADVISORY_LOCK_ID.toString()]);
      console.log('Migration advisory lock released.');
    }
  } finally {
    client.release();
    await closePool();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL MIGRATION ERROR]', err.message);
      process.exit(1);
    });
}

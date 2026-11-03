/**
 * Migration Status Checker
 * Displays list of all migration files and whether they have been applied.
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

export async function checkMigrationStatus() {
  console.log('--- Checking Migration Status ---');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not defined.');
  }

  const pool = getDbPool();
  const client = await pool.connect();

  try {
    // Check if migration table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'schema_migrations'
      );
    `);

    const tableExists = tableCheck.rows[0].exists;

    let executedMap = new Map();
    if (tableExists) {
      const res = await client.query('SELECT version, name, executed_at FROM schema_migrations ORDER BY id ASC;');
      res.rows.forEach(r => executedMap.set(r.version, r.executed_at));
    }

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log('\nMigration Version | Status  | Executed At              | File');
    console.log('--------------------------------------------------------------------------------');

    for (const file of files) {
      const version = file.split('_')[0];
      const isApplied = executedMap.has(version);
      const executedAt = isApplied ? executedMap.get(version).toISOString() : 'Pending                 ';
      const statusStr = isApplied ? 'APPLIED' : 'PENDING';
      console.log(`${version.padEnd(17)} | ${statusStr.padEnd(7)} | ${executedAt} | ${file}`);
    }

    console.log('--------------------------------------------------------------------------------\n');
  } finally {
    client.release();
    await closePool();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkMigrationStatus()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[STATUS ERROR]', err.message);
      process.exit(1);
    });
}


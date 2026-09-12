import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL is required');
    }
    const local =
      config.databaseUrl.includes('localhost') ||
      config.databaseUrl.includes('127.0.0.1') ||
      config.databaseUrl.includes('railway.internal');
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      ssl: local ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}

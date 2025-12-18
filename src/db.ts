import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '55432'),
  database: process.env.DB_NAME || 'conductor_db',
  user: process.env.DB_USER || 'conductor',
  password: process.env.DB_PASSWORD || 'conductor_pw',
});

export { pool };

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}


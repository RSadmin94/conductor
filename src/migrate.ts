import { readFileSync } from 'fs';
import { query } from './db';

async function migrate() {
  try {
    // Drop existing tables if they exist (in reverse dependency order)
    const dropStatements = [
      'DROP TABLE IF EXISTS audit_logs CASCADE',
      'DROP TABLE IF EXISTS messages CASCADE',
      'DROP TABLE IF EXISTS artifacts CASCADE',
      'DROP TABLE IF EXISTS tasks CASCADE',
      'DROP TABLE IF EXISTS runs CASCADE',
      'DROP TABLE IF EXISTS decisions CASCADE',
      'DROP TABLE IF EXISTS specs CASCADE',
      'DROP TABLE IF EXISTS ideas CASCADE',
      'DROP TABLE IF EXISTS projects CASCADE',
    ];
    
    for (const stmt of dropStatements) {
      try {
        await query(stmt);
      } catch (error: any) {
        console.warn(`Warning dropping table: ${error.message}`);
      }
    }
    
    // Now create fresh schema
    const sql = readFileSync('migrations/001_initial_schema.sql', 'utf-8');
    await query(sql);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();

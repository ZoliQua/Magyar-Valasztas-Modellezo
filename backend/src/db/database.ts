import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'valasztas.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const SEED_PATH = path.join(__dirname, 'seed.sql');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}

export function initDb(): void {
  const database = getDb();

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  database.exec(schema);

  const seed = fs.readFileSync(SEED_PATH, 'utf-8');
  database.exec(seed);

  console.log('Adatbázis inicializálva.');
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

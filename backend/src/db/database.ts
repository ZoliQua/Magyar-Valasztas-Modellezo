import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Csak-olvasható mód: szerver nélküli (serverless) környezetben, pl. Vercel,
 * a fájlrendszer írásvédett, és az adatbázis előre beépített, kész pillanatkép.
 * Ilyenkor a DB-t readonly nyitjuk, és nem futtatunk séma/seed írást.
 */
export const READ_ONLY =
  process.env.DB_READONLY === '1' || !!process.env.VERCEL;

// Az adatbázis elérési útja. Serverless (Vercel) esetén a projekt gyökeréhez
// képest, lokálisan a fordított kódhoz (dist) képest oldjuk fel.
const DB_PATH =
  process.env.DB_PATH ||
  (process.env.VERCEL
    ? path.join(process.cwd(), 'backend', 'data', 'valasztas.db')
    : path.join(__dirname, '..', '..', 'data', 'valasztas.db'));
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const SEED_PATH = path.join(__dirname, 'seed.sql');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  if (READ_ONLY) {
    // Írásvédett: a kész adatbázist nyitjuk, létezését megköveteljük.
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    db.pragma('foreign_keys = ON');
    return db;
  }

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

  // Írásvédett módban a séma/seed már a beépített pillanatképben van — nem írunk.
  if (READ_ONLY) {
    console.log('Adatbázis megnyitva (írásvédett mód).');
    return;
  }

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

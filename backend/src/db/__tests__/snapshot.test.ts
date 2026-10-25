import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SNAPSHOT = path.join(__dirname, '..', '..', '..', 'data', 'valasztas.db');

describe('verziókövetett adatbázis-pillanatkép', () => {
  // Vercelen a DB readonly nyílik írásvédett fájlrendszeren: WAL módban az
  // SQLite -shm fájlt hozna létre, ami "unable to open database file" hibát ad.
  it.skipIf(!fs.existsSync(SNAPSHOT))('rollback journal módban van (nem WAL)', () => {
    const header = Buffer.alloc(20);
    const fd = fs.openSync(SNAPSHOT, 'r');
    fs.readSync(fd, header, 0, 20, 0);
    fs.closeSync(fd);
    expect(header.subarray(0, 15).toString()).toBe('SQLite format 3');
    // 18–19. bájt: írási/olvasási formátumverzió — 1 = rollback journal, 2 = WAL
    expect([header[18], header[19]]).toEqual([1, 1]);
  });
});

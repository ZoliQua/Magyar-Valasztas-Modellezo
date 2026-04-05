import { initDb, closeDb } from './database';
import { seedDemoOevk } from './seed-demo-oevk';

console.log('Adatbázis inicializálás...');
initDb();
seedDemoOevk();
closeDb();
console.log('Kész.');

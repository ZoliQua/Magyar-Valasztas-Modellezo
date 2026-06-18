// Vercel serverless belépési pont.
//
// A teljes /api/* forgalmat ez a függvény szolgálja ki: a meglévő Express
// alkalmazást importáljuk és handlerként exportáljuk. Az index.ts a VERCEL
// környezeti változó alapján NEM indít saját HTTP szervert, és az adatbázist
// írásvédett módban nyitja (beépített, kész pillanatkép — lásd database.ts).
import app from '../backend/src/index';

export default app;

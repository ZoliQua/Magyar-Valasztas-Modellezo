import express from 'express';
import cors from 'cors';
import { initDb } from './db/database';
import { electionsRouter } from './routes/elections';
import { partiesRouter } from './routes/parties';
import { pollsRouter } from './routes/polls';
import { simulateRouter } from './routes/simulate';
import { simulationsRouter } from './routes/simulations';
import { oevkRouter } from './routes/oevk';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Adatbázis inicializálás
initDb();

// API útvonalak
app.use('/api/elections', electionsRouter);
app.use('/api/parties', partiesRouter);
app.use('/api/polls', pollsRouter);
app.use('/api/simulate', simulateRouter);
app.use('/api/simulations', simulationsRouter);
app.use('/api/oevk', oevkRouter);

// Egészségügyi ellenőrzés
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

app.listen(PORT, () => {
  console.log(`Választási Modellező backend fut: http://localhost:${PORT}`);
});

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath as _ftu } from 'url';
config({ path: resolve(dirname(_ftu(import.meta.url)), '..', '.env') });
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import parlaysRouter from './routes/parlays.js';
import gamesRouter from './routes/games.js';
import { startPoller } from './poller.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3001';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.use('/api/parlays', parlaysRouter);
app.use('/api/games', gamesRouter);
app.get('/api/health', (req, res) => res.json({ ok: true }));

const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));

startPoller(null); // Supabase Realtime handles push; poller just updates DB rows
app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));

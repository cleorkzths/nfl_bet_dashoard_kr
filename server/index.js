import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath as _ftu } from 'url';
config({ path: resolve(dirname(_ftu(import.meta.url)), '..', '.env') });
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db/schema.js';
import parlaysRouter from './routes/parlays.js';
import gamesRouter from './routes/games.js';
import { startPoller } from './poller.js';
import { getAllParlays } from './db/queries.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3001';

const app = express();
const httpServer = createServer(app);
const io = new SocketIO(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
});

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.use('/api/parlays', parlaysRouter);
app.use('/api/games', gamesRouter);
app.get('/api/health', (req, res) => res.json({ ok: true }));

const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));

io.on('connection', async (socket) => {
  console.log('[socket] client connected:', socket.id);
  socket.emit('parlays:update', await getAllParlays());
  socket.on('disconnect', () => console.log('[socket] client disconnected:', socket.id));
});

async function main() {
  await getDb(); // init JSON db
  startPoller(io);
  httpServer.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
}

main().catch(console.error);

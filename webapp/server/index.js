import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAd,
  deleteAd,
  ensureLocalStorage,
  getPublicPlaylist,
  updateAd,
  useBlobStorage
} from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const storageDir = path.join(rootDir, 'storage');
const uploadDir = path.join(storageDir, 'uploads');
const port = Number(process.env.PORT || 4173);

await ensureLocalStorage();

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use('/uploads', express.static(uploadDir, { immutable: true, maxAge: '1y' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    storage: useBlobStorage ? 'vercel-blob' : 'local-disk'
  });
});

app.get('/api/playlist', async (_req, res, next) => {
  try {
    res.json(await getPublicPlaylist());
  } catch (error) {
    next(error);
  }
});

app.post('/api/ads', async (req, res, next) => {
  try {
    res.status(201).json(await createAd(req.body));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/ads/:id', async (req, res, next) => {
  try {
    res.json(await updateAd(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/ads/:id', async (req, res, next) => {
  try {
    await deleteAd(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(rootDir, 'dist');
  app.use(express.static(distDir));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Unexpected server error.' : error.message
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Dart Kiosk API listening on http://localhost:${port}`);
});

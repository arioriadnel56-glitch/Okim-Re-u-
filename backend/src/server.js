import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initSchema } from './db.js';

import authRoutes from './routes/auth.routes.js';
import sitesRoutes from './routes/sites.routes.js';
import staffRoutes from './routes/staff.routes.js';
import sessionsRoutes from './routes/sessions.routes.js';
import receiptsRoutes from './routes/receipts.routes.js';
import verifyRoutes from './routes/verify.routes.js';
import statsRoutes from './routes/stats.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, service: "OKIM'ART API" }));

app.use('/api/auth', authRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/receipts', receiptsRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/stats', statsRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Route API introuvable.' }));

// eslint-disable-next-line no-unused-vars
app.use('/api', (err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

// Serve the built frontend (frontend/dist) as a single deployable service, if present.
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send("OKIM'ART API en cours d'exécution. Le frontend n'a pas encore été compilé (frontend/dist introuvable).");
  });
}

initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`OKIM'ART API démarrée sur le port ${PORT}`);
    });
  })
  .catch((e) => {
    console.error('Impossible de préparer le schéma PostgreSQL au démarrage :', e);
    process.exit(1);
  });

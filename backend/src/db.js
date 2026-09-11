import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn(
    "⚠️  DATABASE_URL n'est pas défini. Configurez la connexion PostgreSQL dans .env (voir .env.example)."
  );
}

// Render (et la plupart des hébergeurs Postgres managés) exigent SSL, mais avec un certificat
// auto-signé côté serveur : on désactive donc la vérification stricte, comme documenté par Render.
const sslEnabled =
  process.env.PGSSL === 'true' ||
  (connectionString && !/localhost|127\.0\.0\.1/.test(connectionString) && process.env.PGSSL !== 'false');

export const pool = new Pool({
  connectionString,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Erreur inattendue du pool PostgreSQL :', err);
});

/** Exécute une requête et retourne la première ligne (ou undefined). */
export async function dbGet(text, params = []) {
  const { rows } = await pool.query(text, params);
  return rows[0];
}

/** Exécute une requête et retourne toutes les lignes. */
export async function dbAll(text, params = []) {
  const { rows } = await pool.query(text, params);
  return rows;
}

/** Exécute une requête sans se soucier du résultat (INSERT/UPDATE/DELETE sans RETURNING). */
export async function dbRun(text, params = []) {
  return pool.query(text, params);
}

/** Crée le schéma s'il n'existe pas encore. Idempotent — sans danger à ré-exécuter. */
export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sites (
      id SERIAL PRIMARY KEY,
      nom TEXT NOT NULL,
      ville TEXT NOT NULL,
      adresse TEXT,
      telephone TEXT,
      actif BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('super_admin','staff','client')),
      site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
      nom TEXT NOT NULL,
      telephone TEXT NOT NULL UNIQUE,
      email TEXT,
      password_hash TEXT NOT NULL,
      doit_changer_mdp BOOLEAN NOT NULL DEFAULT FALSE,
      actif BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions_photo (
      id SERIAL PRIMARY KEY,
      site_id INTEGER NOT NULL REFERENCES sites(id),
      client_id INTEGER NOT NULL REFERENCES users(id),
      staff_id INTEGER NOT NULL REFERENCES users(id),
      type_seance TEXT NOT NULL,
      date_seance TEXT NOT NULL,
      description TEXT,
      montant_total DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id SERIAL PRIMARY KEY,
      numero TEXT NOT NULL UNIQUE,
      code_verification TEXT NOT NULL UNIQUE,
      session_id INTEGER NOT NULL REFERENCES sessions_photo(id),
      site_id INTEGER NOT NULL REFERENCES sites(id),
      client_id INTEGER NOT NULL REFERENCES users(id),
      montant_total DOUBLE PRECISION NOT NULL DEFAULT 0,
      montant_paye DOUBLE PRECISION NOT NULL DEFAULT 0,
      statut_paiement TEXT NOT NULL DEFAULT 'partiel' CHECK (statut_paiement IN ('partiel','complet')),
      statut_livraison TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut_livraison IN ('en_attente','en_traitement','pret','livre')),
      methode_livraison TEXT NOT NULL DEFAULT 'retrait_studio' CHECK (methode_livraison IN ('retrait_studio','lien_telechargement','livraison_physique')),
      nb_photos INTEGER NOT NULL DEFAULT 0,
      nb_videos INTEGER NOT NULL DEFAULT 0,
      lien_telechargement TEXT,
      note TEXT,
      date_pret TIMESTAMPTZ,
      date_livraison TIMESTAMPTZ,
      confirme_par_client BOOLEAN NOT NULL DEFAULT FALSE,
      confirme_at TIMESTAMPTZ,
      email_envoye_at TIMESTAMPTZ,
      email_envoye_a TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
      montant DOUBLE PRECISION NOT NULL,
      mode_paiement TEXT NOT NULL,
      staff_id INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS delivery_history (
      id SERIAL PRIMARY KEY,
      receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
      ancien_statut TEXT,
      nouveau_statut TEXT NOT NULL,
      changed_by INTEGER REFERENCES users(id),
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_receipts_site ON receipts(site_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_client ON receipts(client_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_site ON sessions_photo(site_id);
    CREATE INDEX IF NOT EXISTS idx_users_site ON users(site_id);
  `);

  // Corbeille (suppression douce) des reçus : une secrétaire ne peut que "demander" la
  // suppression, en la justifiant ; seul le super admin peut ensuite valider (suppression
  // définitive) ou restaurer, dans un délai de 30 jours.
  await pool.query(`
    ALTER TABLE receipts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE receipts ADD COLUMN IF NOT EXISTS delete_status TEXT NOT NULL DEFAULT 'aucune'
      CHECK (delete_status IN ('aucune','en_attente','refusee'));
    ALTER TABLE receipts ADD COLUMN IF NOT EXISTS delete_reason TEXT;
    ALTER TABLE receipts ADD COLUMN IF NOT EXISTS delete_requested_by INTEGER REFERENCES users(id);
    ALTER TABLE receipts ADD COLUMN IF NOT EXISTS delete_requested_at TIMESTAMPTZ;
    ALTER TABLE receipts ADD COLUMN IF NOT EXISTS delete_reviewed_by INTEGER REFERENCES users(id);
    ALTER TABLE receipts ADD COLUMN IF NOT EXISTS delete_reviewed_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_receipts_delete_status ON receipts(delete_status);

    -- Archive conservée même après suppression définitive d'un reçu, pour garder une trace
    -- (numéro, motif, qui a demandé/validé) à des fins de contrôle interne.
    CREATE TABLE IF NOT EXISTS receipts_deleted_archive (
      id SERIAL PRIMARY KEY,
      receipt_id INTEGER NOT NULL,
      numero TEXT NOT NULL,
      code_verification TEXT,
      site_id INTEGER,
      client_id INTEGER,
      montant_total DOUBLE PRECISION,
      montant_paye DOUBLE PRECISION,
      motif TEXT,
      demande_par INTEGER REFERENCES users(id),
      demande_par_nom TEXT,
      demande_at TIMESTAMPTZ,
      valide_par INTEGER REFERENCES users(id),
      valide_par_nom TEXT,
      valide_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      receipt_snapshot JSONB
    );
  `);
}
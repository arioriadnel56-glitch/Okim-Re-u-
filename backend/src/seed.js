import 'dotenv/config';
import { dbGet, initSchema, pool } from './db.js';
import { hashPassword } from './auth.js';

const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE || '0198874300';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || '12345678';

async function main() {
  await initSchema();

  const existingAdmin = await dbGet("SELECT * FROM users WHERE role = 'super_admin' LIMIT 1");

  if (existingAdmin) {
    console.log('Un compte super administrateur existe déjà. Aucune action effectuée.');
    return;
  }

  const site = await dbGet(
    'INSERT INTO sites (nom, ville, adresse, telephone) VALUES ($1, $2, $3, $4) RETURNING id',
    ["OKIM'ART — Studio principal", 'Porto-Novo', 'Porto-Novo, Bénin', '0198874300']
  );

  await dbGet(
    `INSERT INTO users (role, site_id, nom, telephone, email, password_hash, doit_changer_mdp)
     VALUES ('super_admin', NULL, $1, $2, $3, $4, TRUE) RETURNING id`,
    ['Marcellino Kouati', ADMIN_PHONE, 'contact@okimart.studio', hashPassword(ADMIN_PASSWORD)]
  );

  await dbGet(
    `INSERT INTO users (role, site_id, nom, telephone, email, password_hash, doit_changer_mdp)
     VALUES ('staff', $1, $2, $3, $4, $5, TRUE) RETURNING id`,
    [site.id, 'Secrétariat Porto-Novo', '0153431251', null, hashPassword('secretariat2026')]
  );

  console.log('Base de données initialisée avec succès.');
  console.log('---------------------------------------------------');
  console.log('Compte Super Administrateur :');
  console.log(`  Téléphone : ${ADMIN_PHONE}`);
  console.log(`  Mot de passe : ${ADMIN_PASSWORD}`);
  console.log('  (changement de mot de passe demandé à la première connexion)');
  console.log('');
  console.log('Compte Staff (site Porto-Novo) :');
  console.log('  Téléphone : 0153431251');
  console.log('  Mot de passe : secretariat2026');
  console.log('---------------------------------------------------');
}

main()
  .catch((e) => {
    console.error("Erreur lors de l'initialisation :", e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

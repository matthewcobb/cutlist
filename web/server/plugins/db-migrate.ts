import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from '~/server/db';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineNitroPlugin(async () => {
  // In dev: cwd is the web/ directory
  // In production: migrations should be run separately via drizzle-kit migrate
  const candidates = [
    resolve(process.cwd(), 'server/db/migrations'),
    resolve(process.cwd(), '.output/server/db/migrations'),
  ];

  const migrationsFolder = candidates.find((p) => existsSync(p));
  if (!migrationsFolder) {
    console.warn('[db] Migrations folder not found, skipping auto-migrate');
    return;
  }

  console.log(`[db] Running migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log('[db] Migrations complete');
});

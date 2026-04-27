import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Enabling PostGIS extension...');
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS postgis`);
  console.log('✅ PostGIS enabled');

  // Verify
  const [{ version }] = await db.execute<{ version: string }>(
    sql`SELECT PostGIS_Version() as version`
  );
  console.log(`   Version: ${version}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});

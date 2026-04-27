import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

/**
 * Merge staging tables into production.
 *
 * Strategy:
 *   1. Upsert staging_competitors → competitors (slug is the natural key)
 *   2. For services: delete old services for competitors that exist in staging,
 *      then insert staging_services
 *   3. Truncate staging tables when done
 *
 * This preserves production competitors that are NOT in staging (safe merge).
 */

async function mergeStagingToProduction() {
  console.log('🔀 Starting staging → production merge');

  // 1. Count staging data
  const [{ competitorCount }] = await db.execute<{ competitorCount: bigint }>(
    sql`SELECT COUNT(*) as "competitorCount" FROM staging_competitors`
  );
  const [{ serviceCount }] = await db.execute<{ serviceCount: bigint }>(
    sql`SELECT COUNT(*) as "serviceCount" FROM staging_services`
  );

  console.log(`   Staging: ${competitorCount} competitors, ${serviceCount} services`);

  if (Number(competitorCount) === 0) {
    console.log('   ⚠️ No data in staging — nothing to merge');
    return;
  }

  // 2. Upsert competitors
  console.log('   → Upserting competitors...');
  const [{ upsertedCompetitors }] = await db.execute<{ upsertedCompetitors: bigint }>(sql`
    WITH inserted AS (
      INSERT INTO competitors (
        name, slug, fresha_pid, business_type, address, city,
        latitude, longitude, location, rating, reviews_count, phone,
        fetched_at, created_at
      )
      SELECT
        sc.name, sc.slug, sc.fresha_pid, sc.business_type, sc.address, sc.city,
        sc.latitude, sc.longitude, sc.location, sc.rating, sc.reviews_count, sc.phone,
        sc.fetched_at, sc.created_at
      FROM staging_competitors sc
      ON CONFLICT (slug) DO UPDATE SET
        name         = EXCLUDED.name,
        fresha_pid   = EXCLUDED.fresha_pid,
        business_type = EXCLUDED.business_type,
        address      = EXCLUDED.address,
        city         = EXCLUDED.city,
        latitude     = EXCLUDED.latitude,
        longitude    = EXCLUDED.longitude,
        location     = EXCLUDED.location,
        rating       = EXCLUDED.rating,
        reviews_count = EXCLUDED.reviews_count,
        phone        = EXCLUDED.phone,
        fetched_at   = EXCLUDED.fetched_at
      RETURNING id
    )
    SELECT COUNT(*) as "upsertedCompetitors" FROM inserted
  `);

  // 3. Sync services for competitors that exist in staging
  //    Strategy: delete all services for these competitors, then insert fresh staging services
  console.log('   → Syncing services...');
  const [{ deletedServices }] = await db.execute<{ deletedServices: bigint }>(sql`
    WITH deleted AS (
      DELETE FROM services s
      WHERE s.competitor_id IN (SELECT sc.id FROM staging_competitors sc)
      RETURNING s.id
    )
    SELECT COUNT(*) as "deletedServices" FROM deleted
  `);

  const [{ insertedServices }] = await db.execute<{ insertedServices: bigint }>(sql`
    WITH inserted AS (
      INSERT INTO services (
        competitor_id, category_name, name, duration_caption,
        price_formatted, price_value_min, price_value_max, catalog_id
      )
      SELECT
        ss.competitor_id, ss.category_name, ss.name, ss.duration_caption,
        ss.price_formatted, ss.price_value_min, ss.price_value_max, ss.catalog_id
      FROM staging_services ss
      WHERE ss.competitor_id IN (SELECT sc.id FROM staging_competitors sc)
      RETURNING id
    )
    SELECT COUNT(*) as "insertedServices" FROM inserted
  `);

  console.log(`   ✅ Competitors upserted: ${upsertedCompetitors}`);
  console.log(`   ✅ Services replaced: ${deletedServices} deleted, ${insertedServices} inserted`);

  // 4. Clear staging
  console.log('   🧹 Truncating staging tables...');
  await db.execute(sql`TRUNCATE TABLE staging_services, staging_competitors CASCADE`);

  console.log('\n✅ Merge complete');
}

async function main() {
  await mergeStagingToProduction();
  process.exit(0);
}

main().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});

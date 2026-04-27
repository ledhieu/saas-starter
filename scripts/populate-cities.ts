import { db } from '@/lib/db/drizzle';
import { stagingCompetitors, stagingServices } from '@/lib/db/schema';
import {
  fetchAllFreshaLocations,
  fetchMenuForSlug,
  extractPriceValues,
  parseActionId,
} from '@/lib/fresha';
import { sql } from 'drizzle-orm';

const CITIES = [
  { name: 'Vancouver, BC', lat: 49.2827, lng: -123.1207, distance: 50 },
  { name: 'Toronto, ON', lat: 43.6532, lng: -79.3832, distance: 50 },
  { name: 'Ho Chi Minh City', lat: 10.8231, lng: 106.6297, distance: 50 },
  { name: 'Hanoi', lat: 21.0278, lng: 105.8342, distance: 50 },
];

const QUERY = 'nail salon';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function clearStaging() {
  console.log('🧹 Clearing staging tables...');
  await db.execute(sql`TRUNCATE TABLE staging_services, staging_competitors CASCADE`);
  console.log('   Staging tables cleared');
}

async function populateCity(city: (typeof CITIES)[0]) {
  console.log(`\n🌆 ${city.name} — fetching competitors within ${city.distance}km...`);

  const nodes = await fetchAllFreshaLocations({
    lat: city.lat,
    lng: city.lng,
    query: QUERY,
    distance: city.distance,
    batchSize: 200,
  });

  console.log(`   Found ${nodes.length} competitors`);

  const inserted: { id: number; slug: string }[] = [];

  for (const node of nodes) {
    try {
      const result = await db
        .insert(stagingCompetitors)
        .values({
          name: node.name,
          slug: node.slug,
          freshaPid: node.id,
          businessType: QUERY,
          address: node.address?.shortFormatted ?? null,
          city: node.address?.cityName ?? null,
          latitude: node.address?.latitude ?? null,
          longitude: node.address?.longitude ?? null,
          rating: node.rating ?? null,
          reviewsCount: node.reviewsCount ?? null,
        })
        .onConflictDoNothing({ target: stagingCompetitors.slug })
        .returning({ id: stagingCompetitors.id, slug: stagingCompetitors.slug });

      if (result.length > 0) {
        inserted.push(result[0]);
      }
    } catch (err) {
      console.error(`   ❌ Failed to insert ${node.slug}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`   Inserted ${inserted.length} new competitors (${nodes.length - inserted.length} duplicates skipped)`);

  // Fetch menus for newly inserted competitors
  if (inserted.length > 0) {
    console.log(`   Fetching menus for ${inserted.length} new competitors...`);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < inserted.length; i++) {
      const { id, slug } = inserted[i];
      try {
        const categories = await fetchMenuForSlug(slug);

        if (categories && categories.length > 0) {
          const serviceValues = categories.flatMap((cat) =>
            cat.items.map((item) => {
              const parsed = extractPriceValues(item.price?.formatted);
              const action = item.primaryAction?.id
                ? parseActionId(item.primaryAction.id)
                : { catalogId: null, variants: [] };

              return {
                competitorId: id,
                categoryName: cat.name,
                name: item.name,
                durationCaption: item.caption ?? null,
                priceFormatted: item.price?.formatted ?? null,
                priceValueMin: parsed.min != null ? Math.round(parsed.min) : null,
                priceValueMax: parsed.max != null ? Math.round(parsed.max) : null,
                catalogId: action.catalogId,
              };
            })
          );

          if (serviceValues.length > 0) {
            await db.insert(stagingServices).values(serviceValues).onConflictDoNothing();
          }
          successCount++;
        }
      } catch (err) {
        failCount++;
        console.error(`   ❌ Menu fetch failed for ${slug}:`, err instanceof Error ? err.message : err);
      }

      // Throttle between menu fetches to be respectful to Fresha
      if (i < inserted.length - 1) {
        await sleep(500);
      }

      // Progress log every 10 competitors
      if ((i + 1) % 10 === 0) {
        console.log(`     ... ${i + 1}/${inserted.length} menus fetched (${successCount} ok, ${failCount} failed)`);
      }
    }

    console.log(`   ✅ Menus: ${successCount} fetched, ${failCount} failed`);
  }
}

async function main() {
  console.log('🚀 Starting city population script');
  console.log(`   Query: "${QUERY}"`);
  console.log(`   Cities: ${CITIES.map((c) => c.name).join(', ')}`);
  console.log('   Writing to: staging_competitors + staging_services');

  await clearStaging();

  for (const city of CITIES) {
    await populateCity(city);
  }

  console.log('\n✅ All cities written to staging');
  console.log('   Next: run `npx tsx scripts/merge-staging.ts` to merge to production');
  process.exit(0);
}

main().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});

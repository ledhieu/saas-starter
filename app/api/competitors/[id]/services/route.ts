import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { competitors, services } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { fetchMenuForSlug } from '@/lib/fresha';
import { extractPriceValues, parseActionId } from '@/lib/fresha/menu';

const STALE_HOURS = 24;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const competitorId = parseInt(id, 10);
    if (isNaN(competitorId)) {
      return NextResponse.json(
        { error: 'Invalid competitor id' },
        { status: 400 }
      );
    }

    const competitor = await db
      .select()
      .from(competitors)
      .where(eq(competitors.id, competitorId))
      .limit(1);

    if (competitor.length === 0) {
      return NextResponse.json(
        { error: 'Competitor not found' },
        { status: 404 }
      );
    }

    let result = await db
      .select()
      .from(services)
      .where(eq(services.competitorId, competitorId));

    const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);
    const isStale =
      !competitor[0].fetchedAt || competitor[0].fetchedAt < staleThreshold;

    // Re-fetch if none exist or data is stale and we have a slug
    if ((result.length === 0 || isStale) && competitor[0].slug) {
      try {
        const menu = await fetchMenuForSlug(competitor[0].slug);
        if (menu && menu.length > 0) {
          await db
            .delete(services)
            .where(eq(services.competitorId, competitorId));

          const serviceRows: (typeof services.$inferInsert)[] = [];
          for (const category of menu) {
            for (const item of category.items) {
              const ids = parseActionId(item.primaryAction?.id || '[]');
              const prices = extractPriceValues(item.price?.formatted);
              serviceRows.push({
                competitorId,
                categoryName: category.name || null,
                name: item.name,
                durationCaption: item.caption || null,
                priceFormatted: item.price?.formatted || null,
                priceValueMin: prices.min != null ? Math.round(prices.min) : null,
                priceValueMax: prices.max != null ? Math.round(prices.max) : null,
                catalogId: ids.catalogId,
                fetchedAt: new Date(),
              });
            }
          }

          if (serviceRows.length > 0) {
            result = await db
              .insert(services)
              .values(serviceRows)
              .returning();
          }

          await db
            .update(competitors)
            .set({ fetchedAt: new Date() })
            .where(eq(competitors.id, competitorId));
        }
      } catch (e) {
        console.warn(
          `Failed to re-fetch services for ${competitor[0].slug}:`
        );
      }
    }

    return NextResponse.json({ services: result });
  } catch (error) {
    console.error('Services fetch error:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

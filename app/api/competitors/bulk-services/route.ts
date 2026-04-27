import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { competitors, services } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { fetchMenuForSlug } from '@/lib/fresha';
import { extractPriceValues, parseActionId } from '@/lib/fresha/menu';
import { recordServiceChange } from '@/lib/db/queries';

const STALE_DAYS = 7;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      competitorIds: number[];
      forceRefresh?: boolean;
    };

    const { competitorIds, forceRefresh = false } = body;
    if (!Array.isArray(competitorIds) || competitorIds.length === 0) {
      return NextResponse.json(
        { error: 'competitorIds must be a non-empty array' },
        { status: 400 }
      );
    }

    const staleThreshold = new Date(Date.now() - STALE_MS);
    const servicesByCompetitor: Record<
      number,
      (typeof services.$inferSelect)[]
    > = {};
    const lastUpdated: Record<number, string | null> = {};
    const isStale: Record<number, boolean> = {};

    let madeFreshaCall = false;

    for (const competitorId of competitorIds) {
      try {
        const competitorRows = await db
          .select()
          .from(competitors)
          .where(eq(competitors.id, competitorId))
          .limit(1);

        if (competitorRows.length === 0) {
          servicesByCompetitor[competitorId] = [];
          lastUpdated[competitorId] = null;
          isStale[competitorId] = false;
          continue;
        }

        const competitor = competitorRows[0];

        // Always return cached data if it exists; only refetch on forceRefresh
        const cached = await db
          .select()
          .from(services)
          .where(eq(services.competitorId, competitorId));

        const mostRecent = cached.length > 0
          ? cached.reduce((a, b) =>
              new Date(a.fetchedAt) > new Date(b.fetchedAt) ? a : b
            )
          : null;

        lastUpdated[competitorId] = mostRecent?.fetchedAt
          ? new Date(mostRecent.fetchedAt).toISOString()
          : null;
        isStale[competitorId] = mostRecent
          ? new Date(mostRecent.fetchedAt) < staleThreshold
          : true;

        const hasCache = cached.length > 0;

        if (hasCache && !forceRefresh) {
          servicesByCompetitor[competitorId] = cached;
          continue;
        }

        if (!competitor.slug) {
          servicesByCompetitor[competitorId] = [];
          continue;
        }

        // Throttle between Fresha API calls
        if (madeFreshaCall) {
          await new Promise((r) => setTimeout(r, 500));
        }
        madeFreshaCall = true;

        const menu = await fetchMenuForSlug(competitor.slug);

        // Snapshot old services before deleting (for audit comparison)
        const oldServices = await db
          .select()
          .from(services)
          .where(eq(services.competitorId, competitorId));

        // Delete old services
        await db
          .delete(services)
          .where(eq(services.competitorId, competitorId));

        let inserted: (typeof services.$inferSelect)[] = [];
        const newServiceMap = new Map<string, typeof services.$inferInsert>();

        if (menu && menu.length > 0) {
          const serviceRows: (typeof services.$inferInsert)[] = [];
          for (const category of menu) {
            for (const item of category.items) {
              const ids = parseActionId(item.primaryAction?.id || '[]');
              const prices = extractPriceValues(item.price?.formatted);
              const row = {
                competitorId,
                categoryName: category.name || null,
                name: item.name,
                durationCaption: item.caption || null,
                priceFormatted: item.price?.formatted || null,
                priceValueMin: prices.min != null ? Math.round(prices.min) : null,
                priceValueMax: prices.max != null ? Math.round(prices.max) : null,
                catalogId: ids.catalogId,
                fetchedAt: new Date(),
              };
              serviceRows.push(row);
              const key = ids.catalogId || item.name;
              newServiceMap.set(key, row);
            }
          }

          if (serviceRows.length > 0) {
            inserted = await db
              .insert(services)
              .values(serviceRows)
              .returning();
          }
        }

        // Audit log: compare old vs new services
        for (const old of oldServices) {
          const key = old.catalogId || old.name;
          const newRow = newServiceMap.get(key);

          if (!newRow) {
            // Service removed
            await recordServiceChange({
              competitorId,
              catalogId: old.catalogId ?? null,
              serviceName: old.name,
              field: 'name',
              oldValue: old.name,
              newValue: null,
            });
            continue;
          }

          if (old.name !== newRow.name) {
            await recordServiceChange({
              competitorId,
              catalogId: old.catalogId ?? null,
              serviceName: old.name,
              field: 'name',
              oldValue: old.name,
              newValue: newRow.name,
            });
          }
          if (old.priceFormatted !== newRow.priceFormatted) {
            await recordServiceChange({
              competitorId,
              catalogId: old.catalogId ?? null,
              serviceName: old.name,
              field: 'price',
              oldValue: old.priceFormatted ?? null,
              newValue: newRow.priceFormatted ?? null,
            });
          }
          if (old.durationCaption !== newRow.durationCaption) {
            await recordServiceChange({
              competitorId,
              catalogId: old.catalogId ?? null,
              serviceName: old.name,
              field: 'duration',
              oldValue: old.durationCaption ?? null,
              newValue: newRow.durationCaption ?? null,
            });
          }
          if (old.categoryName !== newRow.categoryName) {
            await recordServiceChange({
              competitorId,
              catalogId: old.catalogId ?? null,
              serviceName: old.name,
              field: 'category',
              oldValue: old.categoryName ?? null,
              newValue: newRow.categoryName ?? null,
            });
          }

          newServiceMap.delete(key);
        }

        // Remaining entries in newServiceMap are brand-new services
        for (const [, newRow] of newServiceMap) {
          await recordServiceChange({
            competitorId,
            catalogId: newRow.catalogId ?? null,
            serviceName: newRow.name,
            field: 'name',
            oldValue: null,
            newValue: newRow.name,
          });
        }

        servicesByCompetitor[competitorId] = inserted;
        lastUpdated[competitorId] = new Date().toISOString();
        isStale[competitorId] = false;
      } catch (err) {
        console.error(
          `Error fetching services for competitor ${competitorId}:`,
          err
        );
        servicesByCompetitor[competitorId] = [];
      }
    }

    return NextResponse.json({ servicesByCompetitor, lastUpdated, isStale });
  } catch (error) {
    console.error('Bulk services fetch error:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

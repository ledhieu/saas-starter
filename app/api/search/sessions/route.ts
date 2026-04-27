import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { searchSessions, searchSessionCompetitors, competitors } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { eq, desc, inArray } from 'drizzle-orm';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessions = await db
      .select({
        id: searchSessions.id,
        addressQuery: searchSessions.addressQuery,
        radiusKm: searchSessions.radiusKm,
        businessType: searchSessions.businessType,
        latitude: searchSessions.latitude,
        longitude: searchSessions.longitude,
        resultsCount: searchSessions.resultsCount,
        cursor: searchSessions.cursor,
        createdAt: searchSessions.createdAt,
      })
      .from(searchSessions)
      .where(eq(searchSessions.userId, session.user.id))
      .orderBy(desc(searchSessions.createdAt));

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Search sessions GET error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      addressQuery?: string;
      radiusKm?: number;
      businessType?: string;
      lat?: number;
      lng?: number;
      resultsCount?: number;
      competitorIds?: number[];
      cursor?: string | null;
    };

    const { addressQuery, radiusKm, businessType, lat, lng, resultsCount, competitorIds, cursor } = body;

    const [searchSession] = await db
      .insert(searchSessions)
      .values({
        userId: session.user.id,
        addressQuery: addressQuery || null,
        radiusKm: radiusKm != null ? Number(radiusKm) : null,
        businessType: businessType || null,
        latitude: lat != null ? String(lat) : null,
        longitude: lng != null ? String(lng) : null,
        resultsCount: resultsCount != null ? Number(resultsCount) : null,
        cursor: cursor || null,
      })
      .returning();

    if (competitorIds && competitorIds.length > 0 && searchSession) {
      // Fetch competitor lat/lng to compute distances if search center is known
      let competitorData: Array<{ id: number; latitude: string | null; longitude: string | null }> = [];
      if (lat != null && lng != null) {
        competitorData = await db
          .select({ id: competitors.id, latitude: competitors.latitude, longitude: competitors.longitude })
          .from(competitors)
          .where(inArray(competitors.id, competitorIds));
      }

      const competitorMap = new Map(competitorData.map((c) => [c.id, c]));

      const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLng = ((lng2 - lng1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      const joinRows = competitorIds.map((cid) => {
        const c = competitorMap.get(cid);
        let distanceKm = null as string | null;
        if (lat != null && lng != null && c?.latitude && c?.longitude) {
          distanceKm = String(haversineKm(lat, lng, parseFloat(c.latitude), parseFloat(c.longitude)));
        }
        return {
          sessionId: searchSession.id,
          competitorId: cid,
          distanceKm,
        };
      });

      await db.insert(searchSessionCompetitors).values(joinRows);
    }

    return NextResponse.json({ session: searchSession });
  } catch (error) {
    console.error('Search sessions POST error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

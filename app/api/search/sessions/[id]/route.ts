import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { searchSessions, searchSessionCompetitors, competitors } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const sessionId = Number(id);
    if (!id || isNaN(sessionId)) {
      return NextResponse.json({ error: 'Valid session id is required' }, { status: 400 });
    }

    const [searchSession] = await db
      .select()
      .from(searchSessions)
      .where(
        and(
          eq(searchSessions.id, sessionId),
          eq(searchSessions.userId, session.user.id)
        )
      )
      .limit(1);

    if (!searchSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const competitorRows = await db
      .select({
        id: competitors.id,
        name: competitors.name,
        slug: competitors.slug,
        freshaPid: competitors.freshaPid,
        businessType: competitors.businessType,
        address: competitors.address,
        city: competitors.city,
        latitude: competitors.latitude,
        longitude: competitors.longitude,
        rating: competitors.rating,
        reviewsCount: competitors.reviewsCount,
        phone: competitors.phone,
        fetchedAt: competitors.fetchedAt,
        createdAt: competitors.createdAt,
        distanceKm: searchSessionCompetitors.distanceKm,
      })
      .from(searchSessionCompetitors)
      .innerJoin(competitors, eq(searchSessionCompetitors.competitorId, competitors.id))
      .where(eq(searchSessionCompetitors.sessionId, sessionId));

    return NextResponse.json({
      session: searchSession,
      competitors: competitorRows,
    });
  } catch (error) {
    console.error('Search session GET error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

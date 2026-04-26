import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { competitors } from '@/lib/db/schema';
import { eq, and, like, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const radiusKm = searchParams.get('radiusKm');
    const businessType = searchParams.get('businessType');

    // For now, return all competitors filtered by businessType if provided.
    // Exact haversine filtering can be added later.
    const conditions = [];

    if (businessType) {
      conditions.push(eq(competitors.businessType, businessType));
    }

    const result = await db
      .select()
      .from(competitors)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return NextResponse.json({ competitors: result });
  } catch (error) {
    console.error('Competitors fetch error:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

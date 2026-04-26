import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { competitors, searchLookups, tempDisputes } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { captureException } from '@/lib/sentry';
import {
  discoverCompetitors,
  fetchAllFreshaLocations,
  buildFreshaSearchRequest,
} from '@/lib/fresha';

const GOOGLE_GEOCODING_URL =
  'https://maps.googleapis.com/maps/api/geocode/json';
const MAX_FRESHA_RESULTS = 200; // Fresha caps at 200 per page; pagination is broken

/** Haversine distance in km between two lat/lng points */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
}

async function geocodeAddress(
  address: string,
  apiKey: string
): Promise<{ lat: number; lng: number; placeId: string | null }> {
  const url = new URL(GOOGLE_GEOCODING_URL);
  url.searchParams.set('address', address);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
  const data = await res.json();

  if (data.status !== 'OK') {
    throw new Error(`Geocoding API error: ${data.status}`);
  }

  const result = data.results?.[0];
  if (!result) throw new Error('No location found for address');

  const location = result.geometry?.location;
  if (!location) throw new Error('No location coordinates found');

  return {
    lat: location.lat,
    lng: location.lng,
    placeId: result.place_id || null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      address: string;
      radiusKm: number;
      businessType: string;
      placeId?: string;
      lat?: number;
      lng?: number;
    };

    const { address, radiusKm, businessType } = body;
    if (!address || typeof radiusKm !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: address, radiusKm' },
        { status: 400 }
      );
    }

    const googleApiKey =
      process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
    if (!googleApiKey) {
      return NextResponse.json(
        { error: 'Google API key not configured' },
        { status: 500 }
      );
    }

    let lat: number;
    let lng: number;
    let placeId: string | null = null;

    // If client already resolved the address via Google Places Autocomplete,
    // use those coordinates directly and skip the geocoding step.
    if (
      typeof body.lat === 'number' &&
      typeof body.lng === 'number' &&
      typeof body.placeId === 'string'
    ) {
      lat = body.lat;
      lng = body.lng;
      placeId = body.placeId;
      console.log('[Search] Using client-provided placeId:', placeId);
    } else {
      const geocoded = await geocodeAddress(address, googleApiKey);
      lat = geocoded.lat;
      lng = geocoded.lng;
      placeId = geocoded.placeId;
    }

    let discovered: Array<{
      slug: string;
      freshaPid: string | null;
      name: string;
      address: string | null;
      city: string | null;
      latitude: string | null;
      longitude: string | null;
      rating: string | null;
      reviewsCount: number | null;
    }> = [];

    const freshaPlaceId = placeId ?? `${lat},${lng}`;
    const freshaQuery = businessType || 'nail salon';
    console.log(
      '[Fresha Search] placeId:',
      freshaPlaceId,
      '| query:',
      freshaQuery,
      '| max:',
      MAX_FRESHA_RESULTS
    );

    const freshaLatLng = `${lat},${lng}`;
    let freshaDebug: { withPlaceId?: Record<string, unknown>; withLatLng?: Record<string, unknown> } | null = null;
    try {
      freshaDebug = {
        withPlaceId: placeId
          ? buildFreshaSearchRequest({
              placeId,
              query: freshaQuery,
              first: MAX_FRESHA_RESULTS,
              distance: Math.max(radiusKm, 30),
            })
          : undefined,
        withLatLng: buildFreshaSearchRequest({
          placeId: freshaLatLng,
          query: freshaQuery,
          first: MAX_FRESHA_RESULTS,
          distance: Math.max(radiusKm, 30),
        }),
      };

      const freshaResults = await fetchAllFreshaLocations({
        placeId: freshaPlaceId,
        query: freshaQuery,
        max: MAX_FRESHA_RESULTS,
        distance: Math.max(radiusKm, 30),
      });
      const allFresha = freshaResults
        .filter((r) => r.slug)
        .map((r) => ({
          slug: r.slug,
          freshaPid: r.id ?? null,
          name: r.name,
          address: r.address?.shortFormatted ?? null,
          city: r.address?.cityName ?? null,
          latitude: r.address?.latitude ?? null,
          longitude: r.address?.longitude ?? null,
          rating: r.rating,
          reviewsCount: r.reviewsCount,
        }));

      // Fresha returns results sorted by popularity. Re-sort by actual distance.
      // NO radius filtering — we want to see everything Fresha returns with distance=30km.
      discovered = allFresha.sort((a, b) => {
        const da = haversineKm(
          lat, lng,
          parseFloat(a.latitude ?? '0'),
          parseFloat(a.longitude ?? '0')
        );
        const db = haversineKm(
          lat, lng,
          parseFloat(b.latitude ?? '0'),
          parseFloat(b.longitude ?? '0')
        );
        return da - db;
      });
      console.log(
        `Fresha GraphQL returned ${allFresha.length} results with distance=30km (sorted by distance, no radius filter)`
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.info(
        `Fresha GraphQL search unavailable (${message}), will use Google Places fallback`
      );
    }

    // Fallback path: Google Places → Fresha slug matcher
    if (discovered.length === 0) {
      const fallbackResults = await discoverCompetitors({
        lat,
        lng,
        radiusKm,
        businessType: businessType || 'nail salon',
        googlePlacesApiKey: googleApiKey,
      });
      discovered = fallbackResults
        .filter((d) => d.freshaSlug)
        .map((d) => ({
          slug: d.freshaSlug!,
          freshaPid: null,
          name: d.freshaName || d.name,
          address: d.address || null,
          city: null,
          latitude: d.location ? String(d.location.lat) : null,
          longitude: d.location ? String(d.location.lng) : null,
          rating: d.rating != null ? String(d.rating) : null,
          reviewsCount: d.userRatingsTotal ?? null,
        }));
      console.log(
        `Google Places fallback returned ${discovered.length} result(s)`
      );
    }

    const now = new Date();
    const slugs = discovered.map((d) => d.slug);

    // Fast batch SELECT instead of N+1 loop
    const existingCandidates =
      slugs.length > 0
        ? await db.select().from(competitors).where(inArray(competitors.slug, slugs))
        : [];

    const existingMap = new Map(existingCandidates.map((c) => [c.slug, c]));

    after(async () => {
      try {
        const missing = discovered.filter((d) => !existingMap.has(d.slug));
        if (missing.length > 0) {
          await db.insert(competitors).values(
            missing.map((m) => ({
              name: m.name,
              slug: m.slug,
              freshaPid: m.freshaPid,
              businessType: businessType || null,
              address: m.address,
              city: m.city,
              latitude: m.latitude,
              longitude: m.longitude,
              rating: m.rating,
              reviewsCount: m.reviewsCount,
              fetchedAt: now,
            }))
          );
        }
      } catch (e) {
        captureException(e);
      }

      try {
        const disputes: Array<{
          slug: string;
          field: string;
          discoveredValue: string | null;
          dbValue: string | null;
        }> = [];

        for (const candidate of discovered) {
          const existing = existingMap.get(candidate.slug);
          if (!existing) continue;

          const checks: Array<{
            field: string;
            discovered: string | number | null;
            db: string | number | null;
          }> = [
            { field: 'name', discovered: candidate.name, db: existing.name },
            { field: 'freshaPid', discovered: candidate.freshaPid, db: existing.freshaPid },
            { field: 'address', discovered: candidate.address, db: existing.address },
            { field: 'city', discovered: candidate.city, db: existing.city },
            { field: 'latitude', discovered: candidate.latitude, db: existing.latitude },
            { field: 'longitude', discovered: candidate.longitude, db: existing.longitude },
            { field: 'rating', discovered: candidate.rating, db: existing.rating },
            { field: 'reviewsCount', discovered: candidate.reviewsCount, db: existing.reviewsCount },
          ];

          for (const check of checks) {
            if (check.discovered != check.db) {
              disputes.push({
                slug: candidate.slug,
                field: check.field,
                discoveredValue: check.discovered != null ? String(check.discovered) : null,
                dbValue: check.db != null ? String(check.db) : null,
              });
            }
          }
        }

        if (disputes.length > 0) {
          await db.insert(tempDisputes).values(disputes);
        }
      } catch (e) {
        captureException(e);
      }

      try {
        await db.insert(searchLookups).values({
          addressQuery: address,
          radiusKm,
          businessType: businessType || null,
          latitude: String(lat),
          longitude: String(lng),
          resultsCount: discovered.length,
        });
      } catch (e) {
        captureException(e);
      }
    });

    return NextResponse.json({
      competitors: existingCandidates,
      centerLat: lat,
      centerLng: lng,
      radiusKm,
      freshaDebug,
    });
  } catch (error) {
    captureException(error);
    console.error('Search error:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

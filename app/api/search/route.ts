import { NextRequest, NextResponse, after as unstableAfter } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { competitors, searchLookups, tempDisputes } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { captureException } from '@/lib/sentry';
import {
  discoverCompetitors,
  fetchAllFreshaLocations,
  buildFreshaSearchRequest,
  searchFreshaGraphQL,
  searchGooglePlaces,
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
      after?: string;
    };

    const { address, radiusKm, businessType, after: afterCursor } = body;
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

    type DiscoveredItem = {
      slug: string;
      freshaPid: string | null;
      name: string;
      address: string | null;
      city: string | null;
      latitude: string | null;
      longitude: string | null;
      rating: string | null;
      reviewsCount: number | null;
      source: 'fresha' | 'google' | 'both';
      googlePlaceId: string | null;
    };

    let discovered: DiscoveredItem[] = [];

    let pageInfo = { hasNextPage: false, endCursor: null as string | null };
    const freshaQuery = businessType || 'nail salon';
    const distance = Math.min(radiusKm, 100);
    console.log(
      '[Fresha Search] lat:', lat,
      'lng:', lng,
      '| query:', freshaQuery,
      '| distance:', distance,
      '| max:', MAX_FRESHA_RESULTS
    );

    let freshaDebug: { request?: Record<string, unknown> } | null = null;

    if (afterCursor) {
      // Paginated path: fetch a single page directly
      try {
        freshaDebug = {
          request: buildFreshaSearchRequest({
            lat,
            lng,
            query: freshaQuery,
            first: MAX_FRESHA_RESULTS,
            after: afterCursor,
            distance,
          }),
        };

        const page = await searchFreshaGraphQL({
          lat,
          lng,
          query: freshaQuery,
          first: MAX_FRESHA_RESULTS,
          after: afterCursor,
          distance,
        });

        const allFresha = page.edges
          .filter((r) => r.node.slug)
          .map((r) => ({
            slug: r.node.slug,
            freshaPid: r.node.id ?? null,
            name: r.node.name,
            address: r.node.address?.shortFormatted ?? null,
            city: r.node.address?.cityName ?? null,
            latitude: r.node.address?.latitude ?? null,
            longitude: r.node.address?.longitude ?? null,
            rating: r.node.rating,
            reviewsCount: r.node.reviewsCount,
            source: 'fresha' as const,
            googlePlaceId: null,
          }));

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

        pageInfo = {
          hasNextPage: page.pageInfo.hasNextPage,
          endCursor: page.pageInfo.endCursor,
        };

        console.log(
          `Fresha GraphQL paginated request returned ${allFresha.length} results`
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.info(
          `Fresha GraphQL paginated search unavailable (${message})`
        );
      }
    } else {
      // Non-paginated path: parallel Fresha + Google Places
      const freshaPromise = fetchAllFreshaLocations({
        lat,
        lng,
        query: freshaQuery,
        max: MAX_FRESHA_RESULTS,
        distance,
      });

      const googlePromise = searchGooglePlaces(
        lat,
        lng,
        Math.min(radiusKm, 100) * 1000,
        businessType || 'nail salon',
        googleApiKey,
      );

      const [freshaSettled, googleSettled] = await Promise.allSettled([
        freshaPromise,
        googlePromise,
      ]);

      let freshaItems: Awaited<typeof freshaPromise> = [];
      if (freshaSettled.status === 'fulfilled') {
        freshaItems = freshaSettled.value;
        freshaDebug = {
          request: buildFreshaSearchRequest({
            lat,
            lng,
            query: freshaQuery,
            first: MAX_FRESHA_RESULTS,
            distance,
          }),
        };
      } else {
        const message = freshaSettled.reason instanceof Error ? freshaSettled.reason.message : String(freshaSettled.reason);
        console.info(`Fresha GraphQL search unavailable (${message})`);
      }

      let googlePlaces: Awaited<typeof googlePromise> = [];
      if (googleSettled.status === 'fulfilled') {
        googlePlaces = googleSettled.value;
        console.log(`Google Places returned ${googlePlaces.length} results`);
      } else {
        const message = googleSettled.reason instanceof Error ? googleSettled.reason.message : String(googleSettled.reason);
        console.info(`Google Places search unavailable (${message})`);
      }

      // Build Fresha map
      const merged = new Map<string, DiscoveredItem>();
      for (const r of freshaItems.filter((r) => r.slug)) {
        merged.set(r.slug, {
          slug: r.slug,
          freshaPid: r.id ?? null,
          name: r.name,
          address: r.address?.shortFormatted ?? null,
          city: r.address?.cityName ?? null,
          latitude: r.address?.latitude ?? null,
          longitude: r.address?.longitude ?? null,
          rating: r.rating,
          reviewsCount: r.reviewsCount,
          source: 'fresha',
          googlePlaceId: null,
        });
      }

      // Match Google results to Fresha by proximity (50m)
      const matchedGoogleIds = new Set<string>();
      for (const place of googlePlaces) {
        const plat = place.geometry?.location?.lat;
        const plng = place.geometry?.location?.lng;
        if (plat == null || plng == null) continue;

        let matched = false;
        for (const item of merged.values()) {
          const flat = parseFloat(item.latitude ?? '0');
          const flng = parseFloat(item.longitude ?? '0');
          if (flat === 0 && flng === 0) continue;

          const distKm = haversineKm(plat, plng, flat, flng);
          if (distKm <= 0.05) {
            item.source = 'both';
            item.googlePlaceId = place.place_id;
            matchedGoogleIds.add(place.place_id);
            matched = true;
            break;
          }
        }

        if (!matched) {
          const syntheticSlug = `google-${place.place_id}`;
          merged.set(syntheticSlug, {
            slug: syntheticSlug,
            freshaPid: null,
            name: place.name,
            address: place.vicinity || null,
            city: null,
            latitude: String(plat),
            longitude: String(plng),
            rating: place.rating != null ? String(place.rating) : null,
            reviewsCount: place.user_ratings_total ?? null,
            source: 'google',
            googlePlaceId: place.place_id,
          });
        }
      }

      discovered = Array.from(merged.values()).sort((a, b) => {
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
        `Merged results: ${discovered.length} total (Fresha: ${freshaItems.length}, Google: ${googlePlaces.length})`
      );

      pageInfo = { hasNextPage: false, endCursor: null };
    }

    const now = new Date();
    const slugs = discovered.map((d) => d.slug);

    // Fast batch SELECT instead of N+1 loop
    const existingCandidates =
      slugs.length > 0
        ? await db.select().from(competitors).where(inArray(competitors.slug, slugs))
        : [];

    const existingMap = new Map(existingCandidates.map((c) => [c.slug, c]));

    if (afterCursor) {
      // Synchronous insert for paginated path so newly discovered competitors
      // are returned in the same response.
      const missing = discovered.filter((d) => !existingMap.has(d.slug));
      if (missing.length > 0) {
        await db.insert(competitors).values(
          missing.map((m) => ({
            name: m.name,
            slug: m.slug,
            freshaPid: m.freshaPid,
            googlePlaceId: m.googlePlaceId,
            source: m.source,
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

      // Re-select to include newly inserted competitors
      const allCandidates =
        slugs.length > 0
          ? await db.select().from(competitors).where(inArray(competitors.slug, slugs))
          : [];

      // Log search lookup synchronously for paginated requests
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

      return NextResponse.json({
        competitors: allCandidates,
        centerLat: lat,
        centerLng: lng,
        radiusKm,
        freshaDebug,
        pageInfo,
      });
    }

    // Non-paginated: existing after() logic
    unstableAfter(async () => {
      try {
        const missing = discovered.filter((d) => !existingMap.has(d.slug));
        if (missing.length > 0) {
          await db.insert(competitors).values(
            missing.map((m) => ({
              name: m.name,
              slug: m.slug,
              freshaPid: m.freshaPid,
              googlePlaceId: m.googlePlaceId,
              source: m.source,
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
            { field: 'googlePlaceId', discovered: candidate.googlePlaceId, db: existing.googlePlaceId },
            { field: 'source', discovered: candidate.source, db: existing.source },
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
      pageInfo,
    });
  } catch (error) {
    captureException(error);
    console.error('Search error:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

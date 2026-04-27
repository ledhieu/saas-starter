import { FRESHA_BASE, FRESHA_GRAPHQL_ENDPOINT, CLIENT_VERSION, SLEEP_MS } from './config';

const GOOGLE_PLACES_URL =
  'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

export interface GooglePlaceResult {
  place_id: string;
  name: string;
  vicinity: string;
  geometry?: {
    location: { lat: number; lng: number };
  };
  rating?: number;
  user_ratings_total?: number;
  website?: string;
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

export interface DiscoveredCompetitor {
  googlePlaceId: string;
  name: string;
  address: string;
  location: { lat: number; lng: number } | null;
  rating: number | null;
  userRatingsTotal: number | null;
  website: string | null;
  freshaSlug: string | null;
  freshaUrl: string | null;
  freshaName: string | null;
}

export interface FreshaSearchNode {
  id: string;
  name: string;
  slug: string;
  rating: string | null;
  reviewsCount: number | null;
  address: {
    shortFormatted: string | null;
    cityName: string | null;
    latitude: string | null;
    longitude: string | null;
  } | null;
}

export interface FreshaSearchPage {
  edges: { node: FreshaSearchNode }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function makeSlugGuesses(
  name: string,
  city: string,
  addressComponents: GooglePlaceResult['address_components'] = []
): string[] {
  const guesses = new Set<string>();
  const base = slugify(name);

  const citySlug = slugify(city || '');
  const country =
    addressComponents?.find((c) => c.types.includes('country'))?.short_name ||
    '';
  const locality =
    addressComponents?.find((c) => c.types.includes('locality'))?.long_name ||
    '';
  const neighborhood =
    addressComponents?.find((c) => c.types.includes('neighborhood'))
      ?.long_name || '';
  const admin =
    addressComponents?.find((c) =>
      c.types.includes('administrative_area_level_1')
    )?.short_name || '';

  const locations = [
    citySlug,
    slugify(locality),
    slugify(neighborhood),
    slugify(admin),
  ].filter(Boolean);

  for (const loc of locations) {
    guesses.add(`${base}-${loc}`);
    if (country) guesses.add(`${base}-${loc}-${country.toLowerCase()}`);
  }

  guesses.add(base);

  return Array.from(guesses);
}

export async function validateFreshaSlug(slug: string): Promise<{
  slug: string;
  name: string | null;
} | null> {
  try {
    const res = await fetch(`${FRESHA_BASE}/a/${slug}`, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-CA',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (html.includes('__NEXT_DATA__') && html.includes('"location"')) {
      const match = html.match(/"name":"([^"]+)","slug":"([^"]+)"/);
      if (match && match[2] === slug) {
        return { slug, name: match[1] };
      }
      return { slug, name: null };
    }
    return null;
  } catch {
    return null;
  }
}

export async function searchGooglePlaces(
  lat: number,
  lng: number,
  radiusMeters: number,
  keyword: string,
  apiKey: string
): Promise<GooglePlaceResult[]> {
  const url = new URL(GOOGLE_PLACES_URL);
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', String(radiusMeters));
  url.searchParams.set('keyword', keyword);
  url.searchParams.set('key', apiKey);

  console.log('[Google Places] URL:', url.toString().replace(apiKey, '***KEY***'));

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  console.log('[Google Places] Response status:', res.status, '| length:', text.length);

  if (!res.ok) throw new Error(`Google Places HTTP ${res.status}: ${text}`);

  let data: { status?: string; error_message?: string; results?: GooglePlaceResult[] };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Google Places returned invalid JSON: ${text.substring(0, 500)}`);
  }

  console.log('[Google Places] Status:', data.status, '| Results:', data.results?.length ?? 0);

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(
      `Google Places API error: ${data.status} — ${data.error_message || ''}`
    );
  }
  return data.results || [];
}

export async function findFreshaSlugForPlace(
  place: GooglePlaceResult
): Promise<{ slug: string; name: string | null } | null> {
  const website = place.website || '';
  const directMatch = website.match(/fresha\.com\/a\/([^/?#]+)/);
  if (directMatch) {
    console.log(`[Slug Match] Direct match for "${place.name}": ${directMatch[1]}`);
    const validated = await validateFreshaSlug(directMatch[1]);
    if (validated) return validated;
  }

  const city = place.vicinity?.split(',').pop()?.trim() || '';
  let guesses = makeSlugGuesses(place.name, city, place.address_components);
  // Cap guesses to avoid excessive requests; prioritize city-specific combos
  guesses = guesses.slice(0, 6);
  console.log(`[Slug Match] "${place.name}" — trying ${guesses.length} guesses:`, guesses);

  for (const guess of guesses) {
    await sleep(SLEEP_MS);
    const validated = await validateFreshaSlug(guess);
    if (validated) {
      console.log(`[Slug Match] Found slug for "${place.name}": ${guess}`);
      return validated;
    }
  }

  console.log(`[Slug Match] No slug found for "${place.name}" after ${guesses.length} guesses`);
  return null;
}

export function buildFreshaSearchRequest({
  lat,
  lng,
  query,
  first = 200,
  after = '',
  distance,
  freshaVerifiedOnly = false,
  hasDeals = false,
  hasGroupAppointments = false,
  sort = 'RECOMMENDED',
  aspectRatio = 1,
}: {
  lat: number;
  lng: number;
  query: string;
  first?: number;
  after?: string;
  distance?: number;
  freshaVerifiedOnly?: boolean;
  hasDeals?: boolean;
  hasGroupAppointments?: boolean;
  sort?: string;
  aspectRatio?: number;
}) {
  const variables: Record<string, unknown> = {
    aspectRatio,
    first,
    freshaVerifiedOnly,
    geocode: { latitude: lat, longitude: lng },
    hasDeals,
    hasGroupAppointments,
    query: query || '',
    sort,
  };

  if (distance != null) {
    variables.distance = distance;
  }

  if (after) {
    variables.after = after;
  }

  const graphqlQuery = `query Search_Venues_Query(
  $aspectRatio: Float!
  $first: Int!
  $freshaVerifiedOnly: Boolean!
  $geocode: Geocode
  $hasDeals: Boolean!
  $hasGroupAppointments: Boolean!
  $query: String
  $sort: GeolocationLocationsSorting!
  $after: ID
  $distance: Float
) {
  geolocation(geocode: $geocode) {
    locations(
      query: $query
      first: $first
      after: $after
      sort: $sort
      freshaVerifiedOnly: $freshaVerifiedOnly
      hasDeals: $hasDeals
      distance: $distance
      hasGroupAppointments: $hasGroupAppointments
      aspectRatio: $aspectRatio
    ) {
      edges {
        node {
          id
          hasDeals
          name
          slug
          rating
          reviewsCount
          address {
            shortFormatted
            cityName
            latitude
            longitude
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`;

  const body = JSON.stringify({ query: graphqlQuery, variables });

  const headers = {
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Accept-Language': 'en-CA',
    'x-client-platform': 'web',
    'x-client-version': CLIENT_VERSION,
    'x-graphql-operation-name': 'query Search_Venues_Query',
    'Origin': 'https://www.fresha.com',
    'Referer': 'https://www.fresha.com/',
  };

  return { endpoint: FRESHA_GRAPHQL_ENDPOINT, headers, body, graphqlQuery, variables };
}

export async function searchFreshaGraphQL({
  lat,
  lng,
  query,
  first = 200,
  after = '',
  distance,
}: {
  lat: number;
  lng: number;
  query: string;
  first?: number;
  after?: string;
  distance?: number;
}): Promise<FreshaSearchPage> {
  const { endpoint, headers, body } = buildFreshaSearchRequest({ lat, lng, query, first, after, distance });

  console.log('[Fresha GraphQL] Request body:', body);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(15000),
  });

  const responseText = await res.text();
  console.log('[Fresha GraphQL] Response status:', res.status, '| body:', responseText.substring(0, 2000));

  if (!res.ok) throw new Error(`Fresha search HTTP ${res.status}: ${responseText}`);

  let json: { data?: unknown; errors?: unknown };
  try {
    json = JSON.parse(responseText);
  } catch {
    throw new Error(`Fresha search returned invalid JSON: ${responseText.substring(0, 500)}`);
  }

  if (json.errors) {
    throw new Error('Fresha search GraphQL errors: ' + JSON.stringify(json.errors));
  }

  return (json.data as { geolocation: { locations: FreshaSearchPage } }).geolocation.locations;
}

export async function fetchAllFreshaLocations({
  lat,
  lng,
  query,
  max = Infinity,
  distance,
  batchSize = 200,
  after: startAfter = '',
}: {
  lat: number;
  lng: number;
  query: string;
  max?: number;
  distance?: number;
  batchSize?: number;
  after?: string;
}): Promise<FreshaSearchNode[]> {
  const all: FreshaSearchNode[] = [];
  let after = startAfter;
  let pageNum = 0;

  while (all.length < max) {
    pageNum++;
    const pageFirst = Math.min(batchSize, max - all.length);

    let page: { edges: { node: FreshaSearchNode }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
    try {
      page = await searchFreshaGraphQL({
        lat,
        lng,
        query,
        first: pageFirst,
        after,
        distance,
      });
    } catch (err) {
      console.warn(`[Fresha] Pagination failed at page ${pageNum}, returning ${all.length} results.`);
      break;
    }

    for (const edge of page.edges) {
      if (all.length >= max) break;
      all.push(edge.node);
    }

    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) break;
    after = page.pageInfo.endCursor;

    // Be respectful to Fresha's API — small delay between pages
    if (all.length < max) {
      await sleep(SLEEP_MS);
    }
  }

  return all;
}

export async function discoverCompetitors({
  lat,
  lng,
  radiusKm,
  businessType,
  googlePlacesApiKey,
}: {
  lat: number;
  lng: number;
  radiusKm: number;
  businessType: string;
  googlePlacesApiKey: string;
}): Promise<DiscoveredCompetitor[]> {
  const keyword = businessType || 'nail salon';
  const radiusMeters = Math.round(radiusKm * 1000);

  console.log(`[Discover] Starting Google Places search: lat=${lat} lng=${lng} radius=${radiusMeters}m keyword="${keyword}"`);

  const places = await searchGooglePlaces(
    lat,
    lng,
    radiusMeters,
    keyword,
    googlePlacesApiKey
  );

  console.log(`[Discover] Google Places found ${places.length} places`);

  const results: DiscoveredCompetitor[] = [];

  for (const place of places) {
    const fresha = await findFreshaSlugForPlace(place);
    results.push({
      googlePlaceId: place.place_id,
      name: place.name,
      address: place.vicinity,
      location: place.geometry?.location || null,
      rating: place.rating ?? null,
      userRatingsTotal: place.user_ratings_total ?? null,
      website: place.website || null,
      freshaSlug: fresha?.slug || null,
      freshaUrl: fresha?.slug ? `${FRESHA_BASE}/a/${fresha.slug}` : null,
      freshaName: fresha?.name || null,
    });
  }

  const withSlug = results.filter((r) => r.freshaSlug).length;
  console.log(`[Discover] Finished: ${results.length} places, ${withSlug} with Fresha slug`);

  return results;
}

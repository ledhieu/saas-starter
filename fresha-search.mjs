#!/usr/bin/env node
/**
 * Fresha Search — Uses the actual frontend query structure discovered from HAR.
 *
 * Discovered query: persisted GET with hash ad8aade92b6b3000a18c9dfc9d416eed6ef38fc2d8b8d3cced382be7a089b87a
 * Response path:   data.geolocation.locations { edges, pageInfo }
 * Pagination:      Offset via `first` (cursor-based `after` is BROKEN on page 2+)
 * Max per request: 200 results (AGENTS.md says 50, but 200 works fine)
 *
 * Usage:
 *   node fresha-search.mjs <placeId> <lat> <lng> [query] [first] [distance]
 *
 * Examples:
 *   node fresha-search.mjs ChIJpTvG15DL1IkRd8S0KlBVNTI 43.6532 -79.3832 "nail salon" 200 10000
 *   node fresha-search.mjs ChIJs0-pQAFzhlQRi7ZmIq6wVoA 49.2827 -123.1207 "hair salon" 50 5000
 */

const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '2567b515c77631564f8194baa7a6e0e5b1bc07eb';

const PERSISTED_QUERY = {
  version: 1,
  sha256Hash: 'ad8aade92b6b3000a18c9dfc9d416eed6ef38fc2d8b8d3cced382be7a089b87a',
};

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------
const placeId = process.argv[2];
const lat = parseFloat(process.argv[3]);
const lng = parseFloat(process.argv[4]);
const query = process.argv[5] || 'nail salon';
const first = parseInt(process.argv[6] || '200', 10);
const distance = parseFloat(process.argv[7] || '10000');

if (!placeId || isNaN(lat) || isNaN(lng)) {
  console.error('Usage: node fresha-search.mjs <placeId> <lat> <lng> [query] [first] [distance]');
  console.error('  placeId: Google Place ID (e.g. ChIJpTvG15DL1IkRd8S0KlBVNTI)');
  console.error('  lat/lng: center coordinates');
  console.error('  query:   search keyword (default: "nail salon")');
  console.error('  first:   max results 1-200 (default: 200)');
  console.error('  distance: radius in meters (default: 10000)');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Build request
// ---------------------------------------------------------------------------
const variables = {
  aspectRatio: 1,
  distance,
  first: Math.min(Math.max(first, 1), 200),
  freshaVerifiedOnly: false,
  from: { placeId },
  geocode: { latitude: lat, longitude: lng },
  hasDeals: false,
  hasGroupAppointments: false,
  query: query || null,
  sort: 'RECOMMENDED',
};

const params = new URLSearchParams();
params.set('extensions', JSON.stringify({ persistedQuery: PERSISTED_QUERY }));
params.set('variables', JSON.stringify(variables));

const url = `${ENDPOINT}?${params.toString()}`;

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------
console.error(`[Fresha Search] placeId=${placeId} lat=${lat} lng=${lng} query="${query}" first=${first} distance=${distance}m`);

const res = await fetch(url, {
  method: 'GET',
  headers: {
    'Accept': '*/*',
    'Accept-Language': 'en-CA',
    'x-client-platform': 'web',
    'x-client-version': CLIENT_VERSION,
    'Origin': 'https://www.fresha.com',
    'Referer': 'https://www.fresha.com/search',
  },
  signal: AbortSignal.timeout(15000),
});

const data = await res.json();

if (data.errors) {
  console.error('GraphQL errors:');
  for (const err of data.errors) console.error('  -', err.message);
  process.exit(1);
}

const locations = data?.data?.geolocation?.locations;
const edges = locations?.edges || [];
const pageInfo = locations?.pageInfo || {};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const output = {
  meta: {
    placeId,
    lat,
    lng,
    query,
    requestedFirst: first,
    actualFirst: edges.length,
    distance,
    pageInfo: {
      count: pageInfo.count,
      hasNextPage: pageInfo.hasNextPage,
      // endCursor is useless — page 2 crashes
    },
  },
  results: edges.map(e => ({
    id: e.node?.id,
    name: e.node?.name,
    slug: e.node?.slug,
  })),
};

console.log(JSON.stringify(output, null, 2));

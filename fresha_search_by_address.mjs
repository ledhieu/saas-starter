#!/usr/bin/env node
// Full pipeline: Address → Google Place ID → Fresha GraphQL results
//
// Usage:
//   node fresha_search_by_address.mjs "Toronto, ON" YOUR_GOOGLE_API_KEY "nail salon"
//   node fresha_search_by_address.mjs "Vancouver, BC" YOUR_GOOGLE_API_KEY "hair salon" 10

const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const FRESHA_ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

const address = process.argv[2];
const googleApiKey = process.argv[3] || process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY;
const keyword = process.argv[4] || 'nail salon';
const first = parseInt(process.argv[5] || '5', 10);

if (!address || !googleApiKey) {
  console.error('Usage: node fresha_search_by_address.mjs "<address>" <google_api_key> [keyword] [first]');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 1: Resolve address to Google Place ID
// ---------------------------------------------------------------------------
console.error(`[1/3] Resolving "${address}" via Google Geocoding...`);
const geoUrl = new URL(GOOGLE_GEOCODE_URL);
geoUrl.searchParams.set('address', address);
geoUrl.searchParams.set('key', googleApiKey);

const geoRes = await fetch(geoUrl);
const geoData = await geoRes.json();

if (geoData.status !== 'OK' || !geoData.results?.length) {
  console.error(`Geocoding failed: ${geoData.status}${geoData.error_message ? ' — ' + geoData.error_message : ''}`);
  process.exit(1);
}

const place = geoData.results[0];
const placeId = place.place_id;
const lat = place.geometry.location.lat;
const lng = place.geometry.location.lng;

console.error(`      → Place ID: ${placeId}`);
console.error(`      → Location: ${lat}, ${lng}`);
console.error(`      → Formatted: ${place.formatted_address}`);

// ---------------------------------------------------------------------------
// Step 2: Query Fresha GraphQL with the real Place ID
// ---------------------------------------------------------------------------
console.error(`[2/3] Querying Fresha for "${keyword}"...`);

const freshaQuery = `
  query Search($placeId: ID!, $query: String!, $first: Int!) {
    geolocation(placeId: $placeId) {
      locations(query: $query, first: $first) {
        edges {
          node {
            id
            name
            slug
          }
        }
      }
    }
  }
`;

const freshaRes = await fetch(FRESHA_ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Accept-Language': 'en-CA',
    'x-client-platform': 'web',
    'x-client-version': CLIENT_VERSION,
    'Origin': 'https://www.fresha.com',
    'Referer': 'https://www.fresha.com/',
  },
  body: JSON.stringify({
    query: freshaQuery,
    variables: { placeId, query: keyword, first },
  }),
  signal: AbortSignal.timeout(15000),
});

const freshaData = await freshaRes.json();
const edges = freshaData?.data?.geolocation?.locations?.edges || [];

console.error(`[3/3] Fresha returned ${edges.length} result(s)\n`);

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const output = {
  address: place.formatted_address,
  placeId,
  lat,
  lng,
  keyword,
  results: edges.map(e => e.node),
};

console.log(JSON.stringify(output, null, 2));

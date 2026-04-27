// Test persisted GET query with a real location (Toronto)
const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '2567b515c77631564f8194baa7a6e0e5b1bc07eb';

const extensions = {
  persistedQuery: {
    version: 1,
    sha256Hash: 'ad8aade92b6b3000a18c9dfc9d416eed6ef38fc2d8b8d3cced382be7a089b87a',
  },
};

function buildUrl(variables) {
  const params = new URLSearchParams();
  params.set('extensions', JSON.stringify(extensions));
  params.set('variables', JSON.stringify(variables));
  return `${ENDPOINT}?${params.toString()}`;
}

async function testGet(label, variables) {
  console.log(`\n=== ${label} ===`);
  const url = buildUrl(variables);
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
    console.log('Errors:');
    for (const err of data.errors) console.log('  -', err.message);
    return;
  }

  // The response structure is unknown - try multiple paths
  const edges = data?.data?.locations?.edges
    || data?.data?.searchLocations?.edges
    || data?.data?.geolocation?.locations?.edges
    || [];

  console.log(`Results: ${edges.length}`);
  for (const e of edges.slice(0, 5)) {
    console.log('  -', e.node?.name || JSON.stringify(e));
  }

  const pageInfo = data?.data?.locations?.pageInfo
    || data?.data?.searchLocations?.pageInfo
    || data?.data?.geolocation?.locations?.pageInfo;

  if (pageInfo) {
    console.log('PageInfo:', JSON.stringify(pageInfo));
  }

  // Dump full response structure for analysis
  if (edges.length === 0 && !data.errors) {
    console.log('Full data keys:', Object.keys(data.data || {}));
    for (const key of Object.keys(data.data || {})) {
      console.log(`  ${key}:`, JSON.stringify(data.data[key]).slice(0, 200));
    }
  }
}

// Test with Toronto (real Google Place ID from earlier)
await testGet('Toronto - first page', {
  aspectRatio: 1,
  distance: 10000,
  first: 10,
  freshaVerifiedOnly: false,
  from: { placeId: 'ChIJpTvG15DL1IkRd8S0KlBVNTI' },
  geocode: { latitude: 43.6532, longitude: -79.3832 },
  hasDeals: false,
  hasGroupAppointments: false,
  query: 'nail salon',
  sort: 'RECOMMENDED',
});

// Test with Vancouver
await testGet('Vancouver - first page', {
  aspectRatio: 1,
  distance: 10000,
  first: 10,
  freshaVerifiedOnly: false,
  from: { placeId: 'ChIJs0-pQAFzhlQRi7ZmIq6wVoA' }, // Vancouver Place ID
  geocode: { latitude: 49.2827, longitude: -123.1207 },
  hasDeals: false,
  hasGroupAppointments: false,
  query: 'nail salon',
  sort: 'RECOMMENDED',
});

// Test with no query (null like original)
await testGet('Toronto - no query keyword', {
  aspectRatio: 1,
  distance: 10000,
  first: 10,
  freshaVerifiedOnly: false,
  from: { placeId: 'ChIJpTvG15DL1IkRd8S0KlBVNTI' },
  geocode: { latitude: 43.6532, longitude: -79.3832 },
  hasDeals: false,
  hasGroupAppointments: false,
  query: null,
  sort: 'RECOMMENDED',
});

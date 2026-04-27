// Replicate the exact GET request from the frontend HAR
const ENDPOINT = 'https://www.fresha.com/graphql';

// The NEW client version from the frontend (different from our scripts!)
const CLIENT_VERSION = '2567b515c77631564f8194baa7a6e0e5b1bc07eb';

const variables = {
  aspectRatio: 1,
  distance: 9457.267100865347,
  first: 10, // use 10 for testing
  freshaVerifiedOnly: false,
  from: { placeId: 'ChIJ56ju09ZzhlQRRxd6Vsh_qb8' },
  geocode: { latitude: -1.1009673528405983e-7, longitude: -134.3288159337111 },
  hasDeals: false,
  hasGroupAppointments: false,
  query: null,
  sort: 'RECOMMENDED',
};

const extensions = {
  persistedQuery: {
    version: 1,
    sha256Hash: 'ad8aade92b6b3000a18c9dfc9d416eed6ef38fc2d8b8d3cced382be7a089b87a',
  },
};

function buildUrl(extraVars = {}) {
  const allVars = { ...variables, ...extraVars };
  const params = new URLSearchParams();
  params.set('extensions', JSON.stringify(extensions));
  params.set('variables', JSON.stringify(allVars));
  return `${ENDPOINT}?${params.toString()}`;
}

async function testGet(url) {
  console.log(`\nGET ${url.slice(0, 200)}...`);
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': '*/*',
      'Accept-Language': 'en-CA',
      'x-client-platform': 'web',
      'x-client-version': CLIENT_VERSION,
      'Origin': 'https://www.fresha.com',
      'Referer': 'https://www.fresha.com/search?search-place-id=ChIJ56ju09ZzhlQRRxd6Vsh_qb8&center=-1.1009673528405983e-7,-134.3288159337111&distance=9457.267100865347',
    },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { parseError: text.slice(0, 300) };
  }
}

// Test 1: GET with persisted query hash (first page)
console.log('=== Test 1: GET persisted query (first page) ===');
const data1 = await testGet(buildUrl());
console.log('Status-like:', data1.errors ? 'ERRORS' : 'OK');
if (data1.errors) {
  for (const err of data1.errors) console.log('  -', err.message);
}
const edges1 = data1?.data?.locations?.edges || data1?.data?.searchLocations?.edges || [];
console.log(`Results: ${edges1.length}`);
for (const e of edges1.slice(0, 3)) console.log('  -', e.node?.name || JSON.stringify(e));

// Test 2: GET with after cursor (page 2)
if (data1?.data?.locations?.pageInfo?.endCursor || data1?.data?.searchLocations?.pageInfo?.endCursor) {
  const cursor = data1.data.locations?.pageInfo?.endCursor || data1.data.searchLocations?.pageInfo?.endCursor;
  console.log('\n=== Test 2: GET persisted query (page 2) ===');
  console.log('Cursor:', cursor);
  const data2 = await testGet(buildUrl({ after: cursor }));
  if (data2.errors) {
    for (const err of data2.errors) console.log('  -', err.message);
  }
  const edges2 = data2?.data?.locations?.edges || data2?.data?.searchLocations?.edges || [];
  console.log(`Results: ${edges2.length}`);
  for (const e of edges2.slice(0, 3)) console.log('  -', e.node?.name || JSON.stringify(e));
}

// Test 3: POST fallback (raw query, no persisted hash)
console.log('\n=== Test 3: POST with raw query (fallback) ===');
const rawQuery = `
  query Search_Venues_Query(
    $aspectRatio: Int,
    $distance: Float,
    $first: Int,
    $freshaVerifiedOnly: Boolean,
    $from: LocationFromInput,
    $geocode: GeocodeInput,
    $hasDeals: Boolean,
    $hasGroupAppointments: Boolean,
    $query: String,
    $sort: String,
    $after: String
  ) {
    locations(
      aspectRatio: $aspectRatio,
      distance: $distance,
      first: $first,
      freshaVerifiedOnly: $freshaVerifiedOnly,
      from: $from,
      geocode: $geocode,
      hasDeals: $hasDeals,
      hasGroupAppointments: $hasGroupAppointments,
      query: $query,
      sort: $sort,
      after: $after
    ) {
      edges { node { id name slug } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;
const postRes = await fetch(ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Accept-Language': 'en-CA',
    'x-client-platform': 'web',
    'x-client-version': CLIENT_VERSION,
    'Origin': 'https://www.fresha.com',
    'Referer': 'https://www.fresha.com/search',
  },
  body: JSON.stringify({ query: rawQuery, variables }),
  signal: AbortSignal.timeout(15000),
});
const postData = await postRes.json();
if (postData.errors) {
  for (const err of postData.errors) console.log('  -', err.message);
}
const postEdges = postData?.data?.locations?.edges || [];
console.log(`Results: ${postEdges.length}`);
for (const e of postEdges.slice(0, 3)) console.log('  -', e.node?.name || JSON.stringify(e));

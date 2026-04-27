const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '2567b515c77631564f8194baa7a6e0e5b1bc07eb';
const SEARCH_HASH = 'ad8aade92b6b3000a18c9dfc9d416eed6ef38fc2d8b8d3cced382be7a089b87a';

const PLACE_ID = 'ChIJpTvG15DL1IkRd8S0KlBVNTI';
const LAT = 43.6532;
const LNG = -79.3832;
const QUERY = 'nail salon';
const DISTANCE = 10000;

const HEADERS = {
  'Accept': '*/*',
  'Accept-Language': 'en-CA',
  'x-client-platform': 'web',
  'x-client-version': CLIENT_VERSION,
  'Origin': 'https://www.fresha.com',
  'Referer': 'https://www.fresha.com/search',
};

async function searchFresha({ after = null, first = 10 }) {
  const variables = {
    aspectRatio: 1,
    distance: DISTANCE,
    first,
    freshaVerifiedOnly: false,
    from: { placeId: PLACE_ID },
    geocode: { latitude: LAT, longitude: LNG },
    hasDeals: false,
    hasGroupAppointments: false,
    query: QUERY,
    sort: 'RECOMMENDED',
    ...(after !== null ? { after } : {})
  };

  const params = new URLSearchParams();
  params.set('extensions', JSON.stringify({ persistedQuery: { version: 1, sha256Hash: SEARCH_HASH } }));
  params.set('variables', JSON.stringify(variables));
  const url = `${ENDPOINT}?${params.toString()}`;

  const res = await fetch(url, { method: 'GET', headers: HEADERS, signal: AbortSignal.timeout(15000) });
  const json = await res.json();

  if (json.errors) {
    return { error: json.errors.map(e => e.message).join('; '), results: [], pageInfo: null };
  }

  const locations = json?.data?.geolocation?.locations;
  return {
    results: locations?.edges?.map(e => ({
      id: e.node?.id,
      slug: e.node?.slug,
      name: e.node?.name || e.node?.locationName
    })) || [],
    pageInfo: locations?.pageInfo || null
  };
}

// Get baseline (first 10)
console.log('=== Baseline: first 10 ===');
const baseline = await searchFresha({ first: 10 });
console.log(`Results: ${baseline.results.length}, hasNextPage: ${baseline.pageInfo?.hasNextPage}`);
console.log(`endCursor: ${baseline.pageInfo?.endCursor}`);
baseline.results.forEach((r, i) => console.log(`  ${i}: [${r.id}] ${r.name}`));
const lastItem = baseline.results[baseline.results.length - 1];
console.log(`\nLast item slug: ${lastItem.slug}\n`);

// Decode the cursor
const decoded = JSON.parse(Buffer.from(baseline.pageInfo.endCursor, 'base64').toString('utf-8'));
console.log(`Decoded cursor: ${JSON.stringify(decoded)}\n`);

// Test various after formats
const tests = [
  { label: 'Base64 cursor (crashes?)', after: baseline.pageInfo.endCursor },
  { label: 'Raw JSON array string', after: JSON.stringify(decoded) },
  { label: 'Just the ID (number)', after: decoded[decoded.length - 1] },
  { label: 'Just the ID (string)', after: String(decoded[decoded.length - 1]) },
  { label: 'Score only (number)', after: decoded[0] },
  { label: 'Slug of last item', after: lastItem.slug },
  { label: 'Slug of middle item (index 4)', after: baseline.results[4]?.slug },
];

for (const t of tests) {
  console.log(`--- Test: ${t.label} ---`);
  console.log(`after = ${JSON.stringify(t.after)}`);
  const result = await searchFresha({ after: t.after, first: 10 });
  if (result.error) {
    console.log(`❌ ERROR: ${result.error}`);
  } else {
    console.log(`✅ Results: ${result.results.length}, hasNextPage: ${result.pageInfo?.hasNextPage}`);
    if (result.results.length > 0) {
      const ids = result.results.map(r => r.id);
      const baselineIds = baseline.results.map(r => r.id);
      const overlap = ids.filter(id => baselineIds.includes(id));
      const newOnes = ids.filter(id => !baselineIds.includes(id));
      console.log(`   First: [${result.results[0].id}] ${result.results[0].name}`);
      console.log(`   Overlap with baseline: ${overlap.length}, New: ${newOnes.length}`);
      if (newOnes.length > 0) {
        result.results.filter(r => !baselineIds.includes(r.id)).forEach(r => console.log(`   NEW: [${r.id}] ${r.name}`));
      }
    }
  }
  console.log('');
}

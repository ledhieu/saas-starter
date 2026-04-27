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

async function searchFresha({ after = null }) {
  const variables = {
    aspectRatio: 1,
    distance: DISTANCE,
    first: 200,
    freshaVerifiedOnly: false,
    from: { placeId: PLACE_ID },
    geocode: { latitude: LAT, longitude: LNG },
    hasDeals: false,
    hasGroupAppointments: false,
    query: QUERY,
    sort: 'RECOMMENDED',
    ...(after ? { after } : {})
  };

  const params = new URLSearchParams();
  params.set('extensions', JSON.stringify({ persistedQuery: { version: 1, sha256Hash: SEARCH_HASH } }));
  params.set('variables', JSON.stringify(variables));
  const url = `${ENDPOINT}?${params.toString()}`;

  const res = await fetch(url, { method: 'GET', headers: HEADERS, signal: AbortSignal.timeout(15000) });
  const json = await res.json();

  if (json.errors) {
    console.error('GraphQL errors:', json.errors.map(e => e.message));
    return null;
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

// ─── Run the test ───
console.log('=== Pagination Test: Slug-based after ===\n');

// 1) First page (no after)
console.log('📄 Request 1: first=200, no after');
const page1 = await searchFresha({});
if (!page1 || page1.results.length === 0) {
  console.log('❌ No results');
  process.exit(1);
}
console.log(`   Results: ${page1.results.length}`);
console.log(`   hasNextPage: ${page1.pageInfo?.hasNextPage}`);
console.log(`   endCursor: ${page1.pageInfo?.endCursor}`);

const lastItem = page1.results[page1.results.length - 1];
console.log(`   Last item: [${lastItem.id}] ${lastItem.name}\n   slug: ${lastItem.slug}\n`);

// 2) Second page (after = last slug)
console.log(`📄 Request 2: first=200, after="${lastItem.slug}"`);
const page2 = await searchFresha({ after: lastItem.slug });
if (!page2) {
  console.log('❌ Request 2 failed');
  process.exit(1);
}
console.log(`   Results: ${page2.results.length}`);
console.log(`   hasNextPage: ${page2.pageInfo?.hasNextPage}`);
console.log(`   endCursor: ${page2.pageInfo?.endCursor}`);

if (page2.results.length > 0) {
  const firstItem = page2.results[0];
  const p2lastItem = page2.results[page2.results.length - 1];
  console.log(`   First item: [${firstItem.id}] ${firstItem.name}`);
  console.log(`   Last item: [${p2lastItem.id}] ${p2lastItem.name}`);
  console.log(`   Last slug: ${p2lastItem.slug}\n`);
}

// 3) Compare
const page1Ids = new Set(page1.results.map(r => r.id));
const page2Ids = new Set(page2.results.map(r => r.id));
const overlap = [...page1Ids].filter(id => page2Ids.has(id));
const uniqueToPage2 = [...page2Ids].filter(id => !page1Ids.has(id));

console.log('=== Comparison ===');
console.log(`Page 1 IDs: ${page1Ids.size}`);
console.log(`Page 2 IDs: ${page2Ids.size}`);
console.log(`Overlap (same IDs in both): ${overlap.length}`);
console.log(`Unique to Page 2: ${uniqueToPage2.length}`);

if (uniqueToPage2.length > 0) {
  console.log(`\n✅ SUCCESS! Pagination WORKS — ${uniqueToPage2.length} new results`);
  const newItems = page2.results.filter(r => !page1Ids.has(r.id)).slice(0, 10);
  newItems.forEach((r, i) => console.log(`   New #${i+1}: [${r.id}] ${r.name}`));
} else if (page2.results.length > 0) {
  console.log('\n⚠️ All Page 2 results were already in Page 1 (no new data)');
} else {
  console.log('\n❌ Page 2 returned empty');
}

if (overlap.length > 0 && overlap.length <= 10) {
  console.log(`\nOverlapping IDs: ${overlap.join(', ')}`);
} else if (overlap.length > 0) {
  console.log(`\nFirst 5 overlapping: ${overlap.slice(0, 5).join(', ')}...`);
}

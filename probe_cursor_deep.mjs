// Deep dive into Fresha pagination cursors
const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '2567b515c77631564f8194baa7a6e0e5b1bc07eb';

const extensions = {
  persistedQuery: {
    version: 1,
    sha256Hash: 'ad8aade92b6b3000a18c9dfc9d416eed6ef38fc2d8b8d3cced382be7a089b87a',
  },
};

const baseVars = {
  aspectRatio: 1,
  distance: 10000,
  freshaVerifiedOnly: false,
  from: { placeId: 'ChIJpTvG15DL1IkRd8S0KlBVNTI' },
  geocode: { latitude: 43.6532, longitude: -79.3832 },
  hasDeals: false,
  hasGroupAppointments: false,
  query: 'nail salon',
  sort: 'RECOMMENDED',
};

function buildUrl(vars) {
  const params = new URLSearchParams();
  params.set('extensions', JSON.stringify(extensions));
  params.set('variables', JSON.stringify({ ...baseVars, ...vars }));
  return `${ENDPOINT}?${params.toString()}`;
}

async function fetchPage(label, vars) {
  console.log(`\n=== ${label} ===`);
  const res = await fetch(buildUrl(vars), {
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
    for (const err of data.errors) console.log('Error:', err.message);
    return null;
  }

  const edges = data?.data?.geolocation?.locations?.edges || [];
  const pageInfo = data?.data?.geolocation?.locations?.pageInfo;
  console.log(`Results: ${edges.length}, hasNextPage: ${pageInfo?.hasNextPage}`);
  console.log('endCursor:', pageInfo?.endCursor);
  if (pageInfo?.endCursor) {
    const decoded = Buffer.from(pageInfo.endCursor, 'base64').toString('utf-8');
    console.log('Decoded:', decoded);
  }
  return pageInfo?.endCursor || null;
}

// 1. Fetch first page with first=10, capture cursor
const cursor10 = await fetchPage('first=10', { first: 10 });

// 2. Try using that cursor for page 2
if (cursor10) {
  console.log('\n--- Trying after cursor from first=10 ---');
  await fetchPage('first=10, after=cursor10', { first: 10, after: cursor10 });
}

// 3. Fetch first=200, capture cursor
const cursor200 = await fetchPage('first=200', { first: 200 });

// 4. Try using that cursor for next batch
if (cursor200) {
  console.log('\n--- Trying after cursor from first=200 ---');
  await fetchPage('first=200, after=cursor200', { first: 200, after: cursor200 });
}

// 5. Try manipulating cursor: decode, tweak, re-encode
if (cursor200) {
  const decoded = JSON.parse(Buffer.from(cursor200, 'base64').toString('utf-8'));
  console.log('\n--- Cursor manipulation tests ---');
  console.log('Original decoded:', decoded);

  // Try incrementing the last element (ID)
  const tweaked1 = [...decoded];
  tweaked1[2] = decoded[2] + 1;
  const cursorTweaked1 = Buffer.from(JSON.stringify(tweaked1)).toString('base64');
  console.log('Tweaked +1 ID:', tweaked1, '->', cursorTweaked1);
  await fetchPage('after=tweaked+1', { first: 10, after: cursorTweaked1 });

  // Try setting first element to 0
  const tweaked2 = [...decoded];
  tweaked2[0] = 0;
  const cursorTweaked2 = Buffer.from(JSON.stringify(tweaked2)).toString('base64');
  console.log('Tweaked score=0:', tweaked2, '->', cursorTweaked2);
  await fetchPage('after=score0', { first: 10, after: cursorTweaked2 });
}

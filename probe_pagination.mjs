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

async function fetchPage(label, variables) {
  console.log(`\n=== ${label} ===`);
  const res = await fetch(buildUrl(variables), {
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

  // The response structure is: data.geolocation.locations.edges
  const edges = data?.data?.geolocation?.locations?.edges || [];
  console.log(`Results: ${edges.length}`);
  for (const e of edges.slice(0, 3)) console.log('  -', e.node?.name);

  const pageInfo = data?.data?.geolocation?.locations?.pageInfo;
  if (pageInfo) {
    console.log('PageInfo:', JSON.stringify(pageInfo));
  }
  return pageInfo?.endCursor || null;
}

const baseVars = {
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
};

const cursor1 = await fetchPage('Page 1', baseVars);
if (cursor1) {
  const cursor2 = await fetchPage('Page 2', { ...baseVars, after: cursor1 });
  if (cursor2) {
    await fetchPage('Page 3', { ...baseVars, after: cursor2 });
  }
}

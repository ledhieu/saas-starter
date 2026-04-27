// Verify: does increasing `first` just return more from the top, or different results?
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

function buildUrl(first) {
  const params = new URLSearchParams();
  params.set('extensions', JSON.stringify(extensions));
  params.set('variables', JSON.stringify({ ...baseVars, first }));
  return `${ENDPOINT}?${params.toString()}`;
}

async function fetchNames(first) {
  const res = await fetch(buildUrl(first), {
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
  const edges = data?.data?.geolocation?.locations?.edges || [];
  return edges.map(e => e.node?.name);
}

const names10 = await fetchNames(10);
const names20 = await fetchNames(20);
const names50 = await fetchNames(50);

console.log('first=10:', names10.join(', '));
console.log('first=20:', names20.slice(0, 10).join(', '));
console.log('first=50:', names50.slice(0, 10).join(', '));

console.log('\n=== Comparison ===');
console.log('first 10 of 10  === first 10 of 20 ?', JSON.stringify(names10) === JSON.stringify(names20.slice(0, 10)));
console.log('first 10 of 10  === first 10 of 50 ?', JSON.stringify(names10) === JSON.stringify(names50.slice(0, 10)));
console.log('first 20 of 20  === first 20 of 50 ?', JSON.stringify(names20) === JSON.stringify(names50.slice(0, 20)));

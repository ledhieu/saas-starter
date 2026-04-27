// Verify if placeId actually changes results or returns same city-wide set
const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

const headers = {
  'Content-Type': 'application/json',
  'Accept': '*/*',
  'Accept-Language': 'en-CA',
  'x-client-platform': 'web',
  'x-client-version': CLIENT_VERSION,
  'Origin': 'https://www.fresha.com',
  'Referer': 'https://www.fresha.com/',
};

async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  });
  return res.json();
}

const coords = [
  { name: 'Vancouver', lat: 49.2827, lng: -123.1207 },
  { name: 'Toronto',   lat: 43.6532, lng: -79.3832 },
  { name: 'New York',  lat: 40.7128, lng: -74.0060 },
  { name: 'London UK', lat: 51.5074, lng: -0.1278 },
];

const query = `
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

for (const city of coords) {
  console.log(`\n=== ${city.name} (${city.lat}, ${city.lng}) ===`);
  const data = await gql(query, {
    placeId: `${city.lat},${city.lng}`,
    query: 'nail salon',
    first: 3,
  });
  const edges = data?.data?.geolocation?.locations?.edges || [];
  if (edges.length === 0) {
    console.log('  (no results)');
  }
  for (const edge of edges) {
    const n = edge.node;
    console.log(`  - ${n.name} (${n.slug})`);
  }
}

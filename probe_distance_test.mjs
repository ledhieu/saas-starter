const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

async function gql(query, variables) {
  const res = await fetch(ENDPOINT, {
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
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  });
  return res.json();
}

const q = `query($placeId: ID!, $query: String!, $first: Int!, $distance: Float) {
  geolocation(placeId: $placeId) {
    locations(query: $query, first: $first, distance: $distance) {
      edges { node { name slug } }
    }
  }
}`;

for (const d of [null, 1000, 5000, 30000, 100000]) {
  const vars = { placeId: '43.6532,-79.3832', query: 'nail salon', first: 3 };
  if (d) vars.distance = d;
  const data = await gql(q, vars);
  const edges = data?.data?.geolocation?.locations?.edges || [];
  console.log('distance=' + (d || 'none') + ':', edges.map(e => e.node.name).join(', ') || '(no results)');
}

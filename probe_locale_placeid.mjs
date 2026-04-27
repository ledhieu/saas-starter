const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

const query = `query($placeId: ID!, $query: String!, $first: Int!) {
  geolocation(placeId: $placeId) {
    locations(query: $query, first: $first) {
      edges { node { name slug } }
    }
  }
}`;

async function gql(headers, variables) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'x-client-platform': 'web',
      'x-client-version': CLIENT_VERSION,
      'Origin': 'https://www.fresha.com',
      'Referer': 'https://www.fresha.com/',
      ...headers,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  });
  return res.json();
}

const tests = [
  { label: 'en-CA + lat,lng Toronto',     lang: 'en-CA', placeId: '43.6532,-79.3832' },
  { label: 'en-US + lat,lng Toronto',     lang: 'en-US', placeId: '43.6532,-79.3832' },
  { label: 'en-GB + lat,lng Toronto',     lang: 'en-GB', placeId: '43.6532,-79.3832' },
  { label: 'en-CA + Google PlaceID T.O.', lang: 'en-CA', placeId: 'ChIJpTvG15DL1IkRd8S0KlBVNTI' },
  { label: 'en-US + Google PlaceID T.O.', lang: 'en-US', placeId: 'ChIJpTvG15DL1IkRd8S0KlBVNTI' },
  { label: 'en-CA + lat,lng Vancouver',   lang: 'en-CA', placeId: '49.2827,-123.1207' },
  { label: 'en-US + lat,lng Vancouver',   lang: 'en-US', placeId: '49.2827,-123.1207' },
];

for (const t of tests) {
  const data = await gql(
    { 'Accept-Language': t.lang },
    { placeId: t.placeId, query: 'nail salon', first: 3 }
  );
  const edges = data?.data?.geolocation?.locations?.edges || [];
  const names = edges.map(e => e.node.name).join(', ') || '(no results)';
  console.log(`${t.label.padEnd(35)} | ${names}`);
}

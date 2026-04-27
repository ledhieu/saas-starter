const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

const variables = { placeId: 'ChIJs0-pQ_FzhlQRi_OBm-qWkbs', query: 'nail salon', first: 3 };

const multilineQuery = `
  query SearchLocations($placeId: ID!, $query: String!, $first: Int!) {
    geolocation(placeId: $placeId) {
      locations(query: $query, first: $first) {
        edges { node { id name slug } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const inlineQuery = 'query SearchLocations($placeId: ID!, $query: String!, $first: Int!) { geolocation(placeId: $placeId) { locations(query: $query, first: $first) { edges { node { id name slug } } pageInfo { hasNextPage endCursor } } } }';

for (const [name, query] of [['multiline', multilineQuery], ['inline', inlineQuery]]) {
  console.log(`\n=== ${name} ===`);
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

  const json = await res.json();
  if (json.errors) {
    console.log('ERR:', json.errors[0].message);
  } else {
    console.log('OK:', json.data.geolocation.locations.edges.length, 'results');
  }
}

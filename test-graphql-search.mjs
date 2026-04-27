const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

const lat = 49.2827;
const lng = -123.1207;
const queryStr = 'nail salon';

const probes = [
  {
    name: 'geolocation no args, search no args (just query)',
    query: `query { geolocation { search(query: "${queryStr}") { edges { node { ... on Location { id name slug rating reviewsCount address { shortFormatted cityName latitude longitude } } } } } } } }`,
  },
  {
    name: 'geolocation with real placeId, search with query',
    query: `query Search($placeId: ID!) { geolocation(placeId: $placeId) { search(query: "${queryStr}") { edges { node { ... on Location { id name slug rating reviewsCount address { shortFormatted cityName latitude longitude } } } } } } } }`,
    variables: { placeId: 'ChIJs0-pQ_FzhlQRi_OBm-qWkbs' },
  },
  {
    name: 'geolocation with lat,lng placeId, search with query',
    query: `query Search($placeId: ID!) { geolocation(placeId: $placeId) { search(query: "${queryStr}") { edges { node { ... on Location { id name slug rating reviewsCount address { shortFormatted cityName latitude longitude } } } } } } } }`,
    variables: { placeId: `${lat},${lng}` },
  },
  {
    name: 'geolocation no args, search with distance',
    query: `query { geolocation { search(query: "${queryStr}", distance: 30000) { edges { node { ... on Location { id name slug } } } } } } }`,
  },
  {
    name: 'geolocation no args, search with center',
    query: `query { geolocation { search(query: "${queryStr}", center: "${lat},${lng}") { edges { node { ... on Location { id name slug } } } } } } }`,
  },
  {
    name: 'geolocation no args, search with lat lng',
    query: `query { geolocation { search(query: "${queryStr}", lat: ${lat}, lng: ${lng}) { edges { node { ... on Location { id name slug } } } } } } }`,
  },
  {
    name: 'geolocation no args, search with placeId',
    query: `query { geolocation { search(query: "${queryStr}", placeId: "${lat},${lng}") { edges { node { ... on Location { id name slug } } } } } } }`,
  },
  {
    name: 'geolocation no args, search with limit',
    query: `query { geolocation { search(query: "${queryStr}", limit: 10) { edges { node { ... on Location { id name slug } } } } } } }`,
  },
  {
    name: 'geolocation no args, search with first',
    query: `query { geolocation { search(query: "${queryStr}", first: 10) { edges { node { ... on Location { id name slug } } } } } } }`,
  },
  {
    name: 'geolocation with real placeId, search with distance',
    query: `query Search($placeId: ID!) { geolocation(placeId: $placeId) { search(query: "${queryStr}", distance: 30000) { edges { node { ... on Location { id name slug } } } } } } }`,
    variables: { placeId: 'ChIJs0-pQ_FzhlQRi_OBm-qWkbs' },
  },
];

for (const probe of probes) {
  console.log(`\n=== ${probe.name} ===`);
  try {
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
      body: JSON.stringify({
        query: probe.query,
        variables: probe.variables || {},
      }),
      signal: AbortSignal.timeout(15000),
    });

    const json = await res.json();
    
    if (json.errors) {
      const msgs = json.errors.map(e => e.message || JSON.stringify(e)).join(' | ');
      console.log('GraphQL errors:', msgs.slice(0, 400));
    } else if (json.data) {
      const search = json.data.geolocation?.search;
      const edges = search?.edges || [];
      const locations = edges.filter(e => e.node?.id).map(e => e.node);
      console.log('SUCCESS, Location results:', locations.length, '/', edges.length, 'total edges');
      for (const r of locations.slice(0, 3)) {
        console.log('  -', r.name, '|', r.slug);
      }
    } else {
      console.log('No data or errors');
    }
  } catch (e) {
    console.log('Fetch error:', e.message);
  }
}

// Probe Fresha GraphQL Geolocation.search field
const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

const queryStr = 'nail salon';

const probes = [
  {
    name: 'geolocation.search with Location fragment',
    query: `query { geolocation { search(query: "${queryStr}") { edges { node { ... on Location { id name slug rating reviewsCount address { shortFormatted cityName latitude longitude } } } } } } } }`,
  },
  {
    name: 'geolocation.search with Location fragment + real placeId on geolocation',
    query: `query Search($placeId: ID!) { geolocation(placeId: $placeId) { search(query: "${queryStr}") { edges { node { ... on Location { id name slug rating reviewsCount address { shortFormatted cityName latitude longitude } } } } } } } }`,
    variables: { placeId: 'ChIJs0-pQ_FzhlQRi_OBm-qWkbs' },
  },
  {
    name: 'geolocation.search with Location fragment + lat,lng placeId',
    query: `query Search($placeId: ID!) { geolocation(placeId: $placeId) { search(query: "${queryStr}") { edges { node { ... on Location { id name slug rating reviewsCount address { shortFormatted cityName latitude longitude } } } } } } } }`,
    variables: { placeId: '49.2827,-123.1207' },
  },
  {
    name: 'geolocation.search with count/limit',
    query: `query { geolocation { search(query: "${queryStr}", limit: 10) { edges { node { ... on Location { id name slug } } } } } } }`,
  },
  {
    name: 'geolocation.search with first',
    query: `query { geolocation { search(query: "${queryStr}", first: 10) { edges { node { ... on Location { id name slug } } } } } } }`,
  },
  {
    name: 'geolocation.search with distance',
    query: `query { geolocation { search(query: "${queryStr}", distance: 30000) { edges { node { ... on Location { id name slug } } } } } } }`,
  },
  {
    name: 'geolocation.search with center',
    query: `query { geolocation { search(query: "${queryStr}", center: "49.2827,-123.1207") { edges { node { ... on Location { id name slug } } } } } } }`,
  },
  {
    name: 'geolocation.search with lat lng on search',
    query: `query { geolocation { search(query: "${queryStr}", lat: 49.2827, lng: -123.1207) { edges { node { ... on Location { id name slug } } } } } } }`,
  },
  {
    name: 'geolocation no placeId, search with center',
    query: `query { geolocation { search(query: "${queryStr}", center: "49.2827,-123.1207") { edges { node { ... on Location { id name slug } } } } } } }`,
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
      const results = findResults(json.data);
      console.log('SUCCESS, results:', results.length);
      for (const r of results.slice(0, 5)) {
        console.log('  -', r.name || r.slug || JSON.stringify(r));
      }
    } else {
      console.log('No data or errors');
    }
  } catch (e) {
    console.log('Fetch error:', e.message);
  }
}

function findResults(obj, depth = 0) {
  if (depth > 10) return [];
  if (Array.isArray(obj)) {
    if (obj.length > 0 && (obj[0]?.slug || obj[0]?.name)) return obj;
    for (const item of obj) {
      const found = findResults(item, depth + 1);
      if (found.length) return found;
    }
  }
  if (obj && typeof obj === 'object') {
    for (const key of ['locations', 'edges', 'nodes', 'searchLocations', 'results', 'search']) {
      if (obj[key]) {
        const found = findResults(obj[key], depth + 1);
        if (found.length) return found;
      }
    }
  }
  return [];
}

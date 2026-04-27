// More targeted probes for Fresha GraphQL lat/lng support
const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

const lat = 49.2827;
const lng = -123.1207;
const queryStr = 'nail salon';

const probes = [
  {
    name: 'geolocation with center arg',
    query: `query { geolocation(center: "${lat},${lng}") { locations(query: "${queryStr}", first: 10) { edges { node { id name slug } } } } }`,
  },
  {
    name: 'geolocation with placeId (real Google Place ID)',
    query: `query SearchLocations($placeId: ID!, $query: String!, $first: Int!) { geolocation(placeId: $placeId) { locations(query: $query, first: $first) { edges { node { id name slug } } } } }`,
    variables: { placeId: 'ChIJs0-pQ_FzhlQRi_OBm-qWkbs', query: queryStr, first: 10 },
  },
  {
    name: 'geolocation no args',
    query: `query { geolocation { locations(query: "${queryStr}", first: 10) { edges { node { id name slug } } } } }`,
  },
  {
    name: 'searchHistory with lat lng',
    query: `query { searchHistory(lat: ${lat}, lng: ${lng}) { edges { node { id } } } }`,
  },
  {
    name: 'geolocation search field with center',
    query: `query { geolocation { search(center: "${lat},${lng}", query: "${queryStr}", first: 10) { edges { node { id name slug } } } } }`,
  },
  {
    name: 'geolocation search field no center',
    query: `query { geolocation { search(query: "${queryStr}", first: 10) { edges { node { id name slug } } } } }`,
  },
  {
    name: 'geolocation with placeId=lat,lng + different headers',
    query: `query SearchLocations($placeId: ID!, $query: String!, $first: Int!) { geolocation(placeId: $placeId) { locations(query: $query, first: $first) { edges { node { id name slug } } } } }`,
    variables: { placeId: `${lat},${lng}`, query: queryStr, first: 10 },
    headers: {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'Accept-Language': 'en-CA',
      'x-client-platform': 'web',
      'x-client-version': CLIENT_VERSION,
      'Origin': 'https://www.fresha.com',
      'Referer': `https://www.fresha.com/search?category=nails&center=${lat},${lng}&distance=30000`,
    },
  },
];

for (const probe of probes) {
  console.log(`\n=== ${probe.name} ===`);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: probe.headers || {
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
      console.log('GraphQL errors:', msgs.slice(0, 300));
    } else if (json.data) {
      const results = findResults(json.data);
      console.log('SUCCESS, results:', results.length);
      for (const r of results.slice(0, 3)) {
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

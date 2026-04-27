// Probe Fresha GraphQL for center() root field
const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

const lat = 49.2827;
const lng = -123.1207;
const queryStr = 'nail salon';

const probes = [
  {
    name: 'root center() with locations',
    query: `query { center(placeId: "${lat},${lng}") { locations(query: "${queryStr}", first: 10) { edges { node { id name slug } } } } }`,
  },
  {
    name: 'root center() with lat lng',
    query: `query { center(lat: ${lat}, lng: ${lng}) { locations(query: "${queryStr}", first: 10) { edges { node { id name slug } } } } }`,
  },
  {
    name: 'root center() with center string',
    query: `query { center(center: "${lat},${lng}") { locations(query: "${queryStr}", first: 10) { edges { node { id name slug } } } } }`,
  },
  {
    name: 'root center with search',
    query: `query { center(center: "${lat},${lng}") { search(query: "${queryStr}", first: 10) { edges { node { id name slug } } } } }`,
  },
  {
    name: 'root center no args',
    query: `query { center { locations(query: "${queryStr}", first: 10) { edges { node { id name slug } } } } }`,
  },
  {
    name: 'geolocation with center variable ( persisted query style )',
    query: `query SearchLocations($placeId: ID!, $query: String!, $first: Int!, $distance: Float) { geolocation(placeId: $placeId) { locations(query: $query, first: $first, distance: $distance) { edges { node { id name slug } } } } }`,
    variables: { placeId: `${lat},${lng}`, query: queryStr, first: 10, distance: 30000 },
  },
  {
    name: 'raw query with geolocation and center param',
    query: `query { geolocation(center: "${lat},${lng}") { locations(query: "${queryStr}", first: 10) { edges { node { id name slug } } } } }`,
  },
  {
    name: 'raw query with geolocation and coordinates param',
    query: `query { geolocation(coordinates: "${lat},${lng}") { locations(query: "${queryStr}", first: 10) { edges { node { id name slug } } } } }`,
  },
  {
    name: 'raw query with geolocation and lat lng params',
    query: `query { geolocation(lat: ${lat}, lng: ${lng}) { locations(query: "${queryStr}", first: 10) { edges { node { id name slug } } } } }`,
  },
  {
    name: 'searchLocations root with placeId=lat,lng',
    query: `query SearchLocations($placeId: ID!, $query: String!, $first: Int!) { searchLocations(placeId: $placeId, query: $query, first: $first) { edges { node { id name slug } } } }`,
    variables: { placeId: `${lat},${lng}`, query: queryStr, first: 10 },
  },
  {
    name: 'searchLocations root with center',
    query: `query { searchLocations(center: "${lat},${lng}", query: "${queryStr}", first: 10) { edges { node { id name slug } } } }`,
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

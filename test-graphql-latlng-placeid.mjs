const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

const lat = 49.2827;
const lng = -123.1207;

const probes = [
  {
    name: 'geolocation with real Place ID, locations field',
    query: `query SearchLocations($placeId: ID!, $query: String!, $first: Int!) { geolocation(placeId: $placeId) { locations(query: $query, first: $first) { edges { node { id name slug } } } } } }`,
    variables: { placeId: 'ChIJs0-pQ_FzhlQRi_OBm-qWkbs', query: 'nail salon', first: 10 },
  },
  {
    name: 'geolocation with lat,lng placeId, locations field',
    query: `query SearchLocations($placeId: ID!, $query: String!, $first: Int!) { geolocation(placeId: $placeId) { locations(query: $query, first: $first) { edges { node { id name slug } } } } } }`,
    variables: { placeId: `${lat},${lng}`, query: 'nail salon', first: 10 },
  },
  {
    name: 'geolocation with real Place ID, search field',
    query: `query Search($placeId: ID!) { geolocation(placeId: $placeId) { search(query: "nail salon") { edges { node { ... on Location { id name slug } } } } } } }`,
    variables: { placeId: 'ChIJs0-pQ_FzhlQRi_OBm-qWkbs' },
  },
  {
    name: 'geolocation with lat,lng placeId, search field',
    query: `query Search($placeId: ID!) { geolocation(placeId: $placeId) { search(query: "nail salon") { edges { node { ... on Location { id name slug } } } } } } }`,
    variables: { placeId: `${lat},${lng}` },
  },
  {
    name: 'geolocation no args, locations field',
    query: `query { geolocation { locations(query: "nail salon", first: 10) { edges { node { id name slug } } } } }`,
  },
  {
    name: 'geolocation no args, search field',
    query: `query { geolocation { search(query: "nail salon") { edges { node { ... on Location { id name slug } } } } } }`,
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
      console.log('ERR:', msgs.slice(0, 300));
    } else if (json.data) {
      const geo = json.data.geolocation;
      let count = 0;
      if (geo.locations) {
        count = (geo.locations.edges || []).filter(e => e.node?.id).length;
      } else if (geo.search) {
        count = (geo.search.edges || []).filter(e => e.node?.id).length;
      }
      console.log('OK:', count, 'results');
    }
  } catch (e) {
    console.log('Fetch error:', e.message);
  }
}

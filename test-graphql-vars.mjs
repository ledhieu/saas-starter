const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

const probes = [
  {
    name: 'variables with locations (working query from fresha-search-graphql)',
    query: `query SearchLocations($placeId: ID!, $query: String!, $first: Int!) { geolocation(placeId: $placeId) { locations(query: $query, first: $first) { edges { node { id name slug } } } } } }`,
    variables: { placeId: 'ChIJs0-pQ_FzhlQRi_OBm-qWkbs', query: 'nail salon', first: 10 },
  },
  {
    name: 'variables with search field',
    query: `query Search($placeId: ID!) { geolocation(placeId: $placeId) { search(query: "nail salon") { edges { node { ... on Location { id name slug } } } } } } }`,
    variables: { placeId: 'ChIJs0-pQ_FzhlQRi_OBm-qWkbs' },
  },
  {
    name: 'no variables, inline query with locations',
    query: `query { geolocation(placeId: "ChIJs0-pQ_FzhlQRi_OBm-qWkbs") { locations(query: "nail salon", first: 10) { edges { node { id name slug } } } } }`,
  },
  {
    name: 'no variables, inline query with search',
    query: `query { geolocation(placeId: "ChIJs0-pQ_FzhlQRi_OBm-qWkbs") { search(query: "nail salon") { edges { node { ... on Location { id name slug } } } } } }`,
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
      body: JSON.stringify(probe.variables 
        ? { query: probe.query, variables: probe.variables }
        : { query: probe.query }
      ),
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

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

// Try introspection queries
const probes = [
  {
    name: '__schema types',
    query: `query { __schema { types { name } } }`,
  },
  {
    name: '__schema queryType fields',
    query: `query { __schema { queryType { fields { name description args { name } } } } }`,
  },
  {
    name: '__type Geolocation',
    query: `query { __type(name: "Geolocation") { fields { name description args { name } } } }`,
  },
  {
    name: '__type Query',
    query: `query { __type(name: "Query") { fields { name description args { name } } } }`,
  },
  {
    name: '__type Location',
    query: `query { __type(name: "Location") { fields { name description args { name } } } }`,
  },
  {
    name: 'geolocation basic',
    query: `query { geolocation { __typename } }`,
  },
  {
    name: 'locations basic',
    query: `query { locations { __typename } }`,
  },
];

for (const probe of probes) {
  console.log(`\n=== ${probe.name} ===`);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: probe.query }),
      signal: AbortSignal.timeout(15000),
    });

    const json = await res.json();
    if (json.errors) {
      const msgs = json.errors.map(e => e.message).join(' | ');
      console.log('ERR:', msgs.slice(0, 300));
    } else {
      console.log('OK:', JSON.stringify(json.data).slice(0, 800));
    }
  } catch (e) {
    console.log('Fetch error:', e.message);
  }
}

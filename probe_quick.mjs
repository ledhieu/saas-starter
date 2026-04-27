const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

fetch(ENDPOINT, {
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
    query: 'query { geolocation(placeId: "49.2827,-123.1207") { locations(query: "nail salon", first: 3) { edges { node { id name slug } } } } }',
    variables: {},
  }),
  signal: AbortSignal.timeout(15000),
}).then(async r => {
  console.log('Status:', r.status);
  console.log('Content-Type:', r.headers.get('content-type'));
  const text = await r.text();
  console.log('Body first 300 chars:', text.slice(0, 300));
}).catch(e => console.log('Error:', e.message));

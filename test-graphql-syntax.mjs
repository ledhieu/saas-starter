const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

const query = 'query { geolocation { search(query: "nail salon") { edges { node { ... on Location { id name slug } } } } } }';

console.log('Query:', query);

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
  body: JSON.stringify({ query }),
  signal: AbortSignal.timeout(15000),
});

const json = await res.json();
console.log(JSON.stringify(json, null, 2).slice(0, 1000));

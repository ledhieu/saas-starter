const ENDPOINT = 'https://www.fresha.com/graphql';
const query = 'query { geolocation { search(query: "nail salon") { edges { node { ... on Location { id name slug } } } } } } }';

const url = new URL(ENDPOINT);
url.searchParams.set('query', query);

console.log('GET', url.toString());

const res = await fetch(url.toString(), {
  method: 'GET',
  headers: {
    'Accept': '*/*',
    'Accept-Language': 'en-CA',
    'x-client-platform': 'web',
    'x-client-version': '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96',
    'Origin': 'https://www.fresha.com',
    'Referer': 'https://www.fresha.com/',
  },
  signal: AbortSignal.timeout(15000),
});

console.log('Status:', res.status);
const text = await res.text();
console.log(text.slice(0, 500));

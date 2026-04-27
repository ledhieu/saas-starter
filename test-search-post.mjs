const lat = 49.2827;
const lng = -123.1207;

const tests = [
  {
    name: 'POST /search with JSON',
    url: 'https://www.fresha.com/search',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
    body: JSON.stringify({ category: 'nails', center: `${lat},${lng}`, distance: 30000 }),
  },
  {
    name: 'POST /search with form data',
    url: 'https://www.fresha.com/search',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
    body: new URLSearchParams({ category: 'nails', center: `${lat},${lng}`, distance: '30000' }).toString(),
  },
  {
    name: 'POST /graphql with search operation and center',
    url: 'https://www.fresha.com/graphql',
    headers: {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'Accept-Language': 'en-CA',
      'x-client-platform': 'web',
      'x-client-version': '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96',
      'Origin': 'https://www.fresha.com',
      'Referer': 'https://www.fresha.com/search',
    },
    body: JSON.stringify({
      operationName: 'SearchPageQuery',
      query: 'query SearchPageQuery($center: String, $distance: Float, $query: String) { searchResults(center: $center, distance: $distance, query: $query) { edges { node { id name slug } } } }',
      variables: { center: `${lat},${lng}`, distance: 30000, query: 'nail salon' },
    }),
  },
];

for (const test of tests) {
  console.log(`\n=== ${test.name} ===`);
  try {
    const res = await fetch(test.url, {
      method: 'POST',
      headers: test.headers,
      body: test.body,
      signal: AbortSignal.timeout(15000),
    });
    console.log('Status:', res.status, 'Content-Type:', res.headers.get('content-type'));
    const text = await res.text();
    console.log(text.slice(0, 500));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

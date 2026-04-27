const lat = 49.2827;
const lng = -123.1207;

const endpoints = [
  'https://www.fresha.com/graphql',
  'https://www.fresha.com/graphql/search',
  'https://api.fresha.com/graphql',
  'https://www.fresha.com/api/graphql',
];

const body = JSON.stringify({
  query: `query { geolocation { search(query: "nail salon") { edges { node { ... on Location { id name slug } } } } } } }`,
});

for (const endpoint of endpoints) {
  console.log(`\n=== ${endpoint} ===`);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Accept-Language': 'en-CA',
        'x-client-platform': 'web',
        'x-client-version': '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96',
        'Origin': 'https://www.fresha.com',
        'Referer': `https://www.fresha.com/search?category=nails&center=${lat},${lng}&distance=30000`,
      },
      body,
      signal: AbortSignal.timeout(15000),
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text.slice(0, 300));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

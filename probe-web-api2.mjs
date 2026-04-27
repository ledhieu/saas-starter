// Try various Accept headers and endpoints for Fresha search
const lat = 49.2827;
const lng = -123.1207;

const tests = [
  {
    name: 'search with Accept: application/json',
    url: `https://www.fresha.com/search?category=nails&center=${lat},${lng}&distance=30000`,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  },
  {
    name: 'search with x-requested-with: XMLHttpRequest',
    url: `https://www.fresha.com/search?category=nails&center=${lat},${lng}&distance=30000`,
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  },
  {
    name: 'api/v2/search',
    url: `https://www.fresha.com/api/v2/search?category=nails&center=${lat},${lng}&distance=30000`,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  },
  {
    name: 'api/search',
    url: `https://www.fresha.com/api/search?category=nails&center=${lat},${lng}&distance=30000`,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  },
  {
    name: 'graphql with search operation',
    url: 'https://www.fresha.com/graphql',
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
    body: JSON.stringify({
      operationName: 'Search',
      variables: { center: `${lat},${lng}`, distance: 30000, query: 'nail salon' },
      query: 'query Search($center: String, $distance: Float, $query: String) { search(center: $center, distance: $distance, query: $query) { edges { node { id name slug } } } }',
    }),
  },
  {
    name: 'graphql with SearchLocations and center',
    url: 'https://www.fresha.com/graphql',
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
    body: JSON.stringify({
      operationName: 'SearchLocations',
      variables: { center: `${lat},${lng}`, query: 'nail salon', first: 10 },
      query: 'query SearchLocations($center: String, $query: String, $first: Int) { locations(center: $center, query: $query, first: $first) { edges { node { id name slug } } } }',
    }),
  },
];

for (const test of tests) {
  console.log(`\n=== ${test.name} ===`);
  try {
    const res = await fetch(test.url, {
      method: test.method || 'GET',
      headers: test.headers,
      body: test.body,
      signal: AbortSignal.timeout(15000),
    });
    
    const contentType = res.headers.get('content-type') || 'unknown';
    console.log('Status:', res.status, 'Content-Type:', contentType);
    
    const text = await res.text();
    
    if (contentType.includes('json')) {
      try {
        const json = JSON.parse(text);
        console.log('JSON:', JSON.stringify(json).slice(0, 500));
      } catch {
        console.log('Invalid JSON:', text.slice(0, 500));
      }
    } else {
      console.log('Response:', text.slice(0, 500));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

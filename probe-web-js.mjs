import fs from 'fs';

const lat = 49.2827;
const lng = -123.1207;

const url = new URL('https://www.fresha.com/search');
url.searchParams.set('category', 'nails');
url.searchParams.set('center', `${lat},${lng}`);
url.searchParams.set('distance', '30000');

console.log('Fetching:', url.toString());

const res = await fetch(url.toString(), {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept-Language': 'en-CA',
    'Accept': 'text/html',
  },
  signal: AbortSignal.timeout(15000),
});

const html = await res.text();

// Find all script src URLs
const scriptSrcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
console.log('Script sources:', scriptSrcs.slice(0, 10));

// Look for graphql queries in the HTML
const graphqlMatches = [...html.matchAll(/query\s+\w+\s*\([^)]*\)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)];
console.log('GraphQL queries in HTML:', graphqlMatches.length);
for (const m of graphqlMatches.slice(0, 5)) {
  console.log('  ', m[0].slice(0, 200));
}

// Look for operation names
const opNames = [...html.matchAll(/"operationName"\s*:\s*"([^"]+)"/g)].map(m => m[1]);
console.log('Operation names:', [...new Set(opNames)]);

// Look for persisted query hashes
const pqHashes = [...html.matchAll(/"sha256Hash"\s*:\s*"([a-f0-9]+)"/g)].map(m => m[1]);
console.log('Persisted query hashes:', [...new Set(pqHashes)]);

// Look for any API endpoints
const apiUrls = [...html.matchAll(/https:\/\/[^"'\s]+graphql[^"'\s]*/g)].map(m => m[0]);
console.log('API URLs:', [...new Set(apiUrls)]);

fs.writeFileSync('probe-web-html.html', html);
console.log('\nHTML saved to probe-web-html.html');

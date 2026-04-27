// Probe Fresha web search URL with center=lat,lng
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

console.log('Status:', res.status);
const html = await res.text();

const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
if (!nextDataMatch) {
  console.log('No __NEXT_DATA__ found');
  console.log('HTML snippet:', html.slice(0, 1000));
  process.exit(1);
}

const data = JSON.parse(nextDataMatch[1]);

console.log('pageProps keys:', Object.keys(data.props.pageProps));

const providers = data.props.pageProps.providersProps;
console.log('providersProps type:', typeof providers);
if (providers) {
  if (Array.isArray(providers)) {
    console.log('providers length:', providers.length);
    for (const p of providers.slice(0, 3)) {
      console.log('Provider:', JSON.stringify(p).slice(0, 500));
    }
  } else if (typeof providers === 'object') {
    console.log('providers keys:', Object.keys(providers));
    if (providers.searchResults) {
      console.log('searchResults:', JSON.stringify(providers.searchResults).slice(0, 2000));
    }
    if (providers.locations) {
      console.log('locations:', JSON.stringify(providers.locations).slice(0, 2000));
    }
  }
}

fs.writeFileSync('probe-web-data.json', JSON.stringify(data, null, 2));
console.log('\nFull data written to probe-web-data.json');

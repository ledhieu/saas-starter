// Probe Fresha web app JS bundles to find the search API call
import fs from 'fs';

const chunkUrls = [
  'https://www.fresha.com/assets/_next/static/chunks/1256-df51265e0d4cb0ba.js',
  'https://www.fresha.com/assets/_next/static/chunks/8366-badeb599505838e5.js',
  'https://www.fresha.com/assets/_next/static/chunks/4176-b0ebe580951b801e.js',
  'https://www.fresha.com/assets/_next/static/chunks/6072-ba637422bca324bd.js',
];

for (const url of chunkUrls) {
  console.log(`\n=== Fetching ${url.split('/').pop()} ===`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(15000),
    });
    const js = await res.text();
    
    // Search for GraphQL queries related to location/search
    const queries = [...js.matchAll(/query\s+([A-Z]\w*)\s*\([^)]*\)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)];
    const searchQueries = queries.filter(q => 
      /location|search|center|distance|placeId|geolocation/i.test(q[0])
    );
    console.log('Search-related queries:', searchQueries.length);
    for (const q of searchQueries.slice(0, 3)) {
      console.log('  ', q[0].slice(0, 300));
    }
    
    // Search for REST API endpoints
    const endpoints = [...js.matchAll(/"(\/[^"]*search[^"]*)"/gi)];
    console.log('Search endpoints:', [...new Set(endpoints.map(e => e[1]))].slice(0, 5));
    
    // Search for "center" usage near "fetch" or "graphql"
    const centerMatches = [...js.matchAll(/.{0,50}center.{0,50}/g)];
    const relevant = centerMatches.filter(m => /fetch|graphql|query|location/i.test(m[0]));
    console.log('Center+API matches:', relevant.length);
    for (const m of relevant.slice(0, 3)) {
      console.log('  ', m[0].slice(0, 200));
    }
    
    fs.writeFileSync(`probe-${url.split('/').pop()}`, js);
  } catch (e) {
    console.log('Error:', e.message);
  }
}

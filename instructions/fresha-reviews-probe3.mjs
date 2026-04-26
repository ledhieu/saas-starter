// Third probe: check schema.org, JSON-LD, alternate data paths, and other endpoints
const LOCATION_SLUG = 'mood-nail-bar-vancouver-337-east-broadway-nch13fdn';

async function fetchHtml(slug) {
  const res = await fetch(`https://www.fresha.com/a/${slug}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-CA' }
  });
  return await res.text();
}

const html = await fetchHtml(LOCATION_SLUG);

// ---------- 21. Check for JSON-LD / schema.org Review markup ----------
console.log('\n=== 21. JSON-LD / schema.org Review markup ===');
const ldScripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
console.log('Found', ldScripts.length, 'JSON-LD blocks');
for (let i = 0; i < ldScripts.length; i++) {
  try {
    const data = JSON.parse(ldScripts[i][1]);
    console.log(`Block ${i} @type:`, data['@type'] || (Array.isArray(data) ? data[0]?.['@type'] : 'N/A'));
    if (data['@type'] === 'LocalBusiness' || data['@type'] === 'HairSalon' || data['@type'] === 'NailSalon') {
      if (data.review) {
        console.log('  Has review array:', Array.isArray(data.review));
        if (Array.isArray(data.review) && data.review[0]) {
          console.log('  First review keys:', Object.keys(data.review[0]).join(', '));
        }
      }
    }
    if (Array.isArray(data)) {
      const reviewItems = data.filter(d => d['@type'] === 'Review');
      console.log('  Review items in array:', reviewItems.length);
      if (reviewItems.length > 0) {
        console.log('  First review keys:', Object.keys(reviewItems[0]).join(', '));
      }
    }
  } catch (e) {
    console.log(`Block ${i}: parse error`);
  }
}

// ---------- 22. Deep search __NEXT_DATA__ for any review-service association ----------
console.log('\n=== 22. Deep search __NEXT_DATA__ for service in review context ===');
const startTag = '<script id="__NEXT_DATA__" type="application/json">';
const i = html.indexOf(startTag);
const j = html.indexOf('</script>', i + startTag.length);
const nextData = JSON.parse(html.slice(i + startTag.length, j));

function deepSearch(obj, path = '') {
  const results = [];
  if (typeof obj !== 'object' || obj === null) return results;
  if (Array.isArray(obj)) {
    for (let idx = 0; idx < obj.length; idx++) {
      results.push(...deepSearch(obj[idx], `${path}[${idx}]`));
    }
    return results;
  }
  for (const [key, val] of Object.entries(obj)) {
    const newPath = path ? `${path}.${key}` : key;
    if (/review/i.test(key) && /service|treatment|catalog|booking|appointment/i.test(JSON.stringify(val))) {
      results.push({ path: newPath, keys: typeof val === 'object' && val !== null ? Object.keys(val) : null });
    }
    if (typeof val === 'object' && val !== null) {
      results.push(...deepSearch(val, newPath));
    }
  }
  return results;
}

const deepHits = deepSearch(nextData);
console.log('Paths containing "review" and service-like text:', deepHits.length);
for (const h of deepHits.slice(0, 20)) {
  console.log('  ', h.path, h.keys ? `keys:[${h.keys.join(', ')}]` : '');
}

// ---------- 23. Check if there is a separate reviews API endpoint ----------
console.log('\n=== 23. Check for alternate review API endpoints ===');
const possiblePaths = [
  'https://www.fresha.com/api/v1/reviews',
  'https://www.fresha.com/api/reviews',
  'https://www.fresha.com/api/v2/reviews',
  'https://www.fresha.com/rpc/reviews',
  'https://api.fresha.com/reviews',
];
for (const url of possiblePaths) {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log(`  ${url} => ${res.status}`);
  } catch (e) {
    console.log(`  ${url} => ERROR: ${e.message}`);
  }
}

// ---------- 24. Check if review response has any hidden extensions or metadata ----------
console.log('\n=== 24. Check GraphQL response for extensions ===');
const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';
const REVIEWS_QUERY_HASH = '95379a2f375f5cbb94f9fab8dae3a4b194c50074c106f28606684d41fef3a0a4';
const variables = { id: '', reviews: 5, ratings: [], slug: LOCATION_SLUG, sortingType: 'LATEST' };
const url = ENDPOINT + '?extensions=' + encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: REVIEWS_QUERY_HASH } })) + '&variables=' + encodeURIComponent(JSON.stringify(variables));
const res = await fetch(url, {
  headers: {
    'Accept': '*/*',
    'Accept-Language': 'en-CA',
    'x-client-platform': 'web',
    'x-client-version': CLIENT_VERSION,
    'x-graphql-operation-name': 'query Location_ReviewsModal_Query',
    'Origin': 'https://www.fresha.com',
    'Referer': 'https://www.fresha.com/',
  },
});
const json = await res.json();
console.log('Response top-level keys:', Object.keys(json).join(', '));
if (json.extensions) {
  console.log('Extensions:', JSON.stringify(json.extensions, null, 2).slice(0, 800));
}

// ---------- 25. Check if any review text mentions services (natural language analysis) ----------
console.log('\n=== 25. Sample review text analysis ===');
const reviews = json.data?.location?.reviews?.edges?.map(e => e.node) ?? [];
for (const r of reviews) {
  const text = (r.text || '').toLowerCase();
  const mentionsService = /manicure|pedicure|gel|acrylic|builder|nail|treatment|service|wax|lash|brow|facial|massage/i.test(text);
  console.log(`  Review ${r.id}: mentions service? ${mentionsService} | "${r.text?.slice(0, 80)}..."`);
}

console.log('\n=== DONE ===');

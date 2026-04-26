// Native Fresha search via GraphQL geolocation.locations
//
// Discovered via field-suggestion probing against https://www.fresha.com/graphql
//
// Usage:
//   node fresha-search-graphql.mjs <google_place_id> <keyword> [first]
//
// Example:
//   node fresha-search-graphql.mjs ChIJs0-pQ_FzhlQRi_OBm-qWkbs "nail salon" 20
//
// To get a Google Place ID, use Google Geocoding API:
//   curl "https://maps.googleapis.com/maps/api/geocode/json?address=Vancouver,BC&key=YOUR_KEY"
//   → results[0].place_id

const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

async function searchLocations({ placeId, query, first = 20, after = '' }) {
  const variables = { placeId, query, first };
  if (after) variables.after = after;

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
    body: JSON.stringify({
      query: `
        query SearchLocations($placeId: ID!, $query: String!, $first: Int!, $after: ID) {
          geolocation(placeId: $placeId) {
            locations(query: $query, first: $first, after: $after) {
              edges {
                node {
                  id
                  name
                  slug
                  rating
                  reviewsCount
                  contactNumber
                  description
                  address {
                    shortFormatted
                    cityName
                    latitude
                    longitude
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      `,
      variables,
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error('GraphQL errors: ' + JSON.stringify(json.errors));
  return json.data.geolocation.locations;
}

async function fetchAll({ placeId, query, max = Infinity }) {
  const all = [];
  let after = '';
  let page = 0;

  while (all.length < max) {
    const batchSize = Math.min(50, max - all.length);
    const result = await searchLocations({ placeId, query, first: batchSize, after });
    page++;

    for (const edge of result.edges) {
      if (all.length >= max) break;
      all.push(edge.node);
    }

    console.error(`  page ${page}: ${all.length} total fetched`);

    if (!result.pageInfo.hasNextPage) break;
    after = result.pageInfo.endCursor;
  }

  return all;
}

// --- main ---
const [placeId, query, firstArg] = process.argv.slice(2);
const first = parseInt(firstArg, 10) || 20;

if (!placeId || !query) {
  console.error('Usage: node fresha-search-graphql.mjs <google_place_id> <keyword> [first]');
  console.error('Example: node fresha-search-graphql.mjs ChIJs0-pQ_FzhlQRi_OBm-qWkbs "nail salon" 20');
  process.exit(1);
}

console.error(`Searching Fresha for "${query}" near placeId=${placeId} …`);
const results = await fetchAll({ placeId, query, max: first });
console.error(`\n→ ${results.length} result(s)\n`);

for (const loc of results) {
  console.log(`- ${loc.name}`);
  console.log(`  id:       ${loc.id}`);
  console.log(`  slug:     ${loc.slug}`);
  console.log(`  rating:   ${loc.rating ?? '—'} (${loc.reviewsCount ?? 0} reviews)`);
  console.log(`  phone:    ${loc.contactNumber ?? '—'}`);
  console.log(`  address:  ${loc.address?.shortFormatted ?? '—'}`);
  console.log(`  coords:   ${loc.address?.latitude ?? '—'}, ${loc.address?.longitude ?? '—'}`);
  console.log();
}

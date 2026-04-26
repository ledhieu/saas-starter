// Probe Fresha GraphQL for review-service associations
// Run: node instructions/fresha-reviews-probe.mjs

const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';
const LOCATION_SLUG = 'mood-nail-bar-vancouver-337-east-broadway-nch13fdn';
const LOCATION_ID = '2838529'; // known Vancouver nail salon location id

async function gqlQuery(payload) {
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
    body: JSON.stringify(payload),
  });
  if (!res.ok) return { _httpError: `${res.status}: ${await res.text()}` };
  try { return await res.json(); } catch (e) { return { _parseError: await res.text() }; }
}

async function fetchHtmlNextData(slug) {
  const res = await fetch(`https://www.fresha.com/a/${slug}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'en-CA' },
  });
  const html = await res.text();
  const startTag = '<script id="__NEXT_DATA__" type="application/json">';
  const i = html.indexOf(startTag);
  const j = html.indexOf('</script>', i + startTag.length);
  if (i === -1 || j === -1) return { _error: 'No __NEXT_DATA__ found' };
  return JSON.parse(html.slice(i + startTag.length, j));
}

// ---------- 1. Introspection: Review type fields ----------
console.log('\n=== 1. Introspection: Review type fields ===');
const intro1 = await gqlQuery({
  query: `
    query IntrospectionReview {
      __type(name: "Review") {
        name
        fields {
          name
          type { name kind }
        }
      }
    }
  `
});
if (intro1.data?.__type?.fields) {
  const names = intro1.data.__type.fields.map(f => f.name);
  console.log('Review fields:', names.sort().join(', '));
  const serviceFields = names.filter(n => /service|treatment|booking|appointment|catalog|item/i.test(n));
  console.log('Service-related fields:', serviceFields.length ? serviceFields.join(', ') : 'NONE');
} else {
  console.log('Result:', JSON.stringify(intro1, null, 2).slice(0, 800));
}

// ---------- 2. Introspection: Location type fields (look for reviews) ----------
console.log('\n=== 2. Introspection: Location type fields ===');
const intro2 = await gqlQuery({
  query: `
    query IntrospectionLocation {
      __type(name: "Location") {
        fields {
          name
          type { name kind }
        }
      }
    }
  `
});
if (intro2.data?.__type?.fields) {
  const names = intro2.data.__type.fields.map(f => f.name);
  const reviewFields = names.filter(n => /review/i.test(n));
  console.log('Location review-related fields:', reviewFields.join(', ') || 'NONE');
} else {
  console.log('Result:', JSON.stringify(intro2, null, 2).slice(0, 800));
}

// ---------- 3. Custom query: location(id).reviews with service field ----------
console.log('\n=== 3. Custom query: location(id).reviews requesting service field ===');
const q3 = await gqlQuery({
  query: `
    query LocationReviews($locationId: ID!, $first: Int!) {
      location(id: $locationId) {
        reviews(first: $first) {
          edges {
            node {
              id
              rating
              text
              service { id name }
              serviceId
              appointmentService { id name }
              treatment { id name }
              booking { id services { id name } }
            }
          }
        }
      }
    }
  `,
  variables: { locationId: LOCATION_ID, first: 3 }
});
console.log(JSON.stringify(q3, null, 2).slice(0, 1200));

// ---------- 4. Custom query: location by slug with reviews expanded ----------
console.log('\n=== 4. Custom query: location(slug).reviews with expanded fields ===');
const q4 = await gqlQuery({
  query: `
    query LocationBySlug($slug: String!) {
      location(slug: $slug) {
        reviews(first: 3) {
          edges {
            node {
              id
              rating
              text
              service { id name }
              serviceId
              catalogItem { id name }
              appointment { id }
            }
          }
        }
      }
    }
  `,
  variables: { slug: LOCATION_SLUG }
});
console.log(JSON.stringify(q4, null, 2).slice(0, 1200));

// ---------- 5. Try publicReviews query ----------
console.log('\n=== 5. Try publicReviews query ===');
const q5 = await gqlQuery({
  query: `
    query PublicReviews($locationId: ID!, $first: Int!) {
      publicReviews(locationId: $locationId, first: $first) {
        edges {
          node {
            id
            rating
            text
            service { id name }
          }
        }
      }
    }
  `,
  variables: { locationId: LOCATION_ID, first: 3 }
});
console.log(JSON.stringify(q5, null, 2).slice(0, 1200));

// ---------- 6. Try locationReviews query ----------
console.log('\n=== 6. Try locationReviews query ===');
const q6 = await gqlQuery({
  query: `
    query LocationReviewsAlt($locationId: ID!, $first: Int!) {
      locationReviews(locationId: $locationId, first: $first) {
        edges {
          node {
            id
            rating
            text
            service { id name }
          }
        }
      }
    }
  `,
  variables: { locationId: LOCATION_ID, first: 3 }
});
console.log(JSON.stringify(q6, null, 2).slice(0, 1200));

// ---------- 7. Check __NEXT_DATA__ for review structure ----------
console.log('\n=== 7. __NEXT_DATA__ review structure ===');
const nextData = await fetchHtmlNextData(LOCATION_SLUG);
const loc = nextData.props?.pageProps?.data?.location;
if (loc?.reviews?.edges?.length > 0) {
  const reviewNode = loc.reviews.edges[0].node;
  console.log('Review node keys:', Object.keys(reviewNode).sort().join(', '));
  const serviceKeys = Object.keys(reviewNode).filter(k => /service|treatment|booking|appointment|catalog/i.test(k));
  console.log('Service-related keys:', serviceKeys.length ? serviceKeys.join(', ') : 'NONE');
  console.log('Sample review node (first 800 chars):', JSON.stringify(reviewNode, null, 2).slice(0, 800));
} else {
  console.log('No reviews in __NEXT_DATA__ or error');
  console.log(JSON.stringify(nextData, null, 2).slice(0, 600));
}

// ---------- 8. Try persisted review query with service field via GET (it will fail but tells us schema) ----------
console.log('\n=== 8. Persisted query with extra service field (should fail validation) ===');
const REVIEWS_QUERY_HASH = '95379a2f375f5cbb94f9fab8dae3a4b194c50074c106f28606684d41fef3a0a4';
const variables8 = { id: '', reviews: 3, ratings: [], slug: LOCATION_SLUG, sortingType: 'LATEST' };
const url8 = ENDPOINT + '?extensions=' + encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: REVIEWS_QUERY_HASH } })) + '&variables=' + encodeURIComponent(JSON.stringify(variables8));
const res8 = await fetch(url8, {
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
const json8 = await res8.json();
console.log('Persisted query edges[0] node keys:', Object.keys(json8.data?.location?.reviews?.edges?.[0]?.node ?? {}).sort().join(', ') || 'N/A');

// ---------- 9. Try reviews with service filter ----------
console.log('\n=== 9. Try reviews with serviceId filter ===');
const q9 = await gqlQuery({
  query: `
    query ReviewsWithServiceFilter($locationId: ID!, $serviceId: ID!, $first: Int!) {
      location(id: $locationId) {
        reviews(first: $first, serviceId: $serviceId) {
          edges {
            node { id rating text }
          }
        }
      }
    }
  `,
  variables: { locationId: LOCATION_ID, serviceId: 'dummy-service-id', first: 3 }
});
console.log(JSON.stringify(q9, null, 2).slice(0, 1200));

// ---------- 10. Introspection: ReviewsConnection / ReviewsEdge types ----------
console.log('\n=== 10. Introspection: ReviewsConnection & ReviewsEdge types ===');
const intro10 = await gqlQuery({
  query: `
    query IntrospectionReviewsConnection {
      __type(name: "ReviewsConnection") {
        fields { name type { name kind } }
      }
    }
  `
});
console.log('ReviewsConnection fields:', intro10.data?.__type?.fields?.map(f => f.name).sort().join(', ') ?? JSON.stringify(intro10).slice(0, 600));

const intro10b = await gqlQuery({
  query: `
    query IntrospectionReviewsEdge {
      __type(name: "ReviewsEdge") {
        fields { name type { name kind } }
      }
    }
  `
});
console.log('ReviewsEdge fields:', intro10b.data?.__type?.fields?.map(f => f.name).sort().join(', ') ?? JSON.stringify(intro10b).slice(0, 600));

// ---------- 11. Try Appointment / Booking type introspection for service links ----------
console.log('\n=== 11. Introspection: Appointment type fields ===');
const intro11 = await gqlQuery({
  query: `
    query IntrospectionAppointment {
      __type(name: "Appointment") {
        fields { name type { name kind } }
      }
    }
  `
});
console.log('Appointment fields:', intro11.data?.__type?.fields?.map(f => f.name).sort().join(', ') ?? JSON.stringify(intro11).slice(0, 600));

// ---------- 12. Check HTML for review markup with service names ----------
console.log('\n=== 12. Check raw HTML for review service mentions ===');
const htmlRes = await fetch(`https://www.fresha.com/a/${LOCATION_SLUG}`, {
  headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-CA' }
});
const html = await htmlRes.text();
// Look for data-testid or class patterns that might include service info
const serviceInReviews = html.includes('data-testid="review-service"') || html.includes('review-service') || html.includes('data-service-name=');
console.log('HTML contains review-service markers:', serviceInReviews);
// Look at review-related data attributes
const reviewDataAttrs = [...html.matchAll(/data-testid="([^"]*review[^"]*)"/gi)].map(m => m[1]);
console.log('Review-related data-testids (unique, first 20):', [...new Set(reviewDataAttrs)].slice(0, 20).join(', ') || 'NONE');

// Also check for any element that wraps a review and mentions a service
const hasServiceInReviewMarkup = /review[^>]*>[^<]*service|service[^>]*>[^<]*review/i.test(html);
console.log('Review markup contains service text proximity:', hasServiceInReviewMarkup);

console.log('\n=== DONE ===');

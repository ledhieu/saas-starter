// Second probe: deeper investigation of ReviewDetails fields and HTML markup
const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';
const LOCATION_SLUG = 'mood-nail-bar-vancouver-337-east-broadway-nch13fdn';
const LOCATION_ID = '2838529';

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

// ---------- 13. Try appointmentReviewId on ReviewDetails ----------
console.log('\n=== 13. Try appointmentReviewId on ReviewDetails ===');
const q13 = await gqlQuery({
  query: `
    query LocationReviewsBySlug($slug: String!, $first: Int!) {
      location(slug: $slug) {
        reviews(first: $first) {
          edges {
            node {
              id
              rating
              text
              appointmentReviewId
            }
          }
        }
      }
    }
  `,
  variables: { slug: LOCATION_SLUG, first: 3 }
});
console.log(JSON.stringify(q13, null, 2).slice(0, 1200));

// ---------- 14. Brute-force guess ReviewDetails fields ----------
console.log('\n=== 14. Brute-force guess ReviewDetails fields ===');
const candidateFields = [
  'service', 'serviceId', 'services', 'catalogItem', 'catalogItemId',
  'treatment', 'treatmentId', 'treatments',
  'appointment', 'appointmentId', 'appointments',
  'booking', 'bookingId', 'bookings',
  'product', 'productId', 'products',
  'category', 'categoryId', 'categories',
  'employee', 'employeeId', 'staff', 'staffId', 'professional', 'professionalId',
  'location', 'locationId', 'business', 'businessId',
  'date', 'createdAt', 'updatedAt', 'publishedAt',
  'author', 'customer', 'client', 'user', 'reviewer',
  'reply', 'response', 'replyText',
  'text', 'content', 'message', 'comment', 'body',
  'rating', 'score', 'stars',
  'media', 'images', 'photos', 'videos',
  'verified', 'isVerified', 'helpful', 'likes',
  'source', 'channel', 'platform',
  '__typename'
];

const q14 = await gqlQuery({
  query: `
    query GuessFields($slug: String!) {
      location(slug: $slug) {
        reviews(first: 1) {
          edges {
            node {
              ${candidateFields.map(f => f).join('\n              ')}
            }
          }
        }
      }
    }
  `,
  variables: { slug: LOCATION_SLUG }
});
if (q14.errors) {
  const found = q14.errors
    .filter(e => e.message.includes('Cannot query field'))
    .map(e => {
      const m = e.message.match(/Cannot query field "([^"]+)" on type "ReviewDetails"/);
      return m ? m[1] : null;
    }).filter(Boolean);
  const invalid = new Set(found);
  const valid = candidateFields.filter(f => !invalid.has(f));
  console.log('Candidate fields that DO exist on ReviewDetails:', valid.join(', ') || 'NONE from list');
  console.log('Total errors:', q14.errors.length);
} else if (q14.data) {
  console.log('All fields valid! Data:', JSON.stringify(q14.data, null, 2).slice(0, 800));
}

// ---------- 15. Check what arguments Location.reviews accepts ----------
console.log('\n=== 15. Probe Location.reviews arguments ===');
const argCandidates = ['first', 'after', 'last', 'before', 'sort', 'sortingType', 'orderBy', 'filter', 'rating', 'ratings', 'serviceId', 'serviceIds', 'treatmentId', 'catalogItemId', 'employeeId', 'staffId', 'dateFrom', 'dateTo', 'cursor', 'id', 'slug'];
const q15 = await gqlQuery({
  query: `
    query ProbeArgs($slug: String!) {
      location(slug: $slug) {
        reviews(${argCandidates.map(a => `${a}: null`).join(', ')}) {
          edges { node { id } }
        }
      }
    }
  `,
  variables: { slug: LOCATION_SLUG }
});
if (q15.errors) {
  const unknownArgs = q15.errors
    .filter(e => e.message.includes('Unknown argument'))
    .map(e => {
      const m = e.message.match(/Unknown argument "([^"]+)" on field "Location\.reviews"/);
      return m ? m[1] : null;
    }).filter(Boolean);
  const invalidArgs = new Set(unknownArgs);
  const validArgs = argCandidates.filter(a => !invalidArgs.has(a));
  console.log('Valid arguments for Location.reviews:', validArgs.join(', ') || 'NONE from list');
  console.log('Invalid args:', [...invalidArgs].join(', ') || 'NONE');
} else {
  console.log('No errors — all arguments valid? Unlikely.');
}

// ---------- 16. Inspect HTML review cards for service text ----------
console.log('\n=== 16. Inspect HTML review cards ===');
const htmlRes = await fetch(`https://www.fresha.com/a/${LOCATION_SLUG}`, {
  headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-CA' }
});
const html = await htmlRes.text();
// Find review card regions by looking for review text snippets we know exist
const knownReviewText = "Great! Alina was super fast and thorough removing my builder gel";
const idx = html.indexOf(knownReviewText.slice(0, 40));
console.log('Known review text found in HTML at index:', idx);
if (idx !== -1) {
  const snippet = html.slice(Math.max(0, idx - 300), idx + 300);
  console.log('Surrounding HTML snippet (600 chars):', snippet.replace(/\s+/g, ' '));
}

// Also check if there are any review blocks with structured data
const reviewBlockMatches = [...html.matchAll(/"review[^"]*":\s*\{/gi)];
console.log('JSON review blocks in HTML:', reviewBlockMatches.length);

// Check __NEXT_DATA__ specifically for review fields we might have missed
const startTag = '<script id="__NEXT_DATA__" type="application/json">';
const i = html.indexOf(startTag);
const j = html.indexOf('</script>', i + startTag.length);
const nextData = JSON.parse(html.slice(i + startTag.length, j));
const reviews = nextData.props?.pageProps?.data?.location?.reviews;
if (reviews) {
  console.log('__NEXT_DATA__ reviews top-level keys:', Object.keys(reviews).sort().join(', '));
  // Check edge node keys for first few
  for (let k = 0; k < Math.min(3, reviews.edges?.length ?? 0); k++) {
    console.log(`Edge[${k}] node keys:`, Object.keys(reviews.edges[k].node).sort().join(', '));
  }
}

// ---------- 17. Try review query directly by review ID ----------
console.log('\n=== 17. Try review(id) query ===');
const q17 = await gqlQuery({
  query: `
    query GetReview($id: ID!) {
      review(id: $id) {
        id
        rating
        text
        service { id name }
        appointmentReviewId
      }
    }
  `,
  variables: { id: '26910847' }
});
console.log(JSON.stringify(q17, null, 2).slice(0, 1200));

// ---------- 18. Try node(id) query for review ----------
console.log('\n=== 18. Try node(id) query ===');
const q18 = await gqlQuery({
  query: `
    query GetNode($id: ID!) {
      node(id: $id) {
        ... on ReviewDetails {
          id
          rating
          text
          service { id name }
          appointmentReviewId
        }
      }
    }
  `,
  variables: { id: '26910847' }
});
console.log(JSON.stringify(q18, null, 2).slice(0, 1200));

// ---------- 19. Try querying reviews from a different location to confirm pattern ----------
console.log('\n=== 19. Try Her Nails Lounge review query ===');
const q19 = await gqlQuery({
  query: `
    query HerNailsReviews($slug: String!) {
      location(slug: $slug) {
        reviews(first: 2) {
          edges {
            node {
              id
              rating
              text
              appointmentReviewId
              __typename
            }
          }
        }
      }
    }
  `,
  variables: { slug: 'her-nails-lounge-vancouver-1367-richards-st-vancouver-tuzu902h' }
});
console.log(JSON.stringify(q19, null, 2).slice(0, 1200));

// ---------- 20. Check if there are review tags or labels in the schema ----------
console.log('\n=== 20. Brute-force more niche fields ===');
const nicheFields = [
  'appointmentReviewId', 'reviewTags', 'tags', 'labels', 'categories',
  'serviceName', 'serviceNames', 'treatmentName', 'treatmentNames',
  'catalogName', 'catalogNames', 'menuItem', 'menuItemId',
  'offering', 'offeringId', 'offeringName',
  'item', 'itemId', 'itemName', 'items',
  'experience', 'experienceId', 'visit', 'visitId', 'session', 'sessionId',
  'consumable', 'consumableId', 'addon', 'addonId', 'addOn', 'addOnId',
  'variant', 'variantId', 'variantName', 'variants'
];
const q20 = await gqlQuery({
  query: `
    query NicheFields($slug: String!) {
      location(slug: $slug) {
        reviews(first: 1) {
          edges {
            node {
              id
              ${nicheFields.map(f => f).join('\n              ')}
            }
          }
        }
      }
    }
  `,
  variables: { slug: LOCATION_SLUG }
});
if (q20.errors) {
  const found = q20.errors
    .filter(e => e.message.includes('Cannot query field'))
    .map(e => {
      const m = e.message.match(/Cannot query field "([^"]+)" on type "ReviewDetails"/);
      return m ? m[1] : null;
    }).filter(Boolean);
  const invalid = new Set(found);
  const valid = nicheFields.filter(f => !invalid.has(f));
  console.log('Niche fields that DO exist on ReviewDetails:', valid.join(', ') || 'NONE from list');
  console.log('Invalid niche fields:', [...invalid].join(', '));
} else {
  console.log('Data:', JSON.stringify(q20, null, 2).slice(0, 800));
}

console.log('\n=== DONE ===');

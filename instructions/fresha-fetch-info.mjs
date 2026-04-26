// Fresha salon-info fetcher: title, address, contact, ratings, reviews (paginated).
// Usage:
//   node fresha-fetch-info.mjs <fresha-salon-url> [--reviews=all|N]
// Examples:
//   node fresha-fetch-info.mjs https://www.fresha.com/a/mood-nail-bar-vancouver-337-east-broadway-nch13fdn
//   node fresha-fetch-info.mjs https://www.fresha.com/a/mood-nail-bar-vancouver-337-east-broadway-nch13fdn --reviews=20
//   node fresha-fetch-info.mjs https://www.fresha.com/a/mood-nail-bar-vancouver-337-east-broadway-nch13fdn --reviews=all

const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';
const REVIEWS_QUERY_HASH = '95379a2f375f5cbb94f9fab8dae3a4b194c50074c106f28606684d41fef3a0a4';
const REVIEWS_PAGE_SIZE = 20;

function parseFreshaUrl(input) {
  const url = new URL(input);
  const m = url.pathname.match(/\/a\/([^/]+)/);
  if (!m) throw new Error('Could not extract salon slug from URL: ' + input);
  return { slug: m[1] };
}

async function fetchSalonPage(slug) {
  const html = await fetch(`https://www.fresha.com/a/${slug}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-CA' },
  }).then(r => r.text());
  const startTag = '<script id="__NEXT_DATA__" type="application/json">';
  const i = html.indexOf(startTag);
  const j = html.indexOf('</script>', i + startTag.length);
  const json = JSON.parse(html.slice(i + startTag.length, j));
  return json.props.pageProps.data.location;
}

async function fetchReviewsPage({ slug, cursor = '', limit = REVIEWS_PAGE_SIZE, sortingType = 'LATEST', ratings = [] }) {
  const variables = { id: cursor, reviews: limit, ratings, slug, sortingType };
  const url =
    ENDPOINT +
    '?extensions=' + encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: REVIEWS_QUERY_HASH } })) +
    '&variables=' + encodeURIComponent(JSON.stringify(variables));
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
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error('GraphQL errors: ' + JSON.stringify(json.errors));
  return json.data.location.reviews;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchAllReviews({ slug, max = Infinity, throttleMs = 1000, onPage = null }) {
  const all = [];
  let cursor = '';
  let total = 0;
  let breakdown = null;
  let pageNum = 0;
  while (all.length < max) {
    if (pageNum > 0 && throttleMs > 0) await sleep(throttleMs);
    const page = await fetchReviewsPage({ slug, cursor });
    pageNum++;
    if (!breakdown) {
      total = page.totalCount;
      breakdown = {
        '1': page.rating1Count, '2': page.rating2Count, '3': page.rating3Count,
        '4': page.rating4Count, '5': page.rating5Count,
      };
    }
    for (const e of page.edges) {
      if (all.length >= max) break;
      all.push(e.node);
    }
    if (onPage) onPage({ pageNum, fetched: all.length, total, hasNextPage: page.pageInfo.hasNextPage });
    if (!page.pageInfo.hasNextPage || page.edges.length === 0) break;
    cursor = page.edges.at(-1).cursor;
  }
  return { reviews: all, total, breakdown };
}

// --- main ---
const inputUrl = process.argv[2];
if (!inputUrl) {
  console.error('Usage: node fresha-fetch-info.mjs <fresha-salon-url> [--reviews=all|N]');
  process.exit(1);
}
const reviewsArg = (process.argv.find(a => a.startsWith('--reviews=')) || '--reviews=6').split('=')[1];
const wantReviews = reviewsArg === 'all' ? Infinity : parseInt(reviewsArg, 10) || 6;
const throttleArg = process.argv.find(a => a.startsWith('--throttle='));
const throttleMs = throttleArg ? parseInt(throttleArg.split('=')[1], 10) : 1000;

const { slug } = parseFreshaUrl(inputUrl);
const loc = await fetchSalonPage(slug);

console.log('=== Salon ===');
console.log('Name:           ', loc.name);
console.log('Slug:           ', loc.slug);
console.log('Phone:          ', loc.contactNumber);
console.log('Rating:         ', loc.rating, `(${loc.reviewsCount} reviews)`);
console.log('Address:        ', loc.address?.shortFormatted);
console.log('Street:         ', loc.address?.streetAddress);
console.log('City:           ', loc.address?.cityName);
console.log('Coords:         ', loc.address?.latitude + ', ' + loc.address?.longitude);
console.log('Maps URL:       ', loc.address?.mapsUrl);
console.log('Description:    ', (loc.description || '').slice(0, 160) + (loc.description?.length > 160 ? '…' : ''));

console.log('\n=== Reviews ===');
let reviews, total, breakdown;
if (wantReviews <= (loc.reviews?.edges?.length ?? 0)) {
  // Page already has enough — no API call needed.
  reviews = loc.reviews.edges.slice(0, wantReviews).map(e => e.node);
  total = loc.reviews.totalCount;
  breakdown = {
    '1': loc.reviews.rating1Count, '2': loc.reviews.rating2Count, '3': loc.reviews.rating3Count,
    '4': loc.reviews.rating4Count, '5': loc.reviews.rating5Count,
  };
} else {
  console.log(`(fetching paginated reviews, throttle=${throttleMs}ms between pages)`);
  ({ reviews, total, breakdown } = await fetchAllReviews({
    slug,
    max: wantReviews,
    throttleMs,
    onPage: ({ pageNum, fetched, total, hasNextPage }) =>
      console.log(`  page ${pageNum}: ${fetched}/${total === Infinity ? '?' : total} fetched${hasNextPage ? '' : ' (last page)'}`),
  }));
}

console.log(`Total: ${total}  |  ★1:${breakdown[1]}  ★2:${breakdown[2]}  ★3:${breakdown[3]}  ★4:${breakdown[4]}  ★5:${breakdown[5]}`);
console.log(`Showing ${reviews.length} review(s):\n`);
for (const r of reviews) {
  console.log(`★ ${r.rating}  by ${r.author?.name || 'anon'}  —  ${r.date?.formattedDateWithTime}`);
  console.log(`  "${(r.text || '').replace(/\s+/g, ' ').trim()}"`);
  if (r.reply) console.log(`  ↳ Reply: ${r.reply.text || JSON.stringify(r.reply)}`);
  console.log();
}

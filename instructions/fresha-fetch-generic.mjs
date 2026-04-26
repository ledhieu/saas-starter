// Generic Fresha menu fetcher.
// Usage: node fresha-fetch-generic.mjs <fresha-salon-url>
// Example:
//   node fresha-fetch-generic.mjs https://www.fresha.com/a/mood-nail-bar-vancouver-337-east-broadway-nch13fdn
//   node fresha-fetch-generic.mjs https://www.fresha.com/vi/a/her-nails-lounge-vancouver-1367-richards-st-vancouver-tuzu902h/booking?pId=778530

const ENDPOINT = 'https://www.fresha.com/graphql';
const PERSISTED_QUERY_HASH = '12ae5c77089f934aa88e3e1805176329eaed4d91b36f54df357c7c8f1638ac21';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

function parseFreshaUrl(input) {
  const url = new URL(input);
  // /a/<slug>  or  /<locale>/a/<slug>  optionally followed by /booking, /gift-cards, etc.
  const m = url.pathname.match(/\/a\/([^/]+)/);
  if (!m) throw new Error('Could not extract salon slug from URL: ' + input);
  return { slug: m[1], pIdFromUrl: url.searchParams.get('pId') };
}

async function discoverProviderId(slug) {
  const html = await fetch(`https://www.fresha.com/a/${slug}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  }).then(r => r.text());
  const candidates = [];
  // Business id ships paired with the /store/ slug ("loyaltyScheme" lives on the business object).
  const businessMatch = html.match(/"id":"(\d+)","slug":"([^"]+)","loyaltyScheme"/);
  if (businessMatch) candidates.push({ id: businessMatch[1], type: 'business', slug: businessMatch[2] });
  // Location id ships with the salon's display name + the long URL slug.
  const locationMatch = html.match(/"id":"(\d+)","name":"[^"]+","slug":"([^"]+)"/);
  if (locationMatch && (!businessMatch || locationMatch[1] !== businessMatch[1])) {
    candidates.push({ id: locationMatch[1], type: 'location', slug: locationMatch[2] });
  }
  return candidates;
}

async function fetchServices({ slug, providerId, locale = 'en-CA' }) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'Accept-Language': locale,
      'x-client-platform': 'web',
      'x-client-version': CLIENT_VERSION,
      'x-graphql-operation-name': 'mutation BookingFlow_Initialize_Mutation',
      'Origin': 'https://www.fresha.com',
      'Referer': 'https://www.fresha.com/',
    },
    body: JSON.stringify({
      variables: {
        portfolioEnabled: false,
        fullUpfrontPaymentEnabled: false,
        discountsAndBenefitsEnabled: false,
        input: {
          locationSlug: slug,
          referer: '',
          options: {
            isGroupBooking: false,
            isRebook: false,
            shouldShowAllEmployees: false,
            isFromLinkBuilder: true,
            clientChannelType: 'DIRECT',
            providerReferences: [String(providerId)],
          },
          shouldAutoContinue: false,
          capabilities: ['SERVICE_ADDONS', 'CONFIRMATION'],
        },
      },
      extensions: {
        persistedQuery: { version: 1, sha256Hash: PERSISTED_QUERY_HASH },
      },
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) {
    const err = new Error('GraphQL errors');
    err.payload = json.errors;
    throw err;
  }
  return json.data?.bookingFlowInitialize?.screenServices?.categories ?? null;
}

function parseActionId(actionId) {
  try {
    const [meta] = JSON.parse(actionId);
    return { catalogId: meta.catalogId, variants: (meta.serviceVariants || []).map(v => v.id) };
  } catch { return { catalogId: null, variants: [] }; }
}

const inputUrl = process.argv[2];
if (!inputUrl) {
  console.error('Usage: node fresha-fetch-generic.mjs <fresha-salon-url>');
  process.exit(1);
}

const { slug, pIdFromUrl } = parseFreshaUrl(inputUrl);
console.log(`Slug: ${slug}`);

const candidates = pIdFromUrl
  ? [{ id: pIdFromUrl, type: 'url-pId' }]
  : await discoverProviderId(slug);
console.log('Candidate provider IDs:', candidates);

let categories = null;
let usedId = null;
for (const c of candidates) {
  try {
    const result = await fetchServices({ slug, providerId: c.id });
    if (result && result.length) {
      categories = result;
      usedId = c;
      console.log(`\n→ Using providerReferences=[${c.id}] (${c.type})\n`);
      break;
    }
  } catch (err) {
    console.log(`✗ providerId ${c.id} (${c.type}) failed:`, err.payload || err.message);
  }
}

if (!categories) {
  console.error('Could not fetch services with any candidate provider id.');
  process.exit(1);
}

let totalServices = 0;
for (const cat of categories) {
  console.log(`=== ${cat.name} ===`);
  for (const item of cat.items) {
    totalServices++;
    const ids = parseActionId(item.primaryAction?.id || '[]');
    console.log(`  - ${item.name}`);
    console.log(`    duration: ${item.caption}`);
    console.log(`    price:    ${item.price?.formatted}`);
    console.log(`    catalog:  ${ids.catalogId}  variants: [${ids.variants.join(', ')}]`);
  }
  console.log();
}
console.log(`${categories.length} categories, ${totalServices} services (used pId=${usedId.id})`);

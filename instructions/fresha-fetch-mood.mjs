// Fetch all services from Fresha for Mood Nail Bar (Vancouver, 337 E Broadway).
// Run: node fresha-fetch-mood.mjs

const ENDPOINT = 'https://www.fresha.com/graphql';
const LOCATION_SLUG = 'mood-nail-bar-vancouver-337-east-broadway-nch13fdn';
const PERSISTED_QUERY_HASH = '12ae5c77089f934aa88e3e1805176329eaed4d91b36f54df357c7c8f1638ac21';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

// Auto-discover the providerReference ("pId") by scraping the salon page.
async function discoverProviderId(slug) {
  const html = await fetch(`https://www.fresha.com/a/${slug}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  }).then(r => r.text());

  // The salon page lists two ids: the parent business (matches /store/<slug>) and the location.
  // pId on Fresha booking URLs is the business id, not the location id.
  const locMatch = html.match(/"id":"(\d+)","name":"[^"]+","slug":"([^"]+)"/);
  const storeMatch = html.match(/"id":"(\d+)","slug":"([^"]+)","loyaltyScheme"/);
  const candidates = [];
  if (storeMatch) candidates.push({ id: storeMatch[1], type: 'business', slug: storeMatch[2] });
  if (locMatch)   candidates.push({ id: locMatch[1],   type: 'location', slug: locMatch[2] });
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

const candidates = await discoverProviderId(LOCATION_SLUG);
console.log('Candidate provider IDs from page:', candidates);

let categories = null;
let usedId = null;
for (const c of candidates) {
  try {
    const result = await fetchServices({ slug: LOCATION_SLUG, providerId: c.id });
    if (result && result.length) {
      categories = result;
      usedId = c;
      console.log(`\n→ Successful providerReferences: [${c.id}] (${c.type})\n`);
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

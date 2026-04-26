// Fetch all services from Fresha for Her Nails Lounge.
// Run: node fresha-fetch.mjs

const ENDPOINT = 'https://www.fresha.com/graphql';
const LOCATION_SLUG = 'her-nails-lounge-vancouver-1367-richards-st-vancouver-tuzu902h';
const PROVIDER_ID = '778530';
const PERSISTED_QUERY_HASH = '12ae5c77089f934aa88e3e1805176329eaed4d91b36f54df357c7c8f1638ac21';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

async function fetchServices({ locale = 'en-CA' } = {}) {
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
          locationSlug: LOCATION_SLUG,
          referer: '',
          options: {
            isGroupBooking: false,
            isRebook: false,
            shouldShowAllEmployees: false,
            isFromLinkBuilder: true,
            clientChannelType: 'DIRECT',
            providerReferences: [PROVIDER_ID],
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
  if (json.errors) throw new Error('GraphQL errors: ' + JSON.stringify(json.errors));

  const screen = json.data?.bookingFlowInitialize?.screenServices;
  if (!screen) throw new Error('No screenServices in response');
  return screen.categories;
}

function parseActionId(actionId) {
  try {
    const [meta] = JSON.parse(actionId);
    return {
      catalogId: meta.catalogId,
      variants: (meta.serviceVariants || []).map(v => v.id),
    };
  } catch {
    return { catalogId: null, variants: [] };
  }
}

const categories = await fetchServices({ locale: 'en-CA' });

let totalServices = 0;
for (const cat of categories) {
  console.log(`\n=== ${cat.name} ===`);
  for (const item of cat.items) {
    totalServices++;
    const ids = parseActionId(item.primaryAction?.id || '[]');
    console.log(`  - ${item.name}`);
    console.log(`    duration: ${item.caption}`);
    console.log(`    price:    ${item.price?.formatted}`);
    console.log(`    catalog:  ${ids.catalogId}  variants: [${ids.variants.join(', ')}]`);
  }
}
console.log(`\n${categories.length} categories, ${totalServices} services total`);

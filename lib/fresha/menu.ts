import {
  FRESHA_GRAPHQL_ENDPOINT,
  PERSISTED_QUERY_HASH,
  CLIENT_VERSION,
} from './config';

export interface FreshaServiceItem {
  name: string;
  caption?: string;
  price?: { formatted?: string };
  primaryAction?: { id?: string };
}

export interface FreshaCategory {
  name: string;
  items: FreshaServiceItem[];
}

export interface ProviderCandidate {
  id: string;
  type: string;
}

export function parseActionId(
  actionId: string
): { catalogId: string | null; variants: string[] } {
  try {
    const [meta] = JSON.parse(actionId) as [
      { catalogId?: string; serviceVariants?: { id: string }[] }
    ];
    return {
      catalogId: meta.catalogId ?? null,
      variants: (meta.serviceVariants || []).map((v) => v.id),
    };
  } catch {
    return { catalogId: null, variants: [] };
  }
}

export async function fetchServices(
  slug: string,
  providerId: string,
  locale = 'en-CA'
): Promise<FreshaCategory[] | null> {
  const res = await fetch(FRESHA_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: '*/*',
      'Accept-Language': locale,
      'x-client-platform': 'web',
      'x-client-version': CLIENT_VERSION,
      'x-graphql-operation-name': 'mutation BookingFlow_Initialize_Mutation',
      Origin: 'https://www.fresha.com',
      Referer: 'https://www.fresha.com/',
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
    const err = new Error('GraphQL errors') as Error & {
      payload: unknown;
    };
    err.payload = json.errors;
    throw err;
  }
  return (
    json.data?.bookingFlowInitialize?.screenServices?.categories ?? null
  );
}

export async function discoverProviderId(
  slug: string
): Promise<ProviderCandidate[]> {
  const html = await fetch(`https://www.fresha.com/a/${slug}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  }).then((r) => r.text());

  const candidates: ProviderCandidate[] = [];

  const businessMatch = html.match(
    /"id":"(\d+)","slug":"([^"]+)","loyaltyScheme"/
  );
  if (businessMatch)
    candidates.push({
      id: businessMatch[1],
      type: 'business',
    });

  const locationMatch = html.match(
    /"id":"(\d+)","name":"[^"]+","slug":"([^"]+)"/
  );
  if (
    locationMatch &&
    (!businessMatch || locationMatch[1] !== businessMatch[1])
  ) {
    candidates.push({ id: locationMatch[1], type: 'location' });
  }

  return candidates;
}

export async function fetchMenuForSlug(
  slug: string
): Promise<FreshaCategory[]> {
  const candidates = await discoverProviderId(slug);

  let categories: FreshaCategory[] | null = null;
  let lastError: Error | null = null;

  for (const c of candidates) {
    try {
      const result = await fetchServices(slug, c.id);
      if (result && result.length) {
        categories = result;
        break;
      }
    } catch (err) {
      lastError = err as Error;
    }
  }

  if (!categories) {
    throw lastError || new Error('Could not fetch services with any candidate provider id');
  }

  return categories;
}

export function extractPriceValues(
  formatted?: string
): { min: number | null; max: number | null } {
  if (!formatted) return { min: null, max: null };
  // Remove commas so "$1,250" → "$1250", then match decimal numbers
  const cleaned = formatted.replace(/,/g, '');
  const matches = cleaned.match(/\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return { min: null, max: null };
  const nums = matches.map((n) => parseFloat(n));
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

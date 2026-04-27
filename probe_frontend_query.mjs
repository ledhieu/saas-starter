// Test the actual frontend query structure discovered from HAR
const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

const headers = {
  'Content-Type': 'application/json',
  'Accept': '*/*',
  'Accept-Language': 'en-CA',
  'x-client-platform': 'web',
  'x-client-version': CLIENT_VERSION,
  'Origin': 'https://www.fresha.com',
  'Referer': 'https://www.fresha.com/',
};

async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  });
  return res.json();
}

// The actual variables from the frontend
const baseVars = {
  aspectRatio: 1,
  distance: 9457.267100865347,
  first: 10, // use 10 for testing, not 200
  freshaVerifiedOnly: false,
  from: { placeId: 'ChIJ56ju09ZzhlQRRxd6Vsh_qb8' },
  geocode: { latitude: -1.1009673528405983e-7, longitude: -134.3288159337111 },
  hasDeals: false,
  hasGroupAppointments: false,
  query: null,
  sort: 'RECOMMENDED',
};

const probes = [
  {
    name: 'Query.locations with from+geocode (frontend style)',
    query: `query Search(
      $aspectRatio: Int,
      $distance: Float,
      $first: Int,
      $freshaVerifiedOnly: Boolean,
      $from: LocationFromInput,
      $geocode: GeocodeInput,
      $hasDeals: Boolean,
      $hasGroupAppointments: Boolean,
      $query: String,
      $sort: String,
      $after: String
    ) {
      locations(
        aspectRatio: $aspectRatio,
        distance: $distance,
        first: $first,
        freshaVerifiedOnly: $freshaVerifiedOnly,
        from: $from,
        geocode: $geocode,
        hasDeals: $hasDeals,
        hasGroupAppointments: $hasGroupAppointments,
        query: $query,
        sort: $sort,
        after: $after
      ) {
        edges { node { id name slug } }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    variables: { ...baseVars },
  },
  {
    name: 'Query.searchLocations with from+geocode',
    query: `query Search(
      $first: Int,
      $from: LocationFromInput,
      $geocode: GeocodeInput,
      $distance: Float,
      $query: String,
      $sort: String,
      $after: String
    ) {
      searchLocations(
        first: $first,
        from: $from,
        geocode: $geocode,
        distance: $distance,
        query: $query,
        sort: $sort,
        after: $after
      ) {
        edges { node { id name slug } }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    variables: { ...baseVars },
  },
  {
    name: 'Query.geolocation -> locations with from+geocode',
    query: `query Search(
      $placeId: ID!,
      $first: Int,
      $distance: Float,
      $query: String,
      $sort: String,
      $after: String
    ) {
      geolocation(placeId: $placeId) {
        locations(
          first: $first,
          distance: $distance,
          query: $query,
          sort: $sort,
          after: $after
        ) {
          edges { node { id name slug } }
          pageInfo { hasNextPage endCursor }
        }
      }
    }`,
    variables: {
      placeId: 'ChIJ56ju09ZzhlQRRxd6Vsh_qb8',
      first: 10,
      distance: 9457.267100865347,
      query: null,
      sort: 'RECOMMENDED',
    },
  },
  {
    name: 'Query.locations without after (first page)',
    query: `query Search(
      $first: Int,
      $from: LocationFromInput,
      $geocode: GeocodeInput,
      $distance: Float,
      $query: String,
      $sort: String
    ) {
      locations(
        first: $first,
        from: $from,
        geocode: $geocode,
        distance: $distance,
        query: $query,
        sort: $sort
      ) {
        edges { node { id name slug } }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    variables: { ...baseVars },
  },
];

for (const probe of probes) {
  console.log(`\n=== ${probe.name} ===`);
  const data = await gql(probe.query, probe.variables);

  if (data.errors) {
    console.log('GraphQL errors:');
    for (const err of data.errors) {
      console.log('  -', err.message);
    }
  }

  const edges = data?.data?.locations?.edges
    || data?.data?.searchLocations?.edges
    || data?.data?.geolocation?.locations?.edges
    || [];

  if (edges.length > 0) {
    console.log(`SUCCESS — ${edges.length} results:`);
    for (const edge of edges.slice(0, 3)) {
      console.log(`  - ${edge.node.name} (${edge.node.slug})`);
    }
  } else if (!data.errors) {
    console.log('No results');
  }

  const pageInfo = data?.data?.locations?.pageInfo
    || data?.data?.searchLocations?.pageInfo
    || data?.data?.geolocation?.locations?.pageInfo;

  if (pageInfo) {
    console.log('PageInfo:', JSON.stringify(pageInfo));
  }
}

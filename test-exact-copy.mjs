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

const result = await searchLocations({ placeId: 'ChIJs0-pQ_FzhlQRi_OBm-qWkbs', query: 'nail salon', first: 3 });
console.log('Success:', result.edges.length, 'results');

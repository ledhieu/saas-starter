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

const lat = 49.2827;
const lng = -123.1207;

// Test root fields that might be related to search/location
const rootFields = [
  'geo',
  'location',
  'locations',
  'place',
  'places',
  'map',
  'maps',
  'nearby',
  'search',
  'find',
  'discover',
  'center',
  'coordinates',
  'position',
  'area',
  'region',
  'point',
  'address',
  'locale',
  'market',
  'venue',
  'spot',
  'site',
];

// Test arguments on geolocation
const geoArgs = [
  'id',
  'locationId',
  'geoId',
  'place_id',
  'placeId',
  'query',
  'search',
  'keyword',
  'term',
  'filter',
  'input',
  'criteria',
  'center',
  'coordinates',
  'lat',
  'lng',
  'latitude',
  'longitude',
  'location',
  'address',
  'q',
  's',
];

console.log('=== ROOT FIELD PROBE ===');
for (const field of rootFields) {
  const query = `query { ${field} { __typename } }`;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json();
    if (!json.errors) {
      const val = json.data[field];
      if (val?.__typename) {
        console.log(`ROOT.${field} → ${val.__typename}`);
      }
    }
  } catch {}
}

console.log('\n=== GEOLOCATION ARG PROBE ===');
for (const arg of geoArgs) {
  let argStr;
  if (['lat', 'latitude'].includes(arg)) argStr = `${arg}: ${lat}`;
  else if (['lng', 'longitude'].includes(arg)) argStr = `${arg}: ${lng}`;
  else argStr = `${arg}: "${lat},${lng}"`;

  const query = `query { geolocation(${argStr}) { __typename } }`;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json();
    if (!json.errors) {
      console.log(`geolocation(${argStr}) → OK`);
    } else {
      const msg = json.errors[0].message;
      if (!msg.includes('Cannot query field') && !msg.includes('Unknown argument')) {
        console.log(`geolocation(${argStr}) → ${msg.slice(0, 100)}`);
      }
    }
  } catch {}
}

console.log('\n=== LOCATIONS ROOT FIELD ARG PROBE ===');
const locationArgs = [
  'placeId',
  'center',
  'lat',
  'lng',
  'latitude',
  'longitude',
  'coordinates',
  'query',
  'search',
  'q',
  'distance',
  'radius',
  'first',
  'limit',
  'after',
  'ids',
];
for (const arg of locationArgs) {
  let argStr;
  if (['lat', 'latitude'].includes(arg)) argStr = `${arg}: ${lat}`;
  else if (['lng', 'longitude'].includes(arg)) argStr = `${arg}: ${lng}`;
  else if (arg === 'ids') argStr = `${arg}: ["test"]`;
  else if (['first', 'limit', 'distance', 'radius'].includes(arg)) argStr = `${arg}: 10000`;
  else argStr = `${arg}: "${lat},${lng}"`;

  const query = `query { locations(${argStr}) { __typename } }`;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json();
    if (!json.errors) {
      console.log(`locations(${argStr}) → OK, typename: ${json.data.locations?.__typename}`);
    } else {
      const msg = json.errors[0].message;
      if (!msg.includes('Cannot query field') && !msg.includes('Unknown argument')) {
        console.log(`locations(${argStr}) → ${msg.slice(0, 100)}`);
      }
    }
  } catch {}
}

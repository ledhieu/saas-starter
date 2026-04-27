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

// Focused root field candidates related to location/search
const rootFields = [
  'geo', 'geolocation', 'location', 'locations', 'place', 'places',
  'map', 'maps', 'nearby', 'search', 'find', 'discover', 'lookup',
  'center', 'coordinates', 'position', 'area', 'region', 'point',
  'address', 'locale', 'market', 'venue', 'spot', 'site',
  'businesses', 'categories', 'providers', 'services', 'professionals',
  'suggestions', 'autocomplete', 'recommendations', 'popular', 'trending',
  'results', 'items', 'list', 'directory', 'catalog', 'listings',
  'store', 'stores', 'shop', 'shops', 'salon', 'salons', 'studio', 'studios',
  'searchHistory', 'liteLocation', 'locationConnection',
];

// Focused argument candidates for geolocation
const geoArgs = [
  'id', 'locationId', 'geoId', 'place_id', 'placeId',
  'query', 'search', 'keyword', 'term', 'q',
  'center', 'coordinates', 'coords', 'lat', 'lng',
  'latitude', 'longitude', 'location', 'address',
  'input', 'filter', 'criteria', 'where',
];

// Focused argument candidates for locations (root)
const locArgs = [
  'placeId', 'center', 'lat', 'lng', 'latitude', 'longitude',
  'coordinates', 'query', 'search', 'q', 'distance', 'radius',
  'first', 'limit', 'after', 'ids', 'where', 'filter',
];

console.log('=== ROOT FIELD PROBE ===');
for (const field of rootFields) {
  const query = `query { ${field} { __typename } }`;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    if (!json.errors && json.data[field]?.__typename) {
      console.log(`ROOT.${field} → ${json.data[field].__typename}`);
    }
  } catch {}
}

console.log('\n=== GEOLOCATION ARG PROBE ===');
for (const arg of geoArgs) {
  let argStr;
  if (['lat', 'latitude'].includes(arg)) argStr = `${arg}: ${lat}`;
  else if (['lng', 'longitude'].includes(arg)) argStr = `${arg}: ${lng}`;
  else if (arg === 'ids') argStr = `${arg}: ["test"]`;
  else argStr = `${arg}: "${lat},${lng}"`;

  const query = `query { geolocation(${argStr}) { __typename } }`;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(8000),
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

console.log('\n=== LOCATIONS ROOT ARG PROBE ===');
for (const arg of locArgs) {
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
      signal: AbortSignal.timeout(8000),
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

console.log('\n=== LOCATIONS ROOT FIELD DEEP PROBE ===');
// locations returns LocationConnection. What fields does it have besides edges/pageInfo?
const locFields = [
  'edges', 'pageInfo', 'nodes', 'locations', 'items', 'results',
  'totalCount', 'count', 'total', 'hasMore',
];
for (const f of locFields) {
  const query = `query { locations(ids: ["test"]) { ${f} { __typename } } }`;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    if (!json.errors) {
      console.log(`locations(ids:)["test"]).${f} → OK`);
    } else {
      const msg = json.errors[0].message;
      if (!msg.includes('Cannot query field')) {
        console.log(`locations.${f} → ${msg.slice(0, 100)}`);
      }
    }
  } catch {}
}

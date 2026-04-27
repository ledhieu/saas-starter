const ENDPOINT = 'https://www.fresha.com/graphql';
const CLIENT_VERSION = '1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96';

const baseQuery = 'query { geolocation { search(query: "nail salon") { edges { node { ... on Location { %FIELDS% } } } } } } }';

const fieldSets = [
  { name: 'id only', fields: 'id' },
  { name: 'id name slug', fields: 'id name slug' },
  { name: '+ rating', fields: 'id name slug rating' },
  { name: '+ reviewsCount', fields: 'id name slug rating reviewsCount' },
  { name: '+ address shortFormatted', fields: 'id name slug rating reviewsCount address { shortFormatted }' },
  { name: '+ address cityName', fields: 'id name slug rating reviewsCount address { shortFormatted cityName }' },
  { name: '+ address latitude', fields: 'id name slug rating reviewsCount address { shortFormatted cityName latitude }' },
  { name: '+ address longitude', fields: 'id name slug rating reviewsCount address { shortFormatted cityName latitude longitude }' },
  { name: 'with placeId on geolocation', fields: 'id name slug', geolocationArgs: 'placeId: "ChIJs0-pQ_FzhlQRi_OBm-qWkbs"' },
  { name: 'with distance on search', fields: 'id name slug', searchArgs: 'distance: 30000' },
  { name: 'with center on search', fields: 'id name slug', searchArgs: 'center: "49.2827,-123.1207"' },
  { name: 'with lat on search', fields: 'id name slug', searchArgs: 'lat: 49.2827' },
  { name: 'with lat lng on search', fields: 'id name slug', searchArgs: 'lat: 49.2827, lng: -123.1207' },
];

for (const fs of fieldSets) {
  const geoArgs = fs.geolocationArgs ? `(${fs.geolocationArgs})` : '';
  const searchArgs = fs.searchArgs ? `, ${fs.searchArgs}` : '';
  const query = `query { geolocation${geoArgs} { search(query: "nail salon"${searchArgs}) { edges { node { ... on Location { ${fs.fields} } } } } } }`;
  
  console.log(`\n=== ${fs.name} ===`);
  try {
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
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15000),
    });

    const json = await res.json();
    
    if (json.errors) {
      const msgs = json.errors.map(e => e.message || JSON.stringify(e)).join(' | ');
      console.log('ERR:', msgs.slice(0, 300));
    } else if (json.data) {
      const edges = json.data.geolocation?.search?.edges || [];
      const locations = edges.filter(e => e.node?.id).map(e => e.node);
      console.log('OK:', locations.length, 'results');
    }
  } catch (e) {
    console.log('Fetch error:', e.message);
  }
}

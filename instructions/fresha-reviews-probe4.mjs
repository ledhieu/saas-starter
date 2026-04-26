// Check JSON-LD HealthAndBeautyBusiness block for reviews
const LOCATION_SLUG = 'mood-nail-bar-vancouver-337-east-broadway-nch13fdn';
const res = await fetch('https://www.fresha.com/a/' + LOCATION_SLUG, {
  headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-CA' }
});
const html = await res.text();
const ldScripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
for (let i = 0; i < ldScripts.length; i++) {
  try {
    const data = JSON.parse(ldScripts[i][1]);
    if (data['@type'] === 'HealthAndBeautyBusiness') {
      console.log('Block', i, 'keys:', Object.keys(data).join(', '));
      if (data.review) {
        console.log('Has review:', Array.isArray(data.review));
        if (Array.isArray(data.review) && data.review[0]) {
          console.log('First review:', JSON.stringify(data.review[0], null, 2));
        }
      } else {
        console.log('No review field');
      }
      console.log('AggregateRating:', JSON.stringify(data.aggregateRating));
    }
  } catch (e) {}
}

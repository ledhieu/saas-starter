// Fresha Search Fallback — Google Places API → Fresha slug validator
//
// Because Fresha does NOT expose a native location-based search API, this script
// discovers nearby salons using Google Places, then attempts to match each
// business to a Fresha profile page.
//
// Usage:
//   node fresha-search-fallback.mjs <lat> <lng> <radius_meters> <google_places_api_key> [keyword]
//
// Example:
//   node fresha-search-fallback.mjs 49.2827 -123.1207 2000 YOUR_API_KEY "nail salon"
//
// Output:
//   Prints a JSON array of candidate salons. Each item contains the Google Place
//   data plus a `freshaSlug` and `freshaUrl` when validation succeeds.
//
// Strategy:
//   1. Google Places Nearby Search (keyword + lat/lng + radius).
//   2. For each place:
//      a. If `website` contains fresha.com/a/<slug>, use it directly.
//      b. Guess likely slugs from name + city and HTTP-check fresha.com/a/<guess>.
//      c. Keep the first slug that returns HTTP 200 with valid __NEXT_DATA__.
//   3. Return structured results for downstream processing (menu fetch, etc.).

const GOOGLE_PLACES_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const FRESHA_BASE = 'https://www.fresha.com';
const SLEEP_MS = 800; // polite delay between Fresha probes

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function makeSlugGuesses(name, city, addressComponents = []) {
  const guesses = new Set();
  const base = slugify(name);

  // City from explicit argument or from address components
  const citySlug = slugify(city || '');
  const country = addressComponents.find((c) => c.types.includes('country'))?.short_name || '';
  const locality = addressComponents.find((c) => c.types.includes('locality'))?.long_name || '';
  const neighborhood = addressComponents.find((c) => c.types.includes('neighborhood'))?.long_name || '';
  const admin = addressComponents.find((c) => c.types.includes('administrative_area_level_1'))?.short_name || '';

  const locations = [citySlug, slugify(locality), slugify(neighborhood), slugify(admin)].filter(Boolean);

  // Pattern: name-city-randomid (most common Fresha format)
  // We can't guess the random suffix, so we try name-city and name-city-country
  for (const loc of locations) {
    guesses.add(`${base}-${loc}`);
    if (country) guesses.add(`${base}-${loc}-${country.toLowerCase()}`);
  }

  // Just name alone (some slugs are just the business name)
  guesses.add(base);

  return Array.from(guesses);
}

async function validateFreshaSlug(slug) {
  try {
    const res = await fetch(`${FRESHA_BASE}/a/${slug}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-CA',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Fresha salon pages contain __NEXT_DATA__ with location info
    if (html.includes('__NEXT_DATA__') && html.includes('"location"')) {
      // Extract the location name from __NEXT_DATA__ to confirm it's a real salon page
      const match = html.match(/"name":"([^"]+)","slug":"([^"]+)"/);
      if (match && match[2] === slug) {
        return { slug, name: match[1] };
      }
      // Even if strict match fails, the presence of location data is a good signal
      return { slug, name: null };
    }
    return null;
  } catch {
    return null;
  }
}

async function discoverViaGooglePlaces({ lat, lng, radius, apiKey, keyword = 'nail salon' }) {
  const url = new URL(GOOGLE_PLACES_URL);
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('keyword', keyword);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Google Places HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places API error: ${data.status} — ${data.error_message || ''}`);
  }
  return data.results || [];
}

async function findFreshaSlugForPlace(place) {
  // 1. Direct website match
  const website = place.website || '';
  const directMatch = website.match(/fresha\.com\/a\/([^/?#]+)/);
  if (directMatch) {
    const validated = await validateFreshaSlug(directMatch[1]);
    if (validated) return validated;
  }

  // 2. Guess slugs from name + city
  const city = place.vicinity?.split(',').pop()?.trim() || '';
  const guesses = makeSlugGuesses(place.name, city, place.address_components || []);

  for (const guess of guesses) {
    await sleep(SLEEP_MS);
    const validated = await validateFreshaSlug(guess);
    if (validated) return validated;
  }

  return null;
}

// --- main ---
const [latArg, lngArg, radiusArg, apiKey, keywordArg] = process.argv.slice(2);
const lat = parseFloat(latArg);
const lng = parseFloat(lngArg);
const radius = parseInt(radiusArg, 10);
const keyword = keywordArg || 'nail salon';

if (!lat || !lng || !radius || !apiKey) {
  console.error('Usage: node fresha-search-fallback.mjs <lat> <lng> <radius_meters> <google_places_api_key> [keyword]');
  console.error('Example: node fresha-search-fallback.mjs 49.2827 -123.1207 2000 YOUR_KEY "nail salon"');
  process.exit(1);
}

console.error(`Discovering "${keyword}" near ${lat},${lng} (radius=${radius}m) via Google Places...`);
const places = await discoverViaGooglePlaces({ lat, lng, radius, apiKey, keyword });
console.error(`Google Places returned ${places.length} result(s).`);

const results = [];
for (let i = 0; i < places.length; i++) {
  const place = places[i];
  console.error(`\n[${i + 1}/${places.length}] ${place.name} — ${place.vicinity}`);

  const fresha = await findFreshaSlugForPlace(place);
  const item = {
    googlePlaceId: place.place_id,
    name: place.name,
    address: place.vicinity,
    location: place.geometry?.location,
    rating: place.rating,
    userRatingsTotal: place.user_ratings_total,
    website: place.website || null,
    freshaSlug: fresha?.slug || null,
    freshaUrl: fresha?.slug ? `${FRESHA_BASE}/a/${fresha.slug}` : null,
    freshaName: fresha?.name || null,
  };

  if (fresha) {
    console.error(`  → Fresha match: ${item.freshaUrl}`);
  } else {
    console.error(`  → No Fresha match found.`);
  }
  results.push(item);
}

console.log(JSON.stringify(results, null, 2));

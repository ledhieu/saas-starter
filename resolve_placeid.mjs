#!/usr/bin/env node
// Resolve an address to a Google Place ID using Google Geocoding API.
// Usage: node resolve_placeid.mjs "Toronto, ON" YOUR_API_KEY
//    or: GOOGLE_PLACES_API_KEY=xxx node resolve_placeid.mjs "Toronto, ON"

const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

const address = process.argv[2];
const apiKey = process.argv[3] || process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY;

if (!address) {
  console.error('Usage: node resolve_placeid.mjs "<address>" [api_key]');
  console.error('   or: GOOGLE_PLACES_API_KEY=xxx node resolve_placeid.mjs "<address>"');
  process.exit(1);
}

if (!apiKey) {
  console.error('Error: No API key provided. Pass as 2nd arg or set GOOGLE_PLACES_API_KEY env var.');
  process.exit(1);
}

const url = new URL(GOOGLE_GEOCODE_URL);
url.searchParams.set('address', address);
url.searchParams.set('key', apiKey);

const res = await fetch(url);
const data = await res.json();

if (data.status !== 'OK') {
  console.error(`Google Geocoding error: ${data.status}${data.error_message ? ' — ' + data.error_message : ''}`);
  process.exit(1);
}

for (const result of data.results) {
  console.log('----------------------------------------');
  console.log('Place ID:    ', result.place_id);
  console.log('Formatted:   ', result.formatted_address);
  console.log('Types:       ', result.types?.join(', '));
  console.log('Location:    ', `${result.geometry?.location?.lat}, ${result.geometry?.location?.lng}`);
}

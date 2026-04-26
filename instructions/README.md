# Fresha booking-menu API

Reverse-engineered notes + scripts for fetching the full service menu of any Fresha salon, anonymously.

## TL;DR

```js
POST https://www.fresha.com/graphql
```

One GraphQL mutation (`BookingFlow_Initialize_Mutation`) returns every category and service for a given salon. No auth, no cookies, no CSRF token.

## Endpoint & headers

```
POST https://www.fresha.com/graphql
Content-Type: application/json
x-client-platform: web
x-client-version: 1c0c46102b5fe6112abdc9edf873bf7cb1ac8a96
Accept-Language: en-CA          # or vi, fr, etc. — affects formatted strings
```

`x-client-version` is the Next.js build hash. It's not strictly enforced today but ships with every real client request and is the safest thing to mimic.

## Request body

```json
{
  "variables": {
    "portfolioEnabled": false,
    "fullUpfrontPaymentEnabled": false,
    "discountsAndBenefitsEnabled": false,
    "input": {
      "locationSlug": "<slug>",
      "referer": "",
      "options": {
        "isGroupBooking": false,
        "isRebook": false,
        "shouldShowAllEmployees": false,
        "isFromLinkBuilder": true,
        "clientChannelType": "DIRECT",
        "providerReferences": ["<pId>"]
      },
      "shouldAutoContinue": false,
      "capabilities": ["SERVICE_ADDONS", "CONFIRMATION"]
    }
  },
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "12ae5c77089f934aa88e3e1805176329eaed4d91b36f54df357c7c8f1638ac21"
    }
  }
}
```

### Two values you have to fill in per salon

| field | what it is | where to find it |
| --- | --- | --- |
| `input.locationSlug` | the URL slug of the salon | last segment before `/booking` in the booking URL, e.g. `mood-nail-bar-vancouver-337-east-broadway-nch13fdn` |
| `input.options.providerReferences[0]` | "pId" — the **business** id (NOT the location id) | the `pId=` query param on a booking link, OR scrape it from the salon page (see below) |

### Discovering `pId` when it's not in the URL

Some salon profile URLs (e.g. `https://www.fresha.com/a/<slug>`) don't carry a `pId` param. In the salon page HTML there are two adjacent `id` fields:

```text
"id":"2838529","name":"Mood Nail Bar","slug":"mood-nail-bar-vancouver-337-east-broadway-nch13fdn"  ← location
"id":"2744640","slug":"mood-nail-bar-ik7zjmac","loyaltyScheme":null                                  ← business (matches /store/<slug>)
```

The **business** id (the one paired with the `/store/` slug) is what `providerReferences` expects. `fresha-fetch-generic.mjs` auto-discovers this and falls back to the location id if needed.

## The persisted-query hash

```
sha256Hash: 12ae5c77089f934aa88e3e1805176329eaed4d91b36f54df357c7c8f1638ac21
operation:  BookingFlow_Initialize_Mutation
```

Fresha's Apollo server uses [Automatic Persisted Queries](https://www.apollographql.com/docs/apollo-server/performance/apq/): the client only sends the SHA-256 of a registered operation, not the full query text. The server looks up the operation by hash and executes it.

**Hashes can rotate.** If you suddenly get:

```json
{ "errors": [{ "extensions": { "code": "PERSISTED_QUERY_NOT_FOUND" } }] }
```

…it means Fresha redeployed with a new operation. To refresh:

1. Open any Fresha booking page in Chrome DevTools
2. Filter Network → `graphql`
3. Find the POST with header `x-graphql-operation-name: mutation BookingFlow_Initialize_Mutation`
4. Copy the new `sha256Hash` from the request body and the matching `x-client-version` header

You can't easily recover the full query string — introspection is disabled (`{ __schema }` returns `GRAPHQL_VALIDATION_FAILED`). The query is reachable only by reverse-engineering the JS chunks.

## Response shape

```text
data.bookingFlowInitialize.screenServices.categories[]
  .name              # "Manicure", "Pedicure", …
  .description       # category description (often null)
  .items[]
    .name            # service name
    .caption         # duration string, e.g. "50 mins - 1 hr"
    .description     # full description
    .price.formatted # "from $38" / "từ 38 CA$"
    .primaryAction.id # JSON string with catalogId + serviceVariants
```

Service IDs you'd need to actually book live inside `primaryAction.id`, which is itself a JSON-encoded string:

```json
"[{"type":"onScreenServicesModalServiceOpen",
   "catalogId":"s:10066275",
   "serviceVariants":[{"id":"sv:11709532","requiresPatchTest":false}], …},
 "828387"]"
```

So a service is identified by `catalogId` (`s:NNN`) and one or more `serviceVariant` ids (`sv:NNN`).

The mutation also returns `cart`, `breadcrumbs`, layout chrome, etc. — ignore everything except `screenServices.categories` if you only want the menu.

## Caveats

- **It's a mutation, not a query.** Each call initializes a fresh `cartId` server-side. Don't loop. Cache responses.
- **No auth required** — confirmed working with no cookies. But Fresha could rate-limit or fingerprint at any time.
- **Hash + build version drift** — see refresh procedure above.
- **Unofficial.** Fresha doesn't publish this API. Treat it as fragile; for any production use, cache aggressively and have a fallback plan.
- **Localization in the response.** `Accept-Language` controls breadcrumb labels and price format. The category/service *names and descriptions* come from the merchant and aren't translated.

## Salon info: title, address, phone, rating, reviews

The salon profile page (`https://www.fresha.com/a/<slug>`) ships its data as SSR JSON — `__NEXT_DATA__.props.pageProps.data.location` contains:

| field | example |
| --- | --- |
| `name` | `"Mood Nail Bar"` |
| `slug` | `"mood-nail-bar-vancouver-337-east-broadway-nch13fdn"` |
| `description` | full salon description |
| `contactNumber` | `"+1 604-677-0059"` |
| `rating`, `reviewsCount` | `4.9`, `78` |
| `address.shortFormatted` | `"337 East Broadway, East Vancouver, Vancouver, British Columbia"` |
| `address.streetAddress`, `cityName`, `latitude`, `longitude`, `mapsUrl`, `directionsUrl` | precise components |
| `reviews.totalCount`, `rating1Count..rating5Count` | star-breakdown |
| `reviews.edges[].node` | first 6 reviews, each with `text`, `rating`, `author.name`, `date.formattedDateWithTime`, `reply` |

So title/address/phone/rating + the 6 most recent reviews need **zero** API calls — just parse `__NEXT_DATA__`.

### Paginated reviews (`Location_ReviewsModal_Query`)

For all reviews beyond the first 6, call:

```
GET https://www.fresha.com/graphql
  ?extensions={"persistedQuery":{"version":1,"sha256Hash":"95379a2f375f5cbb94f9fab8dae3a4b194c50074c106f28606684d41fef3a0a4"}}
  &variables={"id":"<cursor>","reviews":20,"ratings":[],"slug":"<salon-slug>","sortingType":"LATEST"}
```

| variable | meaning |
| --- | --- |
| `id` | cursor — empty string for first page; for subsequent pages, pass `edges[edges.length-1].cursor` from the previous response |
| `reviews` | page size (max appears to be ~20) |
| `ratings` | filter by stars, e.g. `[5]` for only 5-star — empty array = all |
| `slug` | salon slug |
| `sortingType` | `"LATEST"` (others not yet probed; likely `"OLDEST"` / `"HIGHEST_RATING"`) |

Required headers: `x-client-platform: web`, `x-client-version: <build hash>`. Same caveats as the menu hash — Fresha can rotate it on redeploy.

The response carries `pageInfo.hasNextPage` but no `endCursor` — paginate by reading the last edge's `cursor` field.

## Location Search API

### UPDATE — Native GraphQL search discovered 🎉

**Status: Fresha DOES expose a native search GraphQL query.** It was hidden in plain sight — not as a persisted-query mutation, but as a raw query field on the `Geolocation` type.

### How it works

```graphql
POST https://www.fresha.com/graphql
Content-Type: application/json
x-client-platform: web
x-client-version: <build hash>
```

**Query:**
```graphql
query {
  geolocation(placeId: "<google_place_id>") {
    locations(query: "nail salon", first: 50, after: "<cursor>") {
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
```

### Critical findings

1. **Raw queries work** — Fresha's GraphQL server accepts full query text, not just persisted-query hashes. This means we can construct and send search queries directly without needing the SHA-256 hash.
2. **`placeId` sets the search center** — Pass a valid **Google Place ID** (e.g., `ChIJs0-pQ_FzhlQRi_OBm-qWkbs` for Vancouver) to override IP-based geolocation.
3. **`query` filters by keyword** — e.g., `"nail salon"`, `"hair salon"`, `"barber"`.
4. **`first` controls page size** — Tested up to 150; all values work.
5. **`after` paginates** — Pass `pageInfo.endCursor` from the previous page.
6. **DO NOT use `distance`** — The `distance` argument **breaks** location filtering and causes global results. Without it, Fresha automatically scopes results to the `placeId` area.
7. **Results are rich** — Each node includes `id`, `name`, `slug`, `rating`, `reviewsCount`, `contactNumber`, `description`, and `address`.
8. **No `pId` in results** — You still need to scrape the salon page (`/a/<slug>`) to get the business `pId` for menu fetching.

### How to get a Google Place ID

Use the **Google Geocoding API** (you already need this for lat/lng anyway):

```
GET https://maps.googleapis.com/maps/api/geocode/json?address=<address>&key=<key>
```

The response includes `results[0].place_id` — pass this directly to Fresha's `geolocation(placeId: ...)`.

### Pipeline (new recommended flow)

1. User enters address.
2. Geocode address via Google Geocoding API → get `lat`, `lng`, **and** `place_id`.
3. Query Fresha GraphQL `geolocation(placeId: ...).locations(query: ..., first: ...)`.
4. Paginate through results.
5. For each result, fetch salon page to get `pId`.
6. Fetch menu + reviews via existing `fresha-fetch-*.mjs` scripts.

### Fallback (if GraphQL search fails)

`fresha-search-fallback.mjs` (Google Places → slug matcher) is still available as a backup. `fresha-search-graphql.mjs` demonstrates the native search.

### Historical context

Earlier research attempted to find persisted-query hashes for search operations inside obfuscated JS bundles and via common operation-name guessing. All of those approaches failed because Fresha's search is implemented as a **raw query** on the `Geolocation` type, not as a standalone persisted query.

## Files in this folder

| file | purpose |
| --- | --- |
| `fresha-fetch-generic.mjs` | Generic menu fetcher — pass any salon URL, prints categories + services |
| `fresha-fetch-info.mjs` | Salon info fetcher — title, address, phone, rating, reviews (paginated, `--reviews=N` or `--reviews=all`) |
| `fresha-fetch-her-nails.mjs` | Hardcoded menu fetch for Her Nails Lounge |
| `fresha-fetch-mood.mjs` | Hardcoded menu fetch for Mood Nail Bar |
| `fresha-search-graphql.mjs` | **Native Fresha search** — uses `geolocation.locations` GraphQL query (recommended) |
| `fresha-search-fallback.mjs` | Google Places → Fresha slug discovery (fallback) |
| `her-nails-lounge-services.txt` | Captured menu sample |

Run any with `node <file>.mjs <args>`.

# Implementation Plan — Parallel Workstreams

## Context
- Fresha `Search_Venues_Query` pagination now works with `geocode` + `distance` + `after` cursor.
- Radius dropdown exists in UI (`radiusOptions = [1,3,5,10,25]`) but is NOT wired to `distance` in the API (API hardcodes `Math.max(radiusKm, 30)`).
- Map uses `@react-google-maps/api`. Need to switch to Mapbox.
- No session persistence for searches exists yet.
- Need to populate nail salons in 4 cities as a background job.

---

## Workstream A: Radius Dropdown + Distance + Fetch-More Pagination
**Files:** `app/(dashboard)/dashboard/pricing/page.tsx`, `app/api/search/route.ts`, `lib/fresha/discover.ts`

1. Expand `radiusOptions` to `[1, 3, 5, 10, 25, 50, 100]`
2. Pass selected `radiusKm` as `distance` to `/api/search` (currently hardcoded to `Math.max(radiusKm, 30)`)
3. Update `/api/search` to use the user's selected radius (capped at 100km)
4. Return `pageInfo` (`hasNextPage`, `endCursor`) from the search API
5. Add "Fetch More" button in the pricing page that calls `/api/search` with the cursor and appends results
6. Keep `geocode` + `distance` identical across pagination requests

---

## Workstream B: Google Maps → Mapbox Migration
**Files:** `components/pricing/competitor-map.tsx`, `components/pricing/address-autocomplete.tsx`, `package.json`

1. Install `mapbox-gl` and `react-map-gl` (or use raw `mapbox-gl`)
2. Replace `competitor-map.tsx`:
   - Remove `@react-google-maps/api`
   - Use Mapbox GL JS with style `mapbox://styles/ldhieu/cmog94ecj001u01sqcybj4anq`
   - Use `MAPBOX_PUBLIC_API_KEY` from `.env`
   - Keep circles for threat radius, center marker, radius boundary
   - Keep InfoWindow behavior
3. Replace `address-autocomplete.tsx`:
   - Remove Google Places Autocomplete
   - Use Mapbox Geocoding API for address autocomplete
   - Return `{ address, placeId, lat, lng }` on select
4. Remove `@react-google-maps/api` and `@deck.gl/google-maps` from dependencies

---

## Workstream C: Session Persistence (Search Sessions per User)
**Files:** `lib/db/schema.ts`, migrations, new API routes

1. Add `search_sessions` table:
   - `id`, `userId`, `address`, `radiusKm`, `businessType`, `lat`, `lng`, `cursor`, `createdAt`
2. Add `search_session_results` table (join table linking sessions to competitors found):
   - `id`, `sessionId`, `competitorId`, `distanceKm`, `createdAt`
3. Create `POST /api/search/sessions` — save a search session
4. Create `GET /api/search/sessions` — list user's previous sessions
5. Create `GET /api/search/sessions/[id]` — retrieve a session with its competitors
6. Update `POST /api/search` to optionally save the session (query param `?save=true`)

---

## Workstream D: MCP vs Built-in AI Architecture
**Output:** `docs/ai-architecture.md`

1. Compare two approaches for AI analytics:
   - **MCP (Model Context Protocol):** External AI agent connects via MCP server to read DB/API. Pros: any model, no app bloat, standardized. Cons: extra infra, latency, security surface.
   - **Built-in AI:** OpenAI/Anthropic SDK inside Next.js API routes. Pros: low latency, full control, native UI integration. Cons: vendor lock-in, token costs, app complexity.
2. Recommend hybrid: built-in AI for common queries ("compare my prices"), MCP for deep analytics by power users.
3. Cost estimates and security considerations.

---

## Workstream E: Background Population Script
**New file:** `scripts/populate-cities.ts` (or `lib/fresha/populate.ts`)

1. For each city (Vancouver, Toronto, Ho Chi Minh City, Hanoi):
   - Geocode city to get lat/lng
   - Call `fetchAllFreshaLocations({ lat, lng, query: 'nail salon', distance: 10000 })`
   - Insert competitors into DB (skip duplicates by slug)
   - Fetch menus via `fetchMenuForSlug` with 500ms throttle
2. Run as a one-off Node script via `npx tsx`
3. Log progress per city

---

## Workstream F: Walk-in Customer Flow Probability Model
**Output:** `docs/customer-flow-model.md`

1. Research spatial interaction models (Huff Model, Reilly's Law of Retail Gravitation) for predicting walk-in probability
2. Define variables:
   - **Attractiveness:** rating, reviewsCount, price competitiveness, photos, deals
   - **Distance decay:** walking distance vs driving distance (different decay functions)
   - **Competition density:** number of alternatives within radius
   - **Time-based factors:** day of week, hour, seasonality
3. Propose a probability formula: `P(visit) = f(attractiveness) * g(distance) * h(competition)`
4. Suggest how to calibrate with real data (booking conversion rates from Fresha if available, foot traffic data)
5. Propose UI visualization: heatmap overlay showing "expected customer capture" per competitor

---

## Parallelization & Conflict Avoidance
- **A + B can run in parallel** — A touches the pricing page logic/API, B touches map/autocomplete components. They only intersect at the pricing page imports, which are additive.
- **C can run in parallel** — C touches DB schema/migrations only. No overlap with A or B.
- **D + F are research-only** — zero code conflicts.
- **E uses the updated `lib/fresha/discover.ts`** — depends on A's backend changes, but can be drafted in parallel and tested after A merges.

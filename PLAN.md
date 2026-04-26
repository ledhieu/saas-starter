# Competitive Pricing Dashboard — Full Rewrite Plan

## Problem Statement
The current search flow is synchronous and monolithic: one API call geocodes, discovers, scrapes info+menus for every competitor, and saves to DB before returning. With 20–50 competitors this issues 100+ sequential HTTP requests and can hang forever. The UI spinner never clears because neither client nor server has timeouts.

## Target Architecture

### Phase 1 — Fast Search (return competitors in < 3s)
`POST /api/search` does only:
1. Geocode address → lat, lng
2. Discover competitors via Fresha GraphQL (capped at 50, single page)
3. Upsert competitor **basic info only** (name, slug, address, lat/lng, rating, reviewsCount)
4. Return competitors immediately

### Phase 2 — Background Menu Fetching
Client calls `POST /api/competitors/bulk-services` with `{ competitorIds: number[] }`:
1. For each competitor ID, check DB `services` table for cached services (stale threshold: 24h)
2. For cache misses, queue Fresha menu fetch with 500ms throttle between requests
3. Save fetched menus to DB
4. Return all services for requested competitors

### Phase 3 — Map Visualization
- Google Map centered on search location with a pin
- Each competitor shown as a circle marker:
  - **Radius** ∝ `sqrt(reviewsCount)` (scaled for visibility)
  - **Color**: red (< 3.0), yellow (3.0–4.0), green (> 4.0)
  - Click opens InfoWindow with name, rating, review count
- Markers update as Phase 2 data arrives

### Phase 4 — User Menu Import + Percentile Charts
- New table `user_menu_items`: id, userId, name, price, duration, createdAt
- User can add/import menu items
- For each user menu item, compute percentile among matched competitor services
- **Semantic matching**: use `string-similarity` or `wink-nlp` for fuzzy matching of service names (e.g., "Classic Manicure" ≈ "Manicure — Classic")
- Chart.js distribution chart showing where user's price sits vs competitors

### Phase 5 — Research (parallel)
Investigate whether Fresha API associates individual reviews with specific services.

---

## Work Streams

### Stream A — Fix Search API + Client Timeouts (Critical Path)
**Owner:** Subagent A
**Files:**
- `app/api/search/route.ts` — rewrite to return fast, fetch only basic competitor info
- `lib/fresha/discover.ts` — add `fetch` timeouts (10s) to all external calls
- `app/(dashboard)/dashboard/pricing/page.tsx` — add AbortController + 30s timeout to fetch

**Acceptance:**
- Search completes and returns competitors in < 3s
- Client loading state clears even if server errors
- Server never hangs > 30s

**Interface:**
- `POST /api/search` returns `{ competitors: Competitor[], centerLat: number, centerLng: number }`
- Competitor object: `{ id, name, slug, address, city, latitude, longitude, rating, reviewsCount, fetchedAt }`

---

### Stream B — Bulk Services API + DB Cache Layer
**Owner:** Subagent B
**Files:**
- `app/api/competitors/bulk-services/route.ts` — new route
- `lib/db/schema.ts` — may need index on `services.competitorId + fetchedAt`

**Logic:**
```
POST /api/competitors/bulk-services
Body: { competitorIds: number[], forceRefresh?: boolean }

For each competitorId:
  1. If !forceRefresh, select services where competitorId = ? AND fetchedAt > staleThreshold
  2. If results found, use cached
  3. Else:
     a. Fetch slug from competitors table
     b. Call fetchMenuForSlug(slug) — with 500ms sleep between calls
     c. Save to DB (delete old, insert new)
     d. Return services

Return: { [competitorId]: Service[] }
```

**Acceptance:**
- Fetches menus for 10 competitors in < 10s (with throttle)
- Respects 500ms delay between Fresha API calls
- Uses DB cache on subsequent calls (instant)

---

### Stream C — Google Map Visualization
**Owner:** Subagent C
**Files:**
- `app/(dashboard)/dashboard/pricing/page.tsx` — add Map component
- `components/pricing/map.tsx` — new component
- `app/(dashboard)/dashboard/pricing/competitor-marker.tsx` — new component

**Requirements:**
- `@react-google-maps/api` is already installed
- Map centered on `centerLat/centerLng` from search response
- Pinned location marker (different icon/color from competitors)
- Competitor circles:
  ```tsx
  radius = Math.sqrt(reviewsCount || 1) * 15  // tune for visibility
  color = rating > 4 ? '#22c55e' : rating >= 3 ? '#eab308' : '#ef4444'
  ```
- InfoWindow on click showing name, rating stars, review count, address
- Update markers when bulk-services data arrives

**Acceptance:**
- Map renders immediately when search returns
- All competitors visible as colored circles
- InfoWindow works on click

---

### Stream D — User Menu Import + Semantic Matching + Percentile Charts
**Owner:** Subagent D
**Files:**
- `lib/db/schema.ts` — add `user_menu_items` table
- `app/api/user-menu/route.ts` — CRUD for user menu
- `app/api/user-menu/match/route.ts` — semantic matching endpoint
- `app/(dashboard)/dashboard/pricing/menu-import.tsx` — UI component
- `app/(dashboard)/dashboard/pricing/percentile-chart.tsx` — chart component

**Semantic Matching (lightweight):**
Use `string-similarity` npm package (Jaro-Winkler) or simple token overlap:
```ts
function similarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const tokensA = new Set(normalize(a));
  const tokensB = new Set(normalize(b));
  const intersection = [...tokensA].filter(x => tokensB.has(x)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union; // Jaccard
}
```
Match user menu item to competitor service if similarity > 0.3.

**Percentile Chart:**
For matched services, collect all prices, then:
```ts
const prices = matchedServices.map(s => s.priceValueMin).filter(Boolean).sort((a, b) => a - b);
const percentile = prices.filter(p => p < userPrice).length / prices.length * 100;
```
Chart.js histogram with vertical line for user's price.

**Acceptance:**
- User can add menu items
- Each item shows matched competitor services count
- Distribution chart renders with percentile label

---

### Stream E — Research Fresha Review-Service Association
**Owner:** Subagent E
**Research scope:**
1. Probe Fresha GraphQL for review queries. Look for fields like:
   - `location.reviews` — do review nodes have `service` or `appointmentService` fields?
   - `Review` type — any `service` or `serviceId` field?
2. Check Fresha public salon pages HTML — is service info embedded in review markup?
3. Check if reviews GraphQL endpoint supports filtering by service

**Deliverable:**
- Report in `instructions/fresha-reviews-research.md`
- Sample GraphQL queries if any exist
- Conclusion: yes/no/partial with evidence

---

## Execution Order

1. **First, run Stream A + Stream E in parallel** (A is critical, E is independent research)
2. **Then run Stream B + Stream C in parallel** (both depend on A's interface)
3. **Finally run Stream D** (depends on B's bulk-services endpoint)

## Shared Interfaces

```ts
// Competitor (returned by /api/search)
interface Competitor {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  latitude: string | null;
  longitude: string | null;
  rating: string | null;
  reviewsCount: number | null;
  fetchedAt: Date | null;
}

// Service (from bulk-services)
interface Service {
  id: number;
  competitorId: number;
  categoryName: string | null;
  name: string;
  durationCaption: string | null;
  priceFormatted: string | null;
  priceValueMin: number | null;
  priceValueMax: number | null;
  catalogId: string | null;
  fetchedAt: Date;
}

// User Menu Item
interface UserMenuItem {
  id: number;
  userId: number;
  name: string;
  price: number;
  duration: number | null; // minutes
  createdAt: Date;
}
```

## Database Migrations Needed

```sql
-- Add user_menu_items table
CREATE TABLE user_menu_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  duration INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster service cache lookups
CREATE INDEX idx_services_competitor_fetched ON services(competitor_id, fetched_at);
```

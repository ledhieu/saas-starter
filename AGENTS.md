# Agent Instructions

## CRITICAL: Fresha API Rate Limits & Stealth

**NEVER** implement any feature that bulk-fetches Fresha's API endpoints quickly or repeatedly. This includes:

- ❌ Viewport-based fetching (fetching new data as the user pans/zooms a map)
- ❌ Auto-refreshing stale data on a timer
- ❌ Parallel/concurrent requests to Fresha GraphQL or HTML endpoints
- ❌ Polling Fresha endpoints in the background
- ❌ Real-time streaming of competitor data

**Current safeguards in place:**
- `SLEEP_MS = 200` between slug validation requests (was 800ms)
- `500ms` throttle between `fetchMenuForSlug` calls in bulk-services endpoint
- All external fetches have 10–15s timeouts
- Cache-first: DB cache with 7-day stale threshold (FYI badge only, no auto-refresh)
- Max 50 results per search (single page, pagination cursors are broken)

**Philosophy:** Treat Fresha's API as a fragile, unauthenticated endpoint. Cache aggressively, fetch sparingly, and always give the user control over when to refresh.

## Architecture Patterns

### Search Flow (Two-Phase)
1. **Phase 1 — Fast Search:** `POST /api/search` returns basic competitor info only (< 3s). Uses Fresha GraphQL primary + Google Places fallback.
2. **Phase 2 — Background Menus:** `POST /api/competitors/bulk-services` fetches menus with 500ms throttle between calls. DB cache-first.

### Fresha GraphQL Gotchas
- `geolocation.locations` ignores the `placeId` for result ordering — returns city-wide results sorted by popularity
- `distance` parameter breaks location filtering (causes `INTERNAL_SERVER_ERROR` or global results)
- `endCursor` pagination is broken — page 2+ crashes with `INTERNAL_SERVER_ERROR`
- `placeId` accepts Google Place IDs OR `"lat,lng"` strings (e.g. `"49.2827,-123.1207"`)
- Raw queries work without persisted-query hashes

### Database Schema
- `competitors` — basic salon info (name, slug, address, rating, reviewsCount)
- `services` — menu items per competitor (name, price, duration, category)
- `search_lookups` — audit log of searches
- `user_menu_items` — user's own menu for percentile comparison

## Tech Stack
- Next.js 15 + React 19 + TypeScript + Tailwind 4
- PostgreSQL + Drizzle ORM
- Chart.js + react-chartjs-2
- @react-google-maps/api

## Build & Dev
- `pnpm dev` — dev server (Turbopack)
- `pnpm db:migrate` — apply pending migrations
- `npx tsc --noEmit` — type check

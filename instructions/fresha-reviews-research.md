# Fresha Review-Service Association Research

**Date:** 2026-04-25
**Tester salon:** Mood Nail Bar, Vancouver (slug: `mood-nail-bar-vancouver-337-east-broadway-nch13fdn`, locationId: `2838529`)
**Also verified against:** Her Nails Lounge, Vancouver

---

## 1. Methods Tried

### GraphQL Queries (≥ 10 distinct attempts)

| # | Approach | Query / Operation | Result |
|---|----------|-------------------|--------|
| 1 | **Introspection — `Review` type** | `__type(name: "Review") { fields { name } }` | ❌ Introspection disabled |
| 2 | **Introspection — `Location` type** | `__type(name: "Location") { fields { name } }` | ❌ Introspection disabled |
| 3 | **Custom `location(id).reviews` with service fields** | Requested `service { id name }`, `serviceId`, `appointmentService`, `treatment`, `booking { services }` | ❌ Review type is `ReviewDetails`; none of these fields exist |
| 4 | **Custom `location(slug).reviews` with expanded fields** | Requested `service`, `serviceId`, `catalogItem`, `appointment` | ❌ All rejected by schema validator |
| 5 | **`publicReviews` root query** | `publicReviews(locationId, first)` | ❌ Query does not exist |
| 6 | **`locationReviews` root query** | `locationReviews(locationId, first)` | ❌ Query does not exist |
| 7 | **Persisted query — `Location_ReviewsModal_Query`** | Fresha’s own frontend hash `95379a2f…` | ✅ Works; returns only `author`, `date`, `id`, `rating`, `reply`, `text` |
| 8 | **Reviews with `serviceId` filter** | `location.reviews(first: 3, serviceId: "…")` | ❌ `serviceId` is an unknown argument on `Location.reviews` |
| 9 | **`review(id)` root query** | `review(id: "26910847")` | ❌ Query does not exist |
| 10 | **`node(id)` Relay-style query** | `node(id: "…") { ... on ReviewDetails { … } }` | ❌ Query does not exist |
| 11 | **Brute-force field guessing (59 candidates)** | `date`, `author`, `reply`, `text`, `rating`, `service`, `serviceId`, `treatment`, `catalogItem`, `booking`, `serviceName`, `menuItem`, `offering`, `item`, `experience`, `visit`, `session`, `variant`, `reviewTags`, `tags`, `labels`, etc. | ✅ **Confirmed valid fields:** `id`, `rating`, `text`, `date`, `author`, `reply`, `appointmentReviewId`, `__typename`. All others rejected. |
| 12 | **Argument probing (18 candidates)** | Tested `first`, `after`, `last`, `before`, `sort`, `orderBy`, `filter`, `rating`, `ratings`, `serviceId`, `serviceIds`, `treatmentId`, `catalogItemId`, `employeeId`, `dateFrom`, `dateTo`, `cursor`, `id`, `slug` | ✅ **Valid args:** `first`, `after`, `sortingType`, `ratings`. No service filter exists. |
| 13 | **Introspection — `ReviewsConnection` / `ReviewsEdge`** | `__type(name: "ReviewsConnection")` / `__type(name: "ReviewsEdge")` | ❌ Introspection disabled |
| 14 | **`appointmentReviewId` field test** | Queried `appointmentReviewId` on `ReviewDetails` | ✅ Field exists, but value is always the string `"undefined"` (unpopulated) |

### HTML / Page Scraping

| # | Approach | Result |
|---|----------|--------|
| 15 | **`__NEXT_DATA__` review structure** | Review nodes contain exactly `author`, `date`, `id`, `rating`, `reply`, `text`. No service keys. |
| 16 | **Raw HTML review card inspection** | Review text wrapped in `<p data-qa="review-item-text">`. No `data-testid` or class names referencing services in review cards. |
| 17 | **JSON-LD / schema.org markup** | `@type: HealthAndBeautyBusiness` contains `review` array. Each review: `author`, `datePublished`, `reviewBody`, `reviewRating`. No service info. |
| 18 | **Deep `__NEXT_DATA__` traversal** | Scanned all object paths containing `"review"`. Only hit: `props.pageProps.data.location.reviews` (no nested service fields). |

### Alternate API Endpoints

| # | Approach | Result |
|---|----------|--------|
| 19 | `https://www.fresha.com/api/v1/reviews` | 404 |
| 20 | `https://www.fresha.com/api/reviews` | 404 |
| 21 | `https://www.fresha.com/api/v2/reviews` | 404 |
| 22 | `https://www.fresha.com/rpc/reviews` | 404 |
| 23 | `https://api.fresha.com/reviews` | 404 |

---

## 2. Sample Queries & Responses

### A. Persisted query (Fresha frontend) — the only working review endpoint
```graphql
# GET https://www.fresha.com/graphql
# ?extensions={"persistedQuery":{"version":1,"sha256Hash":"95379a2f..."}}
# &variables={"id":"","reviews":5,"ratings":[],"slug":"mood-nail-bar-...","sortingType":"LATEST"}
```
**Response (redacted):**
```json
{
  "data": {
    "location": {
      "reviews": {
        "rating1Count": 0,
        "rating2Count": 1,
        "rating3Count": 1,
        "rating4Count": 2,
        "rating5Count": 76,
        "totalCount": 80,
        "pageInfo": { "hasNextPage": true },
        "edges": [
          {
            "cursor": "MTc3Njk5NjIxMTk5MDcyMTA1MjY5MTA4NDc=",
            "node": {
              "id": "26910847",
              "rating": 5,
              "reply": null,
              "text": "Great! Alina was super fast and thorough removing my builder gel...",
              "date": { "formattedDateWithTime": "Thu, Apr 23, 2026 at 7:03 p.m." },
              "author": { "avatar": null, "name": "Holly P" }
            }
          }
        ]
      }
    }
  }
}
```

### B. Custom query requesting `service` field — schema rejection
```graphql
query LocationReviews($slug: String!, $first: Int!) {
  location(slug: $slug) {
    reviews(first: $first) {
      edges {
        node {
          id
          rating
          text
          service { id name }
          serviceId
          appointmentService { id name }
          treatment { id name }
        }
      }
    }
  }
}
```
**Response:**
```json
{
  "errors": [
    { "message": "Cannot query field \"service\" on type \"ReviewDetails\"." },
    { "message": "Cannot query field \"serviceId\" on type \"ReviewDetails\"." },
    { "message": "Cannot query field \"appointmentService\" on type \"ReviewDetails\". Did you mean \"appointmentReviewId\"?" },
    { "message": "Cannot query field \"treatment\" on type \"ReviewDetails\"." }
  ]
}
```

### C. `appointmentReviewId` exists but is unpopulated
```graphql
query {
  location(slug: "mood-nail-bar-vancouver-337-east-broadway-nch13fdn") {
    reviews(first: 3) {
      edges {
        node {
          id
          appointmentReviewId
        }
      }
    }
  }
}
```
**Response:**
```json
{
  "data": {
    "location": {
      "reviews": {
        "edges": [
          { "node": { "id": "26910847", "appointmentReviewId": "undefined" } },
          { "node": { "id": "26909906", "appointmentReviewId": "undefined" } },
          { "node": { "id": "26870622", "appointmentReviewId": "undefined" } }
        ]
      }
    }
  }
}
```

### D. Reviews with `serviceId` filter — rejected
```graphql
query {
  location(slug: "...") {
    reviews(first: 3, serviceId: "dummy") { edges { node { id } } }
  }
}
```
**Response:**
```json
{ "errors": [{ "message": "Unknown argument \"serviceId\" on field \"Location.reviews\"." }] }
```

---

## 3. Conclusion: PARTIAL

**Fresha does NOT provide a structured association between individual reviews and specific booked services.**

- **GraphQL:** The `ReviewDetails` type has no `service`, `serviceId`, `treatment`, `catalogItem`, `appointment`, or `booking` fields. `Location.reviews` accepts no `serviceId` filter argument. The only service-adjacent field, `appointmentReviewId`, is present in the schema but always returns the string `"undefined"`.
- **HTML / `__NEXT_DATA__`:** Review nodes contain exactly `author`, `date`, `id`, `rating`, `reply`, `text`. No service metadata.
- **Schema.org JSON-LD:** Review markup includes `author`, `datePublished`, `reviewBody`, `reviewRating` — no service linkage.
- **Alternate endpoints:** None discovered.

**However, reviews often mention services in natural language** (e.g., *"removing my builder gel"*, *"Kelly did my nails"*, *"Gwen's service"*). This means a **text-analysis / NLP approach** could potentially infer service associations, but there is no native structured field.

### Implication for the dashboard
If the project wants to correlate reviews with services, the realistic options are:
1. **Keyword extraction** from review text (rule-based or lightweight NLP) — approximate, noisy.
2. **Skip per-service review analytics** — use aggregate rating/review count only, which Fresha does provide at the location level.

---

## 4. Reproducible Scripts

All probe scripts are preserved in the repo:
- `instructions/fresha-reviews-probe.mjs` — GraphQL query attempts 1–12
- `instructions/fresha-reviews-probe2.mjs` — Field brute-forcing, argument probing, `appointmentReviewId`, `__NEXT_DATA__` inspection
- `instructions/fresha-reviews-probe3.mjs` — JSON-LD, deep search, alternate endpoints, text analysis
- `instructions/fresha-reviews-probe4.mjs` — Schema.org markup detail extraction

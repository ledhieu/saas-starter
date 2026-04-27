# Walk-In Customer Flow Probability Model

## 1. Problem Definition

A pedestrian is at point **X** in an urban area. Within walking (or short-drive) distance there are **N** competing nail salons. We want to estimate:

> **P(they enter salon *i*)** for each salon *i* ∈ {1, …, N}, plus **P(they enter none)**.

This is fundamentally a **discrete choice problem** with spatial constraints. We must distinguish:

| Customer Type | Behavior | Primary Model |
|---|---|---|
| **Walk-in (impulse)** | Sees salon while walking/driving by; decides on the spot | Spatial interaction model |
| **Appointment (planned)** | Researches online, books via Fresha; destination is pre-determined | Search/rank model (Google, Fresha SEO) |

This document focuses on **walk-in probability** because it is the most sensitive to local competition geometry — the exact problem this app visualizes.

---

## 2. Spatial Interaction Models

### 2.1 Huff Model (Market Area Model)

The classic retail gravitation model adapted for probabilistic choice:

```
P(visit salon i) = (A_i / D_i^λ) / Σ_j (A_j / D_j^λ)
```

Where:
- **A_i** = Attractiveness of salon *i*
- **D_i** = Distance from customer to salon *i*
- **λ** = Distance decay exponent (mode-dependent)
- **j** iterates over all salons within consideration set

**Pros:** Simple, interpretable, widely validated in retail geography.  
**Cons:** Assumes independence of irrelevant alternatives (IIA) — adding a very similar nearby salon steals disproportionate share.

### 2.2 Reilly's Law of Retail Gravitation

Determines the "breaking point" between two competing locations:

```
D_bp = d / (1 + √(P_b / P_a))
```

Where:
- **d** = distance between salon A and salon B
- **P_a, P_b** = populations (or attractiveness) of A and B

**Use case:** Identifying which competitors directly cannibalize each other's catchment areas. Less useful for multi-competitor probability.

### 2.3 Multinomial Logit Model (MNL)

More rigorous discrete choice framework:

```
P(visit salon i) = exp(V_i) / (exp(V_none) + Σ_j exp(V_j))
```

Where **V_i** is the deterministic utility of salon *i*:

```
V_i = β₁·Rating_i + β₂·ln(Reviews_i + 1) + β₃·PriceCompetitiveness_i + β₄·Deals_i - β₅·Distance_i
```

**Pros:** Handles many variables, easy to estimate with real data, no IIA if nested logit is used.  
**Cons:** Requires calibration data (actual visits or bookings).

### 2.4 Recommendation for the App

**Start with Huff Model** for visualization simplicity, but express it in MNL form so it can be upgraded to calibrated coefficients later.

---

## 3. Attractiveness Function

For nail salons, attractiveness is a composite of signals customers observe from the street or in a 30-second Google search:

```
A_i = w₁·RatingScore_i + w₂·ReviewSignal_i + w₃·PriceSignal_i + w₄·DealSignal_i + w₅·PhotoSignal_i
```

### 3.1 Component Definitions

| Signal | Formula | Reasoning |
|---|---|---|
| **RatingScore** | `(rating - 3.0) / 2.0` normalized to [0, 1] | 3.0 stars is neutral; 5.0 is maximum |
| **ReviewSignal** | `ln(reviewsCount + 1) / ln(1000 + 1)` | Diminishing returns; 50 reviews is most of the signal |
| **PriceSignal** | `medianPrice / actualPrice` | Cheaper = more attractive for walk-ins (budget-sensitive) |
| **DealSignal** | `hasDeals ? 0.2 : 0` | Visible deals are a strong street-level signal |
| **PhotoSignal** | `photoCount / 20` (capped at 1.0) | Instagram-worthy salons draw walk-ins |

### 3.2 Default Weights (Heuristic)

```
w₁ (rating)    = 0.25
w₂ (reviews)   = 0.30
w₃ (price)     = 0.25
w₄ (deals)     = 0.10
w₅ (photos)    = 0.10
```

These weights should be **calibrated** with real data. Suggested calibration method:
1. Collect a sample of salons with known walk-in rates (from booking data or foot-traffic sensors)
2. Run logistic regression: `logit(visit) ~ rating + log(reviews) + price + deals + distance`
3. Extract coefficients as weights

---

## 4. Distance Decay Functions

The probability of walking to a salon drops sharply with distance. Different modes have different decay curves:

### 4.1 Walking Mode (Urban Dense)

```
f_walk(d) = exp(-d² / (2 · σ²))
```

Where **σ ≈ 500m** (standard deviation of walking distance).

- **500m** (~7 min walk): ~60% of peak probability
- **1km** (~14 min walk): ~14% of peak
- **2km**: effectively zero for impulse visits

### 4.2 Driving Mode (Suburban / Strip Mall)

```
f_drive(d) = 1 / (1 + (d / d₀)^λ)
```

Where **d₀ ≈ 5km** (half-max distance) and **λ ≈ 2.0**.

- **5km**: 50% of peak
- **10km**: 20% of peak
- **20km**: ~5% of peak

### 4.3 Mode Switching

Use urban density as a proxy for mode:

```
mode = (competitorsPerKm² > 5) ? 'walk' : 'drive'
```

Or let the user toggle between walking and driving catchment views.

---

## 5. Competition Density & Cannibalization

When many salons cluster together (e.g., a "nail salon district"), the total pie is split. The Huff model naturally handles this via the denominator Σ_j, but we can add a **density penalty**:

```
densityPenalty_i = 1 / (1 + α · (nearbyCompetitors_i)^γ)
```

Where:
- **nearbyCompetitors_i** = count of salons within 500m of salon *i*
- **α ≈ 0.3**, **γ ≈ 1.2**

This captures the intuition that being in a cluster of 10 salons hurts more than being in a cluster of 2.

### 5.1 Substitution Elasticity

Not all competitors are equal substitutes. Two budget nail bars are closer substitutes than a budget bar and a luxury spa. We can model this with a **substitution matrix**:

```
substitution(i, j) = 1 - |price_i - price_j| / max(price_i, price_j)
```

High substitution → high cannibalization when both are nearby.

---

## 6. Time-Based Factors

Walk-in rates vary by time:

| Factor | Impact | Data Source |
|---|---|---|
| **Day of week** | Saturday > Friday > weekday | Fresha booking density |
| **Hour of day** | Lunch (12-2pm), after-work (5-7pm) spikes | Google Popular Times |
| **Seasonality** | Pre-wedding season, holidays | Calendar + booking data |
| **Weather** | Rain increases walk-in to nearby salons | Weather API integration |

Suggested implementation: multiply the base probability by a **time multiplier**:

```
P(visit_i | t) = P(visit_i) · multiplier(t)
```

Where `multiplier(t)` is a lookup table initialized from industry averages and refined with user data.

---

## 7. Proposed Formula for the App

### 7.1 Core Formula

```typescript
function walkInProbability(
  customerLat: number,
  customerLng: number,
  salon: Salon,
  allSalons: Salon[],
  mode: 'walk' | 'drive' = 'walk'
): number {
  const distanceKm = haversineKm(customerLat, customerLng, salon.lat, salon.lng);

  // Distance decay
  const sigma = mode === 'walk' ? 0.5 : 5.0; // km
  const distancePenalty = Math.exp(-(distanceKm ** 2) / (2 * sigma ** 2));

  // Attractiveness
  const ratingScore = Math.max(0, (salon.rating - 3.0) / 2.0);
  const reviewSignal = Math.log(salon.reviewsCount + 1) / Math.log(1001);
  const priceSignal = globalMedianPrice / Math.max(salon.avgPrice, 1);
  const dealSignal = salon.hasDeals ? 0.2 : 0;

  const attractiveness =
    0.25 * ratingScore +
    0.30 * reviewSignal +
    0.25 * priceSignal +
    0.10 * dealSignal +
    0.10 * 0; // photoSignal placeholder

  // Competition density penalty
  const nearbyCompetitors = allSalons.filter(
    s => s.id !== salon.id && haversineKm(salon.lat, salon.lng, s.lat, s.lng) < 0.5
  ).length;
  const densityPenalty = 1 / (1 + 0.3 * nearbyCompetitors ** 1.2);

  // Utility
  const utility = attractiveness * distancePenalty * densityPenalty;

  // None option (outside option)
  const noneUtility = 0.05; // baseline: 5% chance of visiting none

  // MNL probability
  const sumUtilities = noneUtility + allSalons.reduce((sum, s) => {
    if (s.id === salon.id) return sum + utility;
    const d = haversineKm(customerLat, customerLng, s.lat, s.lng);
    const dp = Math.exp(-(d ** 2) / (2 * sigma ** 2));
    const rs = Math.max(0, (s.rating - 3.0) / 2.0);
    const revs = Math.log(s.reviewsCount + 1) / Math.log(1001);
    const ps = globalMedianPrice / Math.max(s.avgPrice, 1);
    const ds = s.hasDeals ? 0.2 : 0;
    const att = 0.25 * rs + 0.30 * revs + 0.25 * ps + 0.10 * ds;
    const nc = allSalons.filter(x => x.id !== s.id && haversineKm(s.lat, s.lng, x.lat, x.lng) < 0.5).length;
    const denPen = 1 / (1 + 0.3 * nc ** 1.2);
    return sum + att * dp * denPen;
  }, 0);

  return utility / sumUtilities;
}
```

### 7.2 Simplified Version (Phase 1)

For initial implementation, use only 3 variables:

```
P(visit salon i) ∝ (rating_i / 5.0) · ln(reviews_i + 1) · exp(-distance_i / 500m)
```

Normalize so all probabilities sum to 1 (plus an outside option).

---

## 8. UI Visualization Ideas

### 8.1 Heatmap Layer
Overlay a raster heatmap on the map showing the "expected customer capture" probability. Each pixel's color intensity represents the probability that a pedestrian at that location would enter the user's salon versus competitors.

### 8.2 What-If Simulator
> *"If you price $5 lower, you'd steal 12% of competitor X's walk-ins within 1km."*

Slider controls for:
- Price adjustment
- Rating improvement (e.g., "what if I hit 4.5 stars?")
- Deal/promotion toggle

Real-time recalculation of catchment area and stolen share.

### 8.3 Time-of-Day Slider
Animate the map showing how catchment areas shift:
- Lunch rush: tight, dense circles around offices
- Evening: larger circles, shift toward residential areas
- Weekend: different pattern entirely

### 8.4 Threat Matrix Table
Rank competitors by **expected customer steal rate** — not just distance, but probability-weighted:

| Competitor | Distance | P(they steal from you) | P(you steal from them) |
|---|---|---|---|
| Salon A | 200m | 35% | 18% |
| Salon B | 800m | 8% | 4% |

---

## 9. Data Sources for Calibration

| Source | What it provides | How to get it |
|---|---|---|
| **Fresha booking density** | Proxy for popularity — high bookings ≈ high attractiveness | Fresha API (already using) |
| **Google Popular Times** | Relative foot traffic by hour/day | Scrapable from Google Maps (unofficial) |
| **Street foot traffic** | Actual pedestrian counts | Mapbox Movement data, HERE Traffic, or Placer.ai (paid) |
| **User surveys** | "Why did you choose this salon?" | In-app survey for salon owners |
| **Booking conversion** | % of profile views that become bookings | Fresha analytics (if available via API) |
| **WiFi/Beacon data** | Physical visit counts | Requires hardware partnership |

### 9.1 Calibration Roadmap

1. **Phase 1 (Heuristic):** Use the formula with default weights. Visually plausible is good enough.
2. **Phase 2 (Correlation):** Compare predicted probabilities against Fresha review growth rates (proxy for popularity).
3. **Phase 3 (Regression):** If a salon owner shares their actual walk-in counts, run logistic regression to fit weights.
4. **Phase 4 (ML):** Gradient-boosted model with 10+ features if dataset grows >1,000 salon-months.

---

## 10. Next Steps

1. **Implement simplified model** with 3 variables (rating, reviews, distance) in a utility function
2. **Add heatmap layer** to the Mapbox map using `mapbox-gl` heatmap layer or Deck.gl
3. **A/B test predictions:** Ask 5 salon owners to estimate their walk-in share; compare against model predictions
4. **Gather calibration data:** Add an opt-in feature for users to report weekly walk-in counts
5. **Iterate weights:** Re-fit model monthly as more data arrives

---

## Appendix: Key Papers & References

- **Huff, D.L. (1963).** "A Probabilistic Analysis of Shopping Center Trade Areas." *Land Economics.*
- **Reilly, W.J. (1931).** *The Law of Retail Gravitation.*
- **McFadden, D. (1974).** "Conditional Logit Analysis of Qualitative Choice Behavior." *Frontiers in Econometrics.*
- **González-Benito, J. et al. (2000).** "Spatial Competition and Retail Attractiveness."
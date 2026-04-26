'use client';

import { useState, useCallback, Fragment } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Circle,
  InfoWindow,
} from '@react-google-maps/api';

// Static library array to prevent Google Maps script reloads on re-render
const GOOGLE_MAPS_LIBRARIES: ('places' | 'visualization')[] = ['places', 'visualization'];

interface CompetitorMapProps {
  centerLat: number;
  centerLng: number;
  radiusKm?: number | null;
  competitors: Array<{
    id: number;
    name: string;
    slug: string;
    freshaPid: string | null;
    latitude: string | null;
    longitude: string | null;
    rating: string | null;
    reviewsCount: number | null;
    address: string | null;
  }>;
  servicesByCompetitor?: Record<number, Array<{ name: string; priceFormatted: string | null; priceValueMin: number | null }>>;
}

/** Haversine distance in km */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const mapContainerStyle = { width: '100%', height: '600px' };
const RED_PIN_URL = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';

/** Linear interpolation between two RGB values */
function lerpRGB(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

/** Smooth green → yellow → red based on review count (0=green, 50=yellow, 100+=red) */
function getColor(reviewsCount: number | null): string {
  const n = reviewsCount ?? 0;
  const t = Math.min(n / 100, 1); // 0 to 1
  const GREEN: [number, number, number] = [34, 197, 94];
  const YELLOW: [number, number, number] = [234, 179, 8];
  const RED: [number, number, number] = [239, 68, 68];

  if (t < 0.5) {
    return lerpRGB(GREEN, YELLOW, t * 2);
  }
  return lerpRGB(YELLOW, RED, (t - 0.5) * 2);
}

/** Average price for a competitor */
function getAvgPrice(
  competitorId: number,
  servicesByCompetitor?: Record<number, Array<{ priceValueMin: number | null }>>
): number | null {
  const services = servicesByCompetitor?.[competitorId] || [];
  const prices = services
    .map((s) => s.priceValueMin)
    .filter((p): p is number => p != null);
  if (prices.length === 0) return null;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

/** Median of an array of numbers */
function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Global median price across all competitor services */
function getGlobalMedianPrice(
  servicesByCompetitor?: Record<number, Array<{ priceValueMin: number | null }>>
): number | null {
  const allPrices = Object.values(servicesByCompetitor ?? {})
    .flat()
    .map((s) => s.priceValueMin)
    .filter((p): p is number => p != null);
  return median(allPrices);
}

/**
 * How far customers are willing to walk to this competitor.
 *
 * Research-backed parameters:
 * - Base 500m: empirically verified ~7-min walk for salons (Bandung ITB, McGill)
 * - Reviews: reputation gravity. +3m/review, cap 300 (MapLift: 287 reviews overcame 2.4km)
 * - Rating: (stars - 3.0) * 200. Half-star = +19-49% sellouts (UC Berkeley)
 * - Price: research-backed — premium = destination effect = larger draw (Spatial Frictions in Consumption)
 */
function getThreatRadius(
  reviewsCount: number | null,
  rating: string | null,
  priceDeviation: number | null
): number {
  const reviews = reviewsCount ?? 0;
  const r = parseFloat(rating ?? '0');
  const stars = Number.isNaN(r) ? 0 : r;

  const base = 500;                              // ~7-min walk, empirically verified
  const reviewBonus = Math.min(reviews, 300) * 3; // +3m per review, cap 300

  // Rating: 3.0=0m, 4.0=200m, 5.0=400m. Captures full spectrum.
  const ratingBonus = Math.max(0, stars - 3.0) * 200;

  // Price deviation from global median: premium = destination effect = LARGER radius
  // Research: differentiated/premium competitors draw from 6-8× farther (Spatial Frictions in Consumption)
  // $20 above median → +100m, $20 below → -100m, capped at ±200m
  const priceModifier = priceDeviation != null
    ? Math.max(-200, Math.min(priceDeviation * 5, 200))
    : 0;

  return Math.max(200, Math.min(base + reviewBonus + ratingBonus + priceModifier, 2500));
}

export default function CompetitorMap({
  centerLat,
  centerLng,
  radiusKm,
  competitors,
  servicesByCompetitor,
}: CompetitorMapProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const handleCircleClick = useCallback((id: number) => {
    setSelectedId(id);
  }, []);

  const handleInfoWindowClose = useCallback(() => {
    setSelectedId(null);
  }, []);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-lg border text-sm text-gray-500">
        Failed to load Google Maps
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-lg border text-sm text-gray-500">
        Loading map…
      </div>
    );
  }

  const center = { lat: centerLat, lng: centerLng };

  const validCompetitors = competitors.filter(
    (c) => c.latitude != null && c.longitude != null
  );

  // Compute global median price once for deviation calculations
  const globalMedian = getGlobalMedianPrice(servicesByCompetitor);

  return (
    <div className="rounded-lg shadow-sm border overflow-hidden">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={14}
        options={{
          mapTypeId: 'roadmap',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        }}
      >
        {/* Red pin at search center */}
        <Marker position={center} icon={RED_PIN_URL} title="Search location" />

        {/* Search radius boundary */}
        {radiusKm != null && radiusKm > 0 && (
          <Circle
            center={center}
            radius={radiusKm * 1000}
            options={{
              fillColor: '#3b82f6',
              fillOpacity: 0.03,
              strokeColor: '#2563eb',
              strokeOpacity: 0.15,
              strokeWeight: 2,
            }}
          />
        )}

        {/* Walking-distance threat radius per competitor + center dot */}
        {validCompetitors.map((c) => {
          const lat = parseFloat(c.latitude!);
          const lng = parseFloat(c.longitude!);
          const color = getColor(c.reviewsCount);
          const avgPrice = getAvgPrice(c.id, servicesByCompetitor);
          const priceDeviation = avgPrice != null && globalMedian != null
            ? avgPrice - globalMedian
            : null;
          const threatRadius = getThreatRadius(c.reviewsCount, c.rating, priceDeviation);
          const insideRadius =
            radiusKm == null || haversineKm(centerLat, centerLng, lat, lng) <= radiusKm;

          return (
            <Fragment key={`${c.id}-fragment`}>
              {/* Walking distance threat — sized by reputation + price deviation from median */}
              <Circle
                key={`${c.id}-threat`}
                center={{ lat, lng }}
                radius={threatRadius}
                options={{
                  fillColor: color,
                  fillOpacity: insideRadius ? 0.06 : 0.02,
                  strokeColor: color,
                  strokeOpacity: insideRadius ? 0.35 : 0.15,
                  strokeWeight: 1,
                }}
              />
              {/* Center dot */}
              <Circle
                key={c.id}
                center={{ lat, lng }}
                radius={15}
                options={{
                  fillColor: color,
                  fillOpacity: insideRadius ? 0.9 : 0.5,
                  strokeColor: color,
                  strokeOpacity: 1,
                  strokeWeight: 1,
                }}
                onClick={() => handleCircleClick(c.id)}
              />
            </Fragment>
          );
        })}

        {selectedId != null &&
          (() => {
            const c = validCompetitors.find((c) => c.id === selectedId);
            if (!c) return null;
            const lat = parseFloat(c.latitude!);
            const lng = parseFloat(c.longitude!);
            const services = servicesByCompetitor?.[c.id] ?? [];
            return (
              <InfoWindow position={{ lat, lng }} onCloseClick={handleInfoWindowClose}>
                <div className="text-sm max-w-xs">
                  <p className="font-semibold text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">DB ID: {c.id}</p>
                  <p className="text-gray-700 mt-1">
                    ⭐ {c.rating ?? '—'} ({c.reviewsCount ?? 0} reviews)
                  </p>
                  <p className="text-gray-500 mt-1">{c.address ?? '—'}</p>
                  {services.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {services.slice(0, 3).map((s, idx) => (
                        <p key={idx} className="text-xs text-gray-600">
                          • {s.name}
                          {s.priceFormatted ? ` — ${s.priceFormatted}` : ''}
                        </p>
                      ))}
                      {services.length > 3 && (
                        <p className="text-xs text-gray-400 italic">
                          +{services.length - 3} more
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </InfoWindow>
            );
          })()}
      </GoogleMap>
    </div>
  );
}

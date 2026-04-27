'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_API_KEY ?? '';

export type MapVisualizationMode = 'reputation' | 'pricing' | 'popularity';

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
  servicesByCompetitor?: Record<
    number,
    Array<{
      name: string;
      priceFormatted: string | null;
      priceValueMin: number | null;
    }>
  >;
  mode?: MapVisualizationMode;
  pricingServiceName?: string | null;
}

/* ─── Geometry helpers ─── */

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getRatingColor(rating: string | null): string {
  const r = parseFloat(rating ?? '0');
  if (Number.isNaN(r) || r === 0) return '#9ca3af';
  if (r >= 5.0) return '#ef4444';
  if (r >= 4.9) return '#f97316';
  if (r >= 4.8) return '#eab308';
  if (r >= 4.7) return '#84cc16';
  return '#22c55e';
}

function getReviewRadius(reviewsCount: number | null): number {
  const r = reviewsCount ?? 0;
  return Math.max(5, Math.min(14, 5 + (r / 100) * 9));
}

function getServicePrice(
  competitorId: number,
  serviceName: string | null,
  servicesByCompetitor?: Record<number, Array<{ name: string; priceValueMin: number | null }>>
): number | null {
  if (!serviceName) return null;
  if (!servicesByCompetitor || !(competitorId in servicesByCompetitor)) return null;
  const svcs = servicesByCompetitor[competitorId];
  if (!svcs) return null;
  const match = svcs.find((s) => s.name === serviceName);
  return match?.priceValueMin ?? null;
}

function getAvgPrice(
  competitorId: number,
  servicesByCompetitor?: Record<number, Array<{ priceValueMin: number | null }>>
): number | null {
  if (!servicesByCompetitor || !(competitorId in servicesByCompetitor)) return null;
  const svcs = servicesByCompetitor[competitorId];
  if (!svcs) return null;
  let sum = 0, count = 0;
  for (const s of svcs) {
    if (s.priceValueMin != null) { sum += s.priceValueMin; count++; }
  }
  return count > 0 ? sum / count : null;
}

function popularityScore(reviewsCount: number | null, rating: string | null): number {
  const reviews = reviewsCount ?? 0;
  const r = parseFloat(rating ?? '0');
  const stars = Number.isNaN(r) ? 0 : r;
  return reviews * Math.max(0.5, stars);
}

/** Small square polygon centred at a point — footprint for skyscraper bars */
function createSquarePolygon(center: [number, number], sizeMeters: number): GeoJSON.Polygon {
  const half = sizeMeters / 2;
  const latFactor = 111320;
  const lngFactor = latFactor * Math.cos((center[1] * Math.PI) / 180);
  const dLat = half / latFactor;
  const dLng = half / lngFactor;
  return {
    type: 'Polygon',
    coordinates: [[
      [center[0] - dLng, center[1] - dLat],
      [center[0] + dLng, center[1] - dLat],
      [center[0] + dLng, center[1] + dLat],
      [center[0] - dLng, center[1] + dLat],
      [center[0] - dLng, center[1] - dLat],
    ]],
  };
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/* ─── Component ─── */

function CompetitorMap({
  centerLat,
  centerLng,
  radiusKm,
  competitors,
  servicesByCompetitor,
  mode = 'reputation',
  pricingServiceName,
}: CompetitorMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const centerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const closingIntentionally = useRef(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const handleCompetitorClick = useCallback((id: number) => {
    setSelectedId(id);
  }, []);

  /* 1️⃣ Initialise map */
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/ldhieu/cmog94ecj001u01sqcybj4anq',
      center: [centerLng, centerLat],
      zoom: 14,
      pitch: 45, // slight tilt so skyscrapers are visible
      renderWorldCopies: false,
      antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('load', () => setMapLoaded(true));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      centerMarkerRef.current = null;
      popupRef.current = null;
      setMapLoaded(false);
    };
  }, []);

  /* 2️⃣ Pan */
  useEffect(() => {
    mapRef.current?.setCenter([centerLng, centerLat]);
  }, [centerLat, centerLng]);

  /* 3️⃣ Search radius circle */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const sourceId = 'search-radius-source';
    const fillId = 'search-radius-fill';
    const lineId = 'search-radius-line';

    if (radiusKm != null && radiusKm > 0) {
      const geojson: GeoJSON.Feature<GeoJSON.Polygon> = {
        type: 'Feature',
        geometry: createSquarePolygon([centerLng, centerLat], radiusKm * 1000 * 2), // approximate circle with large square for radius
        properties: {},
      };
      // Actually use a real circle approximation
      const circleCoords: number[][] = [];
      const r = radiusKm * 1000;
      const latF = 111320;
      const lngF = latF * Math.cos((centerLat * Math.PI) / 180);
      for (let i = 0; i <= 32; i++) {
        const angle = (i * 2 * Math.PI) / 32;
        circleCoords.push([
          centerLng + (r * Math.cos(angle)) / lngF,
          centerLat + (r * Math.sin(angle)) / latF,
        ]);
      }
      const circleGeojson: GeoJSON.Feature<GeoJSON.Polygon> = {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [circleCoords] },
        properties: {},
      };

      const src = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
      if (src) {
        src.setData(circleGeojson);
      } else {
        map.addSource(sourceId, { type: 'geojson', data: circleGeojson });
        map.addLayer({ id: fillId, type: 'fill', source: sourceId, paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.03 } });
        map.addLayer({ id: lineId, type: 'line', source: sourceId, paint: { 'line-color': '#2563eb', 'line-opacity': 0.15, 'line-width': 2 } });
      }
    } else {
      if (map.getLayer(fillId)) map.removeLayer(fillId);
      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  }, [mapLoaded, centerLat, centerLng, radiusKm]);

  /* 4️⃣ Memoised GeoJSON — dots + skyscraper bars */
  const { dotsGeoJSON, skyscraperGeoJSON } = useMemo(() => {
    const dotFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
    const barFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = [];

    for (const c of competitors) {
      if (!c.latitude || !c.longitude) continue;
      const lat = parseFloat(c.latitude);
      const lng = parseFloat(c.longitude);
      const insideRadius = radiusKm == null || haversineKm(centerLat, centerLng, lat, lng) <= radiusKm;
      const popScore = popularityScore(c.reviewsCount, c.rating);

      const color = getRatingColor(c.rating);
      const radiusPx = getReviewRadius(c.reviewsCount);

      let heightMeters: number;
      if (mode === 'pricing') {
        const price = pricingServiceName
          ? getServicePrice(c.id, pricingServiceName, servicesByCompetitor)
          : getAvgPrice(c.id, servicesByCompetitor);
        heightMeters = price != null ? Math.min(price * 3, 600) : 30;
      } else if (mode === 'popularity') {
        heightMeters = Math.min(popScore * 0.3, 600);
      } else {
        heightMeters = Math.min((c.reviewsCount ?? 0) * 1.2, 600);
      }

      // Skyscraper bar (small square footprint, extruded upward)
      barFeatures.push({
        type: 'Feature',
        geometry: createSquarePolygon([lng, lat], 35),
        properties: {
          color,
          height: heightMeters,
          competitorId: c.id,
        },
      });

      // Dot on top of bar
      dotFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          color,
          opacity: insideRadius ? 0.95 : 0.5,
          radius: radiusPx,
          competitorId: c.id,
        },
      });
    }

    return {
      dotsGeoJSON: { type: 'FeatureCollection', features: dotFeatures } as GeoJSON.FeatureCollection<GeoJSON.Point>,
      skyscraperGeoJSON: { type: 'FeatureCollection', features: barFeatures } as GeoJSON.FeatureCollection<GeoJSON.Polygon>,
    };
  }, [competitors, servicesByCompetitor, radiusKm, centerLat, centerLng, mode, pricingServiceName]);

  /* 5️⃣ Sync canvas layers */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Skyscraper bars (fill-extrusion — GPU native, no lag during rotate)
    const barSourceId = 'skyscraper-source';
    const barLayerId = 'skyscrapers';
    if (skyscraperGeoJSON.features.length > 0) {
      const src = map.getSource(barSourceId) as mapboxgl.GeoJSONSource | undefined;
      if (src) {
        src.setData(skyscraperGeoJSON);
      } else {
        map.addSource(barSourceId, { type: 'geojson', data: skyscraperGeoJSON });
        map.addLayer({
          id: barLayerId,
          type: 'fill-extrusion',
          source: barSourceId,
          paint: {
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.8,
          },
        });
      }
    } else {
      if (map.getLayer(barLayerId)) map.removeLayer(barLayerId);
      if (map.getSource(barSourceId)) map.removeSource(barSourceId);
    }

    // Competitor dots
    const dotsSourceId = 'competitor-dots-source';
    const dotsLayerId = 'competitor-dots';
    if (dotsGeoJSON.features.length > 0) {
      const src = map.getSource(dotsSourceId) as mapboxgl.GeoJSONSource | undefined;
      if (src) {
        src.setData(dotsGeoJSON);
      } else {
        map.addSource(dotsSourceId, { type: 'geojson', data: dotsGeoJSON });
        map.addLayer({
          id: dotsLayerId,
          type: 'circle',
          source: dotsSourceId,
          paint: {
            'circle-radius': ['get', 'radius'],
            'circle-color': ['get', 'color'],
            'circle-opacity': ['get', 'opacity'],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        map.on('click', dotsLayerId, (e) => {
          const feature = e.features?.[0];
          const cid = feature?.properties?.competitorId;
          if (cid != null && cid !== '') {
            handleCompetitorClick(Number(cid));
          }
        });
        map.on('mouseenter', dotsLayerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', dotsLayerId, () => { map.getCanvas().style.cursor = ''; });
      }
    } else {
      if (map.getLayer(dotsLayerId)) map.removeLayer(dotsLayerId);
      if (map.getSource(dotsSourceId)) map.removeSource(dotsSourceId);
    }
  }, [skyscraperGeoJSON, dotsGeoJSON, mapLoaded, handleCompetitorClick]);

  /* 6️⃣ Center pin */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (centerMarkerRef.current) {
      centerMarkerRef.current.setLngLat([centerLng, centerLat]);
    } else {
      const el = document.createElement('div');
      el.className = 'w-8 h-8 -mt-4 -ml-4';
      el.innerHTML = `<svg viewBox="0 0 24 24" fill="#ef4444" class="w-full h-full drop-shadow-md"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>`;
      centerMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([centerLng, centerLat])
        .addTo(map);
    }
  }, [mapLoaded, centerLat, centerLng]);

  /* 7️⃣ Popup */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (popupRef.current) {
      closingIntentionally.current = true;
      popupRef.current.remove();
      closingIntentionally.current = false;
      popupRef.current = null;
    }

    if (selectedId == null) return;

    const c = competitors.find((x) => x.id === selectedId);
    if (!c || !c.latitude || !c.longitude) return;

    const lat = parseFloat(c.latitude);
    const lng = parseFloat(c.longitude);
    const svcs = servicesByCompetitor?.[c.id] ?? [];

    const servicesHtml = svcs.length > 0
      ? `<div style="margin-top:0.5rem;display:flex;flex-direction:column;gap:0.25rem;">
          ${svcs.slice(0, 3).map((s) => `<p style="font-size:0.75rem;color:#4b5563;margin:0;">• ${escapeHtml(s.name)}${s.priceFormatted ? ` — ${escapeHtml(s.priceFormatted)}` : ''}</p>`).join('')}
          ${svcs.length > 3 ? `<p style="font-size:0.75rem;color:#9ca3af;font-style:italic;margin:0;">+${svcs.length - 3} more</p>` : ''}
         </div>`
      : '';

    const html = `
      <div style="font-size:0.875rem;max-width:20rem;font-family:system-ui,sans-serif;">
        <p style="font-weight:600;color:#111827;margin:0;">${escapeHtml(c.name)}</p>
        <p style="font-size:0.75rem;color:#9ca3af;font-family:monospace;margin-top:0.125rem;">DB ID: ${c.id}</p>
        <p style="color:#374151;margin-top:0.25rem;">⭐ ${c.rating ?? '—'} (${c.reviewsCount ?? 0} reviews)</p>
        <p style="color:#6b7280;margin-top:0.25rem;">${escapeHtml(c.address ?? '—')}</p>
        ${servicesHtml}
      </div>`;

    const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, offset: 8, maxWidth: '320px' })
      .setLngLat([lng, lat])
      .setHTML(html)
      .addTo(map);

    popup.on('close', () => {
      if (!closingIntentionally.current) setSelectedId(null);
    });
    popupRef.current = popup;

    return () => {
      if (popupRef.current && mapRef.current) {
        closingIntentionally.current = true;
        popupRef.current.remove();
        closingIntentionally.current = false;
        popupRef.current = null;
      }
    };
  }, [selectedId]);

  if (!mapboxgl.accessToken) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] bg-gray-50 rounded-lg border text-sm text-gray-500 gap-2">
        <p>Mapbox API key not configured</p>
        <p className="text-xs text-gray-400 max-w-xs text-center">
          Add <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_MAPBOX_PUBLIC_API_KEY=your_key</code> to your <code className="bg-gray-100 px-1 rounded">.env</code> file and restart the dev server.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg shadow-sm border overflow-hidden relative">
      <div ref={mapContainerRef} className="w-full" style={{ height: '600px' }} />
    </div>
  );
}

export default React.memo(CompetitorMap);

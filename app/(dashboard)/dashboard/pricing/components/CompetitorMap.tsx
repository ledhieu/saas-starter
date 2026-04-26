'use client';

import { useState, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, Circle, InfoWindow } from '@react-google-maps/api';

type Competitor = {
  id: number;
  name: string;
  slug: string;
  businessType: string | null;
  address: string | null;
  city: string | null;
  latitude: string | null;
  longitude: string | null;
  rating: string | null;
  reviewsCount: number | null;
  phone: string | null;
  fetchedAt: Date;
};

type Props = {
  competitors: Competitor[];
  centerLat: number;
  centerLng: number;
  radiusKm: number;
};

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  minHeight: '24rem',
  borderRadius: '0.75rem',
};

export default function CompetitorMap({
  competitors,
  centerLat,
  centerLng,
  radiusKm,
}: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const center = { lat: centerLat, lng: centerLng };

  const onMarkerClick = useCallback((id: number) => {
    setSelectedId(id);
  }, []);

  const onInfoWindowClose = useCallback(() => {
    setSelectedId(null);
  }, []);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-xl text-sm text-gray-500">
        Google Maps API key not configured
      </div>
    );
  }

  const validCompetitors = competitors.filter(
    (c) => c.latitude != null && c.longitude != null
  );

  return (
    <LoadScript googleMapsApiKey={apiKey}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={13}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        }}
      >
        <Circle
          center={center}
          radius={radiusKm * 1000}
          options={{
            fillColor: 'rgba(249, 115, 22, 0.15)',
            fillOpacity: 1,
            strokeColor: 'rgba(249, 115, 22, 0.6)',
            strokeWeight: 2,
          }}
        />

        {validCompetitors.map((c) => {
          const lat = parseFloat(c.latitude!);
          const lng = parseFloat(c.longitude!);
          return (
            <Marker
              key={c.id}
              position={{ lat, lng }}
              onClick={() => onMarkerClick(c.id)}
            >
              {selectedId === c.id && (
                <InfoWindow onCloseClick={onInfoWindowClose}>
                  <div className="max-w-xs text-sm">
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    {c.rating && (
                      <p className="text-orange-600">★ {c.rating}</p>
                    )}
                    <p className="text-gray-500 mt-1">
                      {[c.address, c.city].filter(Boolean).join(', ') || '—'}
                    </p>
                    <button
                      onClick={() => {
                        const el = document.getElementById(`competitor-row-${c.id}`);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          el.classList.add('bg-orange-50');
                          setTimeout(() => el.classList.remove('bg-orange-50'), 2000);
                        }
                        onInfoWindowClose();
                      }}
                      className="mt-2 text-orange-600 hover:text-orange-700 font-medium underline underline-offset-2"
                    >
                      View services
                    </button>
                  </div>
                </InfoWindow>
              )}
            </Marker>
          );
        })}
      </GoogleMap>
    </LoadScript>
  );
}

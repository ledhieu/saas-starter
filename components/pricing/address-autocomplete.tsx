'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface PlaceDetails {
  address: string;
  placeId: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: PlaceDetails) => void;
  placeholder?: string;
}

interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number];
}

const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_API_KEY ?? '';

export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Enter address...',
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalValue, setInternalValue] = useState(value);
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || !MAPBOX_ACCESS_TOKEN) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=address,place&limit=5&autocomplete=true`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`Mapbox HTTP ${res.status}`);
      const data = await res.json();
      setSuggestions(data.features ?? []);
    } catch (err) {
      console.warn('Mapbox geocoding error:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    onChange(newValue);
    setShowDropdown(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  const handleSelect = (feature: MapboxFeature) => {
    setInternalValue(feature.place_name);
    onChange(feature.place_name);
    setSuggestions([]);
    setShowDropdown(false);

    const [lng, lat] = feature.center;
    console.log('[AddressAutocomplete] place selected:', {
      address: feature.place_name,
      placeId: feature.id,
      lat,
      lng,
    });
    onPlaceSelect({
      address: feature.place_name,
      placeId: feature.id,
      lat,
      lng,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleBlur = () => {
    // Delay hiding so clicks on dropdown items register
    setTimeout(() => setShowDropdown(false), 150);
  };

  // Fallback when no Mapbox token
  if (!MAPBOX_ACCESS_TOKEN) {
    return (
      <input
        type="text"
        value={internalValue}
        onChange={(e) => {
          setInternalValue(e.target.value);
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
      />
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={internalValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-orange-500" />
        </div>
      )}
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-white shadow-lg text-sm">
          {suggestions.map((feature) => (
            <li
              key={feature.id}
              className="cursor-pointer px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(feature);
              }}
            >
              {feature.place_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

'use client';

import { useRef, useEffect, useState } from 'react';
import { useLoadScript } from '@react-google-maps/api';

// Static library array to prevent Google Maps script reloads on re-render
const GOOGLE_MAPS_LIBRARIES: ('places' | 'visualization')[] = ['places', 'visualization'];

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

export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Enter address...',
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [internalValue, setInternalValue] = useState(value);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      fields: ['formatted_address', 'place_id', 'geometry'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;

      const address = place.formatted_address ?? '';
      const placeId = place.place_id ?? '';
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      setInternalValue(address);
      onChange(address);
      console.log('[AddressAutocomplete] place selected:', { address, placeId, lat, lng });
      onPlaceSelect({ address, placeId, lat, lng });
    });

    autocompleteRef.current = autocomplete;
  }, [isLoaded, onChange, onPlaceSelect]);

  if (loadError) {
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
    <input
      ref={inputRef}
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

'use client';

import { useState, useEffect, Fragment } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  Star,
  MapPin,
  Phone,
  ChevronDown,
  ChevronUp,
  Users,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

import MenuImport from '@/components/pricing/menu-import';
import PercentileChart from '@/components/pricing/percentile-chart';
import AddressAutocomplete from '@/components/pricing/address-autocomplete';
import CompetitorChatbot from '@/components/pricing/competitor-chatbot';
import type { MapVisualizationMode } from '@/components/pricing/competitor-map';

const CompetitorMap = dynamic(
  () => import('@/components/pricing/competitor-map'),
  { ssr: false }
);

type Competitor = {
  id: number;
  name: string;
  slug: string;
  freshaPid: string | null;
  googlePlaceId: string | null;
  source: 'fresha' | 'google' | 'both' | null;
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

type Service = {
  id: number;
  competitorId: number;
  categoryName: string | null;
  name: string;
  durationCaption: string | null;
  priceFormatted: string | null;
  priceValueMin: number | null;
  priceValueMax: number | null;
};

type UserMenuItem = {
  id: number;
  userId: number;
  name: string;
  price: number;
  duration: number | null;
  createdAt: Date;
};

type MatchResult = {
  item: UserMenuItem;
  matchedServices: Service[];
  prices: number[];
  percentile: number | null;
};

type FreshaDebugQuery = {
  endpoint: string;
  headers: Record<string, string>;
  graphqlQuery: string;
  variables: Record<string, unknown>;
  body: string;
};

type FreshaDebugData = {
  request?: FreshaDebugQuery;
};

const radiusOptions = [1, 3, 5, 10, 25, 50, 100];

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${diffWeeks}w ago`;
}
const businessTypeOptions = [
  'nail salon',
  'hair salon',
  'barber',
  'spa',
  'beauty salon',
  'massage',
];

function CompetitorServices({ competitorId }: { competitorId: number }) {
  const [services, setServices] = useState<Service[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/competitors/${competitorId}/services`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load services');
        const data = await res.json();
        if (!cancelled) {
          setServices(data.services ?? []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [competitorId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
        <span className="ml-2 text-sm text-muted-foreground">Loading services…</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-sm py-2">{error}</p>;
  }

  if (!services || services.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">No services listed.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Category</th>
            <th className="py-2 pr-4 font-medium">Duration</th>
            <th className="py-2 font-medium">Price</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr key={service.id} className="border-b border-gray-100 last:border-0">
              <td className="py-2 pr-4">{service.name}</td>
              <td className="py-2 pr-4 text-muted-foreground">
                {service.categoryName ?? '—'}
              </td>
              <td className="py-2 pr-4 text-muted-foreground">
                {service.durationCaption ?? '—'}
              </td>
              <td className="py-2 font-medium text-orange-600">
                {service.priceFormatted ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnalyticsSummary({
  competitors,
  servicesByCompetitor,
}: {
  competitors: Competitor[];
  servicesByCompetitor: Record<number, Service[]>;
}) {
  const totalCompetitors = competitors.length;

  const ratings = competitors
    .map((c) => parseFloat(c.rating ?? ''))
    .filter((r) => !isNaN(r));
  const avgRating =
    ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : '—';

  const allPrices = Object.values(servicesByCompetitor)
    .flat()
    .map((s) => s.priceValueMin)
    .filter((p): p is number => p != null && p > 0);

  const avgPrice =
    allPrices.length > 0
      ? `$${Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length)}`
      : '—';

  const minPrice = allPrices.length > 0 ? `$${Math.round(Math.min(...allPrices))}` : '—';
  const maxPrice = allPrices.length > 0 ? `$${Math.round(Math.max(...allPrices))}` : '—';

  const cards = [
    {
      title: 'Competitors Found',
      value: totalCompetitors,
      icon: Users,
    },
    {
      title: 'Average Rating',
      value: avgRating,
      icon: Star,
    },
    {
      title: 'Average Price',
      value: avgPrice,
      icon: DollarSign,
    },
    {
      title: 'Price Range',
      value: `${minPrice} – ${maxPrice}`,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <card.icon className="h-4 w-4 text-orange-500" />
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function PricingPage() {
  const [address, setAddress] = useState('');
  const [placeDetails, setPlaceDetails] = useState<{
    placeId: string;
    lat: number;
    lng: number;
  } | null>(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [businessType, setBusinessType] = useState('nail salon');

  const [competitors, setCompetitors] = useState<Competitor[] | null>(null);
  const [servicesByCompetitor, setServicesByCompetitor] = useState<
    Record<number, Service[]>
  >({});
  const [lastUpdated, setLastUpdated] = useState<Record<number, string | null>>({});
  const [isStale, setIsStale] = useState<Record<number, boolean>>({});
  const [centerLat, setCenterLat] = useState<number | null>(null);
  const [centerLng, setCenterLng] = useState<number | null>(null);
  const [searchRadiusKm, setSearchRadiusKm] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingMenus, setFetchingMenus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [userMenuItems, setUserMenuItems] = useState<UserMenuItem[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [mapMode, setMapMode] = useState<MapVisualizationMode>('reputation');
  const [pricingServiceName, setPricingServiceName] = useState<string>('');
  const [mapTransitioning, setMapTransitioning] = useState(false);
  const [freshaDebug, setFreshaDebug] = useState<FreshaDebugData | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'fresha' | 'google' | 'both'>('all');

  const filteredCompetitors =
    sourceFilter === 'all'
      ? competitors ?? []
      : (competitors ?? []).filter((c) => c.source === sourceFilter);

  const sourceBadge = (source: Competitor['source']) => {
    if (source === 'fresha') {
      return (
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
          Fresha
        </span>
      );
    }
    if (source === 'google') {
      return (
        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
          Google
        </span>
      );
    }
    if (source === 'both') {
      return (
        <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
          Fresha + Google
        </span>
      );
    }
    return null;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCompetitors([]); // empty array so map renders immediately with just the center
    setServicesByCompetitor({});
    setLastUpdated({});
    setIsStale({});
    setExpandedId(null);
    setMatchResults(null);
    setHasNextPage(false);
    setEndCursor(null);

    // If we have place details from autocomplete, pre-set the map center
    // so the map appears instantly while the search request is in flight
    if (placeDetails) {
      setCenterLat(placeDetails.lat);
      setCenterLng(placeDetails.lng);
      setSearchRadiusKm(radiusKm);
    } else {
      setCenterLat(null);
      setCenterLng(null);
      setSearchRadiusKm(null);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await Promise.race([
        fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address,
            radiusKm,
            businessType,
            ...(placeDetails && {
              placeId: placeDetails.placeId,
              lat: placeDetails.lat,
              lng: placeDetails.lng,
            }),
          }),
          signal: controller.signal,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out')), 30000)
        ),
      ]);

      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Search failed');
      }

      const data = await res.json();
      // Server already sorts by distance (closest first)
      const list: Competitor[] = data.competitors ?? [];
      setCompetitors(list);
      setFreshaDebug(data.freshaDebug ?? null);
      setHasNextPage(data.pageInfo?.hasNextPage ?? false);
      setEndCursor(data.pageInfo?.endCursor ?? null);
      if (typeof data.centerLat === 'number') setCenterLat(data.centerLat);
      if (typeof data.centerLng === 'number') setCenterLng(data.centerLng);
      if (typeof data.radiusKm === 'number') setSearchRadiusKm(data.radiusKm);

      // Fetch menus in background via bulk-services endpoint
      if (list.length > 0) {
        const ids = list.map((c) => c.id);
        setFetchingMenus(true);
        fetch('/api/competitors/bulk-services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ competitorIds: ids }),
        })
          .then((r) => r.json())
          .then((bulkData) => {
            setServicesByCompetitor(bulkData.servicesByCompetitor ?? {});
            setLastUpdated(bulkData.lastUpdated ?? {});
            setIsStale(bulkData.isStale ?? {});
          })
          .catch((err) => {
            console.warn('Bulk services fetch failed:', err);
          })
          .finally(() => setFetchingMenus(false));
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleFetchMore = async () => {
    if (!endCursor || isFetchingMore) return;
    setIsFetchingMore(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await Promise.race([
        fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address,
            radiusKm,
            businessType,
            ...(placeDetails && {
              placeId: placeDetails.placeId,
              lat: placeDetails.lat,
              lng: placeDetails.lng,
            }),
            after: endCursor,
          }),
          signal: controller.signal,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out')), 30000)
        ),
      ]);

      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Fetch more failed');
      }

      const data = await res.json();
      const newCompetitors: Competitor[] = data.competitors ?? [];
      setCompetitors((prev) => [...(prev ?? []), ...newCompetitors]);
      setFreshaDebug(data.freshaDebug ?? null);
      setHasNextPage(data.pageInfo?.hasNextPage ?? false);
      setEndCursor(data.pageInfo?.endCursor ?? null);

      // Fetch menus in background for newly loaded competitors
      if (newCompetitors.length > 0) {
        const ids = newCompetitors.map((c) => c.id);
        setFetchingMenus(true);
        fetch('/api/competitors/bulk-services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ competitorIds: ids }),
        })
          .then((r) => r.json())
          .then((bulkData) => {
            setServicesByCompetitor((prev) => ({
              ...prev,
              ...(bulkData.servicesByCompetitor ?? {}),
            }));
            setLastUpdated((prev) => ({
              ...prev,
              ...(bulkData.lastUpdated ?? {}),
            }));
            setIsStale((prev) => ({
              ...prev,
              ...(bulkData.isStale ?? {}),
            }));
          })
          .catch((err) => {
            console.warn('Bulk services fetch failed:', err);
          })
          .finally(() => setFetchingMenus(false));
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsFetchingMore(false);
    }
  };

  const handleAnalyzeMenu = async () => {
    if (userMenuItems.length === 0) {
      setError('Add some menu items first before analyzing.');
      return;
    }
    if (!competitors || competitors.length === 0) {
      setError('Search for competitors first before analyzing your menu.');
      return;
    }
    const serviceCount = Object.values(servicesByCompetitor).flat().length;
    if (serviceCount === 0) {
      setError('Competitor menus are still loading. Please wait a moment and try again.');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setMatchResults(null);

    try {
      const res = await fetch('/api/user-menu/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMenuItems,
          competitorServices: servicesByCompetitor,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Analysis failed');
      }
      const data = await res.json();
      const results = data.results ?? [];
      // Warn if nothing matched
      const totalMatches = results.reduce((sum: number, r: { prices: number[] }) => sum + r.prices.length, 0);
      if (totalMatches === 0) {
        setError('No competitor services matched your menu items. Try adding more generic names (e.g. "Manicure" instead of "Classic Manicure").');
      }
      setMatchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <section className="flex-1 p-4 lg:p-6 w-full">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Competitor Pricing
      </h1>

      {/* Search Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Search Competitors</CardTitle>
          <CardDescription>
            Enter an address to find nearby competitors and compare pricing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <AddressAutocomplete
                  value={address}
                  onChange={setAddress}
                  onPlaceSelect={(place) => {
                    console.log('[PricingPage] place selected:', place);
                    setAddress(place.address);
                    setPlaceDetails({
                      placeId: place.placeId,
                      lat: place.lat,
                      lng: place.lng,
                    });
                  }}
                  placeholder="e.g. 123 Main St, New York, NY"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="radius">Radius (km)</Label>
                <select
                  id="radius"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                >
                  {radiusOptions.map((r) => (
                    <option key={r} value={r}>
                      {r} km
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessType">Business Type</Label>
                <select
                  id="businessType"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                >
                  {businessTypeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching…
                  </>
                ) : (
                  'Search Competitors'
                )}
              </Button>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
          </form>

          {/* Dev-only: Fresha debug panel */}
          {process.env.NODE_ENV === 'development' && freshaDebug && (
            <div className="mt-4 border rounded-md bg-gray-50 space-y-3">
              {freshaDebug.request && (
                <details className="group">
                  <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 flex items-center justify-between">
                    <span>🔧 Fresha Debug — Search Request</span>
                    <span className="text-xs text-gray-400">{String(freshaDebug.request?.variables?.placeId ?? '—')}</span>
                  </summary>
                  <div className="px-4 pb-4 space-y-3 text-xs font-mono">
                    <div>
                      <p className="font-semibold text-gray-600 mb-1">Endpoint:</p>
                      <code className="block bg-white border rounded px-2 py-1 break-all">{freshaDebug.request?.endpoint ?? '—'}</code>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-600 mb-1">Headers:</p>
                      <pre className="bg-white border rounded px-2 py-1 overflow-auto max-h-40">{JSON.stringify(freshaDebug.request?.headers ?? {}, null, 2)}</pre>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-600 mb-1">Variables:</p>
                      <pre className="bg-white border rounded px-2 py-1 overflow-auto max-h-40">{JSON.stringify(freshaDebug.request?.variables ?? {}, null, 2)}</pre>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-600 mb-1">Full Body:</p>
                      <pre className="bg-white border rounded px-2 py-1 overflow-auto max-h-60">{freshaDebug.request?.body ?? '—'}</pre>
                    </div>
                  </div>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Chatbot */}
      {competitors && competitors.length > 0 && (
        <CompetitorChatbot
          competitors={competitors}
          servicesByCompetitor={servicesByCompetitor}
          userMenuItems={userMenuItems}
          businessType={businessType}
          address={address}
        />
      )}

      {/* Results */}
      {competitors && competitors.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center text-center py-12">
          <MapPin className="h-12 w-12 text-orange-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No competitors found
          </h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Try a larger radius or a different area.
          </p>
        </div>
      )}

      {/* Map — appears immediately when search starts, even during loading */}
      {centerLat != null && centerLng != null && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4 text-orange-500" />
              Competitor Locations
              {loading && (
                <span className="text-xs text-orange-500 flex items-center gap-1 ml-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Discovering salons…
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 relative">
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b flex-wrap">
              <span className="text-xs text-muted-foreground">Map view:</span>
              <select
                value={mapMode}
                onChange={(e) => {
                  const newMode = e.target.value as MapVisualizationMode;
                  setMapTransitioning(true);
                  setMapMode(newMode);
                  setTimeout(() => setMapTransitioning(false), 400);
                }}
                className="h-7 text-xs rounded-md border border-input bg-white px-2 py-0.5 outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="reputation">Reputation (reviews)</option>
                <option value="pricing">Pricing</option>
                <option value="popularity">Popularity (reviews × rating)</option>
              </select>

              {mapMode === 'pricing' && (
                <>
                  <span className="text-xs text-muted-foreground">Service:</span>
                  <select
                    value={pricingServiceName}
                    onChange={(e) => {
                      setMapTransitioning(true);
                      setPricingServiceName(e.target.value);
                      setTimeout(() => setMapTransitioning(false), 400);
                    }}
                    className="h-7 text-xs rounded-md border border-input bg-white px-2 py-0.5 outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Average price (all services)</option>
                    {Array.from(new Set(Object.values(servicesByCompetitor).flat().map((s) => s.name))).sort().map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </>
              )}
            </div>

            <div className={`relative transition-opacity duration-300 ${mapTransitioning ? 'opacity-50' : 'opacity-100'}`}>
              <CompetitorMap
                competitors={competitors ?? []}
                centerLat={centerLat}
                centerLng={centerLng}
                radiusKm={searchRadiusKm}
                servicesByCompetitor={servicesByCompetitor}
                mode={mapMode}
                pricingServiceName={pricingServiceName || null}
              />
              {mapTransitioning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg px-4 py-2 shadow-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                    <span className="text-sm text-gray-700">Updating map…</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {competitors && competitors.length > 0 && (
        <div className="space-y-6">
          {/* Analytics Summary */}
          <AnalyticsSummary
            competitors={competitors}
            servicesByCompetitor={servicesByCompetitor}
          />

          {/* Menu Import */}
          <MenuImport onItemsChange={setUserMenuItems} />

          {/* Analyze My Menu */}
          <div className="flex items-center gap-4">
            <Button
              onClick={handleAnalyzeMenu}
              disabled={analyzing}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {analyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                'Analyze My Menu'
              )}
            </Button>
          </div>

          {/* Percentile Charts */}
          {matchResults && matchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matchResults.map((result) => (
                <Card key={result.item.id}>
                  <CardContent className="pt-6">
                    <PercentileChart
                      userPrice={
                        typeof result.item.price === 'string'
                          ? parseFloat(result.item.price)
                          : Number(result.item.price)
                      }
                      competitorPrices={result.prices}
                      itemName={result.item.name}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Results table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found {filteredCompetitors.length} competitor
                {filteredCompetitors.length !== 1 ? 's' : ''} — sorted by distance
              </p>
              {fetchingMenus && (
                <p className="text-sm text-orange-500 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Fetching menus…
                </p>
              )}
            </div>

            {/* Source filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Source:</span>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as 'all' | 'fresha' | 'google' | 'both')}
                className="h-8 text-sm rounded-md border border-input bg-white px-2 py-0.5 outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">All</option>
                <option value="fresha">Fresha</option>
                <option value="google">Google</option>
                <option value="both">Fresha + Google</option>
              </select>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm bg-white rounded-xl border shadow-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-muted-foreground bg-gray-50">
                    <th className="py-3 px-4 font-medium">DB ID</th>
                    <th className="py-3 px-4 font-medium">Name</th>
                    <th className="py-3 px-4 font-medium">Source</th>
                    <th className="py-3 px-4 font-medium">Rating</th>
                    <th className="py-3 px-4 font-medium">Reviews</th>
                    <th className="py-3 px-4 font-medium">Address</th>
                    <th className="py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompetitors.map((c) => (
                    <Fragment key={c.id}>
                      <tr
                        id={`competitor-row-${c.id}`}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{c.id}</td>
                        <td className="py-3 px-4 font-medium">{c.name}</td>
                        <td className="py-3 px-4">{sourceBadge(c.source)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <Star className="h-4 w-4 text-orange-500 fill-orange-500 mr-1" />
                            <span>{c.rating ?? '—'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {c.reviewsCount?.toLocaleString() ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                          {[c.address, c.city].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setExpandedId(expandedId === c.id ? null : c.id)
                            }
                          >
                            {expandedId === c.id ? (
                              <>
                                <ChevronUp className="mr-1 h-4 w-4" />
                                Hide
                              </>
                            ) : (
                              <>
                                <ChevronDown className="mr-1 h-4 w-4" />
                                View Services
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                      {expandedId === c.id && (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="px-4 py-4">
                            <CompetitorServices competitorId={c.id} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden grid grid-cols-1 gap-4">
              {filteredCompetitors.map((c) => (
                <Card key={c.id} id={`competitor-row-${c.id}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{c.name}</p>
                        <p className="text-xs font-mono text-muted-foreground">DB ID: {c.id}</p>
                        <div className="flex items-center mt-1 gap-2">
                          {sourceBadge(c.source)}
                        </div>
                        <div className="flex items-center mt-1 text-sm text-muted-foreground">
                          <Star className="h-3.5 w-3.5 text-orange-500 fill-orange-500 mr-1" />
                          <span>{c.rating ?? '—'}</span>
                          <span className="mx-1">·</span>
                          <span>{c.reviewsCount?.toLocaleString() ?? '—'} reviews</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {[c.address, c.city].filter(Boolean).join(', ') || '—'}
                    </div>
                    {lastUpdated[c.id] && (
                      <div className={`text-xs ${isStale[c.id] ? 'text-orange-500' : 'text-green-600'}`}>
                        Updated {formatRelativeTime(lastUpdated[c.id]!)}
                        {isStale[c.id] && ' · stale'}
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 mr-1" />
                        {c.phone}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        setExpandedId(expandedId === c.id ? null : c.id)
                      }
                    >
                      {expandedId === c.id ? (
                        <>
                          <ChevronUp className="mr-1 h-4 w-4" />
                          Hide Services
                        </>
                      ) : (
                        <>
                          <ChevronDown className="mr-1 h-4 w-4" />
                          View Services
                        </>
                      )}
                    </Button>
                    {expandedId === c.id && (
                      <div className="pt-2 border-t border-gray-100">
                        <CompetitorServices competitorId={c.id} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {hasNextPage && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleFetchMore}
                  disabled={isFetchingMore}
                  variant="outline"
                  className="min-w-[160px]"
                >
                  {isFetchingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fetching…
                    </>
                  ) : (
                    'Fetch More'
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

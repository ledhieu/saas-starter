'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
// Textarea not in shadcn yet — using native textarea below
import { Loader2, Terminal, AlertTriangle } from 'lucide-react';
import useSWR from 'swr';
import { User } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());
async function probeFresha(body: object) {
  const res = await fetch('/api/admin/probe/fresha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

function JsonBlock({ data }: { data: any }) {
  return (
    <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-auto max-h-[400px] font-mono">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function ProbeCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-orange-500" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export default function GraphQLProbePage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);

  // ---- Probe 1: geolocation.locations ----
  const [placeId, setPlaceId] = useState('ChIJs0-pQ_FzhlQRi_OBm-qWkbs');
  const [locQuery, setLocQuery] = useState('nail salon');
  const [locFirst, setLocFirst] = useState('10');
  const [locAfter, setLocAfter] = useState('');
  const [locResult, setLocResult] = useState<any>(null);
  const [locLoading, setLocLoading] = useState(false);

  // ---- Probe 2: geolocation.search ----
  const [searchQuery, setSearchQuery] = useState('nail salon');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // ---- Probe 3: location by slug ----
  const [slug, setSlug] = useState('mood-nail-bar-vancouver-337-east-broadway-nch13fdn');
  const [slugResult, setSlugResult] = useState<any>(null);
  const [slugLoading, setSlugLoading] = useState(false);

  // ---- Probe 4: geolocation (IP-based) ----
  const [geoResult, setGeoResult] = useState<any>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // ---- Probe 5: raw query ----
  const [rawQuery, setRawQuery] = useState(
    'query {\n  geolocation {\n    id\n    latitude\n    longitude\n  }\n}'
  );
  const [rawResult, setRawResult] = useState<any>(null);
  const [rawLoading, setRawLoading] = useState(false);

  const runLocations = async () => {
    setLocLoading(true);
    const variables: Record<string, unknown> = {
      placeId,
      query: locQuery,
      first: parseInt(locFirst, 10) || 10,
    };
    if (locAfter.trim()) variables.after = locAfter.trim();
    const result = await probeFresha({
      query: `
        query SearchLocations($placeId: ID!, $query: String!, $first: Int!, $after: ID) {
          geolocation(placeId: $placeId) {
            locations(query: $query, first: $first, after: $after) {
              edges { node { id name slug rating reviewsCount address { shortFormatted cityName latitude longitude } } }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      `,
      variables,
    });
    setLocResult(result);
    setLocLoading(false);
  };

  const runSearch = async () => {
    setSearchLoading(true);
    const result = await probeFresha({
      query: `
        query {
          geolocation {
            search(query: "${searchQuery}") {
              edges { node { ... on Location { id name slug } } }
            }
          }
        }
      `,
    });
    setSearchResult(result);
    setSearchLoading(false);
  };

  const runSlug = async () => {
    setSlugLoading(true);
    const result = await probeFresha({
      query: `
        query {
          location(slug: "${slug}") {
            id name slug rating reviewsCount contactNumber
            address { shortFormatted cityName latitude longitude }
          }
        }
      `,
    });
    setSlugResult(result);
    setSlugLoading(false);
  };

  const runGeo = async () => {
    setGeoLoading(true);
    const result = await probeFresha({
      query: `
        query {
          geolocation {
            id
            latitude
            longitude
            locations(first: 5) {
              edges { node { id name slug } }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      `,
    });
    setGeoResult(result);
    setGeoLoading(false);
  };

  const runRaw = async () => {
    setRawLoading(true);
    const result = await probeFresha({ query: rawQuery });
    setRawResult(result);
    setRawLoading(false);
  };

  if (user && user.role !== 'owner') {
    return (
      <section className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 text-red-600 bg-red-50 p-4 rounded-lg">
          <AlertTriangle className="h-6 w-6" />
          <div>
            <p className="font-medium">Access Denied</p>
            <p className="text-sm">This page is restricted to admin/owner users only.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-2">
        GraphQL Endpoint Probe
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Interactive explorer for the reverse-engineered Fresha GraphQL endpoints.
        All requests go directly to <code className="bg-gray-100 px-1 rounded">fresha.com/graphql</code>.
      </p>

      {/* Discovered Schema */}
      <ProbeCard
        title="Discovered Schema"
        description="Fields and types uncovered via suggestion probing"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="font-semibold text-gray-900 mb-1">Query.root</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li><code>geolocation(placeId?)</code> → <code>Geolocation</code></li>
              <li><code>location(slug: String!)</code> → <code>Location</code></li>
              <li><code>liteLocation(slug: String!)</code> → <code>Location</code></li>
              <li><code>locations(ids: [ID!]!)</code> → <code>LocationConnection</code></li>
              <li><code>category(id: ID!)</code> → <code>Category</code></li>
              <li><code>viewer</code> → <code>Viewer</code></li>
              <li><code>user</code> → <code>User</code></li>
            </ul>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="font-semibold text-gray-900 mb-1">Geolocation fields</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li><code>id</code> → <code>"lat,lng"</code></li>
              <li><code>latitude</code>, <code>longitude</code></li>
              <li><code>locations(query?, first?, after?)</code> → <code>LocationSearchConnection</code></li>
              <li><code>search(query: String!)</code> → <code>SearchConnection</code></li>
            </ul>
            <p className="font-semibold text-gray-900 mt-2 mb-1">LocationSearchConnection</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li><code>{"edges { node { id name slug rating reviewsCount contactNumber description address {...} } }"}</code></li>
              <li><code>{"pageInfo { hasNextPage endCursor }"}</code></li>
            </ul>
          </div>
        </div>
        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
          <strong>⚠️ Do not use <code>distance</code></strong> — it breaks location filtering and returns global results.
        </div>
      </ProbeCard>

      {/* Probe 1: geolocation.locations */}
      <ProbeCard
        title="Probe: geolocation.locations"
        description="Native Fresha search by Google Place ID + keyword"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="placeId">Google Place ID</Label>
            <Input
              id="placeId"
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              placeholder="ChIJs0-pQ_FzhlQRi_OBm-qWkbs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="locQuery">Keyword</Label>
            <Input
              id="locQuery"
              value={locQuery}
              onChange={(e) => setLocQuery(e.target.value)}
              placeholder="nail salon"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="locFirst">First (page size)</Label>
            <Input
              id="locFirst"
              type="number"
              value={locFirst}
              onChange={(e) => setLocFirst(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="locAfter">After (cursor)</Label>
            <Input
              id="locAfter"
              value={locAfter}
              onChange={(e) => setLocAfter(e.target.value)}
              placeholder="optional pagination cursor"
            />
          </div>
        </div>
        <Button
          onClick={runLocations}
          disabled={locLoading}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {locLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Probing…
            </>
          ) : (
            'Run Probe'
          )}
        </Button>
        {locResult && <JsonBlock data={locResult} />}
      </ProbeCard>

      {/* Probe 2: geolocation.search */}
      <ProbeCard
        title="Probe: geolocation.search"
        description="Text search returning mixed result types (Location, Category, etc.)"
      >
        <div className="space-y-2 max-w-md">
          <Label htmlFor="searchQuery">Query</Label>
          <Input
            id="searchQuery"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="nail salon"
          />
        </div>
        <Button
          onClick={runSearch}
          disabled={searchLoading}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {searchLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Probing…
            </>
          ) : (
            'Run Probe'
          )}
        </Button>
        {searchResult && <JsonBlock data={searchResult} />}
      </ProbeCard>

      {/* Probe 3: location by slug */}
      <ProbeCard
        title="Probe: location(slug:)"
        description="Fetch a single salon by its Fresha slug"
      >
        <div className="space-y-2 max-w-md">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="mood-nail-bar-vancouver-..."
          />
        </div>
        <Button
          onClick={runSlug}
          disabled={slugLoading}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {slugLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Probing…
            </>
          ) : (
            'Run Probe'
          )}
        </Button>
        {slugResult && <JsonBlock data={slugResult} />}
      </ProbeCard>

      {/* Probe 4: geolocation (IP-based) */}
      <ProbeCard
        title="Probe: geolocation (IP-based)"
        description="Returns the server's inferred location + nearby salons"
      >
        <Button
          onClick={runGeo}
          disabled={geoLoading}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {geoLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Probing…
            </>
          ) : (
            'Run Probe'
          )}
        </Button>
        {geoResult && <JsonBlock data={geoResult} />}
      </ProbeCard>

      {/* Probe 5: Raw Query */}
      <ProbeCard
        title="Probe: Raw GraphQL Query"
        description="Send any query directly to Fresha's GraphQL endpoint"
      >
        <div className="space-y-2">
          <Label htmlFor="rawQuery">Query</Label>
          <textarea
            id="rawQuery"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            rows={8}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <Button
          onClick={runRaw}
          disabled={rawLoading}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {rawLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Probing…
            </>
          ) : (
            'Run Probe'
          )}
        </Button>
        {rawResult && <JsonBlock data={rawResult} />}
      </ProbeCard>
    </section>
  );
}

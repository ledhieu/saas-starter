'use client';

import { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Competitor {
  id: number;
  name: string;
  rating: string | null;
  reviewsCount: number | null;
}

interface Service {
  competitorId: number;
  name: string;
  priceFormatted: string | null;
  priceValueMin: number | null;
}

interface SkyscraperChartProps {
  competitors: Competitor[];
  servicesByCompetitor: Record<number, Service[]>;
}

type ViewMode = 'price' | 'popularity';

function popularityScore(reviewsCount: number | null, rating: string | null): number {
  const reviews = reviewsCount ?? 0;
  const r = parseFloat(rating ?? '0');
  const stars = Number.isNaN(r) ? 0 : r;
  // Volume-weighted quality: more reviews with good rating = higher score
  return reviews * Math.max(0.1, stars / 5);
}

function lerpColor(t: number): string {
  // t: 0 → 1, interpolate from light blue to deep orange-red
  // Low popularity = lighter, high = darker/more intense
  const r = Math.round(147 + (239 - 147) * t);
  const g = Math.round(197 + (68 - 197) * t);
  const b = Math.round(253 + (68 - 253) * t);
  return `rgba(${r}, ${g}, ${b}, 0.85)`;
}

export default function SkyscraperChart({
  competitors,
  servicesByCompetitor,
}: SkyscraperChartProps) {
  const [selectedService, setSelectedService] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('price');

  // Extract all unique service names
  const serviceNames = useMemo(() => {
    const names = new Set<string>();
    Object.values(servicesByCompetitor).forEach((svcs) => {
      svcs.forEach((s) => names.add(s.name));
    });
    return Array.from(names).sort();
  }, [servicesByCompetitor]);

  // Build dataset for selected service
  const { chartData, yAxisLabel } = useMemo(() => {
    if (!selectedService) {
      return { chartData: null, yAxisLabel: '' };
    }

    // Gather competitors that offer this service
    const rows: {
      competitor: Competitor;
      service: Service;
      price: number;
      popularity: number;
    }[] = [];

    for (const c of competitors) {
      const svcs = servicesByCompetitor[c.id] || [];
      const svc = svcs.find((s) => s.name === selectedService);
      if (svc && svc.priceValueMin != null && svc.priceValueMin > 0) {
        rows.push({
          competitor: c,
          service: svc,
          price: svc.priceValueMin,
          popularity: popularityScore(c.reviewsCount, c.rating),
        });
      }
    }

    if (rows.length === 0) {
      return { chartData: null, yAxisLabel: '' };
    }

    // Sort based on view mode
    if (viewMode === 'price') {
      rows.sort((a, b) => b.price - a.price);
    } else {
      rows.sort((a, b) => b.popularity - a.popularity);
    }

    const maxPop = Math.max(...rows.map((r) => r.popularity), 1);

    const labels = rows.map((r) => r.competitor.name);
    const data = rows.map((r) => (viewMode === 'price' ? r.price : r.popularity));
    const backgroundColors = rows.map((r) =>
      viewMode === 'price'
        ? lerpColor(r.popularity / maxPop)
        : lerpColor(0.3 + 0.7 * (r.popularity / maxPop))
    );

    return {
      chartData: {
        labels,
        datasets: [
          {
            type: 'bar' as const,
            label: viewMode === 'price' ? 'Price ($)' : 'Popularity Score',
            data,
            backgroundColor: backgroundColors,
            borderColor: backgroundColors.map((c) => c.replace('0.85', '1')),
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      yAxisLabel: viewMode === 'price' ? 'Price ($)' : 'Popularity Score',
    };
  }, [selectedService, viewMode, competitors, servicesByCompetitor]);

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'x',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => {
            const idx = items[0].dataIndex;
            return chartData?.labels[idx] ?? '';
          },
          label: (item) => {
            if (viewMode === 'price') {
              return `Price: $${item.raw}`;
            }
            return `Popularity: ${Number(item.raw).toFixed(0)}`;
          },
          afterBody: (items) => {
            const idx = items[0].dataIndex;
            const name = chartData?.labels[idx];
            const c = competitors.find((x) => x.name === name);
            if (!c) return '';
            return `⭐ ${c.rating ?? '—'} · ${c.reviewsCount ?? 0} reviews`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 60,
          minRotation: 45,
          font: { size: 10 },
        },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: yAxisLabel,
        },
        ticks: {
          callback: (val) =>
            viewMode === 'price' ? `$${val}` : Number(val).toFixed(0),
        },
      },
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <select
          value={selectedService}
          onChange={(e) => setSelectedService(e.target.value)}
          className="flex h-9 w-full sm:w-72 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        >
          <option value="">Select a service…</option>
          {serviceNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('price')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'price'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Price Skyscraper
          </button>
          <button
            onClick={() => setViewMode('popularity')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'popularity'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Popularity
          </button>
        </div>
      </div>

      {selectedService && chartData ? (
        <div className="h-80 w-full">
          <Chart type="bar" data={chartData} options={options} />
        </div>
      ) : selectedService ? (
        <p className="text-sm text-muted-foreground py-4">
          No competitors offer <strong>{selectedService}</strong> with a known price.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground py-4">
          Choose a service above to see the price skyscraper and popularity index across competitors.
        </p>
      )}
    </div>
  );
}

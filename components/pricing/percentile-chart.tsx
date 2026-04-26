'use client';

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineController,
  LineElement,
  PointElement,
  ChartOptions,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineController,
  LineElement,
  PointElement
);

interface PercentileChartProps {
  userPrice: number;
  competitorPrices: number[];
  itemName: string;
}

export default function PercentileChart({
  userPrice,
  competitorPrices,
  itemName,
}: PercentileChartProps) {
  const { bins, labels, userBinIndex, percentile } = useMemo(() => {
    if (competitorPrices.length === 0) {
      return { bins: [], labels: [], userBinIndex: -1, percentile: null };
    }

    const min = Math.min(...competitorPrices);
    const max = Math.max(...competitorPrices);
    const range = max - min || 1;
    const binCount = Math.min(10, competitorPrices.length);
    const binWidth = range / binCount;

    const bins = new Array(binCount).fill(0);
    competitorPrices.forEach((p) => {
      const idx = Math.min(Math.floor((p - min) / binWidth), binCount - 1);
      bins[idx]++;
    });

    const labels = bins.map((_, i) => {
      const lower = min + i * binWidth;
      const upper = min + (i + 1) * binWidth;
      return `$${lower.toFixed(0)}–$${upper.toFixed(0)}`;
    });

    const userBinIndex = Math.min(
      Math.floor((userPrice - min) / binWidth),
      binCount - 1
    );

    const percentile =
      (competitorPrices.filter((p) => p < userPrice).length /
        competitorPrices.length) *
      100;

    return { bins, labels, userBinIndex, percentile };
  }, [competitorPrices, userPrice]);

  if (competitorPrices.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No competitor prices available for <strong>{itemName}</strong>.
      </div>
    );
  }

  const data: any = {
    labels,
    datasets: [
      {
        type: 'bar' as const,
        label: 'Competitor prices',
        data: bins,
        backgroundColor: 'rgba(249, 115, 22, 0.5)',
        borderColor: 'rgba(249, 115, 22, 1)',
        borderWidth: 1,
        barPercentage: 0.9,
        categoryPercentage: 0.9,
      },
      {
        type: 'line' as const,
        label: 'Your price',
        data: labels.map((_, i) => (i === userBinIndex ? Math.max(...bins) : 0)),
        borderColor: '#ef4444',
        backgroundColor: '#ef4444',
        borderWidth: 2,
        pointRadius: labels.map((_, i) => (i === userBinIndex ? 6 : 0)),
        pointHoverRadius: 8,
        tension: 0,
        fill: false,
      },
    ],
  };

  const options: ChartOptions<'bar' | 'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            const idx = items[0].dataIndex;
            if (items[0].dataset.type === 'line' && idx === userBinIndex) {
              return `Your price: $${userPrice.toFixed(2)}`;
            }
            return labels[idx];
          },
          label: (item) => {
            if (item.dataset.type === 'line' && item.dataIndex === userBinIndex) {
              return `Your price`;
            }
            return `${item.formattedValue} competitors`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-900">{itemName}</p>
      <div className="h-48">
        <Chart type="bar" data={data} options={options} />
      </div>
      {percentile !== null && (
        <p className="text-xs text-muted-foreground">
          Your price is at the <strong>{percentile.toFixed(0)}th percentile</strong>{' '}
          ({competitorPrices.length} matched competitor
          {competitorPrices.length !== 1 ? 's' : ''})
        </p>
      )}
    </div>
  );
}

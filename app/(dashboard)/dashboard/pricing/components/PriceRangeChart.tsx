'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

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

type Props = {
  servicesByCompetitor: Record<number, Service[]>;
};

export default function PriceRangeChart({ servicesByCompetitor }: Props) {
  const allServices = Object.values(servicesByCompetitor).flat();

  const categoryMap: Record<string, number[]> = {};
  for (const service of allServices) {
    if (service.priceValueMin == null) continue;
    const cat = service.categoryName ?? 'Uncategorized';
    if (!categoryMap[cat]) categoryMap[cat] = [];
    categoryMap[cat].push(service.priceValueMin);
  }

  const labels = Object.keys(categoryMap).sort();
  const minData = labels.map((cat) => Math.min(...categoryMap[cat]));
  const avgData = labels.map(
    (cat) =>
      categoryMap[cat].reduce((a, b) => a + b, 0) / categoryMap[cat].length
  );
  const maxData = labels.map((cat) => Math.max(...categoryMap[cat]));

  const data = {
    labels,
    datasets: [
      {
        label: 'Min',
        data: minData,
        backgroundColor: 'rgba(156, 163, 175, 0.7)',
        borderColor: 'rgba(156, 163, 175, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Avg',
        data: avgData,
        backgroundColor: 'rgba(249, 115, 22, 0.7)',
        borderColor: 'rgba(249, 115, 22, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Max',
        data: maxData,
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { color: '#374151', usePointStyle: true },
      },
      title: {
        display: true,
        text: 'Price Range by Category',
        color: '#111827',
        font: { size: 14, weight: 'bold' as const },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => `$${value}`,
          color: '#6b7280',
        },
        grid: { color: '#f3f4f6' },
      },
      x: {
        ticks: { color: '#6b7280' },
        grid: { display: false },
      },
    },
  };

  return (
    <div className="h-64 w-full">
      <Bar data={data} options={options} />
    </div>
  );
}

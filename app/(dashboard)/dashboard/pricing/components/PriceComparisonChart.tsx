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

export default function PriceComparisonChart({ servicesByCompetitor }: Props) {
  const allServices = Object.values(servicesByCompetitor).flat();

  const categoryMap: Record<string, number[]> = {};
  for (const service of allServices) {
    if (service.priceValueMin == null) continue;
    const cat = service.categoryName ?? 'Uncategorized';
    if (!categoryMap[cat]) categoryMap[cat] = [];
    categoryMap[cat].push(service.priceValueMin);
  }

  const labels = Object.keys(categoryMap).sort();
  const dataValues = labels.map((cat) => {
    const prices = categoryMap[cat];
    return prices.reduce((a, b) => a + b, 0) / prices.length;
  });

  const data = {
    labels,
    datasets: [
      {
        label: 'Average Price ($)',
        data: dataValues,
        backgroundColor: 'rgba(249, 115, 22, 0.7)',
        borderColor: 'rgba(249, 115, 22, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Average Price by Category',
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

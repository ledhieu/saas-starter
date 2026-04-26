'use client';

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

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
};

export default function RatingDistributionChart({ competitors }: Props) {
  const buckets = [5, 4, 3, 2, 1];
  const counts = buckets.map((bucket) =>
    competitors.filter((c) => {
      if (c.rating == null) return false;
      const r = parseFloat(c.rating);
      return Math.round(r) === bucket;
    }).length
  );

  const data = {
    labels: buckets.map((b) => `${b}★`),
    datasets: [
      {
        data: counts,
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',   // 5★ green
          'rgba(132, 204, 22, 0.8)',  // 4★ lime
          'rgba(250, 204, 21, 0.8)',  // 3★ yellow
          'rgba(249, 115, 22, 0.8)',  // 2★ orange
          'rgba(239, 68, 68, 0.8)',   // 1★ red
        ],
        borderColor: '#ffffff',
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: { color: '#374151', usePointStyle: true },
      },
      title: {
        display: true,
        text: 'Rating Distribution',
        color: '#111827',
        font: { size: 14, weight: 'bold' as const },
      },
    },
  };

  return (
    <div className="h-64 w-full">
      <Doughnut data={data} options={options} />
    </div>
  );
}

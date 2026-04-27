import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

interface Service {
  id: number;
  competitorId: number;
  categoryName: string | null;
  name: string;
  durationCaption: string | null;
  priceFormatted: string | null;
  priceValueMin: number | null;
  priceValueMax: number | null;
}

interface UserMenuItem {
  id: number;
  userId: number;
  name: string;
  price: number;
  duration: number | null;
  createdAt: Date;
}

interface MatchResult {
  item: UserMenuItem;
  matchedServices: Service[];
  prices: number[];
  percentile: number | null;
}

const stopWords = new Set(['and', 'with', 'the', 'for', 'a', 'an', 'of', 'in', 'to', 'by']);
const serviceNoise = new Set(['service', 'services', 'treatment', 'treatments', 'session', 'sessions', 'pkg', 'package']);

function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w) && !serviceNoise.has(w));
}

function similarity(a: string, b: string): number {
  const tokensA = new Set(normalize(a));
  const tokensB = new Set(normalize(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  const intersection = [...tokensA].filter((x) => tokensB.has(x)).length;
  return intersection / Math.max(tokensA.size, tokensB.size);
}

function containsEitherWay(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/[^a-z0-9]/g, '');
  const nb = b.toLowerCase().replace(/[^a-z0-9]/g, '');
  return na.includes(nb) || nb.includes(na);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userMenuItems, competitorServices } = body as {
      userMenuItems: UserMenuItem[];
      competitorServices: Record<number, Service[]>;
    };

    if (!Array.isArray(userMenuItems) || !competitorServices) {
      return NextResponse.json(
        { error: 'userMenuItems and competitorServices are required' },
        { status: 400 }
      );
    }

    const allServices = Object.values(competitorServices).flat();

    const results: MatchResult[] = userMenuItems.map((item) => {
      const matchedServices = allServices.filter(
        (service) =>
          service.name != null &&
          (similarity(item.name, service.name) > 0.15 || containsEitherWay(item.name, service.name))
      );

      const prices = matchedServices
        .map((s) => s.priceValueMin)
        .filter((p): p is number => p != null)
        .sort((a, b) => a - b);

      const userPrice =
        typeof item.price === 'string' ? parseFloat(item.price) : Number(item.price);

      const percentile =
        prices.length > 0
          ? (prices.filter((p) => p < userPrice).length / prices.length) * 100
          : null;

      return {
        item,
        matchedServices,
        prices,
        percentile,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('User menu match error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

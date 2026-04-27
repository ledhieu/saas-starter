import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CompetitorSummary {
  name: string;
  rating: string | null;
  reviews: number | null;
  avgPrice: number | null;
  serviceCount: number;
  topServices: Array<{ name: string; price: string | null }>;
}

interface MarketSummary {
  competitorCount: number;
  totalServices: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Add OPENAI_API_KEY to your .env file.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { message, history, context } = body as {
      message: string;
      history: ChatMessage[];
      context: {
        businessType: string;
        address: string;
        competitors: CompetitorSummary[];
        userMenu: Array<{ name: string; price: number }>;
        marketSummary: MarketSummary;
      };
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(context);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { error: errorData.error?.message || 'OpenAI API error' },
        { status: 502 }
      );
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || 'No response from AI.';

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Chat analytics error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildSystemPrompt(context: {
  businessType: string;
  address: string;
  competitors: CompetitorSummary[];
  userMenu: Array<{ name: string; price: number }>;
  marketSummary: MarketSummary;
}): string {
  const { businessType, address, competitors, userMenu, marketSummary } = context;

  const competitorLines = competitors
    .map((c) => {
      const priceLine = c.avgPrice != null ? `avg $${c.avgPrice}` : 'no prices';
      const servicesLine =
        c.topServices.length > 0
          ? `top: ${c.topServices.map((s) => `${s.name}${s.price ? ` (${s.price})` : ''}`).join(', ')}`
          : '';
      return `- ${c.name}: ⭐ ${c.rating ?? '—'} (${c.reviews ?? 0} reviews), ${priceLine}${servicesLine ? `, ${servicesLine}` : ''}`;
    })
    .join('\n');

  const menuLines =
    userMenu.length > 0
      ? userMenu.map((i) => `- ${i.name}: $${i.price}`).join('\n')
      : 'No menu items added yet.';

  return `You are a competitive pricing analyst for ${businessType} businesses. You help owners understand their local market and optimize their pricing.

Search area: ${address}
Competitors analyzed: ${marketSummary.competitorCount}
Market overview:
- Total competitor services: ${marketSummary.totalServices}
- Market average price: ${marketSummary.avgPrice != null ? `$${marketSummary.avgPrice}` : 'N/A'}
- Price range: ${marketSummary.minPrice != null && marketSummary.maxPrice != null ? `$${marketSummary.minPrice} – $${marketSummary.maxPrice}` : 'N/A'}

Competitors:
${competitorLines}

User's menu:
${menuLines}

Guidelines:
- Be concise but insightful. Use bullet points when comparing multiple items.
- When suggesting prices, reference specific competitors as evidence.
- If the user asks about a service they don't have in their menu, suggest whether they should add it and at what price.
- If data is missing, say so honestly rather than making up numbers.
- Focus on actionable advice: what to raise, what to lower, what gaps to fill.`;
}

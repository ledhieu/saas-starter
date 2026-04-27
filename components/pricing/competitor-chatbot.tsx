'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, MessageCircle, X, Send, Sparkles } from 'lucide-react';

interface Competitor {
  id: number;
  name: string;
  rating: string | null;
  reviewsCount: number | null;
  address: string | null;
}

interface Service {
  name: string;
  priceFormatted: string | null;
  priceValueMin: number | null;
}

interface UserMenuItem {
  name: string;
  price: number | string;
}

interface CompetitorChatbotProps {
  competitors: Competitor[];
  servicesByCompetitor: Record<number, Service[]>;
  userMenuItems: UserMenuItem[];
  businessType: string;
  address: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_QUESTIONS = [
  "What's the average price in my area?",
  "How do my prices compare to competitors?",
  "What services am I missing?",
  "Suggest pricing for my menu",
];

export default function CompetitorChatbot({
  competitors,
  servicesByCompetitor,
  userMenuItems,
  businessType,
  address,
}: CompetitorChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hi! I'm your competitive pricing analyst. Ask me anything about your ${businessType} competitors in ${address || 'this area'}.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Build summarized context to stay within token limits
      const competitorSummaries = competitors.slice(0, 40).map((c) => {
        const svcs = servicesByCompetitor[c.id] || [];
        const prices = svcs
          .map((s) => s.priceValueMin)
          .filter((p): p is number => p != null);
        const avgPrice =
          prices.length > 0
            ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
            : null;
        return {
          name: c.name,
          rating: c.rating,
          reviews: c.reviewsCount,
          avgPrice,
          serviceCount: svcs.length,
          topServices: svcs
            .filter((s) => s.priceValueMin != null)
            .slice(0, 4)
            .map((s) => ({ name: s.name, price: s.priceFormatted })),
        };
      });

      const allPrices = Object.values(servicesByCompetitor)
        .flat()
        .map((s) => s.priceValueMin)
        .filter((p): p is number => p != null);

      const marketSummary = {
        competitorCount: competitors.length,
        totalServices: allPrices.length,
        avgPrice: allPrices.length > 0 ? Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length) : null,
        minPrice: allPrices.length > 0 ? Math.min(...allPrices) : null,
        maxPrice: allPrices.length > 0 ? Math.max(...allPrices) : null,
      };

      const res = await fetch('/api/chat/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-10),
          context: {
            businessType,
            address: address || 'Current search area',
            competitors: competitorSummaries,
            userMenu: userMenuItems.slice(0, 15).map((i) => ({
              name: i.name,
              price: typeof i.price === 'string' ? parseFloat(i.price) : i.price,
            })),
            marketSummary,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to get response');
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply || 'No response' },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            err instanceof Error
              ? `Sorry, I encountered an error: ${err.message}`
              : 'Sorry, something went wrong. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 rounded-full p-4 shadow-lg transition-all duration-300 hover:scale-105 ${
          isOpen
            ? 'bg-gray-800 text-white'
            : 'bg-orange-500 text-white hover:bg-orange-600'
        }`}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] bg-white rounded-xl shadow-2xl border flex flex-col overflow-hidden"
          style={{ height: '560px', maxHeight: 'calc(100vh - 8rem)' }}
        >
          {/* Header */}
          <div className="bg-orange-500 text-white px-4 py-3 flex items-center gap-2 shrink-0">
            <Sparkles className="h-5 w-5" />
            <div>
              <p className="font-semibold text-sm">Pricing Analyst</p>
              <p className="text-xs text-orange-100">Powered by AI</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-3 py-2 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                  <span className="text-sm text-gray-500">Analyzing…</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick questions */}
          {messages.length <= 2 && (
            <div className="px-4 pb-2 shrink-0">
              <p className="text-xs text-muted-foreground mb-1.5">Quick questions:</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full px-2.5 py-1 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t bg-white shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about pricing, competitors…"
                className="flex-1 text-sm h-9"
                disabled={loading}
              />
              <Button
                type="submit"
                size="sm"
                disabled={loading || !input.trim()}
                className="bg-orange-500 hover:bg-orange-600 text-white h-9 w-9 p-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

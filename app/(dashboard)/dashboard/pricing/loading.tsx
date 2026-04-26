import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function PricingPageSkeleton() {
  return (
    <section className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Competitor Pricing
      </h1>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Search Competitors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-9 bg-gray-200 rounded" />
              <div className="h-9 bg-gray-200 rounded" />
              <div className="h-9 bg-gray-200 rounded" />
            </div>
            <div className="h-9 w-32 bg-gray-200 rounded" />
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    </section>
  );
}

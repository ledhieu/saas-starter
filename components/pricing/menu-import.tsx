'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Trash2, Plus } from 'lucide-react';

interface UserMenuItem {
  id: number;
  userId: number;
  name: string;
  price: number;
  duration: number | null;
  createdAt: Date;
}

interface MenuImportProps {
  onItemsChange?: (items: UserMenuItem[]) => void;
}

export default function MenuImport({ onItemsChange }: MenuImportProps) {
  const [items, setItems] = useState<UserMenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');

  const fetchItems = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch('/api/user-menu');
      if (!res.ok) throw new Error('Failed to load menu items');
      const data = await res.json();
      const loaded = data.items ?? [];
      setItems(loaded);
      onItemsChange?.(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setFetching(false);
    }
  }, [onItemsChange]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/user-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          price: Number(price),
          duration: duration.trim() ? Number(duration) : null,
        }),
      });
      if (!res.ok) throw new Error('Failed to add item');
      setName('');
      setPrice('');
      setDuration('');
      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      const res = await fetch(`/api/user-menu?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete item');
      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Menu</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="menu-name">Name</Label>
              <Input
                id="menu-name"
                placeholder="e.g. Classic Manicure"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="menu-price">Price ($)</Label>
              <Input
                id="menu-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="25.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="menu-duration">Duration (min)</Label>
              <Input
                id="menu-duration"
                type="number"
                min="1"
                placeholder="30"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add Item
          </Button>
        </form>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {fetching ? (
          <div className="flex items-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-orange-500 mr-2" />
            <span className="text-sm text-muted-foreground">Loading items…</span>
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No menu items yet. Add your first service above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Price</th>
                  <th className="py-2 pr-4 font-medium">Duration</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="py-2 pr-4">{item.name}</td>
                    <td className="py-2 pr-4">
                      ${typeof item.price === 'string'
                        ? parseFloat(item.price).toFixed(2)
                        : Number(item.price).toFixed(2)}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {item.duration ? `${item.duration} min` : '—'}
                    </td>
                    <td className="py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

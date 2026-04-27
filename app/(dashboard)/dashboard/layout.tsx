'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Users, Settings, Shield, Activity, Tag, Terminal } from 'lucide-react';
import useSWR from 'swr';
import { User } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: user } = useSWR<User>('/api/user', fetcher);

  const navItems = [
    { href: '/dashboard', icon: Users, label: 'Team' },
    { href: '/dashboard/general', icon: Settings, label: 'General' },
    { href: '/dashboard/pricing', icon: Tag, label: 'Pricing' },
    { href: '/dashboard/activity', icon: Activity, label: 'Activity' },
    { href: '/dashboard/security', icon: Shield, label: 'Security' },
    ...(user?.role === 'owner'
      ? [{ href: '/dashboard/admin/graphql-probe', icon: Terminal, label: 'GraphQL Probe' }]
      : []),
  ];

  return (
    <div className="flex flex-col min-h-[calc(100dvh-68px)] w-full">
      {/* Top navigation bar */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} passHref>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`shrink-0 shadow-none ${
                      isActive ? 'bg-gray-100' : ''
                    }`}
                  >
                    <item.icon className="h-4 w-4 mr-1.5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main content — full width */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
    </div>
  );
}

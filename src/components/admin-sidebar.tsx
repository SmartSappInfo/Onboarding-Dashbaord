'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, School, Settings, Calendar } from 'lucide-react';
import Logo from './logo';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/schools', icon: School, label: 'Schools' },
  { href: '/admin/meetings', icon: Calendar, label: 'Meetings' },
];

const bottomNavItems = [
    { href: '/admin/settings', icon: Settings, label: 'Settings'},
    { href: '/', icon: null, label: 'Go to website'}
]

export default function AdminSidebar() {
  const pathname = usePathname();
  
  return (
    <aside className="hidden w-72 flex-shrink-0 border-r bg-card p-6 md:flex md:flex-col">
      <div className="mb-10">
        <Link href="/admin" aria-label="Back to Admin Dashboard">
          <Logo />
        </Link>
      </div>
      <nav className="flex flex-col gap-2 flex-grow">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-4 py-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                isActive && 'bg-accent text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col gap-2">
        <Link
            href="/admin/settings"
            className={cn(
                'flex items-center gap-3 rounded-lg px-4 py-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                pathname.startsWith('/admin/settings') && 'bg-accent text-accent-foreground'
            )}
        >
            <Settings className="h-5 w-5" />
            <span className="font-medium">Settings</span>
        </Link>
         <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
            <span className="font-medium">Go to public site</span>
        </Link>
      </div>
    </aside>
  );
}

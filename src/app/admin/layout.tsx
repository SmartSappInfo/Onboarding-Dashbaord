'use client';

import AdminSidebar from '@/components/admin-sidebar';
import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, LayoutDashboard, School, Settings, Calendar } from 'lucide-react';
import { SmartSappLogo as Logo } from '@/components/icons';
import { cn } from '@/lib/utils';

// Replicating nav items from admin-sidebar.tsx to use in the mobile sheet
const navItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/schools', icon: School, label: 'Schools' },
  { href: '/admin/meetings', icon: Calendar, label: 'Meetings' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      {/* Desktop Sidebar */}
      <AdminSidebar />
      
      <div className="flex w-full flex-col">
         {/* Mobile Header */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col bg-card p-6">
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
                            'flex items-center gap-3 rounded-full px-4 py-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                            isActive && 'bg-accent text-accent-foreground'
                        )}
                        >
                        <item.icon className="h-5 w-5" />
                        <span className="font-medium">{item.label}</span>
                        </Link>
                    );
                    })}
                </nav>
                <div className="flex flex-col gap-2 mt-auto">
                    <Link
                        href="/admin/settings"
                        className={cn(
                            'flex items-center gap-3 rounded-full px-4 py-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                            pathname.startsWith('/admin/settings') && 'bg-accent text-accent-foreground'
                        )}
                    >
                        <Settings className="h-5 w-5" />
                        <span className="font-medium">Settings</span>
                    </Link>
                    <Link
                        href="/"
                        target="_blank"
                        className="flex items-center gap-3 rounded-full px-4 py-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        <span className="font-medium">Go to public site</span>
                    </Link>
                </div>
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1 text-center">
            <Link href="/admin">
                <Logo />
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

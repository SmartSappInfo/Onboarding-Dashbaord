'use client';

/**
 * ARCHITECTURE:
 * Creative Studio Global Navigation Shell (Creative Studio 2.0 - Phase 1)
 * 
 * Provides responsive navigation for Creative Studio sub-surfaces:
 * Home, Projects, Brand Studio, and Asset Library.
 * 
 * CAUTION:
 * Touch targets must be at least 44px for mobile usability (Rule 7).
 * Active states use Emil Kowalski spring scaling (`active:scale-[0.97]`).
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, LayoutGrid, Palette, FolderOpen, Wand2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Home',
    href: '/admin/creative-studio',
    icon: Sparkles,
    exact: true,
  },
  {
    label: 'Projects',
    href: '/admin/creative-studio/projects',
    icon: LayoutGrid,
  },
  {
    label: 'Brand Studio',
    href: '/admin/creative-studio/brand',
    icon: Palette,
  },
  {
    label: 'Asset Library',
    href: '/admin/creative-studio/assets',
    icon: FolderOpen,
  },
];

export function CreativeStudioNav() {
  const pathname = usePathname();

  const isNavActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <header className="w-full border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left Brand Badge */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white dark:text-slate-950 font-black">
            <Wand2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-tight text-foreground">Creative Studio</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                2.0
              </span>
            </div>
            <p className="text-[11px] font-medium text-muted-foreground hidden sm:block">
              AI-Native Creative Production
            </p>
          </div>
        </div>

        {/* Center Desktop Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] active:scale-[0.97]',
                  active
                    ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Icon className={cn('w-4 h-4', active ? 'text-white dark:text-slate-950' : 'text-muted-foreground')} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Action: Quick Link to Backoffice */}
        <div className="flex items-center gap-2">
          <Link href="/admin/backoffice/creative-studio">
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-card/60 text-foreground hover:bg-muted font-bold text-xs h-9 min-h-[36px] rounded-xl active:scale-[0.97]"
            >
              <Shield className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Backoffice Hub</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden flex items-center justify-around border-t border-border px-2 py-1.5 bg-background">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center px-3 py-1 rounded-lg text-[10px] font-bold min-h-[44px] min-w-[44px] transition-all active:scale-[0.95]',
                active ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}

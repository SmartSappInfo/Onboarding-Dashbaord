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
import { Sparkles, LayoutGrid, Palette, FolderOpen, Shield, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';

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
    <header className="w-full border-b border-border/80 bg-background/80 backdrop-blur-md sticky top-0 z-30 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left Title with Back Button */}
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:scale-[0.97]"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-foreground">Creative Studio</span>
            <CardInfoTooltip text="AI-Native visual creative production, CTR formula optimization, and brand governance platform." />
          </div>
        </div>

        {/* Center Desktop Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-muted/30 dark:bg-muted/40 p-1 rounded-xl border border-border/60 shadow-inner h-auto">
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 active:scale-[0.97]',
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', active ? 'text-primary' : 'text-muted-foreground')} />
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

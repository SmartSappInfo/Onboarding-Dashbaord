'use client';

/**
 * @fileOverview Sticky Mobile Bottom Navigation for Messaging Hub.
 * 
 * Part of SmartSapp Communications Hub (Phase 8).
 * Conforms to SmartSapp Agentic Development Rules:
 * - Rule 1: Zero `any` or `any[]` typing.
 * - Rule 7: Mobile-first ergonomic touch targets (`min-h-[44px]`).
 * - Rule 8: Safe relative internal navigation.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageSquare, Megaphone, FileText, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MobileBottomNavProps {
  onOpenMore?: () => void;
  className?: string;
}

export function MobileBottomNav({ onOpenMore, className }: MobileBottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Home', href: '/admin/messaging', icon: Home, isExact: true },
    { label: 'Messages', href: '/admin/messaging/conversations', icon: MessageSquare },
    { label: 'Campaigns', href: '/admin/messaging/campaigns', icon: Megaphone },
    { label: 'Templates', href: '/admin/messaging/templates', icon: FileText },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border/80 md:hidden pb-safe',
        className
      )}
    >
      <div className="grid grid-cols-5 h-14">
        {navItems.map((item) => {
          const isActive = item.isExact ? pathname === item.href : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium transition-colors active:scale-[0.95]',
                isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="w-4 h-4 mb-0.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMore}
          aria-label="More"
          className="flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors active:scale-[0.95]"
        >
          <MoreHorizontal className="w-4 h-4 mb-0.5" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}

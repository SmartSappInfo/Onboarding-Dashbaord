'use client';

/**
 * @fileOverview Accessible Portal Theme Mode Toggle Button
 *
 * Provides a tactile, animated light/dark mode switch conforming to
 * Emil Kowalski animation principles and mobile accessibility standards.
 *
 * Zero `any`, `any[]`, or `unknown` typing.
 *
 * MAINTAINER GUIDANCE (Rule 10):
 * - Renders nothing if the portal owner has locked the theme to 'light' or 'dark'.
 * - Enforces minimum 44px touch targets (min-h-[44px] min-w-[44px]).
 * - Uses active:scale-[0.97] for unified tactile feedback.
 */

import * as React from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePortalTheme } from './PortalThemeProvider';
import { cn } from '@/lib/utils';

export interface PortalThemeToggleProps {
  /** 'icon' for desktop navbar pill, 'drawer' for mobile menu drawer item */
  variant?: 'icon' | 'drawer';
  className?: string;
}

export function PortalThemeToggle({
  variant = 'icon',
  className,
}: PortalThemeToggleProps) {
  const { mode, toggleTheme, canToggle } = usePortalTheme();

  if (!canToggle) {
    return null;
  }

  const isDark = mode === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  if (variant === 'drawer') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        className={cn(
          'w-full min-h-[44px] px-3.5 py-2.5 rounded-xl flex items-center justify-between',
          'text-sm font-semibold hover:bg-[var(--portal-surface)] active:scale-[0.97]',
          'transition-all duration-150 border border-[var(--portal-border)]',
          className
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center text-foreground">
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300 transition-transform duration-300" />
            )}
          </div>
          <span>Appearance</span>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-muted text-muted-foreground capitalize">
          {mode}
        </span>
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        'min-h-[44px] min-w-[44px] h-10 w-10 rounded-xl relative overflow-hidden',
        'hover:bg-[var(--portal-surface)] text-[var(--portal-muted)] hover:text-[var(--portal-text)]',
        'transition-transform duration-200 active:scale-[0.97]',
        className
      )}
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        <Sun
          className={cn(
            'w-4 h-4 text-amber-400 absolute transition-all duration-300 transform',
            isDark ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'
          )}
        />
        <Moon
          className={cn(
            'w-4 h-4 text-slate-600 dark:text-slate-300 absolute transition-all duration-300 transform',
            isDark ? '-rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
          )}
        />
      </div>
    </Button>
  );
}

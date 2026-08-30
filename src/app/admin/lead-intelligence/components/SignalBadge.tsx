'use client';

/**
 * Signal Badge Component (Lead Intelligence 2.0 - Phase 7)
 * UI Spec Section 31: "Signals Feed & Visual Chips"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Semantic color-coding based on signal category (Intent, Tech, Leadership, Compliance).
 * 2. Mobile ergonomics: min-h-[32px] compact touch target.
 * 3. Emil Kowalski motion: Tactile active scale (active:scale-[0.97]).
 * 4. Strict Zero-`any` typing.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Flame, TrendingUp, Users, ShieldAlert, Zap, Globe } from 'lucide-react';
import type { LeadSignal, LeadSignalCategory } from '@/lib/lead-intelligence/types';
import { cn } from '@/lib/utils';

interface SignalBadgeProps {
  signal: LeadSignal;
  onClick?: (signal: LeadSignal) => void;
  className?: string;
}

export const SignalBadge: React.FC<SignalBadgeProps> = ({
  signal,
  onClick,
  className
}) => {
  const getCategoryStyles = (cat: LeadSignalCategory) => {
    switch (cat) {
      case 'intent':
        return {
          icon: <Flame className="h-3 w-3 text-rose-500 animate-pulse" />,
          classes: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
        };
      case 'technographic':
        return {
          icon: <TrendingUp className="h-3 w-3 text-purple-500" />,
          classes: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
        };
      case 'leadership':
        return {
          icon: <Users className="h-3 w-3 text-sky-500" />,
          classes: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
        };
      case 'compliance':
        return {
          icon: <ShieldAlert className="h-3 w-3 text-amber-500" />,
          classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
        };
      case 'engagement':
        return {
          icon: <Zap className="h-3 w-3 text-emerald-500" />,
          classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
        };
      default:
        return {
          icon: <Globe className="h-3 w-3 text-muted-foreground" />,
          classes: 'bg-muted text-muted-foreground border-border'
        };
    }
  };

  const style = getCategoryStyles(signal.category);

  return (
    <Badge
      variant="outline"
      onClick={() => onClick && onClick(signal)}
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-bold py-1 px-2.5 rounded-lg transition-transform',
        style.classes,
        onClick && 'cursor-pointer hover:opacity-90 active:scale-[0.97]',
        className
      )}
    >
      {style.icon}
      <span>{signal.title}</span>
    </Badge>
  );
};

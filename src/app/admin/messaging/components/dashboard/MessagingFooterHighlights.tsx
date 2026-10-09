'use client';

/**
 * @fileOverview Institutional Value Highlights Footer for Messaging Hub.
 * 
 * Part of SmartSapp Communications Hub (Phase 8).
 * Conforms to SmartSapp Agentic Development Rules:
 * - Rule 1: Zero `any` or `any[]` typing.
 * - Rule 7: Clean responsive card layouts.
 */

import * as React from 'react';
import { Sparkles, Zap, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MessagingFooterHighlightsProps {
  className?: string;
}

export function MessagingFooterHighlights({ className }: MessagingFooterHighlightsProps) {
  const highlights = [
    {
      title: 'AI-Powered',
      desc: 'Predictive drafting & automated follow-ups',
      icon: Sparkles,
    },
    {
      title: 'Simpler & Faster',
      desc: 'Sub-second dispatch across all channels',
      icon: Zap,
    },
    {
      title: 'Built for Schools',
      desc: 'Enterprise data safety & student privacy',
      icon: Building2,
    },
  ];

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2', className)}>
      {highlights.map((h) => (
        <div
          key={h.title}
          className="rounded-xl border border-border/60 bg-muted/10 p-3 flex items-center gap-3 text-card-foreground"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <h.icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">{h.title}</p>
            <p className="text-[11px] text-muted-foreground">{h.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

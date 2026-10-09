'use client';

/**
 * @fileOverview Right Sidebar Quick Templates Shortlist.
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1 & Rule 7: Tactile active:scale-[0.98], min-h-[44px], everyday UI English.
 * - Rule 4: Strict typing, zero any.
 * - Rule 8: Safe relative routing (/admin/messaging/templates).
 * - Rule 14: Immutable static template starters.
 */

import * as React from 'react';
import Link from 'next/link';
import { FileText, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuickTemplateItem {
  id: string;
  name: string;
  category: string;
  snippet: string;
}

export const STARTER_TEMPLATES: readonly QuickTemplateItem[] = [
  { id: 'tpl_welcome', name: 'Welcome Message', category: 'Onboarding', snippet: 'Welcome to our community, {{first_name}}! We are thrilled to have you.' },
  { id: 'tpl_fee', name: 'Fee Reminder', category: 'Finance', snippet: 'Friendly reminder: Term fees for {{first_name}} are due on {{due_date}}.' },
  { id: 'tpl_event', name: 'Event Invite', category: 'Events', snippet: 'Join us for our upcoming school assembly this Friday at 10 AM.' },
  { id: 'tpl_update', name: 'General Announcement', category: 'Updates', snippet: 'Important announcement regarding term dates: classes resume Monday.' },
];

export interface QuickTemplatesCardProps {
  onSelectTemplate?: (template: QuickTemplateItem) => void;
  className?: string;
}

export function QuickTemplatesCard({ onSelectTemplate, className }: QuickTemplatesCardProps) {
  return (
    <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 text-card-foreground shadow-xs', className)}>
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Quick Templates</h3>
          <p className="text-xs text-muted-foreground">Standardized starter layouts</p>
        </div>
        <Link href="/admin/messaging/templates" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
          All templates <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2 pt-3">
        {STARTER_TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onSelectTemplate?.(tpl)}
            className="w-full text-left p-2.5 rounded-xl border border-border/60 hover:border-primary/40 bg-muted/10 hover:bg-muted/30 transition-all flex items-center justify-between group active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{tpl.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{tpl.snippet}</p>
              </div>
            </div>
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary shrink-0 ml-2" />
          </button>
        ))}
      </div>
    </div>
  );
}

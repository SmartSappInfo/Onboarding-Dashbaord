'use client';

/**
 * @fileOverview Right Sidebar Quick Templates Shortlist.
 * 
 * Part of SmartSapp Communications Hub (Phase 5).
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1 & Rule 7: Tactile active:scale-[0.98], min-h-[44px], everyday UI English.
 * - Rule 4: Strict typing, zero any.
 * - Rule 8: Safe relative routing (/admin/messaging/templates).
 * - Rule 14: Immutable static template starters with channel awareness.
 */

import * as React from 'react';
import Link from 'next/link';
import { FileText, ArrowRight, Sparkles, DollarSign, Calendar, Megaphone, UserPlus } from 'lucide-react';
import { CardInfoTooltip } from '@/components/ui/card-info-tooltip';
import { cn } from '@/lib/utils';
import type { MessagingDashboardChannel } from '@/lib/types/messaging-dashboard';

export interface QuickTemplateItem {
  id: string;
  name: string;
  category: string;
  snippet: string;
  defaultChannel: MessagingDashboardChannel;
  subject?: string;
}

export const STARTER_TEMPLATES: readonly QuickTemplateItem[] = [
  {
    id: 'tpl_welcome',
    name: 'Welcome Message',
    category: 'Onboarding',
    snippet: 'Welcome to our community, {{first_name}}! We are thrilled to have you.',
    defaultChannel: 'whatsapp',
  },
  {
    id: 'tpl_fee',
    name: 'Fee Reminder',
    category: 'Finance',
    snippet: 'Friendly reminder: Term fees for {{first_name}} are due on {{due_date}}. Please visit the portal or accounts office.',
    defaultChannel: 'sms',
  },
  {
    id: 'tpl_event',
    name: 'Event Invite',
    category: 'Events',
    snippet: 'Join us for our upcoming school open day and celebration this Friday at 10 AM. All families are warmly welcome!',
    defaultChannel: 'email',
    subject: 'Invitation: School Open Day & Assembly',
  },
  {
    id: 'tpl_update',
    name: 'General Announcement',
    category: 'Updates',
    snippet: 'Important announcement regarding term dates: classes resume this Monday. Please ensure students arrive on time.',
    defaultChannel: 'whatsapp',
  },
];

export interface QuickTemplatesCardProps {
  onSelectTemplate?: (template: QuickTemplateItem) => void;
  allowedTemplateIds?: string[];
  className?: string;
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  Onboarding: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', icon: UserPlus },
  Finance: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', icon: DollarSign },
  Events: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', icon: Calendar },
  Updates: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', icon: Megaphone },
};

export function QuickTemplatesCard({ onSelectTemplate, allowedTemplateIds, className }: QuickTemplatesCardProps) {
  const displayedTemplates = React.useMemo(() => {
    if (!allowedTemplateIds || allowedTemplateIds.length === 0) {
      return STARTER_TEMPLATES;
    }
    const filtered = STARTER_TEMPLATES.filter((tpl) => allowedTemplateIds.includes(tpl.id));
    return filtered.length > 0 ? filtered : STARTER_TEMPLATES;
  }, [allowedTemplateIds]);

  return (
    <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 text-card-foreground shadow-xs', className)}>
      <div className="flex items-center justify-between pb-3 border-b border-border/60 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <FileText className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-sm sm:text-base font-semibold tracking-tight text-foreground truncate">
              Quick Templates
            </h3>
            <CardInfoTooltip text="Standardized starter layouts and reusable broadcast templates." />
          </div>
        </div>
        <Link
          href="/admin/messaging/templates"
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1 active:scale-[0.97] transition-all shrink-0"
        >
          All templates <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2 pt-3">
        {displayedTemplates.map((tpl) => {
          const style = CATEGORY_STYLES[tpl.category] || {
            bg: 'bg-primary/10',
            text: 'text-primary',
            icon: FileText,
          };
          const Icon = style.icon;

          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onSelectTemplate?.(tpl)}
              className="w-full text-left p-2.5 rounded-xl border border-border/60 hover:border-primary/40 bg-muted/10 hover:bg-muted/30 transition-all flex items-center justify-between group active:scale-[0.98]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', style.bg, style.text)}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                      {tpl.name}
                    </p>
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-muted/40 text-muted-foreground uppercase">
                      {tpl.defaultChannel === 'whatsapp' ? 'WA' : tpl.defaultChannel.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{tpl.snippet}</p>
                </div>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary shrink-0 ml-2" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

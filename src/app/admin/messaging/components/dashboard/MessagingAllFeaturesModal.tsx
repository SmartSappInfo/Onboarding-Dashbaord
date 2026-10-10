'use client';

/**
 * @fileOverview SmartSapp Messaging Dashboard — All Features Directory Modal
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Conforms strictly to theme.md Section 8 (Standardized Modal Architecture):
 *   - Surface: border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl sm:max-w-2xl.
 *   - Demarcated header: <DialogHeader demarcated> with single-circle CardInfoTooltip.
 *   - Zero raw descriptions: Guidance routes through CardInfoTooltip + <DialogDescription className="sr-only">.
 *   - Demarcated footer: px-6 py-3.5 border-t border-border/80 bg-muted/15 with tactile active:scale-[0.97] button.
 * - Conforms to Rule 8 (Strict Relative Navigation): all links route internally.
 * - Strict Zero-Any Invariant (Rule 4).
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/ui/card-info-tooltip';
import { Button } from '@/components/ui/button';
import { ALL_MESSAGING_FEATURES } from '@/lib/messaging/quick-action-constants';
import {
  Megaphone,
  Send,
  FileText,
  Clock,
  Inbox,
  Zap,
  Users,
  ListFilter,
  Sliders,
  CreditCard,
  Palette,
  Layers,
  Code2,
  UserCheck,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MessagingAllFeaturesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function resolveIcon(name: string) {
  switch (name) {
    case 'Megaphone':
      return <Megaphone className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
    case 'Send':
      return <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    case 'FileText':
      return <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    case 'Clock':
      return <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />;
    case 'Inbox':
      return <Inbox className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
    case 'Zap':
      return <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    case 'Users':
      return <Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />;
    case 'ListFilter':
      return <ListFilter className="h-4 w-4 text-sky-600 dark:text-sky-400" />;
    case 'Sliders':
      return <Sliders className="h-4 w-4 text-violet-600 dark:text-violet-400" />;
    case 'CreditCard':
      return <CreditCard className="h-4 w-4 text-rose-600 dark:text-rose-400" />;
    case 'Palette':
      return <Palette className="h-4 w-4 text-pink-600 dark:text-pink-400" />;
    case 'Layers':
      return <Layers className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />;
    case 'Code2':
      return <Code2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    case 'UserCheck':
      return <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    default:
      return <ExternalLink className="h-4 w-4 text-muted-foreground" />;
  }
}

export function MessagingAllFeaturesModal({
  open,
  onOpenChange,
}: MessagingAllFeaturesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden',
          'border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl'
        )}
      >
        {/* Demarcated Header */}
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 bg-muted/20 border-b border-border/80 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
              Messaging Directory & Tools
            </DialogTitle>
            <CardInfoTooltip text="Directory of all broadcast, conversational, template, and operational tools across the SmartSapp Communications Hub." />
          </div>
          <DialogDescription className="sr-only">
            Index of all messaging features, outbound campaign tools, inbound conversation channels, and operational settings.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Directory Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {ALL_MESSAGING_FEATURES.map((cluster) => (
            <div key={cluster.clusterId} className="space-y-3">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {cluster.title}
                </h4>
                <CardInfoTooltip text={cluster.description} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {cluster.items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      'group flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-muted/10',
                      'hover:bg-muted/25 hover:border-border hover:shadow-xs transition-all duration-150',
                      'active:scale-[0.98] min-h-[44px]'
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background border border-border/60 group-hover:scale-105 transition-transform mt-0.5">
                      {resolveIcon(item.iconName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {item.title}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Demarcated Footer */}
        <DialogFooter demarcated>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl min-h-[44px] px-5 text-xs font-medium active:scale-[0.97]"
          >
            Close Directory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

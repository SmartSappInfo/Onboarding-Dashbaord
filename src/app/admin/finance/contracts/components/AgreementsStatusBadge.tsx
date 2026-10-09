'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * AgreementsStatusBadge:
 * 1. Purpose & Standards:
 *    Single source of truth for contract lifecycle status pills across both the
 *    desktop institution register and mobile card list, as specified in
 *    `docs/billing/ui_enhancement/agreements_hub_enhancement.md` (Section 1.4 & 4).
 * 2. Visual Tokens & Theme Alignment:
 *    Binds strictly to project theme tokens using soft translucent backgrounds
 *    and semitransparent borders for high accessibility in light and dark modes:
 *    - Active ('signed'): Emerald badge with ShieldCheck icon.
 *    - Awaiting Signature ('sent'): Blue badge with Clock icon.
 *    - Draft ('draft'): Purple badge with FileEdit icon.
 *    - No Contract ('no_contract'): Amber badge with AlertCircle icon.
 *    - Expiring Soon ('expiring'): Orange badge with AlertTriangle icon.
 *    - Expired ('expired'): Rose badge with XCircle icon.
 * 3. Performance & Typing:
 *    - Memoized via React.memo to prevent re-renders when parent lists update.
 *    - Strictly typed (Rule 4: Zero `any` or `any[]`).
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  ShieldCheck, 
  Clock, 
  FileEdit, 
  AlertCircle, 
  AlertTriangle, 
  XCircle,
  FileQuestion
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ContractDisplayStatus = 
  | 'signed' 
  | 'sent' 
  | 'draft' 
  | 'no_contract' 
  | 'expiring' 
  | 'expired';

export interface AgreementsStatusBadgeProps {
  status: ContractDisplayStatus | string | null | undefined;
  size?: 'default' | 'compact';
  className?: string;
}

export const AgreementsStatusBadge = React.memo(function AgreementsStatusBadge({
  status,
  size = 'default',
  className,
}: AgreementsStatusBadgeProps) {
  const normalizedStatus = (status || 'no_contract').toLowerCase();

  const isCompact = size === 'compact';
  const iconSizeClass = isCompact ? 'h-3 w-3 shrink-0' : 'h-3.5 w-3.5 shrink-0';
  const sizeClass = isCompact 
    ? 'h-5 px-2 text-[10px] font-semibold gap-1 rounded-md' 
    : 'h-6 px-2.5 text-[11px] font-semibold gap-1.5 rounded-lg';

  switch (normalizedStatus) {
    case 'signed':
    case 'active':
      return (
        <Badge
          variant="outline"
          className={cn(
            sizeClass,
            'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium tracking-tight shadow-2xs',
            className
          )}
        >
          <ShieldCheck className={iconSizeClass} />
          <span>Active</span>
        </Badge>
      );

    case 'sent':
    case 'awaiting_signature':
      return (
        <Badge
          variant="outline"
          className={cn(
            sizeClass,
            'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-400 font-medium tracking-tight shadow-2xs',
            className
          )}
        >
          <Clock className={iconSizeClass} />
          <span>Awaiting Signature</span>
        </Badge>
      );

    case 'draft':
      return (
        <Badge
          variant="outline"
          className={cn(
            sizeClass,
            'border-purple-500/25 bg-purple-500/10 text-purple-700 dark:text-purple-400 font-medium tracking-tight shadow-2xs',
            className
          )}
        >
          <FileEdit className={iconSizeClass} />
          <span>Draft</span>
        </Badge>
      );

    case 'no_contract':
    case 'unprepared':
      return (
        <Badge
          variant="outline"
          className={cn(
            sizeClass,
            'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium tracking-tight shadow-2xs',
            className
          )}
        >
          <AlertCircle className={iconSizeClass} />
          <span>No Contract</span>
        </Badge>
      );

    case 'expiring':
    case 'expiring_soon':
      return (
        <Badge
          variant="outline"
          className={cn(
            sizeClass,
            'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400 font-medium tracking-tight shadow-2xs',
            className
          )}
        >
          <AlertTriangle className={iconSizeClass} />
          <span>Expiring Soon</span>
        </Badge>
      );

    case 'expired':
      return (
        <Badge
          variant="outline"
          className={cn(
            sizeClass,
            'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400 font-medium tracking-tight shadow-2xs',
            className
          )}
        >
          <XCircle className={iconSizeClass} />
          <span>Expired</span>
        </Badge>
      );

    default:
      return (
        <Badge
          variant="outline"
          className={cn(
            sizeClass,
            'border-border/80 bg-muted/30 text-muted-foreground font-medium capitalize',
            className
          )}
        >
          <FileQuestion className={iconSizeClass} />
          <span>{status}</span>
        </Badge>
      );
  }
});

AgreementsStatusBadge.displayName = 'AgreementsStatusBadge';

'use client';

/**
 * Reusable Email Deliverability Badge (Lead Intelligence 2.0 - Phase 5)
 * UI Spec Section 25: "Use obvious statuses: Verified, Risky, Invalid"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Semantic Color Tokens: Emerald (verified), Amber (risky), Rose (invalid).
 * 2. Emil Kowalski Motion: Active spring physics (active:scale-[0.97]).
 * 3. Interactive Diagnostic Trigger: Clicking badge opens full verification drawer.
 * 4. Strict Zero-`any` typing.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import type { EmailVerificationStatus } from '@/lib/lead-intelligence/types';
import { cn } from '@/lib/utils';

interface EmailDeliverabilityBadgeProps {
  status: EmailVerificationStatus;
  deliverabilityScore?: number;
  lastVerifiedAt?: string;
  onClick?: () => void;
  className?: string;
}

export const EmailDeliverabilityBadge: React.FC<EmailDeliverabilityBadgeProps> = ({
  status,
  deliverabilityScore,
  lastVerifiedAt,
  onClick,
  className
}) => {
  const isClickable = Boolean(onClick);

  if (status === 'verified') {
    return (
      <Badge
        onClick={onClick}
        className={cn(
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 transition-transform",
          isClickable && "cursor-pointer hover:bg-emerald-500/20 active:scale-[0.97]",
          className
        )}
        title={lastVerifiedAt ? `Verified on ${new Date(lastVerifiedAt).toLocaleDateString()}` : 'Verified deliverable mailbox'}
      >
        <CheckCircle2 className="h-3 w-3 shrink-0" />
        <span>Verified</span>
        {typeof deliverabilityScore === 'number' && (
          <span className="opacity-70 font-mono font-normal">({deliverabilityScore}%)</span>
        )}
      </Badge>
    );
  }

  if (status === 'risky') {
    return (
      <Badge
        onClick={onClick}
        className={cn(
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 transition-transform",
          isClickable && "cursor-pointer hover:bg-amber-500/20 active:scale-[0.97]",
          className
        )}
        title="Risky deliverability (Catch-all or Greylisted server)"
      >
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span>Risky</span>
        {typeof deliverabilityScore === 'number' && (
          <span className="opacity-70 font-mono font-normal">({deliverabilityScore}%)</span>
        )}
      </Badge>
    );
  }

  if (status === 'invalid') {
    return (
      <Badge
        onClick={onClick}
        className={cn(
          "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 transition-transform",
          isClickable && "cursor-pointer hover:bg-rose-500/20 active:scale-[0.97]",
          className
        )}
        title="Invalid / Non-existent mailbox"
      >
        <XCircle className="h-3 w-3 shrink-0" />
        <span>Invalid</span>
      </Badge>
    );
  }

  // Default: unverified
  return (
    <Badge
      onClick={onClick}
      variant="outline"
      className={cn(
        "text-[10px] font-medium text-muted-foreground border-border/70 px-2 py-0.5 rounded-full flex items-center gap-1 transition-transform",
        isClickable && "cursor-pointer hover:bg-muted active:scale-[0.97]",
        className
      )}
    >
      <HelpCircle className="h-3 w-3 shrink-0 opacity-60" />
      <span>Unverified</span>
    </Badge>
  );
};

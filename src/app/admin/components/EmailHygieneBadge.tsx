'use client';

import React from 'react';
import { CheckCircle2, AlertCircle, XCircle, Circle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Status = 'verified' | 'likely_valid' | 'risky' | 'invalid' | 'unchecked';

interface Props {
  status?: Status;
  size?: 'sm' | 'md';
}

export function EmailHygieneBadge({ status, size = 'sm' }: Props) {
  const currentStatus = status || 'unchecked';

  const config = {
    verified: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Verified (Safe)' },
    likely_valid: { icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Likely Valid' },
    risky: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Risky (Burner/Catch-all)' },
    invalid: { icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-500/10', label: 'Invalid (Bounce)' },
    unchecked: { icon: Circle, color: 'text-slate-500', bg: 'bg-slate-500/10', label: 'Unchecked' }
  };

  const { icon: Icon, color, bg, label } = config[currentStatus];
  
  const dim = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';
  const iconSize = size === 'sm' ? 12 : 16;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            role="button"
            tabIndex={0}
            aria-label={`Email hygiene status: ${currentStatus}. Click to view details.`}
            className={`inline-flex items-center justify-center ${dim} rounded-full ${bg} ${color} cursor-pointer transition-all duration-300 ease-out hover:scale-110 shadow-sm border border-transparent hover:border-current/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary`}
          >
             <Icon size={iconSize} strokeWidth={3} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-slate-900 border-slate-800 text-slate-200 text-xs font-medium px-3 py-1.5 shadow-xl shadow-black/40">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

'use client';

import React from 'react';
import { CheckCircle2, XCircle, Circle, Clock, PhoneOff, ShieldX } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type PhoneStatus =
  | 'unverified'
  | 'format_valid'
  | 'otp_sent'
  | 'verified'
  | 'active'
  | 'failed'
  | 'invalid'
  | 'opted_out'
  | 'unchecked';

interface Props {
  status?: PhoneStatus;
  size?: 'sm' | 'md';
}

const PHONE_STATUS_CONFIG: Record<PhoneStatus, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  verified:     { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Verified (Ownership confirmed)' },
  active:       { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Active (SMS reaching)' },
  format_valid: { icon: CheckCircle2, color: 'text-blue-500',    bg: 'bg-blue-500/10',    label: 'Format Valid' },
  otp_sent:     { icon: Clock,        color: 'text-amber-500',   bg: 'bg-amber-500/10',   label: 'Code Sent (Awaiting confirmation)' },
  failed:       { icon: PhoneOff,     color: 'text-rose-500',    bg: 'bg-rose-500/10',    label: 'Unreachable (SMS failed)' },
  invalid:      { icon: XCircle,      color: 'text-rose-500',    bg: 'bg-rose-500/10',    label: 'Invalid Number' },
  opted_out:    { icon: ShieldX,      color: 'text-slate-500',   bg: 'bg-slate-500/10',   label: 'Opted Out' },
  unverified:   { icon: Circle,       color: 'text-slate-500',   bg: 'bg-slate-500/10',   label: 'Unverified' },
  unchecked:    { icon: Circle,       color: 'text-slate-500',   bg: 'bg-slate-500/10',   label: 'Unchecked' },
};

export function PhoneHygieneBadge({ status, size = 'sm' }: Props) {
  const currentStatus: PhoneStatus = status || 'unchecked';
  const { icon: Icon, color, bg, label } = PHONE_STATUS_CONFIG[currentStatus] || PHONE_STATUS_CONFIG.unchecked;

  const dim = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';
  const iconSize = size === 'sm' ? 12 : 16;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            aria-label={`Phone hygiene status: ${currentStatus}. Click to view details.`}
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

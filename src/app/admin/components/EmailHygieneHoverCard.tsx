'use client';

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EmailHygieneBadge } from './EmailHygieneBadge';
import { CheckCircle2, XCircle, AlertCircle, RotateCw, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ContactHygieneData {
  verificationStatus?: 'verified' | 'likely_valid' | 'risky' | 'invalid' | 'unchecked';
  verificationScore?: number;
  lastVerifiedAt?: string;
  verificationDetails?: {
    syntax?: boolean;
    dns?: boolean;
    smtp?: boolean;
    disposable?: boolean;
    catchAll?: boolean;
  };
}

interface Props {
  email: string;
  hygiene?: ContactHygieneData;
  onManualRecheck?: (email: string) => void;
  isRechecking?: boolean;
  children: React.ReactNode;
}

export function EmailHygieneHoverCardContent({ 
  email, 
  hygiene, 
  onManualRecheck, 
  isRechecking 
}: { 
  email: string; 
  hygiene?: ContactHygieneData; 
  onManualRecheck?: (email: string) => void; 
  isRechecking?: boolean; 
}) {
  const [localRechecking, setLocalRechecking] = React.useState(false);
  const activeRechecking = isRechecking || localRechecking;
  
  const status = hygiene?.verificationStatus || 'unchecked';
  const score = hygiene?.verificationScore || 0;
  
  // Date formatter (fallback to "Never")
  const formattedDate = hygiene?.lastVerifiedAt 
    ? new Date(hygiene.lastVerifiedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Never';

  const CheckRow = ({ label, passed, warning }: { label: string, passed?: boolean, warning?: boolean }) => (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-slate-400 font-medium">{label}</span>
      {passed === undefined ? (
        <span className="text-slate-600">-</span>
      ) : passed ? (
        warning ? <AlertCircle size={14} className="text-amber-500" /> : <CheckCircle2 size={14} className="text-emerald-500" />
      ) : (
        <XCircle size={14} className="text-rose-500" />
      )}
    </div>
  );

  return (
    <div className="w-full text-left">
      {/* Header */}
      <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-start gap-4">
        <div className="w-12 h-12 shrink-0 relative flex items-center justify-center">
          {/* Minimal SVG Dial */}
          <svg className="w-full h-full transform -rotate-90 absolute inset-0" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-800" />
            {status !== 'unchecked' && (
              <circle 
                cx="50" cy="50" r="45" fill="none" strokeWidth="10"
                className={score >= 90 ? 'stroke-emerald-500' : score >= 70 ? 'stroke-blue-500' : score >= 40 ? 'stroke-amber-500' : 'stroke-rose-500'}
                strokeDasharray={283}
                strokeDashoffset={283 - (score / 100) * 283}
                strokeLinecap="round"
              />
            )}
          </svg>
          <span className="text-sm font-black text-white z-10 font-mono tracking-tighter" style={{ fontVariantNumeric: 'tabular-nums' }}>{status === 'unchecked' ? '?' : score}</span>
        </div>
        
        <div className="flex flex-col">
          <span className="text-slate-200 font-bold truncate w-52" title={email}>{email}</span>
          <span className="text-xs text-slate-500 capitalize flex items-center gap-1 mt-0.5">
            <ShieldCheck size={12} /> {status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Details Checklist */}
      <div className="p-4 bg-slate-900/50">
        <div className="space-y-1 mb-4">
          <CheckRow label="Syntax & RFC" passed={hygiene?.verificationDetails?.syntax} />
          <CheckRow label="Burner Filter" passed={hygiene?.verificationDetails ? !hygiene.verificationDetails.disposable : undefined} />
          <CheckRow label="DNS Exchange" passed={hygiene?.verificationDetails?.dns} />
          <CheckRow label="SMTP Reachable" passed={hygiene?.verificationDetails?.smtp} warning={hygiene?.verificationDetails?.catchAll} />
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800/50">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Last Scanned</span>
            <span className="text-xs text-slate-300">{formattedDate}</span>
          </div>
          
          <Button 
            size="sm" 
            variant="outline" 
            className="h-7 text-xs bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200 focus-visible:ring-2 focus-visible:ring-primary"
            disabled={activeRechecking || !onManualRecheck}
            onClick={async (e) => {
              e.preventDefault();
              if (onManualRecheck) {
                setLocalRechecking(true);
                try {
                  await onManualRecheck(email);
                } finally {
                  setLocalRechecking(false);
                }
              }
            }}
          >
            {activeRechecking ? <Loader2 size={12} className="animate-spin mr-1.5" aria-live="polite" /> : <RotateCw size={12} className="mr-1.5" />}
            {activeRechecking ? 'Scanning' : 'Recheck'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EmailHygieneHoverCard({ email, hygiene, onManualRecheck, isRechecking, children }: Props) {
  const status = hygiene?.verificationStatus || 'unchecked';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-2 w-fit">
          <div className="flex-1 truncate cursor-pointer hover:underline underline-offset-4 decoration-slate-600">{children}</div>
          <EmailHygieneBadge status={status} size="sm" />
        </div>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 p-0 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 shadow-2xl shadow-black overflow-hidden z-50 rounded-2xl">
        <EmailHygieneHoverCardContent 
          email={email} 
          hygiene={hygiene} 
          onManualRecheck={onManualRecheck} 
          isRechecking={isRechecking} 
        />
      </PopoverContent>
    </Popover>
  );
}

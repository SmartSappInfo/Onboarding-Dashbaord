'use client';

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PhoneHygieneBadge, PhoneStatus } from './PhoneHygieneBadge';
import { CheckCircle2, XCircle, AlertCircle, RotateCw, Loader2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PhoneHygieneData {
  phoneStatus?: PhoneStatus;
  phoneVerificationScore?: number;
  lastPhoneVerifiedAt?: string;
  country?: string | null;
  callingCode?: string | null;
  lineType?: string | null;
  verificationDetails?: {
    structure?: boolean;
    possible?: boolean;
    valid?: boolean;
    lineType?: boolean;
    suspicious?: boolean; // true = IS suspicious
  };
  // Reachability (lives on the contact, passed through from the row)
  lastSmsDeliveredAt?: string;
  lastSmsFailedAt?: string;
}

interface Props {
  phone: string;
  hygiene?: PhoneHygieneData;
  onManualRecheck?: (phone: string) => void;
  isRechecking?: boolean;
  children: React.ReactNode;
}

/** ISO 3166-1 alpha-2 → flag emoji (regional indicator symbols). */
function isoToFlag(iso?: string | null): string {
  if (!iso || iso.length !== 2) return '';
  const code = iso.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const LINE_TYPE_LABELS: Record<string, string> = {
  mobile: 'Mobile',
  fixed_line: 'Fixed line',
  fixed_line_or_mobile: 'Fixed / mobile',
  voip: 'VoIP',
  premium_rate: 'Premium rate',
  other: 'Unknown',
};

export function PhoneHygieneHoverCardContent({
  phone,
  hygiene,
  onManualRecheck,
  isRechecking,
}: {
  phone: string;
  hygiene?: PhoneHygieneData;
  onManualRecheck?: (phone: string) => void;
  isRechecking?: boolean;
}) {
  const [localRechecking, setLocalRechecking] = React.useState(false);
  const activeRechecking = isRechecking || localRechecking;

  const status: PhoneStatus = hygiene?.phoneStatus || 'unchecked';
  const score = hygiene?.phoneVerificationScore || 0;
  const details = hygiene?.verificationDetails;

  const formattedDate = hygiene?.lastPhoneVerifiedAt
    ? new Date(hygiene.lastPhoneVerifiedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Never';

  // "Accepted" not "delivered": mNotify acceptance ≠ confirmed handset delivery
  const lastSms = hygiene?.lastSmsDeliveredAt
    ? { label: 'SMS accepted', date: new Date(hygiene.lastSmsDeliveredAt), ok: true }
    : hygiene?.lastSmsFailedAt
    ? { label: 'SMS failed', date: new Date(hygiene.lastSmsFailedAt), ok: false }
    : null;

  const flag = isoToFlag(hygiene?.country);
  const lineTypeLabel = hygiene?.lineType ? (LINE_TYPE_LABELS[hygiene.lineType] || hygiene.lineType) : null;

  const strokeClass =
    score >= 70 ? 'stroke-emerald-500' : score >= 40 ? 'stroke-amber-500' : 'stroke-rose-500';

  const CheckRow = ({ label, passed, warning, value }: { label: string; passed?: boolean; warning?: boolean; value?: string | null }) => (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-slate-400 font-medium">{label}</span>
      <span className="flex items-center gap-2">
        {value && <span className="text-slate-300">{value}</span>}
        {passed === undefined ? (
          <span className="text-slate-600">-</span>
        ) : passed ? (
          warning ? <AlertCircle size={14} className="text-amber-500" /> : <CheckCircle2 size={14} className="text-emerald-500" />
        ) : (
          <XCircle size={14} className="text-rose-500" />
        )}
      </span>
    </div>
  );

  return (
    <div className="w-full text-left">
      {/* Header */}
      <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-start gap-4">
        <div className="w-12 h-12 shrink-0 relative flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90 absolute inset-0" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-800" />
            {status !== 'unchecked' && status !== 'unverified' && (
              <circle
                cx="50" cy="50" r="45" fill="none" strokeWidth="10"
                className={strokeClass}
                strokeDasharray={283}
                strokeDashoffset={283 - (score / 100) * 283}
                strokeLinecap="round"
              />
            )}
          </svg>
          <span className="text-sm font-black text-white z-10 font-mono tracking-tighter" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {status === 'unchecked' || status === 'unverified' ? '?' : score}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-slate-200 font-bold truncate w-52 flex items-center gap-1.5" title={phone}>
            {flag && <span className="text-base leading-none">{flag}</span>}
            {phone}
          </span>
          <span className="text-xs text-slate-500 capitalize flex items-center gap-1 mt-0.5">
            <Smartphone size={12} /> {status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Details Checklist */}
      <div className="p-4 bg-slate-900/50">
        <div className="space-y-1 mb-4">
          <CheckRow label="Format (E.164)" passed={details?.structure} />
          <CheckRow label="Allocated range" passed={details?.valid} />
          <CheckRow label="Line type" passed={details?.lineType} value={lineTypeLabel} />
          <CheckRow
            label="Pattern check"
            passed={details ? !details.suspicious : undefined}
            warning={details?.suspicious}
          />
          {lastSms && (
            <CheckRow label={lastSms.label} passed={lastSms.ok} warning={lastSms.ok} />
          )}
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
                  await onManualRecheck(phone);
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

export function PhoneHygieneHoverCard({ phone, hygiene, onManualRecheck, isRechecking, children }: Props) {
  const status: PhoneStatus = hygiene?.phoneStatus || 'unchecked';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-2 w-fit">
          <div className="flex-1 truncate cursor-pointer hover:underline underline-offset-4 decoration-slate-600">{children}</div>
          <PhoneHygieneBadge status={status} size="sm" />
        </div>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 p-0 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 shadow-2xl shadow-black overflow-hidden z-50 rounded-2xl">
        <PhoneHygieneHoverCardContent
          phone={phone}
          hygiene={hygiene}
          onManualRecheck={onManualRecheck}
          isRechecking={isRechecking}
        />
      </PopoverContent>
    </Popover>
  );
}

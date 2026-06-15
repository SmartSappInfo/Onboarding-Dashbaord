'use client';

import React from 'react';
import { doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Mail, Phone, MessageCircle, CheckCircle2, XCircle, AlertCircle, RotateCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { EmailHygieneBadge } from './EmailHygieneBadge';
import { PhoneHygieneBadge, PhoneStatus } from './PhoneHygieneBadge';

export interface VerificationPanelContact {
  name?: string;
  email?: string;
  phone?: string;
  hasWhatsapp?: boolean;
  phoneStatus?: PhoneStatus;
  phoneType?: string;
  lastSmsDeliveredAt?: string;
  lastSmsFailedAt?: string;
  typeLabel?: string;
  typeKey?: string;
  type?: string;
}

interface Props {
  contact: VerificationPanelContact;
  /** Optional external recheck hooks; if omitted, the panel calls the trigger APIs itself. */
  onRecheckEmail?: (email: string) => void | Promise<void>;
  onRecheckPhone?: (phone: string) => void | Promise<void>;
}

function getInitials(name?: string | null) {
  return name ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '?';
}

const LINE_TYPE_LABELS: Record<string, string> = {
  mobile: 'Mobile',
  fixed_line: 'Fixed line',
  fixed_line_or_mobile: 'Fixed / mobile',
  voip: 'VoIP',
  premium_rate: 'Premium rate',
  other: 'Unknown line',
};

/** A single pass/fail/neutral chip used in the per-channel check summaries. */
function CheckChip({ label, state }: { label: string; state: 'pass' | 'fail' | 'warn' | 'none' }) {
  const Icon = state === 'pass' ? CheckCircle2 : state === 'warn' ? AlertCircle : state === 'fail' ? XCircle : null;
  const color =
    state === 'pass' ? 'text-emerald-400' : state === 'warn' ? 'text-amber-400' : state === 'fail' ? 'text-rose-400' : 'text-slate-600';
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
      {Icon ? <Icon size={11} className={color} /> : <span className={`h-1.5 w-1.5 rounded-full ${color} bg-current`} />}
      {label}
    </span>
  );
}

function ChannelHeader({
  icon: Icon,
  label,
  value,
  right,
}: {
  icon: React.ElementType;
  label: string;
  value?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={13} className="text-slate-500 shrink-0" />
        <div className="min-w-0">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</span>
          <div className="text-xs text-slate-200 font-semibold truncate max-w-[180px]">
            {value || <span className="italic text-slate-600 font-normal">Not provided</span>}
          </div>
        </div>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function RecheckButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-6 px-2 text-[10px] bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200 focus-visible:ring-2 focus-visible:ring-primary"
      disabled={busy}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      {busy ? <Loader2 size={11} className="animate-spin mr-1" aria-live="polite" /> : <RotateCw size={11} className="mr-1" />}
      {busy ? 'Scanning' : 'Recheck'}
    </Button>
  );
}

export function ContactVerificationPanel({ contact, onRecheckEmail, onRecheckPhone }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();

  // Email cache (subscribed only while this panel is mounted)
  const emailHash = React.useMemo(() => (contact.email ? btoa(contact.email.toLowerCase()) : ''), [contact.email]);
  const emailRef = useMemoFirebase(() => (firestore && emailHash ? doc(firestore, 'verification_cache', emailHash) : null), [firestore, emailHash]);
  const { data: emailCache } = useDoc<any>(emailRef);

  // Phone cache
  const phoneHash = React.useMemo(() => (contact.phone ? btoa(contact.phone.trim()) : ''), [contact.phone]);
  const phoneRef = useMemoFirebase(() => (firestore && phoneHash ? doc(firestore, 'phone_verification_cache', phoneHash) : null), [firestore, phoneHash]);
  const { data: phoneCache } = useDoc<any>(phoneRef);

  const [emailBusy, setEmailBusy] = React.useState(false);
  const [phoneBusy, setPhoneBusy] = React.useState(false);

  const recheckEmail = async () => {
    if (!contact.email || emailBusy) return;
    setEmailBusy(true);
    try {
      if (onRecheckEmail) {
        await onRecheckEmail(contact.email);
      } else {
        const res = await fetch('/api/verify-email/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails: [contact.email] }),
        });
        if (!res.ok) throw new Error('Verification trigger failed');
        toast({ title: 'Email verification queued', description: `${contact.email} is being verified.` });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Recheck failed', description: e.message });
    } finally {
      setEmailBusy(false);
    }
  };

  const recheckPhone = async () => {
    if (!contact.phone || phoneBusy) return;
    setPhoneBusy(true);
    try {
      if (onRecheckPhone) {
        await onRecheckPhone(contact.phone);
      } else {
        const res = await fetch('/api/verify-phone/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phones: [contact.phone] }),
        });
        if (!res.ok) throw new Error('Verification trigger failed');
        toast({ title: 'Phone verification queued', description: `${contact.phone} is being verified.` });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Recheck failed', description: e.message });
    } finally {
      setPhoneBusy(false);
    }
  };

  // ---- Email derived state ----
  const emailStatus = emailCache?.status || 'unchecked';
  const emailChecks = emailCache?.checks;

  // ---- Phone derived state ----
  const phoneStatus: PhoneStatus = (contact.phoneStatus as PhoneStatus) || phoneCache?.status || 'unchecked';
  const phoneChecks = phoneCache?.checks;
  const phoneLineType = phoneCache?.lineType || contact.phoneType;

  // ---- WhatsApp derived state (detection deferred — reflects modeled flag) ----
  const waState: 'pass' | 'fail' | 'none' = contact.hasWhatsapp === true ? 'pass' : contact.hasWhatsapp === false ? 'fail' : 'none';
  const waLabel = contact.hasWhatsapp === true ? 'On WhatsApp' : contact.hasWhatsapp === false ? 'Not on WhatsApp' : 'Not checked';
  const waColor = contact.hasWhatsapp === true ? 'text-emerald-400' : contact.hasWhatsapp === false ? 'text-rose-400' : 'text-slate-500';

  return (
    <div className="w-full text-left bg-slate-950 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3.5 border-b border-slate-800 bg-slate-900/60">
        <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary text-xs font-black flex items-center justify-center border border-primary/20">
          {getInitials(contact.name)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-100 truncate">{contact.name || 'Unnamed contact'}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            {contact.typeLabel || contact.typeKey || contact.type || 'Contact'}
          </p>
        </div>
      </div>

      {/* Email */}
      <div className="p-3.5 border-b border-slate-800/60 space-y-2">
        <ChannelHeader
          icon={Mail}
          label="Email"
          value={contact.email}
          right={contact.email ? <EmailHygieneBadge status={emailStatus} size="sm" /> : null}
        />
        {contact.email && (
          <div className="flex items-center justify-between gap-2 pl-[21px]">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <CheckChip label="Syntax" state={emailChecks ? (emailChecks.syntax ? 'pass' : 'fail') : 'none'} />
              <CheckChip label="DNS" state={emailChecks ? (emailChecks.dns ? 'pass' : 'fail') : 'none'} />
              <CheckChip label="SMTP" state={emailChecks ? (emailChecks.smtp ? (emailChecks.catchAll ? 'warn' : 'pass') : 'fail') : 'none'} />
              {typeof emailCache?.score === 'number' && (
                <span className="text-[10px] text-slate-500 font-mono">{emailCache.score}/100</span>
              )}
            </div>
            <RecheckButton onClick={recheckEmail} busy={emailBusy} />
          </div>
        )}
      </div>

      {/* Phone */}
      <div className="p-3.5 border-b border-slate-800/60 space-y-2">
        <ChannelHeader
          icon={Phone}
          label="Phone"
          value={contact.phone}
          right={contact.phone ? <PhoneHygieneBadge status={phoneStatus} size="sm" /> : null}
        />
        {contact.phone && (
          <div className="flex items-center justify-between gap-2 pl-[21px]">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <CheckChip label="Format" state={phoneChecks ? (phoneChecks.structure ? 'pass' : 'fail') : 'none'} />
              <CheckChip label="Range" state={phoneChecks ? (phoneChecks.valid ? 'pass' : 'fail') : 'none'} />
              <CheckChip label={phoneLineType ? (LINE_TYPE_LABELS[phoneLineType] || 'Line') : 'Line type'} state={phoneChecks ? (phoneChecks.lineType ? 'pass' : 'fail') : 'none'} />
              <CheckChip label="Pattern" state={phoneChecks ? (phoneChecks.suspicious ? 'warn' : 'pass') : 'none'} />
              {typeof phoneCache?.score === 'number' && (
                <span className="text-[10px] text-slate-500 font-mono">{phoneCache.score}/100</span>
              )}
            </div>
            <RecheckButton onClick={recheckPhone} busy={phoneBusy} />
          </div>
        )}
      </div>

      {/* WhatsApp */}
      <div className="p-3.5 space-y-1.5">
        <ChannelHeader
          icon={MessageCircle}
          label="WhatsApp"
          value={contact.phone || contact.email}
          right={
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${waColor}`}>
              {waState === 'pass' ? <CheckCircle2 size={12} /> : waState === 'fail' ? <XCircle size={12} /> : <AlertCircle size={12} />}
              {waLabel}
            </span>
          }
        />
        {contact.hasWhatsapp === undefined && (
          <p className="pl-[21px] text-[9px] text-slate-600 italic">Automatic WhatsApp detection is coming soon.</p>
        )}
      </div>
    </div>
  );
}

'use client';

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MessageCircle,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  KeyRound,
  Webhook,
  FileCheck2,
  PlugZap,
} from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Step-by-step onboarding guide for connecting an organization's WhatsApp
 * Business Account (Meta Cloud API). Mirrors docs/whatsapp-setup-runbook.md.
 * Pure presentational client component — no secrets, no I/O.
 */
export default function WhatsAppSetupGuide({ open, onOpenChange }: Props) {
  // Resolve the webhook callback URL on the client (set post-mount to avoid
  // any hydration mismatch). Only the public origin is used — never a secret.
  const [origin, setOrigin] = React.useState('');
  React.useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);
  const webhookUrl = origin ? `${origin}/api/webhooks/whatsapp` : '/api/webhooks/whatsapp';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto p-0"
      >
        <SheetHeader className="p-6 border-b sticky top-0 bg-background z-10">
          <SheetTitle className="flex items-center gap-2 text-lg font-bold">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            Connect WhatsApp Business
          </SheetTitle>
          <SheetDescription className="text-xs font-semibold text-muted-foreground">
            Link your organization's own WhatsApp Business Account via the Meta Cloud API.
            Takes ~10 minutes. You'll switch between Meta Business Manager and this page.
          </SheetDescription>
        </SheetHeader>

        <div className="p-6 space-y-6">
          <Step
            n={1}
            icon={ShieldCheck}
            title="Prepare your Meta assets"
            time="Meta Business Manager"
          >
            <p>
              You need a <strong>WhatsApp Business Account (WABA)</strong> with a verified phone
              number, inside a Meta App with WhatsApp added. If you don't have one yet, create it
              in Meta first.
            </p>
            <LinkRow href="https://business.facebook.com/" label="Open Meta Business Manager" />
            <LinkRow
              href="https://developers.facebook.com/apps/"
              label="Open Meta Developers (Apps)"
            />
          </Step>

          <Step n={2} icon={KeyRound} title="Collect four values from Meta" time="WhatsApp → API Setup">
            <ul className="space-y-2">
              <ValueRow
                label="WhatsApp Business Account ID (WABA)"
                where="WhatsApp Manager → Account tools → IDs"
              />
              <ValueRow
                label="Phone Number ID"
                where="WhatsApp → API Setup — the sending number's ID (not the display number)"
              />
              <ValueRow label="Display phone number" where="e.g. +233 20 000 0000" />
              <ValueRow
                label="App Secret (optional, recommended)"
                where="App → Settings → Basic → App Secret — enables inbound signature validation"
              />
            </ul>
          </Step>

          <Step
            n={3}
            icon={KeyRound}
            title="Generate a System User access token"
            time="Business Settings → System Users"
          >
            <p>
              Create (or reuse) a <strong>System User</strong>, assign your WhatsApp app, and
              generate a token with these permissions:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline" className="text-[10px] font-bold">whatsapp_business_messaging</Badge>
              <Badge variant="outline" className="text-[10px] font-bold">whatsapp_business_management</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              Prefer a <strong>long-lived / never-expiring</strong> token so sends don't break.
              Copy it now — Meta only shows it once.
            </p>
            <LinkRow
              href="https://business.facebook.com/settings/system-users"
              label="Open System Users"
            />
          </Step>

          <Step n={4} icon={PlugZap} title="Save & test the connection here" time="This page">
            <ol className="list-decimal ml-4 space-y-1">
              <li>Close this guide and paste the four values into the form.</li>
              <li>Click <strong>Save credentials</strong> — your token is encrypted at rest and never shown again.</li>
              <li>Click <strong>Test connection</strong> — a green status pill and quality rating confirm it works.</li>
            </ol>
          </Step>

          <Step
            n={5}
            icon={Webhook}
            title="Configure the inbound webhook"
            time="Meta App → WhatsApp → Configuration"
          >
            <p>So replies and delivery/read receipts flow back in, set the webhook:</p>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Callback URL</span>
              <CopyField value={webhookUrl} />
            </div>
            <ul className="space-y-1.5 text-[12px]">
              <li>
                <strong>Verify token:</strong> use your connection's verify token (generated when you
                save credentials). The handshake passes when they match.
              </li>
              <li>
                <strong>Subscribe</strong> to the <strong>messages</strong> field (covers inbound
                messages + delivery/read statuses).
              </li>
            </ul>
            <p className="text-[11px] text-muted-foreground">
              The same callback URL is used by every organization — each one is routed and verified by
              its own phone number and app secret, so accounts stay fully independent.
            </p>
          </Step>

          <Step
            n={6}
            icon={FileCheck2}
            title="Sync & adopt templates"
            time="Messaging → Templates"
          >
            <p>
              WhatsApp requires <strong>Meta-approved templates</strong> to message contacts outside a
              24-hour reply window. Go to <strong>Messaging → Templates → WhatsApp Templates</strong>,
              click <strong>Sync from Meta</strong>, then <strong>Adopt</strong> an approved template
              and map its parameters. Adopted templates become selectable in the composer, campaigns,
              and automations.
            </p>
          </Step>

          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4 text-[11px] font-semibold text-emerald-700 flex items-start gap-2">
            <Check className="h-4 w-4 shrink-0 mt-0.5" />
            That's it — your organization now sends and receives on WhatsApp independently of every
            other organization on the platform.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  time,
  children,
}: {
  n: number;
  icon: React.ElementType;
  title: string;
  time: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
          {n}
        </div>
        <div className="w-px flex-1 bg-border mt-1" />
      </div>
      <div className="space-y-2 pb-2 flex-1 min-w-0">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Icon className="h-4 w-4 text-emerald-600" /> {title}
          </h3>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            {time}
          </span>
        </div>
        <div className="text-[12px] text-muted-foreground leading-relaxed space-y-2">{children}</div>
      </div>
    </div>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-700 hover:underline"
    >
      <ExternalLink className="h-3.5 w-3.5" /> {label}
    </a>
  );
}

function ValueRow({ label, where }: { label: string; where: string }) {
  return (
    <li className="text-[12px]">
      <span className="font-bold text-foreground">{label}</span>
      <span className="block text-[11px] text-muted-foreground">{where}</span>
    </li>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = React.useCallback(() => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-lg bg-muted px-3 py-2 text-[11px] font-mono">
        {value}
      </code>
      <Button type="button" variant="outline" size="sm" onClick={copy} className="rounded-lg shrink-0">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

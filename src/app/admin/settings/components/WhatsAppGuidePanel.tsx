import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ListChecks,
  ExternalLink,
  Check,
  ShieldCheck,
  KeyRound,
  Webhook,
  FileCheck2,
  PlugZap,
} from 'lucide-react';
import WhatsAppCopyButton from './WhatsAppCopyButton';

/**
 * Right column of the WhatsApp setup page: a static, step-by-step guide.
 * Server Component — ships no JS except the small copy-button island. Styling
 * conforms to the QR Studio theme (ring card, thin header, blue/`primary`
 * accents, light + dark). The webhook URL is computed server-side.
 */
export default function WhatsAppGuidePanel({ webhookUrl }: { webhookUrl: string }) {
  return (
    <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-card overflow-hidden">
      {/* Thin title bar — icon aligned with title, no description */}
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold tracking-tight">Step-by-step guide</h2>
      </div>

      <CardContent className="p-5 space-y-5">
        <Step n={1} icon={ShieldCheck} title="Prepare your Meta assets" where="Meta Business Manager">
          <p>
            You need a <strong>WhatsApp Business Account (WABA)</strong> with a verified phone number,
            inside a Meta App with WhatsApp added.
          </p>
          <LinkRow href="https://business.facebook.com/" label="Open Meta Business Manager" />
          <LinkRow href="https://developers.facebook.com/apps/" label="Open Meta Developers (Apps)" />
        </Step>

        <Step n={2} icon={KeyRound} title="Collect four values" where="WhatsApp → API Setup">
          <ul className="space-y-2">
            <ValueRow label="WhatsApp Business Account ID (WABA)" hint="WhatsApp Manager → Account tools → IDs" />
            <ValueRow label="Phone Number ID" hint="WhatsApp → API Setup — the sending number's ID (not the display number)" />
            <ValueRow label="Display phone number" hint="e.g. +233 20 000 0000" />
            <ValueRow label="App Secret (optional, recommended)" hint="App → Settings → Basic — enables inbound signature validation" />
          </ul>
        </Step>

        <Step n={3} icon={KeyRound} title="Generate a System User token" where="Business Settings → System Users">
          <p>
            Create (or reuse) a <strong>System User</strong>, assign your WhatsApp app, and generate a
            token with these permissions:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline" className="text-[10px] font-bold border-border">whatsapp_business_messaging</Badge>
            <Badge variant="outline" className="text-[10px] font-bold border-border">whatsapp_business_management</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            Prefer a <strong>long-lived / never-expiring</strong> token. Copy it now — Meta shows it once.
          </p>
          <LinkRow href="https://business.facebook.com/settings/system-users" label="Open System Users" />
        </Step>

        <Step n={4} icon={PlugZap} title="Fill the form & test" where="This page (left)">
          <ol className="list-decimal ml-4 space-y-1">
            <li>Paste the four values into the form on the left.</li>
            <li>Click <strong>Save credentials</strong> — your token is encrypted at rest, never shown again.</li>
            <li>Click <strong>Test connection</strong> — a green pill + quality rating confirm it works.</li>
          </ol>
        </Step>

        <Step n={5} icon={Webhook} title="Configure the inbound webhook" where="Meta App → WhatsApp → Configuration">
          <p>So replies and delivery/read receipts flow back in:</p>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Callback URL</span>
            <WhatsAppCopyButton value={webhookUrl} />
          </div>
          <ul className="space-y-1.5 text-[12px]">
            <li><strong>Verify token:</strong> your connection's verify token (created when you save credentials).</li>
            <li><strong>Subscribe</strong> to the <strong>messages</strong> field (inbound + delivery/read statuses).</li>
          </ul>
          <p className="text-[11px] text-muted-foreground">
            The same callback URL serves every organization — each is routed and verified by its own
            number and app secret, so accounts stay fully independent.
          </p>
        </Step>

        <Step n={6} icon={FileCheck2} title="Sync & adopt templates" where="Messaging → Templates" last>
          <p>
            WhatsApp needs <strong>Meta-approved templates</strong> to message contacts outside a
            24-hour reply window. In <strong>Messaging → Templates → WhatsApp Templates</strong>, click
            <strong> Sync from Meta</strong>, then <strong>Adopt</strong> an approved template and map its
            parameters.
          </p>
        </Step>

        <div className="rounded-xl bg-primary/5 ring-1 ring-primary/20 p-4 text-[11px] font-semibold text-primary flex items-start gap-2">
          <Check className="h-4 w-4 shrink-0 mt-0.5" />
          Once connected, your organization sends and receives on WhatsApp independently of every other
          organization on the platform.
        </div>
      </CardContent>
    </Card>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  where,
  last,
  children,
}: {
  n: number;
  icon: React.ElementType;
  title: string;
  where: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
          {n}
        </div>
        {!last && <div className="w-px flex-1 bg-border mt-1" />}
      </div>
      <div className="space-y-2 pb-2 flex-1 min-w-0">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" /> {title}
          </h3>
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{where}</span>
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
      className="inline-flex items-center gap-1.5 text-[12px] font-bold text-primary hover:underline"
    >
      <ExternalLink className="h-3.5 w-3.5" /> {label}
    </a>
  );
}

function ValueRow({ label, hint }: { label: string; hint: string }) {
  return (
    <li className="text-[12px]">
      <span className="font-bold text-foreground">{label}</span>
      <span className="block text-[11px] text-muted-foreground">{hint}</span>
    </li>
  );
}

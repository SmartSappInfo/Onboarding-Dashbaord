'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { MessageCircle, Loader2, RefreshCw, CheckCircle2, Clock, XCircle, Plus } from 'lucide-react';
import {
  listWhatsAppTemplates,
  syncWhatsAppTemplates,
  adoptWhatsAppTemplate,
} from '@/lib/whatsapp-template-actions';
import { getBodyText } from '@/lib/whatsapp/whatsapp-domain';
import type { WhatsAppTemplate, WhatsAppTemplateStatus } from '@/lib/whatsapp/whatsapp-types';

interface Props {
  organizationId: string;
}

const STATUS_META: Record<
  WhatsAppTemplateStatus,
  { label: string; cls: string; icon: React.ElementType }
> = {
  APPROVED: { label: 'Approved', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle2 },
  PENDING: { label: 'Pending', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: Clock },
  REJECTED: { label: 'Rejected', cls: 'bg-red-500/10 text-red-600 border-red-500/20', icon: XCircle },
  PAUSED: { label: 'Paused', cls: 'bg-muted text-muted-foreground border-border', icon: Clock },
  DISABLED: { label: 'Disabled', cls: 'bg-muted text-muted-foreground border-border', icon: XCircle },
};

const GROUP_ORDER: WhatsAppTemplateStatus[] = ['APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED'];

export default function WhatsAppTemplatePanel({ organizationId }: Props) {
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [templates, setTemplates] = React.useState<WhatsAppTemplate[]>([]);
  const [adopting, setAdopting] = React.useState<WhatsAppTemplate | null>(null);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await listWhatsAppTemplates(idToken, organizationId);
      if (res.success) setTemplates(res.data);
    } finally {
      setLoading(false);
    }
  }, [user, organizationId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const idToken = await user.getIdToken();
      const res = await syncWhatsAppTemplates(idToken, organizationId);
      if (res.success) {
        setTemplates(res.data.templates);
        toast({ title: 'Synced', description: `${res.data.count} template(s) pulled from Meta.` });
      } else {
        toast({ variant: 'destructive', title: 'Sync failed', description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setSyncing(false);
    }
  };

  // Group during render (no effect) — derived state.
  const grouped = React.useMemo(() => {
    const map = new Map<WhatsAppTemplateStatus, WhatsAppTemplate[]>();
    for (const t of templates) {
      const arr = map.get(t.status) ?? [];
      arr.push(t);
      map.set(t.status, arr);
    }
    return map;
  }, [templates]);

  return (
    <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden">
      <CardHeader className="p-6 border-b">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              WhatsApp Templates
            </CardTitle>
            <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
              Meta-registered templates. Only approved templates can be used to send.
            </CardDescription>
          </div>
          <Button onClick={handleSync} disabled={syncing} variant="outline" className="rounded-xl font-bold">
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} /> Sync from Meta
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
          </div>
        ) : templates.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No templates yet. Configure WhatsApp in Settings, then “Sync from Meta”.
          </div>
        ) : (
          GROUP_ORDER.filter((s) => grouped.has(s)).map((status) => {
            const meta = STATUS_META[status];
            const Icon = meta.icon;
            return (
              <div key={status} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {meta.label} ({grouped.get(status)!.length})
                  </span>
                </div>
                <div
                  className="grid grid-cols-1 md:grid-cols-2 gap-3"
                  style={{ contentVisibility: 'auto' }}
                >
                  {grouped.get(status)!.map((t) => (
                    <div key={t.id} className="rounded-2xl border border-border/80 bg-muted/10 p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm">{t.name}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">
                            {t.language} · {t.category} · {t.paramCount} param(s)
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] font-bold ${meta.cls}`}>
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{getBodyText(t.components)}</p>
                      {t.status === 'REJECTED' && t.rejectedReason && (
                        <p className="text-[10px] font-semibold text-red-600">Reason: {t.rejectedReason}</p>
                      )}
                      {t.status === 'APPROVED' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setAdopting(t)}
                          className="rounded-lg font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/5 h-8"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Adopt as template
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      {adopting && (
        <AdoptDialog
          template={adopting}
          organizationId={organizationId}
          onClose={() => setAdopting(null)}
          onAdopted={() => {
            setAdopting(null);
            toast({ title: 'Adopted', description: 'Template is now selectable on the WhatsApp channel.' });
          }}
        />
      )}
    </Card>
  );
}

function AdoptDialog({
  template,
  organizationId,
  onClose,
  onAdopted,
}: {
  template: WhatsAppTemplate;
  organizationId: string;
  onClose: () => void;
  onAdopted: () => void;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  const [params, setParams] = React.useState<string[]>(() => Array(template.paramCount).fill(''));
  const [saving, setSaving] = React.useState(false);

  const setParam = (i: number, v: string) =>
    setParams((prev) => prev.map((p, idx) => (idx === i ? v : p)));

  const canAdopt = params.every((p) => p.trim().length > 0);

  const handleAdopt = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const idToken = await user.getIdToken();
      const res = await adoptWhatsAppTemplate(idToken, {
        organizationId,
        templateId: template.id,
        paramMap: params.map((p) => p.trim()),
        name: template.name,
      });
      if (res.success) onAdopted();
      else toast({ variant: 'destructive', title: 'Adopt failed', description: res.error });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adopt “{template.name}”</DialogTitle>
          <DialogDescription className="text-xs">
            Map each positional parameter to a variable key (e.g. <code>firstName</code>). These resolve
            from the same variables as email/SMS at send time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {template.paramCount === 0 ? (
            <p className="text-sm text-muted-foreground">This template has no parameters.</p>
          ) : (
            params.map((val, i) => (
              <div key={i} className="space-y-1">
                <Label className="text-[10px] font-semibold text-muted-foreground">{`Parameter {{${i + 1}}}`}</Label>
                <Input
                  value={val}
                  onChange={(e) => setParam(i, e.target.value)}
                  placeholder="variable key, e.g. firstName"
                  className="h-10 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4"
                />
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold">
            Cancel
          </Button>
          <Button
            onClick={handleAdopt}
            disabled={saving || (template.paramCount > 0 && !canAdopt)}
            className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Adopt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

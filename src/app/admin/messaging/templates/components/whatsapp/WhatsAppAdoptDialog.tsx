'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
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
import { Loader2, Plus } from 'lucide-react';
import { adoptWhatsAppTemplate } from '@/lib/whatsapp-template-actions';
import type { WhatsAppTemplate } from '@/lib/whatsapp/whatsapp-types';

interface WhatsAppAdoptDialogProps {
  template: WhatsAppTemplate;
  organizationId: string;
  onClose: () => void;
  onAdopted: () => void;
}

export default function WhatsAppAdoptDialog({
  template,
  organizationId,
  onClose,
  onAdopted,
}: WhatsAppAdoptDialogProps) {
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
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e instanceof Error ? e.message : 'Unknown error' });
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

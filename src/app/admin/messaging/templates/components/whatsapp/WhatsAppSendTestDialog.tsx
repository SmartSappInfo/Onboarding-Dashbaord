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
import { Loader2, Send } from 'lucide-react';
import { sendWhatsAppTestMessage } from '@/lib/whatsapp-template-actions';
import { getBodyText, getTemplateRuntimeNeeds, isLikelyHttpUrl } from '@/lib/whatsapp/whatsapp-domain';
import type { WhatsAppTemplate } from '@/lib/whatsapp/whatsapp-types';
import { renderPreview } from './shared';

interface WhatsAppSendTestDialogProps {
  template: WhatsAppTemplate;
  organizationId: string;
  onClose: () => void;
  onSent: (wamid: string | null) => void;
}

export default function WhatsAppSendTestDialog({
  template,
  organizationId,
  onClose,
  onSent,
}: WhatsAppSendTestDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [to, setTo] = React.useState('');
  const [valuesByIndex, setValuesByIndex] = React.useState<Record<number, string>>({});
  const [mediaUrl, setMediaUrl] = React.useState('');
  const [urlSuffixByIndex, setUrlSuffixByIndex] = React.useState<Record<number, string>>({});
  const [sending, setSending] = React.useState(false);

  // Derived during render — no effect.
  const values = React.useMemo(
    () => Array.from({ length: template.paramCount }, (_, i) => valuesByIndex[i] ?? ''),
    [template.paramCount, valuesByIndex],
  );
  const needs = React.useMemo(() => getTemplateRuntimeNeeds(template.components), [template.components]);
  const body = getBodyText(template.components);

  const mediaUrlInvalid = !!needs.mediaFormat && mediaUrl.trim().length > 0 && !isLikelyHttpUrl(mediaUrl);
  const mediaOk = !needs.mediaFormat || isLikelyHttpUrl(mediaUrl);
  const buttonsOk = needs.dynamicUrlButtons.every((idx) => (urlSuffixByIndex[idx] ?? '').trim().length > 0);
  const canSend =
    to.trim().length >= 5 && values.every((v) => v.trim().length > 0) && mediaOk && buttonsOk;

  const handleSend = async () => {
    if (!user) return;
    setSending(true);
    try {
      const idToken = await user.getIdToken();
      const headerMedia = needs.mediaFormat
        ? { type: needs.mediaFormat.toLowerCase() as 'image' | 'video' | 'document', link: mediaUrl.trim() }
        : undefined;
      const buttonParams = needs.dynamicUrlButtons.map((idx) => ({
        subType: 'url' as const,
        index: idx,
        text: (urlSuffixByIndex[idx] ?? '').trim(),
      }));
      const res = await sendWhatsAppTestMessage(idToken, {
        organizationId,
        templateId: template.id,
        to: to.trim(),
        params: values.map((v) => v.trim()),
        headerMedia,
        buttonParams: buttonParams.length ? buttonParams : undefined,
      });
      if (res.success) onSent(res.data.metaMessageId);
      else toast({ variant: 'destructive', title: 'Send failed', description: res.error });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send test — “{template.name}”</DialogTitle>
          <DialogDescription className="text-xs">
            Sends this approved template to one number. Use international format (e.g.
            <code> +233201234567</code>).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="wa-test-to" className="text-[10px] font-semibold text-muted-foreground">Recipient number</Label>
            <Input
              id="wa-test-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+233201234567"
              inputMode="tel"
              className="h-10 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4"
            />
          </div>

          {template.paramCount > 0 &&
            values.map((val, i) => (
              <div key={i} className="flex items-center gap-2">
                <Label htmlFor={`wa-test-p-${i}`} className="text-[10px] font-mono text-muted-foreground w-10">
                  {`{{${i + 1}}}`}
                </Label>
                <Input
                  id={`wa-test-p-${i}`}
                  value={val}
                  onChange={(e) => setValuesByIndex((prev) => ({ ...prev, [i]: e.target.value }))}
                  placeholder="value"
                  className="h-9 rounded-lg bg-muted/20 border-none shadow-inner font-medium px-3"
                />
              </div>
            ))}

          {needs.mediaFormat && (
            <div className="space-y-1">
              <Label htmlFor="wa-test-media" className="text-[10px] font-semibold text-muted-foreground">
                Header media URL ({needs.mediaFormat.toLowerCase()})
              </Label>
              <Input
                id="wa-test-media"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://example.com/file"
                inputMode="url"
                aria-invalid={mediaUrlInvalid}
                aria-describedby={mediaUrlInvalid ? 'wa-test-media-err' : undefined}
                className="h-9 rounded-lg bg-muted/20 border-none shadow-inner font-medium px-3"
              />
              {mediaUrlInvalid ? (
                <p id="wa-test-media-err" role="alert" className="text-[10px] font-semibold text-red-600">
                  Enter a full http(s) URL.
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground">Publicly reachable URL Meta can fetch at send time.</p>
              )}
            </div>
          )}

          {needs.dynamicUrlButtons.map((idx) => (
            <div key={`btn-${idx}`} className="flex items-center gap-2">
              <Label htmlFor={`wa-test-btn-${idx}`} className="text-[10px] font-mono text-muted-foreground w-16">
                URL btn {idx + 1}
              </Label>
              <Input
                id={`wa-test-btn-${idx}`}
                value={urlSuffixByIndex[idx] ?? ''}
                onChange={(e) => setUrlSuffixByIndex((prev) => ({ ...prev, [idx]: e.target.value }))}
                placeholder="{{1}} suffix value"
                className="h-9 rounded-lg bg-muted/20 border-none shadow-inner font-medium px-3"
              />
            </div>
          ))}

          {body.trim() && (
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground">Preview</Label>
              <div className="rounded-2xl rounded-tl-sm bg-emerald-500/10 ring-1 ring-emerald-500/20 p-3 text-sm">
                <p className="whitespace-pre-wrap">{renderPreview(body, values)}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold">
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !canSend}
            className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Send test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

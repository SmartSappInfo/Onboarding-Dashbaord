'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Webhook,
  Key,
  Copy,
  Check,
  ShieldAlert,
  Loader2,
  Terminal,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateIngestionWebhookKeyAction } from '@/lib/quick-notes-federation-actions';

interface WebhookGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  organizationId: string;
  userId: string;
}

export function WebhookGeneratorDialog({
  open,
  onOpenChange,
  workspaceId,
  organizationId,
  userId,
}: WebhookGeneratorDialogProps) {
  const { toast } = useToast();
  const [connectorName, setConnectorName] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generatedKey, setGeneratedKey] = React.useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = React.useState<string | null>(null);
  const [curlSnippet, setCurlSnippet] = React.useState<string | null>(null);
  const [copiedKey, setCopiedKey] = React.useState(false);
  const [copiedUrl, setCopiedUrl] = React.useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectorName.trim()) {
      toast({ title: 'Validation Error', description: 'Connector name is required', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      const res = await generateIngestionWebhookKeyAction({
        workspaceId,
        organizationId,
        name: connectorName.trim(),
        userId,
      });

      if (res.success && res.data) {
        setGeneratedKey(res.data.key);
        setWebhookUrl(res.data.webhookUrl);
        setCurlSnippet(res.data.curlSnippet);
        toast({
          title: 'Webhook Token Generated',
          description: 'Copy and store your API token securely. It will not be shown again.',
        });
      } else {
        toast({
          title: 'Generation Failed',
          description: res.error || 'Failed to create webhook token',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopiedKey(true);
    toast({ title: 'API Key copied to clipboard' });
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyUrl = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    toast({ title: 'Webhook URL copied to clipboard' });
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleClose = () => {
    setGeneratedKey(null);
    setWebhookUrl(null);
    setCurlSnippet(null);
    setConnectorName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md sm:max-w-xl rounded-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1 pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
              <Webhook className="h-4.5 w-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                Inbound Ingestion Webhook Setup
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Capture notes and intelligence from Slack, Discord, Email, WhatsApp, and Zapier.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!generatedKey ? (
          <form onSubmit={handleGenerate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="connector-name" className="text-xs font-bold text-foreground">
                Connector / Integration Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="connector-name"
                placeholder="e.g. Slack #admissions-channel bot, Zapier Lead Form"
                value={connectorName}
                onChange={(e) => setConnectorName(e.target.value)}
                className="h-10 text-xs rounded-xl"
                required
              />
              <p className="text-[10px] text-muted-foreground">
                Give this token an identifiable label so you can audit or revoke it later.
              </p>
            </div>

            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
                <ShieldAlert className="h-4 w-4" />
                Security & Rate Limiting Guardrails
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Inbound webhooks are guarded by sliding-window rate limits (max 60 req/min) and automatic SSRF protection. Inbound text is converted into clean TipTap documents.
              </p>
            </div>

            <DialogFooter className="pt-3 border-t border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isGenerating}
                className="h-9 rounded-xl text-xs min-h-[44px] sm:min-h-[36px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isGenerating}
                className="h-9 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white min-h-[44px] sm:min-h-[36px]"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Generating Token...
                  </>
                ) : (
                  <>
                    <Key className="h-3.5 w-3.5 mr-1.5" />
                    Generate Ingestion Token
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Warning Banner */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2 text-amber-700 dark:text-amber-300">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-xs font-medium">
                Store this API key securely. It will never be shown again in full plaintext.
              </p>
            </div>

            {/* Generated Key */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Secret Ingestion Key (Bearer Token)</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={generatedKey}
                  readOnly
                  className="h-9 font-mono text-xs bg-muted/50 rounded-xl"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyKey}
                  className="h-9 px-3 rounded-xl shrink-0"
                >
                  {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Ingestion URL */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Inbound Webhook Endpoint URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={webhookUrl || ''}
                  readOnly
                  className="h-9 font-mono text-xs bg-muted/50 rounded-xl"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="h-9 px-3 rounded-xl shrink-0"
                >
                  {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Setup Tabs */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs font-bold text-foreground">Integration Setup Guides</Label>
              <Tabs defaultValue="curl" className="w-full">
                <TabsList className="grid grid-cols-3 h-8 rounded-xl bg-muted/60 p-0.5">
                  <TabsTrigger value="curl" className="text-[11px] rounded-lg">
                    <Terminal className="h-3 w-3 mr-1" />
                    cURL
                  </TabsTrigger>
                  <TabsTrigger value="slack" className="text-[11px] rounded-lg">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Slack
                  </TabsTrigger>
                  <TabsTrigger value="zapier" className="text-[11px] rounded-lg">
                    <Zap className="h-3 w-3 mr-1" />
                    Zapier / Make
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="curl" className="pt-2">
                  <pre className="p-3 bg-slate-950 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed border border-slate-800">
                    {curlSnippet}
                  </pre>
                </TabsContent>

                <TabsContent value="slack" className="pt-2">
                  <div className="p-3 bg-muted/30 border border-border rounded-xl space-y-1.5 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">Slack Workflow Builder Setup:</p>
                    <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                      <li>In Slack, open Workflow Builder &gt; New Workflow.</li>
                      <li>Choose trigger: &quot;When a message is reacted to&quot; (e.g. with 📝).</li>
                      <li>Add step: &quot;Send web request&quot; to the Webhook URL above.</li>
                      <li>Set header: <code className="text-xs font-mono bg-muted px-1 rounded">Authorization: Bearer {generatedKey.slice(0, 10)}...</code></li>
                      <li>Set body JSON mapping <code className="font-mono">title</code> and <code className="font-mono">content</code>.</li>
                    </ol>
                  </div>
                </TabsContent>

                <TabsContent value="zapier" className="pt-2">
                  <div className="p-3 bg-muted/30 border border-border rounded-xl space-y-1.5 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">Zapier / Make Webhook Action:</p>
                    <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                      <li>Choose action: &quot;Webhooks by Zapier &gt; Custom Request (POST)&quot;.</li>
                      <li>URL: <code className="font-mono">{webhookUrl}</code></li>
                      <li>Headers: <code className="font-mono">Authorization: Bearer {generatedKey.slice(0, 10)}...</code></li>
                      <li>Payload: JSON with <code className="font-mono">title</code>, <code className="font-mono">content</code>, and <code className="font-mono">source: &quot;webhook_rest&quot;</code>.</li>
                    </ol>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <DialogFooter className="pt-3 border-t border-border/60">
              <Button
                type="button"
                onClick={handleClose}
                className="w-full h-9 rounded-xl text-xs font-semibold bg-primary text-primary-foreground min-h-[44px] sm:min-h-[36px]"
              >
                I Have Saved My Token
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

'use client';

import * as React from 'react';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Webhook, WebhookType, AutomationTrigger } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Save, Loader2, ArrowUpRight, ArrowDownLeft, Zap,
  Globe, ShieldCheck, Eye, EyeOff, Copy, Check,
  Database, Mail, Tag, Building, CheckSquare, Play, Target
} from 'lucide-react';

const OUTBOUND_TRIGGERS: { value: AutomationTrigger; label: string; icon: React.ElementType; desc: string; color: string }[] = [
  { value: 'SURVEY_SUBMITTED', label: 'Survey Submitted', icon: Database, desc: 'Fires when a survey response is recorded.', color: 'text-blue-500' },
  { value: 'FORM_SUBMITTED', label: 'Form Submitted', icon: CheckSquare, desc: 'Fires on external form submission.', color: 'text-cyan-500' },
  { value: 'ENTITY_CREATED', label: 'Entity Created', icon: Building, desc: 'Fires when a new contact is created.', color: 'text-emerald-500' },
  { value: 'TAG_ADDED', label: 'Tag Applied', icon: Tag, desc: 'Fires when a tag is assigned.', color: 'text-amber-500' },
  { value: 'TAG_REMOVED', label: 'Tag Removed', icon: Tag, desc: 'Fires when a tag is detached.', color: 'text-orange-500' },
  { value: 'MEETING_CREATED', label: 'Meeting Scheduled', icon: Play, desc: 'Fires on new meeting creation.', color: 'text-violet-500' },
  { value: 'CAMPAIGN_OPENED', label: 'Campaign Opened', icon: Mail, desc: 'Fires when a campaign email is opened.', color: 'text-pink-500' },
  { value: 'CAMPAIGN_CLICKED', label: 'Campaign Clicked', icon: Target, desc: 'Fires on campaign link click.', color: 'text-rose-500' },
];

interface WebhookEditorProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  webhook: Webhook | null;
}

export default function WebhookEditor({ isOpen, onOpenChange, webhook }: WebhookEditorProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { toast } = useToast();

  const isEditing = !!webhook;

  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<WebhookType>('outbound');
  const [url, setUrl] = React.useState('');
  const [trigger, setTrigger] = React.useState<AutomationTrigger | ''>('');
  const [secret, setSecret] = React.useState('');
  const [showSecret, setShowSecret] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (webhook) {
      setName(webhook.name);
      setType(webhook.type);
      setUrl(webhook.url);
      setTrigger(webhook.trigger || '');
      setSecret(webhook.secret || '');
    } else {
      setName('');
      setType('outbound');
      setUrl('');
      setTrigger('');
      setSecret('');
    }
    setShowSecret(false);
  }, [webhook, isOpen]);

  const generateSecret = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const newSecret = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    setSecret(newSecret);
    setShowSecret(true);
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setHasCopied(true);
    toast({ title: 'Secret Copied' });
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!firestore || !user || !name || !url) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const data: any = {
        name: name.trim(),
        type,
        url: url.trim(),
        trigger: type === 'outbound' && trigger ? trigger : null,
        secret: secret || null,
        status: 'active',
        organizationId: activeOrganizationId || 'default',
        workspaceId: activeWorkspaceId || '',
        updatedAt: now,
      };

      if (isEditing) {
        await updateDoc(doc(firestore, 'webhooks', webhook.id), data);
        toast({ title: 'Webhook Updated', description: `"${name}" configuration saved.` });
      } else {
        data.createdAt = now;
        data.createdBy = user.uid;
        await addDoc(collection(firestore, 'webhooks'), data);
        toast({ title: 'Webhook Created', description: `"${name}" is now active.` });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const isValid = name.trim() && url.trim() && (type === 'inbound' || trigger);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg p-0 border-l border-border/50 bg-background overflow-hidden flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50 bg-card/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-xl shadow-lg",
              type === 'outbound'
                ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                : "bg-gradient-to-br from-purple-500 to-purple-600 text-white"
            )}>
              {type === 'outbound' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
            </div>
            <div>
              <SheetTitle className="text-lg font-bold tracking-tight">
                {isEditing ? 'Edit Integration' : 'New Integration'}
              </SheetTitle>
              <SheetDescription className="text-[10px] font-semibold tracking-tight">
                {isEditing ? `Modify "${webhook?.name}"` : 'Configure a new webhook endpoint'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-6 space-y-8">
            {/* Identity Section */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold text-[8px] uppercase h-5">Identity</Badge>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground ml-1">Webhook Name</Label>
                <Input
                  placeholder="e.g., Zapier — New Lead Sync"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="h-11 rounded-xl bg-card border-border/50 font-bold shadow-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground ml-1">Data Flow Direction</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(['outbound', 'inbound'] as WebhookType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left group",
                        type === t
                          ? t === 'outbound'
                            ? "border-blue-500/50 bg-blue-500/5 shadow-md shadow-blue-500/10"
                            : "border-purple-500/50 bg-purple-500/5 shadow-md shadow-purple-500/10"
                          : "border-border/50 bg-card hover:bg-muted/30"
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-xl transition-all",
                        type === t
                          ? t === 'outbound' ? "bg-blue-500 text-white" : "bg-purple-500 text-white"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {t === 'outbound' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="font-bold text-xs tracking-tight capitalize">{t}</p>
                        <p className="text-[9px] text-muted-foreground font-medium">
                          {t === 'outbound' ? 'Push data out' : 'Receive data in'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Separator className="opacity-30" />

            {/* Endpoint Section */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 border-emerald-500/20 font-bold text-[8px] uppercase h-5">
                  <Globe className="h-3 w-3 mr-1" /> Endpoint
                </Badge>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground ml-1">
                  {type === 'outbound' ? 'Destination URL' : 'Source Description'}
                </Label>
                <Input
                  type="url"
                  placeholder="https://hooks.zapier.com/..."
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="h-11 rounded-xl bg-card border-border/50 font-mono text-xs shadow-sm"
                />
              </div>
            </div>

            {/* Trigger Section (Outbound Only) */}
            {type === 'outbound' && (
              <>
                <Separator className="opacity-30" />
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-amber-500/5 text-amber-600 border-amber-500/20 font-bold text-[8px] uppercase h-5">
                      <Zap className="h-3 w-3 mr-1" /> Trigger Event
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {OUTBOUND_TRIGGERS.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTrigger(t.value)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                          trigger === t.value
                            ? "border-primary/40 bg-primary/5 shadow-sm"
                            : "border-transparent bg-card/50 hover:bg-muted/30"
                        )}
                      >
                        <div className={cn(
                          "p-2 rounded-lg transition-all shrink-0",
                          trigger === t.value ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                        )}>
                          <t.icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[11px] tracking-tight">{t.label}</p>
                          <p className="text-[9px] text-muted-foreground font-medium">{t.desc}</p>
                        </div>
                        {trigger === t.value && (
                          <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator className="opacity-30" />

            {/* Security Section */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-rose-500/5 text-rose-600 border-rose-500/20 font-bold text-[8px] uppercase h-5">
                  <ShieldCheck className="h-3 w-3 mr-1" /> Security
                </Badge>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-bold text-muted-foreground ml-1">Signing Secret (HMAC-SHA256)</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showSecret ? 'text' : 'password'}
                      placeholder="Auto-generated or paste your own"
                      value={secret}
                      onChange={e => setSecret(e.target.value)}
                      className="h-11 rounded-xl bg-card border-border/50 font-mono text-xs shadow-sm pr-20"
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setShowSecret(!showSecret)}>
                        {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      {secret && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={copySecret}>
                          {hasCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl font-bold text-[10px] h-8 border-dashed" onClick={generateSecret}>
                  <ShieldCheck className="h-3 w-3 mr-1.5" /> Generate Secure Key
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="px-6 py-4 border-t border-border/50 bg-card/30 backdrop-blur-sm shrink-0">
          <Button
            onClick={handleSave}
            disabled={isSaving || !isValid}
            className="w-full h-12 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 gap-2"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEditing ? 'Update Integration' : 'Deploy Integration'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

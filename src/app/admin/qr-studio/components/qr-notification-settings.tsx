'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Mail, Smartphone, PlusCircle, Pencil, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TagInput } from '@/components/ui/tag-input';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { TemplateWorkshopSheet } from '@/app/admin/messaging/components/TemplateWorkshopSheet';
import { MessagingTemplateSelector } from '../../components/MessagingTemplateSelector';

interface NotificationConfig {
  enabled: boolean;
  userIds?: string[];
  emailTemplateId?: string;
  smsTemplateId?: string;
  inAppTemplateId?: string;
  pushTemplateId?: string;
}

interface QRNotificationSettingsProps {
  internalAlerts?: NotificationConfig;
  onChangeInternal: (val: NotificationConfig) => void;
}

export function QRNotificationSettings({
  internalAlerts = { enabled: false, userIds: [] },
  onChangeInternal,
}: QRNotificationSettingsProps) {
  const [quickCreateState, setQuickCreateState] = React.useState<{ channel: 'email' | 'sms' | 'in_app' | 'push'; open: boolean; templateId?: string } | null>(null);

  const isEnabled = internalAlerts.enabled;

  return (
    <div className="space-y-6">
      <div className={cn("rounded-[2rem] border-2 transition-all duration-500", isEnabled ? "border-primary/20 bg-primary/5 shadow-xl shadow-primary/5" : "border-border/50 bg-background")}>
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4 text-left">
            <div className={cn("p-3 rounded-2xl transition-all duration-500", isEnabled ? "bg-primary text-white shadow-lg shadow-primary/20 -rotate-3" : "bg-muted text-muted-foreground")}>
              <ScanLine className="h-6 w-6" />
            </div>
            <div className="space-y-0.5">
              <Label className="text-base font-semibold tracking-tight">Scan Alerts</Label>
              <p className="text-[10px] text-muted-foreground font-semibold tracking-tighter">Notify team members when this QR code is scanned</p>
            </div>
          </div>
          <Switch 
            checked={isEnabled} 
            onCheckedChange={(val) => onChangeInternal({ ...internalAlerts, enabled: val })} 
            className="scale-125"
          />
        </div>

        {isEnabled && (
          <div className="p-6 pt-0 space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <Separator className="bg-primary/10" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              <div className="space-y-4">
                <Label className="text-[10px] font-semibold text-primary ml-1">Internal Users to Notify</Label>
                <TagInput 
                  value={internalAlerts.userIds || []}
                  onChange={(val) => onChangeInternal({ ...internalAlerts, userIds: val })}
                  placeholder="Enter emails or system user roles..."
                />
                <p className="text-[9px] font-bold text-muted-foreground/60 tracking-tight leading-relaxed italic">
                  Add comma or semicolon-separated custom contacts or workspace roles.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-2">
                      <Mail className="h-3 w-3" /> Email Template
                    </Label>
                    <div className="flex items-center gap-1">
                      {internalAlerts.emailTemplateId && internalAlerts.emailTemplateId !== 'none' && (
                        <Button type="button" variant="ghost" className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg" onClick={() => setQuickCreateState({ channel: 'email', open: true, templateId: internalAlerts.emailTemplateId })}>
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                      )}
                      <Button type="button" variant="ghost" className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg" onClick={() => setQuickCreateState({ channel: 'email', open: true })}>
                        <PlusCircle className="h-3 w-3" /> New
                      </Button>
                    </div>
                  </div>
                  <MessagingTemplateSelector 
                    category="qr_codes"
                    recipientType="internal_alert"
                    channel="email"
                    value={internalAlerts.emailTemplateId}
                    onValueChange={(val) => onChangeInternal({ ...internalAlerts, emailTemplateId: val })}
                    placeholder="Select email blueprint..."
                    compact
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-2">
                      <Smartphone className="h-3 w-3" /> SMS Template
                    </Label>
                    <div className="flex items-center gap-1">
                      {internalAlerts.smsTemplateId && internalAlerts.smsTemplateId !== 'none' && (
                        <Button type="button" variant="ghost" className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg" onClick={() => setQuickCreateState({ channel: 'sms', open: true, templateId: internalAlerts.smsTemplateId })}>
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                      )}
                      <Button type="button" variant="ghost" className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg" onClick={() => setQuickCreateState({ channel: 'sms', open: true })}>
                        <PlusCircle className="h-3 w-3" /> New
                      </Button>
                    </div>
                  </div>
                  <MessagingTemplateSelector 
                    category="qr_codes"
                    recipientType="internal_alert"
                    channel="sms"
                    value={internalAlerts.smsTemplateId}
                    onValueChange={(val) => onChangeInternal({ ...internalAlerts, smsTemplateId: val })}
                    placeholder="Select SMS blueprint..."
                    compact
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {quickCreateState && (
        <TemplateWorkshopSheet 
          open={quickCreateState.open}
          onOpenChange={(o) => !o && setQuickCreateState(null)}
          templateId={quickCreateState.templateId}
          initialContext={{
            channel: quickCreateState.channel,
            category: "qr_codes",
            recipientType: "internal_alert"
          }}
          onCreated={(template) => {
            if (quickCreateState.channel === 'email') onChangeInternal({ ...internalAlerts, emailTemplateId: template.id });
            else onChangeInternal({ ...internalAlerts, smsTemplateId: template.id });
          }}
        />
      )}
    </div>
  );
}

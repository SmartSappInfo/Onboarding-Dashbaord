'use client';

import * as React from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { MessageTemplate } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Users, Mail, Smartphone, PlusCircle, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TagInput } from '@/components/ui/tag-input';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import QuickTemplateDialog from '@/app/admin/messaging/components/quick-template-dialog';

interface NotificationConfig {
  enabled: boolean;
  userIds?: string[];
  respondentEmailField?: string;
  respondentPhoneField?: string;
  emailTemplateId?: string;
  smsTemplateId?: string;
  inAppTemplateId?: string;
  pushTemplateId?: string;
}

interface FormNotificationSettingsProps {
  internalAlerts?: NotificationConfig;
  respondentAlerts?: NotificationConfig;
  onChangeInternal: (val: NotificationConfig) => void;
  onChangeRespondent: (val: NotificationConfig) => void;
}

export function FormNotificationSettings({
  internalAlerts = { enabled: false, userIds: [] },
  respondentAlerts = { enabled: false },
  onChangeInternal,
  onChangeRespondent,
}: FormNotificationSettingsProps) {
  const firestore = useFirestore();
  const [quickCreateState, setQuickCreateState] = React.useState<{ channel: 'email' | 'sms' | 'in_app' | 'push'; open: boolean; templateId?: string; type: 'internal' | 'respondent' } | null>(null);

  const templatesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'message_templates'), where('isActive', '==', true), where('category', '==', 'forms'));
  }, [firestore]);

  const { data: templates } = useCollection<MessageTemplate>(templatesQuery);

  const renderConfigBlock = (
    type: 'internal' | 'respondent',
    config: NotificationConfig,
    onChange: (val: NotificationConfig) => void,
    title: string,
    subtitle: string,
    icon: React.ReactNode,
    recipientTypeMatch: string
  ) => {
    const isEnabled = config.enabled;
    const emailTemplates = templates?.filter(t => t.channel === 'email' && (t.recipientType === recipientTypeMatch || t.recipientType === 'external_alert' || t.recipientType === 'entity'));
    const smsTemplates = templates?.filter(t => t.channel === 'sms' && (t.recipientType === recipientTypeMatch || t.recipientType === 'external_alert' || t.recipientType === 'entity'));

    return (
      <div className={cn("rounded-[2rem] border-2 transition-all duration-500", isEnabled ? "border-primary/20 bg-primary/5 shadow-xl shadow-primary/5" : "border-border/50 bg-background")}>
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4 text-left">
            <div className={cn("p-3 rounded-2xl transition-all duration-500", isEnabled ? "bg-primary text-white shadow-lg shadow-primary/20 -rotate-3" : "bg-muted text-muted-foreground")}>
              {icon}
            </div>
            <div className="space-y-0.5">
              <Label className="text-base font-semibold tracking-tight">{title}</Label>
              <p className="text-[10px] text-muted-foreground font-semibold tracking-tighter">{subtitle}</p>
            </div>
          </div>
          <Switch 
            checked={isEnabled} 
            onCheckedChange={(val) => onChange({ ...config, enabled: val })} 
            className="scale-125"
          />
        </div>

        {isEnabled && (
          <div className="p-6 pt-0 space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <Separator className="bg-primary/10" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              {type === 'internal' ? (
                <div className="space-y-4">
                  <Label className="text-[10px] font-semibold text-primary ml-1">Internal Users to Notify</Label>
                  <TagInput 
                    value={config.userIds || []}
                    onChange={(val) => onChange({ ...config, userIds: val })}
                    placeholder="Enter emails or system user roles..."
                  />
                  <p className="text-[9px] font-bold text-muted-foreground/60 tracking-tight leading-relaxed italic">
                    Add comma or semicolon-separated custom contacts or workspace roles.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Label className="text-[10px] font-semibold text-primary ml-1">Respondent Contact Fields</Label>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Email Field Variable</Label>
                      <Input
                        value={config.respondentEmailField || ''}
                        onChange={(e) => onChange({ ...config, respondentEmailField: e.target.value })}
                        placeholder="e.g. contact_email"
                        className="h-9 rounded-xl text-xs bg-background"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Phone Field Variable (for SMS)</Label>
                      <Input
                        value={config.respondentPhoneField || ''}
                        onChange={(e) => onChange({ ...config, respondentPhoneField: e.target.value })}
                        placeholder="e.g. contact_phone"
                        className="h-9 rounded-xl text-xs bg-background"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-2">
                      <Mail className="h-3 w-3" /> Email Template
                    </Label>
                    <div className="flex items-center gap-1">
                      {config.emailTemplateId && config.emailTemplateId !== 'none' && (
                        <Button type="button" variant="ghost" className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg" onClick={() => setQuickCreateState({ channel: 'email', open: true, templateId: config.emailTemplateId, type })}>
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                      )}
                      <Button type="button" variant="ghost" className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg" onClick={() => setQuickCreateState({ channel: 'email', open: true, type })}>
                        <PlusCircle className="h-3 w-3" /> New
                      </Button>
                    </div>
                  </div>
                  <Select value={config.emailTemplateId || 'none'} onValueChange={(val) => onChange({ ...config, emailTemplateId: val === 'none' ? undefined : val })}>
                    <SelectTrigger className="h-11 rounded-xl bg-card border-primary/10 font-bold transition-all text-xs">
                      <SelectValue placeholder="Select email template..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none">No email template</SelectItem>
                      {emailTemplates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-2">
                      <Smartphone className="h-3 w-3" /> SMS Template
                    </Label>
                    <div className="flex items-center gap-1">
                      {config.smsTemplateId && config.smsTemplateId !== 'none' && (
                        <Button type="button" variant="ghost" className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg" onClick={() => setQuickCreateState({ channel: 'sms', open: true, templateId: config.smsTemplateId, type })}>
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                      )}
                      <Button type="button" variant="ghost" className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg" onClick={() => setQuickCreateState({ channel: 'sms', open: true, type })}>
                        <PlusCircle className="h-3 w-3" /> New
                      </Button>
                    </div>
                  </div>
                  <Select value={config.smsTemplateId || 'none'} onValueChange={(val) => onChange({ ...config, smsTemplateId: val === 'none' ? undefined : val })}>
                    <SelectTrigger className="h-11 rounded-xl bg-card border-primary/10 font-bold transition-all text-xs">
                      <SelectValue placeholder="Select SMS template..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none">No SMS template</SelectItem>
                      {smsTemplates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderConfigBlock('respondent', respondentAlerts, onChangeRespondent, 'Respondent Alerts', 'Notify the person who submitted the form', <Bell className="h-6 w-6" />, 'respondent')}
      {renderConfigBlock('internal', internalAlerts, onChangeInternal, 'Internal Alerts', 'Notify team members upon submission', <Users className="h-6 w-6" />, 'internal_alert')}

      {quickCreateState && (
        <QuickTemplateDialog 
          open={quickCreateState.open}
          onOpenChange={(o) => !o && setQuickCreateState(null)}
          channel={quickCreateState.channel}
          category="forms"
          recipientType={quickCreateState.type === 'internal' ? 'internal_alert' : 'respondent'}
          templateId={quickCreateState.templateId}
          onCreated={(id) => {
            if (quickCreateState.type === 'internal') {
              if (quickCreateState.channel === 'email') onChangeInternal({ ...internalAlerts, emailTemplateId: id });
              else onChangeInternal({ ...internalAlerts, smsTemplateId: id });
            } else {
              if (quickCreateState.channel === 'email') onChangeRespondent({ ...respondentAlerts, emailTemplateId: id });
              else onChangeRespondent({ ...respondentAlerts, smsTemplateId: id });
            }
          }}
        />
      )}
    </div>
  );
}

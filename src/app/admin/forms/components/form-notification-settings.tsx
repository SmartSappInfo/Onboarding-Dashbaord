'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { UserProfile, MessageTemplate } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Users, Mail, Smartphone, MessageCircle, PlusCircle, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TagInput } from '@/components/ui/tag-input';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TemplateWorkshopSheet } from '@/app/admin/messaging/components/TemplateWorkshopSheet';
import { MessagingTemplateSelector } from '../../components/MessagingTemplateSelector';
import { useTenant } from '@/context/TenantContext';
import { MultiSelect } from '@/components/ui/multi-select';

interface NotificationConfig {
  enabled: boolean;
  userIds?: string[];
  respondentEmailField?: string;
  respondentPhoneField?: string;
  emailTemplateId?: string;
  smsTemplateId?: string;
  whatsappTemplateId?: string;
  inAppTemplateId?: string;
  pushTemplateId?: string;
  emailAddresses?: string[]; // For external alerts
}

interface FormNotificationSettingsProps {
  internalAlerts?: NotificationConfig;
  respondentAlerts?: NotificationConfig;
  externalAlerts?: NotificationConfig;
  onChangeInternal: (val: NotificationConfig) => void;
  onChangeRespondent: (val: NotificationConfig) => void;
  onChangeExternal: (val: NotificationConfig) => void;
  availableFields?: { label: string; value: string; type: string }[];
}

export function FormNotificationSettings({
  internalAlerts = { enabled: false, userIds: [] },
  respondentAlerts = { enabled: false },
  externalAlerts = { enabled: false, emailAddresses: [] },
  onChangeInternal,
  onChangeRespondent,
  onChangeExternal,
  availableFields = [],
}: FormNotificationSettingsProps) {
  const [quickCreateState, setQuickCreateState] = React.useState<{ channel: 'email' | 'sms' | 'in_app' | 'push'; open: boolean; templateId?: string; type: 'internal' | 'respondent' | 'external' } | null>(null);

  const firestore = useFirestore();
  const { activeOrganizationId } = useTenant();

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(
      collection(firestore, 'users'), 
      where('organizationId', '==', activeOrganizationId),
      where('isAuthorized', '==', true), 
      orderBy('name', 'asc')
    );
  }, [firestore, activeOrganizationId]);

  const { data: users } = useCollection<UserProfile>(usersQuery);

  const userOptions = React.useMemo(() => 
    users?.map(u => ({ label: u.name, value: u.id })) || [], 
  [users]);

  const renderConfigBlock = (
    type: 'internal' | 'respondent' | 'external',
    config: NotificationConfig,
    onChange: (val: NotificationConfig) => void,
    title: string,
    subtitle: string,
    icon: React.ReactNode,
    recipientTypeMatch: 'respondent' | 'internal_alert' | 'external_alert'
  ) => {
    const isEnabled = config.enabled;

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
                  <MultiSelect
                    options={userOptions}
                    value={config.userIds || []}
                    onChange={(val) => onChange({ ...config, userIds: val })}
                    placeholder="Select team members to notify..."
                    className="rounded-xl bg-background"
                  />
                  <p className="text-[9px] font-bold text-muted-foreground/60 tracking-tight leading-relaxed italic">
                    Select team members who will receive notifications for this form submission.
                  </p>
                </div>
              ) : type === 'external' ? (
                <div className="space-y-4">
                  <Label className="text-[10px] font-semibold text-primary ml-1">External Alert Emails</Label>
                  <TagInput 
                    value={config.emailAddresses || []}
                    onChange={(val) => onChange({ ...config, emailAddresses: val })}
                    placeholder="Enter emails to notify..."
                  />
                  <p className="text-[9px] font-bold text-muted-foreground/60 tracking-tight leading-relaxed italic">
                    Add comma or semicolon-separated email addresses to notify external stakeholders.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Label className="text-[10px] font-semibold text-primary ml-1">Respondent Contact Fields</Label>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Email Field Variable</Label>
                      {availableFields && availableFields.length > 0 ? (
                        <Select
                          value={config.respondentEmailField || ''}
                          onValueChange={(val) => onChange({ ...config, respondentEmailField: val })}
                        >
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                            <SelectValue placeholder="Select email field..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {availableFields.filter(f => f.type === 'email').map(f => (
                              <SelectItem key={f.value} value={f.value}>{f.label} ({`{{${f.value}}}`})</SelectItem>
                            ))}
                            {availableFields.filter(f => f.type !== 'email').length > 0 && (
                              <>
                                <Separator className="my-1" />
                                <div className="px-2 py-1 text-[9px] text-muted-foreground font-semibold">Other Fields</div>
                                {availableFields.filter(f => f.type !== 'email').map(f => (
                                  <SelectItem key={f.value} value={f.value}>{f.label} ({`{{${f.value}}}`})</SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={config.respondentEmailField || ''}
                          onChange={(e) => onChange({ ...config, respondentEmailField: e.target.value })}
                          placeholder="e.g. contact_email"
                          className="h-9 rounded-xl text-xs bg-background"
                        />
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Phone Field Variable (for SMS)</Label>
                      {availableFields && availableFields.length > 0 ? (
                        <Select
                          value={config.respondentPhoneField || ''}
                          onValueChange={(val) => onChange({ ...config, respondentPhoneField: val })}
                        >
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                            <SelectValue placeholder="Select phone field..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {availableFields.filter(f => f.type === 'phone').map(f => (
                              <SelectItem key={f.value} value={f.value}>{f.label} ({`{{${f.value}}}`})</SelectItem>
                            ))}
                            {availableFields.filter(f => f.type !== 'phone').length > 0 && (
                              <>
                                <Separator className="my-1" />
                                <div className="px-2 py-1 text-[9px] text-muted-foreground font-semibold">Other Fields</div>
                                {availableFields.filter(f => f.type !== 'phone').map(f => (
                                  <SelectItem key={f.value} value={f.value}>{f.label} ({`{{${f.value}}}`})</SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={config.respondentPhoneField || ''}
                          onChange={(e) => onChange({ ...config, respondentPhoneField: e.target.value })}
                          placeholder="e.g. contact_phone"
                          className="h-9 rounded-xl text-xs bg-background"
                        />
                      )}
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
                  <MessagingTemplateSelector 
                    category="forms"
                    recipientType={recipientTypeMatch}
                    channel="email"
                    value={config.emailTemplateId}
                    onValueChange={(val) => onChange({ ...config, emailTemplateId: val })}
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
                  <MessagingTemplateSelector
                    category="forms"
                    recipientType={recipientTypeMatch}
                    channel="sms"
                    value={config.smsTemplateId}
                    onValueChange={(val) => onChange({ ...config, smsTemplateId: val })}
                    placeholder="Select SMS blueprint..."
                    compact
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-2 px-1">
                    <MessageCircle className="h-3 w-3" /> WhatsApp Template
                  </Label>
                  <MessagingTemplateSelector
                    category="forms"
                    recipientType={recipientTypeMatch}
                    channel="whatsapp"
                    value={config.whatsappTemplateId}
                    onValueChange={(val) => onChange({ ...config, whatsappTemplateId: val })}
                    placeholder="Select approved WhatsApp template..."
                    compact
                  />
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
      {renderConfigBlock('external', externalAlerts, onChangeExternal, 'External Contact Alerts', 'Notify external stakeholders via email', <Mail className="h-6 w-6" />, 'external_alert')}

      {quickCreateState && (
        <TemplateWorkshopSheet 
          open={quickCreateState.open}
          onOpenChange={(o) => !o && setQuickCreateState(null)}
          templateId={quickCreateState.templateId}
          initialContext={{
            channel: quickCreateState.channel,
            category: "forms",
            recipientType: quickCreateState.type === 'internal' ? 'internal_alert' : quickCreateState.type === 'external' ? 'external_alert' : 'respondent'
          }}
          onCreated={(template) => {
            if (quickCreateState.type === 'internal') {
              if (quickCreateState.channel === 'email') onChangeInternal({ ...internalAlerts, emailTemplateId: template.id });
              else onChangeInternal({ ...internalAlerts, smsTemplateId: template.id });
            } else if (quickCreateState.type === 'external') {
              if (quickCreateState.channel === 'email') onChangeExternal({ ...externalAlerts, emailTemplateId: template.id });
              else onChangeExternal({ ...externalAlerts, smsTemplateId: template.id });
            } else {
              if (quickCreateState.channel === 'email') onChangeRespondent({ ...respondentAlerts, emailTemplateId: template.id });
              else onChangeRespondent({ ...respondentAlerts, smsTemplateId: template.id });
            }
          }}
        />
      )}
    </div>
  );
}

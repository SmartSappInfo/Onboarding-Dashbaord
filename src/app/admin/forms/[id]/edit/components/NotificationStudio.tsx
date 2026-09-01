'use client';

/**
 * SmartSapp Forms 2.0: 3-Tier Multi-Channel Notification Studio
 * 
 * Manages Internal Staff Alerts (Tier 1), Respondent Confirmations & Auto-Responders (Tier 2),
 * and External Stakeholder Distribution Lists (Tier 3) with dynamic variable integration.
 */

import * as React from 'react';
import { 
  Bell, 
  Users, 
  Mail, 
  Smartphone, 
  MessageCircle, 
  PlusCircle, 
  Trash2, 
  Sparkles, 
  Send, 
  Sliders, 
  Zap, 
  Check, 
  Loader2,
  Tag
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Form, UserProfile, MessageTemplate } from '@/lib/types';
import type { 
  FormNotificationSettings, 
  InternalAlertConfig, 
  RespondentAlertConfig, 
  ExternalAlertConfig, 
  AutoResponderRule 
} from '@/lib/forms/form-notification-types';
import { sendTestFormNotificationAction } from '@/lib/forms/form-notification-actions';
import { VariablesPanel } from '@/components/shared/VariablesPanel';

interface NotificationStudioProps {
  form: Form;
  settings: FormNotificationSettings;
  onChange: (newSettings: FormNotificationSettings) => void;
  availableFields?: { label: string; value: string; type: string }[];
}

export default function NotificationStudio({
  form,
  settings,
  onChange,
  availableFields = [],
}: NotificationStudioProps) {
  const { toast } = useToast();
  const { activeOrganizationId, activeWorkspaceId } = useTenant();
  const firestore = useFirestore();

  const [showVariablesDrawer, setShowVariablesDrawer] = React.useState(false);
  const [testEmail, setTestEmail] = React.useState('');
  const [isSendingTest, setIsSendingTest] = React.useState(false);

  // Fallback defaults
  const internalAlerts: InternalAlertConfig = settings.internalAlerts || { enabled: false, userIds: [] };
  const respondentAlerts: RespondentAlertConfig = settings.respondentAlerts || { enabled: false, autoResponderRules: [] };
  const externalAlerts: ExternalAlertConfig = settings.externalAlerts || { enabled: false, emailAddresses: [] };

  // Fetch Workspace Users for Tier 1 Staff Picker
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

  // Fetch Message Templates for Dropdown Selectors
  const templatesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'message_templates'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [firestore, activeWorkspaceId]);

  const { data: templates } = useCollection<MessageTemplate>(templatesQuery);

  // Filter templates by channel
  const emailTemplates = React.useMemo(() => templates?.filter(t => t.channel === 'email') || [], [templates]);
  const smsTemplates = React.useMemo(() => templates?.filter(t => t.channel === 'sms') || [], [templates]);
  const whatsappTemplates = React.useMemo(() => templates?.filter(t => t.channel === 'whatsapp') || [], [templates]);

  // Handlers
  const handleUpdateInternal = (patch: Partial<InternalAlertConfig>) => {
    onChange({
      ...settings,
      internalAlerts: { ...internalAlerts, ...patch },
    });
  };

  const handleUpdateRespondent = (patch: Partial<RespondentAlertConfig>) => {
    onChange({
      ...settings,
      respondentAlerts: { ...respondentAlerts, ...patch },
    });
  };

  const handleUpdateExternal = (patch: Partial<ExternalAlertConfig>) => {
    onChange({
      ...settings,
      externalAlerts: { ...externalAlerts, ...patch },
    });
  };

  // Add Auto-Responder Rule
  const handleAddAutoResponderRule = () => {
    const newRule: AutoResponderRule = {
      id: `rule_${Date.now()}`,
      name: `Auto-Responder Rule #${(respondentAlerts.autoResponderRules?.length || 0) + 1}`,
      enabled: true,
      triggerType: 'immediate',
      channel: 'email',
      templateId: emailTemplates[0]?.id || '',
    };

    handleUpdateRespondent({
      autoResponderRules: [...(respondentAlerts.autoResponderRules || []), newRule],
    });
  };

  const handleRemoveAutoResponderRule = (id: string) => {
    handleUpdateRespondent({
      autoResponderRules: (respondentAlerts.autoResponderRules || []).filter(r => r.id !== id),
    });
  };

  // External Email Input State
  const [newEmailInput, setNewEmailInput] = React.useState('');
  const handleAddExternalEmail = () => {
    const email = newEmailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast({ title: 'Invalid Email', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }

    const currentList = externalAlerts.emailAddresses || [];
    if (currentList.includes(email)) return;

    handleUpdateExternal({ emailAddresses: [...currentList, email] });
    setNewEmailInput('');
  };

  const handleRemoveExternalEmail = (emailToRemove: string) => {
    handleUpdateExternal({
      emailAddresses: (externalAlerts.emailAddresses || []).filter(e => e !== emailToRemove),
    });
  };

  // Send Instant Test Notification
  const handleSendTestNotification = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      toast({ title: 'Invalid Test Email', description: 'Enter a valid email address.', variant: 'destructive' });
      return;
    }

    const templateId = respondentAlerts.emailTemplateId || internalAlerts.emailTemplateId || emailTemplates[0]?.id;
    if (!templateId) {
      toast({ title: 'No Email Template', description: 'Please configure an email template first.', variant: 'destructive' });
      return;
    }

    setIsSendingTest(true);
    try {
      const res = await sendTestFormNotificationAction({
        channel: 'email',
        templateId,
        recipient: testEmail.trim(),
        workspaceId: form.workspaceId,
        organizationId: form.organizationId,
        formTitle: form.internalName || form.title,
      });

      if (res.success) {
        toast({ title: 'Test Email Sent', description: `Dispatched test notification to ${testEmail}` });
        setTestEmail('');
      } else {
        toast({ title: 'Test Dispatch Failed', description: res.error, variant: 'destructive' });
      }
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* ── Top Bar with Variables Helper & Test Dispatcher ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-3xl bg-muted/20 border border-border/40">
        <div className="space-y-0.5">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            3-Tier Multi-Channel Notification Matrix
          </h2>
          <p className="text-xs text-muted-foreground">
            Configure automated alerts for internal staff, respondents, and external distribution lists.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowVariablesDrawer(!showVariablesDrawer)}
            className="h-9 px-3.5 rounded-2xl text-xs font-bold gap-1.5 border-primary/30 text-primary hover:bg-primary/5 min-h-[44px] sm:min-h-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Variables Helper</span>
          </Button>
        </div>
      </div>

      {/* Expandable Variables Helper Drawer */}
      {showVariablesDrawer && (
        <Card className="rounded-3xl border-primary/20 bg-card/60 shadow-lg overflow-hidden animate-in fade-in-50 duration-200">
          <CardHeader className="pb-3 border-b border-border/30">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Available Dynamic Variables (Single Source of Truth)
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowVariablesDrawer(false)} className="h-7 text-xs">
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <VariablesPanel
              workspaceId={form.workspaceId}
              organizationId={form.organizationId}
              featureContext="form"
              sourceId={form.id}
              onSelect={(token: string) => {
                navigator.clipboard.writeText(token);
                toast({ title: 'Variable Copied', description: `${token} copied to clipboard.` });
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* ── TIER 1: Internal Staff Alerts ── */}
      <Card className={`rounded-3xl border-2 transition-all duration-300 overflow-hidden ${
        internalAlerts.enabled ? 'border-primary/30 bg-card/60 shadow-md' : 'border-border/40 bg-card/20'
      }`}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl ${internalAlerts.enabled ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'bg-muted text-muted-foreground'}`}>
                <Users className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-base font-bold text-foreground">
                  Tier 1 — Internal Staff Alerts
                </CardTitle>
                <CardDescription className="text-xs">
                  Notify specific team members or dynamically assigned deal owners upon each new submission.
                </CardDescription>
              </div>
            </div>

            <Switch
              checked={internalAlerts.enabled}
              onCheckedChange={(val) => handleUpdateInternal({ enabled: val })}
              className="scale-110"
            />
          </div>
        </CardHeader>

        {internalAlerts.enabled && (
          <CardContent className="space-y-5 pt-2 border-t border-border/30">
            {/* Staff Recipient Selectors */}
            <div className="space-y-3">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Target Team Members
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {users?.map((u) => {
                  const isSelected = (internalAlerts.userIds || []).includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        const current = internalAlerts.userIds || [];
                        const updated = isSelected ? current.filter(id => id !== u.id) : [...current, u.id];
                        handleUpdateInternal({ userIds: updated });
                      }}
                      className={`h-11 px-3 rounded-2xl border text-xs font-semibold flex items-center justify-between transition-all ${
                        isSelected 
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/20' 
                          : 'border-border/60 hover:bg-muted/40 text-foreground'
                      }`}
                    >
                      <span className="truncate">{u.name || u.email}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Switch
                  checked={internalAlerts.notifyDealOwner || false}
                  onCheckedChange={(val) => handleUpdateInternal({ notifyDealOwner: val })}
                />
                <Label className="text-xs text-muted-foreground font-semibold cursor-pointer">
                  Also dynamically alert the assigned CRM Deal / Task Owner (from Phase 4 routing)
                </Label>
              </div>
            </div>

            <Separator className="bg-border/30" />

            {/* Channel Template Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-blue-500" />
                  Staff Email Template
                </Label>
                <Select
                  value={internalAlerts.emailTemplateId || 'none'}
                  onValueChange={(val) => handleUpdateInternal({ emailTemplateId: val === 'none' ? undefined : val })}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue placeholder="Select Email Template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Email Alert</SelectItem>
                    {emailTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-purple-500" />
                  Staff SMS Template
                </Label>
                <Select
                  value={internalAlerts.smsTemplateId || 'none'}
                  onValueChange={(val) => handleUpdateInternal({ smsTemplateId: val === 'none' ? undefined : val })}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue placeholder="Select SMS Template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No SMS Alert</SelectItem>
                    {smsTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                  Staff WhatsApp Template
                </Label>
                <Select
                  value={internalAlerts.whatsappTemplateId || 'none'}
                  onValueChange={(val) => handleUpdateInternal({ whatsappTemplateId: val === 'none' ? undefined : val })}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue placeholder="Select WhatsApp Template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No WhatsApp Alert</SelectItem>
                    {whatsappTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── TIER 2: Respondent Confirmations & Auto-Responders ── */}
      <Card className={`rounded-3xl border-2 transition-all duration-300 overflow-hidden ${
        respondentAlerts.enabled ? 'border-primary/30 bg-card/60 shadow-md' : 'border-border/40 bg-card/20'
      }`}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl ${respondentAlerts.enabled ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'bg-muted text-muted-foreground'}`}>
                <Zap className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-base font-bold text-foreground">
                  Tier 2 — Respondent Confirmations & Auto-Responders
                </CardTitle>
                <CardDescription className="text-xs">
                  Send instant multi-channel confirmation receipts and conditional follow-up messages to the respondent.
                </CardDescription>
              </div>
            </div>

            <Switch
              checked={respondentAlerts.enabled}
              onCheckedChange={(val) => handleUpdateRespondent({ enabled: val })}
              className="scale-110"
            />
          </div>
        </CardHeader>

        {respondentAlerts.enabled && (
          <CardContent className="space-y-5 pt-2 border-t border-border/30">
            {/* Contact Field Bindings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-muted/20 border border-border/40">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Respondent Email Field</Label>
                <Select
                  value={respondentAlerts.respondentEmailField || ''}
                  onValueChange={(val) => handleUpdateRespondent({ respondentEmailField: val })}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl bg-background">
                    <SelectValue placeholder="Select email question field" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label} ({f.value})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Respondent Phone Field</Label>
                <Select
                  value={respondentAlerts.respondentPhoneField || ''}
                  onValueChange={(val) => handleUpdateRespondent({ respondentPhoneField: val })}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl bg-background">
                    <SelectValue placeholder="Select phone question field" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label} ({f.value})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Standard Multi-Channel Confirmation Templates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-blue-500" />
                  Respondent Email Receipt
                </Label>
                <Select
                  value={respondentAlerts.emailTemplateId || 'none'}
                  onValueChange={(val) => handleUpdateRespondent({ emailTemplateId: val === 'none' ? undefined : val })}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue placeholder="Select Email Template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Email Receipt</SelectItem>
                    {emailTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-purple-500" />
                  Respondent SMS Receipt
                </Label>
                <Select
                  value={respondentAlerts.smsTemplateId || 'none'}
                  onValueChange={(val) => handleUpdateRespondent({ smsTemplateId: val === 'none' ? undefined : val })}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue placeholder="Select SMS Template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No SMS Receipt</SelectItem>
                    {smsTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                  Respondent WhatsApp Receipt
                </Label>
                <Select
                  value={respondentAlerts.whatsappTemplateId || 'none'}
                  onValueChange={(val) => handleUpdateRespondent({ whatsappTemplateId: val === 'none' ? undefined : val })}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue placeholder="Select WhatsApp Template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No WhatsApp Receipt</SelectItem>
                    {whatsappTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Conditional Auto-Responder Rules */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-primary" />
                  Conditional Auto-Responder Rules ({respondentAlerts.autoResponderRules?.length || 0})
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddAutoResponderRule}
                  className="h-8 px-3 rounded-xl text-xs font-bold gap-1 text-primary border-primary/30 hover:bg-primary/5"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Add Rule
                </Button>
              </div>

              {(respondentAlerts.autoResponderRules || []).map((rule) => (
                <div key={rule.id} className="p-4 rounded-2xl bg-muted/10 border border-border/40 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      value={rule.name}
                      onChange={(e) => {
                        const updated = (respondentAlerts.autoResponderRules || []).map(r => r.id === rule.id ? { ...r, name: e.target.value } : r);
                        handleUpdateRespondent({ autoResponderRules: updated });
                      }}
                      className="h-8 text-xs font-bold bg-background max-w-xs rounded-xl"
                    />

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAutoResponderRule(rule.id)}
                        className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Trigger Condition</Label>
                      <Select
                        value={rule.triggerType}
                        onValueChange={(val) => {
                          const updated = (respondentAlerts.autoResponderRules || []).map(r => r.id === rule.id ? { ...r, triggerType: val as 'immediate'|'score_threshold'|'conditional' } : r);
                          handleUpdateRespondent({ autoResponderRules: updated });
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Always Send (Immediate)</SelectItem>
                          <SelectItem value="score_threshold">Lead Score Threshold</SelectItem>
                          <SelectItem value="conditional">Field Answer Matches</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Channel</Label>
                      <Select
                        value={rule.channel}
                        onValueChange={(val) => {
                          const updated = (respondentAlerts.autoResponderRules || []).map(r => r.id === rule.id ? { ...r, channel: val as 'email'|'sms'|'whatsapp' } : r);
                          handleUpdateRespondent({ autoResponderRules: updated });
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Template</Label>
                      <Select
                        value={rule.templateId}
                        onValueChange={(val) => {
                          const updated = (respondentAlerts.autoResponderRules || []).map(r => r.id === rule.id ? { ...r, templateId: val } : r);
                          handleUpdateRespondent({ autoResponderRules: updated });
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          {(rule.channel === 'email' ? emailTemplates : rule.channel === 'sms' ? smsTemplates : whatsappTemplates).map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── TIER 3: External Stakeholder Distribution Lists ── */}
      <Card className={`rounded-3xl border-2 transition-all duration-300 overflow-hidden ${
        externalAlerts.enabled ? 'border-primary/30 bg-card/60 shadow-md' : 'border-border/40 bg-card/20'
      }`}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl ${externalAlerts.enabled ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'bg-muted text-muted-foreground'}`}>
                <Mail className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-base font-bold text-foreground">
                  Tier 3 — External Distribution Lists
                </CardTitle>
                <CardDescription className="text-xs">
                  Forward submission summaries to arbitrary third-party partners, vendors, or external accountants.
                </CardDescription>
              </div>
            </div>

            <Switch
              checked={externalAlerts.enabled}
              onCheckedChange={(val) => handleUpdateExternal({ enabled: val })}
              className="scale-110"
            />
          </div>
        </CardHeader>

        {externalAlerts.enabled && (
          <CardContent className="space-y-5 pt-2 border-t border-border/30">
            {/* Email Address Tag Manager */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                External Email Recipients
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  placeholder="e.g. partner@school.edu"
                  className="h-10 text-xs rounded-xl bg-background flex-1"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddExternalEmail(); } }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddExternalEmail}
                  className="h-10 px-4 rounded-xl text-xs font-bold gap-1 min-h-[44px] sm:min-h-0"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Add Email
                </Button>
              </div>

              {/* Email Chips */}
              <div className="flex flex-wrap gap-2 pt-1">
                {(externalAlerts.emailAddresses || []).map((email) => (
                  <Badge
                    key={email}
                    variant="secondary"
                    className="h-7 px-3 rounded-xl text-xs font-mono flex items-center gap-1.5"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveExternalEmail(email)}
                      className="text-muted-foreground hover:text-rose-500 font-bold ml-1"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <Label className="text-xs font-bold text-muted-foreground">External Summary Email Template</Label>
              <Select
                value={externalAlerts.emailTemplateId || 'none'}
                onValueChange={(val) => handleUpdateExternal({ emailTemplateId: val === 'none' ? undefined : val })}
              >
                <SelectTrigger className="h-10 text-xs rounded-xl">
                  <SelectValue placeholder="Select Email Template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default Summary Layout</SelectItem>
                  {emailTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Test Notification Dispatcher Strip ── */}
      <div className="p-4 rounded-3xl bg-muted/20 border border-border/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5 text-primary" />
            Verify Notification Delivery
          </p>
          <p className="text-[11px] text-muted-foreground">
            Send a sample test notification with simulated variable replacements to check formatting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="your-email@example.com"
            className="h-9 text-xs rounded-xl bg-background max-w-[220px]"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleSendTestNotification}
            disabled={isSendingTest || !testEmail}
            className="h-9 px-4 rounded-xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0"
          >
            {isSendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send Test
          </Button>
        </div>
      </div>
    </div>
  );
}

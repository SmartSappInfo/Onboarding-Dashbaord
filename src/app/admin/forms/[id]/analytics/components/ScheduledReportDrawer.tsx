'use client';

/**
 * SmartSapp Forms 2.0: Scheduled Report Delivery Configuration Drawer
 * 
 * Configures recurring automated email report dispatches (Daily, Weekly, Monthly)
 * to designated team members and stakeholders with instant test delivery verification.
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Mail,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  X,
  ShieldCheck,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Form } from '@/lib/types';
import type {
  ScheduledFormReportConfig,
  ScheduledReportFrequency,
  FormReportPreset,
  ScheduledReportRecipient,
} from '@/lib/forms/form-report-types';
import {
  getScheduledReportConfigAction,
  saveScheduledReportConfigAction,
  sendTestReportEmailAction,
} from '@/lib/forms/form-reports-actions';

interface ScheduledReportDrawerProps {
  formId: string;
  formTitle?: string;
  workspaceId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ScheduledReportDrawer({
  formId,
  formTitle = 'Form',
  workspaceId = 'default',
  isOpen,
  onClose,
}: ScheduledReportDrawerProps) {
  const { toast } = useToast();
  const [isEnabled, setIsEnabled] = useState(false);
  const [frequency, setFrequency] = useState<ScheduledReportFrequency>('weekly');
  const [preset, setPreset] = useState<FormReportPreset>('executive_summary');
  const [recipients, setRecipients] = useState<ScheduledReportRecipient[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen, formId]);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const res = await getScheduledReportConfigAction({ formId });
      if (res.success && res.config) {
        setIsEnabled(res.config.enabled);
        setFrequency(res.config.frequency);
        setPreset(res.config.preset);
        setRecipients(res.config.recipients || []);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEmail = () => {
    const trimmed = emailInput.trim();
    if (!trimmed) return;
    if (!trimmed.includes('@') || !trimmed.includes('.')) {
      toast({ variant: 'destructive', title: 'Invalid Email', description: 'Please enter a valid email address.' });
      return;
    }
    if (recipients.some(r => r.email.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: 'Already Added', description: 'This email is already in the recipient list.' });
      return;
    }

    setRecipients(prev => [...prev, { email: trimmed }]);
    setEmailInput('');
  };

  const handleRemoveEmail = (email: string) => {
    setRecipients(prev => prev.filter(r => r.email !== email));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: ScheduledFormReportConfig = {
        id: `sched_${formId}`,
        workspaceId,
        formId,
        formTitle,
        enabled: isEnabled,
        frequency,
        timeOfDay: '08:00',
        dayOfWeek: 1, // Monday
        recipients,
        preset,
        createdAt: new Date().toISOString(),
      };

      const res = await saveScheduledReportConfigAction({ config: payload });
      if (res.success) {
        toast({ title: 'Saved Configuration ✨', description: 'Scheduled report settings updated successfully.' });
        onClose();
      } else {
        toast({ variant: 'destructive', title: 'Save Failed', description: res.error });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (recipients.length === 0 && !emailInput.trim()) {
      toast({ variant: 'destructive', title: 'Recipient Required', description: 'Add at least one recipient email.' });
      return;
    }

    const target = emailInput.trim() || recipients[0]?.email;
    setIsSendingTest(true);
    try {
      const res = await sendTestReportEmailAction({
        formId,
        targetEmail: target,
        preset,
      });

      if (res.success) {
        toast({ title: 'Test Email Dispatched ✨', description: res.message });
      } else {
        toast({ variant: 'destructive', title: 'Test Failed', description: res.error });
      }
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-background border-l border-border/60 shadow-2xl">
        {/* Header */}
        <SheetHeader className="p-5 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle className="text-sm font-bold text-foreground">
                Scheduled Email Reports
              </SheetTitle>
              <p className="text-[11px] text-muted-foreground">{formTitle} Automated Dispatches</p>
            </div>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="py-16 text-center space-y-2">
              <Loader2 className="h-6 w-6 text-primary animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground">Loading configuration...</p>
            </div>
          ) : (
            <>
              {/* Enable Schedule Switch */}
              <div className="p-4 rounded-2xl bg-card border border-border/60 flex items-center justify-between shadow-xs">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-foreground block">Active Automated Delivery</span>
                  <span className="text-[11px] text-muted-foreground">Send report on recurring schedule</span>
                </div>
                <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
              </div>

              {/* Frequency Selector */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Delivery Frequency
                </span>
                <Select value={frequency} onValueChange={(val) => setFrequency(val as ScheduledReportFrequency)}>
                  <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-card border-border/60">
                    <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="daily">Daily at 8:00 AM</SelectItem>
                    <SelectItem value="weekly">Weekly on Monday at 8:00 AM</SelectItem>
                    <SelectItem value="monthly">Monthly on the 1st at 8:00 AM</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Report Preset Selector */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Report Preset
                </span>
                <Select value={preset} onValueChange={(val) => setPreset(val as FormReportPreset)}>
                  <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-card border-border/60">
                    <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="executive_summary">Executive Summary</SelectItem>
                    <SelectItem value="lead_generation">Lead & Revenue Pipeline</SelectItem>
                    <SelectItem value="qualitative_research">Voice of Customer & Sentiment</SelectItem>
                    <SelectItem value="campaign_attribution">Campaign Attribution</SelectItem>
                    <SelectItem value="ux_friction">UX Friction Audit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Recipients Tag Manager */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Target Recipient Emails
                </span>
                <div className="flex gap-2">
                  <Input
                    placeholder="colleague@company.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEmail())}
                    className="h-9 rounded-xl text-xs"
                  />
                  <Button
                    type="button"
                    onClick={handleAddEmail}
                    size="sm"
                    className="h-9 rounded-xl text-xs font-bold px-3 gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {recipients.map((r) => (
                    <span
                      key={r.email}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-muted border border-border/60 text-xs font-semibold text-foreground"
                    >
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      {r.email}
                      <button
                        type="button"
                        onClick={() => handleRemoveEmail(r.email)}
                        className="text-muted-foreground hover:text-foreground ml-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {recipients.length === 0 && (
                    <p className="text-[11px] text-muted-foreground italic py-1">No recipients configured.</p>
                  )}
                </div>
              </div>

              {/* Test Send Box */}
              <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/40 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Delivery Verification
                </span>
                <Button
                  onClick={handleSendTest}
                  disabled={isSendingTest}
                  variant="outline"
                  size="sm"
                  className="w-full h-9 rounded-xl text-xs font-bold gap-1.5 border-border/60 min-h-[36px]"
                >
                  {isSendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Send Test Report Now
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/40 flex items-center justify-end gap-2 bg-muted/20">
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl text-xs font-bold h-9">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            className="rounded-xl text-xs font-bold h-9 px-4 gap-1.5"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Save Schedule
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

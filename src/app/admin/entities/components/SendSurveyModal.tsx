'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Direct CRM Survey Dispatch Modal
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Direct one-click survey dispatch from CRM Entity & Contact profiles.
 * 2. Multi-channel delivery: WhatsApp, Email, SMS.
 * 3. Mobile ergonomics: min-h-[44px] touch targets, active:scale-[0.97] tactile press.
 * 4. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import {
  getWorkspaceActiveSurveysAction,
  sendSurveyToContactAction,
  type ActiveSurveyOption,
} from '@/lib/surveys/survey-crm-trigger-actions';
import { useToast } from '@/hooks/use-toast';

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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Send,
  Mail,
  MessageSquare,
  Phone,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileQuestion,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EntityContactOption {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  isPrimary?: boolean;
}

export interface SendSurveyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityName: string;
  contacts?: EntityContactOption[];
  workspaceId: string;
  onSent?: () => void;
}

export function SendSurveyModal({
  open,
  onOpenChange,
  entityId,
  entityName,
  contacts = [],
  workspaceId,
  onSent,
}: SendSurveyModalProps) {
  const { toast } = useToast();

  const [surveys, setSurveys] = React.useState<ActiveSurveyOption[]>([]);
  const [isLoadingSurveys, setIsLoadingSurveys] = React.useState(true);
  const [selectedSurveyId, setSelectedSurveyId] = React.useState<string>('');
  
  const [selectedContactId, setSelectedContactId] = React.useState<string>('');
  const [recipientName, setRecipientName] = React.useState<string>('');
  const [recipientEmail, setRecipientEmail] = React.useState<string>('');
  const [recipientPhone, setRecipientPhone] = React.useState<string>('');
  
  const [channel, setChannel] = React.useState<'whatsapp' | 'email' | 'sms'>('whatsapp');
  const [customNote, setCustomNote] = React.useState<string>('');
  const [isSending, setIsSending] = React.useState(false);

  // Load active surveys for the workspace
  React.useEffect(() => {
    if (!open || !workspaceId) return;

    setIsLoadingSurveys(true);
    getWorkspaceActiveSurveysAction(workspaceId)
      .then((res) => {
        if (res.success && res.surveys.length > 0) {
          setSurveys(res.surveys);
          setSelectedSurveyId(res.surveys[0].id);
        } else {
          setSurveys([]);
        }
      })
      .catch((err) => {
        console.error('[SendSurveyModal] Error loading surveys:', err);
      })
      .finally(() => {
        setIsLoadingSurveys(false);
      });
  }, [open, workspaceId]);

  // Set default contact
  React.useEffect(() => {
    if (contacts.length > 0) {
      const primary = contacts.find((c) => c.isPrimary) || contacts[0];
      setSelectedContactId(primary.id || 'manual');
      setRecipientName(primary.name || '');
      setRecipientEmail(primary.email || '');
      setRecipientPhone(primary.phone || '');
    } else {
      setSelectedContactId('manual');
      setRecipientName(entityName);
    }
  }, [contacts, entityName]);

  const handleContactSelect = (contactId: string) => {
    setSelectedContactId(contactId);
    if (contactId === 'manual') {
      setRecipientName(entityName);
      setRecipientEmail('');
      setRecipientPhone('');
      return;
    }

    const c = contacts.find((item) => item.id === contactId);
    if (c) {
      setRecipientName(c.name || '');
      setRecipientEmail(c.email || '');
      setRecipientPhone(c.phone || '');
    }
  };

  const selectedSurvey = surveys.find((s) => s.id === selectedSurveyId);

  const handleSend = async () => {
    if (!selectedSurveyId) {
      toast({
        variant: 'destructive',
        title: 'Select a Survey',
        description: 'Please select an active survey to dispatch.',
      });
      return;
    }

    if (channel === 'email' && !recipientEmail) {
      toast({
        variant: 'destructive',
        title: 'Missing Email',
        description: 'Please enter a valid recipient email address.',
      });
      return;
    }

    if ((channel === 'whatsapp' || channel === 'sms') && !recipientPhone) {
      toast({
        variant: 'destructive',
        title: 'Missing Phone Number',
        description: `Please enter a valid phone number for ${channel.toUpperCase()} dispatch.`,
      });
      return;
    }

    setIsSending(true);
    try {
      const res = await sendSurveyToContactAction({
        surveyId: selectedSurveyId,
        workspaceId,
        entityId,
        entityName,
        contactId: selectedContactId !== 'manual' ? selectedContactId : undefined,
        recipientName: recipientName || 'Valued Respondent',
        recipientEmail: recipientEmail || undefined,
        recipientPhone: recipientPhone || undefined,
        channel,
        customNote: customNote.trim() || undefined,
      });

      if (res.success) {
        toast({
          title: 'Survey Dispatched',
          description: `Survey "${selectedSurvey?.title}" was dispatched via ${channel.toUpperCase()}.`,
        });
        onOpenChange(false);
        onSent?.();
      } else {
        toast({
          variant: 'destructive',
          title: 'Dispatch Failed',
          description: res.error || 'Failed to send survey invitation.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected network error occurred while sending the survey.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Dispatch Survey to {entityName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Send a personalized survey invitation directly via WhatsApp, Email, or SMS with encrypted tracking tokens.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Step 1: Select Survey */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold flex items-center justify-between">
              <span>1. Select Survey</span>
              {selectedSurvey?.category && (
                <Badge variant="outline" className="text-[10px] font-mono capitalize">
                  {selectedSurvey.category}
                </Badge>
              )}
            </Label>

            {isLoadingSurveys ? (
              <div className="h-10 rounded-xl bg-muted/40 animate-pulse flex items-center px-3 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading active surveys...
              </div>
            ) : surveys.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                No published surveys available in this workspace. Please publish a survey first.
              </div>
            ) : (
              <Select value={selectedSurveyId} onValueChange={setSelectedSurveyId}>
                <SelectTrigger className="h-10 text-xs font-semibold rounded-xl">
                  <SelectValue placeholder="Choose a survey..." />
                </SelectTrigger>
                <SelectContent>
                  {surveys.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <FileQuestion className="h-3.5 w-3.5 text-primary" />
                        <span className="font-semibold">{s.title}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Step 2: Select Recipient Contact */}
          <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/10">
            <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
              2. Recipient Details
            </Label>

            {contacts.length > 0 && (
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Choose from Linked Contacts</Label>
                <Select value={selectedContactId} onValueChange={handleContactSelect}>
                  <SelectTrigger className="h-9 text-xs rounded-lg font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c, i) => (
                      <SelectItem key={c.id || `contact_${i}`} value={c.id || `contact_${i}`} className="text-xs">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{c.name || 'Unnamed'}</span>
                          {c.role && <span className="text-[10px] text-muted-foreground">({c.role})</span>}
                          {c.isPrimary && <Badge variant="secondary" className="text-[9px] h-4">Primary</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="manual" className="text-xs font-semibold text-primary">
                      + Enter Custom Contact
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Recipient Name</Label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  className="h-8 text-xs rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Email Address</Label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="h-8 text-xs rounded-lg"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label className="text-[11px] text-muted-foreground">Phone Number (E.164 with Country Code)</Label>
                <Input
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="+233XXXXXXXXX or +1XXXXXXXXXX"
                  className="h-8 text-xs rounded-lg font-mono"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Choose Channel */}
          <div className="space-y-2">
            <Label className="text-xs font-bold">3. Delivery Channel</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setChannel('whatsapp')}
                className={cn(
                  'flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all active:scale-[0.97] min-h-[44px]',
                  channel === 'whatsapp'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/30'
                )}
              >
                <Phone className="h-4 w-4" />
                WhatsApp
              </button>

              <button
                type="button"
                onClick={() => setChannel('email')}
                className={cn(
                  'flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all active:scale-[0.97] min-h-[44px]',
                  channel === 'email'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/30'
                )}
              >
                <Mail className="h-4 w-4" />
                Email
              </button>

              <button
                type="button"
                onClick={() => setChannel('sms')}
                className={cn(
                  'flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all active:scale-[0.97] min-h-[44px]',
                  channel === 'sms'
                    ? 'border-purple-500 bg-purple-500/10 text-purple-600 shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/30'
                )}
              >
                <MessageSquare className="h-4 w-4" />
                SMS
              </button>
            </div>
          </div>

          {/* Step 4: Custom Message / Note */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold flex items-center justify-between">
              <span>4. Custom Introductory Note (Optional)</span>
              <span className="text-[10px] text-muted-foreground">Survey link is appended automatically</span>
            </Label>
            <Textarea
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="e.g. Hi Sarah, thank you for your recent visit! Could you take 2 minutes to share your feedback?"
              rows={2}
              className="text-xs rounded-xl resize-none"
            />
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
            className="h-10 px-4 text-xs font-semibold active:scale-[0.97] min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={isSending || surveys.length === 0}
            className="h-10 px-5 gap-2 text-xs font-semibold active:scale-[0.97] min-h-[44px]"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Dispatching...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Survey
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

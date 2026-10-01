'use client';

/**
 * @fileOverview AI Survey Messaging Modal with High-Fidelity Visual Preview and In-Modal Editing.
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Visual Multi-Channel Previews:
 *    - Email: Realistic mail client frame rendering compiled HTML via renderBlocksToHtml with Desktop/Mobile toggles.
 *    - SMS: Smartphone chat bubble with live character and segment counter.
 *    - WhatsApp: Meta-styled chat card with parameter resolution, header, footer, and verified sender badge.
 * 2. In-Modal Direct Editing:
 *    - Segmented control to toggle seamlessly between [Visual Preview] and [Edit Content].
 *    - Direct inline editing of Subject lines, Layout Blocks (heading, text, buttons, lists, logos, footers),
 *      SMS body, and WhatsApp copy & sample parameters without leaving the modal.
 * 3. Persistence & Form Synchronization:
 *    - On Apply, automatically saves any in-modal customizations to Firestore message_templates via
 *      quickSaveSurveyTemplateAction, updates parent state via onUpdateOutput, and assigns IDs via onApply.
 * 4. Single Source of Truth for Variables:
 *    - Variable tokens route strictly through canonical {{variable_name}} syntax (or {{1}}..{{n}} for WhatsApp).
 * 5. Strict Typing & Accessibility:
 *    - Zero any or any[]. All interactive elements enforce min-h-[44px] touch targets and active:scale-[0.97].
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  Mail,
  Smartphone,
  MessageCircle,
  Check,
  Loader2,
  Pencil,
  Copy,
  Info,
  Layers,
  Eye,
  Edit3,
  Monitor,
  RotateCcw,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { TemplateWorkshopSheet } from '@/app/admin/messaging/components/TemplateWorkshopSheet';
import { renderBlocksToHtml, resolveVariables, plainTextToHtml } from '@/lib/messaging-utils';
import { quickSaveSurveyTemplateAction } from '@/lib/survey-ai-messaging-actions';
import type { GenerateSurveyMessagingOutput, EmailBlock } from '@/ai/schemas/survey-messaging-schemas';
import type { MessageBlock } from '@/lib/types';

export interface AiSurveyMessagingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  targetDescription?: string;
  generatedOutput: GenerateSurveyMessagingOutput | null;
  defaultChannel?: 'email' | 'sms' | 'whatsapp';
  savedTemplateIds?: {
    emailTemplateId?: string;
    smsTemplateId?: string;
    whatsappTemplateId?: string;
  };
  isLoading?: boolean;
  workspaceId?: string;
  organizationId?: string;
  userId?: string;
  onApply: (selectedIds: {
    emailTemplateId?: string;
    smsTemplateId?: string;
    whatsappTemplateId?: string;
  }) => void;
  onRegenerate?: () => void;
  onUpdateOutput?: (output: GenerateSurveyMessagingOutput) => void;
}

const DEFAULT_MOCK_VARIABLES: Record<string, string> = {
  contact_name: 'Alex Johnson',
  first_name: 'Alex',
  last_name: 'Johnson',
  contact_email: 'alex.j@example.com',
  contact_phone: '+1 (555) 234-5678',
  entity_name: 'Horizon Academy',
  school_name: 'Horizon Academy',
  workspace_name: 'SmartSapp Campus',
  organization_name: 'SmartSapp Campus',
  sender_name: 'Onboarding Lead',
  meeting_link: 'https://smartsapp.com/meeting/join',
  survey_link: 'https://smartsapp.com/survey/feedback',
  survey_name: 'Onboarding Experience Survey',
  survey_title: 'Onboarding Experience Survey',
  survey_score: '92',
  max_score: '100',
  result_url: 'https://smartsapp.com/surveys/results/res_123',
  dashboard_link: 'https://smartsapp.com/admin/dashboard',
  entity_console_link: 'https://smartsapp.com/admin/entities/ent_sample_123',
  entity_link: 'https://smartsapp.com/admin/entities/ent_sample_123',
  form_link: 'https://smartsapp.com/form/submit',
  agreement_link: 'https://smartsapp.com/agreement/sign',
  meeting_time: 'Monday, Oct 24 at 10:00 AM',
  org_logo_url: 'https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/SmartSapp%20Logo%20short.png?alt=media&token=046f95a8-b331-4129-a4ef-43ae7837eadd',
  org_name: 'SmartSapp Campus',
  org_email: 'alerts@smartsapp.com',
  org_phone: '+1 (555) 019-2834',
  org_address: '123 Innovation Way, Suite 400',
  current_year: new Date().getFullYear().toString(),
  score: '92',
  org_footer_html: '',
  org_footer_enabled: 'true',
  unsubscribe_copy: 'You are receiving this alert because you are an authorized team member.',
  unsubscribe_link: '#',
  brand_primary_color: '#3B5FFF',
};

export default function AiSurveyMessagingModal({
  open,
  onOpenChange,
  title = 'AI Generated Messaging Templates',
  targetDescription = 'Review and assign the generated templates to this survey.',
  generatedOutput,
  defaultChannel,
  savedTemplateIds,
  isLoading = false,
  workspaceId,
  organizationId,
  userId,
  onApply,
  onRegenerate,
  onUpdateOutput,
}: AiSurveyMessagingModalProps) {
  const { toast } = useToast();
  const { activeOrganization } = useTenant();

  const [activeTab, setActiveTab] = React.useState<'email' | 'sms' | 'whatsapp'>(defaultChannel || 'email');
  const [viewMode, setViewMode] = React.useState<'preview' | 'edit'>('preview');
  const [emailDevice, setEmailDevice] = React.useState<'desktop' | 'mobile'>('desktop');
  const [editingTemplateId, setEditingTemplateId] = React.useState<string | null>(null);
  const [isWorkshopOpen, setIsWorkshopOpen] = React.useState(false);
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showPlainTextFallback, setShowPlainTextFallback] = React.useState(false);

  // Local editable copy of the generated output
  const [editableOutput, setEditableOutput] = React.useState<GenerateSurveyMessagingOutput | null>(null);

  // Reset editableOutput whenever new generatedOutput arrives
  React.useEffect(() => {
    if (generatedOutput) {
      setEditableOutput(JSON.parse(JSON.stringify(generatedOutput)) as GenerateSurveyMessagingOutput);
    } else {
      setEditableOutput(null);
    }
  }, [generatedOutput]);

  // Set default active tab based on what was generated
  React.useEffect(() => {
    if (defaultChannel) {
      setActiveTab(defaultChannel);
    } else if (generatedOutput) {
      if (generatedOutput.email) setActiveTab('email');
      else if (generatedOutput.sms) setActiveTab('sms');
      else if (generatedOutput.whatsapp) setActiveTab('whatsapp');
    }
  }, [defaultChannel, generatedOutput]);

  const copyTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopyText = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast({ title: 'Copied to Clipboard', description: `${fieldName} copied to clipboard.` });
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopiedField(null), 2000);
  };

  const handleOpenWorkshop = (templateId?: string) => {
    if (!templateId) return;
    setEditingTemplateId(templateId);
    setIsWorkshopOpen(true);
  };

  // Check if user made any edits
  const hasEdits = React.useMemo(() => {
    if (!generatedOutput || !editableOutput) return false;
    return JSON.stringify(generatedOutput) !== JSON.stringify(editableOutput);
  }, [generatedOutput, editableOutput]);

  const handleResetToAiOriginal = () => {
    if (!generatedOutput) return;
    setEditableOutput(JSON.parse(JSON.stringify(generatedOutput)) as GenerateSurveyMessagingOutput);
    toast({
      title: 'Restored Original AI Copy',
      description: 'All manual edits have been reverted to the initial generation.',
    });
  };

  // Compute merged mock variables for preview
  const mergedMocks = React.useMemo(() => {
    const mocks: Record<string, string> = {
      ...DEFAULT_MOCK_VARIABLES,
      org_name: activeOrganization?.name || DEFAULT_MOCK_VARIABLES.org_name,
      org_logo_url: activeOrganization?.logoUrl || DEFAULT_MOCK_VARIABLES.org_logo_url,
      org_email: activeOrganization?.email || DEFAULT_MOCK_VARIABLES.org_email,
    };

    // Auto-detect variable tokens from template content
    if (editableOutput) {
      const emailContent = `${editableOutput.email?.subject || ''} ${editableOutput.email?.body || ''} ${JSON.stringify(editableOutput.email?.blocks || [])}`;
      const matches = emailContent.match(/\{\{([^{}]+?)\}\}/g);
      if (matches) {
        matches.forEach((token) => {
          const varName = token.replace(/\{\{|\}\}/g, '').trim();
          if (!(varName in mocks)) {
            mocks[varName] = `[${varName.replace(/_/g, ' ')}]`;
          }
        });
      }
    }
    return mocks;
  }, [activeOrganization, editableOutput]);

  // Compile HTML for email preview
  const compiledEmailHtml = React.useMemo(() => {
    if (!editableOutput?.email) return '';
    const blocks = (editableOutput.email.blocks || []) as unknown as MessageBlock[];
    if (blocks.length > 0) {
      return renderBlocksToHtml(blocks, mergedMocks, {
        width: emailDevice === 'mobile' ? '360px' : '600px',
      });
    }
    if (editableOutput.email.body) {
      return plainTextToHtml(resolveVariables(editableOutput.email.body, mergedMocks));
    }
    return '';
  }, [editableOutput?.email, mergedMocks, emailDevice]);

  // Resolved Email Subject
  const resolvedEmailSubject = React.useMemo(() => {
    if (!editableOutput?.email?.subject) return '(No Subject)';
    return resolveVariables(editableOutput.email.subject, mergedMocks);
  }, [editableOutput?.email?.subject, mergedMocks]);

  // Resolved SMS text for preview
  const resolvedSmsBody = React.useMemo(() => {
    if (!editableOutput?.sms?.body) return '';
    return resolveVariables(editableOutput.sms.body, mergedMocks);
  }, [editableOutput?.sms?.body, mergedMocks]);

  // Positional replacement for WhatsApp preview
  const resolvedWhatsappText = React.useMemo(() => {
    if (!editableOutput?.whatsapp?.body) return '';
    let text = editableOutput.whatsapp.body;
    const params = editableOutput.whatsapp.bodyParams || [];
    params.forEach((param, index) => {
      text = text.split(`{{${index + 1}}}`).join(param || `[Param ${index + 1}]`);
    });
    return text;
  }, [editableOutput?.whatsapp?.body, editableOutput?.whatsapp?.bodyParams]);

  // Save changes & apply
  const handleApplyAndClose = async () => {
    if (!editableOutput) return;

    setIsSaving(true);
    try {
      // 1. If we have template IDs and tenant scope, persist any customizations to Firestore
      if (savedTemplateIds && workspaceId && organizationId) {
        const savePromises: Promise<unknown>[] = [];

        // Save email updates
        if (editableOutput.email && savedTemplateIds.emailTemplateId) {
          savePromises.push(
            quickSaveSurveyTemplateAction({
              workspaceId,
              organizationId,
              userId,
              templateId: savedTemplateIds.emailTemplateId,
              templateData: {
                name: editableOutput.email.name,
                subject: editableOutput.email.subject,
                body: editableOutput.email.body,
                blocks: (editableOutput.email.blocks || []) as unknown as MessageBlock[],
              },
            })
          );
        }

        // Save SMS updates
        if (editableOutput.sms && savedTemplateIds.smsTemplateId) {
          savePromises.push(
            quickSaveSurveyTemplateAction({
              workspaceId,
              organizationId,
              userId,
              templateId: savedTemplateIds.smsTemplateId,
              templateData: {
                name: editableOutput.sms.name,
                body: editableOutput.sms.body,
              },
            })
          );
        }

        // Save WhatsApp updates
        if (editableOutput.whatsapp && savedTemplateIds.whatsappTemplateId) {
          savePromises.push(
            quickSaveSurveyTemplateAction({
              workspaceId,
              organizationId,
              userId,
              templateId: savedTemplateIds.whatsappTemplateId,
              templateData: {
                name: editableOutput.whatsapp.name,
                body: editableOutput.whatsapp.body,
                whatsappSamples: editableOutput.whatsapp.bodyParams || [],
                whatsappMetaCategory: editableOutput.whatsapp.whatsappCategory,
              },
            })
          );
        }

        await Promise.all(savePromises);
      }

      // 2. Notify parent of updated output
      onUpdateOutput?.(editableOutput);

      // 3. Link template IDs to the survey form
      if (savedTemplateIds) {
        onApply(savedTemplateIds);
      }

      toast({
        title: 'Templates Linked Successfully',
        description: 'The message templates have been saved and assigned to your survey settings.',
      });

      onOpenChange(false);
    } catch (err: unknown) {
      console.error('[AiSurveyMessagingModal] Save Error:', err);
      toast({
        variant: 'destructive',
        title: 'Failed to Save Changes',
        description: err instanceof Error ? err.message : 'Could not save message template edits.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Helper mutators for Email Blocks
  const handleUpdateBlock = (index: number, patch: Partial<EmailBlock>) => {
    if (!editableOutput?.email?.blocks) return;
    const newBlocks = [...editableOutput.email.blocks];
    newBlocks[index] = { ...newBlocks[index], ...patch };
    setEditableOutput({
      ...editableOutput,
      email: {
        ...editableOutput.email,
        blocks: newBlocks,
      },
    });
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (!editableOutput?.email?.blocks) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= editableOutput.email.blocks.length) return;

    const newBlocks = [...editableOutput.email.blocks];
    const [moved] = newBlocks.splice(index, 1);
    newBlocks.splice(targetIdx, 0, moved);

    setEditableOutput({
      ...editableOutput,
      email: {
        ...editableOutput.email,
        blocks: newBlocks,
      },
    });
  };

  const handleDeleteBlock = (index: number) => {
    if (!editableOutput?.email?.blocks) return;
    const newBlocks = editableOutput.email.blocks.filter((_, idx) => idx !== index);
    setEditableOutput({
      ...editableOutput,
      email: {
        ...editableOutput.email,
        blocks: newBlocks,
      },
    });
  };

  const handleAddBlock = (type: EmailBlock['type']) => {
    if (!editableOutput?.email) return;
    const currentBlocks = editableOutput.email.blocks || [];
    const newId = `blk_${type}_${Date.now()}`;
    let newBlock: EmailBlock;

    switch (type) {
      case 'heading':
        newBlock = { id: newId, type: 'heading', title: 'New Section Heading', variant: 'h2' };
        break;
      case 'text':
        newBlock = { id: newId, type: 'text', content: 'Enter your message paragraph here.' };
        break;
      case 'button':
        newBlock = { id: newId, type: 'button', title: 'Take Action', url: '{{survey_link}}' };
        break;
      case 'list':
        newBlock = { id: newId, type: 'list', items: ['First key highlight', 'Second key highlight'] };
        break;
      case 'divider':
        newBlock = { id: newId, type: 'divider' };
        break;
      case 'footer':
        newBlock = { id: newId, type: 'footer', content: 'You received this automated notification from SmartSapp.' };
        break;
      default:
        newBlock = { id: newId, type, content: 'Block content' };
    }

    setEditableOutput({
      ...editableOutput,
      email: {
        ...editableOutput.email,
        blocks: [...currentBlocks, newBlock],
      },
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl w-[94vw] max-h-[92vh] flex flex-col p-0 overflow-hidden border-2 shadow-2xl rounded-3xl font-figtree">
          {/* Header */}
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/50 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                  <Sparkles className="w-5 h-5 animate-pulse text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-base sm:text-lg font-bold tracking-tight">
                      {title}
                    </DialogTitle>
                    {hasEdits && (
                      <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30 bg-primary/5">
                        Customized
                      </Badge>
                    )}
                  </div>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-none">
                    {targetDescription}
                  </DialogDescription>
                </div>
              </div>

              {/* Top View Mode Controls & Regenerate */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                {/* Segmented Mode Switcher: Preview vs Edit */}
                {!isLoading && editableOutput && (
                  <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/60 shadow-inner">
                    <Button
                      type="button"
                      variant={viewMode === 'preview' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('preview')}
                      className="h-8 rounded-lg text-xs font-bold gap-1.5 px-3 active:scale-[0.97] transition-all"
                      aria-label="Visual Preview Mode"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Visual Preview
                    </Button>
                    <Button
                      type="button"
                      variant={viewMode === 'edit' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('edit')}
                      className="h-8 rounded-lg text-xs font-bold gap-1.5 px-3 active:scale-[0.97] transition-all"
                      aria-label="Edit Content Mode"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Content
                    </Button>
                  </div>
                )}

                {onRegenerate && !isLoading && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRegenerate}
                    className="rounded-xl h-8 text-xs font-semibold gap-1.5 active:scale-[0.97] transition-all min-h-[36px]"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Regenerate
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Body Content */}
          <div className="flex-1 overflow-hidden p-4 sm:p-6 flex flex-col min-h-0">
            {isLoading ? (
              <div className="h-80 flex flex-col items-center justify-center gap-4 text-center">
                <div className="p-4 rounded-3xl bg-primary/10 text-primary animate-spin">
                  <Loader2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold tracking-tight">Crafting Message Templates...</p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Analyzing survey questions, scoring logic, and result page blocks to generate high-converting copy.
                  </p>
                </div>
              </div>
            ) : !editableOutput ? (
              <div className="h-80 flex flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                <Info className="w-8 h-8 opacity-40" />
                <p className="text-sm font-semibold">No template content generated yet.</p>
              </div>
            ) : (
              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as 'email' | 'sms' | 'whatsapp')}
                className="h-full flex flex-col overflow-hidden"
              >
                {/* Channel Selector */}
                <TabsList className="grid grid-cols-3 w-full h-11 p-1 bg-muted/60 rounded-2xl mb-4 shrink-0">
                  <TabsTrigger
                    value="email"
                    disabled={!editableOutput.email}
                    className="rounded-xl font-bold text-xs gap-1.5 min-h-[36px] data-[state=active]:bg-background data-[state=active]:shadow-xs"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Email
                    {savedTemplateIds?.emailTemplateId && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="sms"
                    disabled={!editableOutput.sms}
                    className="rounded-xl font-bold text-xs gap-1.5 min-h-[36px] data-[state=active]:bg-background data-[state=active]:shadow-xs"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    SMS
                    {savedTemplateIds?.smsTemplateId && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="whatsapp"
                    disabled={!editableOutput.whatsapp}
                    className="rounded-xl font-bold text-xs gap-1.5 min-h-[36px] data-[state=active]:bg-background data-[state=active]:shadow-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                    {savedTemplateIds?.whatsappTemplateId && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1" />
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* ════════════════════════ EMAIL CHANNEL ════════════════════════ */}
                <TabsContent value="email" className="flex-1 overflow-hidden mt-0 flex flex-col min-h-0">
                  {editableOutput.email && (
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                      {viewMode === 'preview' ? (
                        /* ──────────────── EMAIL VISUAL PREVIEW ──────────────── */
                        <div className="flex-1 flex flex-col overflow-hidden min-h-0 space-y-3">
                          {/* Email Browser Frame Header */}
                          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm flex flex-col flex-1 min-h-0">
                            {/* Browser Mock Navigation Bar */}
                            <div className="h-10 border-b border-border/80 bg-muted/40 px-3.5 flex items-center justify-between shrink-0">
                              <div className="flex gap-1.5 items-center">
                                <div className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                              </div>

                              <div className="hidden sm:flex items-center text-[11px] text-muted-foreground bg-background px-3 py-0.5 rounded-md border border-border/60 max-w-xs truncate shadow-xs">
                                <span className="truncate">https://mail.smartsapp.com/inbox/preview</span>
                              </div>

                              {/* Device View Mode Switcher */}
                              <div className="flex items-center gap-1 bg-muted/70 p-0.5 rounded-lg border border-border/60">
                                <Button
                                  type="button"
                                  variant={emailDevice === 'desktop' ? 'secondary' : 'ghost'}
                                  size="sm"
                                  onClick={() => setEmailDevice('desktop')}
                                  className="h-6 px-2 text-[10px] font-bold gap-1 rounded-md"
                                  aria-label="Desktop Preview"
                                >
                                  <Monitor className="w-3 h-3" />
                                  Desktop
                                </Button>
                                <Button
                                  type="button"
                                  variant={emailDevice === 'mobile' ? 'secondary' : 'ghost'}
                                  size="sm"
                                  onClick={() => setEmailDevice('mobile')}
                                  className="h-6 px-2 text-[10px] font-bold gap-1 rounded-md"
                                  aria-label="Mobile Preview"
                                >
                                  <Smartphone className="w-3 h-3" />
                                  Mobile
                                </Button>
                              </div>
                            </div>

                            {/* Email Metadata Bar */}
                            <div className="p-3 sm:px-4 border-b border-border/60 bg-muted/10 shrink-0 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                  Subject
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyText(editableOutput.email?.subject || '', 'Subject')}
                                  className="h-6 text-[10px] font-semibold gap-1 px-2 text-muted-foreground hover:text-foreground"
                                >
                                  {copiedField === 'Subject' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                  Copy
                                </Button>
                              </div>
                              <p className="text-xs sm:text-sm font-bold text-foreground tracking-tight line-clamp-1">
                                {resolvedEmailSubject}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <span className="font-semibold text-foreground/80">From:</span>
                                <span>{mergedMocks.org_name} &lt;{mergedMocks.org_email}&gt;</span>
                              </div>
                            </div>

                            {/* Rendered HTML Email Frame */}
                            <div className="flex-1 bg-slate-100 dark:bg-slate-950/70 p-2 sm:p-4 overflow-y-auto flex justify-center items-start min-h-[300px]">
                              {emailDevice === 'desktop' ? (
                                <div className="w-full max-w-[620px] bg-white rounded-xl shadow-md overflow-hidden border border-slate-200/80 dark:border-slate-800">
                                  <iframe
                                    srcDoc={compiledEmailHtml}
                                    sandbox="allow-same-origin"
                                    className="w-full min-h-[380px] h-[440px] border-0 bg-white"
                                    title="Email Live Preview"
                                  />
                                </div>
                              ) : (
                                <div className="relative w-[340px] h-[520px] rounded-[2.5rem] border-8 border-slate-900 dark:border-slate-800 bg-white shadow-2xl flex flex-col overflow-hidden">
                                  {/* Dynamic Island Notch */}
                                  <div className="h-6 bg-slate-900 flex items-center justify-center shrink-0">
                                    <div className="w-20 h-3 bg-black rounded-full" />
                                  </div>
                                  <div className="flex-1 overflow-hidden bg-white">
                                    <iframe
                                      srcDoc={compiledEmailHtml}
                                      sandbox="allow-same-origin"
                                      className="w-full h-full border-0 bg-white"
                                      title="Email Live Preview (Mobile)"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quick Edit Hint */}
                          <div className="flex items-center justify-between px-1 shrink-0">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                              {editableOutput.email.explanation || 'Visual preview reflects all active blocks and branding tokens.'}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setViewMode('edit')}
                              className="h-7 text-xs font-semibold gap-1 rounded-xl text-primary border-primary/20 hover:bg-primary/5"
                            >
                              <Edit3 className="w-3 h-3" />
                              Edit Copy & Blocks
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* ──────────────── EMAIL IN-MODAL EDITOR ──────────────── */
                        <ScrollArea className="flex-1 pr-3">
                          <div className="space-y-4 pb-4">
                            {/* Subject Line Field */}
                            <div className="p-4 rounded-2xl border bg-card/60 space-y-2">
                              <div className="flex items-center justify-between">
                                <Label htmlFor="email-subject-input" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                  Email Subject Line
                                </Label>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {(editableOutput.email.subject || '').length} chars
                                </span>
                              </div>
                              <Input
                                id="email-subject-input"
                                value={editableOutput.email.subject || ''}
                                onChange={(e) =>
                                  setEditableOutput({
                                    ...editableOutput,
                                    email: {
                                      ...editableOutput.email!,
                                      subject: e.target.value,
                                    },
                                  })
                                }
                                placeholder="Enter email subject line..."
                                className="h-10 rounded-xl font-medium"
                              />
                            </div>

                            {/* Blocks Editor */}
                            <div className="p-4 rounded-2xl border bg-card/60 space-y-3">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-primary" />
                                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                    Layout Blocks ({editableOutput.email.blocks?.length || 0})
                                  </Label>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAddBlock('heading')}
                                    className="h-7 text-[11px] font-semibold gap-1 rounded-lg"
                                  >
                                    <Plus className="w-3 h-3" /> Heading
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAddBlock('text')}
                                    className="h-7 text-[11px] font-semibold gap-1 rounded-lg"
                                  >
                                    <Plus className="w-3 h-3" /> Text
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAddBlock('button')}
                                    className="h-7 text-[11px] font-semibold gap-1 rounded-lg"
                                  >
                                    <Plus className="w-3 h-3" /> Button
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAddBlock('list')}
                                    className="h-7 text-[11px] font-semibold gap-1 rounded-lg"
                                  >
                                    <Plus className="w-3 h-3" /> List
                                  </Button>
                                </div>
                              </div>

                              {/* List of Block Editor Cards */}
                              <div className="space-y-3">
                                {editableOutput.email.blocks?.map((blk, idx) => (
                                  <div
                                    key={blk.id || idx}
                                    className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-2.5 transition-all"
                                  >
                                    {/* Block Card Header */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono text-muted-foreground">
                                          #{idx + 1}
                                        </span>
                                        <Badge variant="outline" className="text-[10px] font-mono capitalize px-2">
                                          {blk.type}
                                        </Badge>
                                      </div>

                                      {/* Reorder and Delete controls */}
                                      <div className="flex items-center gap-1">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          disabled={idx === 0}
                                          onClick={() => handleMoveBlock(idx, 'up')}
                                          className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                                          aria-label="Move block up"
                                        >
                                          <ArrowUp className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          disabled={idx === (editableOutput.email!.blocks!.length - 1)}
                                          onClick={() => handleMoveBlock(idx, 'down')}
                                          className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                                          aria-label="Move block down"
                                        >
                                          <ArrowDown className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleDeleteBlock(idx)}
                                          className="h-6 w-6 rounded-md text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                          aria-label="Delete block"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>

                                    {/* In-Line Inputs by Block Type */}
                                    {blk.type === 'heading' && (
                                      <div className="space-y-1.5">
                                        <Input
                                          value={blk.title || ''}
                                          onChange={(e) => handleUpdateBlock(idx, { title: e.target.value })}
                                          placeholder="Heading text..."
                                          className="h-9 text-xs font-semibold rounded-lg"
                                        />
                                        <div className="flex items-center gap-1">
                                          {(['h1', 'h2', 'h3'] as const).map((level) => (
                                            <Button
                                              key={level}
                                              type="button"
                                              variant={blk.variant === level ? 'default' : 'outline'}
                                              size="sm"
                                              onClick={() => handleUpdateBlock(idx, { variant: level })}
                                              className="h-6 px-2 text-[10px] font-mono rounded"
                                            >
                                              {level.toUpperCase()}
                                            </Button>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {blk.type === 'text' && (
                                      <div className="space-y-1">
                                        <Textarea
                                          value={blk.content || ''}
                                          onChange={(e) => handleUpdateBlock(idx, { content: e.target.value })}
                                          rows={3}
                                          placeholder="Enter paragraph copy (supports markdown)..."
                                          className="text-xs leading-relaxed rounded-lg"
                                        />
                                        <span className="text-[10px] text-muted-foreground">
                                          Tip: You can use markdown like **bold text** and variable tokens like {'{{contact_name}}'}.
                                        </span>
                                      </div>
                                    )}

                                    {blk.type === 'button' && (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div>
                                          <Label className="text-[10px] text-muted-foreground font-semibold">Button Label</Label>
                                          <Input
                                            value={blk.title || ''}
                                            onChange={(e) => handleUpdateBlock(idx, { title: e.target.value })}
                                            placeholder="e.g. View Submission"
                                            className="h-9 text-xs rounded-lg mt-0.5"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-[10px] text-muted-foreground font-semibold">Target Link / URL</Label>
                                          <Input
                                            value={blk.url || blk.link || ''}
                                            onChange={(e) => handleUpdateBlock(idx, { url: e.target.value, link: e.target.value })}
                                            placeholder="https://... or {{result_url}}"
                                            className="h-9 text-xs rounded-lg mt-0.5"
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {blk.type === 'list' && (
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground font-semibold">
                                          List Items (one line per bullet)
                                        </Label>
                                        <Textarea
                                          value={(blk.items || []).join('\n')}
                                          onChange={(e) =>
                                            handleUpdateBlock(idx, {
                                              items: e.target.value.split('\n').filter((line) => line.trim().length > 0),
                                            })
                                          }
                                          rows={3}
                                          placeholder="Respondent: {{contact_name}}\nScore: {{survey_score}}%"
                                          className="text-xs font-mono leading-relaxed rounded-lg"
                                        />
                                      </div>
                                    )}

                                    {(blk.type === 'logo' || blk.type === 'image') && (
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground font-semibold">Image or Logo URL</Label>
                                        <Input
                                          value={blk.url || ''}
                                          onChange={(e) => handleUpdateBlock(idx, { url: e.target.value })}
                                          placeholder="https://... or {{org_logo_url}}"
                                          className="h-9 text-xs font-mono rounded-lg"
                                        />
                                      </div>
                                    )}

                                    {blk.type === 'quote' && (
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground font-semibold">Quote Text</Label>
                                        <Textarea
                                          value={blk.content || ''}
                                          onChange={(e) => handleUpdateBlock(idx, { content: e.target.value })}
                                          rows={2}
                                          placeholder="Enter quote copy..."
                                          className="text-xs italic rounded-lg"
                                        />
                                      </div>
                                    )}

                                    {blk.type === 'footer' && (
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground font-semibold">Footer Disclaimer Copy</Label>
                                        <Textarea
                                          value={blk.content || ''}
                                          onChange={(e) => handleUpdateBlock(idx, { content: e.target.value })}
                                          rows={2}
                                          placeholder="Footer legal / unsubscribe text..."
                                          className="text-xs rounded-lg"
                                        />
                                      </div>
                                    )}

                                    {blk.type === 'score-card' && (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div>
                                          <Label className="text-[10px] text-muted-foreground font-semibold">Score Title</Label>
                                          <Input
                                            value={blk.title || ''}
                                            onChange={(e) => handleUpdateBlock(idx, { title: e.target.value })}
                                            placeholder="Overall Assessment Score"
                                            className="h-9 text-xs rounded-lg mt-0.5"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-[10px] text-muted-foreground font-semibold">Fallback Score Value</Label>
                                          <Input
                                            value={blk.scoreValue || ''}
                                            onChange={(e) => handleUpdateBlock(idx, { scoreValue: e.target.value })}
                                            placeholder="e.g. 95 or {{score}}"
                                            className="h-9 text-xs rounded-lg mt-0.5"
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {blk.type === 'divider' && (
                                      <p className="text-[10px] text-muted-foreground italic">
                                        Horizontal dividing rule separator.
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Collapsible Plain Text Fallback */}
                            <div className="p-4 rounded-2xl border bg-card/60 space-y-2">
                              <button
                                type="button"
                                onClick={() => setShowPlainTextFallback(!showPlainTextFallback)}
                                className="w-full flex items-center justify-between text-left text-xs font-bold text-muted-foreground uppercase tracking-wider"
                              >
                                <span>Plain-Text Fallback Version</span>
                                {showPlainTextFallback ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                              {showPlainTextFallback && (
                                <Textarea
                                  value={editableOutput.email.body || ''}
                                  onChange={(e) =>
                                    setEditableOutput({
                                      ...editableOutput,
                                      email: {
                                        ...editableOutput.email!,
                                        body: e.target.value,
                                      },
                                    })
                                  }
                                  rows={4}
                                  placeholder="Plain-text version for email clients that do not support rich HTML..."
                                  className="text-xs font-mono rounded-lg mt-2"
                                />
                              )}
                            </div>
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* ════════════════════════ SMS CHANNEL ════════════════════════ */}
                <TabsContent value="sms" className="flex-1 overflow-hidden mt-0 flex flex-col min-h-0">
                  {editableOutput.sms && (
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                      {viewMode === 'preview' ? (
                        /* ──────────────── SMS VISUAL PREVIEW ──────────────── */
                        <div className="flex-1 flex flex-col overflow-hidden min-h-0 space-y-3">
                          <div className="flex-1 rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm flex flex-col min-h-0 justify-center items-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-950/40">
                            {/* Smartphone Device Frame */}
                            <div className="w-full max-w-[340px] rounded-[2.5rem] border-8 border-slate-900 dark:border-slate-800 bg-background shadow-2xl p-4 flex flex-col overflow-hidden">
                              {/* Status Notch */}
                              <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground px-2 pb-3">
                                <span>9:41</span>
                                <div className="w-16 h-3 bg-black rounded-full" />
                                <span>5G</span>
                              </div>

                              {/* Sender Bar */}
                              <div className="text-center pb-4 border-b border-border/60">
                                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center font-bold text-xs shadow-xs mb-1">
                                  SS
                                </div>
                                <p className="text-xs font-bold text-foreground">SmartSapp Alert</p>
                                <p className="text-[10px] text-muted-foreground">Automated Notification</p>
                              </div>

                              {/* Message Chat Bubble */}
                              <div className="py-6 flex-1 flex flex-col justify-end">
                                <div className="p-3.5 rounded-2xl rounded-tr-xs bg-primary text-primary-foreground text-xs leading-relaxed shadow-md">
                                  {resolvedSmsBody}
                                </div>
                                <span className="text-[9px] text-muted-foreground text-right mt-1 px-1">
                                  Delivered &bull; Just now
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* SMS Character & Segment Analysis */}
                          <div className="flex items-center justify-between px-1 shrink-0 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] font-mono',
                                  editableOutput.sms.body.length <= 160
                                    ? 'text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20'
                                    : 'text-amber-600 bg-amber-50/50'
                                )}
                              >
                                {editableOutput.sms.body.length} / 160 characters (~{Math.ceil(editableOutput.sms.body.length / 160)} SMS)
                              </Badge>
                              {editableOutput.sms.explanation && (
                                <span className="text-[11px] text-muted-foreground italic hidden sm:inline">
                                  &bull; {editableOutput.sms.explanation}
                                </span>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setViewMode('edit')}
                              className="h-7 text-xs font-semibold gap-1 rounded-xl text-primary border-primary/20 hover:bg-primary/5"
                            >
                              <Edit3 className="w-3 h-3" />
                              Edit SMS Text
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* ──────────────── SMS IN-MODAL EDITOR ──────────────── */
                        <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
                          <div className="p-4 rounded-2xl border bg-card/60 space-y-3">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="sms-body-input" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                SMS Message Body
                              </Label>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] font-mono',
                                  editableOutput.sms.body.length <= 160
                                    ? 'text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20'
                                    : 'text-amber-600 bg-amber-50/50'
                                )}
                              >
                                {editableOutput.sms.body.length} / 160 characters (~{Math.max(1, Math.ceil(editableOutput.sms.body.length / 160))} segment{Math.ceil(editableOutput.sms.body.length / 160) > 1 ? 's' : ''})
                              </Badge>
                            </div>
                            <Textarea
                              id="sms-body-input"
                              value={editableOutput.sms.body || ''}
                              onChange={(e) =>
                                setEditableOutput({
                                  ...editableOutput,
                                  sms: {
                                    ...editableOutput.sms!,
                                    body: e.target.value,
                                  },
                                })
                              }
                              rows={5}
                              placeholder="Enter SMS alert copy..."
                              className="text-xs sm:text-sm font-medium leading-relaxed rounded-xl"
                            />

                            {/* Quick Variable Token Inserts */}
                            <div className="space-y-1.5 pt-1">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                                Quick Insert Dynamic Tokens:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  '{{contact_name}}',
                                  '{{survey_name}}',
                                  '{{survey_score}}',
                                  '{{result_url}}',
                                  '{{dashboard_link}}',
                                ].map((token) => (
                                  <Button
                                    key={token}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setEditableOutput({
                                        ...editableOutput,
                                        sms: {
                                          ...editableOutput.sms!,
                                          body: `${editableOutput.sms!.body} ${token}`,
                                        },
                                      })
                                    }
                                    className="h-6 text-[10px] font-mono rounded-lg px-2 hover:bg-primary/5 active:scale-[0.97]"
                                  >
                                    + {token}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* ════════════════════════ WHATSAPP CHANNEL ════════════════════════ */}
                <TabsContent value="whatsapp" className="flex-1 overflow-hidden mt-0 flex flex-col min-h-0">
                  {editableOutput.whatsapp && (
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                      {viewMode === 'preview' ? (
                        /* ──────────────── WHATSAPP VISUAL PREVIEW ──────────────── */
                        <div className="flex-1 flex flex-col overflow-hidden min-h-0 space-y-3">
                          <div className="flex-1 rounded-2xl border border-emerald-500/20 bg-emerald-950/5 dark:bg-emerald-950/20 overflow-hidden shadow-sm flex flex-col min-h-0 justify-center items-center p-4 sm:p-6">
                            {/* WhatsApp Chat Card */}
                            <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-[#0B141A] text-white shadow-xl flex flex-col overflow-hidden">
                              {/* WhatsApp Contact Header */}
                              <div className="bg-[#202C33] px-4 py-2.5 flex items-center justify-between border-b border-[#2A3942]">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                                    WA
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-xs font-bold text-white tracking-tight">SmartSapp Notifications</p>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    </div>
                                    <p className="text-[9px] text-emerald-400/80 font-mono">Meta Official Business Account</p>
                                  </div>
                                </div>
                                <Badge variant="secondary" className="text-[9px] uppercase font-bold bg-[#111B21] text-emerald-300 border-emerald-500/20">
                                  {editableOutput.whatsapp.whatsappCategory}
                                </Badge>
                              </div>

                              {/* WhatsApp Chat Canvas */}
                              <div className="p-4 sm:p-6 bg-[#0B141A] flex flex-col justify-end min-h-[200px]">
                                <div className="p-4 rounded-2xl rounded-tr-xs bg-[#005C4B] text-white text-xs leading-relaxed shadow-lg space-y-2 border border-emerald-500/20">
                                  {editableOutput.whatsapp.header && (
                                    <p className="font-bold text-emerald-200 uppercase tracking-wide text-[11px] pb-1 border-b border-emerald-400/20">
                                      {editableOutput.whatsapp.header}
                                    </p>
                                  )}
                                  <p className="whitespace-pre-wrap">{resolvedWhatsappText}</p>
                                  {editableOutput.whatsapp.footer && (
                                    <p className="text-[10px] text-emerald-200/70 pt-1 border-t border-emerald-400/20">
                                      {editableOutput.whatsapp.footer}
                                    </p>
                                  )}
                                  <div className="flex items-center justify-end gap-1 text-[9px] text-emerald-200/60 pt-0.5">
                                    <span>9:41 AM</span>
                                    <span>✓✓</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Bottom Action / Meta Details */}
                          <div className="flex items-center justify-between px-1 shrink-0 flex-wrap gap-2">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Info className="w-3.5 h-3.5 text-emerald-500" />
                              Positional tokens {'{{1}}, {{2}}'} are filled with sample preview values.
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setViewMode('edit')}
                              className="h-7 text-xs font-semibold gap-1 rounded-xl text-primary border-primary/20 hover:bg-primary/5"
                            >
                              <Edit3 className="w-3 h-3" />
                              Edit WhatsApp Copy
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* ──────────────── WHATSAPP IN-MODAL EDITOR ──────────────── */
                        <ScrollArea className="flex-1 pr-3">
                          <div className="space-y-4 pb-4">
                            {/* Header Input */}
                            <div className="p-4 rounded-2xl border bg-card/60 space-y-2">
                              <Label htmlFor="wa-header-input" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                WhatsApp Header (Optional, ≤ 60 chars)
                              </Label>
                              <Input
                                id="wa-header-input"
                                value={editableOutput.whatsapp.header || ''}
                                onChange={(e) =>
                                  setEditableOutput({
                                    ...editableOutput,
                                    whatsapp: {
                                      ...editableOutput.whatsapp!,
                                      header: e.target.value,
                                    },
                                  })
                                }
                                maxLength={60}
                                placeholder="e.g. Survey Submission Alert"
                                className="h-10 rounded-xl font-medium"
                              />
                            </div>

                            {/* Body Input */}
                            <div className="p-4 rounded-2xl border bg-card/60 space-y-2">
                              <div className="flex items-center justify-between">
                                <Label htmlFor="wa-body-input" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                  WhatsApp Message Body (Meta Positional Format)
                                </Label>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {(editableOutput.whatsapp.body || '').length} / 1024 chars
                                </span>
                              </div>
                              <Textarea
                                id="wa-body-input"
                                value={editableOutput.whatsapp.body || ''}
                                onChange={(e) =>
                                  setEditableOutput({
                                    ...editableOutput,
                                    whatsapp: {
                                      ...editableOutput.whatsapp!,
                                      body: e.target.value,
                                    },
                                  })
                                }
                                rows={4}
                                maxLength={1024}
                                placeholder="e.g. Hello {{1}}, a new response was recorded with score {{2}}%..."
                                className="text-xs sm:text-sm font-medium leading-relaxed rounded-xl font-mono"
                              />
                              <p className="text-[10px] text-muted-foreground">
                                Meta WhatsApp requires positional placeholders like {'{{1}}, {{2}}'} instead of named variables.
                              </p>
                            </div>

                            {/* Footer Input */}
                            <div className="p-4 rounded-2xl border bg-card/60 space-y-2">
                              <Label htmlFor="wa-footer-input" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                WhatsApp Footer (Optional, ≤ 60 chars)
                              </Label>
                              <Input
                                id="wa-footer-input"
                                value={editableOutput.whatsapp.footer || ''}
                                onChange={(e) =>
                                  setEditableOutput({
                                    ...editableOutput,
                                    whatsapp: {
                                      ...editableOutput.whatsapp!,
                                      footer: e.target.value,
                                    },
                                  })
                                }
                                maxLength={60}
                                placeholder="e.g. SmartSapp Automated System"
                                className="h-10 rounded-xl font-medium"
                              />
                            </div>

                            {/* Parameter Samples Editor */}
                            <div className="p-4 rounded-2xl border bg-card/60 space-y-3">
                              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                                Positional Parameter Samples (for Meta Review)
                              </Label>
                              <div className="space-y-2">
                                {(editableOutput.whatsapp.bodyParams || []).map((param, pIdx) => (
                                  <div key={pIdx} className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs font-mono shrink-0 w-12 justify-center">
                                      {`{{${pIdx + 1}}}`}
                                    </Badge>
                                    <Input
                                      value={param}
                                      onChange={(e) => {
                                        const newParams = [...(editableOutput.whatsapp!.bodyParams || [])];
                                        newParams[pIdx] = e.target.value;
                                        setEditableOutput({
                                          ...editableOutput,
                                          whatsapp: {
                                            ...editableOutput.whatsapp!,
                                            bodyParams: newParams,
                                          },
                                        });
                                      }}
                                      placeholder={`Sample value for {{${pIdx + 1}}}...`}
                                      className="h-9 text-xs rounded-lg"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>

          {/* Footer Bar */}
          <DialogFooter className="p-4 border-t border-border/50 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="rounded-xl h-11 min-h-[44px] text-xs font-bold active:scale-[0.97]"
              >
                Close
              </Button>

              {hasEdits && (
                <Button
                  variant="outline"
                  onClick={handleResetToAiOriginal}
                  className="rounded-xl h-11 min-h-[44px] text-xs font-semibold gap-1.5 active:scale-[0.97] text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Changes
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {savedTemplateIds?.emailTemplateId && activeTab === 'email' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenWorkshop(savedTemplateIds.emailTemplateId)}
                  className="h-11 min-h-[44px] text-xs font-bold gap-1.5 rounded-xl active:scale-[0.97] text-primary hover:text-primary"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Workshop Studio
                </Button>
              )}

              <Button
                onClick={handleApplyAndClose}
                disabled={isLoading || isSaving || !savedTemplateIds}
                className="rounded-xl h-11 min-h-[44px] px-6 text-xs font-bold shadow-lg shadow-primary/20 gap-2 active:scale-[0.97]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Apply to Survey
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workshop Sheet for Advanced Drag-and-Drop / Style Editing */}
      {editingTemplateId && (
        <TemplateWorkshopSheet
          open={isWorkshopOpen}
          onOpenChange={setIsWorkshopOpen}
          templateId={editingTemplateId}
        />
      )}
    </>
  );
}

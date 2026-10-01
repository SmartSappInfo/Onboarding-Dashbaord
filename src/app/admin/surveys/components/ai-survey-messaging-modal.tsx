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
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
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
import PromptBar from '@/components/PromptBar';
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
  onRegenerate?: (userPromptInstructions?: string) => Promise<void> | void;
  onUpdateOutput?: (output: GenerateSurveyMessagingOutput) => void;
}

/**
 * Sanitizes template output by replacing any deprecated tokens like school_name / school_logo
 * with canonical entity_name / org_logo_url (Single Source of Truth).
 */
function sanitizeTemplateVariables(output: GenerateSurveyMessagingOutput): GenerateSurveyMessagingOutput {
  const serialized = JSON.stringify(output)
    .replace(/\{\{\s*school_name\s*\}\}/g, '{{entity_name}}')
    .replace(/\{\{\s*school_logo\s*\}\}/g, '{{org_logo_url}}');
  return JSON.parse(serialized) as GenerateSurveyMessagingOutput;
}

const DEFAULT_MOCK_VARIABLES: Record<string, string> = {
  contact_name: 'Alex Johnson',
  first_name: 'Alex',
  last_name: 'Johnson',
  contact_email: 'alex.j@example.com',
  contact_phone: '+1 (555) 234-5678',
  entity_name: 'Horizon Academy',
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

  // Channel enable/disable state allowing user to turn off email, sms, or whatsapp
  const [enabledChannels, setEnabledChannels] = React.useState<{
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  }>({
    email: true,
    sms: true,
    whatsapp: true,
  });

  const toggleChannel = React.useCallback((channel: 'email' | 'sms' | 'whatsapp') => {
    setEnabledChannels((prev) => ({
      ...prev,
      [channel]: !prev[channel],
    }));
  }, []);

  // AI Command Bar Chat state
  const [chatPrompt, setChatPrompt] = React.useState('');
  const [isRefining, setIsRefining] = React.useState(false);

  // Local editable copy of the generated output
  const [editableOutput, setEditableOutput] = React.useState<GenerateSurveyMessagingOutput | null>(null);

  // Reset editableOutput whenever new generatedOutput arrives, sanitizing any deprecated tokens
  React.useEffect(() => {
    if (generatedOutput) {
      setEditableOutput(sanitizeTemplateVariables(generatedOutput));
      // Initialize channel enabled states based on availability
      setEnabledChannels({
        email: !!generatedOutput.email && (savedTemplateIds?.emailTemplateId ? true : !savedTemplateIds || !!generatedOutput.email),
        sms: !!generatedOutput.sms && (savedTemplateIds?.smsTemplateId ? true : !savedTemplateIds || !!generatedOutput.sms),
        whatsapp: !!generatedOutput.whatsapp && (savedTemplateIds?.whatsappTemplateId ? true : !savedTemplateIds || !!generatedOutput.whatsapp),
      });
    } else {
      setEditableOutput(null);
    }
  }, [generatedOutput, savedTemplateIds]);

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
    setEditableOutput(sanitizeTemplateVariables(generatedOutput));
    toast({
      title: 'Restored Original AI Copy',
      description: 'All manual edits have been reverted to the initial generation.',
    });
  };

  const handleAiCommandSubmit = async (promptToRun: string) => {
    const instruction = promptToRun.trim();
    if (!instruction || isRefining || isLoading) return;
    setIsRefining(true);
    try {
      if (onRegenerate) {
        await onRegenerate(instruction);
        setChatPrompt('');
        toast({
          title: 'Templates Refined',
          description: 'AI updated message templates based on your instructions.',
        });
      } else {
        toast({
          title: 'Refinement Triggered',
          description: 'Sent prompt to AI generation pipeline.',
        });
      }
    } catch (err: unknown) {
      console.error('[AiSurveyMessagingModal] Refinement Error:', err);
      toast({
        variant: 'destructive',
        title: 'Refinement Failed',
        description: err instanceof Error ? err.message : 'Could not refine templates.',
      });
    } finally {
      setIsRefining(false);
    }
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

      // 3. Link template IDs to the survey form for enabled channels only
      if (savedTemplateIds) {
        onApply({
          emailTemplateId: enabledChannels.email ? savedTemplateIds.emailTemplateId : undefined,
          smsTemplateId: enabledChannels.sms ? savedTemplateIds.smsTemplateId : undefined,
          whatsappTemplateId: enabledChannels.whatsapp ? savedTemplateIds.whatsappTemplateId : undefined,
        });
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

  /**
   * Renders an individual email block directly on the WYSIWYG visual canvas
   * with inline editing and authentic typography.
   */
  const renderWysiwygBlock = (blk: EmailBlock, idx: number) => {
    switch (blk.type) {
      case 'logo':
      case 'image':
        return (
          <div className="py-2 flex items-center justify-between gap-3 border-b border-border/40 pb-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mergedMocks.org_logo_url || blk.url || DEFAULT_MOCK_VARIABLES.org_logo_url}
                alt="Logo"
                className="h-10 w-auto max-w-[150px] object-contain rounded"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_MOCK_VARIABLES.org_logo_url;
                }}
              />
              <span className="text-[11px] font-semibold text-muted-foreground">Header Logo</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] font-mono text-muted-foreground">URL:</span>
              <Input
                value={blk.url || ''}
                onChange={(e) => handleUpdateBlock(idx, { url: e.target.value })}
                placeholder="{{org_logo_url}}"
                className="h-7 text-[11px] font-mono w-44 bg-background"
              />
            </div>
          </div>
        );

      case 'heading':
        return (
          <div className="space-y-1">
            <Input
              value={blk.title || ''}
              onChange={(e) => handleUpdateBlock(idx, { title: e.target.value })}
              placeholder="Enter section heading..."
              className={cn(
                "w-full bg-transparent border-0 border-b border-transparent hover:border-primary/40 focus:border-primary focus:bg-background/80 rounded-none px-1 py-0 shadow-none font-black tracking-tight text-slate-900 dark:text-slate-100 transition-all",
                blk.variant === 'h1' ? 'text-2xl h-10' : blk.variant === 'h2' ? 'text-xl h-9' : 'text-lg h-8'
              )}
            />
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
              {(['h1', 'h2', 'h3'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleUpdateBlock(idx, { variant: level })}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-mono rounded-md font-bold transition-all",
                    blk.variant === level
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {level.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        );

      case 'text':
        return (
          <div className="space-y-1">
            <Textarea
              value={blk.content || ''}
              onChange={(e) => handleUpdateBlock(idx, { content: e.target.value })}
              placeholder="Enter paragraph copy (supports markdown and {{variables}})..."
              rows={Math.max(2, Math.min(8, (blk.content || '').split('\n').length + 1))}
              className="w-full bg-transparent border border-dashed border-border/40 hover:border-primary/40 focus:border-primary focus:bg-background/80 text-sm leading-relaxed text-slate-700 dark:text-slate-300 resize-y p-2.5 rounded-lg transition-all"
            />
          </div>
        );

      case 'button':
        return (
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.97]">
                <input
                  type="text"
                  value={blk.title || ''}
                  onChange={(e) => handleUpdateBlock(idx, { title: e.target.value })}
                  placeholder="Button Label"
                  className="bg-transparent text-center text-primary-foreground font-bold text-sm focus:outline-none placeholder:text-primary-foreground/60 w-auto min-w-[140px]"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs bg-background px-3 py-1.5 rounded-xl border border-border/70 max-w-sm flex-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">Link:</span>
                <input
                  type="text"
                  value={blk.url || blk.link || ''}
                  onChange={(e) => handleUpdateBlock(idx, { url: e.target.value, link: e.target.value })}
                  placeholder="https://... or {{survey_link}}"
                  className="bg-transparent text-xs text-foreground focus:outline-none font-mono w-full"
                />
              </div>
            </div>
          </div>
        );

      case 'score-card':
        return (
          <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] font-bold bg-indigo-100/80 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border-indigo-300">
                ASSESSMENT SCORE CARD
              </Badge>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Score:</span>
                <Input
                  value={blk.scoreValue || ''}
                  onChange={(e) => handleUpdateBlock(idx, { scoreValue: e.target.value })}
                  placeholder="92 or {{score}}"
                  className="w-24 text-right font-black text-indigo-600 dark:text-indigo-400 bg-background border border-indigo-200 dark:border-indigo-800 rounded-lg px-2 h-7 text-xs"
                />
              </div>
            </div>
            <Input
              value={blk.title || ''}
              onChange={(e) => handleUpdateBlock(idx, { title: e.target.value })}
              placeholder="Score Title (e.g. Overall Assessment Score)"
              className="w-full bg-transparent font-bold text-sm text-foreground border-0 border-b border-transparent hover:border-indigo-300 focus:border-indigo-500 rounded-none px-0 h-8 shadow-none"
            />
          </div>
        );

      case 'list':
        return (
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Bullet Highlights (one per line)
            </Label>
            <Textarea
              value={(blk.items || []).join('\n')}
              onChange={(e) =>
                handleUpdateBlock(idx, {
                  items: e.target.value.split('\n').filter((l) => l.trim().length > 0),
                })
              }
              rows={Math.max(2, (blk.items || []).length + 1)}
              placeholder="Respondent: {{contact_name}}\nScore: {{survey_score}}%"
              className="text-xs font-mono bg-background/80 rounded-xl leading-relaxed"
            />
          </div>
        );

      case 'divider':
        return (
          <div className="py-2">
            <hr className="border-t border-border/80 my-2" />
          </div>
        );

      case 'footer':
        return (
          <div className="p-2 text-center">
            <Textarea
              value={blk.content || ''}
              onChange={(e) => handleUpdateBlock(idx, { content: e.target.value })}
              rows={2}
              placeholder="Footer disclaimer and legal text..."
              className="w-full text-center text-xs text-muted-foreground bg-transparent border border-dashed border-border/40 hover:border-primary/40 focus:border-primary focus:bg-background/80 rounded-lg p-2"
            />
          </div>
        );

      case 'quote':
        return (
          <div className="p-2 border-l-4 border-primary/50 bg-primary/5 rounded-r-lg">
            <Textarea
              value={blk.content || ''}
              onChange={(e) => handleUpdateBlock(idx, { content: e.target.value })}
              rows={2}
              placeholder="Quote text..."
              className="w-full italic text-xs bg-transparent border-0 focus:outline-none p-1"
            />
          </div>
        );

      default:
        return (
          <div className="p-2 bg-muted/20 rounded-lg">
            <Textarea
              value={blk.content || ''}
              onChange={(e) => handleUpdateBlock(idx, { content: e.target.value })}
              rows={2}
              className="text-xs"
            />
          </div>
        );
    }
  };

  /**
   * Action bar to append new blocks to the visual email canvas
   */
  const renderAddBlockBar = () => (
    <div className="pt-4 border-t border-border/50 flex items-center justify-between flex-wrap gap-2">
      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
        Add Block:
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleAddBlock('heading')}
          className="h-7 text-[11px] font-semibold gap-1 rounded-lg hover:border-primary/40 active:scale-[0.97]"
        >
          <Plus className="w-3 h-3 text-primary" /> Heading
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleAddBlock('text')}
          className="h-7 text-[11px] font-semibold gap-1 rounded-lg hover:border-primary/40 active:scale-[0.97]"
        >
          <Plus className="w-3 h-3 text-primary" /> Text
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleAddBlock('button')}
          className="h-7 text-[11px] font-semibold gap-1 rounded-lg hover:border-primary/40 active:scale-[0.97]"
        >
          <Plus className="w-3 h-3 text-primary" /> Button
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleAddBlock('list')}
          className="h-7 text-[11px] font-semibold gap-1 rounded-lg hover:border-primary/40 active:scale-[0.97]"
        >
          <Plus className="w-3 h-3 text-primary" /> List
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleAddBlock('score-card')}
          className="h-7 text-[11px] font-semibold gap-1 rounded-lg hover:border-primary/40 active:scale-[0.97]"
        >
          <Plus className="w-3 h-3 text-primary" /> Score Card
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleAddBlock('divider')}
          className="h-7 text-[11px] font-semibold gap-1 rounded-lg hover:border-primary/40 active:scale-[0.97]"
        >
          <Plus className="w-3 h-3 text-primary" /> Divider
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl w-[94vw] max-h-[92vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl border border-border/80 shadow-2xl bg-card text-card-foreground font-figtree">
          {/* Header */}
          <DialogHeader className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                <Sparkles className="w-4 h-4 animate-pulse text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base font-bold tracking-tight">
                    {title}
                  </DialogTitle>
                  {targetDescription && <CardInfoTooltip text={targetDescription} />}
                  {targetDescription && <DialogDescription className="sr-only">{targetDescription}</DialogDescription>}
                  {hasEdits && (
                    <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30 bg-primary/5">
                      Customized
                    </Badge>
                  )}
                </div>
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
                <TabsList className="grid grid-cols-3 w-full h-12 p-1 bg-muted/60 rounded-2xl mb-4 shrink-0">
                  <TabsTrigger
                    value="email"
                    disabled={!editableOutput.email}
                    className="rounded-xl font-bold text-xs gap-2 min-h-[40px] transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md text-muted-foreground hover:text-foreground"
                  >
                    <span
                      role="switch"
                      aria-checked={enabledChannels.email}
                      aria-label="Toggle Email channel"
                      tabIndex={0}
                      title={enabledChannels.email ? 'Turn off Email alert' : 'Turn on Email alert'}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleChannel('email');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.stopPropagation();
                          e.preventDefault();
                          toggleChannel('email');
                        }
                      }}
                      className={cn(
                        'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                        enabledChannels.email
                          ? (activeTab === 'email' ? 'bg-primary-foreground/90' : 'bg-primary')
                          : (activeTab === 'email' ? 'bg-primary-foreground/30' : 'bg-muted-foreground/30')
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-3 w-3 transform rounded-full shadow-sm transition duration-200 ease-in-out',
                          enabledChannels.email
                            ? 'translate-x-3 ' + (activeTab === 'email' ? 'bg-primary' : 'bg-primary-foreground')
                            : 'translate-x-0 bg-background'
                        )}
                      />
                    </span>
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span>Email</span>
                    {savedTemplateIds?.emailTemplateId && enabledChannels.email && (
                      <span className={cn('w-1.5 h-1.5 rounded-full ml-0.5', activeTab === 'email' ? 'bg-primary-foreground' : 'bg-emerald-500')} />
                    )}
                    {!enabledChannels.email && (
                      <span className={cn('text-[9px] font-semibold px-1 rounded', activeTab === 'email' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                        Off
                      </span>
                    )}
                  </TabsTrigger>

                  <TabsTrigger
                    value="sms"
                    disabled={!editableOutput.sms}
                    className="rounded-xl font-bold text-xs gap-2 min-h-[40px] transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md text-muted-foreground hover:text-foreground"
                  >
                    <span
                      role="switch"
                      aria-checked={enabledChannels.sms}
                      aria-label="Toggle SMS channel"
                      tabIndex={0}
                      title={enabledChannels.sms ? 'Turn off SMS alert' : 'Turn on SMS alert'}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleChannel('sms');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.stopPropagation();
                          e.preventDefault();
                          toggleChannel('sms');
                        }
                      }}
                      className={cn(
                        'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                        enabledChannels.sms
                          ? (activeTab === 'sms' ? 'bg-primary-foreground/90' : 'bg-primary')
                          : (activeTab === 'sms' ? 'bg-primary-foreground/30' : 'bg-muted-foreground/30')
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-3 w-3 transform rounded-full shadow-sm transition duration-200 ease-in-out',
                          enabledChannels.sms
                            ? 'translate-x-3 ' + (activeTab === 'sms' ? 'bg-primary' : 'bg-primary-foreground')
                            : 'translate-x-0 bg-background'
                        )}
                      />
                    </span>
                    <Smartphone className="w-3.5 h-3.5 shrink-0" />
                    <span>SMS</span>
                    {savedTemplateIds?.smsTemplateId && enabledChannels.sms && (
                      <span className={cn('w-1.5 h-1.5 rounded-full ml-0.5', activeTab === 'sms' ? 'bg-primary-foreground' : 'bg-emerald-500')} />
                    )}
                    {!enabledChannels.sms && (
                      <span className={cn('text-[9px] font-semibold px-1 rounded', activeTab === 'sms' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                        Off
                      </span>
                    )}
                  </TabsTrigger>

                  <TabsTrigger
                    value="whatsapp"
                    disabled={!editableOutput.whatsapp}
                    className="rounded-xl font-bold text-xs gap-2 min-h-[40px] transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md text-muted-foreground hover:text-foreground"
                  >
                    <span
                      role="switch"
                      aria-checked={enabledChannels.whatsapp}
                      aria-label="Toggle WhatsApp channel"
                      tabIndex={0}
                      title={enabledChannels.whatsapp ? 'Turn off WhatsApp alert' : 'Turn on WhatsApp alert'}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleChannel('whatsapp');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.stopPropagation();
                          e.preventDefault();
                          toggleChannel('whatsapp');
                        }
                      }}
                      className={cn(
                        'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                        enabledChannels.whatsapp
                          ? (activeTab === 'whatsapp' ? 'bg-primary-foreground/90' : 'bg-primary')
                          : (activeTab === 'whatsapp' ? 'bg-primary-foreground/30' : 'bg-muted-foreground/30')
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-3 w-3 transform rounded-full shadow-sm transition duration-200 ease-in-out',
                          enabledChannels.whatsapp
                            ? 'translate-x-3 ' + (activeTab === 'whatsapp' ? 'bg-primary' : 'bg-primary-foreground')
                            : 'translate-x-0 bg-background'
                        )}
                      />
                    </span>
                    <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>WhatsApp</span>
                    {savedTemplateIds?.whatsappTemplateId && enabledChannels.whatsapp && (
                      <span className={cn('w-1.5 h-1.5 rounded-full ml-0.5', activeTab === 'whatsapp' ? 'bg-primary-foreground' : 'bg-emerald-500')} />
                    )}
                    {!enabledChannels.whatsapp && (
                      <span className={cn('text-[9px] font-semibold px-1 rounded', activeTab === 'whatsapp' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                        Off
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* ════════════════════════ EMAIL CHANNEL ════════════════════════ */}
                <TabsContent value="email" className="flex-1 overflow-hidden mt-0 flex flex-col min-h-0">
                  {editableOutput.email && (
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                      {!enabledChannels.email && (
                        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 rounded-xl px-4 py-2 flex items-center justify-between text-xs font-medium shrink-0 mb-2.5">
                          <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>
                              <strong>EMAIL</strong> is currently turned off and will not be linked to this survey.
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => toggleChannel('email')}
                            className="h-7 text-xs font-semibold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-900 dark:text-amber-100 active:scale-[0.97]"
                          >
                            Turn On Email
                          </Button>
                        </div>
                      )}
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
                        </div>
                      ) : (
                        /* ──────────────── EMAIL WYSIWYG VISUAL CANVAS & INLINE EDITOR ──────────────── */
                        <div className="flex-1 flex flex-col overflow-hidden min-h-0 space-y-3">
                          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm flex flex-col flex-1 min-h-0">
                            {/* Visual Canvas Top Bar: Browser Mock + Subject Line + Device Controls */}
                            <div className="h-10 border-b border-border/80 bg-muted/40 px-3.5 flex items-center justify-between shrink-0">
                              <div className="flex gap-1.5 items-center">
                                <div className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                                <span className="text-[10px] font-mono text-muted-foreground ml-2 hidden sm:inline">
                                  WYSIWYG Visual Canvas ({editableOutput.email.blocks?.length || 0} blocks)
                                </span>
                              </div>

                              {/* Device Switcher */}
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

                            {/* Email Metadata Bar & Subject Input */}
                            <div className="p-3 sm:px-4 border-b border-border/60 bg-muted/10 shrink-0 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <Label
                                  htmlFor="email-subject-input"
                                  className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
                                >
                                  Email Subject Line
                                </Label>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {(editableOutput.email.subject || '').length} chars
                                </span>
                              </div>
                              <Input
                                id="email-subject-input"
                                aria-label="Email Subject Line"
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
                                className="h-9 rounded-xl font-bold text-sm bg-background border-border/70"
                              />
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <span className="font-semibold text-foreground/80">From:</span>
                                <span>{mergedMocks.org_name} &lt;{mergedMocks.org_email}&gt;</span>
                              </div>
                            </div>

                            {/* Visual Email Canvas Body */}
                            <div className="flex-1 bg-slate-100 dark:bg-slate-950/70 p-3 sm:p-5 overflow-y-auto flex justify-center items-start min-h-[350px]">
                              {/* Outer Device Frame Container */}
                              <div
                                className={cn(
                                  "w-full transition-all duration-200 flex flex-col items-center",
                                  emailDevice === 'mobile' ? 'max-w-[360px]' : 'max-w-[620px]'
                                )}
                              >
                                {emailDevice === 'mobile' ? (
                                  <div className="w-[340px] rounded-[2.5rem] border-8 border-slate-900 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden mb-4">
                                    {/* Mobile Dynamic Island / Notch */}
                                    <div className="h-6 bg-slate-900 flex items-center justify-center shrink-0">
                                      <div className="w-20 h-3 bg-black rounded-full" />
                                    </div>
                                    <div className="p-4 sm:p-5 space-y-3.5 bg-white dark:bg-slate-900">
                                      {/* Block Renderer */}
                                      {editableOutput.email.blocks?.map((blk, idx) => (
                                        <div
                                          key={blk.id || idx}
                                          className="group relative p-2 rounded-xl border border-transparent hover:border-primary/40 hover:bg-muted/15 transition-all"
                                        >
                                          {/* Floating Toolbar on Hover */}
                                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-background/95 backdrop-blur-xs p-1 rounded-lg border border-border/70 shadow-sm z-10">
                                            <Badge variant="outline" className="text-[8px] font-mono uppercase px-1 py-0 h-4">
                                              {blk.type}
                                            </Badge>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              disabled={idx === 0}
                                              onClick={() => handleMoveBlock(idx, 'up')}
                                              className="h-5 w-5 rounded text-muted-foreground hover:text-foreground"
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
                                              className="h-5 w-5 rounded text-muted-foreground hover:text-foreground"
                                              aria-label="Move block down"
                                            >
                                              <ArrowDown className="w-3 h-3" />
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleDeleteBlock(idx)}
                                              className="h-5 w-5 rounded text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                              aria-label="Delete block"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          </div>

                                          {/* Block Body in Mobile Frame */}
                                          {renderWysiwygBlock(blk, idx)}
                                        </div>
                                      ))}

                                      {/* Quick Add Block Bar */}
                                      {renderAddBlockBar()}
                                    </div>
                                  </div>
                                ) : (
                                  /* Desktop Email Canvas Card */
                                  <div className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 space-y-4 mb-4">
                                    {editableOutput.email.blocks?.map((blk, idx) => (
                                      <div
                                        key={blk.id || idx}
                                        className="group relative p-2.5 rounded-xl border border-transparent hover:border-primary/40 hover:bg-muted/15 transition-all"
                                      >
                                        {/* Floating Toolbar on Hover */}
                                        <div className="absolute top-1.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-background/95 backdrop-blur-xs p-1 rounded-xl border border-border/70 shadow-sm z-10">
                                          <Badge variant="outline" className="text-[9px] font-mono uppercase px-1.5 py-0 h-5">
                                            {blk.type}
                                          </Badge>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={idx === 0}
                                            onClick={() => handleMoveBlock(idx, 'up')}
                                            className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                                            aria-label="Move block up"
                                          >
                                            <ArrowUp className="w-3.5 h-3.5" />
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
                                            <ArrowDown className="w-3.5 h-3.5" />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteBlock(idx)}
                                            className="h-6 w-6 rounded-md text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                            aria-label="Delete block"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </Button>
                                        </div>

                                        {/* Block Body in Desktop Card */}
                                        {renderWysiwygBlock(blk, idx)}
                                      </div>
                                    ))}

                                    {/* Quick Add Block Bar */}
                                    {renderAddBlockBar()}
                                  </div>
                                )}

                                {/* Collapsible Plain Text Fallback */}
                                <div className="w-full p-4 rounded-2xl border bg-card/60 space-y-2 mb-4">
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
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* ════════════════════════ SMS CHANNEL ════════════════════════ */}
                <TabsContent value="sms" className="flex-1 overflow-hidden mt-0 flex flex-col min-h-0">
                  {editableOutput.sms && (
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                      {!enabledChannels.sms && (
                        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 rounded-xl px-4 py-2 flex items-center justify-between text-xs font-medium shrink-0 mb-2.5">
                          <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>
                              <strong>SMS</strong> is currently turned off and will not be linked to this survey.
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => toggleChannel('sms')}
                            className="h-7 text-xs font-semibold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-900 dark:text-amber-100 active:scale-[0.97]"
                          >
                            Turn On SMS
                          </Button>
                        </div>
                      )}
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
                      {!enabledChannels.whatsapp && (
                        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 rounded-xl px-4 py-2 flex items-center justify-between text-xs font-medium shrink-0 mb-2.5">
                          <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>
                              <strong>WHATSAPP</strong> is currently turned off and will not be linked to this survey.
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => toggleChannel('whatsapp')}
                            className="h-7 text-xs font-semibold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-900 dark:text-amber-100 active:scale-[0.97]"
                          >
                            Turn On WhatsApp
                          </Button>
                        </div>
                      )}
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

                {/* ════════════ CONTROL BAR BELOW PREVIEW AREA ════════════ */}
                <div className="pt-3 pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 border-t border-border/40 mt-2">
                  {/* Left: View Mode Toggle */}
                  <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/60 shadow-xs">
                    <Button
                      type="button"
                      variant={viewMode === 'preview' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('preview')}
                      className={cn(
                        "h-8 rounded-lg text-xs font-bold gap-1.5 px-3 active:scale-[0.97] transition-all",
                        viewMode === 'preview' && "bg-primary text-primary-foreground shadow-xs"
                      )}
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
                      className={cn(
                        "h-8 rounded-lg text-xs font-bold gap-1.5 px-3 active:scale-[0.97] transition-all",
                        viewMode === 'edit' && "bg-primary text-primary-foreground shadow-xs"
                      )}
                      aria-label="Edit Content Mode"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Content
                    </Button>
                  </div>

                  {/* Center: SMS character count or channel disabled badge */}
                  <div className="flex items-center gap-2">
                    {activeTab === 'sms' && editableOutput.sms && (
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
                    )}
                    {!enabledChannels[activeTab] && (
                      <Badge variant="outline" className="text-[10px] font-semibold text-rose-500 border-rose-500/30 bg-rose-500/5">
                        {activeTab.toUpperCase()} Disabled
                      </Badge>
                    )}
                  </div>

                  {/* Right: Regenerate Button */}
                  {onRegenerate && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onRegenerate()}
                      disabled={isLoading || isRefining}
                      className="rounded-xl h-8 text-xs font-semibold gap-1.5 active:scale-[0.97] transition-all min-h-[36px] hover:bg-primary/5 hover:text-primary hover:border-primary/30"
                      aria-label="Regenerate"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      Regenerate
                    </Button>
                  )}
                </div>
              </Tabs>
            )}
          </div>

          {/* AI Refinement Unified PromptBar */}
          {!isLoading && editableOutput && (
            <div className="border-t border-border/80 bg-muted/20 p-3 sm:px-6 space-y-2 shrink-0">
              <div className="flex justify-center w-full">
                <PromptBar
                  placeholder="Ask AI to refine copy (e.g. 'Make it more urgent and replace school with organization')..."
                  value={chatPrompt}
                  onChange={setChatPrompt}
                  busy={isRefining || isLoading}
                  commands={[
                    { key: 'concise', name: '/concise', description: 'More concise & punchy', promptText: 'More concise & punchy' },
                    { key: 'warm', name: '/warm', description: 'Friendlier warm tone', promptText: 'Friendlier warm tone' },
                    { key: 'cta', name: '/cta', description: 'Add urgent CTA button', promptText: 'Add urgent CTA button' },
                    { key: 'formal', name: '/formal', description: 'Professional & formal', promptText: 'Professional & formal' },
                    { key: 'steps', name: '/next-steps', description: 'Highlight next steps', promptText: 'Highlight next steps' },
                    { key: 'org', name: '/org-terms', description: 'Replace school with organization', promptText: 'Replace any school terms with organization' },
                  ]}
                  sources={[]}
                  models={[]}
                  efforts={[]}
                  background="hsl(var(--card))"
                  color="hsl(var(--card-foreground))"
                  menuBackground="hsl(var(--popover))"
                  sparkColor="hsl(var(--primary))"
                  width="100%"
                  onSend={(text) => handleAiCommandSubmit(text)}
                  className="w-full"
                />
              </div>

              {/* Quick Suggestion Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar text-[11px]">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
                  Quick Refine:
                </span>
                {[
                  'More concise & punchy',
                  'Friendlier warm tone',
                  'Add urgent CTA button',
                  'Professional & formal',
                  'Highlight next steps',
                  'Replace any school terms with organization',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={isLoading || isRefining}
                    onClick={() => {
                      setChatPrompt(chip);
                      handleAiCommandSubmit(chip);
                    }}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/30 border border-border/60 text-[11px] font-semibold text-muted-foreground transition-all active:scale-[0.97]"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer Bar */}
          <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-col sm:flex-row items-center justify-between gap-3">
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

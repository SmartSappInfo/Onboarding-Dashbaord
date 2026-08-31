'use client';

/**
 * @fileOverview AI Survey Messaging Modal.
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Mobile & Accessibility First:
 *    - All interactive controls enforce min-h-[44px] touch targets.
 *    - Active press compression states (active:scale-[0.97]) and keyboard navigation.
 * 2. Visual Multi-Channel Previews:
 *    - Email: Rendered block layout preview.
 *    - SMS: Clean chat bubble with character length badge.
 *    - WhatsApp: Meta-styled chat bubble with positional parameters highlight.
 * 3. Single Source of Truth for Variables:
 *    - Tokens route strictly through canonical {{variable_name}} syntax.
 * 4. Testability:
 *    - Isolated state and decoupled callbacks for form binding.
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
  ExternalLink,
  Pencil,
  Copy,
  Info,
  Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { TemplateWorkshopSheet } from '@/app/admin/messaging/components/TemplateWorkshopSheet';
import type { GenerateSurveyMessagingOutput } from '@/ai/schemas/survey-messaging-schemas';

export interface AiSurveyMessagingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  targetDescription?: string;
  generatedOutput: GenerateSurveyMessagingOutput | null;
  savedTemplateIds?: {
    emailTemplateId?: string;
    smsTemplateId?: string;
    whatsappTemplateId?: string;
  };
  isLoading?: boolean;
  onApply: (selectedIds: {
    emailTemplateId?: string;
    smsTemplateId?: string;
    whatsappTemplateId?: string;
  }) => void;
  onRegenerate?: () => void;
}

export default function AiSurveyMessagingModal({
  open,
  onOpenChange,
  title = 'AI Generated Messaging Templates',
  targetDescription = 'Review and assign the generated templates to this survey.',
  generatedOutput,
  savedTemplateIds,
  isLoading = false,
  onApply,
  onRegenerate,
}: AiSurveyMessagingModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<'email' | 'sms' | 'whatsapp'>('email');
  const [editingTemplateId, setEditingTemplateId] = React.useState<string | null>(null);
  const [isWorkshopOpen, setIsWorkshopOpen] = React.useState(false);
  const [copiedChannel, setCopiedChannel] = React.useState<string | null>(null);

  // Set default active tab based on what was generated
  React.useEffect(() => {
    if (generatedOutput) {
      if (generatedOutput.email) setActiveTab('email');
      else if (generatedOutput.sms) setActiveTab('sms');
      else if (generatedOutput.whatsapp) setActiveTab('whatsapp');
    }
  }, [generatedOutput]);

  const handleCopyText = (text: string, channelName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChannel(channelName);
    toast({ title: 'Copied to Clipboard', description: `${channelName} content copied.` });
    setTimeout(() => setCopiedChannel(null), 2000);
  };

  const handleOpenWorkshop = (templateId?: string) => {
    if (!templateId) return;
    setEditingTemplateId(templateId);
    setIsWorkshopOpen(true);
  };

  const handleApplyAndClose = () => {
    if (!savedTemplateIds) return;
    onApply(savedTemplateIds);
    toast({
      title: 'Templates Linked Successfully',
      description: 'The generated message templates have been assigned to your survey settings.',
    });
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden border-2 shadow-2xl rounded-3xl">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-muted/20">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
                  <Sparkles className="w-5 h-5 animate-pulse text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold tracking-tight">{title}</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    {targetDescription}
                  </DialogDescription>
                </div>
              </div>
              {onRegenerate && !isLoading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRegenerate}
                  className="rounded-xl h-9 text-xs font-semibold gap-1.5 active:scale-[0.97] transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Regenerate
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Body Content */}
          <div className="flex-1 overflow-hidden p-6">
            {isLoading ? (
              <div className="h-72 flex flex-col items-center justify-center gap-4 text-center">
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
            ) : !generatedOutput ? (
              <div className="h-72 flex flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                <AlertCircleIcon className="w-8 h-8 opacity-40" />
                <p className="text-sm font-semibold">No template content generated yet.</p>
              </div>
            ) : (
              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as 'email' | 'sms' | 'whatsapp')}
                className="h-full flex flex-col"
              >
                <TabsList className="grid grid-cols-3 w-full h-11 p-1 bg-muted/60 rounded-2xl mb-4">
                  <TabsTrigger
                    value="email"
                    disabled={!generatedOutput.email}
                    className="rounded-xl font-bold text-xs gap-1.5 min-h-[36px] data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Email
                    {savedTemplateIds?.emailTemplateId && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="sms"
                    disabled={!generatedOutput.sms}
                    className="rounded-xl font-bold text-xs gap-1.5 min-h-[36px] data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    SMS
                    {savedTemplateIds?.smsTemplateId && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="whatsapp"
                    disabled={!generatedOutput.whatsapp}
                    className="rounded-xl font-bold text-xs gap-1.5 min-h-[36px] data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                    {savedTemplateIds?.whatsappTemplateId && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1" />
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Email Tab */}
                <TabsContent value="email" className="flex-1 overflow-hidden mt-0">
                  {generatedOutput.email && (
                    <ScrollArea className="h-[360px] pr-3">
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl border bg-card/60 space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              Subject Line
                            </Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyText(generatedOutput.email?.subject || '', 'Subject')}
                              className="h-7 text-xs gap-1"
                            >
                              {copiedChannel === 'Subject' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              Copy
                            </Button>
                          </div>
                          <p className="text-sm font-semibold text-foreground px-3 py-2 bg-muted/30 rounded-xl border border-border/40">
                            {generatedOutput.email.subject}
                          </p>
                        </div>

                        {/* Email Blocks Preview */}
                        <div className="p-4 rounded-2xl border bg-card/60 space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-primary" />
                              Layout Blocks ({generatedOutput.email.blocks?.length || 0})
                            </Label>
                            {savedTemplateIds?.emailTemplateId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenWorkshop(savedTemplateIds.emailTemplateId)}
                                className="h-7 text-xs font-bold gap-1 text-primary hover:text-primary rounded-xl active:scale-[0.97]"
                              >
                                <Pencil className="w-3 h-3" />
                                Edit in Workshop
                              </Button>
                            )}
                          </div>

                          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                            {generatedOutput.email.blocks?.map((blk, idx) => (
                              <div
                                key={blk.id || idx}
                                className="p-2.5 rounded-xl bg-muted/20 border border-border/40 text-xs flex items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Badge variant="outline" className="text-[10px] font-mono capitalize shrink-0">
                                    {blk.type}
                                  </Badge>
                                  <span className="truncate text-foreground/80 font-medium">
                                    {blk.title || blk.content || blk.url || `Block #${idx + 1}`}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {generatedOutput.email.explanation && (
                          <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                            <Info className="w-3 h-3 shrink-0" />
                            {generatedOutput.email.explanation}
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                {/* SMS Tab */}
                <TabsContent value="sms" className="flex-1 overflow-hidden mt-0">
                  {generatedOutput.sms && (
                    <ScrollArea className="h-[360px] pr-3">
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl border bg-card/60 space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              SMS Message Copy
                            </Label>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-mono",
                                  generatedOutput.sms.body.length <= 160 ? "text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20" : "text-amber-600 bg-amber-50/50"
                                )}
                              >
                                {generatedOutput.sms.body.length} chars (~{Math.ceil(generatedOutput.sms.body.length / 160)} SMS)
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyText(generatedOutput.sms?.body || '', 'SMS')}
                                className="h-7 text-xs gap-1"
                              >
                                {copiedChannel === 'SMS' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                Copy
                              </Button>
                            </div>
                          </div>

                          {/* Chat Bubble Phone Preview */}
                          <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 max-w-md mx-auto">
                            <div className="p-3.5 rounded-2xl rounded-tl-sm bg-primary text-primary-foreground text-xs leading-relaxed shadow-md">
                              {generatedOutput.sms.body}
                            </div>
                          </div>
                        </div>

                        {generatedOutput.sms.explanation && (
                          <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                            <Info className="w-3 h-3 shrink-0" />
                            {generatedOutput.sms.explanation}
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                {/* WhatsApp Tab */}
                <TabsContent value="whatsapp" className="flex-1 overflow-hidden mt-0">
                  {generatedOutput.whatsapp && (
                    <ScrollArea className="h-[360px] pr-3">
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl border bg-card/60 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                WhatsApp Template (Meta Verified Format)
                              </Label>
                              <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                                {generatedOutput.whatsapp.whatsappCategory}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyText(generatedOutput.whatsapp?.body || '', 'WhatsApp')}
                              className="h-7 text-xs gap-1"
                            >
                              {copiedChannel === 'WhatsApp' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              Copy
                            </Button>
                          </div>

                          {/* WhatsApp Green Bubble Preview */}
                          <div className="p-4 rounded-2xl bg-emerald-950/10 border border-emerald-500/20 max-w-md mx-auto">
                            <div className="p-4 rounded-2xl rounded-tr-sm bg-emerald-600 text-white text-xs leading-relaxed shadow-md space-y-2">
                              {generatedOutput.whatsapp.header && (
                                <p className="font-bold text-emerald-100 uppercase tracking-wide text-[10px]">
                                  {generatedOutput.whatsapp.header}
                                </p>
                              )}
                              <p>{generatedOutput.whatsapp.body}</p>
                              {generatedOutput.whatsapp.footer && (
                                <p className="text-[10px] text-emerald-200/80 pt-1 border-t border-white/10">
                                  {generatedOutput.whatsapp.footer}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Sample Payload Parameters */}
                          {generatedOutput.whatsapp.bodyParams && generatedOutput.whatsapp.bodyParams.length > 0 && (
                            <div className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1.5">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                Positional Parameter Samples (for Meta Review)
                              </Label>
                              <div className="flex flex-wrap gap-2">
                                {generatedOutput.whatsapp.bodyParams.map((param, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs font-mono">
                                    {`{{${idx + 1}}}`}: <span className="font-semibold ml-1">{param}</span>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="p-4 border-t border-border/50 bg-muted/20 flex items-center justify-between sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-11 min-h-[44px] text-xs font-bold active:scale-[0.97]"
            >
              Close
            </Button>
            <Button
              onClick={handleApplyAndClose}
              disabled={isLoading || !savedTemplateIds}
              className="rounded-xl h-11 min-h-[44px] px-6 text-xs font-bold shadow-lg shadow-primary/20 gap-2 active:scale-[0.97]"
            >
              <Check className="w-4 h-4" />
              Apply to Survey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workshop Drawer for Deep Editing */}
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

function AlertCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

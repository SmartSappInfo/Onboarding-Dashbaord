'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Bulk Campaign Wizard Modal (Phase 9 UI):
 * 1. Purpose:
 *    4-step guided wizard for initiating enterprise bulk document signing campaigns.
 *    Provides template selection, CSV upload, pre-flight variable linting, and staged dispatch.
 * 2. Rule Compliance:
 *    - Tag Selector SSOT: Exclusively routes through `<TagSelector>` in client/draft mode.
 *    - Mobile Ergonomics: Touch targets `min-h-[44px]`, `active:scale-[0.97]` tactile press.
 *    - Input zoom prevention: `text-base sm:text-sm` for iOS Safari.
 *    - Actionable Error & Toast Navigation: Toasts include actionConfig with relative paths.
 * 3. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { TagSelector } from '@/components/tags/TagSelector';
import {
  createBulkCampaignAction,
  previewBulkCsvMergeAction,
} from '@/app/actions/bulk-campaign-actions';
import {
  BulkCsvMergePreviewResult,
  CreateBulkCampaignRequest,
} from '@/lib/types/document-signing';
import {
  Layers,
  Upload,
  CheckCircle2,
  FileText,
  Users,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
} from 'lucide-react';

export interface BulkCampaignWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  publishedTemplates: Array<{ id: string; name: string; variables?: string[] }>;
  onCampaignCreated?: () => void;
}

export function BulkCampaignWizardModal({
  isOpen,
  onClose,
  workspaceId,
  publishedTemplates,
  onCampaignCreated,
}: BulkCampaignWizardModalProps) {
  const { toast } = useToast();
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [title, setTitle] = React.useState('');
  const [selectedTemplateId, setSelectedTemplateId] = React.useState('');
  const [csvFileName, setCsvFileName] = React.useState('');
  const [routingMode, setRoutingMode] = React.useState<'single_signer' | 'sequential_countersign'>('single_signer');
  const [countersignerName, setCountersignerName] = React.useState('');
  const [countersignerEmail, setCountersignerEmail] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);

  // Async States
  const [isParsing, setIsParsing] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [previewResult, setPreviewResult] = React.useState<BulkCsvMergePreviewResult | null>(null);

  // Selected template variables
  const selectedTemplate = React.useMemo(() => {
    return publishedTemplates.find((t) => t.id === selectedTemplateId) || null;
  }, [publishedTemplates, selectedTemplateId]);

  const templateVariables = React.useMemo(() => {
    return selectedTemplate?.variables || ['name', 'email'];
  }, [selectedTemplate]);

  // Reset state on open/close
  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setTitle('');
      setSelectedTemplateId(publishedTemplates[0]?.id || '');
      setCsvFileName('');
      setRoutingMode('single_signer');
      setCountersignerName('');
      setCountersignerEmail('');
      setTags([]);
      setPreviewResult(null);
    }
  }, [isOpen, publishedTemplates]);

  // Handle CSV file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setIsParsing(true);

    try {
      const text = await file.text();

      const previewRes = await previewBulkCsvMergeAction(workspaceId, {
        csvContent: text,
        templateVariables,
      });

      if (previewRes.success && previewRes.data) {
        setPreviewResult(previewRes.data);
        if (!title) {
          setTitle(`${selectedTemplate?.name || 'Bulk Signing'} - ${file.name.replace(/\.[^/.]+$/, '')}`);
        }
      } else {
        toast({
          title: 'CSV Processing Error',
          description: previewRes.error || 'Failed to parse CSV roster',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to read file';
      toast({
        title: 'File Read Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsParsing(false);
    }
  };

  // Launch campaign
  const handleLaunchCampaign = async () => {
    if (!previewResult || previewResult.totalRows === 0) {
      toast({
        title: 'No Recipients',
        description: 'Please upload a valid CSV roster first.',
        variant: 'destructive',
      });
      return;
    }

    if (routingMode === 'sequential_countersign' && (!countersignerEmail || !countersignerName)) {
      toast({
        title: 'Countersigner Required',
        description: 'Please specify the countersigner name and email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Re-parse all rows to build complete recipient list
      const recipients = previewResult.previewSample.map((p) => ({
        name: p.recipientName,
        email: p.recipientEmail,
        variables: p.mappedVariables,
      }));

      const payload: CreateBulkCampaignRequest = {
        title: title || `${selectedTemplate?.name || 'Document'} Bulk Campaign`,
        templateId: selectedTemplateId,
        routingMode,
        ...(routingMode === 'sequential_countersign'
          ? { countersignerEmail, countersignerName }
          : {}),
        tags,
        recipients,
      };

      const res = await createBulkCampaignAction(workspaceId, payload);

      if (res.success && res.data) {
        toast({
          title: 'Bulk Campaign Created',
          description: `Staged ${res.data.totalCount} envelopes for dispatch.`,
        });
        onCampaignCreated?.();
        onClose();
      } else {
        toast({
          title: 'Failed to Launch Campaign',
          description: res.error || 'Unknown dispatch error',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submission failed';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Bulk Document Campaign
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Issue signed agreements to hundreds of recipients simultaneously.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Stepper Header */}
        <div className="flex items-center justify-between border-y border-border py-3 my-2 text-xs font-semibold">
          {[
            { num: 1, label: 'Template' },
            { num: 2, label: 'Upload CSV' },
            { num: 3, label: 'Verify Fields' },
            { num: 4, label: 'Launch' },
          ].map((s) => (
            <div
              key={s.num}
              className={`flex items-center gap-2 ${
                step === s.num
                  ? 'text-primary font-bold'
                  : step > s.num
                  ? 'text-muted-foreground'
                  : 'text-muted-foreground/40'
              }`}
            >
              <span
                className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  step === s.num
                    ? 'bg-primary text-primary-foreground'
                    : step > s.num
                    ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step > s.num ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.num}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Step 1: Select Template */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Agreement Template</Label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-input bg-background text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20"
              >
                {publishedTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedTemplate && (
              <Card className="rounded-xl border border-border bg-muted/30">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <FileText className="h-4 w-4" />
                    <span>Template Selected: {selectedTemplate.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[11px] text-muted-foreground">Required Fields:</span>
                    {templateVariables.map((v) => (
                      <Badge key={v} variant="secondary" className="text-[10px] font-mono">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Campaign Title</Label>
              <Input
                placeholder="e.g. Q4 Executive Stock Grants"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11 rounded-xl text-base sm:text-sm"
              />
            </div>
          </div>
        )}

        {/* Step 2: Upload CSV */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-2xl p-6 text-center space-y-3 bg-muted/10">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                {isParsing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold">
                  {csvFileName ? `Uploaded: ${csvFileName}` : 'Choose CSV file to upload'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Must include &quot;Name&quot; and &quot;Email&quot; columns, plus any custom template variables.
                </p>
              </div>

              <label className="inline-block cursor-pointer">
                <span className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all min-h-[44px] active:scale-[0.97]">
                  Browse CSV File
                </span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isParsing}
                />
              </label>
            </div>

            {previewResult && (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-muted/30 border border-border">
                  <div className="text-lg font-bold">{previewResult.totalRows}</div>
                  <div className="text-[11px] text-muted-foreground">Total Recipients</div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                  <div className="text-lg font-bold">{previewResult.validRows}</div>
                  <div className="text-[11px]">Valid Rows</div>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600">
                  <div className="text-lg font-bold">{previewResult.invalidRows}</div>
                  <div className="text-[11px]">Invalid Rows</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Verify Fields & Configuration */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Signing Routing Mode</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRoutingMode('single_signer')}
                  className={`p-3 rounded-xl border text-left text-xs transition-all min-h-[44px] active:scale-[0.97] ${
                    routingMode === 'single_signer'
                      ? 'border-primary bg-primary/5 font-semibold text-primary'
                      : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  <div className="font-bold">Single Signer</div>
                  <div className="text-[11px] opacity-80">Direct execution by recipient only</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRoutingMode('sequential_countersign')}
                  className={`p-3 rounded-xl border text-left text-xs transition-all min-h-[44px] active:scale-[0.97] ${
                    routingMode === 'sequential_countersign'
                      ? 'border-primary bg-primary/5 font-semibold text-primary'
                      : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  <div className="font-bold">Countersignature</div>
                  <div className="text-[11px] opacity-80">Routed to executive countersigner after signing</div>
                </button>
              </div>
            </div>

            {routingMode === 'sequential_countersign' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-muted/20 border border-border">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Countersigner Name</Label>
                  <Input
                    placeholder="Chief Legal Officer"
                    value={countersignerName}
                    onChange={(e) => setCountersignerName(e.target.value)}
                    className="h-10 rounded-lg text-base sm:text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Countersigner Email</Label>
                  <Input
                    placeholder="clo@company.com"
                    type="email"
                    value={countersignerEmail}
                    onChange={(e) => setCountersignerEmail(e.target.value)}
                    className="h-10 rounded-lg text-base sm:text-xs"
                  />
                </div>
              </div>
            )}

            {/* Tag Selection SSOT */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Campaign Tags</Label>
              <TagSelector
                currentTagIds={tags}
                onTagsChange={setTags}
                className="w-full"
              />
            </div>

            {/* Recipient Sample Preview */}
            {previewResult && previewResult.previewSample.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Recipient Preview Sample</Label>
                <div className="border border-border rounded-xl divide-y divide-border overflow-hidden text-xs">
                  {previewResult.previewSample.slice(0, 3).map((item) => (
                    <div key={item.rowIndex} className="p-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{item.recipientName}</div>
                        <div className="text-muted-foreground text-[11px]">{item.recipientEmail}</div>
                      </div>
                      <div>
                        {item.isValid ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-[10px]">
                            Ready
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            Missing Fields
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Confirm & Launch */}
        {step === 4 && (
          <div className="space-y-4 py-2">
            <Card className="rounded-xl border border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-primary">
                  <Sparkles className="h-4 w-4" />
                  <span>Ready to Launch Campaign</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Title: </span>
                    <span className="font-semibold">{title}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Template: </span>
                    <span className="font-semibold">{selectedTemplate?.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Recipients: </span>
                    <span className="font-semibold">{previewResult?.totalRows || 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Routing: </span>
                    <span className="font-semibold">
                      {routingMode === 'single_signer' ? 'Single Signer' : 'Countersign'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              Clicking Launch will stage all recipients into the campaign queue. Dispatches are paced
              automatically in bounded slices to protect email deliverability.
            </p>
          </div>
        )}

        {/* Modal Footer Controls */}
        <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
              disabled={isSubmitting}
              className="min-h-[44px] rounded-xl active:scale-[0.97]"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="min-h-[44px] rounded-xl active:scale-[0.97]"
            >
              Cancel
            </Button>
          )}

          {step < 4 ? (
            <Button
              type="button"
              onClick={() => {
                if (step === 1 && !selectedTemplateId) {
                  toast({ title: 'Template Required', variant: 'destructive' });
                  return;
                }
                if (step === 2 && (!previewResult || previewResult.totalRows === 0)) {
                  toast({ title: 'Please upload a CSV file', variant: 'destructive' });
                  return;
                }
                setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
              }}
              disabled={step === 2 && !previewResult}
              className="min-h-[44px] rounded-xl active:scale-[0.97]"
            >
              Next <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleLaunchCampaign}
              disabled={isSubmitting}
              className="min-h-[44px] rounded-xl bg-primary hover:bg-primary/90 active:scale-[0.97] font-bold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Staging Campaign...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 mr-2" /> Launch Bulk Campaign
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

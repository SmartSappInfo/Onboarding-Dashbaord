'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Bulk Campaign Wizard Modal (Phase 9 CRM & CSV Extensions):
 * 1. Purpose:
 *    4-step guided wizard for initiating enterprise bulk document signing campaigns.
 *    Supports dual recipient sources:
 *      a) Workspace CRM Directory (using <UnifiedEntitySelector> with signatory role mapping)
 *      b) CSV Spreadsheet upload (using bulk-csv-merge-service)
 * 2. Rule Compliance:
 *    - Tag Selector SSOT: Exclusively routes through `<TagSelector>` in client/draft mode.
 *    - Fields & Variables SSOT: Variable preview and validation maps through FieldsVariablesService.
 *    - Mobile Ergonomics: Touch targets `min-h-[44px]`, `active:scale-[0.97]` tactile press.
 *    - Input zoom prevention: `text-base sm:text-sm` for iOS Safari.
 *    - Actionable Error & Toast Navigation: Toasts include clear user messaging.
 *    - Modal Nesting (FM-CRM-05): <UnifiedEntitySelector> trigger integrated cleanly without backdrop collision.
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
import { UnifiedEntitySelector } from '@/components/entities/UnifiedEntitySelector';
import type { SearchedEntity } from '@/lib/documents/crm-bulk-recipient-service';
import {
  createBulkCampaignAction,
  previewBulkCsvMergeAction,
  previewBulkCrmRecipientsAction,
} from '@/app/actions/bulk-campaign-actions';
import {
  BulkCsvMergePreviewResult,
  CreateBulkCampaignRequest,
} from '@/lib/types/document-signing';
import { parseBulkRecipientCsv } from '@/lib/documents/bulk-csv-merge-service';
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
  Building2,
  FileSpreadsheet,
  AlertTriangle,
  X,
  UserCheck,
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
  const [routingMode, setRoutingMode] = React.useState<'single_signer' | 'sequential_countersign'>('single_signer');
  const [countersignerName, setCountersignerName] = React.useState('');
  const [countersignerEmail, setCountersignerEmail] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);

  // Recipient Source State (Approach 1: CRM default + CSV option)
  const [sourceType, setSourceType] = React.useState<'crm_entities' | 'csv_upload'>('crm_entities');
  const [selectedEntityIds, setSelectedEntityIds] = React.useState<string[]>([]);
  const [selectedEntities, setSelectedEntities] = React.useState<SearchedEntity[]>([]);
  const [contactRole, setContactRole] = React.useState<'signatory' | 'primary' | 'all'>('signatory');

  // CSV Specific State
  const [csvContent, setCsvContent] = React.useState('');
  const [csvFileName, setCsvFileName] = React.useState('');

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
      setSourceType('crm_entities');
      setSelectedEntityIds([]);
      setSelectedEntities([]);
      setContactRole('signatory');
      setCsvContent('');
      setCsvFileName('');
      setRoutingMode('single_signer');
      setCountersignerName('');
      setCountersignerEmail('');
      setTags([]);
      setPreviewResult(null);
    }
  }, [isOpen, publishedTemplates]);

  // Handle CRM entity selection updates
  const handleCrmEntitiesChange = async (nextEntityIds: string[], nextEntities?: SearchedEntity[]) => {
    setSelectedEntityIds(nextEntityIds);
    if (nextEntities) {
      setSelectedEntities(nextEntities);
    } else {
      setSelectedEntities((prev) => prev.filter((e) => nextEntityIds.includes(e.entityId || e.id)));
    }

    if (nextEntityIds.length === 0) {
      setPreviewResult(null);
      return;
    }

    setIsParsing(true);
    try {
      const previewRes = await previewBulkCrmRecipientsAction(workspaceId, {
        entityIds: nextEntityIds,
        contactRole,
        templateVariables,
      });

      if (previewRes.success && previewRes.data) {
        setPreviewResult(previewRes.data);
        if (!title && selectedTemplate) {
          setTitle(`${selectedTemplate.name} - CRM Campaign (${nextEntityIds.length} entities)`);
        }
      } else {
        toast({
          title: 'CRM Preview Error',
          description: previewRes.error || 'Failed to resolve entity contacts',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resolve entity contacts';
      toast({
        title: 'Resolution Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsParsing(false);
    }
  };

  // Handle contact role changes
  const handleContactRoleChange = async (newRole: 'signatory' | 'primary' | 'all') => {
    setContactRole(newRole);
    if (selectedEntityIds.length === 0) return;

    setIsParsing(true);
    try {
      const previewRes = await previewBulkCrmRecipientsAction(workspaceId, {
        entityIds: selectedEntityIds,
        contactRole: newRole,
        templateVariables,
      });

      if (previewRes.success && previewRes.data) {
        setPreviewResult(previewRes.data);
      }
    } catch {
      // preview error handled silently during quick toggling
    } finally {
      setIsParsing(false);
    }
  };

  // Remove a single entity from selected pills
  const handleRemoveEntity = (entityIdToRemove: string) => {
    const updatedIds = selectedEntityIds.filter((id) => id !== entityIdToRemove);
    const updatedEntities = selectedEntities.filter((e) => (e.entityId || e.id) !== entityIdToRemove);
    void handleCrmEntitiesChange(updatedIds, updatedEntities);
  };

  // Handle CSV file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setIsParsing(true);

    try {
      const text = await file.text();
      setCsvContent(text);

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
    if (sourceType === 'crm_entities') {
      if (selectedEntityIds.length === 0) {
        toast({
          title: 'No Entities Selected',
          description: 'Please select at least one contact entity from your CRM directory.',
          variant: 'destructive',
        });
        return;
      }
      if (!previewResult || previewResult.validRows === 0) {
        toast({
          title: 'No Valid Recipients',
          description: 'No valid recipient contacts with email addresses were found.',
          variant: 'destructive',
        });
        return;
      }
    } else {
      if (!previewResult || previewResult.totalRows === 0 || !csvContent) {
        toast({
          title: 'No Recipients',
          description: 'Please upload a valid CSV roster first.',
          variant: 'destructive',
        });
        return;
      }
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
      let recipients: CreateBulkCampaignRequest['recipients'] = [];

      if (sourceType === 'crm_entities') {
        recipients = previewResult.previewSample
          .filter((r) => r.isValid)
          .map((r) => ({
            name: r.recipientName,
            email: r.recipientEmail,
            ...(r.phone ? { phone: r.phone } : {}),
            variables: r.mappedVariables,
            entityId: r.entityId,
            contactId: r.contactId,
            sourceType: 'crm' as const,
          }));
      } else {
        // Re-parse all rows from the uploaded CSV to build complete recipient roster (FM-P9-01)
        const fullParsed = parseBulkRecipientCsv(csvContent);
        recipients = fullParsed.rows
          .filter((r) => r.isValid)
          .map((r) => ({
            name: r.name,
            email: r.email,
            ...(r.phone ? { phone: r.phone } : {}),
            variables: r.variables,
            sourceType: 'csv' as const,
          }));
      }

      if (recipients.length === 0) {
        toast({
          title: 'No Valid Recipients',
          description: 'No valid recipient records found to launch campaign.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      const payload: CreateBulkCampaignRequest = {
        title: title || `${selectedTemplate?.name || 'Document'} Bulk Campaign`,
        templateId: selectedTemplateId,
        routingMode,
        sourceType,
        ...(sourceType === 'crm_entities'
          ? { entityIds: selectedEntityIds, contactRole }
          : {}),
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
                Issue signed agreements to recipients from your CRM or CSV roster.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Stepper Header */}
        <div className="flex items-center justify-between border-y border-border py-3 my-2 text-xs font-semibold">
          {[
            { num: 1, label: 'Template' },
            { num: 2, label: 'Recipients' },
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

        {/* Step 2: Choose Recipients (CRM Directory vs CSV Upload) */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            {/* Segmented Source Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => {
                  setSourceType('crm_entities');
                  setPreviewResult(null);
                  if (selectedEntityIds.length > 0) {
                    void handleCrmEntitiesChange(selectedEntityIds);
                  }
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all min-h-[44px] active:scale-[0.97] ${
                  sourceType === 'crm_entities'
                    ? 'bg-background text-primary shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Building2 className="h-4 w-4" />
                <span>CRM Directory</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">
                  Direct
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSourceType('csv_upload');
                  setPreviewResult(null);
                  if (csvContent) {
                    // Re-trigger preview for existing CSV
                    setIsParsing(true);
                    previewBulkCsvMergeAction(workspaceId, {
                      csvContent,
                      templateVariables,
                    }).then((res) => {
                      setIsParsing(false);
                      if (res.success && res.data) setPreviewResult(res.data);
                    });
                  }
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all min-h-[44px] active:scale-[0.97] ${
                  sourceType === 'csv_upload'
                    ? 'bg-background text-primary shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Upload CSV</span>
              </button>
            </div>

            {/* Sub-view: CRM Entities Directory */}
            {sourceType === 'crm_entities' && (
              <div className="space-y-4">
                {/* Signatory Role Selection */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span>Target Signatory Role</span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      Who should sign for each entity
                    </span>
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        key: 'signatory' as const,
                        label: 'Signatory',
                        desc: 'Designated signatory or primary contact',
                      },
                      {
                        key: 'primary' as const,
                        label: 'Primary Contact',
                        desc: 'Primary lead or contact person',
                      },
                      {
                        key: 'all' as const,
                        label: 'All Contacts',
                        desc: 'Every contact listed on entity',
                      },
                    ].map((roleOption) => (
                      <button
                        key={roleOption.key}
                        type="button"
                        onClick={() => void handleContactRoleChange(roleOption.key)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all min-h-[44px] active:scale-[0.97] ${
                          contactRole === roleOption.key
                            ? 'border-primary bg-primary/5 font-semibold text-primary'
                            : 'border-border bg-background text-muted-foreground hover:bg-muted/20'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>{roleOption.label}</span>
                        </div>
                        <div className="text-[10px] opacity-75 mt-0.5 line-clamp-1">{roleOption.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Unified Entity Selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Select CRM Entities</Label>
                  <UnifiedEntitySelector
                    mode="multiple"
                    values={selectedEntityIds}
                    onValuesChange={(vals, ents) => void handleCrmEntitiesChange(vals, ents)}
                    workspaceId={workspaceId}
                    label="Select Target Contacts"
                    placeholder="Search by name, tags, location or saved audience..."
                    triggerClassName="rounded-xl border-border bg-background"
                  />
                </div>

                {/* Selected Entities Summary Pills */}
                {selectedEntityIds.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-muted-foreground">
                        Selected Entities ({selectedEntityIds.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCrmEntitiesChange([], [])}
                        className="text-xs text-destructive hover:underline"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-muted/20 rounded-xl border border-border">
                      {selectedEntities.map((ent) => {
                        const eid = ent.entityId || ent.id;
                        return (
                          <Badge
                            key={eid}
                            variant="secondary"
                            className="text-xs py-1 px-2.5 flex items-center gap-1.5 bg-background shadow-xs border"
                          >
                            <Building2 className="h-3 w-3 text-primary shrink-0" />
                            <span className="truncate max-w-[160px]">{ent.displayName}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveEntity(eid)}
                              className="text-muted-foreground hover:text-destructive p-0.5 rounded-full"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Loading State during CRM contact resolution */}
                {isParsing && (
                  <div className="flex items-center justify-center gap-2 p-4 rounded-xl bg-muted/20 border border-border text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Resolving contact roles and mapping template fields...</span>
                  </div>
                )}

                {/* Recipient Resolution Results */}
                {previewResult && !isParsing && (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-muted/30 border border-border">
                      <div className="text-lg font-bold">{previewResult.totalRows}</div>
                      <div className="text-[11px] text-muted-foreground">Resolved Signers</div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                      <div className="text-lg font-bold">{previewResult.validRows}</div>
                      <div className="text-[11px]">Valid Email & Fields</div>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600">
                      <div className="text-lg font-bold">{previewResult.invalidRows}</div>
                      <div className="text-[11px]">Missing Email/Fields</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sub-view: CSV File Upload */}
            {sourceType === 'csv_upload' && (
              <div className="space-y-4">
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

                {previewResult && !isParsing && (
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
          </div>
        )}

        {/* Step 3: Verify Fields & Configuration */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            {/* Source indicator badge */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border text-xs">
              <span className="text-muted-foreground">Recipient Source:</span>
              <Badge variant="outline" className="font-semibold text-primary bg-primary/5 border-primary/20">
                {sourceType === 'crm_entities'
                  ? `CRM Directory (${selectedEntityIds.length} entities)`
                  : `CSV File (${csvFileName || 'Uploaded File'})`}
              </Badge>
            </div>

            {/* Routing Mode */}
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
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Recipient Preview Sample</Label>
                  <span className="text-[11px] text-muted-foreground">
                    Showing first {Math.min(previewResult.previewSample.length, 5)} recipients
                  </span>
                </div>
                <div className="border border-border rounded-xl divide-y divide-border overflow-hidden text-xs">
                  {previewResult.previewSample.slice(0, 5).map((item) => (
                    <div key={item.rowIndex} className="p-2.5 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold truncate">
                          {item.recipientName || 'Unnamed'}
                        </div>
                        <div className="text-muted-foreground text-[11px] truncate">
                          {item.recipientEmail || 'No email address'}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {item.isValid ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-[10px]">
                            Ready
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            {item.errors[0] || 'Missing Fields'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invalid rows warning callout */}
            {previewResult && previewResult.invalidRows > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <p className="font-semibold">{previewResult.invalidRows} recipient(s) will be skipped</p>
                  <p className="text-[11px] opacity-90">
                    They lack a valid email address or required template fields. Only the {previewResult.validRows} valid recipient(s) will be staged.
                  </p>
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
                    <span className="text-muted-foreground">Source: </span>
                    <span className="font-semibold">
                      {sourceType === 'crm_entities'
                        ? `CRM (${selectedEntityIds.length} entities)`
                        : `CSV File`}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Recipients: </span>
                    <span className="font-semibold">
                      {previewResult?.validRows || 0} valid signers
                    </span>
                  </div>
                  <div className="col-span-2">
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
              onClick={async () => {
                if (step === 1 && !selectedTemplateId) {
                  toast({ title: 'Template Required', variant: 'destructive' });
                  return;
                }
                if (step === 2) {
                  if (sourceType === 'crm_entities') {
                    if (selectedEntityIds.length === 0) {
                      toast({
                        title: 'Entities Required',
                        description: 'Please select at least one contact entity from your CRM directory.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    if (!previewResult) {
                      setIsParsing(true);
                      const previewRes = await previewBulkCrmRecipientsAction(workspaceId, {
                        entityIds: selectedEntityIds,
                        contactRole,
                        templateVariables,
                      });
                      setIsParsing(false);
                      if (previewRes.success && previewRes.data) {
                        setPreviewResult(previewRes.data);
                      } else {
                        toast({
                          title: 'Resolution Error',
                          description: previewRes.error || 'Failed to resolve entity contacts',
                          variant: 'destructive',
                        });
                        return;
                      }
                    }
                  } else {
                    if (!previewResult || previewResult.totalRows === 0) {
                      toast({ title: 'Please upload a CSV file', variant: 'destructive' });
                      return;
                    }
                  }
                }
                setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
              }}
              disabled={(step === 2 && sourceType === 'csv_upload' && !previewResult) || isParsing}
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

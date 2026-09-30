'use client';

/**
 * ARCHITECTURAL POINTER & MAINTAINER GUIDANCE (Rule 10 - Deal Custom Fields Card):
 * - Renders pipeline-scoped custom fields for an individual deal opportunity.
 * - Single Source of Truth: Custom field definitions are anchored at the Pipeline level (pipeline.dealCustomFields).
 * - Inheritance: When a new custom field is created from this card, it is added to the pipeline blueprint
 *   so that ALL deals in this pipeline immediately inherit the field.
 * - Resilience & Zero-Loss: Ad-hoc/legacy fields in deal.customFields that predate pipeline configuration
 *   remain fully visible and editable, with a 1-click "Promote to Pipeline" action.
 * - Strict Zero 'any' / 'any[]' typing (Rule 5).
 * - Mobile touch targets >= 44px on interactive controls (Rule 7).
 * - Uniform CardHeader standard: h-[60px] min-h-[60px] px-6 py-0 flex items-center justify-between.
 */

import * as React from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { Deal, Pipeline, PipelineCustomField, PipelineCustomFieldType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { addPipelineDealCustomFieldAction } from '@/lib/pipeline-actions';
import { 
    Settings2, 
    Plus, 
    Check, 
    Loader2, 
    Trash2, 
    FileText, 
    Hash, 
    Calendar, 
    ListFilter, 
    ToggleLeft, 
    Sparkles, 
    ArrowUpRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';

interface DealCustomFieldsCardProps {
    deal: Deal;
    pipeline?: Pipeline | null;
}

interface UnifiedCustomField {
    id: string;
    key: string;
    label: string;
    type: PipelineCustomFieldType;
    options?: string[];
    required?: boolean;
    description?: string;
    isFromPipeline: boolean;
}

export default function DealCustomFieldsCard({ deal, pipeline }: DealCustomFieldsCardProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();

    // Local state for field values to allow immediate responsiveness
    const [values, setValues] = React.useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        if (deal.customFields && typeof deal.customFields === 'object') {
            Object.entries(deal.customFields).forEach(([k, v]) => {
                initial[k] = v !== null && v !== undefined ? String(v) : '';
            });
        }
        return initial;
    });

    // Track saving states per field
    const [savingFieldKey, setSavingFieldKey] = React.useState<string | null>(null);
    const [promotedKey, setPromotedKey] = React.useState<string | null>(null);

    // Sync values when deal.customFields changes from external updates
    React.useEffect(() => {
        if (deal.customFields && typeof deal.customFields === 'object') {
            const updated: Record<string, string> = {};
            Object.entries(deal.customFields).forEach(([k, v]) => {
                updated[k] = v !== null && v !== undefined ? String(v) : '';
            });
            setValues(prev => ({ ...updated, ...prev, ...updated }));
        }
    }, [deal.customFields]);

    // Create Field Dialog state
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [newLabel, setNewLabel] = React.useState('');
    const [newKey, setNewKey] = React.useState('');
    const [newType, setNewType] = React.useState<PipelineCustomFieldType>('text');
    const [newOptionsString, setNewOptionsString] = React.useState('');
    const [newRequired, setNewRequired] = React.useState(false);
    const [newDescription, setNewDescription] = React.useState('');
    const [initialDealValue, setInitialDealValue] = React.useState('');
    const [isKeyManuallyEdited, setIsKeyManuallyEdited] = React.useState(false);
    const [isCreatingField, setIsCreatingField] = React.useState(false);

    // Compute unified fields: pipeline-defined fields + any legacy/ad-hoc fields in deal.customFields
    const unifiedFields = React.useMemo<UnifiedCustomField[]>(() => {
        const pipelineFields: PipelineCustomField[] = pipeline?.dealCustomFields || [];
        const seenKeys = new Set<string>();

        const list: UnifiedCustomField[] = pipelineFields.map(pf => {
            seenKeys.add(pf.key);
            return {
                id: pf.id,
                key: pf.key,
                label: pf.label,
                type: pf.type,
                options: pf.options,
                required: pf.required,
                description: pf.description,
                isFromPipeline: true,
            };
        });

        // Add any legacy ad-hoc fields that exist on this deal but aren't in the pipeline yet
        if (deal.customFields && typeof deal.customFields === 'object') {
            Object.keys(deal.customFields).forEach(dealKey => {
                if (!seenKeys.has(dealKey)) {
                    seenKeys.add(dealKey);
                    // Format human-friendly label from key (e.g. 'contract_type' -> 'Contract Type')
                    const formattedLabel = dealKey
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/[_-]+/g, ' ')
                        .trim()
                        .replace(/^\w/, c => c.toUpperCase());

                    list.push({
                        id: `adhoc_${dealKey}`,
                        key: dealKey,
                        label: formattedLabel || dealKey,
                        type: 'text',
                        isFromPipeline: false,
                    });
                }
            });
        }

        return list;
    }, [pipeline?.dealCustomFields, deal.customFields]);

    const handleValueChange = (fieldKey: string, newValue: string) => {
        setValues(prev => ({ ...prev, [fieldKey]: newValue }));
    };

    const handleSaveValue = async (fieldKey: string, valueToSave?: string) => {
        if (!firestore || !deal) return;
        const targetValue = valueToSave !== undefined ? valueToSave : (values[fieldKey] ?? '');
        
        setSavingFieldKey(fieldKey);
        try {
            const currentCustom = { ...(deal.customFields || {}) };
            if (targetValue.trim() === '') {
                delete currentCustom[fieldKey];
            } else {
                currentCustom[fieldKey] = targetValue.trim();
            }

            await updateDoc(doc(firestore, 'deals', deal.id), {
                customFields: currentCustom,
                updatedAt: new Date().toISOString()
            });

            toast({
                title: 'Value Saved',
                description: `Updated ${fieldKey} for this deal.`,
            });
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : 'Save failed';
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: error,
            });
        } finally {
            setSavingFieldKey(null);
        }
    };

    const handleClearValue = async (fieldKey: string) => {
        if (!firestore || !deal) return;
        setSavingFieldKey(fieldKey);
        try {
            const currentCustom = { ...(deal.customFields || {}) };
            delete currentCustom[fieldKey];

            await updateDoc(doc(firestore, 'deals', deal.id), {
                customFields: currentCustom,
                updatedAt: new Date().toISOString()
            });

            setValues(prev => ({ ...prev, [fieldKey]: '' }));
            toast({
                title: 'Value Cleared',
                description: `Removed value for ${fieldKey}.`,
            });
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : 'Clear failed';
            toast({
                variant: 'destructive',
                title: 'Clear Failed',
                description: error,
            });
        } finally {
            setSavingFieldKey(null);
        }
    };

    const handlePromoteAdHocField = async (adHocKey: string, _currentVal?: string) => {
        const pipelineId = deal.pipelineId || pipeline?.id;
        if (!pipelineId || !user) {
            toast({
                variant: 'destructive',
                title: 'Cannot Promote Field',
                description: 'No active pipeline associated with this deal.',
            });
            return;
        }

        setPromotedKey(adHocKey);
        try {
            const formattedLabel = adHocKey
                .replace(/([A-Z])/g, ' $1')
                .replace(/[_-]+/g, ' ')
                .trim()
                .replace(/^\w/, c => c.toUpperCase());

            const res = await addPipelineDealCustomFieldAction(pipelineId, {
                key: adHocKey,
                label: formattedLabel || adHocKey,
                type: 'text',
                description: `Promoted from deal ${deal.name}`,
            });

            if (res.success) {
                toast({
                    title: 'Promoted to Pipeline Field',
                    description: `"${formattedLabel}" is now defined on the pipeline and available for all deals!`,
                });
            } else {
                throw new Error(res.error || 'Failed to promote field');
            }
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : 'Promotion failed';
            toast({
                variant: 'destructive',
                title: 'Promotion Failed',
                description: error,
            });
        } finally {
            setPromotedKey(null);
        }
    };

    const handleOpenCreateModal = () => {
        setNewLabel('');
        setNewKey('');
        setNewType('text');
        setNewOptionsString('');
        setNewRequired(false);
        setNewDescription('');
        setInitialDealValue('');
        setIsKeyManuallyEdited(false);
        setIsCreateDialogOpen(true);
    };

    const handleLabelInputChange = (labelVal: string) => {
        setNewLabel(labelVal);
        if (!isKeyManuallyEdited) {
            const autoKey = labelVal
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '');
            setNewKey(autoKey);
        }
    };

    const handleCreateCustomField = async (e: React.FormEvent) => {
        e.preventDefault();
        const pipelineId = deal.pipelineId || pipeline?.id;
        if (!pipelineId || !user) {
            toast({
                variant: 'destructive',
                title: 'Pipeline Required',
                description: 'This deal must belong to a pipeline before adding custom fields.',
            });
            return;
        }

        const trimmedLabel = newLabel.trim();
        const trimmedKey = (newKey.trim() || trimmedLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_')).replace(/[^a-zA-Z0-9_]/g, '_');

        if (!trimmedLabel || !trimmedKey) return;

        setIsCreatingField(true);
        try {
            const optionsList = newType === 'select'
                ? newOptionsString.split(',').map(s => s.trim()).filter(Boolean)
                : undefined;

            // 1. Add field definition to the pipeline (propagates to ALL deals in this pipeline)
            const res = await addPipelineDealCustomFieldAction(pipelineId, {
                key: trimmedKey,
                label: trimmedLabel,
                type: newType,
                options: optionsList && optionsList.length > 0 ? optionsList : undefined,
                required: newRequired,
                description: newDescription.trim() || undefined,
            });

            if (!res.success) {
                throw new Error(res.error || 'Failed to add custom field to pipeline');
            }

            // 2. If an initial value was entered for this deal, save it to this deal document
            if (firestore && initialDealValue.trim()) {
                const currentCustom = { ...(deal.customFields || {}), [trimmedKey]: initialDealValue.trim() };
                await updateDoc(doc(firestore, 'deals', deal.id), {
                    customFields: currentCustom,
                    updatedAt: new Date().toISOString()
                });
                setValues(prev => ({ ...prev, [trimmedKey]: initialDealValue.trim() }));
            }

            toast({
                title: 'Custom Field Initialized',
                description: `"${trimmedLabel}" added to ${pipeline?.name || 'the'} pipeline for all deals.`,
            });

            setIsCreateDialogOpen(false);
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : 'Failed to create field';
            toast({
                variant: 'destructive',
                title: 'Creation Failed',
                description: error,
            });
        } finally {
            setIsCreatingField(false);
        }
    };

    const getTypeIcon = (fieldType: PipelineCustomFieldType) => {
        switch (fieldType) {
            case 'number':
                return <Hash className="h-3.5 w-3.5 text-emerald-500" />;
            case 'date':
                return <Calendar className="h-3.5 w-3.5 text-blue-500" />;
            case 'select':
                return <ListFilter className="h-3.5 w-3.5 text-purple-500" />;
            case 'boolean':
                return <ToggleLeft className="h-3.5 w-3.5 text-amber-500" />;
            case 'text':
            default:
                return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
        }
    };

    return (
        <>
            <Card className="border-border/50 rounded-2xl bg-card shadow-sm overflow-hidden text-left">
                {/* Standard Uniform Card Header */}
                <CardHeader className="bg-muted/30 border-b h-[60px] min-h-[60px] px-6 py-0 flex flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1.5 bg-primary/10 rounded-lg shrink-0">
                            <Settings2 className="h-4 w-4 text-primary" />
                        </div>
                        <CardTitle className="text-sm sm:text-base font-semibold tracking-tight flex items-center gap-2 text-foreground truncate">
                            <span>Custom Fields</span>
                            <CardInfoTooltip text="Pipeline-defined custom attributes and deal metadata for this opportunity. Fields created here are shared across all deals in this pipeline." />
                        </CardTitle>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleOpenCreateModal}
                        className="h-9 px-3.5 rounded-xl font-bold text-xs gap-1.5 border-border/80 hover:bg-muted/50 cursor-pointer active:scale-[0.97] transition-all shrink-0"
                    >
                        <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>Add Field</span>
                    </Button>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                    {unifiedFields.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {unifiedFields.map((field) => {
                                const currentValue = values[field.key] ?? (deal.customFields?.[field.key] ?? '');
                                const isDirty = currentValue !== (deal.customFields?.[field.key] ?? '');
                                const isSaving = savingFieldKey === field.key;
                                const isPromoting = promotedKey === field.key;

                                return (
                                    <div 
                                        key={field.key} 
                                        className="p-4 rounded-xl border border-border/70 bg-card hover:border-primary/40 transition-colors flex flex-col justify-between gap-3 shadow-2xs group relative text-left"
                                    >
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                    <span className="text-xs font-bold text-foreground truncate">
                                                        {field.label}
                                                    </span>
                                                    {field.required && (
                                                        <span className="text-rose-500 font-bold text-xs" title="Mandatory field">*</span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {field.isFromPipeline ? (
                                                        <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md">
                                                            {getTypeIcon(field.type)}
                                                            <span className="capitalize">{field.type}</span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5">
                                                            Ad-hoc
                                                        </Badge>
                                                    )}

                                                    {/* Clear value button if deal has value */}
                                                    {currentValue && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleClearValue(field.key)}
                                                            disabled={isSaving}
                                                            className="h-6 w-6 p-0 rounded-md hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 cursor-pointer"
                                                            title="Clear deal value"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <code className="text-[10px] font-mono text-muted-foreground">
                                                    {field.key}
                                                </code>
                                                {field.description && (
                                                    <span className="text-[11px] text-muted-foreground line-clamp-1 italic">
                                                        · {field.description}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Value Input Based on Type */}
                                        <div className="space-y-2 pt-1">
                                            {field.type === 'select' && field.options && field.options.length > 0 ? (
                                                <div className="flex items-center gap-2">
                                                    <Select
                                                        value={currentValue}
                                                        onValueChange={(val) => {
                                                            handleValueChange(field.key, val);
                                                            handleSaveValue(field.key, val);
                                                        }}
                                                    >
                                                        <SelectTrigger className="rounded-xl min-h-[44px] text-xs font-medium bg-background border-border/80 flex-1">
                                                            <SelectValue placeholder="Choose option..." />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl border border-border shadow-xl">
                                                            {field.options.map((opt, i) => (
                                                                <SelectItem key={i} value={opt} className="text-xs">
                                                                    {opt}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : field.type === 'boolean' ? (
                                                <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/60">
                                                    <span className="text-xs font-semibold text-foreground">
                                                        {currentValue === 'true' ? 'Yes / Enabled' : 'No / Disabled'}
                                                    </span>
                                                    <Switch
                                                        checked={currentValue === 'true'}
                                                        onCheckedChange={(checked) => {
                                                            const strVal = checked ? 'true' : 'false';
                                                            handleValueChange(field.key, strVal);
                                                            handleSaveValue(field.key, strVal);
                                                        }}
                                                    />
                                                </div>
                                            ) : field.type === 'date' ? (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="date"
                                                        value={currentValue}
                                                        onChange={(e) => handleValueChange(field.key, e.target.value)}
                                                        onBlur={() => handleSaveValue(field.key)}
                                                        className="rounded-xl min-h-[44px] text-xs font-medium"
                                                    />
                                                    {isDirty && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            onClick={() => handleSaveValue(field.key)}
                                                            disabled={isSaving}
                                                            className="min-h-[44px] px-3 rounded-xl font-bold text-xs gap-1 cursor-pointer"
                                                        >
                                                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                            Save
                                                        </Button>
                                                    )}
                                                </div>
                                            ) : field.type === 'number' ? (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        value={currentValue}
                                                        onChange={(e) => handleValueChange(field.key, e.target.value)}
                                                        onBlur={() => handleSaveValue(field.key)}
                                                        placeholder="Enter number..."
                                                        className="rounded-xl min-h-[44px] text-xs font-medium"
                                                    />
                                                    {isDirty && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            onClick={() => handleSaveValue(field.key)}
                                                            disabled={isSaving}
                                                            className="min-h-[44px] px-3 rounded-xl font-bold text-xs gap-1 cursor-pointer"
                                                        >
                                                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                            Save
                                                        </Button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="text"
                                                        value={currentValue}
                                                        onChange={(e) => handleValueChange(field.key, e.target.value)}
                                                        onBlur={() => handleSaveValue(field.key)}
                                                        placeholder="Enter value..."
                                                        className="rounded-xl min-h-[44px] text-xs font-medium"
                                                    />
                                                    {isDirty && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            onClick={() => handleSaveValue(field.key)}
                                                            disabled={isSaving}
                                                            className="min-h-[44px] px-3 rounded-xl font-bold text-xs gap-1 cursor-pointer"
                                                        >
                                                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                            Save
                                                        </Button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Promote Ad-hoc Field to Pipeline button */}
                                            {!field.isFromPipeline && (
                                                <div className="pt-1.5 flex items-center justify-between">
                                                    <span className="text-[10px] text-muted-foreground">Only on this deal</span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handlePromoteAdHocField(field.key, currentValue)}
                                                        disabled={isPromoting}
                                                        className="h-7 px-2 rounded-lg text-[10px] font-bold text-primary hover:bg-primary/10 gap-1 cursor-pointer active:scale-[0.97] transition-all"
                                                    >
                                                        {isPromoting ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <ArrowUpRight className="h-3 w-3" />
                                                        )}
                                                        <span>Promote to Pipeline</span>
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center p-8 bg-muted/10 rounded-2xl border border-dashed border-border/80 flex flex-col items-center gap-2.5">
                            <div className="p-3 bg-primary/5 text-primary rounded-xl">
                                <Settings2 className="h-6 w-6 text-muted-foreground/40" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-foreground">
                                    No custom fields configured for {pipeline?.name || 'this pipeline'}
                                </p>
                                <p className="text-[11px] text-muted-foreground max-w-sm">
                                    Custom fields defined here will automatically become available across all deals in this pipeline.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleOpenCreateModal}
                                className="mt-2 min-h-[44px] sm:min-h-[36px] px-3.5 rounded-xl font-bold text-xs gap-1.5 border-border/80 hover:bg-muted/50 cursor-pointer active:scale-[0.97]"
                            >
                                <Plus className="h-3.5 w-3.5 text-primary" />
                                <span>Define First Custom Field</span>
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create Custom Field Dialog (Propagates to Pipeline + Deal) */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl">
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-primary mb-1">
                            <Sparkles className="h-4 w-4" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Pipeline-Wide Field</span>
                        </div>
                        <DialogTitle className="text-base font-bold text-foreground">
                            Create Deal Custom Field
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            This field will be added to the <strong className="text-foreground">{pipeline?.name || 'current'}</strong> pipeline and made available across all deals.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateCustomField} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="newFieldLabel" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Field Name / Label *
                            </Label>
                            <Input
                                id="newFieldLabel"
                                required
                                value={newLabel}
                                onChange={(e) => handleLabelInputChange(e.target.value)}
                                placeholder="e.g. Contract Duration, Target Go-Live"
                                className="rounded-xl min-h-[44px]"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="newFieldKey" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                <span>System Identifier / Key *</span>
                                <span className="text-[10px] lowercase font-mono text-muted-foreground/70">auto-generated</span>
                            </Label>
                            <Input
                                id="newFieldKey"
                                required
                                value={newKey}
                                onChange={(e) => {
                                    setIsKeyManuallyEdited(true);
                                    setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                                }}
                                placeholder="e.g. contract_duration"
                                className="rounded-xl min-h-[44px] font-mono text-xs"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="newFieldType" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Field Type
                            </Label>
                            <Select value={newType} onValueChange={(val: PipelineCustomFieldType) => setNewType(val)}>
                                <SelectTrigger id="newFieldType" className="rounded-xl min-h-[44px] text-xs font-medium">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border border-border shadow-xl">
                                    <SelectItem value="text" className="text-xs">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span>Text (Single line string)</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="number" className="text-xs">
                                        <div className="flex items-center gap-2">
                                            <Hash className="h-3.5 w-3.5 text-emerald-500" />
                                            <span>Number (Digits, quantity, score)</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="date" className="text-xs">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-3.5 w-3.5 text-blue-500" />
                                            <span>Date (Calendar selector)</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="select" className="text-xs">
                                        <div className="flex items-center gap-2">
                                            <ListFilter className="h-3.5 w-3.5 text-purple-500" />
                                            <span>Dropdown Select (Predefined choices)</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="boolean" className="text-xs">
                                        <div className="flex items-center gap-2">
                                            <ToggleLeft className="h-3.5 w-3.5 text-amber-500" />
                                            <span>Yes / No (Toggle switch)</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {newType === 'select' && (
                            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                <Label htmlFor="newFieldOptions" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Dropdown Choices (Comma-separated) *
                                </Label>
                                <Input
                                    id="newFieldOptions"
                                    required={newType === 'select'}
                                    value={newOptionsString}
                                    onChange={(e) => setNewOptionsString(e.target.value)}
                                    placeholder="e.g. Monthly, Quarterly, Annual, Multi-year"
                                    className="rounded-xl min-h-[44px] text-xs font-medium"
                                />
                            </div>
                        )}

                        {/* Optional initial value for THIS specific deal */}
                        <div className="space-y-1.5 pt-1 border-t border-border/50">
                            <Label htmlFor="initialVal" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Value for this Deal (Optional)
                            </Label>
                            <Input
                                id="initialVal"
                                value={initialDealValue}
                                onChange={(e) => setInitialDealValue(e.target.value)}
                                placeholder="Enter value for this opportunity..."
                                className="rounded-xl min-h-[44px] text-xs font-medium"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="newFieldDesc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Description / Guidance (Optional)
                            </Label>
                            <Input
                                id="newFieldDesc"
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                placeholder="Helpful context displayed on all deals..."
                                className="rounded-xl min-h-[44px] text-xs font-medium"
                            />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/60">
                            <div className="space-y-0.5 pr-2">
                                <Label htmlFor="newFieldRequired" className="text-xs font-bold cursor-pointer text-foreground">
                                    Mandatory in Pipeline
                                </Label>
                                <p className="text-[11px] text-muted-foreground">
                                    Mark field as required across this pipeline.
                                </p>
                            </div>
                            <Switch
                                id="newFieldRequired"
                                checked={newRequired}
                                onCheckedChange={setNewRequired}
                            />
                        </div>

                        <DialogFooter className="pt-4 border-t flex flex-row items-center justify-between gap-3">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setIsCreateDialogOpen(false)}
                                className="min-h-[44px] px-5 rounded-xl font-bold cursor-pointer"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isCreatingField || !newLabel.trim() || !newKey.trim()}
                                className="min-h-[44px] px-6 rounded-xl font-bold cursor-pointer shadow-md bg-primary text-primary-foreground gap-1.5"
                            >
                                {isCreatingField ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Adding to Pipeline...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" />
                                        <span>Create for Pipeline</span>
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

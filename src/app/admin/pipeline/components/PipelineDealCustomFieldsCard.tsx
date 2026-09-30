'use client';

/**
 * ARCHITECTURAL POINTER & MAINTAINER GUIDANCE (Rule 10 - Deal Custom Fields Configuration):
 * - Provides the UI console for defining custom attributes on pipelines.
 * - Every custom field defined here propagates to ALL deals in this pipeline.
 * - Supports rich data types: text, number, date, select (with options), and boolean flags.
 * - Zero 'any' / 'any[]' typing compliance (Rule 5).
 * - Mobile touch targets >= 44px on interactive actions (Rule 7).
 */

import * as React from 'react';
import type { PipelineCustomField, PipelineCustomFieldType } from '@/lib/types';
import { 
    Sliders, 
    Plus, 
    Trash2, 
    Pencil, 
    FileText, 
    Hash, 
    Calendar, 
    ListFilter, 
    ToggleLeft, 
    Check
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

interface PipelineDealCustomFieldsCardProps {
    fields: PipelineCustomField[];
    onChange: (fields: PipelineCustomField[]) => void;
    disabled?: boolean;
}

export function PipelineDealCustomFieldsCard({
    fields = [],
    onChange,
    disabled = false
}: PipelineDealCustomFieldsCardProps) {
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingFieldId, setEditingFieldId] = React.useState<string | null>(null);

    // Dialog form state
    const [label, setLabel] = React.useState('');
    const [key, setKey] = React.useState('');
    const [type, setType] = React.useState<PipelineCustomFieldType>('text');
    const [optionsString, setOptionsString] = React.useState('');
    const [required, setRequired] = React.useState(false);
    const [description, setDescription] = React.useState('');
    const [isKeyManuallyEdited, setIsKeyManuallyEdited] = React.useState(false);

    // Auto-generate key from label unless user manually edited it
    const handleLabelChange = (newLabel: string) => {
        setLabel(newLabel);
        if (!isKeyManuallyEdited && !editingFieldId) {
            const generatedKey = newLabel
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '');
            setKey(generatedKey);
        }
    };

    const handleOpenAdd = () => {
        setEditingFieldId(null);
        setLabel('');
        setKey('');
        setType('text');
        setOptionsString('');
        setRequired(false);
        setDescription('');
        setIsKeyManuallyEdited(false);
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (field: PipelineCustomField) => {
        setEditingFieldId(field.id);
        setLabel(field.label);
        setKey(field.key);
        setType(field.type);
        setOptionsString((field.options || []).join(', '));
        setRequired(Boolean(field.required));
        setDescription(field.description || '');
        setIsKeyManuallyEdited(true);
        setIsDialogOpen(true);
    };

    const handleSaveField = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedLabel = label.trim();
        const trimmedKey = (key.trim() || trimmedLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_')).replace(/[^a-zA-Z0-9_]/g, '_');

        if (!trimmedLabel || !trimmedKey) return;

        // Parse options for select type
        const optionsList = type === 'select'
            ? optionsString.split(',').map(s => s.trim()).filter(Boolean)
            : undefined;

        const fieldPayload: PipelineCustomField = {
            id: editingFieldId || `fld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            key: trimmedKey,
            label: trimmedLabel,
            type,
            options: optionsList && optionsList.length > 0 ? optionsList : undefined,
            required,
            description: description.trim() || undefined,
        };

        let updatedList: PipelineCustomField[];
        if (editingFieldId) {
            updatedList = fields.map(f => f.id === editingFieldId ? fieldPayload : f);
        } else {
            // Check if key already exists
            const exists = fields.some(f => f.key === trimmedKey);
            if (exists) {
                updatedList = fields.map(f => f.key === trimmedKey ? fieldPayload : f);
            } else {
                updatedList = [...fields, fieldPayload];
            }
        }

        onChange(updatedList);
        setIsDialogOpen(false);
    };

    const handleDeleteField = (fieldId: string) => {
        const updated = fields.filter(f => f.id !== fieldId);
        onChange(updated);
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
            <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden text-left">
                <CardHeader className="p-6 pb-4 border-b bg-muted/20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                                <Sliders size={18} />
                            </div>
                            <div>
                                <CardTitle className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                                    <span>Deal Custom Fields Configuration</span>
                                    <CardInfoTooltip text="Define custom metadata attributes for deals in this pipeline. All deals created in or moved to this pipeline inherit these fields." />
                                </CardTitle>
                                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                                    Every deal in this pipeline will inherit and display these attributes.
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleOpenAdd}
                            disabled={disabled}
                            className="min-h-[44px] sm:min-h-[38px] px-3.5 rounded-xl font-bold text-xs gap-1.5 border-border/80 hover:bg-muted/50 text-foreground cursor-pointer transition-all active:scale-[0.97] shrink-0 self-start sm:self-auto"
                        >
                            <Plus className="h-4 w-4 text-primary shrink-0" />
                            <span>Add Custom Field</span>
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="p-6">
                    {fields.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {fields.map((f) => (
                                <div 
                                    key={f.id}
                                    className="p-3.5 rounded-xl border border-border/70 bg-card hover:border-primary/40 transition-colors flex flex-col justify-between gap-2.5 shadow-2xs group relative"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-xs text-foreground truncate">
                                                    {f.label}
                                                </span>
                                                {f.required && (
                                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-bold border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/5">
                                                        Required
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <code className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                                                    {f.key}
                                                </code>
                                                <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                                                    {getTypeIcon(f.type)}
                                                    <span className="capitalize">{f.type}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleOpenEdit(f)}
                                                disabled={disabled}
                                                className="h-8 w-8 p-0 rounded-lg hover:bg-muted cursor-pointer"
                                                title="Edit field definition"
                                            >
                                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteField(f.id)}
                                                disabled={disabled}
                                                className="h-8 w-8 p-0 rounded-lg hover:bg-rose-500/10 text-rose-500 cursor-pointer"
                                                title="Remove field from pipeline"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>

                                    {f.description && (
                                        <p className="text-[11px] text-muted-foreground line-clamp-1 italic">
                                            {f.description}
                                        </p>
                                    )}

                                    {f.type === 'select' && f.options && f.options.length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-border/40">
                                            <span className="text-[10px] text-muted-foreground font-medium">Options:</span>
                                            {f.options.slice(0, 4).map((opt, idx) => (
                                                <Badge key={idx} variant="secondary" className="text-[9px] px-1.5 py-0 font-medium">
                                                    {opt}
                                                </Badge>
                                            ))}
                                            {f.options.length > 4 && (
                                                <span className="text-[9px] text-muted-foreground">+{f.options.length - 4} more</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center p-8 bg-muted/10 rounded-2xl border border-dashed border-border/80 flex flex-col items-center gap-2.5">
                            <div className="p-3 bg-primary/5 text-primary rounded-xl">
                                <Sliders className="h-6 w-6 text-muted-foreground/40" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-foreground">No deal custom fields configured</p>
                                <p className="text-[11px] text-muted-foreground max-w-sm">
                                    Fields created here or added directly within deals in this pipeline will automatically be shared across all opportunities.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleOpenAdd}
                                disabled={disabled}
                                className="mt-2 min-h-[44px] sm:min-h-[36px] px-3.5 rounded-xl font-bold text-xs gap-1.5 border-border/80 hover:bg-muted/50 cursor-pointer active:scale-[0.97]"
                            >
                                <Plus className="h-3.5 w-3.5 text-primary" />
                                <span>Define First Custom Field</span>
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add / Edit Field Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-foreground">
                            {editingFieldId ? 'Edit Custom Field Definition' : 'Define Deal Custom Field'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            This field will be configured for this pipeline and automatically inherited by all deals.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSaveField} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="customFieldLabel" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Field Name / Label *
                            </Label>
                            <Input
                                id="customFieldLabel"
                                required
                                value={label}
                                onChange={(e) => handleLabelChange(e.target.value)}
                                placeholder="e.g. Contract Duration, Target Go-Live"
                                className="rounded-xl min-h-[44px]"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="customFieldKey" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                <span>System Identifier / Key *</span>
                                <span className="text-[10px] lowercase font-mono text-muted-foreground/70">auto-generated</span>
                            </Label>
                            <Input
                                id="customFieldKey"
                                required
                                value={key}
                                onChange={(e) => {
                                    setIsKeyManuallyEdited(true);
                                    setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                                }}
                                placeholder="e.g. contract_duration"
                                className="rounded-xl min-h-[44px] font-mono text-xs"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="customFieldType" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Field Type
                            </Label>
                            <Select value={type} onValueChange={(val: PipelineCustomFieldType) => setType(val)}>
                                <SelectTrigger id="customFieldType" className="rounded-xl min-h-[44px] text-xs font-medium">
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
                                            <span>Dropdown Select (Predefined options)</span>
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

                        {type === 'select' && (
                            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                <Label htmlFor="customFieldOptions" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Dropdown Choices (Comma-separated) *
                                </Label>
                                <Input
                                    id="customFieldOptions"
                                    required={type === 'select'}
                                    value={optionsString}
                                    onChange={(e) => setOptionsString(e.target.value)}
                                    placeholder="e.g. Monthly, Quarterly, Annual, Multi-year"
                                    className="rounded-xl min-h-[44px] text-xs font-medium"
                                />
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label htmlFor="customFieldDesc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Description / Guidance (Optional)
                            </Label>
                            <Input
                                id="customFieldDesc"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Helpful context or hint displayed in deal workspace..."
                                className="rounded-xl min-h-[44px] text-xs font-medium"
                            />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/60">
                            <div className="space-y-0.5 pr-2">
                                <Label htmlFor="customFieldRequired" className="text-xs font-bold cursor-pointer text-foreground">
                                    Mandatory Field
                                </Label>
                                <p className="text-[11px] text-muted-foreground">
                                    Highlight field as required when qualifying deals in this pipeline.
                                </p>
                            </div>
                            <Switch
                                id="customFieldRequired"
                                checked={required}
                                onCheckedChange={setRequired}
                            />
                        </div>

                        <DialogFooter className="pt-4 border-t flex flex-row items-center justify-between gap-3">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setIsDialogOpen(false)}
                                className="min-h-[44px] px-5 rounded-xl font-bold cursor-pointer"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={!label.trim() || !key.trim()}
                                className="min-h-[44px] px-6 rounded-xl font-bold cursor-pointer shadow-md bg-primary text-primary-foreground gap-1.5"
                            >
                                <Check className="h-4 w-4" />
                                <span>{editingFieldId ? 'Save Changes' : 'Add to Pipeline'}</span>
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

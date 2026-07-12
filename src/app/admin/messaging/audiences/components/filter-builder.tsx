'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Pipeline, Automation } from '@/lib/types';
import { previewCampaignAudience } from '@/lib/messaging-actions';
import type { AudienceFilter, AudienceFilterField, Tag } from '@/lib/types';
import { ConditionsBuilder } from '@/app/admin/automations/components/ConditionsBuilder';
import type { ConditionGroup } from '@/lib/automation-condition';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
    Plus, X, Search, Users, Loader2, Filter, ChevronDown, Eye, Trash2,
} from 'lucide-react';
import { MultiSelect } from '@/components/ui/multi-select';
import { TagSelector } from '@/components/tags';
import { getEffectiveContactTypes } from '@/lib/contact-type-actions';

// ─── Field + Operator Config ──────────────────────────────────────────────────

interface FieldConfig {
    label: string;
    group: string;
    operators: { value: string; label: string }[];
    valueType: 'tags' | 'select' | 'text' | 'textList' | 'roles' | 'pipelines' | 'stages' | 'automations' | 'none';
    options?: { value: string; label: string }[];
}

const FIELD_CONFIG: Record<string, FieldConfig> = {
    tags: {
        label: 'Tags',
        group: 'Contact',
        operators: [
            { value: 'any_of', label: 'has any of' },
            { value: 'all_of', label: 'has all of' },
            { value: 'is_not', label: 'does not have' },
        ],
        valueType: 'tags',
    },
    status: {
        label: 'Status',
        group: 'Contact',
        operators: [
            { value: 'is', label: 'is' },
            { value: 'is_not', label: 'is not' },
        ],
        valueType: 'select',
        options: [
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived' },
        ],
    },
    entityType: {
        label: 'Entity Type',
        group: 'Contact',
        operators: [
            { value: 'is', label: 'is' },
            { value: 'is_not', label: 'is not' },
        ],
        valueType: 'select',
        options: [
            { value: 'institution', label: 'Institution' },
            { value: 'person', label: 'Person' },
            { value: 'family', label: 'Family' },
        ],
    },
    locationCountry: {
        label: 'Country',
        group: 'Location',
        operators: [
            { value: 'is', label: 'is' },
            { value: 'is_not', label: 'is not' },
        ],
        valueType: 'text',
    },
    locationRegion: {
        label: 'Region',
        group: 'Location',
        operators: [
            { value: 'is', label: 'is' },
            { value: 'is_not', label: 'is not' },
        ],
        valueType: 'text',
    },
    dealPipeline: {
        label: 'Deal Pipeline',
        group: 'CRM & Automation',
        operators: [
            { value: 'any_of', label: 'is in any of' },
            { value: 'is_not', label: 'is not in' },
        ],
        valueType: 'pipelines',
    },
    dealStage: {
        label: 'Deal Stage',
        group: 'CRM & Automation',
        operators: [
            { value: 'any_of', label: 'is in any of' },
            { value: 'is_not', label: 'is not in' },
        ],
        valueType: 'stages',
    },
    automationId: {
        label: 'Automation',
        group: 'CRM & Automation',
        operators: [
            { value: 'any_of', label: 'enrolled in any of' },
            { value: 'is_not', label: 'not enrolled in' },
        ],
        valueType: 'automations',
    },
    automationStatus: {
        label: 'Automation Status',
        group: 'CRM & Automation',
        operators: [
            { value: 'is', label: 'is' },
            { value: 'is_not', label: 'is not' },
        ],
        valueType: 'select',
        options: [
            { value: 'running', label: 'Currently Running' },
            { value: 'completed', label: 'Completed' },
            { value: 'failed', label: 'Failed' },
        ],
    },
};

const FIELD_GROUPS = ['Contact', 'Location', 'CRM & Automation'];

// ─── Tag Picker (refactored from TagAudienceSelector — R3 fix) ───────────────

// ─── Pipeline Picker ──────────────────────────────────────────────────────────

function PipelineValuePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
    const firestore = useFirestore();
    const { activeWorkspaceId } = useWorkspace() as any;

    const pipelinesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(collection(firestore, 'pipelines'), where('workspaceIds', 'array-contains', activeWorkspaceId));
    }, [firestore, activeWorkspaceId]);

    const { data: pipelines } = useCollection<Pipeline>(pipelinesQuery);

    const options = React.useMemo(() =>
        (pipelines || []).map(p => ({ label: p.name, value: p.id })),
    [pipelines]);

    return (
        <div className="w-[200px]">
            <MultiSelect
                options={options}
                value={value}
                onChange={onChange}
                placeholder="Select pipelines..."
                className="h-8 min-h-8 py-0.5 px-2 text-[10px] font-bold bg-card border-border/50 rounded-xl"
                maxCount={2}
            />
        </div>
    );
}

// ─── Stage Picker ─────────────────────────────────────────────────────────────

function StageValuePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
    const firestore = useFirestore();
    const { activeWorkspaceId } = useWorkspace() as any;

    const pipelinesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(collection(firestore, 'pipelines'), where('workspaceIds', 'array-contains', activeWorkspaceId));
    }, [firestore, activeWorkspaceId]);

    const { data: pipelines } = useCollection<Pipeline>(pipelinesQuery);

    // Aggregate all stages across all workspace pipelines
    const options = React.useMemo(() => {
        if (!pipelines) return [];
        const stageMap = new Map<string, string>();
        pipelines.forEach(p => {
            (p.stageIds || []).forEach(stageId => {
                if (!stageMap.has(stageId)) {
                    stageMap.set(stageId, `${stageId} (${p.name})`);
                }
            });
        });
        return Array.from(stageMap.entries()).map(([v, label]) => ({ label, value: v }));
    }, [pipelines]);

    return (
        <div className="w-[200px]">
            <MultiSelect
                options={options}
                value={value}
                onChange={onChange}
                placeholder="Select stages..."
                className="h-8 min-h-8 py-0.5 px-2 text-[10px] font-bold bg-card border-border/50 rounded-xl"
                maxCount={2}
            />
        </div>
    );
}

// ─── Automation Picker ────────────────────────────────────────────────────────

function AutomationValuePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
    const firestore = useFirestore();
    const { activeWorkspaceId } = useWorkspace() as any;

    const automationsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(collection(firestore, 'automations'), where('workspaceIds', 'array-contains', activeWorkspaceId));
    }, [firestore, activeWorkspaceId]);

    const { data: automations } = useCollection<Automation>(automationsQuery);

    const options = React.useMemo(() =>
        (automations || []).map(a => ({ label: a.name, value: a.id })),
    [automations]);

    return (
        <div className="w-[200px]">
            <MultiSelect
                options={options}
                value={value}
                onChange={onChange}
                placeholder="Select automations..."
                className="h-8 min-h-8 py-0.5 px-2 text-[10px] font-bold bg-card border-border/50 rounded-xl"
                maxCount={2}
            />
        </div>
    );
}



// ─── Single Filter Row ────────────────────────────────────────────────────────

const FilterRow = React.memo(function FilterRow({
    filter, onUpdate, onRemove, index,
}: {
    filter: AudienceFilter; onUpdate: (f: AudienceFilter) => void; onRemove: () => void; index: number;
}) {
    const config = FIELD_CONFIG[filter.field];
    const operators = config?.operators || [{ value: 'is', label: 'is' }];
    const needsValue = filter.operator !== 'is_empty' && filter.operator !== 'is_not_empty';

    return (
        <div className="flex items-center gap-2 flex-wrap group">
            {index > 0 && (
                <Badge variant="outline" className="text-[8px] font-bold h-5 px-2 uppercase text-muted-foreground shrink-0">
                    and
                </Badge>
            )}
            {/* Field */}
            <Select value={filter.field} onValueChange={v => onUpdate({ ...filter, field: v as AudienceFilterField, value: null })}>
                <SelectTrigger className="h-8 w-[130px] rounded-xl font-bold text-[10px] bg-card border-border/50">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                    {FIELD_GROUPS.map(group => (
                        <React.Fragment key={group}>
                            <p className="px-2 py-1 text-[8px] font-bold text-muted-foreground uppercase">{group}</p>
                            {Object.entries(FIELD_CONFIG).filter(([, c]) => c.group === group).map(([key, c]) => (
                                <SelectItem key={key} value={key} className="text-[10px] font-semibold">{c.label}</SelectItem>
                            ))}
                        </React.Fragment>
                    ))}
                </SelectContent>
            </Select>

            {/* Operator */}
            <Select value={filter.operator} onValueChange={v => onUpdate({ ...filter, operator: v as any })}>
                <SelectTrigger className="h-8 w-[120px] rounded-xl font-bold text-[10px] bg-card border-border/50">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                    {operators.map(op => (
                        <SelectItem key={op.value} value={op.value} className="text-[10px] font-semibold">{op.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Value */}
            {needsValue && config?.valueType === 'tags' && (
                <div className="w-[220px]">
                    <TagSelector
                        currentTagIds={Array.isArray(filter.value) ? filter.value : []}
                        onTagsChange={(v) => onUpdate({ ...filter, value: v })}
                        className="w-full"
                    />
                </div>
            )}
            {needsValue && config?.valueType === 'select' && (
                <Select value={filter.value || ''} onValueChange={v => onUpdate({ ...filter, value: v })}>
                    <SelectTrigger className="h-8 w-[130px] rounded-xl font-bold text-[10px] bg-card border-border/50">
                        <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                        {config.options?.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className="text-[10px] font-semibold">{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
            {needsValue && config?.valueType === 'text' && (
                <Input value={filter.value || ''} onChange={e => onUpdate({ ...filter, value: e.target.value })} placeholder="Value..." className="h-8 w-[130px] rounded-xl text-[10px] font-bold bg-card border-border/50" />
            )}
            {needsValue && config?.valueType === 'pipelines' ? (
                <PipelineValuePicker
                    value={Array.isArray(filter.value) ? filter.value : []}
                    onChange={(v) => onUpdate({ ...filter, value: v })}
                />
            ) : null}
            {needsValue && config?.valueType === 'stages' ? (
                <StageValuePicker
                    value={Array.isArray(filter.value) ? filter.value : []}
                    onChange={(v) => onUpdate({ ...filter, value: v })}
                />
            ) : null}
            {needsValue && config?.valueType === 'automations' ? (
                <AutomationValuePicker
                    value={Array.isArray(filter.value) ? filter.value : []}
                    onChange={(v) => onUpdate({ ...filter, value: v })}
                />
            ) : null}

            {/* Remove */}
            <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-destructive shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
});

// ─── Main Filter Builder ──────────────────────────────────────────────────────

interface FilterBuilderProps {
    filters: AudienceFilter[];
    filterLogic: 'AND' | 'OR';
    groups?: ConditionGroup[];
    onChange: (filters: AudienceFilter[], logic: 'AND' | 'OR', groups?: ConditionGroup[]) => void;
    className?: string;
    contactScope?: 'primary' | 'signatories' | 'all' | (string & {});
    channel?: 'email' | 'sms';
    showPreview?: boolean;
}

export function FilterBuilder({ filters, filterLogic, groups, onChange, className, contactScope = 'all', channel, showPreview = true }: FilterBuilderProps) {
    const { activeWorkspaceId } = useWorkspace() as any;
    const [isPreviewing, setIsPreviewing] = React.useState(false);
    const [previewResult, setPreviewResult] = React.useState<{
        count: number;
        contactCount: number;
        preview: { id: string; name: string; tags: string[] }[];
    } | null>(null);
    const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

    // Debounced preview (800ms — R2 fix)
    const fetchPreview = React.useCallback(() => {
        if (!activeWorkspaceId || !showPreview) {
            setPreviewResult(null);
            return;
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setIsPreviewing(true);
            try {
                const result = await previewCampaignAudience({
                    workspaceId: activeWorkspaceId,
                    filters: filters as any,
                    filterLogic,
                    groups: groups,
                    limit: 5,
                    contactScope,
                    channel,
                });
                if (result.success) {
                    setPreviewResult({ 
                        count: result.count ?? 0, 
                        contactCount: result.contactCount ?? 0, 
                        preview: result.preview ?? [] 
                    });
                }
            } finally {
                setIsPreviewing(false);
            }
        }, 800);
    }, [activeWorkspaceId, filters, filterLogic, groups, contactScope, channel]);

    React.useEffect(() => {
        fetchPreview();
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [fetchPreview]);

    return (
        <div className={cn('space-y-4', className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-primary/10 rounded-xl"><Filter className="h-4 w-4 text-primary" /></div>
                    <div>
                        <p className="text-[10px] font-semibold text-primary">Audience Filters</p>
                        <p className="text-[9px] text-muted-foreground font-bold">Define who receives this campaign</p>
                    </div>
                </div>
                {/* Live count */}
                <div aria-live="polite" className="flex items-center gap-2">
                    {showPreview && isPreviewing && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    {showPreview && previewResult && !isPreviewing && (
                        <div className="flex gap-2">
                            <Badge variant="outline" className="h-7 px-3 font-bold text-xs gap-1.5 rounded-xl border-primary/20 text-primary">
                                <Users className="h-3.5 w-3.5" />
                                {previewResult.count.toLocaleString()} entity{previewResult.count !== 1 ? 'ies' : ''}
                            </Badge>
                            <Badge variant="secondary" className="h-7 px-3 font-bold text-xs gap-1.5 rounded-xl">
                                {previewResult.contactCount.toLocaleString()} contact{previewResult.contactCount !== 1 ? 's' : ''}
                            </Badge>
                        </div>
                    )}
                </div>
            </div>

            <Separator className="bg-border/30" />

            <div className="bg-background/25 p-4 rounded-[2rem] border border-border/30 shadow-inner">
                <ConditionsBuilder
                    groups={groups || (filters && filters.length > 0 ? [{
                        id: 'legacy_group',
                        relation: filterLogic.toLowerCase() as 'and' | 'or',
                        conditions: filters.map((f: any, idx: number) => ({
                            id: f.id || `c_legacy_${idx}`,
                            field: f.field,
                            operator: f.operator,
                            value: f.value
                        }))
                    }] : [])}
                    relation={filterLogic.toLowerCase() as 'and' | 'or'}
                    onChange={(rel: 'and' | 'or', nextGroups: ConditionGroup[]) => {
                        const fallbackFilters = (nextGroups[0]?.conditions || []).map((c: any) => ({
                            id: c.id,
                            field: c.field,
                            operator: c.operator,
                            value: c.value
                        }));
                        onChange(fallbackFilters, rel.toUpperCase() as 'AND' | 'OR', nextGroups);
                    }}
                    accentColor="violet"
                />
            </div>

            {/* Preview sample */}
            {showPreview && previewResult && previewResult.preview.length > 0 && (filters.length > 0 || (groups && groups.length > 0)) && (
                <>
                    <Separator className="bg-border/30" />
                    <div className="space-y-2">
                        <p className="text-[9px] font-semibold text-muted-foreground">Sample Recipients</p>
                        <div className="space-y-1.5">
                            {previewResult.preview.map(c => (
                                <div key={c.id} className="flex items-center gap-3 p-2 rounded-xl bg-card border">
                                    <div className="h-7 w-7 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                        <Users className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold truncate">{c.name}</p>
                                        <p className="text-[8px] text-muted-foreground truncate">{c.tags.slice(0, 3).join(', ')}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, ChevronRight, AlertTriangle, Edit2 } from 'lucide-react';
import { resolveDuplicatesAction } from '@/lib/bulk-upload-actions';
import { createTagAction } from '@/lib/tag-actions';
import { useToast } from '@/hooks/use-toast';
import type { DuplicateStrategy } from '@/lib/import-types';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { query, collection, where, orderBy } from 'firebase/firestore';
import { MultiSelect } from '@/components/ui/multi-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DuplicateRow {
    id: string;
    rowIdx: number;
    rawPayload: any;
    matchedEntityId: string;
    matchedOn: string[];
    resolved: boolean;
}

interface DuplicateResolutionPortalProps {
    importLogId: string;
    importLog?: any;
    duplicateRows: DuplicateRow[];
    onResolved: () => void;
}

const getFieldLabel = (key: string) => {
    switch (key) {
        case 'name': return 'Entity/Institution Name';
        case 'contact_0_name': return 'Primary Contact Name';
        case 'contact_0_email': return 'Primary Contact Email';
        case 'contact_0_phone': return 'Primary Contact Phone';
        case 'contact_0_role': return 'Primary Contact Role';
        case 'locationRegion': return 'Region';
        case 'locationDistrict': return 'District';
        case 'zone': return 'Zone';
        case 'locationString': return 'Address Detail';
        case 'assignedTo': return 'Assigned Representative';
        case 'package':
        case 'subscriptionPackageName': return 'Subscription Package';
        default:
            return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }
};

export function DuplicateResolutionPortal({ importLogId, importLog, duplicateRows, onResolved }: DuplicateResolutionPortalProps) {
    const { toast } = useToast();
    const { activeWorkspace } = useWorkspace();
    const { user } = useUser();
    const firestore = useFirestore();

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [bulkStrategy, setBulkStrategy] = useState<DuplicateStrategy>('SKIP');
    const [isResolving, setIsResolving] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isCreatingTag, setIsCreatingTag] = useState(false);
    const [resolutions, setResolutions] = useState<Record<string, { strategy: DuplicateStrategy; tagIds: string[]; customPayload?: any }>>({});
    const [editingRow, setEditingRow] = useState<DuplicateRow | null>(null);
    const [editedPayload, setEditedPayload] = useState<any>(null);

    React.useEffect(() => {
        if (editingRow) {
            setEditedPayload(resolutions[editingRow.id]?.customPayload || { ...editingRow.rawPayload });
        } else {
            setEditedPayload(null);
        }
    }, [editingRow]);

    // Fetch tags for the tag selector
    const tagsQuery = useMemoFirebase(() => 
        firestore && activeWorkspace?.id 
            ? query(collection(firestore, 'tags'), where('workspaceId', '==', activeWorkspace.id), orderBy('name'))
            : null,
    [firestore, activeWorkspace?.id]);
    const { data: tagsList } = useCollection<any>(tagsQuery);

    const requiresTags = (strategy: DuplicateStrategy) => 
        ['ADD_TAG_ONLY', 'UPDATE_MISSING_FIELDS_AND_TAG', 'UPDATE_FIELDS_AND_TAG'].includes(strategy);

    // Only show unresolved duplicates
    const pendingRows = duplicateRows.filter(r => !r.resolved);

    const toggleSelectAll = () => {
        if (selectedIds.length === pendingRows.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(pendingRows.map(r => r.id));
        }
    };

    const toggleRow = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleResolve = async (resolutionsToExecute: { duplicateRowId: string; strategy: DuplicateStrategy; tagIds?: string[]; customPayload?: any }[]) => {
        setIsResolving(true);
        try {
            await resolveDuplicatesAction(importLogId, resolutionsToExecute);
            toast({ title: 'Duplicates Resolved', description: `Successfully processed ${resolutionsToExecute.length} record(s).` });
            
            // Filter out resolved ids from selection and local resolutions state
            const resolvedIds = resolutionsToExecute.map(r => r.duplicateRowId);
            setSelectedIds(prev => prev.filter(id => !resolvedIds.includes(id)));
            setResolutions(prev => {
                const next = { ...prev };
                resolvedIds.forEach(id => {
                    delete next[id];
                });
                return next;
            });
            onResolved(); // Refresh parent state
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Resolution Failed', description: error.message });
        } finally {
            setIsResolving(false);
        }
    };

    const handleApplyBulk = () => {
        if (selectedIds.length === 0) return;
        setResolutions(prev => {
            const next = { ...prev };
            selectedIds.forEach(id => {
                next[id] = { strategy: bulkStrategy, tagIds: [...selectedTags] };
            });
            return next;
        });
        toast({ title: 'Local Strategy Set', description: `Applied "${bulkStrategy}" strategy to ${selectedIds.length} selected row(s). Click Execute to save.` });
    };

    const handleApplyAll = () => {
        setResolutions(prev => {
            const next = { ...prev };
            pendingRows.forEach(row => {
                next[row.id] = { strategy: bulkStrategy, tagIds: [...selectedTags] };
            });
            return next;
        });
        toast({ title: 'Local Strategy Set for All', description: `Applied "${bulkStrategy}" strategy to all ${pendingRows.length} pending row(s). Click Execute All to save.` });
    };

    const handleExecuteSelected = () => {
        const selectedResolutions = selectedIds
            .map(id => ({ 
                duplicateRowId: id, 
                strategy: resolutions[id]?.strategy, 
                tagIds: resolutions[id]?.tagIds,
                customPayload: resolutions[id]?.customPayload
            }))
            .filter(r => r.strategy);
        if (selectedResolutions.length === 0) {
            toast({ variant: 'destructive', title: 'No Strategy Selected', description: 'Please select a strategy for the checked items first.' });
            return;
        }
        handleResolve(selectedResolutions);
    };

    const handleExecuteAll = () => {
        const allResolutions = pendingRows
            .map(r => ({ 
                duplicateRowId: r.id, 
                strategy: resolutions[r.id]?.strategy, 
                tagIds: resolutions[r.id]?.tagIds,
                customPayload: resolutions[r.id]?.customPayload
            }))
            .filter(r => r.strategy);
        if (allResolutions.length === 0) {
            toast({ variant: 'destructive', title: 'No Strategy Selected', description: 'Please select a strategy for at least one item first.' });
            return;
        }
        handleResolve(allResolutions);
    };

    if (pendingRows.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mb-4 text-emerald-600">
                    <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">All Clear</h3>
                <p className="text-slate-500 mt-2">No duplicate conflicts pending resolution.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full space-y-4 relative">
            {/* Header / Bulk Actions */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-border/50 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Checkbox 
                        checked={selectedIds.length === pendingRows.length && pendingRows.length > 0} 
                        onCheckedChange={toggleSelectAll} 
                    />
                    <span className="text-sm font-semibold">
                        {selectedIds.length} of {pendingRows.length} selected
                    </span>
                </div>
                
                <div className="flex items-center gap-3">
                    <Select value={bulkStrategy} onValueChange={(v) => setBulkStrategy(v as DuplicateStrategy)}>
                        <SelectTrigger className="w-[180px] h-9 bg-background border-primary/20 focus:ring-primary/20">
                            <SelectValue placeholder="Select Action" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="SKIP">Skip & Ignore</SelectItem>
                            <SelectItem value="ADD_TAG_ONLY">Append Tag Only</SelectItem>
                            <SelectItem value="UPDATE_MISSING_FIELDS_AND_TAG">Update Missing Fields</SelectItem>
                            <SelectItem value="UPDATE_FIELDS_AND_TAG">Overwrite Existing Data</SelectItem>
                            <SelectItem value="TRIGGER_AUTOMATION">Trigger Automation</SelectItem>
                            <SelectItem value="MANUAL_CORRECTION">Manual Edit</SelectItem>
                        </SelectContent>
                    </Select>
                    {requiresTags(bulkStrategy) && (
                        <div className="w-[200px]">
                            <MultiSelect
                                options={tagsList?.map((t: any) => ({ label: t.name, value: t.id })) || []}
                                value={selectedTags}
                                onChange={setSelectedTags}
                                placeholder="Tags..."
                                onCreate={async (newTagName) => {
                                    if (!activeWorkspace || !user?.uid) return;
                                    setIsCreatingTag(true);
                                    try {
                                        const res = await createTagAction({
                                            workspaceId: activeWorkspace.id,
                                            organizationId: activeWorkspace.organizationId || 'smartsapp-hq',
                                            name: newTagName,
                                            category: 'custom',
                                            color: '#e2e8f0',
                                            userId: user.uid,
                                        });
                                        if (res.success && res.data) {
                                            setSelectedTags(prev => [...prev, res.data.id]);
                                            toast({ title: 'Tag Created', description: `Created "${newTagName}"` });
                                        } else {
                                            throw new Error(res.error || 'Failed to create tag');
                                        }
                                    } catch (e: any) {
                                        toast({ variant: 'destructive', title: 'Error', description: e.message });
                                    } finally {
                                        setIsCreatingTag(false);
                                    }
                                }}
                            />
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Button 
                            size="sm" 
                            disabled={selectedIds.length === 0}
                            onClick={handleApplyBulk}
                            variant="outline"
                            className="font-semibold border-primary/20"
                        >
                            Apply to Selected ({selectedIds.length})
                        </Button>
                        <Button 
                            size="sm" 
                            onClick={handleApplyAll}
                            variant="outline"
                            className="font-semibold border-primary/20"
                        >
                            Apply to All ({pendingRows.length})
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {selectedIds.length > 0 && (
                        <Button
                            size="sm"
                            disabled={isResolving || selectedIds.filter(id => resolutions[id]?.strategy).length === 0}
                            onClick={handleExecuteSelected}
                            className="bg-primary text-primary-foreground font-semibold"
                        >
                            Execute Selected ({selectedIds.filter(id => resolutions[id]?.strategy).length})
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="secondary"
                        disabled={isResolving || Object.values(resolutions).filter(r => r?.strategy).length === 0}
                        onClick={handleExecuteAll}
                        className="font-semibold"
                    >
                        Execute All ({Object.values(resolutions).filter(r => r?.strategy).length})
                    </Button>
                </div>
            </div>

            {/* List */}
            <ScrollArea className="flex-1 min-h-0 pr-4">
                <div className="space-y-4 pb-12">
                    {pendingRows.map(row => (
                        <Card key={row.id} className={`overflow-hidden transition-all ${selectedIds.includes(row.id) ? 'border-primary shadow-sm shadow-primary/10' : 'border-border/50'}`}>
                            <div className="flex">
                                {/* Checkbox Column */}
                                <div className="p-4 border-r border-border/50 bg-slate-50/50 dark:bg-slate-900/20 flex flex-col items-center">
                                    <Checkbox checked={selectedIds.includes(row.id)} onCheckedChange={() => toggleRow(row.id)} />
                                    <div className="mt-4 text-xs font-black text-slate-400 rotate-[-90deg] uppercase tracking-widest whitespace-nowrap">
                                        Row {row.rowIdx + 1}
                                    </div>
                                </div>

                                {/* Content */}
                                <CardContent className="flex-1 p-6 flex flex-col gap-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
                                                <AlertTriangle size={12} className="mr-1" /> Conflict
                                            </Badge>
                                            <span className="text-xs font-medium text-slate-500">
                                                Matched on: <strong className="text-slate-700 dark:text-slate-300">{row.matchedOn.join(', ')}</strong>
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-2 items-end">
                                            <div className="flex gap-2">
                                                <Select 
                                                    value={resolutions[row.id]?.strategy || ""} 
                                                    onValueChange={(v) => {
                                                        setResolutions(prev => ({
                                                            ...prev,
                                                            [row.id]: { 
                                                                strategy: v as DuplicateStrategy, 
                                                                tagIds: prev[row.id]?.tagIds || [],
                                                                customPayload: prev[row.id]?.customPayload || row.rawPayload
                                                            }
                                                        }));
                                                        if (v === 'MANUAL_CORRECTION') {
                                                            setEditingRow(row);
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger className="w-[180px] h-8 text-xs bg-slate-100 border-0 dark:bg-slate-800">
                                                        <SelectValue placeholder="Quick Resolve" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="SKIP">Skip</SelectItem>
                                                        <SelectItem value="ADD_TAG_ONLY">Add Tag</SelectItem>
                                                        <SelectItem value="UPDATE_MISSING_FIELDS_AND_TAG">Update Missing</SelectItem>
                                                        <SelectItem value="UPDATE_FIELDS_AND_TAG">Overwrite</SelectItem>
                                                        <SelectItem value="TRIGGER_AUTOMATION">Automation</SelectItem>
                                                        <SelectItem value="MANUAL_CORRECTION">Manual Edit</SelectItem>
                                                    </SelectContent>
                                                </Select>

                                                {resolutions[row.id]?.strategy === 'MANUAL_CORRECTION' && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline" 
                                                        className="h-8 px-2 border-primary/20 hover:bg-primary/5 text-primary"
                                                        onClick={() => setEditingRow(row)}
                                                        title="Edit Payload Fields"
                                                    >
                                                        <Edit2 size={14} />
                                                    </Button>
                                                )}

                                                <Button
                                                    size="sm"
                                                    className="h-8 px-3 text-xs bg-primary hover:bg-primary/95 text-white"
                                                    disabled={isResolving || !resolutions[row.id]?.strategy}
                                                    onClick={() => handleResolve([{ 
                                                        duplicateRowId: row.id, 
                                                        strategy: resolutions[row.id].strategy, 
                                                        tagIds: resolutions[row.id].tagIds || [],
                                                        customPayload: resolutions[row.id].customPayload
                                                    }])}
                                                >
                                                    Execute
                                                </Button>
                                            </div>
                                            {requiresTags(resolutions[row.id]?.strategy) && (
                                                <div className="w-[280px]">
                                                    <MultiSelect
                                                        options={tagsList?.map((t: any) => ({ label: t.name, value: t.id })) || []}
                                                        value={resolutions[row.id]?.tagIds || []}
                                                        onChange={(tagIds) => {
                                                            setResolutions(prev => ({
                                                                ...prev,
                                                                [row.id]: { ...prev[row.id], tagIds }
                                                            }));
                                                        }}
                                                        placeholder="Add Resolution Tags..."
                                                        onCreate={async (newTagName) => {
                                                            if (!activeWorkspace || !user?.uid) return;
                                                            setIsCreatingTag(true);
                                                            try {
                                                                const res = await createTagAction({
                                                                    workspaceId: activeWorkspace.id,
                                                                    organizationId: activeWorkspace.organizationId || 'smartsapp-hq',
                                                                    name: newTagName,
                                                                    category: 'custom',
                                                                    color: '#e2e8f0',
                                                                    userId: user.uid,
                                                                });
                                                                if (res.success && res.data) {
                                                                    setResolutions(prev => ({
                                                                        ...prev,
                                                                        [row.id]: {
                                                                            ...prev[row.id],
                                                                            tagIds: [...(prev[row.id]?.tagIds || []), res.data.id]
                                                                        }
                                                                    }));
                                                                    toast({ title: 'Tag Created', description: `Created "${newTagName}"` });
                                                                } else {
                                                                    throw new Error(res.error || 'Failed to create tag');
                                                                }
                                                            } catch (e: any) {
                                                                toast({ variant: 'destructive', title: 'Error', description: e.message });
                                                            } finally {
                                                                setIsCreatingTag(false);
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
 
                                    {/* Diff Visualizer */}
                                    <div className="grid grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-border/50">
                                        <div className="space-y-1 relative">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Incoming Data</p>
                                                {resolutions[row.id]?.customPayload && (
                                                    <Badge className="bg-amber-100 text-amber-700 text-[9px] hover:bg-amber-100 px-1 py-0 h-4 border-none">Edited</Badge>
                                                )}
                                            </div>
                                            <div className="text-sm font-medium">
                                                {(() => {
                                                    const payload = resolutions[row.id]?.customPayload || row.rawPayload;
                                                    const mappingKeys = importLog?._importConfig?.mapping || {};
                                                    const nameCol = mappingKeys['name'];
                                                    const emailCol = mappingKeys['contact_0_email'] || mappingKeys['primaryEmail'];
                                                    
                                                    const displayVal = (nameCol && payload[nameCol]) || payload.Name || payload['Contact Name'] || payload.email || 'Unknown Record';
                                                    const emailVal = (emailCol && payload[emailCol]) || payload.Email || payload.email || '';
                                                    return (
                                                        <>
                                                            <p className="font-semibold">{displayVal}</p>
                                                            {emailVal && <p className="text-muted-foreground text-xs">{emailVal}</p>}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                            <div className="absolute top-1/2 -right-4 text-slate-300 dark:text-slate-700">
                                                <ChevronRight size={16} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-primary">Existing Record</p>
                                            <div className="text-sm font-medium">
                                                <p>ID: {row.matchedEntityId.substring(0, 8)}...</p>
                                                {resolutions[row.id]?.strategy === 'MANUAL_CORRECTION' ? (
                                                    <p className="text-emerald-600 text-xs italic font-medium">Will create as a brand new entity</p>
                                                ) : (
                                                    <p className="text-muted-foreground text-xs italic">Will be updated based on strategy</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </div>
                        </Card>
                    ))}
                </div>
            </ScrollArea>

            {/* Manual Edit Dialog */}
            <Dialog open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
                <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col p-6">
                    <DialogHeader className="shrink-0 pb-4 border-b">
                        <DialogTitle>Manual Edit: Row {editingRow ? editingRow.rowIdx + 1 : ''}</DialogTitle>
                        <DialogDescription>
                            Modify incoming CSV field values to prevent database conflicts and create a distinct entity.
                        </DialogDescription>
                    </DialogHeader>

                    {editingRow && editedPayload && (
                        <ScrollArea className="flex-1 my-4 pr-2">
                            <div className="space-y-4">
                                {Object.entries(importLog?._importConfig?.mapping || {})
                                    .filter(([_, val]) => val && val !== 'none')
                                    .map(([key, csvHeader]) => {
                                        const headerStr = String(csvHeader);
                                        return (
                                            <div key={key} className="space-y-2">
                                                <Label htmlFor={key} className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                    {getFieldLabel(key)} <span className="text-slate-400 font-normal">({headerStr})</span>
                                                </Label>
                                                <Input
                                                    id={key}
                                                    value={editedPayload[headerStr] || ''}
                                                    onChange={(e) => {
                                                        setEditedPayload((prev: any) => ({
                                                            ...prev,
                                                            [headerStr]: e.target.value
                                                        }));
                                                    }}
                                                    className="w-full focus-visible:ring-primary/20"
                                                />
                                            </div>
                                        );
                                    })}
                            </div>
                        </ScrollArea>
                    )}

                    <DialogFooter className="shrink-0 pt-4 border-t gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setEditingRow(null)}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={() => {
                                if (editingRow && editedPayload) {
                                    setResolutions(prev => ({
                                        ...prev,
                                        [editingRow.id]: {
                                            strategy: 'MANUAL_CORRECTION',
                                            tagIds: prev[editingRow.id]?.tagIds || [],
                                            customPayload: editedPayload
                                        }
                                    }));
                                    setEditingRow(null);
                                    toast({ title: 'Manual changes saved', description: 'Click Execute or Execute All to commit this correction.' });
                                }
                            }}
                        >
                            Save Manual Correction
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

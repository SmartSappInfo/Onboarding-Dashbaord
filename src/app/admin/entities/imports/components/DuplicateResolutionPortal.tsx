'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, ChevronRight, ChevronDown, ChevronUp, AlertTriangle, Edit2, Mail, Phone, User, Building2, Loader2, ShieldCheck, ShieldAlert, Shield, Search, Globe, Map, Compass, Home, Box, Tag, Info, Banknote } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { resolveDuplicatesAction } from '@/lib/bulk-upload-actions';
import { createTagAction } from '@/lib/tag-actions';
import { resolveFieldStorageBucket } from '@/lib/field-storage-utils';
import { useToast } from '@/hooks/use-toast';
import { evaluateFormula } from '@/lib/formula-parser';
import { cleanValueByKey } from '@/lib/import-data-cleaner';
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
    existingEntityData?: {
        name: string;
        entityContacts: Array<{ id: string; name: string; email?: string; phone?: string; typeLabel?: string; typeKey?: string; isPrimary?: boolean; }>;
        [key: string]: any;
    } | null;
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

const getFieldIcon = (key: string) => {
    const k = key.toLowerCase();
    if (k.includes('company') || k.includes('org') || k.includes('school')) return <Building2 size={11} />;
    if (k.includes('email')) return <Mail size={11} />;
    if (k.includes('phone') || k.includes('mobile') || k.includes('tel')) return <Phone size={11} />;
    if (k.includes('name') || k.includes('role') || k.includes('title') || k.includes('lead')) return <User size={11} />;
    if (k.includes('location') || k.includes('region') || k.includes('district') || k.includes('country') || k.includes('address') || k.includes('city')) return <Globe size={11} />;
    if (k.includes('rate') || k.includes('price') || k.includes('fee') || k.includes('amount') || k.includes('balance') || k.includes('currency') || k.includes('bill')) return <Banknote size={11} />;
    if (k.includes('tag')) return <Tag size={11} />;
    return <Info size={11} />;
};

/** Extract the key fields from the raw incoming payload using import mapping and default values */
const extractIncomingFields = (payload: any, mapping: Record<string, string>, defaultValues: Record<string, string> = {}, userMap?: Record<string, string>) => {
    const get = (key: string) => {
        const col = mapping[key];
        if (!col) return defaultValues[key] || '';
        let val = '';
        if (col.includes('{{')) {
            val = String(evaluateFormula(col, payload) || '');
        } else {
            val = (payload[col] !== undefined && payload[col] !== null) ? String(payload[col]).trim() : '';
        }
        val = val || defaultValues[key] || '';
        return cleanValueByKey(key, val);
    };

    const assignedVal = get('assignedTo') || payload.AssignedTo || payload['Assigned Representative'] || defaultValues['assignedTo'] || '';
    const resolvedAssigned = userMap && typeof assignedVal === 'string' && userMap[assignedVal]
        ? userMap[assignedVal]
        : (typeof assignedVal === 'object' ? (assignedVal as any).name || (assignedVal as any).displayName || '' : assignedVal);

    const result: Record<string, string> = {
        entityName: get('name') || payload.Name || payload['Institution Name'] || payload['Entity Name'] || defaultValues['name'] || '',
        contactName: get('contact_0_name') || payload['Contact Name'] || defaultValues['contact_0_name'] || '',
        contactEmail: get('contact_0_email') || get('primaryEmail') || payload.Email || payload.email || defaultValues['contact_0_email'] || '',
        contactPhone: get('contact_0_phone') || get('primaryPhone') || payload.Phone || payload.phone || defaultValues['contact_0_phone'] || '',
        contactRole: get('contact_0_role') || payload.Role || payload.role || defaultValues['contact_0_role'] || '',
        locationRegion: get('locationRegion') || payload.Region || payload.region || defaultValues['locationRegion'] || '',
        locationDistrict: get('locationDistrict') || payload.District || payload.district || defaultValues['locationDistrict'] || '',
        zone: get('zone') || payload.Zone || payload.zone || defaultValues['zone'] || '',
        locationString: get('locationString') || payload.Address || payload.address || payload['Address Detail'] || defaultValues['locationString'] || '',
        assignedTo: resolvedAssigned || '',
        package: get('package') || get('subscriptionPackageName') || payload.Package || payload.package || defaultValues['package'] || defaultValues['subscriptionPackageName'] || '',
    };

    // Dynamically extract any other mapped fields
    Object.keys(mapping).forEach(k => {
        if (mapping[k] && mapping[k] !== 'none' && !(k in result)) {
            result[k] = get(k);
        }
    });

    return result;
};

/** Get the primary contact from existing entity contacts */
const getPrimaryContact = (contacts: any[]) => {
    if (!contacts || contacts.length === 0) return null;
    return contacts.find(c => c.isPrimary) || contacts[0];
};

/** Compare two values - returns true if they conflict (both non-empty and different) */
const isConflict = (incoming: string, existing: string) => {
    if (!incoming || !existing) return false;
    return incoming.toLowerCase().trim() !== existing.toLowerCase().trim();
};

interface EmailVerificationBadgeProps {
    email: string;
    onVerify: () => void;
    isVerifying: boolean;
    result?: any;
}

const EmailVerificationBadge = ({ 
    email, 
    onVerify, 
    isVerifying, 
    result 
}: EmailVerificationBadgeProps) => {
    if (!email) return null;

    if (isVerifying) {
        return (
            <div className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md animate-pulse">
                <Loader2 size={10} className="animate-spin" />
                <span>Verifying...</span>
            </div>
        );
    }

    if (result) {
        const getBadgeStyles = (status: string) => {
            switch (status) {
                case 'verified':
                    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30';
                case 'likely_valid':
                    return 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border-blue-200/50 dark:border-blue-900/30';
                case 'risky':
                    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/30';
                case 'invalid':
                default:
                    return 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border-red-200/50 dark:border-red-900/30';
            }
        };

        const getIcon = (status: string) => {
            switch (status) {
                case 'verified':
                case 'likely_valid':
                    return <ShieldCheck size={11} className="text-current" />;
                case 'risky':
                    return <Shield size={11} className="text-current" />;
                case 'invalid':
                default:
                    return <ShieldAlert size={11} className="text-current" />;
            }
        };

        const statusLabels: Record<string, string> = {
            verified: 'Verified Valid',
            likely_valid: 'Likely Valid',
            risky: 'Risky Mailbox',
            invalid: 'Invalid Mailbox'
        };

        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge 
                            variant="outline" 
                            className={`inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 cursor-help transition-all hover:opacity-90 border ${getBadgeStyles(result.status)}`}
                        >
                            {getIcon(result.status)}
                            <span>{result.score}% ({statusLabels[result.status] || result.status})</span>
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-slate-900 text-slate-100 p-2.5 rounded-lg shadow-xl max-w-[220px] text-[11px] border border-slate-800">
                        <div className="space-y-1.5">
                            <p className="font-bold text-[12px] border-b border-slate-800 pb-1">Email Health Check</p>
                            <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
                                <span className="text-slate-400">Syntax Format:</span>
                                <span className={result.checks?.syntax ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                                    {result.checks?.syntax ? 'PASS' : 'FAIL'}
                                </span>
                                <span className="text-slate-400">Domain DNS MX:</span>
                                <span className={result.checks?.dns ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                                    {result.checks?.dns ? 'FOUND' : 'MISSING'}
                                </span>
                                <span className="text-slate-400">SMTP Handshake:</span>
                                <span className={result.checks?.smtp ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                                    {result.checks?.smtp ? 'DELIVERABLE' : 'REJECTED'}
                                </span>
                                <span className="text-slate-400">Disposable Mail:</span>
                                <span className={result.checks?.disposable ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                                    {result.checks?.disposable ? 'YES' : 'NO'}
                                </span>
                                <span className="text-slate-400">Catch-All Config:</span>
                                <span className={result.checks?.catchAll ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                                    {result.checks?.catchAll ? 'YES' : 'NO'}
                                </span>
                            </div>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return (
        <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
                e.stopPropagation();
                onVerify();
            }}
            className="h-5 px-1.5 text-[9px] font-semibold text-slate-500 hover:text-slate-800 border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900 dark:text-slate-400 inline-flex items-center gap-1 transition-all rounded [&_svg]:size-2.5"
        >
            <Search size={9} />
            <span>Verify</span>
        </Button>
    );
};

export function DuplicateResolutionPortal({ importLogId, importLog, duplicateRows, onResolved }: DuplicateResolutionPortalProps) {
    const { toast } = useToast();
    const { activeWorkspace } = useWorkspace();
    const { user } = useUser();
    const firestore = useFirestore();

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [expandedRowIds, setExpandedRowIds] = useState<string[]>([]);
    const [resolvedRowIds, setResolvedRowIds] = useState<Set<string>>(new Set());
    const [exitingRowIds, setExitingRowIds] = useState<Set<string>>(new Set());
    const [verifyingEmails, setVerifyingEmails] = useState<Record<string, boolean>>({});

    const toggleRowExpanded = (rowId: string) => {
        setExpandedRowIds(prev => 
            prev.includes(rowId) ? prev.filter(id => id !== rowId) : [...prev, rowId]
        );
    };
    const [verifiedResults, setVerifiedResults] = useState<Record<string, any>>({});

    const handleVerifyEmail = async (email: string) => {
        if (!email || verifyingEmails[email]) return;
        setVerifyingEmails(prev => ({ ...prev, [email]: true }));
        try {
            const response = await fetch('/api/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
            if (response.ok) {
                const data = await response.json();
                setVerifiedResults(prev => ({ ...prev, [email]: data }));
                toast({
                    title: 'Email Verified',
                    description: `Status: ${data.status === 'verified' ? 'Verified Valid' : data.status === 'likely_valid' ? 'Likely Valid' : data.status === 'risky' ? 'Risky' : 'Invalid'} (Score: ${data.score})`,
                });
            } else {
                const err = await response.json();
                throw new Error(err.error || 'Failed to verify email');
            }
        } catch (e: any) {
            toast({
                variant: 'destructive',
                title: 'Verification Failed',
                description: e.message,
            });
        } finally {
            setVerifyingEmails(prev => ({ ...prev, [email]: false }));
        }
    };

    const [bulkStrategy, setBulkStrategy] = useState<DuplicateStrategy>('SKIP');
    const [isResolving, setIsResolving] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isCreatingTag, setIsCreatingTag] = useState(false);
    const [resolutions, setResolutions] = useState<Record<string, { strategy: DuplicateStrategy; tagIds: string[]; customPayload?: any }>>(() => {
        const initial: Record<string, { strategy: DuplicateStrategy; tagIds: string[]; customPayload?: any }> = {};
        duplicateRows.filter(r => !r.resolved).forEach(row => {
            initial[row.id] = { strategy: 'SKIP', tagIds: [] };
        });
        return initial;
    });
    const [editingRow, setEditingRow] = useState<DuplicateRow | null>(null);
    const [editedPayload, setEditedPayload] = useState<any>(null);

    React.useEffect(() => {
        if (editingRow) {
            setEditedPayload(resolutions[editingRow.id]?.customPayload || { ...editingRow.rawPayload });
        } else {
            setEditedPayload(null);
        }
    }, [editingRow]);

    // Initialize newly-appearing duplicate rows with default SKIP strategy
    React.useEffect(() => {
        setResolutions(prev => {
            const next = { ...prev };
            let changed = false;
            duplicateRows.filter(r => !r.resolved).forEach(row => {
                if (!next[row.id]) {
                    next[row.id] = { strategy: 'SKIP', tagIds: [] };
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [duplicateRows]);

    // Fetch tags for the tag selector
    const tagsQuery = useMemoFirebase(() => 
        firestore && activeWorkspace?.id 
            ? query(collection(firestore, 'tags'), where('workspaceId', '==', activeWorkspace.id), orderBy('name'))
            : null,
    [firestore, activeWorkspace?.id]);
    const { data: tagsList } = useCollection<any>(tagsQuery);

    // Fetch users for resolving assignedTo IDs to names
    const usersQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'users'), where('isAuthorized', '==', true)) : null,
    [firestore]);
    const { data: usersList } = useCollection<any>(usersQuery);

    const userMap = useMemo(() => {
        const map: Record<string, string> = {};
        if (usersList) {
            usersList.forEach((u: any) => {
                map[u.id] = u.name || u.displayName || u.email || u.id;
            });
        }
        return map;
    }, [usersList]);

    const requiresTags = (strategy: DuplicateStrategy) => 
        ['ADD_TAG_ONLY', 'UPDATE_MISSING_FIELDS_AND_TAG', 'UPDATE_FIELDS_AND_TAG', 'KEEP_AND_MERGE', 'REPLACE_AND_MERGE'].includes(strategy);

    // Only show unresolved duplicates that haven't been locally resolved
    const pendingRows = duplicateRows.filter(r => !r.resolved && !resolvedRowIds.has(r.id));

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

    const handleResolve = useCallback(async (resolutionsToExecute: { duplicateRowId: string; strategy: DuplicateStrategy; tagIds?: string[]; customPayload?: any }[]) => {
        setIsResolving(true);
        try {
            await resolveDuplicatesAction(importLogId, resolutionsToExecute);
            toast({ title: 'Duplicates Resolved', description: `Successfully processed ${resolutionsToExecute.length} record(s).` });
            
            const resolvedIds = new Set(resolutionsToExecute.map(r => r.duplicateRowId));

            // Phase 1: Trigger exit animation
            setExitingRowIds(prev => new Set([...prev, ...resolvedIds]));

            // Clean up selections and resolutions state immediately
            setSelectedIds(prev => prev.filter(id => !resolvedIds.has(id)));
            setResolutions(prev => {
                const next = { ...prev };
                resolvedIds.forEach(id => { delete next[id]; });
                return next;
            });

            // Phase 2: After animation completes, remove rows from DOM
            setTimeout(() => {
                setResolvedRowIds(prev => new Set([...prev, ...resolvedIds]));
                setExitingRowIds(prev => {
                    const next = new Set(prev);
                    resolvedIds.forEach(id => next.delete(id));
                    return next;
                });
            }, 350);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Resolution Failed', description: error.message });
        } finally {
            setIsResolving(false);
        }
    }, [importLogId, toast]);

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

    // Identify rows where incoming data is identical to existing data (no conflicts)
    const identicalRowIds = useMemo(() => {
        const mapping = importLog?._importConfig?.mapping || {};
        const defaultValues = importLog?._importConfig?.defaultValues || {};
        const ids = new Set<string>();

        for (const row of pendingRows) {
            if (!row.existingEntityData) continue;
            const payload = resolutions[row.id]?.customPayload || row.rawPayload;
            const inc = extractIncomingFields(payload, mapping, defaultValues, userMap);
            const existingContact = getPrimaryContact(row.existingEntityData?.entityContacts || []);

            const ext: Record<string, string> = {
                entityName: row.existingEntityData?.name || '',
                contactName: existingContact?.name || '',
                contactEmail: existingContact?.email || '',
                contactPhone: existingContact?.phone || '',
                contactRole: existingContact?.typeLabel || existingContact?.typeKey || '',
            };

            const hasAnyConflict = Object.keys(ext).some(key => isConflict(inc[key] || '', ext[key]));
            if (!hasAnyConflict) {
                ids.add(row.id);
            }
        }

        return ids;
    }, [pendingRows, importLog, resolutions, userMap]);

    // Auto-resolve all identical rows as SKIP
    const handleSkipIdentical = useCallback(() => {
        const identicalResolutions = Array.from(identicalRowIds)
            .filter(id => !exitingRowIds.has(id))
            .map(id => ({
                duplicateRowId: id,
                strategy: 'SKIP' as DuplicateStrategy,
                tagIds: [] as string[],
            }));
        if (identicalResolutions.length === 0) return;
        handleResolve(identicalResolutions);
    }, [identicalRowIds, exitingRowIds, handleResolve]);

    // Notify parent only when ALL rows are resolved (no more pending rows)
    React.useEffect(() => {
        if (resolvedRowIds.size > 0 && pendingRows.length === 0) {
            onResolved();
        }
    }, [resolvedRowIds.size, pendingRows.length, onResolved]);

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
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <Checkbox 
                            id="select-all-duplicates"
                            checked={selectedIds.length === pendingRows.length && pendingRows.length > 0} 
                            onCheckedChange={toggleSelectAll} 
                        />
                        <label htmlFor="select-all-duplicates" className="text-sm font-semibold cursor-pointer select-none">
                            {selectedIds.length} of {pendingRows.length} selected
                        </label>
                    </div>

                    <div className="flex items-center gap-2 border-l pl-6 border-border/50">
                        <Checkbox 
                            id="show-all-fields" 
                            checked={pendingRows.length > 0 && pendingRows.every(r => expandedRowIds.includes(r.id))} 
                            onCheckedChange={(checked) => {
                                if (checked) {
                                    setExpandedRowIds(pendingRows.map(r => r.id));
                                } else {
                                    setExpandedRowIds([]);
                                }
                            }} 
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all duration-200"
                        />
                        <Label 
                            htmlFor="show-all-fields" 
                            className="text-xs font-semibold cursor-pointer select-none text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors duration-200"
                        >
                            Show More Fields
                        </Label>
                    </div>
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
                            <SelectItem value="KEEP_AND_MERGE">Keep & Merge Contacts</SelectItem>
                            <SelectItem value="REPLACE_AND_MERGE">Replace & Merge Contacts</SelectItem>
                            <SelectItem value="TRIGGER_AUTOMATION">Trigger Automation</SelectItem>
                            <SelectItem value="MANUAL_CORRECTION">Manual Edit</SelectItem>
                            <SelectItem value="CREATE_NEW">Create New Entity</SelectItem>
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
                    {identicalRowIds.size > 0 && (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={isResolving}
                            onClick={handleSkipIdentical}
                            className="font-semibold border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        >
                            <CheckCircle2 size={14} className="mr-1" />
                            Skip Identical ({identicalRowIds.size})
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
                        <Card key={row.id} className={`overflow-hidden transition-all duration-300 ease-out ${exitingRowIds.has(row.id) ? 'opacity-0 scale-[0.97] -translate-y-1 pointer-events-none' : 'opacity-100 scale-100'} ${selectedIds.includes(row.id) ? 'border-primary shadow-sm shadow-primary/10' : 'border-border/50'}`}>
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
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
                                                <AlertTriangle size={12} className="mr-1" /> Conflict
                                            </Badge>
                                            <span className="text-xs font-medium text-slate-500">
                                                Matched on: <strong className="text-slate-700 dark:text-slate-300">{row.matchedOn.join(', ')}</strong>
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 px-2 text-[10px] font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                                                onClick={() => toggleRowExpanded(row.id)}
                                            >
                                                {expandedRowIds.includes(row.id) ? (
                                                    <>
                                                        <span>Show Less</span>
                                                        <ChevronUp size={10} />
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>Show More</span>
                                                        <ChevronDown size={10} />
                                                    </>
                                                )}
                                            </Button>
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
                                                        <SelectItem value="KEEP_AND_MERGE">Keep & Merge</SelectItem>
                                                        <SelectItem value="REPLACE_AND_MERGE">Replace & Merge</SelectItem>
                                                        <SelectItem value="TRIGGER_AUTOMATION">Automation</SelectItem>
                                                        <SelectItem value="MANUAL_CORRECTION">Manual Edit</SelectItem>
                                                        <SelectItem value="CREATE_NEW">Create New</SelectItem>
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
 
                                    {/* Rich Diff Visualizer */}
                                    {(() => {
                                         const payload = resolutions[row.id]?.customPayload || row.rawPayload;
                                         const mapping = importLog?._importConfig?.mapping || {};
                                         const defaultValues = importLog?._importConfig?.defaultValues || {};
                                         const inc = extractIncomingFields(payload, mapping, defaultValues, userMap);
                                         const existingContact = getPrimaryContact(row.existingEntityData?.entityContacts || []);
                                         
                                         const rawExtAssigned = row.existingEntityData?.assignedTo || row.existingEntityData?.assignedRepName || '';
                                         const extAssignedResolved = userMap && typeof rawExtAssigned === 'string' && userMap[rawExtAssigned]
                                             ? userMap[rawExtAssigned]
                                             : (typeof rawExtAssigned === 'object' ? (rawExtAssigned as any).name || (rawExtAssigned as any).displayName || '' : rawExtAssigned);

                                         // Helper to get field value from existing entity data using storage bucket resolution
                                         const getExistingFieldVal = (variableName: string, source: any) => {
                                             if (!source) return '';

                                             // Special overrides for standard fields
                                             if (variableName === 'entityName') return source.name || '';
                                             if (variableName === 'contactName') return existingContact?.name || '';
                                             if (variableName === 'contactEmail') return existingContact?.email || '';
                                             if (variableName === 'contactPhone') return existingContact?.phone || '';
                                             if (variableName === 'contactRole') return existingContact?.typeLabel || existingContact?.typeKey || '';
                                             if (variableName === 'locationRegion') {
                                                 return (typeof source.location?.region === 'object' ? source.location?.region?.name : source.location?.region) || source.locationRegion || '';
                                             }
                                             if (variableName === 'locationDistrict') {
                                                 return (typeof source.location?.district === 'object' ? source.location?.district?.name : source.location?.district) || source.locationDistrict || '';
                                             }
                                             if (variableName === 'locationCountry') {
                                                 return (typeof source.location?.country === 'object' ? source.location?.country?.name : source.location?.country) || '';
                                             }
                                             if (variableName === 'zone') {
                                                 return (typeof source.location?.zone === 'object' ? source.location?.zone?.name : source.location?.zone) || (typeof source.zone === 'object' ? source.zone?.name : source.zone) || '';
                                             }
                                             if (variableName === 'locationString') {
                                                 return source.location?.locationString || source.locationString || '';
                                             }
                                             if (variableName === 'assignedTo') {
                                                 return extAssignedResolved || '';
                                             }
                                             if (variableName === 'package' || variableName === 'subscriptionPackageName') {
                                                 return source.package || source.subscriptionPackageName || source.customData?.subscriptionPackageName || source.financeData?.planType || '';
                                             }

                                             // Generic resolver using buckets:
                                             const entityType = source.entityType || 'institution';
                                             const industry = source.industry;
                                             const bucket = resolveFieldStorageBucket(variableName, entityType as any, industry as any);
                                             
                                             switch (bucket) {
                                                 case 'root':
                                                     if (variableName === 'interests') {
                                                         if (Array.isArray(source.interests)) {
                                                             return source.interests.map((m: any) => typeof m === 'object' ? m.name || m.id : m).join(', ');
                                                         }
                                                         return source.interestsText || source.interests || '';
                                                     }
                                                     return source[variableName] || '';
                                                 case 'financeData':
                                                     return source.financeData?.[variableName] || '';
                                                 case 'industryData':
                                                     return source.industryData?.[variableName] || '';
                                                 case 'personData':
                                                     return source.personData?.[variableName] || '';
                                                 case 'familyData':
                                                     return source.familyData?.[variableName] || '';
                                                 case 'customData':
                                                     return source.customData?.[variableName] || '';
                                             }
                                             return '';
                                         };

                                         // Predefined base fields (always visible)
                                         const baseFields = [
                                             { key: 'entityName', label: 'Entity Name', icon: <Building2 size={11} /> },
                                             { key: 'contactName', label: 'Contact Name', icon: <User size={11} /> },
                                             { key: 'contactEmail', label: 'Email', icon: <Mail size={11} /> },
                                             { key: 'contactPhone', label: 'Phone', icon: <Phone size={11} /> },
                                             { key: 'contactRole', label: 'Role', icon: <User size={11} /> },
                                         ];

                                         // Predefined extra fields to check in mapping
                                         const PREDEFINED_EXTRA_FIELDS = [
                                             { key: 'locationRegion', label: 'Region', icon: <Globe size={11} /> },
                                             { key: 'locationDistrict', label: 'District', icon: <Map size={11} /> },
                                             { key: 'zone', label: 'Zone', icon: <Compass size={11} /> },
                                             { key: 'locationString', label: 'Address Detail', icon: <Home size={11} /> },
                                             { key: 'assignedTo', label: 'Representative', icon: <Shield size={11} /> },
                                             { key: 'package', label: 'Subscription Package', icon: <Box size={11} /> },
                                         ];

                                         const HANDLED_MAPPING_KEYS = new Set([
                                             'name',
                                             'contact_0_name',
                                             'contact_0_email',
                                             'primaryEmail',
                                             'contact_0_phone',
                                             'primaryPhone',
                                             'contact_0_role',
                                         ]);

                                         const dynamicExtraFields: any[] = [];
                                         
                                         // 1. Add predefined extra fields if they are in the mapping configuration
                                         PREDEFINED_EXTRA_FIELDS.forEach(pef => {
                                             if (mapping[pef.key] && mapping[pef.key] !== 'none') {
                                                 dynamicExtraFields.push(pef);
                                             } else if (pef.key === 'package' && mapping['subscriptionPackageName'] && mapping['subscriptionPackageName'] !== 'none') {
                                                 // Check alternative package key
                                                 dynamicExtraFields.push({
                                                     key: 'package',
                                                     label: 'Subscription Package',
                                                     icon: <Box size={11} />
                                                 });
                                             }
                                         });

                                         // 2. Add all other mapped fields (optional/custom fields)
                                         Object.keys(mapping).forEach(k => {
                                             if (mapping[k] && mapping[k] !== 'none' && !HANDLED_MAPPING_KEYS.has(k) && !PREDEFINED_EXTRA_FIELDS.some(pef => pef.key === k) && k !== 'subscriptionPackageName') {
                                                 dynamicExtraFields.push({
                                                     key: k,
                                                     label: getFieldLabel(k),
                                                     icon: getFieldIcon(k)
                                                 });
                                             }
                                         });

                                         const ext: Record<string, string> = {
                                             entityName: row.existingEntityData?.name || '',
                                             contactName: existingContact?.name || '',
                                             contactEmail: existingContact?.email || '',
                                             contactPhone: existingContact?.phone || '',
                                             contactRole: existingContact?.typeLabel || existingContact?.typeKey || '',
                                         };

                                         // Populate PREDEFINED_EXTRA_FIELDS values in ext
                                         PREDEFINED_EXTRA_FIELDS.forEach(pef => {
                                             ext[pef.key] = getExistingFieldVal(pef.key, row.existingEntityData);
                                         });

                                         // Populate dynamicExtraFields values in ext
                                         dynamicExtraFields.forEach(def => {
                                             if (!(def.key in ext)) {
                                                 ext[def.key] = getExistingFieldVal(def.key, row.existingEntityData);
                                             }
                                         });

                                         const isExpanded = expandedRowIds.includes(row.id);
                                         const fields = isExpanded ? [...baseFields, ...dynamicExtraFields] : baseFields;
                                        return (
                                            <div className="rounded-xl border border-border/60 overflow-hidden">
                                                {/* Column headers */}
                                                <div className="grid grid-cols-[1fr_28px_1fr] bg-slate-50 dark:bg-slate-900/60 border-b border-border/50">
                                                    <div className="px-4 py-2 flex items-center gap-1.5">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">Incoming</span>
                                                        {resolutions[row.id]?.customPayload && (
                                                            <Badge className="bg-amber-100 text-amber-700 text-[8px] hover:bg-amber-100 px-1 py-0 h-3.5 border-none">Edited</Badge>
                                                        )}
                                                    </div>
                                                    <div />
                                                    <div className="px-4 py-2">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-500">Existing Record</span>
                                                    </div>
                                                </div>
                                                {/* Field rows */}
                                                {fields.map(({ key, label, icon }, fi) => {
                                                    const inVal = inc[key];
                                                    const exVal = ext[key];
                                                    const conflict = isConflict(inVal, exVal);
                                                    const missing = !exVal && inVal;
                                                    return (
                                                        <div
                                                            key={key}
                                                            className={`grid grid-cols-[1fr_28px_1fr] items-stretch ${
                                                                fi < fields.length - 1 ? 'border-b border-border/40' : ''
                                                            } ${conflict ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}
                                                        >
                                                            {/* Incoming value */}
                                                            <div className={`px-4 py-2.5 ${
                                                                conflict ? 'border-l-2 border-red-400' : missing ? 'border-l-2 border-amber-300' : 'border-l-2 border-transparent'
                                                            }`}>
                                                                <div className="flex items-center gap-1 mb-0.5">
                                                                    <span className="text-muted-foreground/50">{icon}</span>
                                                                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50">{label}</span>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                                    <p className={`text-xs font-medium leading-snug ${
                                                                        conflict ? 'text-red-600 dark:text-red-400' :
                                                                        inVal ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 italic'
                                                                    }`}>
                                                                        {inVal || '—'}
                                                                    </p>
                                                                    {inVal && key === 'contactEmail' && (
                                                                        <EmailVerificationBadge
                                                                            email={inVal}
                                                                            onVerify={() => handleVerifyEmail(inVal)}
                                                                            isVerifying={!!verifyingEmails[inVal]}
                                                                            result={verifiedResults[inVal]}
                                                                        />
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* Arrow / conflict badge */}
                                                            <div className="flex items-center justify-center">
                                                                {conflict ? (
                                                                    <span className="w-4 h-4 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                                                                        <AlertTriangle size={8} className="text-red-500" />
                                                                    </span>
                                                                ) : (
                                                                    <ChevronRight size={12} className="text-border" />
                                                                )}
                                                            </div>
                                                            {/* Existing value */}
                                                            <div className="px-4 py-2.5">
                                                                <div className="flex items-center gap-1 mb-0.5">
                                                                    <span className="text-muted-foreground/50">{icon}</span>
                                                                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50">{label}</span>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                                    <p className={`text-xs font-medium leading-snug ${
                                                                        conflict ? 'text-slate-800 dark:text-slate-200 font-semibold' :
                                                                        exVal ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 italic'
                                                                    }`}>
                                                                        {exVal || (row.existingEntityData ? '—' : <span className="text-slate-400 italic text-[10px]">Loading…</span>)}
                                                                    </p>
                                                                    {exVal && key === 'contactEmail' && (
                                                                        <EmailVerificationBadge
                                                                            email={exVal}
                                                                            onVerify={() => handleVerifyEmail(exVal)}
                                                                            isVerifying={!!verifyingEmails[exVal]}
                                                                            result={verifiedResults[exVal]}
                                                                        />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {/* Footer hint */}
                                                {resolutions[row.id]?.strategy === 'MANUAL_CORRECTION' && (
                                                    <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/20 border-t border-emerald-100 dark:border-emerald-900/30">
                                                        <p className="text-[10px] text-emerald-600 font-semibold">✓ Will create as a new distinct entity</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
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

'use client';

/**
 * Server Action & UI Component: Minimalist Searchable Test Dispatch Dialog
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION:
 * Enables administrators to send test emails, SMS, or WhatsApp dispatches.
 * Provides dual testing modes:
 * 1. "Selected Entity": Features a searchable Popover + Command Combobox listing workspace entities.
 *    Selecting an entity automatically resolves target recipient email/phone and template variables.
 * 2. "Custom Values": Allows manual input of custom values for template variables.
 *
 * WORKSPACE RULES & COMPLIANCE:
 * - Single Source of Truth for Variables: Route through `entity.entityContacts` and entity attributes.
 * - Icon & Title Alignment: Icon and title are aligned inline on the same horizontal row.
 * - Minimalist Aesthetic: Clean layout with no verbose sub-descriptions under the header title.
 * - Mobile & Accessibility First: Min 44px touch targets, accessible sr-only DialogDescription.
 */

import * as React from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Send, 
    Mail, 
    Smartphone, 
    Loader2, 
    FlaskConical,
    Building2,
    Sliders,
    Zap,
    Check,
    ChevronsUpDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendMessage, sendRawMessage } from '@/lib/messaging-engine';
import { cn, toTitleCase } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTerminology } from '@/hooks/use-terminology';
import type { WorkspaceEntity } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from '@/components/ui/command';

interface TestDispatchDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    channel: 'email' | 'sms' | 'whatsapp';
    templateId?: string;
    rawBody?: string;
    rawSubject?: string;
    senderProfileId?: string;
    variables?: Record<string, any>;
    entityId?: string;
}

export default function TestDispatchDialog({ 
    open, 
    onOpenChange, 
    channel, 
    templateId, 
    rawBody, 
    rawSubject, 
    senderProfileId, 
    variables = {},
    entityId
}: TestDispatchDialogProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { activeWorkspaceId } = useWorkspace();
    const { singular } = useTerminology();

    const [recipient, setRecipient] = React.useState('');
    const [isSending, setIsSending] = React.useState(false);
    const [localVariables, setLocalVariables] = React.useState<Record<string, string>>({});
    const [detectedTags, setDetectedTags] = React.useState<string[]>([]);
    
    // Testing Source Mode: 'entity' | 'custom'
    const [testMode, setTestMode] = React.useState<'custom' | 'entity'>('custom');
    const [entities, setEntities] = React.useState<WorkspaceEntity[]>([]);
    const [selectedEntityId, setSelectedEntityId] = React.useState<string>(entityId || '');
    const [isLoadingEntities, setIsLoadingEntities] = React.useState(false);
    const [entitySearchOpen, setEntitySearchOpen] = React.useState(false);

    // ── Rate Limiter: 5 dispatches per 60 seconds sliding window ──────────
    const MAX_DISPATCHES = 5;
    const WINDOW_MS = 60_000;
    const dispatchTimestampsRef = React.useRef<number[]>([]);
    const [cooldownSeconds, setCooldownSeconds] = React.useState(0);
    const cooldownIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

    const isRateLimited = cooldownSeconds > 0;

    const checkRateLimit = React.useCallback((): boolean => {
        const now = Date.now();
        dispatchTimestampsRef.current = dispatchTimestampsRef.current.filter(
            ts => now - ts < WINDOW_MS
        );
        if (dispatchTimestampsRef.current.length >= MAX_DISPATCHES) {
            const oldestInWindow = dispatchTimestampsRef.current[0];
            const remainingMs = WINDOW_MS - (now - oldestInWindow);
            const remainingSec = Math.ceil(remainingMs / 1000);
            setCooldownSeconds(remainingSec);

            if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
            cooldownIntervalRef.current = setInterval(() => {
                setCooldownSeconds(prev => {
                    if (prev <= 1) {
                        if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
                        cooldownIntervalRef.current = null;
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return true;
        }
        return false;
    }, []);

    React.useEffect(() => {
        return () => {
            if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
        };
    }, []);

    // 1. Tag Discovery Logic
    React.useEffect(() => {
        if (!open) return;

        const contentToScan = `${rawSubject || ''} ${rawBody || ''}`;
        const matches = contentToScan.match(/\{\{(.*?)\}\}/g);
        const tags = matches ? [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))] : [];
        
        setDetectedTags(tags);
        
        const initial: Record<string, string> = {};
        tags.forEach(tag => {
            initial[tag] = variables[tag] !== undefined ? String(variables[tag]) : '';
        });
        setLocalVariables(initial);
    }, [open, rawBody, rawSubject, variables]);

    // 2. Fetch Workspace Entities for Selection Mode
    React.useEffect(() => {
        if (!open || !firestore || !activeWorkspaceId) return;

        let isMounted = true;
        setIsLoadingEntities(true);

        const q = query(
            collection(firestore, 'workspace_entities'),
            where('workspaceId', '==', activeWorkspaceId),
            limit(100)
        );

        getDocs(q)
            .then((snap) => {
                if (!isMounted) return;
                const list: WorkspaceEntity[] = [];
                snap.forEach((docSnap) => {
                    list.push(docSnap.data() as WorkspaceEntity);
                });
                setEntities(list);

                if (list.length > 0) {
                    const targetId = entityId || selectedEntityId || list[0].entityId || list[0].id;
                    if (targetId) {
                        setSelectedEntityId(targetId);
                        if (entityId) setTestMode('entity');
                    }
                }
            })
            .catch((err) => {
                console.error('Failed to load test entities:', err);
            })
            .finally(() => {
                if (isMounted) setIsLoadingEntities(false);
            });

        return () => {
            isMounted = false;
        };
    }, [open, firestore, activeWorkspaceId, entityId]);

    // 3. Handle Entity Selection & Variable Auto-Resolution
    const handleEntityChange = (eId: string) => {
        setSelectedEntityId(eId);
        if (!eId) return;

        const matched = entities.find((e) => e.entityId === eId || e.id === eId);
        if (!matched) return;

        const rawEntity = matched as unknown as Record<string, unknown>;
        const primaryContact = matched.entityContacts?.find((c) => c.isPrimary) || matched.entityContacts?.[0];
        
        // Auto-fill recipient contact details
        if (channel === 'email') {
            const email = primaryContact?.email || matched.primaryEmail || (typeof rawEntity.email === 'string' ? rawEntity.email : '');
            if (email) setRecipient(email);
        } else {
            const phone = primaryContact?.phone || matched.primaryPhone || (typeof rawEntity.phone === 'string' ? rawEntity.phone : '');
            if (phone) setRecipient(phone);
        }

        // Auto-fill template variables from entity fields
        const entityName = matched.displayName || (typeof rawEntity.name === 'string' ? rawEntity.name : '');
        const customFields = (rawEntity.customFields && typeof rawEntity.customFields === 'object' ? rawEntity.customFields : {}) as Record<string, unknown>;
        const resolvedVars: Record<string, string> = { ...localVariables };

        detectedTags.forEach((tag) => {
            const lower = tag.toLowerCase();
            if (lower.includes('entity') || lower.includes('school') || lower === 'name' || lower === 'displayname') {
                resolvedVars[tag] = entityName;
            } else if (lower.includes('contact') || lower.includes('recipient_name')) {
                resolvedVars[tag] = primaryContact?.name || entityName;
            } else if (lower.includes('email')) {
                resolvedVars[tag] = primaryContact?.email || matched.primaryEmail || '';
            } else if (lower.includes('phone')) {
                resolvedVars[tag] = primaryContact?.phone || matched.primaryPhone || '';
            } else if (lower.includes('token')) {
                resolvedVars[tag] = `token_${(matched.entityId || matched.id).slice(0, 8)}`;
            } else if (customFields[tag] !== undefined) {
                resolvedVars[tag] = String(customFields[tag]);
            } else if (!resolvedVars[tag]) {
                resolvedVars[tag] = `${toTitleCase(tag.replace(/_/g, ' '))} Value`;
            }
        });

        setLocalVariables(resolvedVars);
    };

    const selectedEntity = entities.find((e) => e.entityId === selectedEntityId || e.id === selectedEntityId);

    const handleSend = async () => {
        if (!recipient.trim()) {
            toast({ variant: 'destructive', title: 'Recipient Required', description: 'Please enter a test recipient.' });
            return;
        }

        if (checkRateLimit()) {
            toast({
                variant: 'destructive',
                title: 'Rate Limit Reached',
                description: `Maximum ${MAX_DISPATCHES} test dispatches per minute. Please wait ${cooldownSeconds}s.`
            });
            return;
        }

        setIsSending(true);
        try {
            const finalVars = { ...variables, ...localVariables };

            if (templateId) {
                const result = await sendMessage({
                    templateId,
                    senderProfileId: senderProfileId || 'default',
                    recipient: recipient.trim(),
                    variables: finalVars,
                    entityId: testMode === 'entity' ? selectedEntityId : entityId
                });
                if (!result.success) throw new Error(result.error);
            } else if (rawBody) {
                if (channel === 'whatsapp') {
                    throw new Error('WhatsApp test requires selecting an approved template.');
                }
                const result = await sendRawMessage({
                    channel,
                    recipient: recipient.trim(),
                    body: rawBody,
                    subject: rawSubject,
                    senderProfileId,
                    variables: finalVars
                });
                if (!result.success) throw new Error(result.error);
            }

            dispatchTimestampsRef.current.push(Date.now());

            toast({ 
                title: 'Test Sent Successfully', 
                description: `A test ${channel} message has been sent to ${recipient}.` 
            });
            onOpenChange(false);
            setRecipient('');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to send test message';
            toast({ variant: 'destructive', title: 'Test Failed', description: msg });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 border border-border/50 shadow-2xl overflow-hidden rounded-3xl bg-card">
                
                {/* ── HEADER: Icon and Title Aligned Inline (No Sub-description) ── */}
                <DialogHeader className="px-6 py-4 border-b border-border/40 shrink-0 text-left bg-muted/20">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "p-2.5 rounded-xl shadow-sm shrink-0 flex items-center justify-center",
                            channel === 'email' ? "bg-primary/10 text-primary" : "bg-orange-500/10 text-orange-500"
                        )}>
                            <FlaskConical className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                            Send Test Message
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Preview and test your message before sending.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                {/* ── BODY ── */}
                <div className="flex-1 overflow-hidden relative">
                    <ScrollArea className="h-full max-h-[calc(85vh-130px)]">
                        <div className="p-6 space-y-6">

                            {/* MODE SELECTOR TOGGLE */}
                            <div className="flex items-center justify-between gap-2 p-1 bg-muted/40 rounded-xl border border-border/40">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTestMode('entity');
                                        if (selectedEntityId) handleEntityChange(selectedEntityId);
                                    }}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer",
                                        testMode === 'entity'
                                            ? "bg-card text-foreground shadow-sm border border-border/50"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Building2 className="h-3.5 w-3.5 text-primary" />
                                    <span>Selected {singular}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTestMode('custom')}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer",
                                        testMode === 'custom'
                                            ? "bg-card text-foreground shadow-sm border border-border/50"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Sliders className="h-3.5 w-3.5 text-primary" />
                                    <span>Custom Values</span>
                                </button>
                            </div>

                            {/* SEARCHABLE ENTITY SELECTION COMBOBOX */}
                            {testMode === 'entity' && (
                                <div className="space-y-2 animate-in fade-in duration-200">
                                    <Label className="text-xs font-semibold text-muted-foreground ml-0.5">
                                        Select {singular} to Test With
                                    </Label>
                                    <Popover open={entitySearchOpen} onOpenChange={setEntitySearchOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={entitySearchOpen}
                                                disabled={isLoadingEntities || entities.length === 0}
                                                className="w-full h-11 justify-between rounded-xl bg-muted/20 border-border/50 text-xs font-medium px-3.5 text-left"
                                            >
                                                <span className="truncate">
                                                    {selectedEntity
                                                        ? selectedEntity.displayName || (selectedEntity as unknown as Record<string, string>).name
                                                        : isLoadingEntities
                                                        ? `Loading ${singular.toLowerCase()}s...`
                                                        : `Choose a ${singular.toLowerCase()}...`}
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border-border/50 shadow-2xl" align="start">
                                            <Command className="rounded-xl">
                                                <CommandInput placeholder={`Search ${singular.toLowerCase()}...`} className="h-10 text-xs" />
                                                <CommandList className="max-h-60 overflow-y-auto p-1 scrollbar-thin">
                                                    <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                                                        No {singular.toLowerCase()} found.
                                                    </CommandEmpty>
                                                    <CommandGroup>
                                                        {entities.map((e) => {
                                                            const eId = e.entityId || e.id;
                                                            const eName = e.displayName || (e as unknown as Record<string, string>).name;
                                                            const isSelected = selectedEntityId === eId;
                                                            return (
                                                                <CommandItem
                                                                    key={eId}
                                                                    value={eName}
                                                                    onSelect={() => {
                                                                        handleEntityChange(eId);
                                                                        setEntitySearchOpen(false);
                                                                    }}
                                                                    className="text-xs font-medium rounded-lg px-2.5 py-2 flex items-center justify-between cursor-pointer"
                                                                >
                                                                    <span className="truncate">{eName}</span>
                                                                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
                                                                </CommandItem>
                                                            );
                                                        })}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            )}

                            {/* RECIPIENT INPUT */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground ml-0.5">
                                    Recipient Target
                                </Label>
                                <div className="relative">
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                                        {channel === 'email' ? <Mail className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                                    </div>
                                    <Input 
                                        value={recipient} 
                                        onChange={e => setRecipient(e.target.value)}
                                        placeholder={channel === 'email' ? 'your-email@example.com' : 'e.g. +233242737120'}
                                        className="h-11 pl-10 rounded-xl bg-muted/20 border-border/50 text-sm font-medium"
                                        type={channel === 'email' ? 'email' : 'tel'}
                                    />
                                </div>
                            </div>

                            {/* TEMPLATE VARIABLES INPUT GRID */}
                            {detectedTags.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                            Template Variables
                                        </Label>
                                        <Badge variant="secondary" className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md">
                                            {detectedTags.length} {detectedTags.length === 1 ? 'Variable' : 'Variables'}
                                        </Badge>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/20 border border-border/40">
                                        {detectedTags.map(tag => (
                                            <div key={tag} className="space-y-1">
                                                <Label className="text-[10px] font-medium text-muted-foreground truncate block">
                                                    {tag.replace(/_/g, ' ')}
                                                </Label>
                                                <Input 
                                                    value={localVariables[tag] || ''} 
                                                    onChange={e => setLocalVariables(prev => ({ ...prev, [tag]: e.target.value }))}
                                                    placeholder={`Value for {{${tag}}}`}
                                                    className="h-9 rounded-lg bg-card border-border/40 text-xs font-medium px-3"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* MINIMAL FOOTER DISCLAIMER */}
                            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 flex items-center gap-2 text-xs text-muted-foreground">
                                <Zap className="h-4 w-4 text-primary shrink-0" />
                                <span>Test environment: Message will be delivered with the resolved variables above.</span>
                            </div>

                        </div>
                    </ScrollArea>
                </div>

                {/* ── FOOTER ── */}
                <DialogFooter className="px-6 py-4 border-t border-border/40 shrink-0 flex items-center justify-end gap-3 bg-muted/10">
                    <Button 
                        variant="ghost" 
                        onClick={() => onOpenChange(false)} 
                        disabled={isSending} 
                        className="font-medium text-xs rounded-xl h-10 px-5 cursor-pointer"
                    >
                        Discard
                    </Button>
                    <Button 
                        onClick={handleSend} 
                        disabled={isSending || !recipient.trim() || isRateLimited}
                        className={cn(
                            "rounded-xl font-semibold text-xs h-10 px-6 shadow-md flex items-center gap-2 cursor-pointer active:scale-95 transition-all duration-200",
                            isRateLimited ? "bg-amber-500 text-white" : "bg-primary text-primary-foreground"
                        )}
                    >
                        {isRateLimited ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Wait ({cooldownSeconds}s)
                            </>
                        ) : isSending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Sending…
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4" />
                                Send Test
                            </>
                        )}
                    </Button>
                </DialogFooter>

            </DialogContent>
        </Dialog>
    );
}

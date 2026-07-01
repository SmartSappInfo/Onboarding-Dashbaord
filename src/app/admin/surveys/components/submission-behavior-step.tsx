'use client';

import * as React from 'react';
import { useFormContext, Controller, useFieldArray } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Zap, Database, Tags, ArrowRight, Table as TableIcon, Plus, Trash2, ListTree, Search, Check, PlusCircle } from 'lucide-react';
import { cn, stripHtml } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { MultiSelect } from '@/components/ui/multi-select';
import { type SurveyQuestion, type SurveyElement, type AppField } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

import { useToast } from '@/hooks/use-toast';
import { createFieldAction } from '@/lib/fields-actions';
import { createTagAction } from '@/lib/tag-actions';
import { saveAutomationAction } from '@/lib/automation-actions';
import WebhookManager from './webhook-manager';
import InternalNotificationConfig from '@/app/admin/components/internal-notification-config';
import ExternalNotificationConfig from './external-notification-config';
import SurveyLeadCaptureCard from './survey-lead-capture-card';

export default function SubmissionBehaviorStep() {
    const { control, watch, setValue } = useFormContext();
    const firestore = useFirestore();
    const { activeWorkspaceId, activeOrganizationId, activeWorkspace } = useWorkspace();
    const { user } = useUser();
    const { toast } = useToast();

    const entityTerminology = activeWorkspace?.terminology?.singular || 'Contact';

    const elements = watch('elements') || [];
    const questions = React.useMemo(() => {
        const qList = elements.filter((el: SurveyElement): el is SurveyQuestion => 'isRequired' in el) as SurveyQuestion[];
        return qList.map(q => ({
            ...q,
            title: stripHtml(q.title || '')
        }));
    }, [elements]);

    const { fields, append, remove } = useFieldArray({
        control,
        name: "entityMapping.additionalMappings"
    });



    const createEntity = watch('createEntity');

    // 1. Dynamic Data Fetching (WORKSPACE SCOPED)


    const tagsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(collection(firestore, 'tags'), where('workspaceId', '==', activeWorkspaceId), orderBy('name', 'asc'));
    }, [firestore, activeWorkspaceId]);
    const { data: tags } = useCollection<any>(tagsQuery);

    const fieldsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'app_fields'),
            where('workspaceId', '==', activeWorkspaceId)
        );
    }, [firestore, activeWorkspaceId]);
    const { data: appFields } = useCollection<AppField>(fieldsQuery);

    const fieldGroupsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'field_groups'),
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('order', 'asc')
        );
    }, [firestore, activeWorkspaceId]);
    const { data: fieldGroups } = useCollection<any>(fieldGroupsQuery);

    const automationsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'automations'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('name', 'asc')
        );
    }, [firestore, activeWorkspaceId]);
    const { data: automations } = useCollection<any>(automationsQuery);

    // Group fields by FieldGroup for the mapping dropdown
    const groupedTargetFields = React.useMemo(() => {
        if (!appFields || !fieldGroups) return [];
        
        return fieldGroups.map(group => {
            const options = appFields
                .filter(f => f.groupId === group.id && f.status === 'active' && f.type !== 'hidden')
                .map(f => {
                    // Default to personData for custom fields
                    let prefix = 'personData.';
                    if (f.compatibilityScope?.includes('institution') && !f.compatibilityScope?.includes('person')) {
                        prefix = 'institutionData.';
                    }
                    return {
                        label: f.label,
                        value: `${prefix}${f.variableName}`
                    };
                });
            return {
                label: group.name,
                options
            };
        }).filter(g => g.options.length > 0);
    }, [appFields, fieldGroups]);

    // 2. Dialog States
    const [isCreateTagOpen, setIsCreateTagOpen] = React.useState(false);
    const [isCreateFieldOpen, setIsCreateFieldOpen] = React.useState(false);
    const [isCreateAutomationOpen, setIsCreateAutomationOpen] = React.useState(false);
    const [isCreateTemplateOpen, setIsCreateTemplateOpen] = React.useState(false);
    const [newTemplateChannel, setNewTemplateChannel] = React.useState('email');

    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Watch for selected automations to check for draft status (for Step 4 context)
    const selectedAutomations = watch('autoAutomations') || [];
    const hasDraftAutomations = React.useMemo(() => {
        if (!automations || selectedAutomations.length === 0) return false;
        return automations.some(a => selectedAutomations.includes(a.id) && (a.status === 'draft' || !a.isActive));
    }, [automations, selectedAutomations]);

    // Helper for searchable select
    const SearchableSelect = ({ 
        value, 
        onSelect, 
        options, 
        placeholder = "Search...", 
        triggerClassName = "",
        renderOption = (opt: any) => opt?.label || "Select..."
    }: any) => {
        const [open, setOpen] = React.useState(false);
        const allOptions = options[0]?.options ? options.flatMap((g: any) => g.options) : options;
        const selectedOpt = allOptions.find((o: any) => o.value === value);
        
        return (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn("w-full justify-between h-11 rounded-xl bg-muted/20 border-none px-4 text-[11px] font-bold shadow-none hover:bg-muted/30 transition-all", triggerClassName)}
                    >
                        <span className="truncate">{value ? renderOption(selectedOpt) : placeholder}</span>
                        <Search className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 rounded-xl border-none shadow-2xl bg-popover ring-1 ring-border" align="start" sideOffset={8}>
                    <Command className="rounded-xl bg-transparent">
                        <CommandInput placeholder={placeholder} className="h-10 border-none focus:ring-0 text-[11px] font-bold" autoFocus />
                        <CommandList className="max-h-[300px] overflow-y-auto no-scrollbar">
                            <CommandEmpty className="py-6 text-center text-[10px] font-bold text-muted-foreground/50 italic">No results found.</CommandEmpty>
                            
                            {options[0]?.options ? (
                                options.map((group: any) => (
                                    <React.Fragment key={group.label}>
                                        <div className="px-4 py-2 text-[9px] uppercase tracking-widest font-black text-primary/40 bg-muted/5 select-none">
                                            {group.label}
                                        </div>
                                        <CommandGroup>
                                            {group.options.map((opt: any) => (
                                                <CommandItem
                                                    key={opt.value}
                                                    value={opt.label}
                                                    onSelect={() => {
                                                        onSelect(opt.value);
                                                        setOpen(false);
                                                    }}
                                                    className="text-[11px] font-bold py-2.5 px-4 cursor-pointer hover:bg-primary/5 aria-selected:bg-primary/10 transition-colors"
                                                >
                                                    <Check className={cn("mr-2 h-3 w-3 text-primary", value === opt.value ? "opacity-100" : "opacity-0")} />
                                                    {opt.label}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                        <Separator className="opacity-50" />
                                    </React.Fragment>
                                ))
                            ) : (
                                <CommandGroup>
                                    {options.map((opt: any) => (
                                        <CommandItem
                                            key={opt.value}
                                            value={opt.label}
                                            onSelect={() => {
                                                onSelect(opt.value);
                                                setOpen(false);
                                            }}
                                            className="text-[11px] font-bold py-2.5 px-4 cursor-pointer hover:bg-primary/5 aria-selected:bg-primary/10 transition-colors"
                                        >
                                            <Check className={cn("mr-2 h-3 w-3 text-primary", value === opt.value ? "opacity-100" : "opacity-0")} />
                                            {opt.label}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        );
    };

    // 3. Action Handlers
    const handleCreateTag = async (data: any) => {
        if (!user || !activeWorkspaceId) return;

        const trimmedName = data.name.trim();
        const existingTag = tags?.find((t: any) => t.name.toLowerCase() === trimmedName.toLowerCase());
        if (existingTag) {
            toast({ title: 'Tag Auto-Selected', description: `Tag "${existingTag.name}" already exists and has been selected.` });
            setIsCreateTagOpen(false);
            const current = watch('autoTags') || [];
            if (!current.includes(existingTag.id)) {
                setValue('autoTags', [...current, existingTag.id], { shouldDirty: true });
            }
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await createTagAction({
                workspaceId: activeWorkspaceId,
                organizationId: activeOrganizationId || '',
                name: trimmedName,
                category: data.category || 'custom',
                color: data.color || '#3B82F6',
                userId: user?.uid || '',
                userName: user?.displayName || 'System'
            });
            if (res.success && res.data?.id) {
                toast({ title: 'Tag Created', description: `Tag "${trimmedName}" added to registry.` });
                setIsCreateTagOpen(false);
                const current = watch('autoTags') || [];
                setValue('autoTags', [...current, res.data.id], { shouldDirty: true });
            } else {
                toast({ variant: 'destructive', title: 'Action Failed', description: res?.error || 'Failed to create tag.' });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateField = async (data: any) => {
        if (!user || !activeWorkspaceId) return;
        setIsSubmitting(true);
        try {
            const res = await createFieldAction({
                workspaceId: activeWorkspaceId,
                organizationId: activeOrganizationId || '',
                name: data.variableName, // Variable name in db
                label: data.label,
                variableName: data.variableName,
                type: 'short_text',
                section: data.section || 'custom',
                status: 'active',
                isNative: false,
                compatibilityScope: ['common']
            }, user?.uid || '');
            if (res.success) {
                toast({ title: 'Field Created', description: `Property "${data.label}" is now available for mapping.` });
                setIsCreateFieldOpen(false);
            } else {
                toast({ variant: 'destructive', title: 'Action Failed', description: res.error });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateAutomation = async (data: any) => {
        if (!user || !activeWorkspaceId) return;
        setIsSubmitting(true);
        try {
            const res = await saveAutomationAction(null, {
                workspaceIds: [activeWorkspaceId],
                name: data.name,
                status: 'draft',
                isActive: false,
                nodes: [],
                edges: [],
                trigger: { type: 'SURVEY_SUBMITTED', config: {} }
            } as any, user?.uid || '');
            if (res.success) {
                toast({ title: 'Automation Drafted', description: `"${data.name}" created. Remember to complete it in Step 4.` });
                setIsCreateAutomationOpen(false);
                // Optionally append to the list
                const current = watch('autoAutomations') || [];
                setValue('autoAutomations', [...current, res.id]);
            } else {
                toast({ variant: 'destructive', title: 'Action Failed', description: res.error });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500 text-left pb-32 relative">
            {/* Entity Mapping Card */}
            <SurveyLeadCaptureCard />

            {/* Automation Bench */}
            {createEntity && (
                <Card className="rounded-2xl border border-border bg-card overflow-hidden">
                <CardHeader className="bg-muted/10 border-b py-5 px-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-xl">
                            <Zap className="h-5 w-5 text-indigo-600" />
                        </div>
                        <CardTitle className="text-sm font-semibold tracking-tight">Workbench Automations</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        {/* Tags */}
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold flex items-center gap-2">
                                    <Tags className="h-3.5 w-3.5 text-primary" /> Auto-Apply Registry Tags
                                </Label>
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 text-primary hover:bg-primary/10 rounded-full px-2 gap-1 text-[10px] font-bold uppercase tracking-wider"
                                    onClick={() => setIsCreateTagOpen(true)}
                                >
                                    <PlusCircle className="h-3 w-3" /> New
                                </Button>
                            </div>
                            <Controller
                                name="autoTags"
                                control={control}
                                render={({ field }) => (
                                    <MultiSelect
                                        options={(tags || []).map((t: any) => ({ label: t.name, value: t.id }))} // Use ID for tags
                                        value={field.value || []}
                                        onChange={field.onChange}
                                        placeholder="Deploy tags..."
                                        className="rounded-xl bg-background border border-border/50 shadow-sm font-bold min-h-[44px] transition-all focus-within:ring-1 focus-within:ring-primary/30"
                                    />
                                )}
                            />
                            <p className="text-[9px] font-bold text-muted-foreground/50 italic leading-relaxed">
                                Respondents matching these tags will automatically join the corresponding segments in the CRM.
                            </p>
                        </div>

                        {/* Automations */}
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold flex items-center gap-2">
                                    <Zap className="h-3.5 w-3.5 text-indigo-600" /> Executive Workflows
                                </Label>
                                <div className="flex items-center gap-2">
                                    {hasDraftAutomations && (
                                        <Badge variant="outline" className="text-[8px] font-black uppercase bg-amber-500/10 text-amber-600 border-amber-500/20">
                                            Drafts Detected
                                        </Badge>
                                    )}
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 text-primary hover:bg-primary/10 rounded-full px-2 gap-1 text-[10px] font-bold uppercase tracking-wider"
                                        onClick={() => setIsCreateAutomationOpen(true)}
                                    >
                                        <PlusCircle className="h-3 w-3" /> New
                                    </Button>
                                </div>
                            </div>
                            <Controller
                                name="autoAutomations"
                                control={control}
                                render={({ field }) => (
                                    <MultiSelect
                                        options={(automations || []).map((a: any) => ({ 
                                            label: `${a.name}${a.status === 'draft' || !a.isActive ? ' (Draft)' : ''}`, 
                                            value: a.id 
                                        }))}
                                        value={field.value || []}
                                        onChange={field.onChange}
                                        placeholder="Initialize triggers..."
                                        className="rounded-xl bg-background border border-border/50 shadow-sm font-bold min-h-[44px] transition-all focus-within:ring-1 focus-within:ring-indigo-500/30"
                                    />
                                )}
                            />
                            <p className="text-[9px] font-bold text-muted-foreground/50 italic leading-relaxed">
                                These automations will be executed immediately after the submission is validated.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
            )}

            <div className="space-y-8">
                <InternalNotificationConfig prefix="adminAlert" category="surveys" />
                <ExternalNotificationConfig prefix="externalAlert" category="surveys" />
                <WebhookManager />
            </div>


            {/* Creation Dialogs */}
            
            {/* Tag Creation */}
            <CreateTagDialog 
                open={isCreateTagOpen} 
                onOpenChange={setIsCreateTagOpen} 
                onSubmit={handleCreateTag} 
                isSubmitting={isSubmitting} 
            />

            {/* Field Creation */}
            <CreateFieldDialog 
                open={isCreateFieldOpen} 
                onOpenChange={setIsCreateFieldOpen} 
                onSubmit={handleCreateField} 
                isSubmitting={isSubmitting} 
            />

            {/* Automation Creation */}
            <CreateAutomationDialog 
                open={isCreateAutomationOpen} 
                onOpenChange={setIsCreateAutomationOpen} 
                onSubmit={handleCreateAutomation} 
                isSubmitting={isSubmitting} 
            />

            {/* Message Template Redirect (Simple link for now) */}
            <Dialog open={isCreateTemplateOpen} onOpenChange={setIsCreateTemplateOpen}>
                <DialogContent className="rounded-[2rem] max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="font-black text-xl tracking-tighter">Create {newTemplateChannel.toUpperCase()} Template</DialogTitle>
                        <DialogDescription className="text-[11px] font-bold text-muted-foreground/60 leading-relaxed italic">
                            Message templates require a specialized visual builder. You'll be redirected to the template manager.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 pt-4 border-t gap-2 sm:flex-col">
                        <Button 
                            className="w-full rounded-2xl font-black text-xs uppercase tracking-widest h-12 shadow-lg shadow-primary/20"
                            onClick={() => window.open('/admin/messaging/templates', '_blank')}
                        >
                            Open Template Builder
                        </Button>
                        <Button 
                            variant="ghost" 
                            className="w-full rounded-2xl font-black text-[10px] uppercase tracking-widest h-10"
                            onClick={() => setIsCreateTemplateOpen(false)}
                        >
                            Maybe Later
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Creation Components (Local Helpers)
// ──────────────────────────────────────────────────────────────────────────────

function CreateTagDialog({ open, onOpenChange, onSubmit, isSubmitting }: any) {
    const [name, setName] = React.useState('');
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-[2.5rem] max-w-sm">
                <DialogHeader className="pt-4 px-2">
                    <DialogTitle className="font-black text-2xl tracking-tighter text-primary">New Registry Tag</DialogTitle>
                    <DialogDescription className="text-[11px] font-bold text-muted-foreground/60 leading-relaxed italic">Add an organizational label to your CRM taxonomy.</DialogDescription>
                </DialogHeader>
                <div className="p-4 space-y-4">
                    <div className="space-y-2 px-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tag Name</Label>
                        <Input 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            placeholder="e.g. High Intent" 
                            className="h-12 rounded-2xl border-none bg-muted/20 px-5 font-bold shadow-inner"
                        />
                    </div>
                </div>
                <DialogFooter className="px-4 pb-8">
                    <Button 
                        onClick={() => onSubmit({ name })} 
                        disabled={isSubmitting || !name} 
                        className="w-full h-14 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/30"
                    >
                        {isSubmitting ? 'Registering...' : 'Add to Registry'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function CreateFieldDialog({ open, onOpenChange, onSubmit, isSubmitting }: any) {
    const [label, setLabel] = React.useState('');
    const [variableName, setVariableName] = React.useState('');
    
    const handleLabelChange = (val: string) => {
        setLabel(val);
        setVariableName(val.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, ''));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-[2.5rem] max-w-sm border-none shadow-2xl ring-1 ring-border">
                <DialogHeader className="pt-6 px-4">
                    <DialogTitle className="font-black text-2xl tracking-tighter flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-xl"><TableIcon className="h-5 w-5 text-indigo-600" /></div>
                        Studio Property
                    </DialogTitle>
                    <DialogDescription className="text-[11px] font-bold text-muted-foreground/60 leading-relaxed italic">Extend your workspace schema with a new property.</DialogDescription>
                </DialogHeader>
                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Display Label</Label>
                        <Input 
                            value={label} 
                            onChange={e => handleLabelChange(e.target.value)} 
                            placeholder="e.g. Annual Revenue" 
                            className="h-12 rounded-2xl border-none bg-muted/20 px-5 font-bold shadow-inner"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Variable Identity (DB Key)</Label>
                        <div className="flex items-center gap-2 bg-muted/20 rounded-2xl px-5 h-12 border border-dashed border-border/60">
                            <code className="text-[11px] font-black text-indigo-600">{variableName || 'waiting_for_label'}</code>
                        </div>
                    </div>
                </div>
                <DialogFooter className="p-6 pt-0">
                    <Button 
                        onClick={() => onSubmit({ label, variableName })} 
                        disabled={isSubmitting || !label} 
                        className="w-full h-14 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700"
                    >
                        {isSubmitting ? 'Committing...' : 'Commit to Schema'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function CreateAutomationDialog({ open, onOpenChange, onSubmit, isSubmitting }: any) {
    const [name, setName] = React.useState('');
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-[2.5rem] max-w-sm">
                <DialogHeader className="pt-6 px-4">
                    <DialogTitle className="font-black text-2xl tracking-tighter flex items-center gap-3">
                        <Zap className="h-6 w-6 text-amber-500 fill-amber-500" />
                        Quick Workflow
                    </DialogTitle>
                    <DialogDescription className="text-[11px] font-bold text-muted-foreground/60 leading-relaxed italic">Draft a new behavioral chain. You'll finish the logic in Step 4.</DialogDescription>
                </DialogHeader>
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Workflow Name</Label>
                        <Input 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            placeholder="e.g. Lead Qualification Sync" 
                            className="h-12 rounded-2xl border-none bg-muted/20 px-5 font-bold shadow-inner"
                        />
                    </div>
                    <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl flex gap-3">
                        <ArrowRight className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[9px] font-bold text-amber-600/80 leading-relaxed">
                            This creates an <span className="font-black underline italic">Incomplete Draft</span>. You'll be prompted to complete the node-mapping before publishing your survey.
                        </p>
                    </div>
                </div>
                <DialogFooter className="p-6 pt-0">
                    <Button 
                        onClick={() => onSubmit({ name })} 
                        disabled={isSubmitting || !name} 
                        className="w-full h-14 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20 bg-amber-500 hover:bg-amber-600"
                    >
                        {isSubmitting ? 'Drafting...' : 'Initialize Draft'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Separator({ className }: { className?: string }) { return <div className={cn("h-px w-full bg-border", className)} />; }
function PlusIcon({ className }: { className?: string }) { return <Plus className={className} />; }

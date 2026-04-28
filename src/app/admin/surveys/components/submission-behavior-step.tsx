'use client';

import * as React from 'react';
import { useFormContext, Controller, useFieldArray } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Zap, Users, ShieldCheck, Database, Tags, Bell, ArrowRight, Table as TableIcon, Plus, Trash2, ListTree, Mail, Smartphone, Search, Check, PlusCircle, Eye, RotateCcw } from 'lucide-react';
import { cn, toTitleCase, stripHtml } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { MultiSelect } from '@/components/ui/multi-select';
import { type SurveyQuestion, type SurveyElement, type MessageTemplate, type AppField, type Tag } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createFieldAction } from '@/lib/fields-actions';
import { createTagAction } from '@/lib/tag-actions';
import { saveAutomationAction } from '@/lib/automation-actions';

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

    const TARGET_FIELDS = [
        { label: 'Nominal Roll (Institution)', value: 'institutionData.nominalRoll' },
        { label: 'Website (Institution)', value: 'institutionData.website' },
        { label: 'Slogan (Institution)', value: 'institutionData.slogan' },
        { label: 'Initials (Institution)', value: 'institutionData.initials' },
        { label: 'Billing Address (Institution)', value: 'institutionData.billingAddress' },
        { label: 'Company (Person)', value: 'personData.company' },
        { label: 'Job Title (Person)', value: 'personData.jobTitle' },
        { label: 'Lead Source (Person)', value: 'personData.leadSource' },
    ];

    const createEntity = watch('createEntity');
    const assignmentEnabled = watch('assignmentEnabled');

    // 1. Dynamic Data Fetching (WORKSPACE SCOPED)
    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('isAuthorized', '==', true), orderBy('name', 'asc'));
    }, [firestore]);
    const { data: users } = useCollection<any>(usersQuery);

    const tagsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(collection(firestore, 'tags'), where('workspaceId', '==', activeWorkspaceId), orderBy('name', 'asc'));
    }, [firestore, activeWorkspaceId]);
    const { data: tags } = useCollection<any>(tagsQuery);

    const fieldsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'app_fields'),
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('section', 'asc')
        );
    }, [firestore, activeWorkspaceId]);
    const { data: appFields } = useCollection<AppField>(fieldsQuery);

    const automationsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'automations'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('name', 'asc')
        );
    }, [firestore, activeWorkspaceId]);
    const { data: automations } = useCollection<any>(automationsQuery);

    const templatesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'message_templates'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('name', 'asc')
        );
    }, [firestore, activeWorkspaceId]);
    const { data: templates } = useCollection<MessageTemplate>(templatesQuery);

    const emailTemplates = templates?.filter(t => t.channel === 'email') || [];
    const smsTemplates = templates?.filter(t => t.channel === 'sms') || [];

    // Group fields by section for the mapping dropdown
    const dynamicTargetFields = React.useMemo(() => {
        if (!appFields) return [];
        
        // Define entity-compatible scopes
        const entityScopes = ['common', 'institution', 'family', 'person'];

        return appFields
            .filter(f => {
                const isActive = f.status === 'active';
                // Only load fields that are compatible with entities (exclude submission-only/internal-only)
                const isEntityCompatible = !f.compatibilityScope || f.compatibilityScope.some(s => entityScopes.includes(s));
                return isActive && isEntityCompatible;
            })
            .map(f => {
                // Determine logical persistence prefix based on section compatibility
                // institution -> institutionData
                // person/child/common -> personData
                let prefix = 'personData.';
                if (f.section === 'institution') prefix = 'institutionData.';
                
                return {
                    label: f.label,
                    value: `${prefix}${f.variableName}`,
                    section: f.section
                };
            });
    }, [appFields]);

    const groupedTargetFields = React.useMemo(() => [
        {
            label: "Native Properties",
            options: TARGET_FIELDS
        },
        {
            label: "Custom Fields",
            options: dynamicTargetFields
        }
    ], [dynamicTargetFields]);

    // 2. Dialog States
    const [isCreateTagOpen, setIsCreateTagOpen] = React.useState(false);
    const [isCreateFieldOpen, setIsCreateFieldOpen] = React.useState(false);
    const [isCreateAutomationOpen, setIsCreateAutomationOpen] = React.useState(false);
    const [isCreateTemplateOpen, setIsCreateTemplateOpen] = React.useState(false);
    const [newTemplateChannel, setNewTemplateChannel] = React.useState<'email' | 'sms'>('email');

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
        setIsSubmitting(true);
        try {
            const res = await createTagAction({
                workspaceId: activeWorkspaceId,
                organizationId: activeOrganizationId || '',
                name: data.name,
                category: data.category || 'custom',
                color: data.color || '#3B82F6',
                userId: user?.uid || '',
                userName: user?.displayName || 'System'
            });
            if (res.success) {
                toast({ title: 'Tag Created', description: `Tag "${data.name}" added to registry.` });
                setIsCreateTagOpen(false);
            } else {
                toast({ variant: 'destructive', title: 'Action Failed', description: res.error });
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
            <Card className="shadow-sm border-none ring-1 ring-border rounded-2xl overflow-hidden bg-background">
                <CardHeader className="bg-muted/30 border-b pb-6 px-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-xl shadow-inner">
                                <Database className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <CardTitle className="text-sm font-semibold tracking-tight">Save Survey Contact as {entityTerminology}</CardTitle>
                                <CardDescription className="text-[10px] font-bold text-muted-foreground/60 tracking-tight">Map response data to your workspace custom properties.</CardDescription>
                            </div>
                        </div>
                        <Controller
                            name="createEntity"
                            control={control}
                            render={({ field }) => (
                                <div className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300",
                                    field.value ? "bg-emerald-500/5 border-emerald-500/20" : "bg-muted/20 border-border/50"
                                )}>
                                    <span className={cn("text-[9px] font-black uppercase tracking-widest", field.value ? "text-emerald-600" : "text-muted-foreground/40")}>
                                        Sync Engine {field.value ? 'Engaged' : 'Idle'}
                                    </span>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </div>
                            )}
                        />
                    </div>
                </CardHeader>
                <CardContent className={cn("p-6 space-y-10 transition-all duration-500", !createEntity && "opacity-40 grayscale pointer-events-none select-none overflow-hidden h-[120px]")}>
                    {/* Identity Mappings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] font-bold uppercase tracking-tight">Identity Bridge</Badge>
                                <div className="h-px flex-1 bg-border/40" />
                            </div>

                            <Controller
                                name="entityMapping.entityNameFieldId"
                                control={control}
                                render={({ field }) => (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Business/Entity Name Source</Label>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold text-[11px]">
                                                <SelectValue placeholder="Identify entity name source..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {questions.map(q => (
                                                    <SelectItem key={q.id} value={q.id} className="font-medium text-[11px]">{stripHtml(q.title || '')}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[9px] font-bold text-muted-foreground/50 italic ml-1 leading-tight">Usually "Business Name" or "Organization".</p>
                                    </div>
                                )}
                            />

                            <Controller
                                name="entityMapping.contactNameFieldId"
                                control={control}
                                render={({ field }) => (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Focal Person Name</Label>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold text-[11px]">
                                                <SelectValue placeholder="Identify focal person source..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {questions.map(q => (
                                                    <SelectItem key={q.id} value={q.id} className="font-medium text-[11px]">{stripHtml(q.title || '')}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            />
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] font-bold uppercase tracking-tight">Connectivity Path</Badge>
                                <div className="h-px flex-1 bg-border/40" />
                            </div>

                            <Controller
                                name="entityMapping.contactEmailFieldId"
                                control={control}
                                render={({ field }) => (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Communication Email</Label>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold text-[11px]">
                                                <SelectValue placeholder="Select email input..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {questions.filter(q => q.type === 'email' || q.type === 'text').map(q => (
                                                    <SelectItem key={q.id} value={q.id} className="font-medium text-[11px]">{q.title}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            />

                            <Controller
                                name="entityMapping.contactPhoneFieldId"
                                control={control}
                                render={({ field }) => (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">SMS/Direct Mobile</Label>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold text-[11px]">
                                                <SelectValue placeholder="Select phone input..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {questions.filter(q => q.type === 'phone' || q.type === 'text').map(q => (
                                                    <SelectItem key={q.id} value={q.id} className="font-medium text-[11px]">{q.title}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            />
                        </div>
                    </div>

                    <Separator className="bg-border/50" />

                    {/* Advanced Mapping */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Badge variant="outline" className="bg-indigo-500/5 text-indigo-600 border-indigo-500/20 text-[9px] font-bold uppercase tracking-widest">Custom Field Integration</Badge>
                                <div className="h-px w-24 bg-border/40" />
                            </div>
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="h-8 rounded-xl font-black text-[9px] uppercase tracking-widest gap-2 bg-transparent ring-1 ring-border shadow-none hover:bg-primary hover:text-white transition-all transform active:scale-95"
                                onClick={() => append({ questionId: '', targetField: '' })}
                            >
                                <PlusIcon className="h-3 w-3" /> Add Property Mapping
                            </Button>
                        </div>

                        {fields.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4">
                                {fields.map((f, i) => (
                                    <div key={f.id} className="group relative grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-3xl bg-muted/20 border border-border/40 hover:border-primary/20 transition-all animate-in zoom-in-95 duration-300">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Source Question</Label>
                                            <Controller
                                                name={`entityMapping.additionalMappings.${i}.questionId`}
                                                control={control}
                                                render={({ field }) => (
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <SelectTrigger className="h-11 rounded-xl bg-background border-none font-bold text-[11px] shadow-sm ring-1 ring-border/20">
                                                            <SelectValue placeholder="Select question..." />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            {questions.map(q => (
                                                                <SelectItem key={q.id} value={q.id} className="font-medium text-[11px]">{q.title}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target CRM Property</Label>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-5 w-5 text-primary hover:bg-primary/10 rounded-full"
                                                    onClick={() => setIsCreateFieldOpen(true)}
                                                    title="Create missing property"
                                                >
                                                    <PlusCircle className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <Controller
                                                name={`entityMapping.additionalMappings.${i}.targetField`}
                                                control={control}
                                                render={({ field }) => (
                                                    <SearchableSelect 
                                                        value={field.value}
                                                        onSelect={field.onChange}
                                                        options={groupedTargetFields}
                                                        placeholder="Select property..."
                                                        triggerClassName="bg-background shadow-none ring-1 ring-border/20 h-11 rounded-xl"
                                                    />
                                                )}
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-all border-4 border-background shadow-xl hover:bg-destructive hover:text-white"
                                            onClick={() => remove(i)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 flex flex-col items-center justify-center bg-muted/10 rounded-3xl border border-dashed border-border/60">
                                <ListTree className="h-10 w-10 text-muted-foreground/20 mb-3" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">No Technical Mappings Defined</p>
                                <Button 
                                    variant="link" 
                                    className="text-[10px] font-bold h-auto py-0 mt-2"
                                    onClick={() => append({ questionId: '', targetField: '' })}
                                >
                                    Initialize first bridge mapping
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Automation Bench */}
            <Card className="shadow-sm border-none ring-1 ring-border rounded-2xl overflow-hidden bg-background">
                <CardHeader className="bg-muted/30 border-b pb-6 px-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-xl">
                            <Zap className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-semibold tracking-tight">Workbench Automations</CardTitle>
                            <CardDescription className="text-[10px] font-bold text-muted-foreground/60 tracking-tight">Trigger complex behavioral logic and labeling on entry.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        {/* Tags */}
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Tags className="h-3.5 w-3.5 text-primary" /> Auto-Apply Registry Tags
                                </Label>
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-primary hover:bg-primary/10 rounded-full"
                                    onClick={() => setIsCreateTagOpen(true)}
                                >
                                    <PlusCircle className="h-4 w-4" />
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
                                        className="rounded-2xl bg-muted/20 border-none font-bold min-h-[52px] shadow-none ring-1 ring-border/20 transition-all focus-within:ring-primary/40"
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
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
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
                                        size="icon" 
                                        className="h-6 w-6 text-primary hover:bg-primary/10 rounded-full"
                                        onClick={() => setIsCreateAutomationOpen(true)}
                                    >
                                        <PlusCircle className="h-4 w-4" />
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
                                        className="rounded-2xl bg-muted/20 border-none font-bold min-h-[52px] shadow-none ring-1 ring-border/20 transition-all focus-within:ring-indigo-500/40"
                                    />
                                )}
                            />
                            <p className="text-[9px] font-bold text-muted-foreground/50 italic leading-relaxed">
                                These automations will be executed immediately after the submission is validated.
                            </p>
                        </div>
                    </div>

                    <Separator className="bg-border/50" />

                    {/* Cross-Visibility Toggle */}
                    <div className={cn(
                        "rounded-2xl border-2 transition-all duration-300",
                        watch('allowCrossVisibility') ? "border-blue-500/20 bg-blue-500/5" : "border-border/50 bg-background"
                    )}>
                        <div className="flex items-center justify-between p-5">
                            <div className="flex items-center gap-3 text-left">
                                <div className={cn("p-2 rounded-lg transition-colors", watch('allowCrossVisibility') ? "bg-blue-500 text-white shadow-lg" : "bg-muted text-muted-foreground")}>
                                    <Eye className="h-4 w-4" />
                                </div>
                                <div className="space-y-0.5">
                                    <Label className="text-xs font-semibold tracking-tight">Cross-Visibility</Label>
                                    <p className="text-[9px] text-muted-foreground font-medium tracking-tighter">Allow assigned users to view all team submissions, not just their own</p>
                                </div>
                            </div>
                            <Controller
                                name="allowCrossVisibility"
                                control={control}
                                render={({ field }) => (
                                    <Switch 
                                        checked={field.value} 
                                        onCheckedChange={field.onChange} 
                                    />
                                )}
                            />
                        </div>
                    </div>

                    <Separator className="bg-border/50" />

                    {/* Team Notifications */}
                    <div className="space-y-8">
                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30 text-[9px] font-black uppercase tracking-widest px-3 py-1">Engagement Alerts</Badge>
                            <div className="h-px flex-1 bg-border/40" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Email Card */}
                            <div className="group relative space-y-6 p-8 rounded-[2rem] bg-muted/10 border border-border/40 hover:bg-muted/20 transition-all">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-600 shadow-inner">
                                            <Mail className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <Label className="text-xs font-black uppercase tracking-tighter block">Email Dispatch</Label>
                                            <p className="text-[9px] font-bold text-muted-foreground/60 italic leading-none mt-1">Send HTML templated alerts.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 text-primary hover:bg-primary/10 rounded-full"
                                            onClick={() => { setNewTemplateChannel('email'); setIsCreateTemplateOpen(true); }}
                                        >
                                            <PlusCircle className="h-4 w-4" />
                                        </Button>
                                        <Controller
                                            name="notifyAssignedUsers.email"
                                            control={control}
                                            render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
                                        />
                                    </div>
                                </div>
                                <div className={cn("transition-all duration-500", !watch('notifyAssignedUsers.email') && "opacity-20 blur-[1px] pointer-events-none")}>
                                    <Controller
                                        name="notifyAssignedUsers.emailTemplateId"
                                        control={control}
                                        render={({ field }) => (
                                            <SearchableSelect 
                                                value={field.value}
                                                onSelect={field.onChange}
                                                options={emailTemplates.map(t => ({ label: t.name, value: t.id }))}
                                                placeholder="Select email template..."
                                                triggerClassName="bg-background shadow-none ring-1 ring-border/30 h-12 rounded-2xl"
                                            />
                                        )}
                                    />
                                </div>
                            </div>

                            {/* SMS Card */}
                            <div className="group relative space-y-6 p-8 rounded-[2rem] bg-muted/10 border border-border/40 hover:bg-muted/20 transition-all">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600 shadow-inner">
                                            <Smartphone className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <Label className="text-xs font-black uppercase tracking-tighter block">SMS Direct</Label>
                                            <p className="text-[9px] font-bold text-muted-foreground/60 italic leading-none mt-1">Instant mobile notifications.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 text-primary hover:bg-primary/10 rounded-full"
                                            onClick={() => { setNewTemplateChannel('sms'); setIsCreateTemplateOpen(true); }}
                                        >
                                            <PlusCircle className="h-4 w-4" />
                                        </Button>
                                        <Controller
                                            name="notifyAssignedUsers.sms"
                                            control={control}
                                            render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
                                        />
                                    </div>
                                </div>
                                <div className={cn("transition-all duration-500", !watch('notifyAssignedUsers.sms') && "opacity-20 blur-[1px] pointer-events-none")}>
                                    <Controller
                                        name="notifyAssignedUsers.smsTemplateId"
                                        control={control}
                                        render={({ field }) => (
                                            <SearchableSelect 
                                                value={field.value}
                                                onSelect={field.onChange}
                                                options={smsTemplates.map(t => ({ label: t.name, value: t.id }))}
                                                placeholder="Select SMS template..."
                                                triggerClassName="bg-background shadow-none ring-1 ring-border/30 h-12 rounded-2xl"
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Resubmission Toggle Card */}
            <Card className="shadow-sm border-none ring-1 ring-border rounded-2xl overflow-hidden bg-background">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-xl shadow-inner">
                                <RotateCcw className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold tracking-tight">Allow Resubmission</p>
                                <p className="text-[10px] font-bold text-muted-foreground/60 tracking-tight">Show a &quot;Submit Another Response&quot; button on the thank you page.</p>
                            </div>
                        </div>
                        <Controller
                            name="allowResubmission"
                            control={control}
                            render={({ field }) => (
                                <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                            )}
                        />
                    </div>
                </CardContent>
            </Card>

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

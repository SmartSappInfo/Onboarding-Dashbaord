'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Database, Plus, Search, Check, PlusCircle, ListTree } from 'lucide-react';
import { cn, stripHtml } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { createFieldAction, createFieldGroupAction } from '@/lib/fields-actions';
import { type SurveyQuestion, type SurveyElement, type AppField, type FieldGroup } from '@/lib/types';

interface SearchOption {
    label: string;
    value: string;
}

interface SearchGroup {
    label: string;
    options: SearchOption[];
}

interface SearchableSelectProps {
    value: string;
    onSelect: (val: string) => void;
    options: SearchGroup[];
    placeholder?: string;
    triggerClassName?: string;
}

interface CreateFieldDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: { label: string; variableName: string; groupId?: string; newGroupName?: string }) => void;
    isSubmitting: boolean;
    fieldGroups: FieldGroup[];
}

export default function SurveyLeadCaptureCard() {
    const { control, watch, setValue } = useFormContext();
    const firestore = useFirestore();
    const { activeWorkspaceId, activeOrganizationId, activeWorkspace } = useWorkspace();
    const { user } = useUser();
    const { toast } = useToast();

    const entityTerminology: string = activeWorkspace?.terminology?.singular || 'Contact';

    const elements = (watch('elements') || []) as SurveyElement[];
    const questions = React.useMemo<SurveyQuestion[]>(() => {
        const qList = elements.filter((el: SurveyElement): el is SurveyQuestion => 'isRequired' in el);
        return qList.map(q => ({
            ...q,
            title: stripHtml(q.title || '')
        }));
    }, [elements]);

    const createEntity: boolean = watch('createEntity') || false;
    const leadCaptureMode: 'questions' | 'form' = watch('leadCaptureMode') || 'questions';

    // Fetch workspace active fields
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
    const { data: fieldGroups } = useCollection<FieldGroup>(fieldGroupsQuery);

    // Group fields by FieldGroup for the mapping dropdown
    const groupedTargetFields = React.useMemo<SearchGroup[]>(() => {
        if (!appFields || !fieldGroups) return [];
        
        // 1. Generate Virtual Entity Profile Group based on contact scope
        const isPerson = activeWorkspace?.contactScope === 'person';
        const profileOptions: SearchOption[] = isPerson ? [
            { label: 'Full Name', value: 'entity.name' },
            { label: 'Email Address', value: 'contacts.email' },
            { label: 'Phone Number', value: 'contacts.phone' }
        ] : [
            { label: 'Institution Name', value: 'entity.name' },
            { label: 'Focal Person Name', value: 'contacts.name' },
            { label: 'Focal Person Email', value: 'contacts.email' },
            { label: 'Focal Person Phone', value: 'contacts.phone' }
        ];

        const profileGroup: SearchGroup = {
            label: 'Entity Profile',
            options: profileOptions
        };

        // 2. Map existing app fields into their respective groups
        const mappedGroups = fieldGroups.map(group => {
            const options = appFields
                .filter(f => f.groupId === group.id && f.status === 'active' && f.type !== 'hidden')
                .map(f => {
                    // If it is a custom field, prefix with customData.
                    if (!f.isNative) {
                        return {
                            label: f.label,
                            value: `customData.${f.variableName}`
                        };
                    }
                    
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

        return [profileGroup, ...mappedGroups];
    }, [appFields, fieldGroups, activeWorkspace?.contactScope]);

    // Dialog state for creating new field on the fly
    const [isCreateFieldOpen, setIsCreateFieldOpen] = React.useState<boolean>(false);
    const [activeQuestionIdForNewField, setActiveQuestionIdForNewField] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

    const additionalMappings = (watch('entityMapping.additionalMappings') || []) as { questionId: string; targetField: string }[];

    // Ensure default config values are loaded in form state if createEntity is toggled
    React.useEffect(() => {
        if (createEntity) {
            if (!watch('leadCaptureTitle')) {
                setValue('leadCaptureTitle', 'Claim Your Results', { shouldDirty: true });
            }
            if (!watch('leadCaptureDescription')) {
                setValue('leadCaptureDescription', 'Kindly provide your details so that we can send you your results', { shouldDirty: true });
            }
            if (!watch('leadCaptureFieldsConfig')) {
                setValue('leadCaptureFieldsConfig', {
                    name: { show: true, label: 'Full Name', required: true },
                    email: { show: true, label: 'Email Address', required: true },
                    phone: { show: false, label: 'Phone Number', required: false },
                    company: { show: false, label: 'Company Name', required: false }
                }, { shouldDirty: true });
            }
        }
    }, [createEntity, setValue, watch]);

    const handleMapQuestion = (questionId: string, targetField: string) => {
        const filtered = additionalMappings.filter((m) => m.questionId !== questionId);
        if (targetField && targetField !== 'none') {
            setValue('entityMapping.additionalMappings', [...filtered, { questionId, targetField }], { shouldDirty: true });
        } else {
            setValue('entityMapping.additionalMappings', filtered, { shouldDirty: true });
        }
    };

    const handleCreateField = async (data: { label: string; variableName: string; groupId?: string; newGroupName?: string }) => {
        if (!user || !activeWorkspaceId) return;
        setIsSubmitting(true);
        try {
            let groupId = data.groupId || '';
            let section = 'custom';

            if (data.newGroupName?.trim()) {
                const groupRes = await createFieldGroupAction({
                    workspaceId: activeWorkspaceId,
                    organizationId: activeOrganizationId || 'default',
                    name: data.newGroupName.trim(),
                    description: 'Custom field group created via custom field dialog.',
                    icon: 'Folder',
                    color: '#4f46e5',
                    entityTypes: ['person', 'institution', 'family'],
                }, user.uid);

                if (groupRes.success && groupRes.id) {
                    groupId = groupRes.id;
                    section = data.newGroupName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '');
                } else {
                    throw new Error(groupRes.error || 'Failed to create field group.');
                }
            } else if (groupId) {
                const selectedGroup = fieldGroups?.find(g => g.id === groupId);
                if (selectedGroup) {
                    section = selectedGroup.slug || 'custom';
                }
            } else {
                const defaultGroup = fieldGroups?.find(g => g.slug === 'custom' || g.isSystem) || fieldGroups?.[0];
                groupId = defaultGroup?.id || '';
                section = defaultGroup?.slug || 'custom';
            }

            const res = await createFieldAction({
                workspaceId: activeWorkspaceId,
                organizationId: activeOrganizationId || '',
                name: data.variableName,
                label: data.label,
                variableName: data.variableName,
                type: 'short_text',
                groupId: groupId,
                section: section,
                status: 'active',
                isNative: false,
                compatibilityScope: ['common']
            }, user.uid);

            if (res.success) {
                toast({ title: 'Field Created', description: `Property "${data.label}" created and mapped.` });
                setIsCreateFieldOpen(false);
                
                const prefix = activeWorkspace?.contactScope === 'person' ? 'personData.' : 'institutionData.';
                const newTargetField = `${prefix}${data.variableName}`;
                
                if (activeQuestionIdForNewField) {
                    handleMapQuestion(activeQuestionIdForNewField, newTargetField);
                }
            } else {
                toast({ variant: 'destructive', title: 'Action Failed', description: res.error });
            }
        } catch (error: unknown) {
            const err = error as { message?: string };
            toast({ variant: 'destructive', title: 'Action Failed', description: err.message || 'Error occurred.' });
        } finally {
            setIsSubmitting(false);
            setActiveQuestionIdForNewField(null);
        }
    };

    return (
        <div className={cn(
            "rounded-[2rem] border-2 transition-all duration-500 text-left bg-card",
            createEntity ? "border-emerald-500/20 bg-emerald-500/5 shadow-xl shadow-emerald-500/5" : "border-border/50"
        )}>
            <div className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "p-3 rounded-2xl transition-all duration-500", 
                        createEntity ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 rotate-3" : "bg-muted text-muted-foreground"
                    )}>
                        <Database className="h-6 w-6" />
                    </div>
                    <div className="space-y-0.5">
                        <Label className="text-base font-semibold tracking-tight">Save Survey Contact as {entityTerminology}</Label>
                        <p className="text-[10px] text-muted-foreground font-semibold tracking-tighter">Automatically route contacts into the CRM</p>
                    </div>
                </div>
                <Controller
                    name="createEntity"
                    control={control}
                    render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} className="scale-125 data-[state=checked]:bg-emerald-500" />
                    )}
                />
            </div>
            {createEntity && (
                <div className="p-6 pt-0 space-y-10 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="h-px w-full bg-emerald-500/10 mb-6" />

                    {/* Lead Capture Mode Toggle */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Lead Capture Flow Mode</Label>
                        <Controller
                            name="leadCaptureMode"
                            control={control}
                            render={({ field }) => (
                                <div className="grid grid-cols-2 gap-2 bg-muted/20 p-1 rounded-xl border border-border/40 max-w-md">
                                    <button
                                        type="button"
                                        onClick={() => field.onChange('questions')}
                                        className={cn(
                                            "h-9 rounded-lg font-semibold text-[10px] uppercase transition-all flex items-center justify-center gap-2",
                                            (field.value || 'questions') === 'questions' ? "bg-primary text-white shadow-md" : "text-muted-foreground opacity-60 hover:opacity-100"
                                        )}
                                    >
                                        Capture from Questions
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => field.onChange('form')}
                                        className={cn(
                                            "h-9 rounded-lg font-semibold text-[10px] uppercase transition-all flex items-center justify-center gap-2",
                                            field.value === 'form' ? "bg-primary text-white shadow-md" : "text-muted-foreground opacity-60 hover:opacity-100"
                                        )}
                                    >
                                        Capture with Lead Form
                                    </button>
                                </div>
                            )}
                        />
                        <p className="text-[10px] text-muted-foreground font-medium leading-relaxed italic">
                            {(leadCaptureMode === 'questions') 
                              ? "Reads identity info from responses to selected survey questions. If contact does not provide email/phone, lead capture is skipped."
                              : "Displays a beautiful form asking for contact info after questions are submitted, but before results. Guarantees alert delivery."
                            }
                        </p>
                    </div>

                    <div className="h-px w-full bg-border" />

                    {leadCaptureMode === 'questions' ? (
                        /* Identity Mappings */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
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
                                            <Label className="text-sm font-semibold">Business/Entity Name Source</Label>
                                            <Select onValueChange={field.onChange} value={field.value || ''}>
                                                <SelectTrigger className="h-11 rounded-xl bg-card border border-border/50 shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-primary/30">
                                                    <SelectValue placeholder="Identify entity name source..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    {questions.map(q => (
                                                        <SelectItem key={q.id} value={q.id} className="font-medium text-[11px]">{q.title}</SelectItem>
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
                                            <Label className="text-sm font-semibold">Focal Person Name</Label>
                                            <Select onValueChange={field.onChange} value={field.value || ''}>
                                                <SelectTrigger className="h-11 rounded-xl bg-card border border-border/50 shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-primary/30">
                                                    <SelectValue placeholder="Identify focal person source..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    {questions.map(q => (
                                                        <SelectItem key={q.id} value={q.id} className="font-medium text-[11px]">{q.title}</SelectItem>
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
                                            <Label className="text-sm font-semibold">Communication Email</Label>
                                            <Select onValueChange={field.onChange} value={field.value || ''}>
                                                <SelectTrigger className="h-11 rounded-xl bg-card border border-border/50 shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-primary/30">
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
                                            <Label className="text-sm font-semibold">SMS/Direct Mobile</Label>
                                            <Select onValueChange={field.onChange} value={field.value || ''}>
                                                <SelectTrigger className="h-11 rounded-xl bg-card border border-border/50 shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-primary/30">
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
                    ) : (
                        /* Page Copy Config & Toggles */
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] font-bold uppercase tracking-tight">Page Presentation Copy</Badge>
                                    <div className="h-px flex-1 bg-border/40" />
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold">Lead Page Title</Label>
                                        <Controller
                                            name="leadCaptureTitle"
                                            control={control}
                                            render={({ field }) => (
                                                <Input {...field} placeholder="e.g. Claim Your Results" className="h-11 rounded-xl bg-card border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30" />
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold">Lead Page Description</Label>
                                        <Controller
                                            name="leadCaptureDescription"
                                            control={control}
                                            render={({ field }) => (
                                                <Textarea {...field} placeholder="Enter your contact details to save your response..." className="rounded-xl min-h-[80px] bg-card border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30" />
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="h-px w-full bg-border" />

                            <div className="space-y-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] font-bold uppercase tracking-tight">Lead Capture Form Fields</Badge>
                                    <div className="h-px flex-1 bg-border/40" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {['name', 'email', 'phone', 'company'].map((fKey) => (
                                        <div key={fKey} className="p-4 rounded-2xl bg-muted/10 border border-border/40 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold capitalize">{fKey} Field</span>
                                                <Controller
                                                    name={`leadCaptureFieldsConfig.${fKey}.show`}
                                                    control={control}
                                                    render={({ field }) => (
                                                        <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                                                    )}
                                                />
                                            </div>
                                            {watch(`leadCaptureFieldsConfig.${fKey}.show`) && (
                                                <div className="space-y-3 pt-2 border-t border-border/40 animate-in fade-in duration-200">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Field Label</Label>
                                                        <Controller
                                                            name={`leadCaptureFieldsConfig.${fKey}.label`}
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Input {...field} className="h-9 text-xs rounded-lg bg-card" />
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-[10px] font-bold text-muted-foreground">Required</Label>
                                                        <Controller
                                                            name={`leadCaptureFieldsConfig.${fKey}.required`}
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Switch checked={!!field.value} onCheckedChange={field.onChange} className="scale-90" />
                                                            )}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="h-px w-full bg-border" />

                    {/* Question Mappings List */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 mb-4">
                            <Badge variant="outline" className="bg-indigo-500/5 text-indigo-600 border-indigo-500/20 text-[9px] font-bold uppercase tracking-widest">Question To CRM Property Mappings (Merged into lead)</Badge>
                            <div className="h-px flex-1 bg-border/40" />
                        </div>

                        {questions.length > 0 ? (
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                                {questions.map((q) => {
                                    const mappedVal: string = additionalMappings.find((m) => m.questionId === q.id)?.targetField || 'none';
                                    return (
                                        <div key={q.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-muted/20 border border-border/40 hover:border-primary/20 transition-all">
                                            <div className="flex-1 space-y-1">
                                                <span className="text-xs font-bold text-foreground">{q.title}</span>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="text-[9px] font-bold uppercase py-0 px-1 bg-muted/60">{q.type}</Badge>
                                                    {q.isRequired && <Badge variant="destructive" className="text-[8px] font-bold uppercase py-0 px-1">Required</Badge>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 min-w-[250px]">
                                                <SearchableSelect 
                                                    value={mappedVal}
                                                    onSelect={(val: string) => handleMapQuestion(q.id, val)}
                                                    options={groupedTargetFields}
                                                    placeholder="Do not map (Skip)"
                                                />
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-11 w-11 rounded-xl bg-background border border-border hover:bg-primary/5 hover:text-primary transition-all shrink-0"
                                                    onClick={() => {
                                                        setActiveQuestionIdForNewField(q.id);
                                                        setIsCreateFieldOpen(true);
                                                    }}
                                                    title="Create new field"
                                                >
                                                    <PlusCircle className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-12 flex flex-col items-center justify-center bg-muted/10 rounded-3xl border border-dashed border-border/60">
                                <ListTree className="h-10 w-10 text-muted-foreground/20 mb-3" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">No survey questions defined yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Field Creation Dialog */}
            <CreateFieldDialog 
                open={isCreateFieldOpen} 
                onOpenChange={setIsCreateFieldOpen} 
                onSubmit={handleCreateField} 
                isSubmitting={isSubmitting} 
                fieldGroups={fieldGroups || []}
            />
        </div>
    );
}

// Searchable Select Helper
function SearchableSelect({ 
    value, 
    onSelect, 
    options, 
    placeholder = "Search...", 
    triggerClassName = ""
}: SearchableSelectProps) {
    const [open, setOpen] = React.useState<boolean>(false);
    const allOptions = options.flatMap((g) => g.options);
    const selectedOpt = allOptions.find((o) => o.value === value);
    
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between h-11 rounded-xl bg-background border border-border px-4 text-[11px] font-bold shadow-none hover:bg-muted/10 transition-all", triggerClassName)}
                >
                    <span className="truncate">{value && value !== 'none' ? (selectedOpt?.label || value) : placeholder}</span>
                    <Search className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 rounded-xl border-none shadow-2xl bg-popover ring-1 ring-border" align="start" sideOffset={8}>
                <Command className="rounded-xl bg-transparent">
                    <CommandInput placeholder={placeholder} className="h-10 border-none focus:ring-0 text-[11px] font-bold" autoFocus />
                    <CommandList className="max-h-[300px] overflow-y-auto no-scrollbar">
                        <CommandEmpty className="py-6 text-center text-[10px] font-bold text-muted-foreground/50 italic">No results found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="none"
                                onSelect={() => {
                                    onSelect('none');
                                    setOpen(false);
                                }}
                                className="text-[11px] font-bold py-2.5 px-4 cursor-pointer hover:bg-primary/5 aria-selected:bg-primary/10 transition-colors"
                            >
                                <Check className={cn("mr-2 h-3 w-3 text-primary", value === 'none' || !value ? "opacity-100" : "opacity-0")} />
                                Do not map (Skip)
                            </CommandItem>
                        </CommandGroup>
                        <div className="h-px bg-border opacity-50" />
                        {options.map((group) => (
                            <React.Fragment key={group.label}>
                                <div className="px-4 py-2 text-[9px] uppercase tracking-widest font-black text-primary/40 bg-muted/5 select-none">
                                    {group.label}
                                </div>
                                <CommandGroup>
                                    {group.options.map((opt) => (
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
                                <div className="h-px bg-border opacity-50" />
                            </React.Fragment>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function CreateFieldDialog({ open, onOpenChange, onSubmit, isSubmitting, fieldGroups }: CreateFieldDialogProps) {
    const [label, setLabel] = React.useState<string>('');
    const [variableName, setVariableName] = React.useState<string>('');
    const [selectedGroupId, setSelectedGroupId] = React.useState<string>('');
    const [newGroupName, setNewGroupName] = React.useState<string>('');
    const [showNewGroupInput, setShowNewGroupInput] = React.useState<boolean>(false);
    
    const handleLabelChange = (val: string) => {
        setLabel(val);
        setVariableName(val.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, ''));
    };

    React.useEffect(() => {
        if (fieldGroups && fieldGroups.length > 0 && !selectedGroupId) {
            const defaultGroup = fieldGroups.find(g => g.slug === 'custom' || g.isSystem) || fieldGroups[0];
            if (defaultGroup) {
                setSelectedGroupId(defaultGroup.id);
            }
        }
    }, [fieldGroups, selectedGroupId]);

    const handleConfirm = () => {
        onSubmit({ 
            label, 
            variableName, 
            groupId: showNewGroupInput ? undefined : selectedGroupId, 
            newGroupName: showNewGroupInput ? newGroupName : undefined 
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-[2.5rem] max-w-sm border-none shadow-2xl ring-1 ring-border bg-card">
                <DialogHeader className="pt-6 px-4 text-left">
                    <DialogTitle className="font-black text-2xl tracking-tighter flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-xl"><Plus className="h-5 w-5 text-indigo-600" /></div>
                        Create Custom Field
                    </DialogTitle>
                    <DialogDescription className="text-[11px] font-bold text-muted-foreground/60 leading-relaxed italic">Extend your workspace schema with a new property.</DialogDescription>
                </DialogHeader>
                <div className="p-6 space-y-6 text-left">
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
                    
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Add to Group</Label>
                        <Select 
                            value={showNewGroupInput ? 'create_new' : selectedGroupId}
                            onValueChange={(val) => {
                                if (val === 'create_new') {
                                    setShowNewGroupInput(true);
                                } else {
                                    setShowNewGroupInput(false);
                                    setSelectedGroupId(val);
                                }
                            }}
                        >
                            <SelectTrigger className="h-12 rounded-2xl border-none bg-muted/20 px-5 font-bold shadow-inner text-left text-foreground">
                                <SelectValue placeholder="Select group..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-border bg-card">
                                {fieldGroups.map(group => (
                                    <SelectItem key={group.id} value={group.id} className="font-bold text-xs">
                                        {group.name}
                                    </SelectItem>
                                ))}
                                <SelectItem value="create_new" className="font-black text-xs text-indigo-600 focus:text-indigo-700">
                                    + Create New Group...
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {showNewGroupInput && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">New Group Name</Label>
                            <Input 
                                value={newGroupName} 
                                onChange={e => setNewGroupName(e.target.value)} 
                                placeholder="e.g. Enrollment Metrics" 
                                className="h-12 rounded-2xl border-none bg-muted/20 px-5 font-bold shadow-inner"
                            />
                        </div>
                    )}
                </div>
                <DialogFooter className="p-6 pt-0">
                    <Button 
                        onClick={handleConfirm} 
                        disabled={isSubmitting || !label || (showNewGroupInput && !newGroupName.trim())} 
                        className="w-full h-14 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        {isSubmitting ? 'Committing...' : 'Commit to Schema'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

'use client';

import * as React from 'react';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useSearchParams } from 'next/navigation';
import type { Workspace, WorkspaceStatus, IndustryVertical, ContactIdentifierPolicy, EntityDefaults } from '@/lib/types';
import { 
    Zap, 
    Plus, 
    Trash2, 
    Pencil, 
    ShieldCheck, 
    Loader2, 
    Archive, 
    Settings2, 
    Info,
    X,
    Layout,
    Check,
    PlusCircle,
    Palette,
    Lock,
    Building2,
    Users,
    User,
    Briefcase,
    Home,
    Scale,
    Megaphone,
    Filter,
    Phone,
    Mail,
    Smartphone,
    MailCheck,
    Shield,
    Eye,
    Trash2 as TrashIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { saveWorkspaceAction, deleteWorkspaceAction, archiveWorkspaceAction } from '@/lib/workspace-actions';
import { cn } from '@/lib/utils';
import { ONBOARDING_STAGE_COLORS } from '@/lib/colors';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { setOrganizationDefaultWorkspaceAction } from '@/lib/organization-actions';
import { INDUSTRY_CONFIG, getEnabledIndustries } from '@/lib/industry-config';
import { INDUSTRY_METADATA } from '@/lib/industry-field-registry';
import * as Icons from 'lucide-react';

export default function WorkspaceEditor() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const { activeOrganizationId, activeOrganization } = useTenant();
    
    const searchParams = useSearchParams();
    const targetWorkspaceId = searchParams.get('workspaceId');
    const hasAutoOpenedRef = React.useRef<string | null>(null);
    
    const [isEditing, setIsEditing] = React.useState(false);
    const [activeWorkspace, setActiveWorkspace] = React.useState<Workspace | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);

    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [color, setColor] = React.useState('#3B5FFF');
    const [statuses, setStatuses] = React.useState<WorkspaceStatus[]>([]);
    const [contactScope, setContactScope] = React.useState<'institution' | 'family' | 'person'>('institution');
    const [singularTerm, setSingularTerm] = React.useState('');
    const [pluralTerm, setPluralTerm] = React.useState('');
    const [industry, setIndustry] = React.useState<IndustryVertical>('SaaS');
    const [industryFilter, setIndustryFilter] = React.useState<IndustryVertical | 'all'>('all');
    const [contactPolicySetting, setContactPolicySetting] = React.useState<ContactIdentifierPolicy>('phone_or_email');
    const [entityDefaults, setEntityDefaults] = React.useState<EntityDefaults>({});
    const [restrictVisibilityToAssigned, setRestrictVisibilityToAssigned] = React.useState(true);
    const [newDefaultKey, setNewDefaultKey] = React.useState('');
    const [newDefaultValue, setNewDefaultValue] = React.useState('');

    // Get enabled industries from feature flags
    const enabledIndustries = React.useMemo(() => getEnabledIndustries(), []);

    // Helper function to get industry icon
    const getIndustryIcon = (industryType: IndustryVertical) => {
        const meta = INDUSTRY_METADATA[industryType];
        const IconName = meta?.icon || 'Building2';
        return (Icons as any)[IconName] || Icons.Building2;
    };

    // Helper function to get industry display name
    const getIndustryDisplayName = (industryType: IndustryVertical) => {
        return INDUSTRY_METADATA[industryType]?.name || industryType;
    };

    // Helper function to get industry description
    const getIndustryDescription = (industryType: IndustryVertical) => {
        return INDUSTRY_METADATA[industryType]?.description || '';
    };

    // Filter workspaces by current organization
    const workspacesQuery = useMemoFirebase(() => 
        firestore && activeOrganizationId 
            ? query(
                collection(firestore, 'workspaces'), 
                where('organizationId', '==', activeOrganizationId),
                orderBy('createdAt', 'asc')
            ) 
            : null, 
    [firestore, activeOrganizationId]);
    const { data: workspaces, isLoading } = useCollection<Workspace>(workspacesQuery);

    const handleOpenEdit = (w?: Workspace) => {
        if (w) {
            setActiveWorkspace(w);
            setName(w.name);
            setDescription(w.description || '');
            setColor(w.color || '#3B5FFF');
            setStatuses(w.statuses || []);
            setContactScope(w.contactScope || 'institution');
            setSingularTerm(w.terminology?.singular || '');
            setPluralTerm(w.terminology?.plural || '');
            setIndustry(w.industry || 'SaaS');
            setContactPolicySetting(w.contactPolicy || 'phone_or_email');
            setEntityDefaults(w.entityDefaults || {});
            setRestrictVisibilityToAssigned(w.restrictVisibilityToAssigned !== false);
        } else {
            setActiveWorkspace(null);
            setName('');
            setDescription('');
            setColor('#3B5FFF');
            setStatuses([
                { value: 'Onboarding', label: 'Onboarding', color: '#3B5FFF' },
                { value: 'Active', label: 'Active', color: '#10b981' },
                { value: 'Churned', label: 'Churned', color: '#ef4444' }
            ]);
            setContactScope('institution');
            setSingularTerm('');
            setPluralTerm('');
            setIndustry('SaaS');
            setContactPolicySetting('phone_or_email');
            setEntityDefaults({});
            setRestrictVisibilityToAssigned(true);
        }
        setIsEditing(true);
    };

    React.useEffect(() => {
        if (workspaces && targetWorkspaceId && hasAutoOpenedRef.current !== targetWorkspaceId) {
            const found = workspaces.find(w => w.id === targetWorkspaceId);
            if (found) {
                hasAutoOpenedRef.current = targetWorkspaceId;
                handleOpenEdit(found);
            }
        }
    }, [workspaces, targetWorkspaceId]);

    const handleAddStatus = () => {
        setStatuses(prev => [...prev, { value: 'New Status', label: 'New Status', color: '#64748b' }]);
    };

    const updateStatus = (index: number, updates: Partial<WorkspaceStatus>) => {
        const next = [...statuses];
        next[index] = { ...next[index], ...updates };
        setStatuses(next);
    };

    const removeStatus = (index: number) => {
        if (statuses.length === 1) return;
        setStatuses(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !name.trim() || !activeOrganizationId) return;

        // Show confirmation dialog for new workspaces
        if (!activeWorkspace) {
            setShowConfirmDialog(true);
            return;
        }

        // Proceed with save for existing workspaces
        await performSave();
    };

    const performSave = async () => {
        if (!user || !name.trim() || !activeOrganizationId) return;
        setIsSaving(true);

        const result = await saveWorkspaceAction(
            activeWorkspace?.id || null,
            { 
                name: name.trim(), 
                description: description.trim(), 
                color, 
                statuses,
                organizationId: activeWorkspace?.organizationId || activeOrganizationId,
                contactScope: activeWorkspace ? undefined : contactScope,
                capabilities: activeWorkspace ? undefined : getDefaultCapabilities(contactScope),
                terminology: (singularTerm.trim() && pluralTerm.trim()) ? {
                    singular: singularTerm.trim(),
                    plural: pluralTerm.trim()
                } : undefined,
                industry: activeWorkspace ? undefined : industry, // Only set on creation
                industryScopeLocked: false, // Will be locked after first entity link
                contactPolicy: contactPolicySetting,
                entityDefaults: entityDefaults,
                restrictVisibilityToAssigned: restrictVisibilityToAssigned,
            },
            user.uid
        );

        if (result.success) {
            toast({ title: 'Workspace Updated', description: 'Workspace saved successfully.' });
            setIsEditing(false);
            setShowConfirmDialog(false);
        } else {
            toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
        }
        setIsSaving(false);
    };

    const getDefaultCapabilities = (scope: 'institution' | 'family' | 'person') => {
        switch (scope) {
            case 'institution':
                return {
                    billing: true,
                    admissions: false,
                    children: false,
                    contracts: true,
                    messaging: true,
                    automations: true,
                    tasks: true
                };
            case 'family':
                return {
                    billing: false,
                    admissions: true,
                    children: true,
                    contracts: false,
                    messaging: true,
                    automations: true,
                    tasks: true
                };
            case 'person':
                return {
                    billing: false,
                    admissions: false,
                    children: false,
                    contracts: false,
                    messaging: true,
                    automations: true,
                    tasks: true
                };
        }
    };

    const handleDelete = async (w: Workspace) => {
        if (!user) return;
        const result = await deleteWorkspaceAction(w.id, user.uid);
        
        if (result.success) {
            toast({ title: 'Workspace Purged' });
        } else {
            toast({ 
                variant: 'destructive', 
                title: 'Constraint Alert', 
                description: result.error 
            });
        }
    };

    const handleArchive = async (w: Workspace) => {
        const result = await archiveWorkspaceAction(w.id, w.status === 'active');
        if (result.success) {
            toast({ title: w.status === 'active' ? 'Workspace Archived' : 'Workspace Restored' });
        }
    };

    const handleSetDefault = async (workspaceId: string) => {
        if (!user || !activeOrganizationId) return;
        const result = await setOrganizationDefaultWorkspaceAction(activeOrganizationId, workspaceId, user.uid);
        if (result.success) {
            toast({ title: 'Default Workspace Updated' });
        } else {
            toast({ variant: 'destructive', title: 'Action Failed', description: result.error });
        }
    };

    return (
        <>
 <div className="space-y-6">
 <div className="flex items-center justify-between px-1">
 <div className="text-left">
 <h3 className="text-xl font-semibold tracking-tight text-foreground">Workspace Architect</h3>
 <p className="text-sm text-muted-foreground font-medium">
 Manage workspaces for <span className="font-bold text-primary">{activeOrganization?.name || 'current organization'}</span>
                    </p>
                </div>
                <Button 
                    onClick={() => handleOpenEdit()} 
 className="rounded-xl font-semibold h-11 px-6 shadow-lg gap-2"
                    disabled={!activeOrganizationId}
                >
 <Plus className="h-4 w-4" /> New Workspace
                </Button>
            </div>

            {/* Industry Filter */}
            <div className="flex items-center gap-3 px-1">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-xs font-semibold text-muted-foreground">Filter by Industry:</Label>
                </div>
                <Select value={industryFilter} onValueChange={(value) => setIndustryFilter(value as IndustryVertical | 'all')}>
                    <SelectTrigger className="w-[200px] h-9 rounded-xl">
                        <SelectValue placeholder="All Industries" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Industries</SelectItem>
                        {enabledIndustries.map((ind) => {
                            const Icon = getIndustryIcon(ind);
                            return (
                                <SelectItem key={ind} value={ind}>
                                    <div className="flex items-center gap-2">
                                        <Icon className="h-3.5 w-3.5" />
                                        <span>{getIndustryDisplayName(ind)}</span>
                                    </div>
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>
            </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
 Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)
                ) : workspaces
                    ?.filter((w) => industryFilter === 'all' || w.industry === industryFilter)
                    .map(w => {
                        const IndustryIcon = getIndustryIcon(w.industry || 'SaaS');
                        return (
 <Card key={w.id} className={cn(
                        "rounded-2xl border border-border bg-card text-left group transition-all duration-500",
                        w.status === 'archived' ? "opacity-50 grayscale" : "ring-border hover:ring-primary/20 hover:shadow-xl"
                    )}>
 <div className="h-1.5 w-full" style={{ backgroundColor: w.color || '#3B5FFF' }} />
 <CardHeader className="p-6 pb-4 flex flex-row items-center justify-between">
 <div className="min-w-0">
 <CardTitle className="text-base font-semibold tracking-tight truncate">{w.name}</CardTitle>
 <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <Badge variant="secondary" className="text-[8px] font-semibold uppercase px-1.5 h-4">{w.statuses?.length || 0} Statuses</Badge>
                                    {/* Industry Badge */}
                                    <Badge variant="outline" className="text-[8px] font-semibold uppercase px-1.5 h-4 flex items-center gap-1">
                                        <IndustryIcon className="h-2.5 w-2.5" />
                                        {getIndustryDisplayName(w.industry || 'SaaS')}
                                    </Badge>
                                    {w.contactScope && (
                                        <Badge variant="outline" className="text-[8px] font-semibold uppercase px-1.5 h-4 flex items-center gap-1">
 {w.contactScope === 'institution' && <Building2 className="h-2.5 w-2.5" />}
 {w.contactScope === 'family' && <Users className="h-2.5 w-2.5" />}
 {w.contactScope === 'person' && <User className="h-2.5 w-2.5" />}
                                            {w.terminology?.plural || (w.contactScope === 'institution' ? 'Institutions' : w.contactScope === 'family' ? 'Families' : 'People')}
                                        </Badge>
                                    )}
                                    {w.industryScopeLocked && (
 <Lock className="h-3 w-3 text-muted-foreground" />
                                    )}
                                </div>
                            </div>
 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleOpenEdit(w)}>
 <Pencil className="h-4 w-4 text-primary" />
                                </Button>
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleArchive(w)}>
 <Archive className="h-4 w-4 text-orange-600" />
                                </Button>
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => handleDelete(w)}>
 <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
 <CardContent className="p-6 pt-0 space-y-4">
 <p className="text-xs font-medium text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.5rem]">{w.description || 'No description provided.'}</p>
                            
 <div className="flex items-center justify-between pt-2">
 <div className="flex items-center gap-2">
                                    <Badge variant={w.status === 'active' ? 'default' : 'outline'} className="text-[8px] font-semibold uppercase px-2 h-5">
                                        {w.status}
                                    </Badge>
                                    {activeOrganization?.defaultWorkspaceId === w.id ? (
                                        <Badge className="text-[8px] font-semibold uppercase px-2 h-5 bg-orange-500 hover:bg-orange-600 text-white border-none shadow-sm flex items-center gap-1">
 <ShieldCheck className="h-2.5 w-2.5" />
                                            Default
                                        </Badge>
                                    ) : (
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
 className="h-5 rounded-md px-1.5 text-[8px] font-semibold bg-background0 hover:bg-primary hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                            onClick={() => handleSetDefault(w.id)}
                                        >
                                            Set as Default
                                        </Button>
                                    )}
                                </div>
 <span className="text-[9px] font-bold text-muted-foreground/40 tabular-nums">Sync: {format(new Date(w.updatedAt), 'MMM d, HH:mm')}</span>
                            </div>
                        </CardContent>
                    </Card>
                        );
                    })}
            </div>
            </div>

            <Dialog open={isEditing} onOpenChange={setIsEditing}>
 <DialogContent className="sm:max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
 <form onSubmit={handleSave} className="flex flex-col h-full text-left">
 <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-primary text-white rounded-2xl shadow-xl">
 <Zap className="h-6 w-6" />
                                </div>
                                <div>
 <DialogTitle className="text-2xl font-semibold tracking-tight">
                                        {activeWorkspace ? 'Modify Hub' : 'New Workspace'}
                                    </DialogTitle>
 <DialogDescription className="text-xs font-bold text-muted-foreground">Architect a new hub identity and its independent lifecycle.</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

 <div className="flex-1 overflow-hidden relative bg-background">
 <ScrollArea className="h-full">
 <div className="p-8 space-y-10">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 <div className="space-y-6">
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Workspace Label</Label>
                                                <Input 
                                                    value={name} 
                                                    onChange={e => setName(e.target.value)} 
                                                    placeholder="e.g. Higher Education Onboarding" 
 className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold text-lg px-4" 
                                                    required 
                                                />
                                            </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Theme (Color)</Label>
 <div className="flex gap-3">
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <button 
                                                                type="button" 
 className="w-12 h-12 rounded-xl border-2 shadow-sm shrink-0" 
                                                                style={{ backgroundColor: color, borderColor: color + '40' }} 
                                                            />
                                                        </PopoverTrigger>
 <PopoverContent className="w-auto p-3 rounded-2xl border-none shadow-2xl">
 <div className="grid grid-cols-6 gap-2">
                                                                {ONBOARDING_STAGE_COLORS.map(c => (
 <button key={c} type="button" onClick={() => setColor(c)} className="w-6 h-6 rounded-md shadow-sm" style={{ backgroundColor: c }} />
                                                                ))}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
 <Input value={color} onChange={e => setColor(e.target.value)} className="h-12 rounded-xl bg-muted/20 border-none font-mono font-semibold text-center " />
                                                </div>
                                            </div>
                                        </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Objective Brief</Label>
                                            <Textarea 
                                                value={description} 
                                                onChange={e => setDescription(e.target.value)} 
                                                placeholder="Define the scope..." 
 className="min-h-[135px] rounded-2xl bg-muted/20 border-none shadow-inner p-4 font-medium leading-relaxed" 
                                            />
                                        </div>
                                    </div>

                                    {/* INDUSTRY SELECTOR - Only show for new workspaces */}
                                    {!activeWorkspace && (
                                        <>
 <Separator className="opacity-50" />
                                            
 <div className="space-y-4">
 <div className="flex items-center gap-2 px-1">
 <Briefcase className="h-4 w-4 text-primary" />
 <h4 className="text-xs font-semibold ">Industry Vertical</h4>
                                                    <Badge variant="secondary" className="text-[8px] font-semibold uppercase px-1.5 h-4">Required</Badge>
                                                </div>

 <p className="text-[10px] font-medium text-muted-foreground leading-relaxed px-1">
                                                    Select the industry vertical for this workspace. This determines available features, terminology, and pipeline templates.
                                                </p>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {enabledIndustries.map((ind) => {
                                                        const Icon = getIndustryIcon(ind);
                                                        return (
                                                            <button
                                                                key={ind}
                                                                type="button"
                                                                onClick={() => setIndustry(ind)}
 className={cn(
                                                                    "p-5 rounded-2xl border-2 transition-all text-left group hover:shadow-lg",
                                                                    industry === ind
                                                                        ? "bg-primary/5 border-primary shadow-md"
                                                                        : "bg-background border-border hover:border-primary/30"
                                                                )}
                                                            >
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <div className={cn(
                                                                            "p-2 rounded-lg transition-colors",
                                                                            industry === ind ? "bg-primary/10" : "bg-muted"
                                                                        )}>
 <Icon className={cn(
                                                                                "h-5 w-5",
                                                                                industry === ind ? "text-primary" : "text-muted-foreground"
                                                                            )} />
                                                                        </div>
                                                                        {industry === ind && (
 <Check className="h-5 w-5 text-primary" />
                                                                        )}
                                                                    </div>
 <div className="space-y-1">
 <h5 className="text-sm font-semibold text-foreground">{getIndustryDisplayName(ind)}</h5>
 <p className="text-[9px] font-medium text-muted-foreground leading-relaxed">
                                                                            {getIndustryDescription(ind)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>

 <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
 <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
 <div className="space-y-1">
 <p className="text-[10px] font-semibold text-blue-900 ">Industry Scope Lock</p>
 <p className="text-[9px] font-medium text-blue-800/70 leading-relaxed">
                                                            Industry vertical cannot be changed after the first entity is linked to this workspace. This ensures data consistency and feature compatibility.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* CONTACT SCOPE SELECTOR - Only show for new workspaces */}
                                    {!activeWorkspace && (
                                        <>
 <Separator className="opacity-50" />
                                            
 <div className="space-y-4">
 <div className="flex items-center gap-2 px-1">
 <Layout className="h-4 w-4 text-primary" />
 <h4 className="text-xs font-semibold ">Contact Scope</h4>
                                                    <Badge variant="secondary" className="text-[8px] font-semibold uppercase px-1.5 h-4">Required</Badge>
                                                </div>

 <p className="text-[10px] font-medium text-muted-foreground leading-relaxed px-1">
                                                    Select the type of contacts this workspace will manage. This determines the data model, UI, and workflows.
                                                </p>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => setContactScope('institution')}
 className={cn(
                                                            "p-5 rounded-2xl border-2 transition-all text-left group hover:shadow-lg",
                                                            contactScope === 'institution'
                                                                ? "bg-primary/5 border-primary shadow-md"
                                                                : "bg-background border-border hover:border-primary/30"
                                                        )}
                                                    >
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <div className={cn(
                                                                    "p-2 rounded-lg transition-colors",
                                                                    contactScope === 'institution' ? "bg-primary/10" : "bg-muted"
                                                                )}>
 <Building2 className={cn(
                                                                        "h-5 w-5",
                                                                        contactScope === 'institution' ? "text-primary" : "text-muted-foreground"
                                                                    )} />
                                                                </div>
                                                                {contactScope === 'institution' && (
 <Check className="h-5 w-5 text-primary" />
                                                                )}
                                                            </div>
 <div className="space-y-1">
 <h5 className="text-sm font-semibold text-foreground">Schools</h5>
 <p className="text-[9px] font-medium text-muted-foreground leading-relaxed">
                                                                    Institutional contacts with billing, contracts, and subscription management.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => setContactScope('family')}
 className={cn(
                                                            "p-5 rounded-2xl border-2 transition-all text-left group hover:shadow-lg",
                                                            contactScope === 'family'
                                                                ? "bg-primary/5 border-primary shadow-md"
                                                                : "bg-background border-border hover:border-primary/30"
                                                        )}
                                                    >
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <div className={cn(
                                                                    "p-2 rounded-lg transition-colors",
                                                                    contactScope === 'family' ? "bg-primary/10" : "bg-muted"
                                                                )}>
 <Users className={cn(
                                                                        "h-5 w-5",
                                                                        contactScope === 'family' ? "text-primary" : "text-muted-foreground"
                                                                    )} />
                                                                </div>
                                                                {contactScope === 'family' && (
 <Check className="h-5 w-5 text-primary" />
                                                                )}
                                                            </div>
 <div className="space-y-1">
 <h5 className="text-sm font-semibold text-foreground">Families</h5>
 <p className="text-[9px] font-medium text-muted-foreground leading-relaxed">
                                                                    Family contacts with guardians, children, and admissions workflows.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => setContactScope('person')}
 className={cn(
                                                            "p-5 rounded-2xl border-2 transition-all text-left group hover:shadow-lg",
                                                            contactScope === 'person'
                                                                ? "bg-primary/5 border-primary shadow-md"
                                                                : "bg-background border-border hover:border-primary/30"
                                                        )}
                                                    >
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <div className={cn(
                                                                    "p-2 rounded-lg transition-colors",
                                                                    contactScope === 'person' ? "bg-primary/10" : "bg-muted"
                                                                )}>
 <User className={cn(
                                                                        "h-5 w-5",
                                                                        contactScope === 'person' ? "text-primary" : "text-muted-foreground"
                                                                    )} />
                                                                </div>
                                                                {contactScope === 'person' && (
 <Check className="h-5 w-5 text-primary" />
                                                                )}
                                                            </div>
 <div className="space-y-1">
 <h5 className="text-sm font-semibold text-foreground">People</h5>
 <p className="text-[9px] font-medium text-muted-foreground leading-relaxed">
                                                                    Individual contacts with personal CRM and lead management.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                </div>

 <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
 <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
 <div className="space-y-1">
 <p className="text-[10px] font-semibold text-blue-900 ">Scope Selection</p>
 <p className="text-[9px] font-medium text-blue-800/70 leading-relaxed">
                                                            Contact scope cannot be changed after the first entity is linked to this workspace. Choose carefully based on your workflow needs.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

 <Separator className="opacity-50" />

                                    {/* INDUSTRY DISPLAY - Show for existing workspaces */}
                                    {activeWorkspace?.industry && (
                                        <>
 <div className="space-y-4">
 <div className="flex items-center justify-between px-1">
 <div className="flex items-center gap-2">
                                                        {(() => {
                                                            const Icon = getIndustryIcon(activeWorkspace.industry);
                                                            return <Icon className="h-4 w-4 text-primary" />;
                                                        })()}
 <h4 className="text-xs font-semibold ">Industry Vertical</h4>
                                                    </div>
                                                    {activeWorkspace.industryScopeLocked && (
 <div className="flex items-center gap-1.5 text-muted-foreground">
 <Lock className="h-3.5 w-3.5" />
 <span className="text-[9px] font-bold tracking-wider">Locked</span>
                                                        </div>
                                                    )}
                                                </div>

 <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 flex items-start gap-4">
 <div className="p-2 bg-primary/10 rounded-lg">
                                                        {(() => {
                                                            const Icon = getIndustryIcon(activeWorkspace.industry);
                                                            return <Icon className="h-5 w-5 text-primary" />;
                                                        })()}
                                                    </div>
 <div className="space-y-1 flex-1">
 <p className="text-sm font-semibold text-foreground">
                                                            This workspace is configured for{' '}
 <span className="text-primary">
                                                                {getIndustryDisplayName(activeWorkspace.industry)}
                                                            </span>
                                                        </p>
 <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
                                                            {getIndustryDescription(activeWorkspace.industry)}
                                                        </p>
                                                    </div>
                                                </div>

                                                {activeWorkspace.industryScopeLocked && (
 <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
 <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
 <div className="space-y-1">
 <p className="text-[10px] font-semibold text-amber-900 ">Industry Locked</p>
 <p className="text-[9px] font-medium text-amber-800/70 leading-relaxed">
                                                                Industry vertical cannot be changed after entities have been linked to this workspace. This ensures feature compatibility and data consistency.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

 <Separator className="opacity-50" />
                                        </>
                                    )}

                                    {/* CONTACT SCOPE DISPLAY */}
                                    {activeWorkspace?.contactScope && (
                                        <>
 <div className="space-y-4">
 <div className="flex items-center justify-between px-1">
 <div className="flex items-center gap-2">
 {activeWorkspace.contactScope === 'institution' && <Building2 className="h-4 w-4 text-primary" />}
 {activeWorkspace.contactScope === 'family' && <Users className="h-4 w-4 text-primary" />}
 {activeWorkspace.contactScope === 'person' && <User className="h-4 w-4 text-primary" />}
 <h4 className="text-xs font-semibold ">Contact Scope</h4>
                                                    </div>
                                                    {activeWorkspace.scopeLocked && (
 <div className="flex items-center gap-1.5 text-muted-foreground">
 <Lock className="h-3.5 w-3.5" />
 <span className="text-[9px] font-bold tracking-wider">Locked</span>
                                                        </div>
                                                    )}
                                                </div>

 <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 flex items-start gap-4">
 <div className="p-2 bg-primary/10 rounded-lg">
 {activeWorkspace.contactScope === 'institution' && <Building2 className="h-5 w-5 text-primary" />}
 {activeWorkspace.contactScope === 'family' && <Users className="h-5 w-5 text-primary" />}
 {activeWorkspace.contactScope === 'person' && <User className="h-5 w-5 text-primary" />}
                                                    </div>
 <div className="space-y-1 flex-1">
 <p className="text-sm font-semibold text-foreground">
                                                            This workspace manages{' '}
 <span className="text-primary">
                                                                {activeWorkspace.contactScope === 'institution' ? 'Schools' : 
                                                                 activeWorkspace.contactScope === 'family' ? 'Families' : 'People'}
                                                            </span>
                                                        </p>
 <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
                                                            {activeWorkspace.contactScope === 'institution' && 'Institutional contacts with billing, contracts, and subscription management.'}
                                                            {activeWorkspace.contactScope === 'family' && 'Family contacts with guardians, children, and admissions workflows.'}
                                                            {activeWorkspace.contactScope === 'person' && 'Individual contacts with personal CRM and lead management.'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {activeWorkspace.scopeLocked && (
 <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
 <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
 <div className="space-y-1">
 <p className="text-[10px] font-semibold text-amber-900 ">Scope Locked</p>
 <p className="text-[9px] font-medium text-amber-800/70 leading-relaxed">
                                                                Contact scope cannot be changed after entities have been linked to this workspace. This protects existing data integrity.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

 <Separator className="opacity-50" />
                                        </>
                                    )}

                                    {/* CAPABILITIES TOGGLES */}
                                    {activeWorkspace?.capabilities && (
                                        <>
 <div className="space-y-4">
 <div className="flex items-center gap-2 px-1">
 <Settings2 className="h-4 w-4 text-primary" />
 <h4 className="text-xs font-semibold ">Workspace Capabilities</h4>
                                                </div>

 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                    {Object.entries(activeWorkspace.capabilities).map(([key, enabled]) => (
                                                        <div 
                                                            key={key}
 className={cn(
                                                                "p-3 rounded-xl border-2 transition-all",
                                                                enabled 
                                                                    ? "bg-primary/5 border-primary/30" 
                                                                    : "bg-muted/20 border-border opacity-50"
                                                            )}
                                                        >
 <div className="flex items-center gap-2">
                                                                {enabled ? (
 <Check className="h-3.5 w-3.5 text-primary" />
                                                                ) : (
 <X className="h-3.5 w-3.5 text-muted-foreground" />
                                                                )}
 <span className="text-[10px] font-semibold tracking-wider">
                                                                    {key}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

 <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
 <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
 <p className="text-[9px] font-medium text-blue-800/70 leading-relaxed">
                                                        Capabilities control which features are available in this workspace. These can be configured independently of the contact scope.
                                                    </p>
                                                </div>
                                            </div>
                                        </>
                                    )}

 <Separator className="opacity-50" />

                                    {/* CONTACT IDENTIFIER POLICY */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 px-1">
                                            <Smartphone className="h-4 w-4 text-primary" />
                                            <h4 className="text-xs font-semibold">Contact Identifier Policy</h4>
                                        </div>

                                        <p className="text-[10px] font-medium text-muted-foreground leading-relaxed px-1">
                                            Determines which identifiers are required to save an entity. Applied across bulk import, new entity page, and survey submissions.
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {([
                                                { value: 'phone_only' as const, icon: Phone, label: 'Phone Only', desc: 'Only phone number required — SMS-first workflows' },
                                                { value: 'email_only' as const, icon: Mail, label: 'Email Only', desc: 'Only email required — email-first campaigns' },
                                                { value: 'phone_or_email' as const, icon: MailCheck, label: 'Phone or Email', desc: 'Either phone or email acceptable (default)' },
                                            ]).map(({ value, icon: Icon, label, desc }) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => setContactPolicySetting(value)}
                                                    className={cn(
                                                        "p-4 rounded-2xl border-2 transition-all text-left hover:shadow-md",
                                                        contactPolicySetting === value
                                                            ? "bg-primary/5 border-primary shadow-sm"
                                                            : "bg-background border-border hover:border-primary/30"
                                                    )}
                                                >
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className={cn(
                                                                "p-1.5 rounded-lg transition-colors",
                                                                contactPolicySetting === value ? "bg-primary/10" : "bg-muted"
                                                            )}>
                                                                <Icon className={cn(
                                                                    "h-4 w-4",
                                                                    contactPolicySetting === value ? "text-primary" : "text-muted-foreground"
                                                                )} />
                                                            </div>
                                                            {contactPolicySetting === value && (
                                                                <Check className="h-4 w-4 text-primary" />
                                                            )}
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <h5 className="text-xs font-semibold text-foreground">{label}</h5>
                                                            <p className="text-[8px] font-medium text-muted-foreground leading-relaxed">{desc}</p>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <Separator className="opacity-50" />

                                    {/* ENTITY VISIBILITY BOUNDARIES */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 px-1">
                                            <Shield className="h-4 w-4 text-primary" />
                                            <h4 className="text-xs font-semibold">Entity Visibility Scope</h4>
                                        </div>

                                        <p className="text-[10px] font-medium text-muted-foreground leading-relaxed px-1">
                                            Determine whether users in this workspace can see all entities or only the ones explicitly assigned to them. By default, users see only their assigned entities.
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setRestrictVisibilityToAssigned(true)}
                                                className={cn(
                                                    "p-4 rounded-2xl border-2 transition-all text-left hover:shadow-md",
                                                    restrictVisibilityToAssigned
                                                        ? "bg-primary/5 border-primary shadow-sm"
                                                        : "bg-background border-border hover:border-primary/30"
                                                )}
                                            >
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className={cn(
                                                            "p-1.5 rounded-lg transition-colors",
                                                            restrictVisibilityToAssigned ? "bg-primary/10" : "bg-muted"
                                                        )}>
                                                            <Lock className="h-4 w-4" style={{ color: restrictVisibilityToAssigned ? 'var(--primary)' : 'var(--muted-foreground)' }} />
                                                        </div>
                                                        {restrictVisibilityToAssigned && (
                                                            <Check className="h-4 w-4 text-primary" />
                                                        )}
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <h5 className="text-xs font-semibold text-foreground">Assigned Only (Default)</h5>
                                                        <p className="text-[8px] font-medium text-muted-foreground leading-relaxed">
                                                            Users can only view and interact with entities specifically assigned to them.
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setRestrictVisibilityToAssigned(false)}
                                                className={cn(
                                                    "p-4 rounded-2xl border-2 transition-all text-left hover:shadow-md",
                                                    !restrictVisibilityToAssigned
                                                        ? "bg-primary/5 border-primary shadow-sm"
                                                        : "bg-background border-border hover:border-primary/30"
                                                )}
                                            >
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className={cn(
                                                            "p-1.5 rounded-lg transition-colors",
                                                            !restrictVisibilityToAssigned ? "bg-primary/10" : "bg-muted"
                                                        )}>
                                                            <Eye className="h-4 w-4" style={{ color: !restrictVisibilityToAssigned ? 'var(--primary)' : 'var(--muted-foreground)' }} />
                                                        </div>
                                                        {!restrictVisibilityToAssigned && (
                                                            <Check className="h-4 w-4 text-primary" />
                                                        )}
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <h5 className="text-xs font-semibold text-foreground">All Entities</h5>
                                                        <p className="text-[8px] font-medium text-muted-foreground leading-relaxed">
                                                            Users can view and interact with all entities in the workspace.
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    </div>

                                    <Separator className="opacity-50" />

                                    {/* ENTITY DEFAULTS EDITOR */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 px-1">
                                            <Settings2 className="h-4 w-4 text-primary" />
                                            <h4 className="text-xs font-semibold">Entity Defaults</h4>
                                            <Badge variant="outline" className="text-[8px] font-semibold uppercase px-1.5 h-4 ml-auto">Per Workspace</Badge>
                                        </div>

                                        <p className="text-[10px] font-medium text-muted-foreground leading-relaxed px-1">
                                            Set default values applied when creating entities via import, new entity page, or survey submissions.
                                        </p>

                                        {(() => {
                                            const scope = (activeWorkspace?.contactScope || contactScope || 'institution') as 'institution' | 'family' | 'person';
                                            const currentDefaults = entityDefaults[scope] || {};
                                            const entries = Object.entries(currentDefaults);

                                            const updateDefault = (key: string, value: string) => {
                                                setEntityDefaults(prev => ({
                                                    ...prev,
                                                    [scope]: { ...(prev[scope] || {}), [key]: value }
                                                }));
                                            };

                                            const removeDefault = (key: string) => {
                                                setEntityDefaults(prev => {
                                                    const scopeDefaults = { ...(prev[scope] || {}) };
                                                    delete scopeDefaults[key];
                                                    return { ...prev, [scope]: scopeDefaults };
                                                });
                                            };

                                            const addDefault = () => {
                                                if (!newDefaultKey.trim() || newDefaultKey === '__custom') return;
                                                updateDefault(newDefaultKey.trim(), newDefaultValue.trim());
                                                setNewDefaultKey('');
                                                setNewDefaultValue('');
                                            };

                                            const SUGGESTED_KEYS: Record<string, string[]> = {
                                                institution: ['currency', 'lifecycleStatus', 'leadSource', 'billingAddress', 'subscriptionPackageName'],
                                                family: ['lifecycleStatus', 'leadSource', 'relationship'],
                                                person: ['jobTitle', 'leadSource', 'company', 'lifecycleStatus'],
                                            };
                                            const suggestedKeys = SUGGESTED_KEYS[scope] || [];
                                            const unusedSuggestions = suggestedKeys.filter(k => !(k in currentDefaults));

                                            return (
                                                <div className="space-y-3">
                                                    {entries.length > 0 && (
                                                        <div className="space-y-2">
                                                            {entries.map(([key, value]) => (
                                                                <div key={key} className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border group">
                                                                    <span className="text-[10px] font-bold text-primary min-w-[120px] truncate">{key}</span>
                                                                    <Input
                                                                        value={value}
                                                                        onChange={e => updateDefault(key, e.target.value)}
                                                                        className="h-8 rounded-lg bg-background border-none text-xs font-medium flex-1"
                                                                    />
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => removeDefault(key)}
                                                                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                                                    >
                                                                        <X size={14} />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        {unusedSuggestions.length > 0 ? (
                                                            <Select value={newDefaultKey} onValueChange={setNewDefaultKey}>
                                                                <SelectTrigger className="h-8 rounded-lg text-xs font-medium w-[160px]">
                                                                    <SelectValue placeholder="Select field..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {unusedSuggestions.map(k => (
                                                                        <SelectItem key={k} value={k} className="text-xs font-medium">{k}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <Input
                                                                value={newDefaultKey}
                                                                onChange={e => setNewDefaultKey(e.target.value)}
                                                                placeholder="Field name"
                                                                className="h-8 rounded-lg text-xs font-medium w-[160px]"
                                                            />
                                                        )}
                                                        <Input
                                                            value={newDefaultValue}
                                                            onChange={e => setNewDefaultValue(e.target.value)}
                                                            placeholder="Default value"
                                                            className="h-8 rounded-lg text-xs font-medium flex-1"
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={addDefault}
                                                            disabled={!newDefaultKey.trim() || newDefaultKey === '__custom'}
                                                            className="h-8 rounded-lg text-[10px] font-bold"
                                                        >
                                                            <Plus className="h-3 w-3 mr-1" /> Add
                                                        </Button>
                                                    </div>
                                                    {entries.length === 0 && (
                                                        <p className="text-[9px] font-medium text-muted-foreground italic text-center py-3">
                                                            No defaults configured. Add defaults above to auto-fill entity fields on creation.
                                                        </p>
                                                    )}
                                                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2">
                                                        <Info className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                                                        <p className="text-[8px] font-medium text-blue-800/70 leading-relaxed">
                                                            Priority: Entity data → Import step defaults → Workspace defaults → System defaults.
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

 <Separator className="opacity-50" />

                                    {/* TERMINOLOGY ARCHITECT */}
 <div className="space-y-6">
 <div className="flex items-center gap-2 px-1">
 <Palette className="h-4 w-4 text-primary" />
 <h4 className="text-xs font-semibold ">Terminology Architect</h4>
                                            <Badge variant="outline" className="text-[8px] font-semibold uppercase px-1.5 h-4 ml-auto">Visual Logic</Badge>
                                        </div>

 <p className="text-[10px] font-medium text-muted-foreground leading-relaxed px-1">
                                            Customize how entities are identified in this workspace. Labels will appear across navigation, forms, and reports. 
 Leaving these blank will use default labels (<span className="text-primary font-bold">Institution, Family, or Person</span>).
                                        </p>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Singular Label</Label>
                                                <Input 
                                                    value={singularTerm} 
                                                    onChange={e => setSingularTerm(e.target.value)} 
                                                    placeholder="e.g. Company" 
 className="h-11 rounded-xl bg-background border-none font-bold text-sm px-4" 
                                                />
                                            </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Plural Label</Label>
                                                <Input 
                                                    value={pluralTerm} 
                                                    onChange={e => setPluralTerm(e.target.value)} 
                                                    placeholder="e.g. Companies" 
 className="h-11 rounded-xl bg-background border-none font-bold text-sm px-4" 
                                                />
                                            </div>
                                        </div>
                                    </div>

 <Separator className="opacity-50" />

                                    {/* STATUS ARCHITECT */}
 <div className="space-y-6">
 <div className="flex items-center justify-between px-1">
 <div className="flex items-center gap-2">
 <ShieldCheck className="h-4 w-4 text-primary" />
 <h4 className="text-xs font-semibold ">Independent Status Lifecycle</h4>
                                            </div>
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={handleAddStatus}
 className="h-8 rounded-xl font-bold border-dashed border-2 text-[10px] "
                                            >
 <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Add Status Node
                                            </Button>
                                        </div>

 <div className="space-y-3">
                                            {statuses.map((status, idx) => (
 <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-4 rounded-2xl bg-background border group">
 <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="flex items-center gap-3">
                                                            <Popover>
                                                                <PopoverTrigger asChild>
 <button type="button" className="w-8 h-8 rounded-lg shadow-sm border shrink-0" style={{ backgroundColor: status.color }} />
                                                                </PopoverTrigger>
 <PopoverContent className="w-auto p-2">
 <div className="grid grid-cols-6 gap-1">
                                                                        {ONBOARDING_STAGE_COLORS.map(c => (
 <button key={c} type="button" onClick={() => updateStatus(idx, { color: c })} className="w-5 h-5 rounded shadow-sm" style={{ backgroundColor: c }} />
                                                                        ))}
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>
                                                            <Input 
                                                                value={status.label} 
                                                                onChange={e => updateStatus(idx, { label: e.target.value, value: e.target.value })} 
 className="h-9 bg-card font-bold text-xs" 
                                                            />
                                                        </div>
                                                        <Input 
                                                            value={status.description || ''} 
                                                            onChange={e => updateStatus(idx, { description: e.target.value })} 
                                                            placeholder="Short behavioral description..."
 className="h-9 bg-card font-medium text-[10px]" 
                                                        />
                                                    </div>
                                                    <Button 
                                                        type="button" 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={() => removeStatus(idx)}
 className="h-9 w-9 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X size={16} />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

 <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-4 shadow-inner">
 <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
 <div className="space-y-1">
 <p className="text-[10px] font-semibold text-blue-900 ">Independent Logic</p>
 <p className="text-[9px] font-bold text-blue-800/60 leading-relaxed tracking-tighter text-left">
                                                Statuses defined here will be available only when this workspace is active. Existing records using deleted statuses will retain their labels until updated.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </div>

 <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between">
 <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="rounded-xl font-bold h-12 px-8">Discard</Button>
 <Button type="submit" disabled={isSaving || !name.trim()} className="rounded-xl font-semibold px-10 shadow-2xl bg-primary text-white text-xs h-12">
 {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                Commit Workspace
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirmation Dialog for Industry and Scope Lock */}
            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent className="sm:max-w-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-semibold flex items-center gap-2">
                            <Lock className="h-5 w-5 text-amber-600" />
                            Confirm Workspace Configuration
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-muted-foreground pt-2">
                            Please review your workspace configuration before proceeding. These settings will be locked after the first entity is added.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Workspace Name */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground">Workspace Name</Label>
                            <p className="text-base font-bold text-foreground">{name}</p>
                        </div>

                        {/* Industry Selection */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground">Industry Vertical</Label>
                            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 flex items-center gap-3">
                                {(() => {
                                    const Icon = getIndustryIcon(industry);
                                    return (
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <Icon className="h-5 w-5 text-primary" />
                                        </div>
                                    );
                                })()}
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-foreground">{getIndustryDisplayName(industry)}</p>
                                    <p className="text-[10px] font-medium text-muted-foreground leading-relaxed mt-0.5">
                                        {getIndustryDescription(industry)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Contact Scope */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground">Contact Scope</Label>
                            <div className="p-4 rounded-xl bg-muted/30 border border-border flex items-center gap-3">
                                {contactScope === 'institution' && <Building2 className="h-5 w-5 text-primary" />}
                                {contactScope === 'family' && <Users className="h-5 w-5 text-primary" />}
                                {contactScope === 'person' && <User className="h-5 w-5 text-primary" />}
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-foreground">
                                        {contactScope === 'institution' ? 'Schools' : contactScope === 'family' ? 'Families' : 'People'}
                                    </p>
                                    <p className="text-[10px] font-medium text-muted-foreground leading-relaxed mt-0.5">
                                        {contactScope === 'institution' && 'Institutional contacts with billing, contracts, and subscription management.'}
                                        {contactScope === 'family' && 'Family contacts with guardians, children, and admissions workflows.'}
                                        {contactScope === 'person' && 'Individual contacts with personal CRM and lead management.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Warning */}
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                            <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-amber-900">Important: Scope Lock</p>
                                <ul className="text-[10px] font-medium text-amber-800/70 leading-relaxed space-y-1 list-disc list-inside">
                                    <li>Industry vertical and contact scope will be <strong>locked</strong> after the first entity is added</li>
                                    <li>These settings cannot be changed once locked to protect data integrity</li>
                                    <li>All entities in this workspace must match the selected industry and contact scope</li>
                                    <li>Industry-specific features and terminology will be applied automatically</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Go Back</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={performSave}
                            disabled={isSaving}
                            className="rounded-xl font-semibold px-8 bg-primary"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Check className="h-4 w-4 mr-2" />
                                    Confirm & Create Workspace
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import type { Workspace, WorkspaceStatus, IndustryVertical } from '@/lib/types';
import { 
    Zap, 
    Plus, 
    Trash2, 
    Pencil, 
    ShieldCheck, 
    Archive, 
    Info,
    Check,
    Briefcase,
    Building2,
    Users,
    User,
    Filter,
    Lock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { setOrganizationDefaultWorkspaceAction } from '@/lib/organization-actions';
import { getEnabledIndustries } from '@/lib/industry-config';
import { INDUSTRY_METADATA } from '@/lib/industry-field-registry';
import * as Icons from 'lucide-react';

interface WorkspaceEditorProps {
    workspaces: Workspace[];
    selectedScope: string;
    onSelectWorkspace: (scope: string) => void;
}

export default function WorkspaceEditor({ workspaces, selectedScope, onSelectWorkspace }: WorkspaceEditorProps) {
    const { toast } = useToast();
    const { user } = useUser();
    const { activeOrganizationId, activeOrganization } = useTenant();
    
    const [isCreating, setIsCreating] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);

    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [contactScope, setContactScope] = React.useState<'institution' | 'family' | 'person'>('institution');
    const [industry, setIndustry] = React.useState<IndustryVertical>('SaaS');
    const [industryFilter, setIndustryFilter] = React.useState<IndustryVertical | 'all'>('all');

    // Get enabled industries from feature flags
    const enabledIndustries = React.useMemo(() => getEnabledIndustries(), []);

    // Helper function to get industry icon
    const getIndustryIcon = (industryType: IndustryVertical): React.ComponentType<{ className?: string }> => {
        const meta = INDUSTRY_METADATA[industryType];
        const IconName = meta?.icon || 'Building2';
        const typedIcons = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
        return typedIcons[IconName] || Icons.Building2;
    };

    // Helper function to get industry display name
    const getIndustryDisplayName = (industryType: IndustryVertical) => {
        return INDUSTRY_METADATA[industryType]?.name || industryType;
    };

    // Helper function to get industry description
    const getIndustryDescription = (industryType: IndustryVertical) => {
        return INDUSTRY_METADATA[industryType]?.description || '';
    };

    const handleOpenCreate = () => {
        setName('');
        setDescription('');
        setContactScope('institution');
        setIndustry('SaaS');
        setIsCreating(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !name.trim() || !activeOrganizationId) return;

        setShowConfirmDialog(true);
    };

    const performSave = async () => {
        if (!user || !name.trim() || !activeOrganizationId) return;
        setIsSaving(true);

        const defaultStatuses: WorkspaceStatus[] = [
            { value: 'Onboarding', label: 'Onboarding', color: '#3B5FFF' },
            { value: 'Active', label: 'Active', color: '#10b981' },
            { value: 'Churned', label: 'Churned', color: '#ef4444' }
        ];

        const result = await saveWorkspaceAction(
            null,
            { 
                name: name.trim(), 
                description: description.trim(), 
                color: '#3B5FFF', 
                statuses: defaultStatuses,
                organizationId: activeOrganizationId,
                contactScope: contactScope,
                capabilities: getDefaultCapabilities(contactScope),
                industry: industry,
                industryScopeLocked: false,
                contactPolicy: 'phone_or_email',
                entityDefaults: {},
                restrictVisibilityToAssigned: true,
                defaultSmsSenderId: 'SmartSapp',
            },
            user.uid
        );

        if (result.success) {
            toast({ title: 'Workspace Created', description: 'Workspace saved successfully.' });
            setIsCreating(false);
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
                        onClick={handleOpenCreate} 
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
                    {workspaces
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
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => onSelectWorkspace(w.id)}>
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
                                                        className="h-5 rounded-md px-1.5 text-[8px] font-semibold bg-background hover:bg-primary hover:text-white transition-all opacity-0 group-hover:opacity-100"
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

            {/* NEW WORKSPACE MODAL */}
            <Dialog open={isCreating} onOpenChange={setIsCreating}>
                <DialogContent className="sm:max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
                    <form onSubmit={handleSave} className="flex flex-col h-full text-left">
                        <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl">
                                    <Zap className="h-6 w-6" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-semibold tracking-tight">
                                        New Workspace
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

                                    <Separator className="opacity-50" />
                                    
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 px-1">
                                            <Building2 className="h-4 w-4 text-primary" />
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
                                </div>
                            </ScrollArea>
                        </div>

                        <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between">
                            <Button type="button" variant="ghost" onClick={() => setIsCreating(false)} className="rounded-xl font-bold h-12 px-8">Discard</Button>
                            <Button type="submit" disabled={isSaving || !name.trim()} className="rounded-xl font-semibold px-10 shadow-2xl bg-primary text-white text-xs h-12">
                                {isSaving ? <Zap className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                Create Workspace
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

                    <div className="space-y-6 py-4 text-left">
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
                                        {contactScope === 'institution' ? 'Schools' : 
                                         contactScope === 'family' ? 'Families' : 'People'}
                                    </p>
                                    <p className="text-[10px] font-medium text-muted-foreground leading-relaxed mt-0.5">
                                        {contactScope === 'institution' && 'Institutional contacts with billing, contracts, and subscription management.'}
                                        {contactScope === 'family' && 'Family contacts with guardians, children, and admissions workflows.'}
                                        {contactScope === 'person' && 'Individual contacts with personal CRM and lead management.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl font-bold h-11">Review Settings</AlertDialogCancel>
                        <AlertDialogAction onClick={performSave} className="rounded-xl font-bold h-11 bg-primary text-white">
                            Confirm & Build Hub
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

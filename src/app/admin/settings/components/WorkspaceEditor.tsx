'use client';

import * as React from 'react';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import type { Workspace, WorkspaceStatus } from '@/lib/types';
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
    User
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
import { useToast } from '@/hooks/use-toast';
import { saveWorkspaceAction, deleteWorkspaceAction, archiveWorkspaceAction } from '@/lib/workspace-actions';
import { cn } from '@/lib/utils';
import { ONBOARDING_STAGE_COLORS } from '@/lib/colors';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { setOrganizationDefaultWorkspaceAction } from '@/lib/organization-actions';

export default function WorkspaceEditor() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const { activeOrganizationId, activeOrganization } = useTenant();
    
    const [isEditing, setIsEditing] = React.useState(false);
    const [activeWorkspace, setActiveWorkspace] = React.useState<Workspace | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);

    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [color, setColor] = React.useState('#3B5FFF');
    const [statuses, setStatuses] = React.useState<WorkspaceStatus[]>([]);
    const [contactScope, setContactScope] = React.useState<'institution' | 'family' | 'person'>('institution');
    const [singularTerm, setSingularTerm] = React.useState('');
    const [pluralTerm, setPluralTerm] = React.useState('');

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
        }
        setIsEditing(true);
    };

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
        setIsSaving(true);

        const result = await saveWorkspaceAction(
            activeWorkspace?.id || null,
            { 
                name: name.trim(), 
                description: description.trim(), 
                color, 
                statuses,
                organizationId: activeWorkspace?.organizationId || activeOrganizationId, // Preserve or set organizationId
                contactScope: activeWorkspace ? undefined : contactScope, // Only set on creation
                capabilities: activeWorkspace ? undefined : getDefaultCapabilities(contactScope), // Only set on creation
                terminology: (singularTerm.trim() && pluralTerm.trim()) ? {
                    singular: singularTerm.trim(),
                    plural: pluralTerm.trim()
                } : undefined
            },
            user.uid
        );

        if (result.success) {
            toast({ title: 'Workspace Updated', description: 'Workspace saved successfully.' });
            setIsEditing(false);
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
        <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
                <div className="text-left">
                    <h3 className="text-xl font-black uppercase tracking-tight text-foreground">Workspace Architect</h3>
                    <p className="text-sm text-muted-foreground font-medium">
                        Manage workspaces for <span className="font-bold text-primary">{activeOrganization?.name || 'current organization'}</span>
                    </p>
                </div>
                <Button 
                    onClick={() => handleOpenEdit()} 
                    className="rounded-xl font-black h-11 px-6 shadow-lg gap-2"
                    disabled={!activeOrganizationId}
                >
                    <Plus className="h-4 w-4" /> New Workspace
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-[2rem]" />)
                ) : workspaces?.map(w => (
                    <Card key={w.id} className={cn(
                        "rounded-[2.5rem] border-none ring-1 transition-all duration-500 overflow-hidden bg-white text-left group",
                        w.status === 'archived' ? "opacity-50 grayscale ring-border" : "ring-border shadow-sm hover:ring-primary/20 hover:shadow-xl"
                    )}>
                        <div className="h-1.5 w-full" style={{ backgroundColor: w.color || '#3B5FFF' }} />
                        <CardHeader className="p-6 pb-4 flex flex-row items-center justify-between">
                            <div className="min-w-0">
                                <CardTitle className="text-base font-black uppercase tracking-tight truncate">{w.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="text-[8px] font-black uppercase px-1.5 h-4">{w.statuses?.length || 0} Statuses</Badge>
                                    {w.contactScope && (
                                        <Badge variant="outline" className="text-[8px] font-black uppercase px-1.5 h-4 flex items-center gap-1">
                                            {w.contactScope === 'institution' && <Building2 className="h-2.5 w-2.5" />}
                                            {w.contactScope === 'family' && <Users className="h-2.5 w-2.5" />}
                                            {w.contactScope === 'person' && <User className="h-2.5 w-2.5" />}
                                            {w.terminology?.plural || (w.contactScope === 'institution' ? 'Institutions' : w.contactScope === 'family' ? 'Families' : 'People')}
                                        </Badge>
                                    )}
                                    {w.scopeLocked && (
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
                                    <Badge variant={w.status === 'active' ? 'default' : 'outline'} className="text-[8px] font-black uppercase px-2 h-5">
                                        {w.status}
                                    </Badge>
                                    {activeOrganization?.defaultWorkspaceId === w.id ? (
                                        <Badge className="text-[8px] font-black uppercase px-2 h-5 bg-orange-500 hover:bg-orange-600 text-white border-none shadow-sm flex items-center gap-1">
                                            <ShieldCheck className="h-2.5 w-2.5" />
                                            Default
                                        </Badge>
                                    ) : (
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-5 rounded-md px-1.5 text-[8px] font-black uppercase bg-muted/50 hover:bg-primary hover:text-white transition-all opacity-0 group-hover:opacity-100"
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
                ))}
            </div>

            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogContent className="sm:max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem]">
                    <form onSubmit={handleSave} className="flex flex-col h-full text-left">
                        <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl">
                                    <Zap className="h-6 w-6" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                                        {activeWorkspace ? 'Modify Hub' : 'New Workspace'}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Architect a new hub identity and its independent lifecycle.</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="flex-1 overflow-hidden relative bg-background">
                            <ScrollArea className="h-full">
                                <div className="p-8 space-y-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Workspace Label</Label>
                                                <Input 
                                                    value={name} 
                                                    onChange={e => setName(e.target.value)} 
                                                    placeholder="e.g. Higher Education Onboarding" 
                                                    className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold text-lg px-4" 
                                                    required 
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Theme (Color)</Label>
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
                                                    <Input value={color} onChange={e => setColor(e.target.value)} className="h-12 rounded-xl bg-muted/20 border-none font-mono font-black text-center uppercase" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Objective Brief</Label>
                                            <Textarea 
                                                value={description} 
                                                onChange={e => setDescription(e.target.value)} 
                                                placeholder="Define the scope..." 
                                                className="min-h-[135px] rounded-2xl bg-muted/20 border-none shadow-inner p-4 font-medium leading-relaxed" 
                                            />
                                        </div>
                                    </div>

                                    {/* CONTACT SCOPE SELECTOR - Only show for new workspaces */}
                                    {!activeWorkspace && (
                                        <>
                                            <Separator className="opacity-50" />
                                            
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 px-1">
                                                    <Layout className="h-4 w-4 text-primary" />
                                                    <h4 className="text-xs font-black uppercase tracking-widest">Contact Scope</h4>
                                                    <Badge variant="secondary" className="text-[8px] font-black uppercase px-1.5 h-4">Required</Badge>
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
                                                                : "bg-muted/10 border-border hover:border-primary/30"
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
                                                                <h5 className="text-sm font-black text-foreground">Schools</h5>
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
                                                                : "bg-muted/10 border-border hover:border-primary/30"
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
                                                                <h5 className="text-sm font-black text-foreground">Families</h5>
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
                                                                : "bg-muted/10 border-border hover:border-primary/30"
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
                                                                <h5 className="text-sm font-black text-foreground">People</h5>
                                                                <p className="text-[9px] font-medium text-muted-foreground leading-relaxed">
                                                                    Individual contacts with personal CRM and lead management.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                </div>

                                                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                                                    <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black text-blue-900 uppercase">Scope Selection</p>
                                                        <p className="text-[9px] font-medium text-blue-800/70 leading-relaxed">
                                                            Contact scope cannot be changed after the first entity is linked to this workspace. Choose carefully based on your workflow needs.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <Separator className="opacity-50" />

                                    {/* CONTACT SCOPE DISPLAY */}
                                    {activeWorkspace?.contactScope && (
                                        <>
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between px-1">
                                                    <div className="flex items-center gap-2">
                                                        {activeWorkspace.contactScope === 'institution' && <Building2 className="h-4 w-4 text-primary" />}
                                                        {activeWorkspace.contactScope === 'family' && <Users className="h-4 w-4 text-primary" />}
                                                        {activeWorkspace.contactScope === 'person' && <User className="h-4 w-4 text-primary" />}
                                                        <h4 className="text-xs font-black uppercase tracking-widest">Contact Scope</h4>
                                                    </div>
                                                    {activeWorkspace.scopeLocked && (
                                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                                            <Lock className="h-3.5 w-3.5" />
                                                            <span className="text-[9px] font-bold uppercase tracking-wider">Locked</span>
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
                                                        <p className="text-sm font-black text-foreground">
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
                                                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                                                        <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-black text-amber-900 uppercase">Scope Locked</p>
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
                                                    <h4 className="text-xs font-black uppercase tracking-widest">Workspace Capabilities</h4>
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
                                                                <span className="text-[10px] font-black uppercase tracking-wider">
                                                                    {key}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                                                    <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                                    <p className="text-[9px] font-medium text-blue-800/70 leading-relaxed">
                                                        Capabilities control which features are available in this workspace. These can be configured independently of the contact scope.
                                                    </p>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <Separator className="opacity-50" />

                                    {/* TERMINOLOGY ARCHITECT */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-2 px-1">
                                            <Palette className="h-4 w-4 text-primary" />
                                            <h4 className="text-xs font-black uppercase tracking-widest">Terminology Architect</h4>
                                            <Badge variant="outline" className="text-[8px] font-black uppercase px-1.5 h-4 ml-auto">Visual Logic</Badge>
                                        </div>

                                        <p className="text-[10px] font-medium text-muted-foreground leading-relaxed px-1">
                                            Customize how entities are identified in this workspace. Labels will appear across navigation, forms, and reports. 
                                            Leaving these blank will use default labels (<span className="text-primary font-bold">Institution, Family, or Person</span>).
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Singular Label</Label>
                                                <Input 
                                                    value={singularTerm} 
                                                    onChange={e => setSingularTerm(e.target.value)} 
                                                    placeholder="e.g. Company" 
                                                    className="h-11 rounded-xl bg-muted/10 border-none font-bold text-sm px-4" 
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Plural Label</Label>
                                                <Input 
                                                    value={pluralTerm} 
                                                    onChange={e => setPluralTerm(e.target.value)} 
                                                    placeholder="e.g. Companies" 
                                                    className="h-11 rounded-xl bg-muted/10 border-none font-bold text-sm px-4" 
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
                                                <h4 className="text-xs font-black uppercase tracking-widest">Independent Status Lifecycle</h4>
                                            </div>
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={handleAddStatus}
                                                className="h-8 rounded-xl font-bold border-dashed border-2 text-[10px] uppercase tracking-widest"
                                            >
                                                <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Add Status Node
                                            </Button>
                                        </div>

                                        <div className="space-y-3">
                                            {statuses.map((status, idx) => (
                                                <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-4 rounded-2xl bg-muted/10 border group">
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
                                                                className="h-9 bg-white font-bold text-xs" 
                                                            />
                                                        </div>
                                                        <Input 
                                                            value={status.description || ''} 
                                                            onChange={e => updateStatus(idx, { description: e.target.value })} 
                                                            placeholder="Short behavioral description..."
                                                            className="h-9 bg-white font-medium text-[10px]" 
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

                                    <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-4 shadow-inner">
                                        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-blue-900 uppercase">Independent Logic</p>
                                            <p className="text-[9px] font-bold text-blue-800/60 leading-relaxed uppercase tracking-tighter text-left">
                                                Statuses defined here will be available only when this workspace is active. Existing records using deleted statuses will retain their labels until updated.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </div>

                        <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between">
                            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="rounded-xl font-bold h-12 px-8">Discard</Button>
                            <Button type="submit" disabled={isSaving || !name.trim()} className="rounded-xl font-black px-10 shadow-2xl bg-primary text-white uppercase text-xs h-12">
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                Commit Workspace
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

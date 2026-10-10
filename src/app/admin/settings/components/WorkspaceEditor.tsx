'use client';

import * as React from 'react';
import { useUser, useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import type { Workspace, WorkspaceStatus, IndustryVertical, ContactIdentifierPolicy } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';
import { getWorkspaceStatusDefaults } from '@/lib/industry-defaults';
import { 
    Zap, 
    Plus, 
    Trash2, 
    Pencil, 
    ShieldCheck, 
    Archive, 
    Check,
    Building2,
    Users,
    User,
    Filter,
    Lock
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { setOrganizationDefaultWorkspaceAction } from '@/lib/organization-actions';
import { getEnabledIndustries } from '@/lib/industry-config';
import { INDUSTRY_METADATA } from '@/lib/industry-field-registry';
import * as Icons from 'lucide-react';
import { StepBasics } from './steps/StepBasics';
import { StepIndustryScope } from './steps/StepIndustryScope';
import { StepGovernance } from './steps/StepGovernance';
import { StepFinish } from './steps/StepFinish';
import { STEPPER_STEPS } from './types';

interface WorkspaceEditorProps {
    workspaces: Workspace[];
    selectedScope: string;
    onSelectWorkspace: (scope: string) => void;
}

export default function WorkspaceEditor({ workspaces, selectedScope: _selectedScope, onSelectWorkspace }: WorkspaceEditorProps) {
    const { toast } = useToast();
    const { user } = useUser();
    const { activeOrganizationId, activeOrganization } = useTenant();
    const firestore = useFirestore();
    
    const [isCreating, setIsCreating] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);

    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [contactScope, setContactScope] = React.useState<'institution' | 'family' | 'person'>('institution');
    const [industry, setIndustry] = React.useState<IndustryVertical>('SaaS');
    const [industryFilter, setIndustryFilter] = React.useState<IndustryVertical | 'all'>('all');

    const [currentStep, setCurrentStep] = React.useState(0);
    const [color, setColor] = React.useState('#3B5FFF');
    const [contactPolicy, setContactPolicy] = React.useState<ContactIdentifierPolicy>('phone_or_email');
    const [restrictVisibilityToAssigned, setRestrictVisibilityToAssigned] = React.useState(true);
    const [restrictDealsVisibilityToAssigned, setRestrictDealsVisibilityToAssigned] = React.useState(true);
    const [restrictTasksVisibilityToAssigned, setRestrictTasksVisibilityToAssigned] = React.useState(true);
    const [statuses, setStatuses] = React.useState<WorkspaceStatus[]>([
        { value: 'Onboarding', label: 'Onboarding', color: '#3B5FFF' },
        { value: 'Active', label: 'Active', color: '#10b981' },
        { value: 'Churned', label: 'Churned', color: '#ef4444' }
    ]);

    const [dbDefaults, setDbDefaults] = React.useState<Record<string, WorkspaceStatus[]> | null>(null);
    const [statusesModified, setStatusesModified] = React.useState(false);
    const [pendingIndustryChange, setPendingIndustryChange] = React.useState<IndustryVertical | null>(null);
    const [showResetWarning, setShowResetWarning] = React.useState(false);

    React.useEffect(() => {
        const loadDbDefaults = async () => {
            if (!firestore) return;
            try {
                const snap = await getDoc(doc(firestore, 'system_settings', 'industries_lifecycle'));
                if (snap.exists()) {
                    setDbDefaults(snap.data() as Record<string, WorkspaceStatus[]>);
                }
            } catch (error) {
                console.error('Failed to load global lifecycle defaults:', error);
            }
        };
        loadDbDefaults();
    }, [firestore]);

    const handleAddStatus = () => {
        setStatuses(prev => [...prev, { value: 'New Status', label: 'New Status', color: '#64748b' }]);
        setStatusesModified(true);
    };

    const updateStatus = (index: number, updates: Partial<WorkspaceStatus>) => {
        const next = [...statuses];
        next[index] = { ...next[index], ...updates };
        setStatuses(next);
        setStatusesModified(true);
    };

    const removeStatus = (index: number) => {
        if (statuses.length === 1) return;
        setStatuses(prev => prev.filter((_, i) => i !== index));
        setStatusesModified(true);
    };

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
        setColor('#3B5FFF');
        setContactPolicy('phone_or_email');
        setRestrictVisibilityToAssigned(true);
        setRestrictDealsVisibilityToAssigned(true);
        setRestrictTasksVisibilityToAssigned(true);
        setStatuses(getWorkspaceStatusDefaults('SaaS', dbDefaults));
        setStatusesModified(false);
        setPendingIndustryChange(null);
        setShowResetWarning(false);
        setCurrentStep(0);
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

        const result = await saveWorkspaceAction(
            null,
            { 
                name: name.trim(), 
                description: description.trim(), 
                color, 
                statuses,
                organizationId: activeOrganizationId,
                contactScope,
                capabilities: getDefaultCapabilities(contactScope),
                industry,
                industryScopeLocked: false,
                contactPolicy,
                entityDefaults: {},
                restrictVisibilityToAssigned,
                restrictDealsVisibilityToAssigned,
                restrictTasksVisibilityToAssigned,
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
        const result = await setOrganizationDefaultWorkspaceAction(activeOrganizationId, workspaceId);
        if (result.success) {
            toast({ title: 'Default Workspace Updated' });
        } else {
            toast({ variant: 'destructive', title: 'Action Failed', description: result.error });
        }
    };

    const handleIndustryScopeChange = (ind: IndustryVertical, scope: 'institution' | 'family' | 'person') => {
        if (statusesModified) {
            setPendingIndustryChange(ind);
            setShowResetWarning(true);
        } else {
            setIndustry(ind);
            setContactScope(scope);
            setStatuses(getWorkspaceStatusDefaults(ind, dbDefaults));
        }
    };

    const confirmIndustryChange = () => {
        if (!pendingIndustryChange) return;
        setIndustry(pendingIndustryChange);
        
        let recommendedScope: 'institution' | 'family' | 'person' = 'person';
        if (pendingIndustryChange === 'SaaS') recommendedScope = 'institution';
        else if (pendingIndustryChange === 'SchoolEnrollment') recommendedScope = 'family';
        
        setContactScope(recommendedScope);
        setStatuses(getWorkspaceStatusDefaults(pendingIndustryChange, dbDefaults));
        setStatusesModified(false);
        setShowResetWarning(false);
        setPendingIndustryChange(null);
    };

    const handleNextStep = () => {
        if (currentStep === 0 && !name.trim()) return;
        setCurrentStep(prev => prev + 1);
    };

    const handleBackStep = () => {
        setCurrentStep(prev => prev - 1);
    };

    const formatSafeSyncDate = (dateVal?: string) => {
        if (!dateVal) return '—';
        try {
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return '—';
            return format(d, 'MMM d, HH:mm');
        } catch {
            return '—';
        }
    };

    const filteredWorkspaces = React.useMemo(() => {
        return workspaces?.filter((w) => industryFilter === 'all' || w.industry === industryFilter) || [];
    }, [workspaces, industryFilter]);

    return (
        <>
            <div className="space-y-6">
                {/* Header: Title on Left, Filter and New Workspace Button Positioned Next to Each Other on Right */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                    <div className="flex items-center gap-2 text-left">
                        <h3 className="text-xl font-semibold tracking-tight text-foreground">Workspace Architect</h3>
                        <CardInfoTooltip text={`Manage workspaces for ${activeOrganization?.name || 'current organization'}`} />
                    </div>

                    {/* Filter and New Workspace button positioned side-by-side */}
                    <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-2 bg-card border border-border/80 rounded-xl px-3 h-11 shadow-xs">
                            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <Select value={industryFilter} onValueChange={(value) => setIndustryFilter(value as IndustryVertical | 'all')}>
                                <SelectTrigger 
                                    className="w-[160px] sm:w-[180px] h-9 border-0 bg-transparent shadow-none px-0 text-xs font-semibold focus:ring-0 focus:ring-offset-0"
                                    aria-label="Filter workspaces by industry"
                                >
                                    <SelectValue placeholder="All Industries" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
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

                        <Button 
                            onClick={handleOpenCreate} 
                            className="rounded-xl font-semibold h-11 px-5 shadow-sm gap-2 active:scale-[0.97] shrink-0 min-h-[44px] sm:min-h-[44px]"
                            disabled={!activeOrganizationId}
                        >
                            <Plus className="h-4 w-4" /> New Workspace
                        </Button>
                    </div>
                </div>

                {/* Workspaces Count Summary */}
                <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold px-1">
                    <span>
                        Showing {filteredWorkspaces.length} of {workspaces?.length || 0} workspaces
                    </span>
                    {activeOrganization?.name && (
                        <span className="truncate max-w-[200px] text-muted-foreground/80">
                            {activeOrganization.name}
                        </span>
                    )}
                </div>

                {/* Workspace Listview: Desktop Table (Single Row Per Record) + Mobile Cards */}
                {filteredWorkspaces.length === 0 ? (
                    <Card className="rounded-2xl border bg-card/40 p-12 text-center space-y-2">
                        <p className="text-sm font-semibold text-foreground">No workspaces found</p>
                        <p className="text-xs text-muted-foreground">
                            {industryFilter !== 'all' 
                                ? 'Try changing the industry filter to view other workspaces.' 
                                : 'Get started by creating your first workspace.'}
                        </p>
                    </Card>
                ) : (
                    <>
                        {/* Tabular Desktop Table View (Each Record Occupies One Row) */}
                        <div className="hidden md:block rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden shadow-xs">
                            <Table>
                                <TableHeader className="bg-muted/30 border-b border-border/60">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Workspace</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold py-3">Industry & Scope</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold py-3">Status</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold py-3">Default</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold py-3">Last Sync</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold py-3 text-right pr-4">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredWorkspaces.map(w => {
                                        const IndustryIcon = getIndustryIcon(w.industry || 'SaaS');
                                        const isDefault = activeOrganization?.defaultWorkspaceId === w.id;
                                        const isArchived = w.status === 'archived';

                                        return (
                                            <TableRow
                                                key={w.id}
                                                className={cn(
                                                    "group hover:bg-muted/15 transition-colors border-b border-border/40 last:border-none",
                                                    isArchived && "opacity-50 grayscale"
                                                )}
                                            >
                                                {/* Workspace Name & Color Bar */}
                                                <TableCell className="pl-4 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <div 
                                                            className="w-1.5 h-8 rounded-full shrink-0 shadow-xs" 
                                                            style={{ backgroundColor: w.color || '#3B5FFF' }} 
                                                        />
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-sm text-foreground truncate">
                                                                    {w.name}
                                                                </span>
                                                                <CardInfoTooltip text={w.description || 'No description provided.'} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* Industry & Scope Badges */}
                                                <TableCell className="py-3.5">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border bg-muted/20 flex items-center gap-1">
                                                            <IndustryIcon className="h-3 w-3" />
                                                            {getIndustryDisplayName(w.industry || 'SaaS')}
                                                        </Badge>

                                                        {w.contactScope && (
                                                            <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border bg-muted/20 flex items-center gap-1">
                                                                {w.contactScope === 'institution' && <Building2 className="h-2.5 w-2.5" />}
                                                                {w.contactScope === 'family' && <Users className="h-2.5 w-2.5" />}
                                                                {w.contactScope === 'person' && <User className="h-2.5 w-2.5" />}
                                                                {w.terminology?.plural || (w.contactScope === 'institution' ? 'Institutions' : w.contactScope === 'family' ? 'Families' : 'People')}
                                                            </Badge>
                                                        )}

                                                        <Badge variant="secondary" className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md">
                                                            {w.statuses?.length || 0} Statuses
                                                        </Badge>

                                                        {w.industryScopeLocked && (
                                                            <Lock className="h-3 w-3 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                </TableCell>

                                                {/* Active/Archived Status */}
                                                <TableCell className="py-3.5">
                                                    <Badge 
                                                        variant={w.status === 'active' ? 'default' : 'outline'} 
                                                        className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                                                    >
                                                        {w.status}
                                                    </Badge>
                                                </TableCell>

                                                {/* Default Workspace */}
                                                <TableCell className="py-3.5">
                                                    {isDefault ? (
                                                        <Badge className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-orange-500 hover:bg-orange-600 text-white border-none shadow-xs flex items-center gap-1 w-fit">
                                                            <ShieldCheck className="h-3 w-3" />
                                                            Default
                                                        </Badge>
                                                    ) : (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-7 rounded-lg px-2 text-[10px] font-semibold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all active:scale-[0.97]"
                                                            onClick={() => handleSetDefault(w.id)}
                                                        >
                                                            Set as Default
                                                        </Button>
                                                    )}
                                                </TableCell>

                                                {/* Last Sync */}
                                                <TableCell className="py-3.5">
                                                    <span className="text-[10px] font-mono font-medium text-muted-foreground/60 tabular-nums">
                                                        {formatSafeSyncDate(w.updatedAt)}
                                                    </span>
                                                </TableCell>

                                                {/* Actions */}
                                                <TableCell className="py-3.5 text-right pr-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10 active:scale-[0.97]" 
                                                            onClick={() => onSelectWorkspace(w.id)}
                                                            title="Edit workspace"
                                                            aria-label={`Edit ${w.name}`}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 rounded-lg text-orange-600 hover:bg-orange-500/10 active:scale-[0.97]" 
                                                            onClick={() => handleArchive(w)}
                                                            title={isArchived ? "Restore workspace" : "Archive workspace"}
                                                            aria-label={`${isArchived ? "Restore" : "Archive"} ${w.name}`}
                                                        >
                                                            <Archive className="h-4 w-4" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 active:scale-[0.97]" 
                                                            onClick={() => handleDelete(w)}
                                                            title="Delete workspace"
                                                            aria-label={`Delete ${w.name}`}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile Responsive Card List View */}
                        <div className="space-y-3 md:hidden">
                            {filteredWorkspaces.map(w => {
                                const IndustryIcon = getIndustryIcon(w.industry || 'SaaS');
                                const isDefault = activeOrganization?.defaultWorkspaceId === w.id;
                                const isArchived = w.status === 'archived';

                                return (
                                    <Card
                                        key={w.id}
                                        className={cn(
                                            "rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-xs relative overflow-hidden text-left",
                                            isArchived && "opacity-50 grayscale"
                                        )}
                                    >
                                        {/* Left accent color bar */}
                                        <div 
                                            className="absolute left-0 top-0 bottom-0 w-1.5" 
                                            style={{ backgroundColor: w.color || '#3B5FFF' }} 
                                        />

                                        {/* Top Row: Title, Tooltip & Status/Default Badges */}
                                        <div className="pl-2 flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-sm text-foreground truncate">
                                                        {w.name}
                                                    </span>
                                                    <CardInfoTooltip text={w.description || 'No description provided.'} />
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                    <Badge variant={w.status === 'active' ? 'default' : 'outline'} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md">
                                                        {w.status}
                                                    </Badge>

                                                    {isDefault ? (
                                                        <Badge className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-orange-500 text-white border-none shadow-xs flex items-center gap-1">
                                                            <ShieldCheck className="h-2.5 w-2.5" />
                                                            Default
                                                        </Badge>
                                                    ) : (
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="h-6 rounded-md px-2 text-[9px] font-semibold text-muted-foreground hover:bg-primary/10 hover:text-primary active:scale-[0.97]"
                                                            onClick={() => handleSetDefault(w.id)}
                                                        >
                                                            Set Default
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            <span className="text-[9px] font-mono font-medium text-muted-foreground/60 tabular-nums shrink-0 pt-0.5">
                                                {formatSafeSyncDate(w.updatedAt)}
                                            </span>
                                        </div>

                                        {/* Middle Row: Industry & Scope Badges */}
                                        <div className="pl-2 flex items-center gap-1.5 flex-wrap">
                                            <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border bg-muted/20 flex items-center gap-1">
                                                <IndustryIcon className="h-3 w-3" />
                                                {getIndustryDisplayName(w.industry || 'SaaS')}
                                            </Badge>

                                            {w.contactScope && (
                                                <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border bg-muted/20 flex items-center gap-1">
                                                    {w.contactScope === 'institution' && <Building2 className="h-2.5 w-2.5" />}
                                                    {w.contactScope === 'family' && <Users className="h-2.5 w-2.5" />}
                                                    {w.contactScope === 'person' && <User className="h-2.5 w-2.5" />}
                                                    {w.terminology?.plural || (w.contactScope === 'institution' ? 'Institutions' : w.contactScope === 'family' ? 'Families' : 'People')}
                                                </Badge>
                                            )}

                                            <Badge variant="secondary" className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md">
                                                {w.statuses?.length || 0} Statuses
                                            </Badge>

                                            {w.industryScopeLocked && (
                                                <Lock className="h-3 w-3 text-muted-foreground" />
                                            )}
                                        </div>

                                        {/* Bottom Row: Mobile Action Buttons (>= 44px touch targets) */}
                                        <div className="pl-2 flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold text-primary hover:bg-primary/10 active:scale-[0.97] flex items-center gap-1.5"
                                                onClick={() => onSelectWorkspace(w.id)}
                                                aria-label={`Edit ${w.name}`}
                                            >
                                                <Pencil className="h-3.5 w-3.5" /> Edit
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold text-orange-600 hover:bg-orange-500/10 active:scale-[0.97] flex items-center gap-1.5"
                                                onClick={() => handleArchive(w)}
                                                aria-label={`${isArchived ? "Restore" : "Archive"} ${w.name}`}
                                            >
                                                <Archive className="h-3.5 w-3.5" /> {isArchived ? "Restore" : "Archive"}
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 active:scale-[0.97] flex items-center gap-1.5"
                                                onClick={() => handleDelete(w)}
                                                aria-label={`Delete ${w.name}`}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" /> Delete
                                            </Button>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </>
                )}
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

                            {/* Stepper Header Progress Lines */}
                            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
                                {STEPPER_STEPS.map((step, idx) => {
                                    const isActive = currentStep === idx;
                                    const isCompleted = currentStep > idx;
                                    return (
                                        <React.Fragment key={idx}>
                                            <div 
                                                className="flex items-center gap-2 cursor-pointer select-none group"
                                                onClick={() => {
                                                    if (isCompleted || isActive) {
                                                        setCurrentStep(idx);
                                                    }
                                                }}
                                            >
                                                <div 
                                                    className={cn(
                                                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 active:scale-90",
                                                        isActive && "bg-primary text-white ring-2 ring-primary ring-offset-2",
                                                        isCompleted && "bg-primary/20 text-primary hover:bg-primary/30",
                                                        !isActive && !isCompleted && "bg-muted text-muted-foreground cursor-not-allowed"
                                                    )}
                                                >
                                                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                                                </div>
                                                <div className="hidden md:block text-left">
                                                    <span className={cn(
                                                        "text-[10px] font-bold block transition-colors",
                                                        isActive ? "text-foreground" : "text-muted-foreground"
                                                    )}>
                                                        {step.label}
                                                    </span>
                                                    <span className="text-[8px] text-muted-foreground/60 block font-medium">
                                                        {step.description}
                                                    </span>
                                                </div>
                                            </div>
                                            {idx < STEPPER_STEPS.length - 1 && (
                                                <div 
                                                    className={cn(
                                                        "flex-1 h-0.5 mx-2 rounded transition-colors duration-300",
                                                        currentStep > idx ? "bg-primary" : "bg-muted"
                                                    )} 
                                                />
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </DialogHeader>

                        <div className="flex-1 overflow-hidden relative bg-background">
                            <ScrollArea className="h-full">
                                <div className="p-8">
                                    {currentStep === 0 && (
                                        <StepBasics 
                                            name={name}
                                            color={color}
                                            description={description}
                                            onChange={(field, value) => {
                                                if (field === 'name') setName(value);
                                                else if (field === 'color') setColor(value);
                                                else if (field === 'description') setDescription(value);
                                            }}
                                        />
                                    )}

                                    {currentStep === 1 && (
                                        <StepIndustryScope 
                                            industry={industry}
                                            contactScope={contactScope}
                                            enabledIndustries={enabledIndustries}
                                            getIndustryIcon={getIndustryIcon}
                                            getIndustryDisplayName={getIndustryDisplayName}
                                            getIndustryDescription={getIndustryDescription}
                                            onChange={({ industry: ind, contactScope: scope }) => {
                                                handleIndustryScopeChange(ind, scope);
                                            }}
                                        />
                                    )}

                                    {currentStep === 2 && (
                                        <StepGovernance 
                                            contactPolicy={contactPolicy}
                                            restrictVisibilityToAssigned={restrictVisibilityToAssigned}
                                            restrictDealsVisibilityToAssigned={restrictDealsVisibilityToAssigned}
                                            restrictTasksVisibilityToAssigned={restrictTasksVisibilityToAssigned}
                                            onChange={({ contactPolicy: cp, restrictVisibilityToAssigned: rva, restrictDealsVisibilityToAssigned: rdva, restrictTasksVisibilityToAssigned: rtva }) => {
                                                if (cp !== undefined) setContactPolicy(cp);
                                                if (rva !== undefined) setRestrictVisibilityToAssigned(rva);
                                                if (rdva !== undefined) setRestrictDealsVisibilityToAssigned(rdva);
                                                if (rtva !== undefined) setRestrictTasksVisibilityToAssigned(rtva);
                                            }}
                                        />
                                    )}

                                    {currentStep === 3 && (
                                        <StepFinish 
                                            formState={{
                                                name,
                                                description,
                                                color,
                                                industry,
                                                contactScope,
                                                contactPolicy,
                                                restrictVisibilityToAssigned,
                                                restrictDealsVisibilityToAssigned,
                                                restrictTasksVisibilityToAssigned,
                                                statuses
                                            }}
                                            onAddStatus={handleAddStatus}
                                            onUpdateStatus={updateStatus}
                                            onRemoveStatus={removeStatus}
                                            getIndustryDisplayName={getIndustryDisplayName}
                                        />
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between shrink-0">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                onClick={currentStep === 0 ? () => setIsCreating(false) : handleBackStep} 
                                className="rounded-xl font-bold h-12 px-8 active:scale-[0.97] transition-transform"
                            >
                                {currentStep === 0 ? 'Discard' : 'Back'}
                            </Button>
                            
                            {currentStep < 3 ? (
                                <Button 
                                    type="button" 
                                    onClick={handleNextStep}
                                    disabled={currentStep === 0 && !name.trim()}
                                    className="rounded-xl font-semibold px-10 shadow-2xl bg-primary text-white text-xs h-12 active:scale-[0.97] transition-transform"
                                >
                                    Next
                                </Button>
                            ) : (
                                <Button 
                                    type="submit" 
                                    disabled={isSaving || !name.trim()} 
                                    className="rounded-xl font-semibold px-10 shadow-2xl bg-primary text-white text-xs h-12 active:scale-[0.97] transition-transform"
                                >
                                    {isSaving ? <Zap className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1.5" />}
                                    Create Workspace
                                </Button>
                            )}
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
                                        {contactScope === 'institution' ? 'Institutions' : 
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

            <AlertDialog open={showResetWarning} onOpenChange={setShowResetWarning}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader className="text-left">
                        <AlertDialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Icons.AlertTriangle className="h-5 w-5 text-yellow-500" />
                            Discard Custom Statuses?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-muted-foreground pt-2">
                            You have modified the status lifecycle steps in Step 4. Changing the industry vertical to <span className="font-bold text-foreground">{pendingIndustryChange}</span> will discard your custom status nodes and reset them to the defaults for the new industry.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                        <AlertDialogCancel 
                            onClick={() => {
                                setPendingIndustryChange(null);
                                setShowResetWarning(false);
                            }}
                            className="rounded-xl font-bold h-11 border-border/80 bg-white dark:bg-card shadow-xs active:scale-[0.97]"
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={confirmIndustryChange} 
                            className="rounded-xl font-bold h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Reset & Change
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

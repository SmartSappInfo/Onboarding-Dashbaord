
'use client';

import * as React from 'react';
import { 
    collection, 
    query, 
    orderBy, 
    addDoc, 
    doc, 
    deleteDoc, 
    updateDoc,
    where
} from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { 
    type Role, 
    type AppPermissionId, 
    APP_PERMISSIONS,
    type Workspace
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
    Plus, Trash2, Loader2, Pencil, ShieldCheck, X, Save, 
    Check, Settings2, Info, Zap, Layout
} from 'lucide-react';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, 
    DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ONBOARDING_STAGE_COLORS } from '@/lib/colors';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MultiSelect } from '@/components/ui/multi-select';
import { Separator } from '@/components/ui/separator';
import { useTenant } from '@/context/TenantContext';

/**
 * @fileOverview Role & Permission Architect.
 * Allows administrators to define dynamic roles and map them to system permissions and workspaces.
 * Optimized to prevent infinite render loops when used inside modal dialogs.
 */

export default function RoleEditor() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeWorkspaceId, activeOrganizationId, isSuperAdmin } = useTenant();
    
    const [isEditing, setIsEditing] = React.useState(false);
    const [activeRole, setActiveRole] = React.useState<Role | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    
    const [roleName, setRoleName] = React.useState('');
    const [roleDescription, setRoleDescription] = React.useState('');
    const [roleColor, setRoleColor] = React.useState('#3B5FFF');
    const [selectedPermissions, setSelectedPermissions] = React.useState<AppPermissionId[]>([]);
    const [selectedWorkspaces, setSelectedWorkspaces] = React.useState<string[]>([]);
    const [isDefault, setIsDefault] = React.useState(false);

    const rolesQuery = useMemoFirebase(() => 
        (firestore && activeOrganizationId) ? query(
            collection(firestore, 'roles'), 
            where('organizationId', '==', activeOrganizationId),
            orderBy('createdAt', 'desc')
        ) : null, 
    [firestore, activeOrganizationId]);
    const { data: roles, isLoading } = useCollection<Role>(rolesQuery);

    const workspacesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'workspaces'), orderBy('name', 'asc')) : null, 
    [firestore]);
    const { data: workspaces } = useCollection<Workspace>(workspacesQuery);

    const handleOpenEdit = React.useCallback((role?: Role) => {
        if (role) {
            setActiveRole(role);
            setRoleName(role.name);
            setRoleDescription(role.description || '');
            setRoleColor(role.color || '#3B5FFF');
            setSelectedPermissions(role.permissions || []);
            setSelectedWorkspaces(role.workspaceIds || []);
            setIsDefault(role.isDefault || false);
        } else {
            setActiveRole(null);
            setRoleName('');
            setRoleDescription('');
            setRoleColor('#3B5FFF');
            setSelectedPermissions([]);
            setIsDefault(false);
            // Default to the currently active workspace for new roles
            setSelectedWorkspaces(activeWorkspaceId ? [activeWorkspaceId] : []);
        }
        setIsEditing(true);
    }, [activeWorkspaceId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !roleName.trim()) return;
        
        if (selectedWorkspaces.length === 0) {
            toast({ variant: 'destructive', title: 'Constraint Alert', description: 'A role must be associated with at least one workspace.' });
            return;
        }

        setIsSaving(true);

        const roleData = {
            name: roleName.trim(),
            description: roleDescription.trim(),
            color: roleColor,
            permissions: selectedPermissions,
            workspaceIds: selectedWorkspaces,
            organizationId: activeOrganizationId,
            isDefault: isDefault,
            updatedAt: new Date().toISOString(),
        };

        try {
            if (activeRole) {
                await updateDoc(doc(firestore, 'roles', activeRole.id), roleData);
                toast({ title: 'Role Architecture Updated' });
            } else {
                await addDoc(collection(firestore, 'roles'), {
                    ...roleData,
                    createdAt: new Date().toISOString()
                });
                toast({ title: 'Role Created' });
            }
            setIsEditing(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Save Failed' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore || !confirm('Permanently delete this role? Users assigned to this role will lose its associated permissions.')) return;
        await deleteDoc(doc(firestore, 'roles', id));
        toast({ title: 'Role Removed' });
    };

    const togglePermission = React.useCallback((permId: AppPermissionId) => {
        setSelectedPermissions(prev => 
            prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
        );
    }, []);

    const groupedPermissions = React.useMemo(() => {
        const groups: Record<string, typeof APP_PERMISSIONS[number][]> = {};
        
        APP_PERMISSIONS.forEach(p => {
            if (!groups[p.category]) groups[p.category] = [];
            groups[p.category].push(p);
        });

        return Object.entries(groups).map(([category, perms]) => ({ category, perms }));
    }, []);

    const workspaceOptions = React.useMemo(() => 
        workspaces?.map(w => ({ label: w.name, value: w.id })) || [], 
    [workspaces]);

    return (
 <div className="space-y-6">
 <div className="flex items-center justify-between px-1">
 <div className="text-left">
 <h3 className="text-xl font-semibold tracking-tight text-foreground">Role Architect</h3>
 <p className="text-sm text-muted-foreground font-medium">Define custom identities, multi-track permissions, and workspace bounds.</p>
                </div>
 <Button onClick={() => handleOpenEdit()} className="rounded-xl font-semibold h-11 px-6 shadow-lg gap-2">
 <Plus className="h-4 w-4" /> New Role
                </Button>
            </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
 Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-[2rem]" />)
                ) : roles?.map(role => (
 <Card key={role.id} className="rounded-[2.5rem] glass-card overflow-hidden group text-left">
 <CardHeader className="p-6 pb-4 flex flex-row items-center justify-between border-b bg-muted/5">
 <div className="flex items-center gap-3">
 <div className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: role.color }} />
 <CardTitle className="text-sm font-semibold tracking-tight">{role.name}</CardTitle>
                            </div>
 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleOpenEdit(role)}>
 <Pencil className="h-4 w-4 text-primary" />
                                </Button>
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => handleDelete(role.id)}>
 <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
 <CardContent className="p-6 pt-0 space-y-4">
 <p className="text-xs font-medium text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.5rem] mt-4">{role.description}</p>
                            
 <div className="space-y-3">
 <div className="space-y-1">
 <p className="text-[8px] font-semibold text-muted-foreground/60">Authorized Workspaces</p>
 <div className="flex flex-wrap gap-1">
                                        {role.workspaceIds?.map(wId => (
                                            <Badge key={wId} variant="outline" className="text-[8px] font-semibold uppercase border-primary/20 bg-primary/5 text-primary h-4 px-1.5">{wId}</Badge>
 )) || <span className="text-[8px] text-rose-600 font-semibold ">Unassigned</span>}
                                    </div>
                                </div>
 <div className="space-y-1">
 <p className="text-[8px] font-semibold text-muted-foreground/60">Logic Matrix</p>
 <div className="flex flex-wrap gap-1.5">
                                        {role.permissions?.slice(0, 3).map(p => (
                                            <Badge key={p} variant="outline" className="text-[8px] font-bold uppercase tracking-tighter bg-muted/20 border-none">{p.replace('_', ' ')}</Badge>
                                        ))}
                                        {(role.permissions?.length || 0) > 3 && <Badge variant="outline" className="text-[8px] font-semibold uppercase tabular-nums border-none">+{(role.permissions?.length || 0) - 3}</Badge>}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogContent 
 className="sm:max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem]"
                    onPointerDownOutside={(e) => e.preventDefault()}
                >
 <form onSubmit={handleSave} className="flex flex-col h-full text-left">
 <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
 <ShieldCheck className="h-6 w-6" />
                                </div>
 <div className="text-left">
 <DialogTitle className="text-2xl font-semibold tracking-tight">
                                        {activeRole ? 'Modify Role' : 'Architect Role'}
                                    </DialogTitle>
 <DialogDescription className="text-xs font-bold text-muted-foreground">Define identities and workspace authorization bounds.</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

 <div className="flex-1 overflow-hidden relative bg-background">
 <ScrollArea className="h-full">
 <div className="p-8 space-y-10 pb-20">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
 <div className="space-y-8">
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Identity Label</Label>
                                                <Input 
                                                    value={roleName} 
                                                    onChange={e => setRoleName(e.target.value)} 
                                                    placeholder="e.g. Onboarding Specialist" 
 className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold text-lg px-4" 
                                                    required 
                                                />
                                            </div>
 <div className="space-y-4">
 <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2">
 <Layout className="h-3 w-3" /> Workspace Bound
                                                </Label>
                                                <MultiSelect 
                                                    options={workspaceOptions}
                                                    value={selectedWorkspaces}
                                                    onChange={setSelectedWorkspaces}
                                                    placeholder="Assign to workspaces..."
 className="rounded-xl border-primary/10 shadow-sm"
                                                />
 <p className="text-[9px] font-bold text-muted-foreground tracking-tight leading-relaxed">
                                                    Determines which institutional tracks this role can retrieve data from.
                                                </p>
                                            </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Brand Signature (Color)</Label>
 <div className="flex gap-3">
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <button 
                                                                type="button" 
 className="w-12 h-12 rounded-xl border-2 shadow-sm transition-transform active:scale-95 shrink-0" 
                                                                style={{ backgroundColor: roleColor, borderColor: roleColor + '40' }} 
                                                            />
                                                        </PopoverTrigger>
 <PopoverContent className="w-auto p-3 rounded-2xl border-none shadow-2xl">
 <div className="grid grid-cols-6 gap-2">
                                                                {ONBOARDING_STAGE_COLORS.map(c => (
 <button key={c} type="button" onClick={() => setRoleColor(c)} className="w-6 h-6 rounded-md shadow-sm border border-black/5" style={{ backgroundColor: c }} />
                                                                ))}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                    <Input 
                                                        value={roleColor} 
                                                        onChange={e => setRoleColor(e.target.value)} 
 className="h-12 rounded-xl bg-muted/20 border-none font-mono font-semibold text-center " 
                                                    />
                                                </div>
                                            </div>
                                        </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Scope Description</Label>
                                            <Textarea 
                                                value={roleDescription} 
                                                onChange={e => setRoleDescription(e.target.value)} 
                                                placeholder="Define the purpose and access level of this role..." 
 className="min-h-[220px] rounded-2xl bg-muted/20 border-none shadow-inner p-4 font-medium leading-relaxed" 
                                            />
                                        </div>
                                    </div>

                                    {isSuperAdmin && (
 <div className="p-6 rounded-[2rem] bg-amber-500/10 border border-amber-500/20 flex items-center justify-between shadow-sm text-left">
 <div className="space-y-1">
 <p className="text-sm font-semibold text-amber-900 tracking-tight">Global Default Template</p>
 <p className="text-[10px] text-amber-700 font-bold opacity-80">
                                                    Automatically provision this role to all new organizations.
                                                </p>
                                            </div>
                                            <Switch 
                                                checked={isDefault} 
                                                onCheckedChange={setIsDefault} 
                                            />
                                        </div>
                                    )}

 <Separator className="opacity-50" />

 <div className="space-y-6">
 <div className="flex items-center justify-between px-1">
 <Label className="text-[10px] font-semibold text-primary flex items-center gap-2">
 <Settings2 className="h-3 w-3" /> Permission Mapping
                                            </Label>
                                            <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20 font-semibold tabular-nums">{selectedPermissions.length} Active</Badge>
                                        </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 rounded-[2rem] bg-muted/10 border-2 border-dashed border-border shadow-inner">
                                            {groupedPermissions.map(({ category, perms }) => (
 <div key={category} className="space-y-4">
 <h4 className="text-[10px] font-semibold text-muted-foreground opacity-60 ml-1">{category}</h4>
 <div className="space-y-3">
                                                        {perms.map(p => {
                                                            const isChecked = selectedPermissions.includes(p.id);
                                                            return (
                                                                <div 
                                                                    key={p.id} 
 className={cn(
                                                                        "flex items-center justify-between p-4 rounded-2xl border transition-all",
                                                                        isChecked ? "bg-card border-primary/20 shadow-md ring-1 ring-primary/5" : "bg-muted/30 border-transparent grayscale opacity-60"
                                                                    )}
                                                                >
 <div className="space-y-0.5 flex-1 pr-4">
 <Label htmlFor={p.id} className="cursor-pointer block w-full">
 <p className="text-xs font-semibold tracking-tight">{p.label}</p>
 <p className="text-[9px] font-bold text-muted-foreground opacity-60">{p.id.replace('_', ' ')}</p>
                                                                        </Label>
                                                                    </div>
                                                                    <Switch 
                                                                        id={p.id}
                                                                        checked={isChecked} 
                                                                        onCheckedChange={() => togglePermission(p.id)}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

 <div className="p-6 rounded-[2rem] bg-blue-500/10 border border-blue-500/20 flex items-start gap-5 shadow-sm text-left">
 <div className="p-3 bg-card rounded-2xl text-blue-600 shadow-sm border border-blue-500/20"><Zap className="h-6 w-6" /></div>
 <div className="space-y-1">
 <p className="text-sm font-semibold text-blue-900 tracking-tight">Security Protocol</p>
 <p className="text-[10px] text-blue-700 leading-relaxed font-bold opacity-80">
                                                Role updates are synchronized globally. Ensure at least one workspace is selected to avoid institutional data blocking.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </div>

 <DialogFooter className="bg-muted/30 p-8 border-t shrink-0 flex justify-between items-center sm:justify-between gap-4">
 <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="font-bold rounded-xl h-12 px-10">Discard</Button>
                            <Button 
                                type="submit" 
                                disabled={isSaving || !roleName.trim() || selectedWorkspaces.length === 0} 
 className="rounded-2xl font-semibold h-14 px-16 shadow-2xl bg-primary text-white text-sm gap-2 transition-all active:scale-95"
                            >
 {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {activeRole ? 'Synchronize Architecture' : 'Initialize Role'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

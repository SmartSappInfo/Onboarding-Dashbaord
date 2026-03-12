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
    getDocs, 
    writeBatch 
} from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { 
    type Role, 
    type AppPermissionId, 
    APP_PERMISSIONS 
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { 
    Card, 
    CardContent, 
    CardDescription, 
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
    Check, Settings2, Info, UserCheck, AlertTriangle
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

/**
 * @fileOverview Role & Permission Architect.
 * Allows administrators to define dynamic roles and map them to system permissions.
 */

export default function RoleEditor() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [isEditing, setIsEditing] = React.useState(false);
    const [activeRole, setActiveRole] = React.useState<Role | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    
    const [roleName, setRoleName] = React.useState('');
    const [roleDesc, setRoleDescription] = React.useState('');
    const [roleColor, setRoleColor] = React.useState('#3B5FFF');
    const [selectedPermissions, setSelectedPermissions] = React.useState<AppPermissionId[]>([]);

    const rolesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'roles'), orderBy('createdAt', 'desc')) : null, 
    [firestore]);
    const { data: roles, isLoading } = useCollection<Role>(rolesQuery);

    const handleOpenEdit = (role?: Role) => {
        if (role) {
            setActiveRole(role);
            setRoleName(role.name);
            setRoleDescription(role.description);
            setRoleColor(role.color);
            setSelectedPermissions(role.permissions);
        } else {
            setActiveRole(null);
            setRoleName('');
            setRoleDescription('');
            setRoleColor('#3B5FFF');
            setSelectedPermissions([]);
        }
        setIsEditing(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !roleName.trim()) return;
        setIsSaving(true);

        const roleData = {
            name: roleName.trim(),
            description: roleDesc.trim(),
            color: roleColor,
            permissions: selectedPermissions,
            updatedAt: new Date().toISOString(),
        };

        try {
            if (activeRole) {
                await updateDoc(doc(firestore, 'roles', activeRole.id), roleData);
                
                // FLATTENING LOGIC: When a role is updated, we should ideally refresh 
                // all users with this role. For now, we update the role itself.
                // Dynamic lookups in layout.tsx will handle the rest.
                
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

    const togglePermission = (permId: AppPermissionId) => {
        setSelectedPermissions(prev => 
            prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
        );
    };

    const groupedPermissions = React.useMemo(() => {
        return APP_PERMISSIONS.reduce((acc, p) => {
            if (!acc[p.category]) acc[p.category] = [];
            acc[p.category].push(p);
            return acc;
        }, {} as Record<string, typeof APP_PERMISSIONS[number][]>);
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
                <div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-foreground">Role Architect</h3>
                    <p className="text-sm text-muted-foreground font-medium">Define custom identities and permission mappings.</p>
                </div>
                <Button onClick={() => handleOpenEdit()} className="rounded-xl font-black h-11 px-6 shadow-lg gap-2">
                    <Plus className="h-4 w-4" /> New Role
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-[2rem]" />)
                ) : roles?.map(role => (
                    <Card key={role.id} className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-border bg-white overflow-hidden group hover:ring-primary/20 transition-all">
                        <CardHeader className="p-6 pb-4 flex flex-row items-center justify-between border-b bg-muted/5">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: role.color }} />
                                <CardTitle className="text-sm font-black uppercase tracking-tight">{role.name}</CardTitle>
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
                        <CardContent className="p-6 space-y-4">
                            <p className="text-xs font-medium text-muted-foreground leading-relaxed line-clamp-2">{role.description}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {role.permissions.slice(0, 4).map(p => (
                                    <Badge key={p} variant="outline" className="text-[8px] font-bold uppercase tracking-tighter bg-muted/20">{p.replace('_', ' ')}</Badge>
                                ))}
                                {role.permissions.length > 4 && <Badge variant="outline" className="text-[8px] font-black uppercase tabular-nums">+{role.permissions.length - 4}</Badge>}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogContent className="sm:max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem]">
                    <form onSubmit={handleSave} className="flex flex-col h-full">
                        <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                                    <ShieldCheck className="h-6 w-6" />
                                </div>
                                <div className="text-left">
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                                        {activeRole ? 'Modify Role' : 'Architect Role'}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Map institutional capabilities to this role.</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="flex-1 overflow-hidden relative bg-background">
                            <ScrollArea className="h-full">
                                <div className="p-8 space-y-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Identity Label</Label>
                                                <Input 
                                                    value={roleName} 
                                                    onChange={e => setRoleName(e.target.value)} 
                                                    placeholder="e.g. Regional Manager" 
                                                    className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold text-lg" 
                                                    required 
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Brand Signature (Color)</Label>
                                                <div className="flex gap-3">
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <button 
                                                                type="button" 
                                                                className="w-12 h-12 rounded-xl border-2 shadow-sm transition-transform active:scale-95" 
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
                                                        className="h-12 rounded-xl bg-muted/20 border-none font-mono font-black text-center uppercase" 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Scope Description</Label>
                                            <Textarea 
                                                value={roleDesc} 
                                                onChange={e => setRoleDescription(e.target.value)} 
                                                placeholder="Define the purpose and access level of this role..." 
                                                className="min-h-[135px] rounded-2xl bg-muted/20 border-none shadow-inner p-4 font-medium" 
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between px-1">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                <Settings2 className="h-3 w-3" /> Permission Mapping
                                            </Label>
                                            <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20 font-black tabular-nums">{selectedPermissions.length} Active</Badge>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 rounded-[2rem] bg-muted/10 border-2 border-dashed border-border shadow-inner">
                                            {Object.entries(groupedPermissions).map(([cat, perms]) => (
                                                <div key={cat} className="space-y-4">
                                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60 ml-1">{cat}</h4>
                                                    <div className="space-y-3">
                                                        {perms.map(p => {
                                                            const isChecked = selectedPermissions.includes(p.id);
                                                            return (
                                                                <div 
                                                                    key={p.id} 
                                                                    onClick={() => togglePermission(p.id)}
                                                                    className={cn(
                                                                        "flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer",
                                                                        isChecked ? "bg-white border-primary/20 shadow-md ring-1 ring-primary/5" : "bg-muted/30 border-transparent grayscale opacity-60"
                                                                    )}
                                                                >
                                                                    <div className="space-y-0.5">
                                                                        <p className="text-xs font-black uppercase tracking-tight">{p.label}</p>
                                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">{p.id.replace('_', ' ')}</p>
                                                                    </div>
                                                                    <Switch checked={isChecked} onCheckedChange={() => togglePermission(p.id)} />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-6 rounded-[2rem] bg-blue-50 border border-blue-100 flex items-start gap-5 shadow-sm text-left">
                                        <div className="p-3 bg-white rounded-2xl text-blue-600 shadow-sm border border-blue-100"><Info className="h-6 w-6" /></div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-black text-blue-900 uppercase tracking-tight">Security Note</p>
                                            <p className="text-[10px] text-blue-700 leading-relaxed font-bold uppercase tracking-widest opacity-80">
                                                Role updates are synchronized globally. Any user assigned to this role will have their permissions updated on their next institutional session.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </div>

                        <DialogFooter className="bg-muted/30 p-8 border-t shrink-0 flex justify-between items-center sm:justify-between">
                            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="font-bold rounded-xl h-12 px-10">Discard</Button>
                            <Button 
                                type="submit" 
                                disabled={isSaving || !roleName.trim()} 
                                className="rounded-2xl font-black h-14 px-16 shadow-2xl bg-primary text-white uppercase tracking-widest text-sm gap-2 transition-all active:scale-95"
                            >
                                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                {activeRole ? 'Synchronize Role' : 'Initialize Role'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

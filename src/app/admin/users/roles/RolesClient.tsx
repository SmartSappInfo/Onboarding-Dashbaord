'use client';

import * as React from 'react';
import { 
  collection, 
  orderBy, 
  query, 
  doc, 
  updateDoc, 
  where, 
  addDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase, 
  errorEmitter, 
  FirestorePermissionError 
} from '@/firebase';
import type { Role, PermissionsSchema } from '@/lib/types';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { PermissionEditor } from './PermissionEditor';
import { 
  getBlankPermissions, 
  getFullAdminPermissions,
  getFinancePermissions,
  getMarketingPermissions,
  getOperationsPermissions
} from '@/lib/permissions-engine';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Save, 
  Zap, 
  History, 
  ChevronRight,
  ShieldEllipsis,
  Loader2,
  Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';

export default function RolesClient() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeOrganizationId } = useTenant();
  
  const [selectedRoleId, setSelectedRoleId] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);

  // New Role State
  const [newRoleDialogOpen, setNewRoleDialogOpen] = React.useState(false);
  const [newRoleData, setNewRoleData] = React.useState({ name: '', description: '', color: '#3B82F6', clonedSchema: null as PermissionsSchema | null });
  const [selectedTemplate, setSelectedTemplate] = React.useState<'blank'|'admin'|'finance'|'marketing'|'operations'>('blank');

  // 1. DATA SUBSCRIPTION
  const rolesQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(
        collection(firestore, 'roles'), 
        where('organizationId', '==', activeOrganizationId),
        orderBy('name', 'asc')
    );
  }, [firestore, activeOrganizationId]);

  const { data: roles, isLoading } = useCollection<Role>(rolesQuery);

  const selectedRole = React.useMemo(() => 
    roles?.find(r => r.id === selectedRoleId), 
  [roles, selectedRoleId]);

  // 2. ACTIONS
  const handleSavePermissions = async (schema: PermissionsSchema) => {
    if (!firestore || !selectedRoleId) return;
    setIsSaving(true);

    const roleRef = doc(firestore, 'roles', selectedRoleId);
    try {
      await updateDoc(roleRef, { 
        permissionsSchema: schema,
        updatedAt: new Date().toISOString()
      });
      toast({ title: 'Role Architecture Updated', description: 'Hierarchical permissions have been synchronized.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Update Failed' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateRole = async () => {
    if (!firestore || !activeOrganizationId) return;
    
    let finalSchema = newRoleData.clonedSchema;
    if (!finalSchema) {
      if (selectedTemplate === 'admin') finalSchema = getFullAdminPermissions();
      else if (selectedTemplate === 'finance') finalSchema = getFinancePermissions();
      else if (selectedTemplate === 'marketing') finalSchema = getMarketingPermissions();
      else if (selectedTemplate === 'operations') finalSchema = getOperationsPermissions();
      else finalSchema = getBlankPermissions();
    }

    try {
      const docRef = await addDoc(collection(firestore, 'roles'), {
        name: newRoleData.name,
        description: newRoleData.description,
        color: newRoleData.color,
        organizationId: activeOrganizationId,
        permissions: [],
        permissionsSchema: finalSchema,
        workspaceIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast({ title: 'Role Created', description: `${newRoleData.name} has been added to the registry.` });
      setNewRoleDialogOpen(false);
      setSelectedRoleId(docRef.id);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Creation Failed' });
    }
  };

  const handleDeleteRole = async (roleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!firestore) return;
    setIsDeleting(roleId);
    
    try {
      await deleteDoc(doc(firestore, 'roles', roleId));
      if (selectedRoleId === roleId) setSelectedRoleId(null);
      toast({ title: 'Role Decommissioned' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Deletion Failed' });
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="h-full bg-background relative overflow-y-auto">
      <div className="space-y-10 pb-32">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 text-foreground ">
              <ShieldEllipsis className="h-10 w-10 text-primary" />
              Role Architecture
            </h1>
            <p className="text-muted-foreground font-medium text-lg mt-1">Define structural authorization silos across the organization.</p>
          </div>
          
          <Dialog open={newRoleDialogOpen} onOpenChange={(open) => {
             setNewRoleDialogOpen(open);
             if (!open) {
                // Reset on close
                setNewRoleData({ name: '', description: '', color: '#3B82F6', clonedSchema: null });
                setSelectedTemplate('blank');
             }
          }}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl font-black h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl transition-all active:scale-95">
                <Plus className="mr-2 h-5 w-5" /> New Role Blueprint
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tight">Create Role Blueprint</DialogTitle>
                <CardDescription>Define the core attributes for this administrative silo.</CardDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Blueprint Name</Label>
                  <Input 
                    value={newRoleData.name}
                    onChange={e => setNewRoleData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Regional Manager"
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Architectural Description</Label>
                  <Textarea 
                    value={newRoleData.description}
                    onChange={e => setNewRoleData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Define clear oversight responsibilities..."
                    className="min-h-[100px] rounded-xl"
                  />
                </div>
                {!newRoleData.clonedSchema && (
                   <div className="space-y-2 pb-2">
                     <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Base Template</Label>
                     <select 
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value as any)}
                        className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                     >
                        <option value="blank">Blank Slate</option>
                        <option value="finance">Finance Administrator</option>
                        <option value="marketing">Marketing & Studios</option>
                        <option value="operations">Operations Manager</option>
                        <option value="admin">Super Admin (All Access)</option>
                     </select>
                   </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleCreateRole} disabled={!newRoleData.name} className="w-full h-12 rounded-xl font-bold">
                  Initialize Blueprint
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* List Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="rounded-[2rem] border-none ring-1 ring-border bg-card shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 border-b pb-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Available Silos</CardTitle>
              </CardHeader>
              <CardContent className="p-2 space-y-1">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
                ) : roles?.map(role => (
                  <div 
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all group",
                      selectedRoleId === role.id 
                        ? "bg-primary text-primary-foreground shadow-lg scale-[1.02] z-10" 
                        : "hover:bg-muted/50 text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-inner"
                        style={{ backgroundColor: selectedRoleId === role.id ? 'rgba(255,255,255,0.2)' : `${role.color}20`, color: selectedRoleId === role.id ? '#fff' : role.color }}
                      >
                        {role.name[0].toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold tracking-tight">{role.name}</span>
                        <span className={cn(
                          "text-[10px] font-medium tracking-tighter line-clamp-1",
                          selectedRoleId === role.id ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>
                          {role.description || 'No structural description'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isDeleting === role.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn("h-8 w-8 rounded-lg", selectedRoleId === role.id ? "hover:bg-white/20 text-white" : "text-rose-500 hover:bg-rose-50")}
                          onClick={(e) => handleDeleteRole(role.id, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            
            <Card className="rounded-[2.5rem] border-none ring-1 ring-border bg-amber-50 shadow-inner">
               <CardContent className="p-6">
                  <div className="flex gap-4">
                    <Zap className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
                    <div className="space-y-2">
                       <h4 className="text-sm font-black text-amber-900 uppercase">Hierarchical Notice</h4>
                       <p className="text-[11px] font-medium text-amber-800 leading-relaxed tracking-tighter">
                          Editing these permissions updates the underlying schema used by the new authorization engine. Legacy permissions will be maintained for backward compatibility.
                       </p>
                    </div>
                  </div>
               </CardContent>
            </Card>
          </div>

          {/* Editor Area */}
          <div className="lg:col-span-8">
            {selectedRole ? (
              <div className="space-y-6">
                <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden">
                  <CardHeader className="p-8 border-b bg-muted/20 flex flex-row items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedRole.color }} />
                        <CardTitle className="text-2xl font-black tracking-tight">{selectedRole.name}</CardTitle>
                      </div>
                      <CardDescription className="text-sm font-medium">{selectedRole.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setNewRoleData({ 
                            name: `${selectedRole.name} (Copy)`, 
                            description: selectedRole.description || '', 
                            color: selectedRole.color || '#3B82F6', 
                            clonedSchema: selectedRole.permissionsSchema || getBlankPermissions() 
                          });
                          setSelectedTemplate('blank');
                          setNewRoleDialogOpen(true);
                        }}
                        className="rounded-xl px-4"
                      >
                        <Copy className="mr-2 h-4 w-4" /> Clone
                      </Button>
                      <Button 
                        onClick={() => handleSavePermissions(selectedRole.permissionsSchema || getBlankPermissions())}
                        disabled={isSaving}
                        className="rounded-xl font-black px-6 bg-primary"
                      >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Sync Architecture
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8">
                    <PermissionEditor 
                      schema={selectedRole.permissionsSchema || getBlankPermissions()}
                      onChange={(schema) => {
                        // Optimistic update for UI feel, but we save on button click
                        // In a real app we might want a 'draft' state or just auto-save
                        // For now we'll just handle it via handleSavePermissions
                      }}
                    />
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="h-[60vh] flex flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-border p-12 text-center bg-muted/10">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
                  <ShieldCheck className="h-10 w-10 text-muted-foreground opacity-30" />
                </div>
                <h3 className="text-xl font-black text-foreground mb-2">Select a Blueprint</h3>
                <p className="text-muted-foreground max-w-xs font-medium leading-relaxed">
                  Choose a role from the registry to inspect and modify its structural permissions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

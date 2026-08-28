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
  useMemoFirebase 
} from '@/firebase';
import type { Role, PermissionsSchema } from '@/lib/types';
import { 
  getBlankPermissions, 
  getFullAdminPermissions,
  normalizePermissionsSchema,
  flattenPermissionsSchema,
  migrateToPermissionsSchema
} from '@/lib/permissions-engine';
import { getPublishedTemplatesAction } from '@/lib/backoffice/backoffice-template-actions';
import type { PlatformTemplate } from '@/lib/backoffice/backoffice-types';
import { 
  CANONICAL_ROLE_BLUEPRINTS, 
  groupBlueprintsByIndustry 
} from '@/lib/role-blueprint-presets';
import { INDUSTRY_LABELS } from '@/lib/industry-config';
import type { IndustryVertical } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Save, 
  Zap, 
  ChevronDown,
  Loader2,
  Copy,
  Layers
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
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { PermissionEditor } from './PermissionEditor';

/**
 * Calculates capability summary count of enabled features per section.
 */
function getTemplateCapabilitySummary(schema: PermissionsSchema) {
  const normalized = normalizePermissionsSchema(schema);
  const countViewable = (features: Record<string, { view: boolean }>) => 
    Object.values(features).filter(f => f.view).length;

  return {
    operations: normalized.operations.enabled ? countViewable(normalized.operations.features) : 0,
    finance: normalized.finance.enabled ? countViewable(normalized.finance.features) : 0,
    studios: normalized.studios.enabled ? countViewable(normalized.studios.features) : 0,
    management: normalized.management.enabled ? countViewable(normalized.management.features) : 0,
  };
}

export default function RolesClient() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeOrganizationId, activeWorkspace } = useTenant();
  const activeIndustry = activeWorkspace?.industry;
  
  const [selectedRoleId, setSelectedRoleId] = React.useState<string | null>(null);
  const [editedSchema, setEditedSchema] = React.useState<PermissionsSchema | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);

  // Synchronously initialize with CANONICAL_ROLE_BLUEPRINTS so all 22 presets are available immediately on mount
  const [platformTemplates, setPlatformTemplates] = React.useState<PlatformTemplate[]>(CANONICAL_ROLE_BLUEPRINTS);
  const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = React.useState(false);

  // New Role State
  const [newRoleDialogOpen, setNewRoleDialogOpen] = React.useState(false);
  const [newRoleData, setNewRoleData] = React.useState({ 
    name: '', 
    description: '', 
    color: '#3B82F6', 
    clonedSchema: null as PermissionsSchema | null 
  });
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>('builtin-super-admin');

  // Group templates by active industry vertical and universal governance
  const groupedTemplates = React.useMemo(() => {
    return groupBlueprintsByIndustry(platformTemplates, activeIndustry);
  }, [platformTemplates, activeIndustry]);

  // Load Platform Templates (role-architecture blueprints).
  // Uses tenant-authorized published templates action, ensuring standard organization admins
  // have full access to platform blueprints without requiring backoffice superadmin claims.
  React.useEffect(() => {
    async function loadTemplates() {
      setIsLoadingTemplates(true);
      try {
        const res = await getPublishedTemplatesAction('role_architecture', activeIndustry, activeOrganizationId);
        if (res.success && res.data && res.data.length > 0) {
          setPlatformTemplates(res.data);
        }
      } catch (error) {
        console.error('[ROLES_HUB] Failed to load platform templates:', error);
      } finally {
        setIsLoadingTemplates(false);
      }
    }

    if (activeOrganizationId) {
      loadTemplates();
    }
  }, [activeOrganizationId, activeIndustry]);

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
  
  // Set edited schema when selected role changes
  React.useEffect(() => {
    if (selectedRole) {
      setEditedSchema(
        selectedRole.permissionsSchema 
          ? normalizePermissionsSchema(selectedRole.permissionsSchema) 
          : migrateToPermissionsSchema(selectedRole.permissions || [])
      );
    } else {
      setEditedSchema(null);
    }
  }, [selectedRole]);

  // Derive preview schema for the modal
  const activeBlueprintSchema = React.useMemo<PermissionsSchema>(() => {
    if (newRoleData.clonedSchema) {
      return normalizePermissionsSchema(newRoleData.clonedSchema);
    }
    if (selectedTemplateId === 'blank') {
      return getBlankPermissions();
    }
    if (selectedTemplateId === 'admin' || selectedTemplateId === 'builtin-super-admin') {
      return getFullAdminPermissions();
    }
    const found = platformTemplates.find(t => t.id === selectedTemplateId);
    return found ? normalizePermissionsSchema(found.content) : getBlankPermissions();
  }, [newRoleData.clonedSchema, selectedTemplateId, platformTemplates]);

  const capabilitySummary = React.useMemo(() => 
    getTemplateCapabilitySummary(activeBlueprintSchema),
  [activeBlueprintSchema]);

  // 2. ACTIONS
  const handleSavePermissions = async () => {
    if (!firestore || !selectedRoleId || !editedSchema) return;
    setIsSaving(true);

    const roleRef = doc(firestore, 'roles', selectedRoleId);
    try {
      const normalized = normalizePermissionsSchema(editedSchema);
      const flatPermissions = flattenPermissionsSchema(normalized);

      await updateDoc(roleRef, { 
        permissions: flatPermissions,
        permissionsSchema: normalized,
        updatedAt: new Date().toISOString()
      });
      toast({ title: 'Role Architecture Updated', description: 'Hierarchical permissions have been synchronized.' });
    } catch {
      toast({ variant: 'destructive', title: 'Update Failed' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateRole = async () => {
    if (!firestore || !activeOrganizationId || !newRoleData.name.trim()) return;
    
    const finalSchema = activeBlueprintSchema;
    const flatPermissions = flattenPermissionsSchema(finalSchema);

    try {
      const docRef = await addDoc(collection(firestore, 'roles'), {
        name: newRoleData.name.trim(),
        description: newRoleData.description.trim(),
        color: newRoleData.color,
        organizationId: activeOrganizationId,
        permissions: flatPermissions,
        permissionsSchema: finalSchema,
        workspaceIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast({ title: 'Role Created', description: `${newRoleData.name} has been added to the registry.` });
      setNewRoleDialogOpen(false);
      setSelectedRoleId(docRef.id);
    } catch {
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
    } catch {
      toast({ variant: 'destructive', title: 'Deletion Failed' });
    } finally {
      setIsDeleting(null);
    }
  };

    return (
    <div className="space-y-8 pb-32 w-full p-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex flex-col items-start">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Roles & Permissions Hub
                        </h1>
                        <p className="text-muted-foreground font-medium text-sm mt-1">
                            Define structural authorization silos across the organization
                        </p>
                    </div>
                    
                    <Dialog open={newRoleDialogOpen} onOpenChange={(open) => {
                         setNewRoleDialogOpen(open);
                         if (!open) {
                            setNewRoleData({ name: '', description: '', color: '#3B82F6', clonedSchema: null });
                            setSelectedTemplateId('blank');
                         }
                    }}>
                        <DialogTrigger asChild>
                            <Button className="rounded-xl font-bold h-11 px-8 active:scale-95 text-foreground bg-transparent ring-1 ring-border shadow-sm">
                                <Plus className="mr-2 h-5 w-5" /> New Role Blueprint
                            </Button>
                        </DialogTrigger>
            <DialogContent className="rounded-2xl border-none shadow-2xl p-6 sm:p-8 max-w-lg max-h-[88vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold tracking-tight">Create Role Blueprint</DialogTitle>
                    <CardDescription className="text-xs">Define the core attributes and starting authorization matrix.</CardDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Blueprint Name</Label>
                  <Input 
                    value={newRoleData.name}
                    onChange={e => setNewRoleData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Regional Manager"
                    className="h-11 sm:h-12 rounded-xl text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Architectural Description</Label>
                  <Textarea 
                    value={newRoleData.description}
                    onChange={e => setNewRoleData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Define clear oversight responsibilities..."
                    className="min-h-[80px] rounded-xl text-sm"
                  />
                </div>

                {newRoleData.clonedSchema ? (
                  <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3">
                    <Copy className="h-4 w-4 text-blue-500 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Cloned Role Architecture</p>
                      <p className="text-[10px] text-muted-foreground">Permissions copied from source role will be assigned upon initialization.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-1">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Base Template Blueprint</Label>
                      {isLoadingTemplates && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                        </span>
                      )}
                    </div>

                    <select 
                      value={selectedTemplateId}
                      onChange={(e) => {
                        setSelectedTemplateId(e.target.value);
                        setIsPreviewExpanded(false);
                      }}
                      className="flex h-11 sm:h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="blank">Blank Slate (0 Permissions)</option>

                      {groupedTemplates.recommended.length > 0 && (
                        <optgroup label={`🌟 Recommended for ${activeIndustry ? (INDUSTRY_LABELS[activeIndustry as IndustryVertical] || activeIndustry) : 'Active Industry'}`}>
                          {groupedTemplates.recommended.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </optgroup>
                      )}

                      <optgroup label="🏢 Universal & Executive Governance">
                        {groupedTemplates.universal.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>

                      {groupedTemplates.otherVerticals.map((group) => (
                        <optgroup key={group.category} label={`📦 ${group.category} Vertical`}>
                          {group.blueprints.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    {/* Live Blueprint Capability Preview Card */}
                    <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-primary" />
                          Capability Scope
                          {selectedTemplateId !== 'blank' && (
                            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary uppercase">
                              {platformTemplates.find((t) => t.id === selectedTemplateId)?.category || 'Blueprint'}
                            </span>
                          )}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                          className="h-6 px-2 text-[10px] font-semibold text-primary hover:bg-primary/10 rounded-lg active:scale-[0.97]"
                        >
                          {isPreviewExpanded ? 'Hide Details' : 'Inspect Permissions'}
                          <ChevronDown className={cn("ml-1 h-3 w-3 transition-transform duration-200", isPreviewExpanded && "rotate-180")} />
                        </Button>
                      </div>

                      {/* Capability Summary Badges */}
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        <div className="bg-background border border-border rounded-lg p-2 text-center">
                          <span className="text-[9px] font-bold text-muted-foreground block uppercase">Ops</span>
                          <span className="text-xs font-black text-foreground">{capabilitySummary.operations}</span>
                        </div>
                        <div className="bg-background border border-border rounded-lg p-2 text-center">
                          <span className="text-[9px] font-bold text-muted-foreground block uppercase">Finance</span>
                          <span className="text-xs font-black text-foreground">{capabilitySummary.finance}</span>
                        </div>
                        <div className="bg-background border border-border rounded-lg p-2 text-center">
                          <span className="text-[9px] font-bold text-muted-foreground block uppercase">Studios</span>
                          <span className="text-xs font-black text-foreground">{capabilitySummary.studios}</span>
                        </div>
                        <div className="bg-background border border-border rounded-lg p-2 text-center">
                          <span className="text-[9px] font-bold text-muted-foreground block uppercase">Mgmt</span>
                          <span className="text-xs font-black text-foreground">{capabilitySummary.management}</span>
                        </div>
                      </div>

                      {/* Collapsible Detailed Permissions Preview */}
                      {isPreviewExpanded && (
                        <div className="max-h-[220px] overflow-y-auto rounded-lg border border-border bg-background p-2 mt-2">
                          <PermissionEditor
                            schema={activeBlueprintSchema}
                            onChange={() => {}}
                            readOnly={true}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button 
                  onClick={handleCreateRole} 
                  disabled={!newRoleData.name.trim()} 
                  className="w-full h-11 sm:h-12 rounded-xl font-bold active:scale-[0.97] transition-transform"
                >
                  <Plus className="mr-2 h-4 w-4" /> Initialize Blueprint
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* List Sidebar */}
                    <div className="lg:col-span-4 space-y-4">
                        <Card className="rounded-2xl border-none ring-1 ring-border bg-card shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 border-b pb-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Available Silos</CardTitle>
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
            
            <Card className="rounded-2xl border-none ring-1 ring-border bg-amber-500/5 shadow-inner">
               <CardContent className="p-6">
                  <div className="flex gap-4">
                    <Zap className="h-6 w-6 text-amber-500 shrink-0 mt-1" />
                    <div className="space-y-2">
                       <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Hierarchical Notice</h4>
                       <p className="text-[11px] font-medium text-amber-700/80 leading-relaxed">
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
                <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-card overflow-hidden">
                  <CardHeader className="p-8 border-b bg-muted/20 flex flex-row items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedRole.color }} />
                        <CardTitle className="text-xl font-bold tracking-tight">{selectedRole.name}</CardTitle>
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
                            clonedSchema: selectedRole.permissionsSchema 
                              ? normalizePermissionsSchema(selectedRole.permissionsSchema)
                              : migrateToPermissionsSchema(selectedRole.permissions || [])
                          });
                          setSelectedTemplateId('blank');
                          setNewRoleDialogOpen(true);
                        }}
                        className="rounded-xl px-4 active:scale-[0.97] transition-transform"
                      >
                        <Copy className="mr-2 h-4 w-4" /> Clone
                      </Button>
                      <Button 
                        onClick={handleSavePermissions}
                        disabled={isSaving || !editedSchema}
                        className="rounded-xl font-black px-6 bg-primary active:scale-[0.97] transition-transform"
                      >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Sync Architecture
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8">
                    {editedSchema && (
                      <PermissionEditor 
                        schema={editedSchema}
                        onChange={(schema) => setEditedSchema(schema)}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="h-[60vh] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-12 text-center bg-muted/10">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
                  <ShieldCheck className="h-10 w-10 text-muted-foreground opacity-30" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Select a Blueprint</h3>
                <p className="text-sm text-muted-foreground max-w-xs font-medium leading-relaxed">
                  Choose a role from the registry to inspect and modify its structural permissions.
                </p>
              </div>
            )}
          </div>
        </div>
        </div>
    );
}

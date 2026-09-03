'use client';

/**
 * @fileOverview Roles & Permissions Hub 2.0 (`/admin/users/roles`)
 *
 * Comprehensive role governance center featuring:
 * - Interactive 2D Permission Explorer Matrix
 * - What-If Access Simulator Sandbox
 * - Role Builder & Blueprint Cloner with 22 canonical industry presets
 * - Emil Kowalski spring animations and mobile-first card reflow
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 * - Enforces privilege escalation defense and atomic dual-write synchronization.
 */

import * as React from 'react';
import { 
  collection, 
  orderBy, 
  query, 
  where 
} from 'firebase/firestore';
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase,
  useUser 
} from '@/firebase';
import type { Role, PermissionsSchema, Workspace } from '@/lib/types';
import { 
  normalizePermissionsSchema,
  flattenPermissionsSchema,
} from '@/lib/permissions-engine';
import { CANONICAL_ROLE_BLUEPRINTS } from '@/lib/role-blueprint-presets';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Save, 
  Zap, 
  Layers,
  Sparkles,
  Grid3X3,
  SlidersHorizontal,
  Info,
  Loader2,
  Lock,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useTenant } from '@/context/TenantContext';
import Link from 'next/link';

import { PermissionEditor } from './PermissionEditor';
import { PermissionExplorerMatrix } from './components/PermissionExplorerMatrix';
import { RoleBuilderDrawer } from './components/RoleBuilderDrawer';
import { AccessSimulatorSheet } from './components/AccessSimulatorSheet';
import { deleteRoleAction, createOrUpdateRoleAction } from '@/app/actions/authorization-actions';

export default function RolesClient() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { user: authUser } = useUser();
  const { activeOrganizationId, activeWorkspace, accessibleWorkspaces } = useTenant();

  const [activeTab, setActiveTab] = React.useState<'roles' | 'matrix'>('roles');
  const [selectedRoleId, setSelectedRoleId] = React.useState<string | null>(null);
  const [editedSchema, setEditedSchema] = React.useState<PermissionsSchema | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);

  // Modal & Drawer State
  const [isRoleBuilderOpen, setIsRoleBuilderOpen] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<Role | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = React.useState(false);

  // 1. DATA SUBSCRIPTION - ORG ROLES
  const rolesQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(
      collection(firestore, 'roles'),
      where('organizationId', '==', activeOrganizationId),
      orderBy('name', 'asc')
    );
  }, [firestore, activeOrganizationId]);

  const { data: roles, isLoading } = useCollection<Role>(rolesQuery);

  const selectedRole = React.useMemo(
    () => roles?.find((r) => r.id === selectedRoleId),
    [roles, selectedRoleId]
  );

  // Set edited schema when selected role changes
  React.useEffect(() => {
    if (selectedRole) {
      setEditedSchema(
        selectedRole.permissionsSchema
          ? normalizePermissionsSchema(selectedRole.permissionsSchema)
          : null
      );
    } else {
      setEditedSchema(null);
    }
  }, [selectedRole]);

  // Handle direct save from detail pane
  const handleSavePermissions = async () => {
    if (!authUser || !activeOrganizationId || !selectedRoleId || !editedSchema || !selectedRole) return;
    setIsSaving(true);

    try {
      const idToken = await authUser.getIdToken();
      const res = await createOrUpdateRoleAction({
        idToken,
        organizationId: activeOrganizationId,
        roleId: selectedRoleId,
        data: {
          name: selectedRole.name,
          description: selectedRole.description,
          color: selectedRole.color,
          category: selectedRole.category,
          permissionsSchema: editedSchema,
        },
      });

      if (res.success) {
        toast({
          title: 'Role Architecture Updated',
          description: `Permissions synchronized for '${selectedRole.name}'.`,
        });
      } else {
        throw new Error(res.error || 'Failed to update role');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast({
        title: 'Update Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle role deletion
  const handleDeleteRole = async (roleId: string, roleName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authUser || !activeOrganizationId) return;

    const ok = await confirm({
      title: 'Delete Role Blueprint?',
      description: `Are you sure you want to delete '${roleName}'? This action is permanent.`,
      confirmText: 'Delete Role',
      variant: 'destructive',
    });
    if (!ok) return;

    setIsDeleting(roleId);
    try {
      const idToken = await authUser.getIdToken();
      const res = await deleteRoleAction({
        idToken,
        organizationId: activeOrganizationId,
        roleId,
      });

      if (res.success) {
        if (selectedRoleId === roleId) setSelectedRoleId(null);
        toast({ title: 'Role Decommissioned', description: `Role '${roleName}' removed.` });
      } else {
        throw new Error(res.error || 'Failed to delete role');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deletion failed';
      toast({
        title: 'Deletion Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const allRolesList = roles || [];

  return (
    <div className="space-y-6 pb-32 w-full p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
              <Link href="/admin/users">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to People
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" /> Roles & Permissions Architecture
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define hierarchical permission schemas, explore 2D authorization matrices, and simulate capabilities
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsSimulatorOpen(true)}
            className="rounded-xl font-medium h-10 px-4 border-border hover:bg-muted text-foreground text-sm active:scale-[0.97]"
          >
            <Sparkles className="h-4 w-4 mr-2 text-primary" /> Access Simulator
          </Button>
          <Button
            type="button"
            onClick={() => {
              setEditingRole(null);
              setIsRoleBuilderOpen(true);
            }}
            className="rounded-xl font-semibold h-10 px-4 shadow-sm active:scale-[0.97] text-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" /> New Role Blueprint
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'roles' | 'matrix')}>
        <TabsList className="h-10 bg-card border p-1 rounded-xl">
          <TabsTrigger
            value="roles"
            className="text-xs font-semibold px-4 h-8 rounded-lg transition-all text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            <Layers className="w-3.5 h-3.5 mr-1.5" /> Roles & Blueprints ({allRolesList.length})
          </TabsTrigger>
          <TabsTrigger
            value="matrix"
            className="text-xs font-semibold px-4 h-8 rounded-lg transition-all text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            <Grid3X3 className="w-3.5 h-3.5 mr-1.5" /> Permission Matrix Explorer
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Roles & Detail Editor */}
        <TabsContent value="roles" className="space-y-6 pt-2 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Roles Sidebar List */}
            <div className="lg:col-span-1 space-y-3">
              <Card className="rounded-xl border bg-card/60 backdrop-blur-sm overflow-hidden shadow-xs">
                <CardHeader className="bg-muted/20 border-b px-4 py-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Available Roles
                  </CardTitle>
                  <Badge variant="secondary" className="text-[10px] font-semibold">
                    {allRolesList.length} Active
                  </Badge>
                </CardHeader>
                <CardContent className="p-2 space-y-1.5">
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-lg" />
                    ))
                  ) : allRolesList.length > 0 ? (
                    allRolesList.map((role) => {
                      const isSelected = selectedRoleId === role.id;
                      const isSystem = role.id.startsWith('builtin-');

                      return (
                        <div
                          key={role.id}
                          onClick={() => setSelectedRoleId(role.id)}
                          className={cn(
                            'p-3 rounded-xl border transition-all cursor-pointer group text-left space-y-1',
                            isSelected
                              ? 'border-primary/50 bg-primary/5 shadow-xs ring-1 ring-primary/20'
                              : 'border-transparent hover:bg-muted/40'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
                              <span className="text-xs font-bold text-foreground truncate">{role.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {isSystem && (
                                <Badge variant="outline" className="text-[8px] px-1 py-0 bg-muted/40">
                                  Preset
                                </Badge>
                              )}
                              {!isSystem && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => handleDeleteRole(role.id, role.name, e)}
                                  disabled={isDeleting === role.id}
                                  className="h-6 w-6 text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>

                          <p className="text-[10px] text-muted-foreground line-clamp-1">
                            {role.description || 'No description provided.'}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No roles defined yet. Click &quot;New Role Blueprint&quot; to create one.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Role Schema Detail Inspector */}
            <div className="lg:col-span-2 space-y-4">
              {selectedRole && editedSchema ? (
                <Card className="rounded-xl border bg-card shadow-xs overflow-hidden">
                  <CardHeader className="bg-muted/20 border-b p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: selectedRole.color }} />
                      <div>
                        <CardTitle className="text-base font-bold text-foreground">{selectedRole.name}</CardTitle>
                        <CardDescription className="text-xs">{selectedRole.description}</CardDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingRole(selectedRole);
                          setIsRoleBuilderOpen(true);
                        }}
                        className="text-xs h-8 px-3 active:scale-[0.97]"
                      >
                        Edit Metadata
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSavePermissions}
                        disabled={isSaving}
                        className="text-xs h-8 px-4 font-semibold active:scale-[0.97]"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5 mr-1.5" /> Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4">
                    <PermissionEditor
                      schema={editedSchema}
                      onChange={setEditedSchema}
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="p-12 text-center border rounded-xl bg-card/60 text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <ShieldCheck className="w-10 h-10 text-muted-foreground/40" />
                  <p className="font-semibold text-foreground">Select a Role Blueprint</p>
                  <p className="text-muted-foreground max-w-sm">
                    Choose a role from the sidebar to inspect its fine-grained permissions, or author a new role blueprint.
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Permission Explorer Matrix */}
        <TabsContent value="matrix" className="pt-2 m-0">
          <PermissionExplorerMatrix roles={allRolesList} />
        </TabsContent>
      </Tabs>

      {/* Role Builder Slide-Over Drawer */}
      <RoleBuilderDrawer
        isOpen={isRoleBuilderOpen}
        onClose={() => {
          setIsRoleBuilderOpen(false);
          setEditingRole(null);
        }}
        existingRole={editingRole}
        onRoleSaved={(savedRole) => {
          setSelectedRoleId(savedRole.id);
        }}
      />

      {/* Access Simulator Sheet */}
      <AccessSimulatorSheet
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        roles={allRolesList}
        workspaces={accessibleWorkspaces}
      />
    </div>
  );
}

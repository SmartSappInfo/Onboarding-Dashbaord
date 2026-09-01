'use client';

/**
 * @fileOverview Teams & Departments Hierarchy Manager (Workforce 2.0)
 *
 * Interactive visual organization tree and cards for creating and configuring
 * organizational departments, team leads, cross-functional teams, and member assignments.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Dialogs with Emil Kowalski spring easing (`cubic-bezier(0.32, 0.72, 0, 1)`).
 * - Mobile ergonomics: card reflow on `<768px` with clear touch targets.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  Users,
  Building2,
  Plus,
  Trash2,
  Edit2,
  Crown,
  Briefcase,
  Layers,
  Loader2,
  Save,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Department, Team, PersonDetailView, Workspace } from '@/lib/types';
import {
  createOrUpdateDepartmentAction,
  deleteDepartmentAction,
  createOrUpdateTeamAction,
  deleteTeamAction,
} from '@/app/actions/workforce-actions';

interface TeamsDepartmentsManagerProps {
  departments: Department[];
  teams: Team[];
  people: PersonDetailView[];
  workspaces: Workspace[];
  onRefresh: () => void;
}

export function TeamsDepartmentsManager({
  departments,
  teams,
  people,
  workspaces,
  onRefresh,
}: TeamsDepartmentsManagerProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [activeTab, setActiveTab] = React.useState<'departments' | 'teams'>('departments');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Department Modal State
  const [deptModalOpen, setDeptModalOpen] = React.useState(false);
  const [editingDept, setEditingDept] = React.useState<Department | null>(null);
  const [deptName, setDeptName] = React.useState('');
  const [deptCode, setDeptCode] = React.useState('');
  const [deptDesc, setDeptDesc] = React.useState('');
  const [deptHeadId, setDeptHeadId] = React.useState<string>('none');
  const [isSavingDept, setIsSavingDept] = React.useState(false);

  // Team Modal State
  const [teamModalOpen, setTeamModalOpen] = React.useState(false);
  const [editingTeam, setEditingTeam] = React.useState<Team | null>(null);
  const [teamName, setTeamName] = React.useState('');
  const [teamDesc, setTeamDesc] = React.useState('');
  const [teamWorkspaceId, setTeamWorkspaceId] = React.useState<string>('none');
  const [teamDeptId, setTeamDeptId] = React.useState<string>('none');
  const [teamLeadId, setTeamLeadId] = React.useState<string>('none');
  const [teamMemberIds, setTeamMemberIds] = React.useState<string[]>([]);
  const [isSavingTeam, setIsSavingTeam] = React.useState(false);

  const peopleOptions = people.map((p) => ({
    label: p.person.displayName || p.person.email,
    value: p.person.id,
  }));

  // Open Department Modal
  const handleOpenDeptModal = (dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setDeptName(dept.name);
      setDeptCode(dept.code);
      setDeptDesc(dept.description || '');
      setDeptHeadId(dept.headPersonId || 'none');
    } else {
      setEditingDept(null);
      setDeptName('');
      setDeptCode('');
      setDeptDesc('');
      setDeptHeadId('none');
    }
    setDeptModalOpen(true);
  };

  // Open Team Modal
  const handleOpenTeamModal = (team?: Team) => {
    if (team) {
      setEditingTeam(team);
      setTeamName(team.name);
      setTeamDesc(team.description || '');
      setTeamWorkspaceId(team.workspaceId || 'none');
      setTeamDeptId(team.departmentId || 'none');
      setTeamLeadId(team.leadPersonId || 'none');
      setTeamMemberIds(team.memberPersonIds || []);
    } else {
      setEditingTeam(null);
      setTeamName('');
      setTeamDesc('');
      setTeamWorkspaceId(workspaces[0]?.id || 'none');
      setTeamDeptId(departments[0]?.id || 'none');
      setTeamLeadId('none');
      setTeamMemberIds([]);
    }
    setTeamModalOpen(true);
  };

  // Save Department
  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !activeOrganizationId) return;

    if (!deptName.trim()) {
      toast({ title: 'Validation Error', description: 'Department name is required.', variant: 'destructive' });
      return;
    }

    setIsSavingDept(true);
    try {
      const idToken = await authUser.getIdToken();
      const headPerson = people.find((p) => p.person.id === deptHeadId)?.person;

      const res = await createOrUpdateDepartmentAction({
        idToken,
        organizationId: activeOrganizationId,
        departmentId: editingDept?.id,
        data: {
          name: deptName.trim(),
          code: deptCode.trim() || undefined,
          description: deptDesc.trim(),
          headPersonId: deptHeadId !== 'none' ? deptHeadId : undefined,
          headPersonName: headPerson?.displayName,
        },
      });

      if (res.success) {
        toast({
          title: editingDept ? 'Department Updated' : 'Department Created',
          description: `Department '${res.department?.name}' saved successfully.`,
        });
        setDeptModalOpen(false);
        onRefresh();
      } else {
        throw new Error(res.error || 'Failed to save department');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast({ title: 'Operation Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSavingDept(false);
    }
  };

  // Delete Department
  const handleDeleteDepartment = async (deptId: string, deptName: string) => {
    if (!authUser || !activeOrganizationId) return;

    const ok = await confirm({
      title: `Delete Department '${deptName}'?`,
      description: 'This will remove the department definition. Make sure no members are assigned.',
      confirmText: 'Delete Department',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const idToken = await authUser.getIdToken();
      const res = await deleteDepartmentAction({
        idToken,
        organizationId: activeOrganizationId,
        departmentId: deptId,
      });

      if (res.success) {
        toast({ title: 'Department Removed' });
        onRefresh();
      } else {
        throw new Error(res.error || 'Failed to delete department');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deletion failed';
      toast({ title: 'Delete Failed', description: msg, variant: 'destructive' });
    }
  };

  // Save Team
  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !activeOrganizationId) return;

    if (!teamName.trim()) {
      toast({ title: 'Validation Error', description: 'Team name is required.', variant: 'destructive' });
      return;
    }

    setIsSavingTeam(true);
    try {
      const idToken = await authUser.getIdToken();
      const leadPerson = people.find((p) => p.person.id === teamLeadId)?.person;
      const ws = workspaces.find((w) => w.id === teamWorkspaceId);
      const dept = departments.find((d) => d.id === teamDeptId);

      const res = await createOrUpdateTeamAction({
        idToken,
        organizationId: activeOrganizationId,
        teamId: editingTeam?.id,
        data: {
          name: teamName.trim(),
          description: teamDesc.trim(),
          workspaceId: teamWorkspaceId !== 'none' ? teamWorkspaceId : undefined,
          workspaceName: ws?.name,
          departmentId: teamDeptId !== 'none' ? teamDeptId : undefined,
          departmentName: dept?.name,
          leadPersonId: teamLeadId !== 'none' ? teamLeadId : undefined,
          leadPersonName: leadPerson?.displayName,
          memberPersonIds: teamMemberIds,
        },
      });

      if (res.success) {
        toast({
          title: editingTeam ? 'Team Updated' : 'Team Created',
          description: `Team '${res.team?.name}' saved successfully.`,
        });
        setTeamModalOpen(false);
        onRefresh();
      } else {
        throw new Error(res.error || 'Failed to save team');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast({ title: 'Operation Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSavingTeam(false);
    }
  };

  // Delete Team
  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!authUser || !activeOrganizationId) return;

    const ok = await confirm({
      title: `Delete Team '${teamName}'?`,
      description: 'This will remove the team and unbind it from member records.',
      confirmText: 'Delete Team',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const idToken = await authUser.getIdToken();
      const res = await deleteTeamAction({
        idToken,
        organizationId: activeOrganizationId,
        teamId,
      });

      if (res.success) {
        toast({ title: 'Team Removed' });
        onRefresh();
      } else {
        throw new Error(res.error || 'Failed to delete team');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deletion failed';
      toast({ title: 'Delete Failed', description: msg, variant: 'destructive' });
    }
  };

  const filteredDepts = departments.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTeams = teams.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border">
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'departments' | 'teams')}>
          <TabsList className="h-9 bg-muted/40 p-0.5">
            <TabsTrigger value="departments" className="text-xs px-3 h-8">
              <Building2 className="w-3.5 h-3.5 mr-1.5" /> Departments ({departments.length})
            </TabsTrigger>
            <TabsTrigger value="teams" className="text-xs px-3 h-8">
              <Users className="w-3.5 h-3.5 mr-1.5" /> Teams ({teams.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8.5 text-xs bg-muted/20 border-border"
            />
          </div>

          {activeTab === 'departments' ? (
            <Button
              type="button"
              size="sm"
              onClick={() => handleOpenDeptModal()}
              className="text-xs h-8.5 px-3 font-semibold active:scale-[0.97]"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Department
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => handleOpenTeamModal()}
              className="text-xs h-8.5 px-3 font-semibold active:scale-[0.97]"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Team
            </Button>
          )}
        </div>
      </div>

      {/* Tab 1: Departments */}
      {activeTab === 'departments' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDepts.length > 0 ? (
            filteredDepts.map((dept) => (
              <Card key={dept.id} className="border bg-card shadow-xs hover:border-primary/40 transition-all">
                <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-bold text-foreground">{dept.name}</CardTitle>
                      <Badge variant="outline" className="text-[10px] font-mono uppercase bg-muted/30">
                        {dept.code}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs line-clamp-1">{dept.description || 'No description'}</CardDescription>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDeptModal(dept)}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                      className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-2 space-y-2 text-xs border-t bg-muted/5">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-500" /> Head of Department
                    </span>
                    <span className="font-semibold text-foreground">{dept.headPersonName || 'Unassigned'}</span>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary" /> Active Members
                    </span>
                    <Badge variant="secondary" className="text-[10px] font-bold">
                      {people.filter((p) => p.person.departmentId === dept.id).length} Assigned
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full p-12 text-center border rounded-xl bg-muted/10 text-xs text-muted-foreground">
              No departments created yet. Click &quot;Add Department&quot; to establish organizational units.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Teams */}
      {activeTab === 'teams' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.length > 0 ? (
            filteredTeams.map((team) => (
              <Card key={team.id} className="border bg-card shadow-xs hover:border-primary/40 transition-all">
                <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team.color || '#3B82F6' }} />
                      <CardTitle className="text-sm font-bold text-foreground">{team.name}</CardTitle>
                    </div>
                    <CardDescription className="text-xs line-clamp-1">{team.description || 'No description'}</CardDescription>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenTeamModal(team)}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteTeam(team.id, team.name)}
                      className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-2 space-y-2 text-xs border-t bg-muted/5">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-primary" /> Team Lead
                    </span>
                    <span className="font-semibold text-foreground">{team.leadPersonName || 'Unassigned'}</span>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" /> Scope
                    </span>
                    <span className="font-medium text-foreground">{team.workspaceName || team.departmentName || 'Global'}</span>
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-muted-foreground">Team Size:</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {team.memberPersonIds?.length || 0} Members
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full p-12 text-center border rounded-xl bg-muted/10 text-xs text-muted-foreground">
              No cross-functional teams created yet. Click &quot;Add Team&quot; to organize workforce squads.
            </div>
          )}
        </div>
      )}

      {/* Modal: Department Create / Edit */}
      <Dialog open={deptModalOpen} onOpenChange={setDeptModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-card border shadow-2xl">
          <form onSubmit={handleSaveDepartment}>
            <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
              <DialogTitle className="text-base font-semibold">
                {editingDept ? `Edit Department: ${editingDept.name}` : 'Create Department'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Define organizational units and leadership appointments
              </DialogDescription>
            </DialogHeader>

            <div className="p-5 space-y-3.5">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs font-semibold">Department Name</Label>
                  <Input
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder="e.g. Admissions"
                    className="h-9 text-xs"
                    required
                  />
                </div>
                <div className="col-span-1 space-y-1">
                  <Label className="text-xs font-semibold">Code</Label>
                  <Input
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value.toUpperCase())}
                    placeholder="ADM"
                    className="h-9 text-xs font-mono"
                    maxLength={6}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Description</Label>
                <Textarea
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  placeholder="Department mandate and operational scope..."
                  className="text-xs min-h-[60px] resize-none"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Head of Department</Label>
                <Select value={deptHeadId} onValueChange={setDeptHeadId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Choose a leader..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      -- Unassigned --
                    </SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.person.id} value={p.person.id} className="text-xs">
                        {p.person.displayName} ({p.person.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="p-4 border-t bg-muted/20 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeptModalOpen(false)}
                disabled={isSavingDept}
                className="text-xs h-9 px-4 active:scale-[0.97]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingDept}
                className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
              >
                {isSavingDept ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1.5" /> Save Department
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Team Create / Edit */}
      <Dialog open={teamModalOpen} onOpenChange={setTeamModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-card border shadow-2xl">
          <form onSubmit={handleSaveTeam}>
            <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
              <DialogTitle className="text-base font-semibold">
                {editingTeam ? `Edit Team: ${editingTeam.name}` : 'Create Cross-Functional Team'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Assemble squads and assign team leads
              </DialogDescription>
            </DialogHeader>

            <div className="p-5 space-y-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Team Name</Label>
                <Input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Inbound Admissions Squad"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Workspace</Label>
                  <Select value={teamWorkspaceId} onValueChange={setTeamWorkspaceId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Workspace..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">
                        -- Organization Global --
                      </SelectItem>
                      {workspaces.map((ws) => (
                        <SelectItem key={ws.id} value={ws.id} className="text-xs">
                          {ws.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Department</Label>
                  <Select value={teamDeptId} onValueChange={setTeamDeptId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Department..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">
                        -- Cross-Departmental --
                      </SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id} className="text-xs">
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Team Lead</Label>
                <Select value={teamLeadId} onValueChange={setTeamLeadId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select team lead..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      -- Unassigned --
                    </SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.person.id} value={p.person.id} className="text-xs">
                        {p.person.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Team Members</Label>
                <MultiSelect
                  options={peopleOptions}
                  selected={teamMemberIds}
                  onChange={setTeamMemberIds}
                  placeholder="Select squad members..."
                  className="w-full text-xs"
                />
              </div>
            </div>

            <DialogFooter className="p-4 border-t bg-muted/20 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTeamModalOpen(false)}
                disabled={isSavingTeam}
                className="text-xs h-9 px-4 active:scale-[0.97]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingTeam}
                className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
              >
                {isSavingTeam ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1.5" /> Save Team
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TeamsDepartmentsManager;

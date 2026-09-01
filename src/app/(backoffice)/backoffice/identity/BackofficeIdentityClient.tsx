'use client';

/**
 * @fileOverview Backoffice Identity & Authorization Control Plane (Phase 2 Upgrade)
 *
 * Provides super-administrative inspection of cross-tenant Identity 2.0 graphs,
 * canonical roles, version counters, risk profiles, and one-click reconciliation tools.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Gated on the server and client by Backoffice RBAC.
 * - Allows platform operators to audit roles and heal projections across tenants without touching code.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import {
  Users,
  Shield,
  Building2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
  Loader2,
  Search,
  ExternalLink,
  Ban,
  Clock,
  Grid3X3,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useUser } from '@/firebase';
import { useBackoffice } from '../context/BackofficeProvider';
import type { PersonDetailView, Organization, Role } from '@/lib/types';
import type { ReconciliationReport } from '@/lib/services/identity/identity-migration-service';
import {
  getPeopleDirectoryAction,
  reconcileOrganizationIdentitiesAction,
} from '@/app/actions/identity-actions';
import { RoleManagementService } from '@/lib/services/authorization/role-management-service';
import { PermissionRegistryService } from '@/lib/services/authorization/permission-registry-service';
import { normalizePermissionsSchema } from '@/lib/permissions-engine';
import { cn } from '@/lib/utils';

export function BackofficeIdentityClient() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { user: authUser } = useUser();
  const { isSuperAdmin } = useBackoffice();

  const [activeTab, setActiveTab] = React.useState<'people' | 'roles'>('people');
  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = React.useState<string>('');
  const [people, setPeople] = React.useState<PersonDetailView[]>([]);
  const [tenantRoles, setTenantRoles] = React.useState<Role[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = React.useState(false);
  const [isReconciling, setIsReconciling] = React.useState(false);
  const [reconciliationReport, setReconciliationReport] = React.useState<ReconciliationReport | null>(null);

  // 1. Fetch available organizations for selector
  React.useEffect(() => {
    let isMounted = true;
    async function loadOrgs() {
      if (!authUser) return;
      try {
        const token = await authUser.getIdToken();
        const { listAllOrganizations } = await import('@/lib/backoffice/backoffice-org-actions');
        const res = await listAllOrganizations(token);
        if (isMounted && res.success && res.data && res.data.length > 0) {
          setOrganizations(res.data);
          setSelectedOrgId(res.data[0].id);
        }
      } catch (err: unknown) {
        console.warn('[BackofficeIdentityClient] Failed to load organizations:', err);
      }
    }
    loadOrgs();
    return () => {
      isMounted = false;
    };
  }, [authUser]);

  // 2. Fetch People directory when selected organization changes
  const loadPeople = React.useCallback(async () => {
    if (!authUser || !selectedOrgId) return;
    setIsLoading(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await getPeopleDirectoryAction({
        idToken,
        organizationId: selectedOrgId,
      });

      if (res.success) {
        setPeople(res.people);
      } else {
        toast({
          title: 'Lookup Failed',
          description: res.error || 'Failed to fetch directory',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading directory';
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [authUser, selectedOrgId, toast]);

  // 3. Fetch Tenant Roles
  const loadRoles = React.useCallback(async () => {
    if (!selectedOrgId) return;
    setIsLoadingRoles(true);
    try {
      const rolesList = await RoleManagementService.listRolesByOrganization(selectedOrgId);
      setTenantRoles(rolesList);
    } catch (err: unknown) {
      console.warn('[BackofficeIdentityClient] Failed to load roles:', err);
    } finally {
      setIsLoadingRoles(false);
    }
  }, [selectedOrgId]);

  React.useEffect(() => {
    loadPeople();
    loadRoles();
  }, [loadPeople, loadRoles]);

  // 4. Trigger reconciliation
  const handleReconcile = async () => {
    if (!authUser || !selectedOrgId) return;

    const ok = await confirm({
      title: 'Run Identity Reconciliation',
      description: `This will scan all users in ${selectedOrgId}, decompose legacy records into canonical collections, and re-compute projection hashes without service disruption.`,
      confirmText: 'Run Reconciliation',
    });
    if (!ok) return;

    setIsReconciling(true);
    setReconciliationReport(null);
    try {
      const idToken = await authUser.getIdToken();
      const res = await reconcileOrganizationIdentitiesAction({
        idToken,
        organizationId: selectedOrgId,
      });

      if (res.success && res.report) {
        setReconciliationReport(res.report);
        toast({
          title: 'Reconciliation Completed',
          description: `Scanned: ${res.report.totalScanned}, Migrated: ${res.report.migrated}, Reconciled: ${res.report.reconciled}`,
        });
        await loadPeople();
      } else {
        throw new Error(res.error || 'Reconciliation failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reconciliation error';
      toast({
        title: 'Reconciliation Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsReconciling(false);
    }
  };

  const filteredPeople = React.useMemo(() => {
    if (!searchQuery.trim()) return people;
    const q = searchQuery.toLowerCase();
    return people.filter(
      (p) =>
        p.person.displayName.toLowerCase().includes(q) ||
        p.person.email.toLowerCase().includes(q) ||
        p.person.id.toLowerCase().includes(q)
    );
  }, [people, searchQuery]);

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> Identity & Authorization Control Plane
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cross-tenant Identity 2.0 graphs, canonical roles observatory, and zero-code dual-write reconciliation
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
            <SelectTrigger className="w-[220px] h-9 text-xs min-h-[38px] bg-card border-border">
              <SelectValue placeholder="Select Organization" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id} className="text-xs">
                  {org.name || org.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            size="sm"
            onClick={handleReconcile}
            disabled={isReconciling || !selectedOrgId}
            className="h-9 text-xs font-semibold px-4 active:scale-[0.97] min-h-[38px]"
          >
            {isReconciling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Reconciling...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reconcile Projections
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Reconciliation Report Banner */}
      {reconciliationReport && (
        <Card className="border border-emerald-500/30 bg-emerald-500/5 shadow-xs">
          <CardContent className="p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 block">
                Reconciliation Report: {selectedOrg?.name || selectedOrgId}
              </span>
              <p className="text-muted-foreground">
                Total Scanned: <strong className="text-foreground">{reconciliationReport.totalScanned}</strong> |
                Decomposed & Migrated: <strong className="text-foreground">{reconciliationReport.migrated}</strong> |
                Projections Synchronized: <strong className="text-foreground">{reconciliationReport.reconciled}</strong>
              </p>
              {reconciliationReport.errors.length > 0 && (
                <p className="text-destructive font-medium">
                  {reconciliationReport.errors.length} errors encountered during batch sync.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'people' | 'roles')}>
        <TabsList className="h-10 bg-card border p-1 rounded-xl">
          <TabsTrigger value="people" className="text-xs font-semibold px-4 h-8 data-[state=active]:bg-muted/60">
            <Users className="w-3.5 h-3.5 mr-1.5" /> Identity & Member Graphs ({people.length})
          </TabsTrigger>
          <TabsTrigger value="roles" className="text-xs font-semibold px-4 h-8 data-[state=active]:bg-muted/60">
            <Grid3X3 className="w-3.5 h-3.5 mr-1.5" /> Roles & Policy Observatory ({tenantRoles.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Member Graphs */}
        <TabsContent value="people" className="space-y-4 pt-2 m-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border bg-card/60">
              <CardContent className="p-4">
                <span className="text-xs text-muted-foreground block">Canonical People</span>
                <span className="text-2xl font-bold text-foreground">{people.length}</span>
              </CardContent>
            </Card>
            <Card className="border bg-card/60">
              <CardContent className="p-4">
                <span className="text-xs text-muted-foreground block">Active Memberships</span>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {people.filter((p) => p.membership.status === 'active').length}
                </span>
              </CardContent>
            </Card>
            <Card className="border bg-card/60">
              <CardContent className="p-4">
                <span className="text-xs text-muted-foreground block">Pending / Invited</span>
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {people.filter((p) => p.membership.status === 'pending' || p.membership.status === 'invited').length}
                </span>
              </CardContent>
            </Card>
            <Card className="border bg-card/60">
              <CardContent className="p-4">
                <span className="text-xs text-muted-foreground block">Suspended Accounts</span>
                <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {people.filter((p) => p.membership.status === 'suspended' || p.membership.status === 'revoked').length}
                </span>
              </CardContent>
            </Card>
          </div>

          <Card className="border bg-card shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold">Tenant Identity Graph: {selectedOrg?.name || selectedOrgId}</CardTitle>
                <CardDescription className="text-xs">
                  Raw canonical records and hydrated workspace permissions
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter by name, email, UID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8.5 text-xs bg-background"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Person & Account</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold py-3">Tenant Membership</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold py-3">Workspace Memberships</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold py-3">Projection State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={4} className="p-4">
                            <div className="h-8 bg-muted/40 animate-pulse rounded-md" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : filteredPeople.length > 0 ? (
                      filteredPeople.map((item) => (
                        <TableRow key={item.person.id} className="hover:bg-muted/10">
                          <TableCell className="pl-4 py-3">
                            <div className="space-y-0.5">
                              <span className="font-semibold text-xs text-foreground block">{item.person.displayName}</span>
                              <span className="text-[10px] text-muted-foreground block">{item.person.email}</span>
                              <span className="font-mono text-[9px] text-muted-foreground/80 block">UID: {item.person.id}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge
                                variant={item.membership.status === 'active' ? 'default' : 'outline'}
                                className="text-[9px] font-bold uppercase tracking-wider"
                              >
                                {item.membership.status}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground block capitalize">
                                {item.membership.memberType} | {item.membership.source}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {item.workspaceMemberships.length === 0 ? (
                                <span className="text-[10px] text-muted-foreground italic">No workspaces</span>
                              ) : (
                                item.workspaceMemberships.map((ws) => (
                                  <Badge key={ws.workspaceId} variant="outline" className="text-[9px] py-0 bg-muted/30">
                                    <Building2 className="w-2.5 h-2.5 mr-1" />
                                    {ws.workspaceName || ws.workspaceId}
                                    {ws.isPrimary && ' ★'}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5 text-[10px]">
                              <span className="text-muted-foreground">Authorized: </span>
                              <strong className={cn(item.userProfileProjection.isAuthorized ? 'text-emerald-600' : 'text-rose-600')}>
                                {item.userProfileProjection.isAuthorized ? 'True' : 'False'}
                              </strong>
                              <span className="text-muted-foreground block">
                                Roles: {item.userProfileProjection.roles?.length || 0}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-xs text-muted-foreground">
                          No members found for this organization.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Roles Observatory */}
        <TabsContent value="roles" className="space-y-4 pt-2 m-0">
          <Card className="border bg-card shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/20">
              <CardTitle className="text-sm font-semibold">Tenant Role Blueprint Registry</CardTitle>
              <CardDescription className="text-xs">
                Inspect custom roles, active versions, and privilege boundaries for {selectedOrg?.name || selectedOrgId}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Role Name & Category</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold py-3">Version</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold py-3">Active Permissions</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold py-3">Risk Assessment</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold py-3">Updated Stamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingRoles ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={5} className="p-4">
                            <div className="h-8 bg-muted/40 animate-pulse rounded-md" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : tenantRoles.length > 0 ? (
                      tenantRoles.map((r) => {
                        const schema = r.permissionsSchema ? normalizePermissionsSchema(r.permissionsSchema) : null;
                        const metrics = schema ? PermissionRegistryService.calculateRiskMetrics(schema) : null;

                        return (
                          <TableRow key={r.id} className="hover:bg-muted/10">
                            <TableCell className="pl-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                                <div>
                                  <span className="text-xs font-semibold text-foreground block">{r.name}</span>
                                  <span className="text-[10px] text-muted-foreground block">{r.category || 'Role'}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-mono">
                                v{r.version || 1}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-bold text-foreground">
                                {metrics?.totalActive || r.permissions?.length || 0}
                              </span>
                            </TableCell>
                            <TableCell>
                              {metrics && metrics.riskBreakdown.critical > 0 ? (
                                <Badge variant="destructive" className="text-[9px] gap-1">
                                  <ShieldAlert className="w-3 h-3" /> {metrics.riskBreakdown.critical} Critical
                                </Badge>
                              ) : metrics && metrics.riskBreakdown.high > 0 ? (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[9px]">
                                  {metrics.riskBreakdown.high} High
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[9px]">
                                  Low Risk
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-[10px] text-muted-foreground">
                                {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : 'N/A'}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center text-xs text-muted-foreground">
                          No custom roles found for this tenant.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default BackofficeIdentityClient;

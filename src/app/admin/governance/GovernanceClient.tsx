'use client';

/**
 * @fileOverview Governance & Security Center Administration Console (Governance 2.0)
 *
 * Unified control plane for Access Reviews, Time-Bounded JIT Access, Separation of Duties,
 * Session Controls & Remote Invalidation, and Security Audit Stream.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Tabs with Emil Kowalski spring easing.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  ShieldCheck,
  Clock,
  ShieldAlert,
  Lock,
  History,
  Plus,
  RefreshCw,
  Play,
  Ban,
  Users,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type {
  AccessReviewCampaign,
  TemporaryAccessGrant,
  Role,
  PersonDetailView,
} from '@/lib/types';
import {
  listAccessReviewCampaignsAction,
  listTemporaryAccessGrantsAction,
  reapExpiredGrantsAction,
  revokeTemporaryAccessAction,
} from '@/app/actions/governance-actions';
import { getPeopleDirectoryAction } from '@/app/actions/identity-actions';
import { RoleManagementService } from '@/lib/services/authorization/role-management-service';

import { AccessReviewCampaignModal } from './components/AccessReviewCampaignModal';
import { AccessReviewDecisionsDrawer } from './components/AccessReviewDecisionsDrawer';
import { TemporaryAccessModal } from './components/TemporaryAccessModal';
import { SoDRulesManager } from './components/SoDRulesManager';
import { SessionControlsManager } from './components/SessionControlsManager';
import { SecurityAuditStream } from './components/SecurityAuditStream';

export function GovernanceClient() {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const { activeOrganizationId, accessibleWorkspaces } = useTenant();

  const [activeTab, setActiveTab] = React.useState<'reviews' | 'jit' | 'sod' | 'sessions' | 'audit'>('reviews');

  // Governance State
  const [campaigns, setCampaigns] = React.useState<AccessReviewCampaign[]>([]);
  const [grants, setGrants] = React.useState<TemporaryAccessGrant[]>([]);
  const [people, setPeople] = React.useState<PersonDetailView[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // Modals & Drawers State
  const [campaignModalOpen, setCampaignModalOpen] = React.useState(false);
  const [inspectingCampaign, setInspectingCampaign] = React.useState<AccessReviewCampaign | null>(null);
  const [jitModalOpen, setJitModalOpen] = React.useState(false);

  const loadData = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId) return;
    setIsLoading(true);
    try {
      const idToken = await authUser.getIdToken();
      const [campRes, grantRes, peopleRes, rolesList] = await Promise.all([
        listAccessReviewCampaignsAction({ idToken, organizationId: activeOrganizationId }),
        listTemporaryAccessGrantsAction({ idToken, organizationId: activeOrganizationId }),
        getPeopleDirectoryAction({ idToken, organizationId: activeOrganizationId }),
        RoleManagementService.listRolesByOrganization(activeOrganizationId),
      ]);

      if (campRes.success) setCampaigns(campRes.campaigns);
      if (grantRes.success) setGrants(grantRes.grants);
      if (peopleRes.success) setPeople(peopleRes.people);
      setRoles(rolesList);
    } catch (err: unknown) {
      console.warn('[GovernanceClient] Error loading governance data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, activeOrganizationId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Reap Expired Grants
  const handleReapGrants = async () => {
    if (!authUser || !activeOrganizationId) return;
    try {
      const idToken = await authUser.getIdToken();
      const res = await reapExpiredGrantsAction({ idToken, organizationId: activeOrganizationId });
      toast({
        title: 'Reaper Scan Complete',
        description: `Reclaimed ${res.reapedCount} expired JIT access grants.`,
      });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast({ title: 'Reap Failed', description: msg, variant: 'destructive' });
    }
  };

  // Revoke JIT Grant
  const handleRevokeGrant = async (grantId: string) => {
    if (!authUser || !activeOrganizationId) return;
    try {
      const idToken = await authUser.getIdToken();
      const res = await revokeTemporaryAccessAction({
        idToken,
        organizationId: activeOrganizationId,
        grantId,
      });

      if (res.success) {
        toast({ title: 'JIT Access Revoked' });
        loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Revoke failed';
      toast({ title: 'Revoke Failed', description: msg, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 pb-32 w-full p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" /> Governance & Security Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Access certification campaigns, Just-In-Time access grants, Separation of Duties, and session controls
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button asChild variant="outline" size="sm" className="rounded-lg h-9 px-3.5 text-xs font-semibold active:scale-[0.97]">
            <Link href="/admin/users/roles">
              <Lock className="h-3.5 w-3.5 mr-1.5 text-primary" /> Roles Architecture
            </Link>
          </Button>

          {activeTab === 'reviews' && (
            <Button
              type="button"
              size="sm"
              onClick={() => setCampaignModalOpen(true)}
              className="rounded-lg font-semibold h-9 px-4 shadow-sm active:scale-[0.97] text-xs"
            >
              <Play className="w-3.5 h-3.5 mr-1.5" /> Launch Access Review
            </Button>
          )}

          {activeTab === 'jit' && (
            <Button
              type="button"
              size="sm"
              onClick={() => setJitModalOpen(true)}
              className="rounded-lg font-semibold h-9 px-4 shadow-sm active:scale-[0.97] text-xs"
            >
              <Clock className="w-3.5 h-3.5 mr-1.5" /> Grant JIT Access
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'reviews' | 'jit' | 'sod' | 'sessions' | 'audit')}>
        <TabsList className="h-10 bg-card border p-1 rounded-xl">
          <TabsTrigger value="reviews" className="text-xs font-semibold px-4 h-8 data-[state=active]:bg-muted/60">
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Access Reviews ({campaigns.length})
          </TabsTrigger>
          <TabsTrigger value="jit" className="text-xs font-semibold px-4 h-8 data-[state=active]:bg-muted/60">
            <Clock className="w-3.5 h-3.5 mr-1.5" /> JIT Temporary Access ({grants.filter((g) => g.status === 'active').length})
          </TabsTrigger>
          <TabsTrigger value="sod" className="text-xs font-semibold px-4 h-8 data-[state=active]:bg-muted/60">
            <ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Separation of Duties (SoD)
          </TabsTrigger>
          <TabsTrigger value="sessions" className="text-xs font-semibold px-4 h-8 data-[state=active]:bg-muted/60">
            <Lock className="w-3.5 h-3.5 mr-1.5" /> Sessions & Policies
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-xs font-semibold px-4 h-8 data-[state=active]:bg-muted/60">
            <History className="w-3.5 h-3.5 mr-1.5" /> Security Audit Stream
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Access Reviews */}
        <TabsContent value="reviews" className="space-y-4 pt-2 m-0">
          <Card className="border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/20 border-b">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Campaign</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3">Cadence</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3">Progress</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3">Decisions</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3">Due Date</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3 text-right pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6} className="p-4">
                          <div className="h-8 bg-muted/40 animate-pulse rounded-md" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : campaigns.length > 0 ? (
                    campaigns.map((c) => {
                      const percent = c.totalItems > 0 ? Math.round((c.reviewedItems / c.totalItems) * 100) : 0;

                      return (
                        <TableRow key={c.id} className="hover:bg-muted/10">
                          <TableCell className="pl-4 py-3">
                            <div className="space-y-0.5">
                              <span className="font-semibold text-xs text-foreground block">{c.title}</span>
                              <span className="text-[10px] text-muted-foreground block line-clamp-1">{c.description}</span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className="text-[10px] uppercase font-mono bg-muted/30">
                              {c.frequency}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="space-y-1 w-32">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-muted-foreground">Certified:</span>
                                <span className="font-bold text-foreground">{percent}%</span>
                              </div>
                              <Progress value={percent} className="h-1.5" />
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="text-[10px] space-x-2">
                              <span className="text-emerald-600 font-semibold">{c.certifiedCount} Certified</span>
                              <span className="text-rose-600 font-semibold">{c.revokedCount} Revoked</span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs text-muted-foreground">{new Date(c.dueDate).toLocaleDateString()}</span>
                          </TableCell>

                          <TableCell className="text-right pr-4">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setInspectingCampaign(c)}
                              className="text-xs h-7 px-2.5 font-semibold active:scale-[0.97]"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> Open Queue
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                        No access review campaigns found. Click &quot;Launch Access Review&quot; to initiate one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: JIT Access */}
        <TabsContent value="jit" className="space-y-4 pt-2 m-0">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReapGrants}
              className="text-xs h-8 px-3 active:scale-[0.97]"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Sweep & Revoke Expired JIT Grants
            </Button>
          </div>

          <Card className="border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/20 border-b">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Member</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3">Granted Role</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3">Duration & Status</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3">Expires At</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3">Business Reason</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3 text-right pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6} className="p-4">
                          <div className="h-8 bg-muted/40 animate-pulse rounded-md" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : grants.length > 0 ? (
                    grants.map((g) => (
                      <TableRow key={g.id} className="hover:bg-muted/10">
                        <TableCell className="pl-4 py-3">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-xs text-foreground block">{g.personName}</span>
                            <span className="text-[10px] text-muted-foreground block">{g.personEmail}</span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className="text-[10px] py-0 bg-muted/30">
                            {g.roleName}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            <span className="text-xs font-semibold">{g.durationHours} Hours</span>
                            <Badge
                              variant={g.status === 'active' ? 'default' : 'outline'}
                              className={cn(
                                'text-[9px] uppercase tracking-wider block w-fit',
                                g.status === 'active' && 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                              )}
                            >
                              {g.status}
                            </Badge>
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {new Date(g.expiresAt).toLocaleString()}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="text-xs text-muted-foreground line-clamp-1 italic">
                            &quot;{g.reason}&quot;
                          </span>
                        </TableCell>

                        <TableCell className="text-right pr-4">
                          {g.status === 'active' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeGrant(g.id)}
                              className="text-xs h-7 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                            >
                              <Ban className="w-3 h-3 mr-1" /> Revoke Now
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                        No temporary JIT access grants found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 3: SoD Rules */}
        <TabsContent value="sod" className="pt-2 m-0">
          <SoDRulesManager roles={roles} />
        </TabsContent>

        {/* Tab 4: Sessions & Policies */}
        <TabsContent value="sessions" className="pt-2 m-0">
          <SessionControlsManager />
        </TabsContent>

        {/* Tab 5: Security Audit Stream */}
        <TabsContent value="audit" className="pt-2 m-0">
          <SecurityAuditStream />
        </TabsContent>
      </Tabs>

      {/* Campaign Modal */}
      <AccessReviewCampaignModal
        isOpen={campaignModalOpen}
        onClose={() => setCampaignModalOpen(false)}
        onCreated={loadData}
      />

      {/* Decisions Queue Drawer */}
      <AccessReviewDecisionsDrawer
        isOpen={Boolean(inspectingCampaign)}
        onClose={() => setInspectingCampaign(null)}
        campaign={inspectingCampaign}
        onDecisionsUpdated={loadData}
      />

      {/* JIT Grant Modal */}
      <TemporaryAccessModal
        isOpen={jitModalOpen}
        onClose={() => setJitModalOpen(false)}
        people={people}
        roles={roles}
        workspaces={accessibleWorkspaces}
        onGranted={loadData}
      />
    </div>
  );
}

export default GovernanceClient;

'use client';

/**
 * @fileoverview Backoffice Sales Teams & Workforce Capacity Governance Client.
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 39 & Backoffice Governance:
 * 1. No-code management of Sales Teams and member associations.
 * 2. Real-time adjustment of rep capacity thresholds (weekly hours, max open leads, max open deals).
 * 3. FER Migration Protocol Runner: Trigger safe Fetch-Enrich-Restore migration and test data seeding
 *    directly from the platform control plane without touching production code.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Minimum 44px touch targets on interactive controls.
 * - Conforms to next-best-practices and emilkowal-animations.
 */

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  RefreshCw,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Database,
  Loader2,
  Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import type { SalesAgent } from '@/lib/sales-performance/types';
import type { MigrationResult } from '@/lib/manager-command/migration-protocol';
import {
  getBackofficeSalesTeamsAction,
  saveSalesTeamConfigAction,
  updateAgentCapacityAction,
  runSalesTeamMigrationAction,
} from '@/app/actions/manager-command-actions';

interface BackofficeTeamItem {
  id: string;
  name: string;
  description?: string;
  managerIds: string[];
  memberIds: string[];
  status: string;
}

export default function BackofficeSalesTeamsClient() {
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const [teams, setTeams] = React.useState<BackofficeTeamItem[]>([]);
  const [agents, setAgents] = React.useState<SalesAgent[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isMigrating, setIsMigrating] = React.useState<boolean>(false);
  const [seedData, setSeedData] = React.useState<boolean>(true);
  const [migrationResult, setMigrationResult] = React.useState<MigrationResult | null>(null);

  // New Team Modal / State
  const [newTeamName, setNewTeamName] = React.useState<string>('');
  const [newTeamDesc, setNewTeamDesc] = React.useState<string>('');
  const [isSavingTeam, setIsSavingTeam] = React.useState<boolean>(false);

  // Agent Capacity Editing
  const [editingCapacity, setEditingCapacity] = React.useState<
    Record<string, { weeklyHours: number; maxOpenLeads: number; maxOpenDeals: number }>
  >({});
  const [savingAgentId, setSavingAgentId] = React.useState<string | null>(null);

  const orgId = activeWorkspace?.organizationId || activeWorkspaceId || '';

  const loadData = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const res = await getBackofficeSalesTeamsAction({
        workspaceId: activeWorkspaceId,
        organizationId: orgId,
      });

      if (res.success && res.teams && res.agents) {
        setTeams(res.teams);
        setAgents(res.agents);

        const initialCaps: Record<string, { weeklyHours: number; maxOpenLeads: number; maxOpenDeals: number }> = {};
        res.agents.forEach((ag) => {
          initialCaps[ag.id] = {
            weeklyHours: ag.capacity?.weeklyHours ?? 40,
            maxOpenLeads: ag.capacity?.maxOpenLeads ?? 15,
            maxOpenDeals: ag.capacity?.maxOpenDeals ?? 10,
          };
        });
        setEditingCapacity(initialCaps);
      }
    } catch (err) {
      console.error('Failed to load backoffice sales teams:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, orgId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunMigration = async () => {
    if (!activeWorkspaceId) return;
    setIsMigrating(true);
    try {
      const res = await runSalesTeamMigrationAction({
        workspaceId: activeWorkspaceId,
        organizationId: orgId,
        actorId: user?.uid || 'backoffice_admin',
        seedSampleDataIfEmpty: seedData,
      });

      setMigrationResult(res);
      if (res.success) {
        toast({
          title: 'Migration Completed',
          description: `Created ${res.teamsProvisioned} teams, ${res.agentsEnriched} agents provisioned.`,
        });
        await loadData();
      } else {
        toast({
          variant: 'destructive',
          title: 'Migration Failed',
          description: res.error || 'Migration failed. Check log output.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Migration Error',
        description: msg,
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId || !newTeamName.trim()) return;

    setIsSavingTeam(true);
    try {
      const res = await saveSalesTeamConfigAction({
        workspaceId: activeWorkspaceId,
        organizationId: orgId,
        name: newTeamName.trim(),
        description: newTeamDesc.trim(),
      });

      if (res.success) {
        toast({
          title: 'Team Created',
          description: `Team "${newTeamName}" created successfully.`,
        });
        setNewTeamName('');
        setNewTeamDesc('');
        await loadData();
      } else {
        toast({
          variant: 'destructive',
          title: 'Team Creation Failed',
          description: res.error || 'Failed to create team.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: msg,
      });
    } finally {
      setIsSavingTeam(false);
    }
  };

  const handleSaveCapacity = async (agentDocId: string) => {
    const cap = editingCapacity[agentDocId];
    if (!cap) return;

    setSavingAgentId(agentDocId);
    try {
      const res = await updateAgentCapacityAction({
        workspaceId: activeWorkspaceId || '',
        organizationId: orgId,
        agentDocId,
        capacity: cap,
      });

      if (res.success) {
        toast({
          title: 'Capacity Guardrails Updated',
          description: 'Agent capacity thresholds updated successfully.',
        });
        await loadData();
      } else {
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: res.error || 'Failed to update capacity.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: msg,
      });
    } finally {
      setSavingAgentId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto font-sans">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              Sales Teams & Capacity Governance
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
              Backoffice Control Plane
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Configure sales team hierarchy, rep capacity guardrails, and execute FER migration pipelines.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={isLoading}
          className="min-h-[44px] sm:min-h-[38px] rounded-xl text-xs font-semibold gap-1.5 active:scale-[0.97]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* 2. Migration Protocol Runner Card */}
      <Card className="rounded-2xl border bg-gradient-to-br from-card/80 via-card to-primary/5 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-foreground">
                Fetch-Enrich-Restore (FER) Migration Protocol
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Provisions sales teams, agent capacity records, and verifies Firestore composite indices.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={seedData}
                onChange={(e) => setSeedData(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span>Seed Sample Pipeline Data</span>
            </label>

            <Button
              onClick={handleRunMigration}
              disabled={isMigrating || !activeWorkspaceId}
              className="min-h-[44px] px-4 text-xs font-semibold rounded-xl gap-2 active:scale-[0.97]"
            >
              {isMigrating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Migrating...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Execute FER Migration</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {migrationResult && (
          <div className="rounded-xl border border-border/50 bg-background/50 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-foreground">
              {migrationResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
              <span>Migration Result: {migrationResult.success ? 'Success' : 'Failed'}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div>Teams Provisioned: <strong className="text-foreground">{migrationResult.teamsProvisioned}</strong></div>
              <div>Agents Enriched: <strong className="text-foreground">{migrationResult.agentsEnriched}</strong></div>
              <div>Deals Backfilled: <strong className="text-foreground">{migrationResult.dealsBackfilled}</strong></div>
              <div>Tasks Backfilled: <strong className="text-foreground">{migrationResult.tasksBackfilled}</strong></div>
            </div>
          </div>
        )}
      </Card>

      {/* 3. Sales Teams Management Card */}
      <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span>Sales Teams Configuration</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Teams active in this workspace ({teams.length} total).
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-6">
          {/* Create Team Inline Form */}
          <form onSubmit={handleCreateTeam} className="flex flex-col sm:flex-row items-end gap-3 p-4 rounded-xl border bg-muted/20">
            <div className="w-full sm:w-1/3 space-y-1">
              <Label className="text-xs font-semibold">Team Name</Label>
              <Input
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="e.g. Enterprise Sales"
                className="min-h-[44px] text-xs bg-background"
                required
              />
            </div>
            <div className="w-full sm:w-1/2 space-y-1">
              <Label className="text-xs font-semibold">Description</Label>
              <Input
                value={newTeamDesc}
                onChange={(e) => setNewTeamDesc(e.target.value)}
                placeholder="Team mandate and focus area"
                className="min-h-[44px] text-xs bg-background"
              />
            </div>
            <Button
              type="submit"
              disabled={isSavingTeam || !newTeamName.trim()}
              className="w-full sm:w-auto min-h-[44px] px-5 rounded-xl text-xs font-semibold gap-1.5 active:scale-[0.97]"
            >
              {isSavingTeam ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              <span>Create Team</span>
            </Button>
          </form>

          {/* Teams Table */}
          {teams.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              No sales teams configured yet. Execute migration above to seed default teams.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40">
                    <TableHead className="text-xs font-semibold">Team Name</TableHead>
                    <TableHead className="text-xs font-semibold">Description</TableHead>
                    <TableHead className="text-xs font-semibold">Members</TableHead>
                    <TableHead className="text-xs font-semibold">Managers</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team) => (
                    <TableRow key={team.id} className="border-border/30">
                      <TableCell className="text-xs font-bold text-foreground">{team.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{team.description || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{team.memberIds.length} members</TableCell>
                      <TableCell className="text-xs font-mono">{team.managerIds.length} managers</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                          {team.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Rep Capacity Thresholds Table */}
      <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-border/40">
          <CardTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            <span>Representative Capacity Guardrails</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Adjust weekly capacity hours, max open leads, and max active deals per representative.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {agents.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-8">
              No sales agents provisioned yet. Run the FER migration above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40">
                    <TableHead className="text-xs font-semibold">Agent Name</TableHead>
                    <TableHead className="text-xs font-semibold">Email</TableHead>
                    <TableHead className="text-xs font-semibold">Weekly Hours</TableHead>
                    <TableHead className="text-xs font-semibold">Max Open Leads</TableHead>
                    <TableHead className="text-xs font-semibold">Max Open Deals</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => {
                    const cap = editingCapacity[agent.id] || {
                      weeklyHours: agent.capacity?.weeklyHours ?? 40,
                      maxOpenLeads: agent.capacity?.maxOpenLeads ?? 15,
                      maxOpenDeals: agent.capacity?.maxOpenDeals ?? 10,
                    };
                    const isSaving = savingAgentId === agent.id;

                    return (
                      <TableRow key={agent.id} className="border-border/30">
                        <TableCell className="text-xs font-bold text-foreground">{agent.userName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{agent.userEmail}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={cap.weeklyHours}
                            onChange={(e) =>
                              setEditingCapacity((prev) => ({
                                ...prev,
                                [agent.id]: { ...cap, weeklyHours: Number(e.target.value) },
                              }))
                            }
                            className="w-20 h-9 min-h-[36px] text-xs font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={cap.maxOpenLeads}
                            onChange={(e) =>
                              setEditingCapacity((prev) => ({
                                ...prev,
                                [agent.id]: { ...cap, maxOpenLeads: Number(e.target.value) },
                              }))
                            }
                            className="w-20 h-9 min-h-[36px] text-xs font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={cap.maxOpenDeals}
                            onChange={(e) =>
                              setEditingCapacity((prev) => ({
                                ...prev,
                                [agent.id]: { ...cap, maxOpenDeals: Number(e.target.value) },
                              }))
                            }
                            className="w-20 h-9 min-h-[36px] text-xs font-mono"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSaveCapacity(agent.id)}
                            disabled={isSaving}
                            className="h-9 min-h-[36px] rounded-lg text-xs font-semibold gap-1 active:scale-[0.97]"
                          >
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            <span>Save</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

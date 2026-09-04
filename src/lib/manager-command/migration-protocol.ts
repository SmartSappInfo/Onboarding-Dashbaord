/**
 * @fileoverview Fetch, Enrich & Restore (FER) Migration Protocol for Sales Teams & Workforce Capacity (Phase 3).
 *
 * ARCHITECTURAL POINTER:
 * Provides automated, idempotent provisioning and maintenance for:
 * 1. Fetch: Scans existing users in the workspace with sales/admin permissions.
 * 2. Enrich: Creates or updates baseline salesAgents capacity profiles (weekly hours, max leads, max deals).
 * 3. Restore / Backfill: Ensures default salesTeams exists and backfills active deals & tasks with team attribution.
 * 4. Sample Seeding: Optional seeding for fresh workspaces to demo at-risk deals and workload rebalancing.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% idempotent. Safe to run multiple times without corrupting or duplicating data.
 * - Strict typing policy: Zero 'any' or 'any[]'.
 * - Must operate via adminDb inside authorized server actions.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { SalesAgent, SalesTeam } from '@/lib/sales-performance/types';

export interface MigrationResult {
  success: boolean;
  agentsEnriched: number;
  teamsProvisioned: number;
  dealsBackfilled: number;
  tasksBackfilled: number;
  message: string;
  error?: string;
}

/**
 * Executes the Fetch, Enrich, and Restore protocol for a given workspace.
 */
export async function executeSalesTeamMigration(params: {
  workspaceId: string;
  organizationId: string;
  actorId: string;
  seedSampleDataIfEmpty?: boolean;
}): Promise<MigrationResult> {
  const { workspaceId, organizationId, actorId, seedSampleDataIfEmpty = false } = params;

  try {
    const now = new Date().toISOString();

    // 1. FETCH: Active Users belonging to the workspace
    const usersSnap = await adminDb
      .collection('users')
      .where('organizationId', '==', organizationId)
      .limit(50)
      .get();

    const eligibleUsers = usersSnap.docs.filter((doc) => {
      const data = doc.data();
      const wsIds: string[] = Array.isArray(data.workspaceIds) ? data.workspaceIds : [];
      return wsIds.includes(workspaceId) || data.role === 'admin' || data.isAuthorized === true;
    });

    let agentsEnriched = 0;
    const agentUserIds: string[] = [];

    // 2. ENRICH: Ensure salesAgents profiles exist with baseline capacity
    for (const uDoc of eligibleUsers) {
      const uData = uDoc.data();
      const agentId = `${workspaceId}_${uDoc.id}`;
      agentUserIds.push(uDoc.id);

      const agentRef = adminDb.collection('salesAgents').doc(agentId);
      const agentSnap = await agentRef.get();

      if (!agentSnap.exists) {
        const newAgent: SalesAgent = {
          id: agentId,
          organizationId,
          workspaceId,
          userId: uDoc.id,
          userName: uData.name || uData.displayName || 'Sales Representative',
          userEmail: uData.email || '',
          photoURL: uData.photoURL || undefined,
          jobTitle: uData.role === 'admin' ? 'Sales Director' : 'Account Executive',
          status: 'active',
          capacity: {
            weeklyHours: 40,
            maxOpenLeads: 15,
            maxOpenDeals: 10,
          },
          createdAt: now,
          updatedAt: now,
        };
        await agentRef.set(newAgent);
        agentsEnriched += 1;
      }
    }

    // 3. RESTORE: Ensure at least one default salesTeam exists
    let teamsProvisioned = 0;
    const defaultTeamId = `${workspaceId}_primary_team`;
    const teamRef = adminDb.collection('salesTeams').doc(defaultTeamId);
    const teamSnap = await teamRef.get();

    if (!teamSnap.exists) {
      const primaryManagerId = agentUserIds.length > 0 ? agentUserIds[0] : actorId;
      const defaultTeam: SalesTeam = {
        id: defaultTeamId,
        organizationId,
        workspaceId,
        name: 'Primary Sales Team',
        description: 'Default enterprise sales and account management unit',
        managerIds: [primaryManagerId],
        memberIds: agentUserIds,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      await teamRef.set(defaultTeam);
      teamsProvisioned += 1;
    }

    // 4. BACKFILL: Backfill active deals and tasks lacking teamId
    let dealsBackfilled = 0;
    const dealsSnap = await adminDb
      .collection('deals')
      .where('workspaceId', '==', workspaceId)
      .limit(50)
      .get();

    const dealBatch = adminDb.batch();
    for (const dDoc of dealsSnap.docs) {
      const dData = dDoc.data();
      if (!dData.teamId) {
        dealBatch.update(dDoc.ref, {
          teamId: defaultTeamId,
          updatedAt: now,
        });
        dealsBackfilled += 1;
      }
    }
    if (dealsBackfilled > 0) {
      await dealBatch.commit();
    }

    let tasksBackfilled = 0;
    const tasksSnap = await adminDb
      .collection('tasks')
      .where('workspaceId', '==', workspaceId)
      .where('status', 'in', ['todo', 'in_progress'])
      .limit(50)
      .get();

    const taskBatch = adminDb.batch();
    for (const tDoc of tasksSnap.docs) {
      const tData = tDoc.data();
      if (!tData.teamId) {
        taskBatch.update(tDoc.ref, {
          teamId: defaultTeamId,
          updatedAt: now,
        });
        tasksBackfilled += 1;
      }
    }
    if (tasksBackfilled > 0) {
      await taskBatch.commit();
    }

    // 5. SAMPLE SEEDING (If explicitly requested or completely empty)
    if (seedSampleDataIfEmpty && dealsSnap.empty && agentUserIds.length > 0) {
      const sampleAssignee = agentUserIds[0];
      const sampleDeals = [
        {
          workspaceId,
          organizationId,
          teamId: defaultTeamId,
          name: 'Sunrise Academy Enterprise License',
          value: 18500,
          stage: 'proposal',
          status: 'open',
          assignedTo: sampleAssignee,
          assignedRepName: 'Primary Representative',
          contactName: 'Dr. Mensah',
          contactPhone: '+233241000001',
          contactEmail: 'mensah@sunriseacademy.edu',
          stageChangedAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(), // 16 days stalled
          lastActivityAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: now,
        },
        {
          workspaceId,
          organizationId,
          teamId: defaultTeamId,
          name: 'Greenfield International Pilot',
          value: 9200,
          stage: 'negotiation',
          status: 'open',
          assignedTo: sampleAssignee,
          assignedRepName: 'Primary Representative',
          contactName: 'Mrs. Addo',
          contactPhone: '+233241000002',
          contactEmail: 'addo@greenfield.edu',
          stageChangedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days stalled
          lastActivityAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: now,
        },
        {
          workspaceId,
          organizationId,
          teamId: defaultTeamId,
          name: 'Beacon College Onboarding',
          value: 6500,
          stage: 'closed_won',
          status: 'won',
          assignedTo: sampleAssignee,
          assignedRepName: 'Primary Representative',
          createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
          closedAt: now,
          updatedAt: now,
        },
      ];

      for (const sd of sampleDeals) {
        await adminDb.collection('deals').add(sd);
      }
    }

    return {
      success: true,
      agentsEnriched,
      teamsProvisioned,
      dealsBackfilled,
      tasksBackfilled,
      message: `FER Migration succeeded. Enriched ${agentsEnriched} agent(s), provisioned ${teamsProvisioned} team(s), and backfilled ${dealsBackfilled} deal(s).`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[FER Migration Protocol] Error during sales team migration:', err);
    return {
      success: false,
      agentsEnriched: 0,
      teamsProvisioned: 0,
      dealsBackfilled: 0,
      tasksBackfilled: 0,
      message: 'Migration failed',
      error: msg,
    };
  }
}

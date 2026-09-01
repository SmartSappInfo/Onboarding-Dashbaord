/**
 * @fileOverview Canonical Team Service (Workforce 2.0)
 *
 * Provides cross-functional team management, team lead bindings, workspace/department scoping,
 * and atomic member array mutations.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Teams can be scoped to specific workspaces or cross-workspace departments.
 * - Atomic member array unions prevent race conditions.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `workforce-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Team } from '@/lib/types';

export interface CreateTeamPayload {
  name: string;
  description?: string;
  workspaceId?: string;
  workspaceName?: string;
  departmentId?: string;
  departmentName?: string;
  leadPersonId?: string;
  leadPersonName?: string;
  memberPersonIds?: string[];
  color?: string;
}

export interface UpdateTeamPayload {
  name?: string;
  description?: string;
  workspaceId?: string;
  workspaceName?: string;
  departmentId?: string;
  departmentName?: string;
  leadPersonId?: string;
  leadPersonName?: string;
  memberPersonIds?: string[];
  color?: string;
}

export class TeamService {
  /**
   * Creates a new team in an organization.
   */
  static async createTeam(
    organizationId: string,
    payload: CreateTeamPayload,
    batch?: FirebaseFirestore.WriteBatch
  ): Promise<Team> {
    if (!organizationId) throw new Error('Missing organizationId');
    if (!payload.name?.trim()) throw new Error('Team name is required');

    const now = new Date().toISOString();
    const teamRef = adminDb.collection('teams').doc();

    const newTeam: Team = {
      id: teamRef.id,
      organizationId,
      workspaceId: payload.workspaceId || undefined,
      workspaceName: payload.workspaceName || undefined,
      departmentId: payload.departmentId || undefined,
      departmentName: payload.departmentName || undefined,
      name: payload.name.trim(),
      description: payload.description || '',
      leadPersonId: payload.leadPersonId || undefined,
      leadPersonName: payload.leadPersonName || undefined,
      memberPersonIds: payload.memberPersonIds || [],
      color: payload.color || '#3B82F6',
      createdAt: now,
      updatedAt: now,
    };

    if (batch) {
      batch.set(teamRef, newTeam);
    } else {
      await teamRef.set(newTeam);
    }

    return newTeam;
  }

  /**
   * Updates an existing team.
   */
  static async updateTeam(
    organizationId: string,
    teamId: string,
    payload: UpdateTeamPayload
  ): Promise<Team> {
    if (!organizationId || !teamId) throw new Error('Missing parameters');

    const teamRef = adminDb.collection('teams').doc(teamId);
    const snap = await teamRef.get();

    if (!snap.exists) {
      throw new Error(`Team ${teamId} not found`);
    }

    const current = { id: snap.id, ...snap.data() } as Team;
    if (current.organizationId !== organizationId) {
      throw new Error('Forbidden: Team belongs to a different organization');
    }

    const now = new Date().toISOString();
    const updated: Team = {
      ...current,
      name: payload.name ? payload.name.trim() : current.name,
      description: payload.description !== undefined ? payload.description : current.description,
      workspaceId: payload.workspaceId !== undefined ? payload.workspaceId : current.workspaceId,
      workspaceName: payload.workspaceName !== undefined ? payload.workspaceName : current.workspaceName,
      departmentId: payload.departmentId !== undefined ? payload.departmentId : current.departmentId,
      departmentName: payload.departmentName !== undefined ? payload.departmentName : current.departmentName,
      leadPersonId: payload.leadPersonId !== undefined ? payload.leadPersonId : current.leadPersonId,
      leadPersonName: payload.leadPersonName !== undefined ? payload.leadPersonName : current.leadPersonName,
      memberPersonIds: payload.memberPersonIds !== undefined ? payload.memberPersonIds : current.memberPersonIds,
      color: payload.color || current.color,
      updatedAt: now,
    };

    await teamRef.set(updated, { merge: true });
    return updated;
  }

  /**
   * Deletes a team.
   */
  static async deleteTeam(organizationId: string, teamId: string): Promise<boolean> {
    if (!organizationId || !teamId) throw new Error('Missing parameters');

    const teamRef = adminDb.collection('teams').doc(teamId);
    const snap = await teamRef.get();

    if (!snap.exists) return true;

    const current = snap.data() as Team;
    if (current.organizationId !== organizationId) {
      throw new Error('Forbidden: Team belongs to a different organization');
    }

    await teamRef.delete();
    return true;
  }

  /**
   * Atomically adds a person to a team's member list.
   */
  static async addTeamMember(teamId: string, personId: string): Promise<void> {
    if (!teamId || !personId) return;
    await adminDb
      .collection('teams')
      .doc(teamId)
      .update({
        memberPersonIds: FieldValue.arrayUnion(personId),
        updatedAt: new Date().toISOString(),
      });
  }

  /**
   * Atomically removes a person from a team's member list.
   */
  static async removeTeamMember(teamId: string, personId: string): Promise<void> {
    if (!teamId || !personId) return;
    await adminDb
      .collection('teams')
      .doc(teamId)
      .update({
        memberPersonIds: FieldValue.arrayRemove(personId),
        updatedAt: new Date().toISOString(),
      });
  }

  /**
   * Lists teams for an organization, optionally filtered by workspace or department.
   */
  static async listTeams(
    organizationId: string,
    workspaceId?: string,
    departmentId?: string
  ): Promise<Team[]> {
    if (!organizationId) return [];

    let query: FirebaseFirestore.Query = adminDb
      .collection('teams')
      .where('organizationId', '==', organizationId);

    if (workspaceId) {
      query = query.where('workspaceId', '==', workspaceId);
    }
    if (departmentId) {
      query = query.where('departmentId', '==', departmentId);
    }

    const snap = await query.get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Team));
  }
}

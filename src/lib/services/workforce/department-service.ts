/**
 * @fileOverview Canonical Department Service (Workforce 2.0)
 *
 * Provides CRUD management, department head assignment, and member count aggregation
 * for organization organizational units.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Deletion is guarded: cannot delete a department while active members are assigned.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 *
 * @testability Covered in `workforce-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Department } from '@/lib/types';
import { DepartmentSeedService } from './department-seed-service';

export interface CreateDepartmentPayload {
  name: string;
  code?: string;
  description?: string;
  headPersonId?: string;
  headPersonName?: string;
}

/** Error for a department id that is missing or belongs to another organization (no difference is revealed). */
export const DEPARTMENT_NOT_IN_ORGANIZATION = 'That department does not exist in this organization.';

export interface UpdateDepartmentPayload {
  name?: string;
  code?: string;
  description?: string;
  headPersonId?: string;
  headPersonName?: string;
}

export class DepartmentService {
  /**
   * Synchronizes the canonical departments list into the legacy `organizations/{orgId}.departments`
   * projection array, ensuring total backward-compatibility with zero drift.
   */
  static async syncOrganizationDepartmentsProjection(organizationId: string): Promise<string[]> {
    if (!organizationId) return [];
    const depts = await this.listDepartments(organizationId);
    const names = depts.map((d) => d.name);
    const orgRef = adminDb.collection('organizations').doc(organizationId);
    await orgRef.set(
      {
        departments: names,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return names;
  }

  /**
   * Retrieves canonical departments for an organization.
   * If the organization has 0 departments, automatically invokes `DepartmentSeedService`
   * to guarantee an industry-tailored initial workforce blueprint.
   */
  static async getCanonicalDepartmentsForOrganization(organizationId: string): Promise<Department[]> {
    if (!organizationId) return [];
    const existing = await this.listDepartments(organizationId);
    if (existing.length > 0) {
      return existing;
    }

    // Auto-seed industry appropriate defaults
    const seedRes = await DepartmentSeedService.seedDepartmentsForOrganization(organizationId);
    if (seedRes.departments && seedRes.departments.length > 0) {
      return seedRes.departments;
    }

    return await this.listDepartments(organizationId);
  }

  /**
   * Resolves a department by name case-insensitively, or provisions a new canonical
   * department record if one does not exist.
   */
  static async findOrCreateDepartmentByName(organizationId: string, name: string): Promise<Department> {
    if (!organizationId) throw new Error('Missing organizationId');
    const cleanName = (name || '').trim();
    if (!cleanName) throw new Error('Department name is required');

    const match = await this.findDepartmentByName(organizationId, cleanName);
    if (match) {
      return match;
    }

    return await this.createDepartment(organizationId, {
      name: cleanName,
      code: cleanName.substring(0, 4).toUpperCase(),
    });
  }

  /**
   * Creates a new organizational department within a tenant.
   */
  static async createDepartment(
    organizationId: string,
    payload: CreateDepartmentPayload,
    batch?: FirebaseFirestore.WriteBatch
  ): Promise<Department> {
    if (!organizationId) throw new Error('Missing organizationId');
    if (!payload.name?.trim()) throw new Error('Department name is required');

    const code = (payload.code || payload.name.substring(0, 4)).toUpperCase().trim();
    const now = new Date().toISOString();

    const deptRef = adminDb.collection('departments').doc();
    const newDepartment: Department = {
      id: deptRef.id,
      organizationId,
      name: payload.name.trim(),
      code,
      description: payload.description || '',
      headPersonId: payload.headPersonId || undefined,
      headPersonName: payload.headPersonName || undefined,
      memberCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    if (batch) {
      batch.set(deptRef, newDepartment);
    } else {
      await deptRef.set(newDepartment);
      await this.syncOrganizationDepartmentsProjection(organizationId);
    }

    return newDepartment;
  }

  /**
   * Updates an existing department.
   */
  static async updateDepartment(
    organizationId: string,
    departmentId: string,
    payload: UpdateDepartmentPayload
  ): Promise<Department> {
    if (!organizationId || !departmentId) throw new Error('Missing parameters');

    const deptRef = adminDb.collection('departments').doc(departmentId);
    const snap = await deptRef.get();

    if (!snap.exists) {
      throw new Error(`Department ${departmentId} not found`);
    }

    const current = { id: snap.id, ...snap.data() } as Department;
    if (current.organizationId !== organizationId) {
      throw new Error('Forbidden: Department belongs to a different organization');
    }

    const now = new Date().toISOString();
    const updated: Department = {
      ...current,
      name: payload.name ? payload.name.trim() : current.name,
      code: payload.code ? payload.code.toUpperCase().trim() : current.code,
      description: payload.description !== undefined ? payload.description : current.description,
      headPersonId: payload.headPersonId !== undefined ? payload.headPersonId : current.headPersonId,
      headPersonName: payload.headPersonName !== undefined ? payload.headPersonName : current.headPersonName,
      updatedAt: now,
    };

    await deptRef.set(updated, { merge: true });

    // If name changed, synchronize downstream
    if (payload.name && payload.name.trim() !== current.name) {
      // 1. Synchronize Person records assigned to this department
      try {
        const peopleSnap = await adminDb
          .collection('people')
          .where('organizationId', '==', organizationId)
          .where('departmentId', '==', departmentId)
          .get();

        if (!peopleSnap.empty) {
          // Chunk updates into batches of 200 (max 400 write ops per batch, well below Firestore 500 limit)
          const CHUNK_SIZE = 200;
          for (let i = 0; i < peopleSnap.docs.length; i += CHUNK_SIZE) {
            const chunk = peopleSnap.docs.slice(i, i + CHUNK_SIZE);
            const syncBatch = adminDb.batch();
            chunk.forEach((doc) => {
              syncBatch.update(doc.ref, { departmentName: updated.name, updatedAt: now });
              const userRef = adminDb.collection('users').doc(doc.id);
              syncBatch.set(userRef, { department: updated.name, updatedAt: now }, { merge: true });
            });
            await syncBatch.commit();
          }
        }
      } catch (personSyncErr) {
        console.warn(`[DepartmentService] Could not update people department names:`, personSyncErr);
      }

      await this.syncOrganizationDepartmentsProjection(organizationId);
    }

    return updated;
  }

  /**
   * Deletes a department after asserting no active members are assigned.
   */
  static async deleteDepartment(organizationId: string, departmentId: string): Promise<boolean> {
    if (!organizationId || !departmentId) throw new Error('Missing parameters');

    // 0. The id comes from the caller: only delete a department of this organization.
    if (!(await this.getDepartmentForOrganization(organizationId, departmentId))) {
      throw new Error(DEPARTMENT_NOT_IN_ORGANIZATION);
    }

    // 1. Assert no active people records in this department
    const peopleSnap = await adminDb
      .collection('people')
      .where('organizationId', '==', organizationId)
      .where('departmentId', '==', departmentId)
      .limit(1)
      .get();

    if (!peopleSnap.empty) {
      throw new Error('Cannot delete department: active members are assigned to this department. Please reassign them first.');
    }

    await adminDb.collection('departments').doc(departmentId).delete();
    await this.syncOrganizationDepartmentsProjection(organizationId);
    return true;
  }

  /**
   * Retrieves single department by ID.
   */
  static async getDepartment(departmentId: string): Promise<Department | null> {
    if (!departmentId) return null;
    const snap = await adminDb.collection('departments').doc(departmentId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as Department;
  }

  /**
   * Returns the department only when it belongs to `organizationId`, otherwise null.
   * Use this for any department id that came from a caller: `getDepartment` alone would
   * accept another organization's department.
   */
  static async getDepartmentForOrganization(
    organizationId: string,
    departmentId: string
  ): Promise<Department | null> {
    if (!organizationId) return null;
    const department = await this.getDepartment(departmentId);
    return department && department.organizationId === organizationId ? department : null;
  }

  /**
   * Finds a department of the organization by name, case-insensitively, without creating one.
   */
  static async findDepartmentByName(organizationId: string, name: string): Promise<Department | null> {
    const wanted = (name || '').trim().toLowerCase();
    if (!organizationId || !wanted) return null;
    const departments = await this.listDepartments(organizationId);
    return departments.find((d) => d.name.toLowerCase() === wanted) ?? null;
  }

  /**
   * Lists all departments for an organization.
   */
  static async listDepartments(organizationId: string): Promise<Department[]> {
    if (!organizationId) return [];
    const snap = await adminDb
      .collection('departments')
      .where('organizationId', '==', organizationId)
      .orderBy('name', 'asc')
      .get();

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Department));
  }

  /**
   * Recalculates and updates the member count for a department.
   */
  static async recalculateMemberCount(organizationId: string, departmentId: string): Promise<number> {
    // Callers pass ids from requests: never write a count onto another organization's department.
    if (!(await this.getDepartmentForOrganization(organizationId, departmentId))) {
      throw new Error(DEPARTMENT_NOT_IN_ORGANIZATION);
    }

    const peopleSnap = await adminDb
      .collection('people')
      .where('organizationId', '==', organizationId)
      .where('departmentId', '==', departmentId)
      .get();

    const count = peopleSnap.size;
    await adminDb.collection('departments').doc(departmentId).update({
      memberCount: count,
      updatedAt: new Date().toISOString(),
    });

    return count;
  }
}

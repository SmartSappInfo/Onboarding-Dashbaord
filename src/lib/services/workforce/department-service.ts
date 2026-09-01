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

export interface CreateDepartmentPayload {
  name: string;
  code?: string;
  description?: string;
  headPersonId?: string;
  headPersonName?: string;
}

export interface UpdateDepartmentPayload {
  name?: string;
  code?: string;
  description?: string;
  headPersonId?: string;
  headPersonName?: string;
}

export class DepartmentService {
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
    return updated;
  }

  /**
   * Deletes a department after asserting no active members are assigned.
   */
  static async deleteDepartment(organizationId: string, departmentId: string): Promise<boolean> {
    if (!organizationId || !departmentId) throw new Error('Missing parameters');

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

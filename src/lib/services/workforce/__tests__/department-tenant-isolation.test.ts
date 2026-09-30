/**
 * DepartmentService tenant isolation.
 *
 * Department ids reach the service from requests (profile edits, bulk assignment, invites), so
 * every read or write by id must stay inside the caller's organization. These tests use a small
 * in-memory Firestore so they can assert that nothing was written to another tenant's department.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DepartmentService, DEPARTMENT_NOT_IN_ORGANIZATION } from '../department-service';

type Row = Record<string, unknown>;

const store = vi.hoisted(() => ({
  departments: new Map<string, Record<string, unknown>>(),
  people: [] as Array<Record<string, unknown>>,
  writes: [] as Array<{ op: string; collection: string; id: string }>,
}));

vi.mock('@/lib/firebase-admin', () => {
  const rowsOf = (collection: string): Row[] =>
    collection === 'departments'
      ? [...store.departments.entries()].map(([id, data]) => ({ id, ...data }))
      : collection === 'people'
        ? store.people
        : [];

  const query = (collection: string, filters: Array<[string, unknown]>) => ({
    where: (field: string, _op: string, value: unknown) => query(collection, [...filters, [field, value]]),
    orderBy: () => query(collection, filters),
    limit: () => query(collection, filters),
    get: async () => {
      const docs = rowsOf(collection)
        .filter((row) => filters.every(([field, value]) => row[field] === value))
        .map((row) => ({ id: String(row.id), data: () => row }));
      return { empty: docs.length === 0, size: docs.length, docs };
    },
  });

  const docRef = (collection: string, id: string) => ({
    id,
    get: async () => {
      const data = collection === 'departments' ? store.departments.get(id) : undefined;
      return { id, exists: Boolean(data), data: () => data, get: (field: string) => data?.[field] };
    },
    set: async () => { store.writes.push({ op: 'set', collection, id }); },
    update: async () => { store.writes.push({ op: 'update', collection, id }); },
    delete: async () => { store.writes.push({ op: 'delete', collection, id }); },
  });

  return {
    adminDb: {
      collection: (collection: string) => ({
        doc: (id: string) => docRef(collection, id),
        ...query(collection, []),
      }),
    },
  };
});

vi.mock('../department-seed-service', () => ({
  DepartmentSeedService: { seedDepartmentsForOrganization: vi.fn() },
}));

describe('DepartmentService tenant isolation', () => {
  beforeEach(() => {
    store.departments.clear();
    store.people.length = 0;
    store.writes.length = 0;
    store.departments.set('dept_a', { organizationId: 'org_a', name: 'Sales', code: 'SALE', memberCount: 0 });
    store.departments.set('dept_b', { organizationId: 'org_b', name: 'Finance', code: 'FINA', memberCount: 3 });
  });

  it('getDepartmentForOrganization returns only the organization\'s own department', async () => {
    expect((await DepartmentService.getDepartmentForOrganization('org_a', 'dept_a'))?.name).toBe('Sales');
    expect(await DepartmentService.getDepartmentForOrganization('org_a', 'dept_b')).toBeNull();
    expect(await DepartmentService.getDepartmentForOrganization('org_a', 'missing')).toBeNull();
    expect(await DepartmentService.getDepartmentForOrganization('', 'dept_a')).toBeNull();
  });

  it('findDepartmentByName matches case-insensitively within the organization only', async () => {
    expect((await DepartmentService.findDepartmentByName('org_a', '  sales '))?.id).toBe('dept_a');
    expect(await DepartmentService.findDepartmentByName('org_a', 'Finance')).toBeNull();
    expect(await DepartmentService.findDepartmentByName('org_a', '   ')).toBeNull();
  });

  it('recalculateMemberCount never writes to another organization\'s department', async () => {
    await expect(DepartmentService.recalculateMemberCount('org_a', 'dept_b')).rejects.toThrow(
      DEPARTMENT_NOT_IN_ORGANIZATION
    );
    expect(store.writes).toEqual([]);
  });

  it('recalculateMemberCount updates the organization\'s own department', async () => {
    store.people.push({ id: 'p1', organizationId: 'org_a', departmentId: 'dept_a' });
    await expect(DepartmentService.recalculateMemberCount('org_a', 'dept_a')).resolves.toBe(1);
    expect(store.writes).toEqual([{ op: 'update', collection: 'departments', id: 'dept_a' }]);
  });

  it('deleteDepartment refuses another organization\'s department', async () => {
    await expect(DepartmentService.deleteDepartment('org_a', 'dept_b')).rejects.toThrow(DEPARTMENT_NOT_IN_ORGANIZATION);
    expect(store.writes).toEqual([]);
  });

  it('deleteDepartment still deletes an empty department of the organization', async () => {
    await expect(DepartmentService.deleteDepartment('org_a', 'dept_a')).resolves.toBe(true);
    expect(store.writes).toContainEqual({ op: 'delete', collection: 'departments', id: 'dept_a' });
  });
});

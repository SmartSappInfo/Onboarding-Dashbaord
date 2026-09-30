import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DepartmentService } from '../department-service';
import { DepartmentSeedService } from '../department-seed-service';

// Mock adminDb
const mockDocSet = vi.fn().mockResolvedValue(undefined);
const mockDocUpdate = vi.fn().mockResolvedValue(undefined);
const mockDocDelete = vi.fn().mockResolvedValue(undefined);
const mockOrgGet = vi.fn();
const mockDeptGet = vi.fn();
const mockDeptQueryGet = vi.fn();
const mockPeopleQueryGet = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((colName: string) => {
      if (colName === 'organizations') {
        return {
          doc: vi.fn((id: string) => ({
            get: () => mockOrgGet(id),
            set: (data: unknown, opts: unknown) => mockDocSet('organizations', id, data, opts),
            update: (data: unknown) => mockDocUpdate('organizations', id, data),
          })),
        };
      }
      if (colName === 'departments') {
        return {
          doc: vi.fn((id?: string) => ({
            id: id || 'generated_dept_id',
            get: () => mockDeptGet(id),
            set: (data: unknown, opts: unknown) => mockDocSet('departments', id || 'generated_dept_id', data, opts),
            update: (data: unknown) => mockDocUpdate('departments', id, data),
            delete: () => mockDocDelete('departments', id),
          })),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          get: () => mockDeptQueryGet(),
        };
      }
      if (colName === 'people') {
        return {
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: () => mockPeopleQueryGet(),
        };
      }
      return {
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false }),
          set: mockDocSet,
        })),
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      };
    }),
  },
}));

vi.mock('../department-seed-service', () => ({
  DepartmentSeedService: {
    seedDepartmentsForOrganization: vi.fn().mockResolvedValue({
      success: true,
      count: 2,
      departments: [
        { id: 'seed_1', organizationId: 'org_test', name: 'Engineering', code: 'ENG', memberCount: 0, createdAt: '2026-01-01' },
        { id: 'seed_2', organizationId: 'org_test', name: 'Product', code: 'PROD', memberCount: 0, createdAt: '2026-01-01' },
      ],
    }),
  },
}));

describe('DepartmentService SSoT Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCanonicalDepartmentsForOrganization', () => {
    it('returns existing departments if organization already has departments', async () => {
      mockDeptQueryGet.mockResolvedValueOnce({
        empty: false,
        size: 2,
        docs: [
          { id: 'dept_1', data: () => ({ organizationId: 'org_test', name: 'Sales Team', code: 'SOC', memberCount: 5 }) },
          { id: 'dept_2', data: () => ({ organizationId: 'org_test', name: 'Marketing', code: 'MKT', memberCount: 3 }) },
        ],
      });

      const depts = await DepartmentService.getCanonicalDepartmentsForOrganization('org_test');
      expect(depts).toHaveLength(2);
      expect(depts[0].name).toBe('Sales Team');
      expect(DepartmentSeedService.seedDepartmentsForOrganization).not.toHaveBeenCalled();
    });

    it('auto-seeds departments if organization has 0 departments', async () => {
      // First query empty
      mockDeptQueryGet.mockResolvedValueOnce({
        empty: true,
        size: 0,
        docs: [],
      });

      const depts = await DepartmentService.getCanonicalDepartmentsForOrganization('org_test');
      expect(DepartmentSeedService.seedDepartmentsForOrganization).toHaveBeenCalledWith('org_test');
      expect(depts).toHaveLength(2);
      expect(depts[0].name).toBe('Engineering');
    });
  });

  describe('findOrCreateDepartmentByName', () => {
    it('finds existing department case-insensitively', async () => {
      mockDeptQueryGet.mockResolvedValueOnce({
        empty: false,
        docs: [
          { id: 'dept_1', data: () => ({ organizationId: 'org_test', name: 'Sales Team', code: 'SOC', memberCount: 5 }) },
        ],
      });

      const dept = await DepartmentService.findOrCreateDepartmentByName('org_test', 'sales team');
      expect(dept.id).toBe('dept_1');
      expect(dept.name).toBe('Sales Team');
    });

    it('creates new department if not found and syncs organization projection', async () => {
      // Initial list has no match
      mockDeptQueryGet.mockResolvedValueOnce({
        empty: false,
        docs: [
          { id: 'dept_1', data: () => ({ organizationId: 'org_test', name: 'Operations', code: 'OPS', memberCount: 1 }) },
        ],
      });

      // Subsequent list for projection sync
      mockDeptQueryGet.mockResolvedValueOnce({
        empty: false,
        docs: [
          { id: 'dept_1', data: () => ({ organizationId: 'org_test', name: 'Operations', code: 'OPS', memberCount: 1 }) },
          { id: 'generated_dept_id', data: () => ({ organizationId: 'org_test', name: 'New Venture', code: 'NEW', memberCount: 0 }) },
        ],
      });

      const dept = await DepartmentService.findOrCreateDepartmentByName('org_test', 'New Venture');
      expect(dept.name).toBe('New Venture');
      expect(mockDocSet).toHaveBeenCalledWith(
        'departments',
        expect.any(String),
        expect.objectContaining({ name: 'New Venture', code: 'NEW' }),
        undefined
      );
      // Organization projection sync was called
      expect(mockDocSet).toHaveBeenCalledWith(
        'organizations',
        'org_test',
        expect.objectContaining({ departments: expect.arrayContaining(['Operations', 'New Venture']) }),
        { merge: true }
      );
    });
  });

  describe('syncOrganizationDepartmentsProjection', () => {
    it('updates organizations/{orgId} with all canonical department names', async () => {
      mockDeptQueryGet.mockResolvedValueOnce({
        empty: false,
        docs: [
          { id: 'd1', data: () => ({ name: 'Finance' }) },
          { id: 'd2', data: () => ({ name: 'Human Resources' }) },
        ],
      });

      const names = await DepartmentService.syncOrganizationDepartmentsProjection('org_123');
      expect(names).toEqual(['Finance', 'Human Resources']);
      expect(mockDocSet).toHaveBeenCalledWith(
        'organizations',
        'org_123',
        expect.objectContaining({ departments: ['Finance', 'Human Resources'] }),
        { merge: true }
      );
    });
  });
});

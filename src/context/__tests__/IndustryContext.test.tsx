import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { IndustryProvider, useIndustry } from '../IndustryContext';
import { useTenant } from '../TenantContext';
import type { Workspace } from '@/lib/types';

// Mock TenantContext
vi.mock('../TenantContext', () => ({
  useTenant: vi.fn(),
}));

describe('IndustryContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide SaaS industry config when workspace industry is SaaS', () => {
    const mockWorkspace: Partial<Workspace> = {
      id: 'ws1',
      industry: 'SaaS',
      name: 'Test Workspace',
    };

    vi.mocked(useTenant).mockReturnValue({
      activeWorkspace: mockWorkspace as Workspace,
      isLoading: false,
    } as any);

    const { result } = renderHook(() => useIndustry(), {
      wrapper: IndustryProvider,
    });

    expect(result.current.industry).toBe('SaaS');
    expect(result.current.terminology.entitySingular).toBe('Account');
    expect(result.current.terminology.entityPlural).toBe('Accounts');
    expect(result.current.features.trials).toBe(true);
    expect(result.current.features.applications).toBe(false);
    expect(result.current.pipelineTemplate.name).toBe('Customer Pipeline');
    expect(result.current.sidebarItems).toHaveLength(6);
    expect(result.current.contactTypes).toContain('Admin');
  });

  it('should provide SchoolEnrollment industry config when workspace industry is SchoolEnrollment', () => {
    const mockWorkspace: Partial<Workspace> = {
      id: 'ws2',
      industry: 'SchoolEnrollment',
      name: 'School Workspace',
    };

    vi.mocked(useTenant).mockReturnValue({
      activeWorkspace: mockWorkspace as Workspace,
      isLoading: false,
    } as any);

    const { result } = renderHook(() => useIndustry(), {
      wrapper: IndustryProvider,
    });

    expect(result.current.industry).toBe('SchoolEnrollment');
    expect(result.current.terminology.entitySingular).toBe('School');
    expect(result.current.terminology.entityPlural).toBe('Schools');
    expect(result.current.features.trials).toBe(false);
    expect(result.current.features.applications).toBe(true);
    expect(result.current.pipelineTemplate.name).toBe('Admissions Pipeline');
    expect(result.current.sidebarItems).toHaveLength(5);
    expect(result.current.contactTypes).toContain('Principal');
  });

  it('should provide Law industry config when workspace industry is Law', () => {
    const mockWorkspace: Partial<Workspace> = {
      id: 'ws3',
      industry: 'Law',
      name: 'Law Workspace',
    };

    vi.mocked(useTenant).mockReturnValue({
      activeWorkspace: mockWorkspace as Workspace,
      isLoading: false,
    } as any);

    const { result } = renderHook(() => useIndustry(), {
      wrapper: IndustryProvider,
    });

    expect(result.current.industry).toBe('Law');
    expect(result.current.terminology.entitySingular).toBe('Client');
    expect(result.current.terminology.entityPlural).toBe('Clients');
    expect(result.current.features.matters).toBe(true);
    expect(result.current.features.trials).toBe(false);
    expect(result.current.pipelineTemplate.name).toBe('Legal Pipeline');
    expect(result.current.sidebarItems).toHaveLength(6);
  });

  it('should default to SaaS when workspace is not loaded', () => {
    vi.mocked(useTenant).mockReturnValue({
      activeWorkspace: undefined,
      isLoading: true,
    } as any);

    const { result } = renderHook(() => useIndustry(), {
      wrapper: IndustryProvider,
    });

    expect(result.current.industry).toBe('SaaS');
    expect(result.current.terminology.entitySingular).toBe('Account');
    expect(result.current.isLoading).toBe(true);
  });

  it('should default to SaaS when workspace has no industry field', () => {
    const mockWorkspace: Partial<Workspace> = {
      id: 'ws4',
      name: 'Legacy Workspace',
      // No industry field
    };

    vi.mocked(useTenant).mockReturnValue({
      activeWorkspace: mockWorkspace as Workspace,
      isLoading: false,
    } as any);

    const { result } = renderHook(() => useIndustry(), {
      wrapper: IndustryProvider,
    });

    expect(result.current.industry).toBe('SaaS');
    expect(result.current.terminology.entitySingular).toBe('Account');
  });

  it('should throw error when used outside IndustryProvider', () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useIndustry());
    }).toThrow('useIndustry must be used within an IndustryProvider');

    consoleError.mockRestore();
  });

  it('should provide all industry configs for all supported industries', () => {
    const industries: Array<{ industry: any; expectedTerminology: string }> = [
      { industry: 'SaaS', expectedTerminology: 'Account' },
      { industry: 'SchoolEnrollment', expectedTerminology: 'School' },
      { industry: 'Law', expectedTerminology: 'Client' },
      { industry: 'Marketing', expectedTerminology: 'Client' },
      { industry: 'RealEstate', expectedTerminology: 'Client' },
      { industry: 'Consultancy', expectedTerminology: 'Client' },
    ];

    industries.forEach(({ industry, expectedTerminology }) => {
      const mockWorkspace: Partial<Workspace> = {
        id: `ws-${industry}`,
        industry: industry as any,
        name: `${industry} Workspace`,
      };

      vi.mocked(useTenant).mockReturnValue({
        activeWorkspace: mockWorkspace as Workspace,
        isLoading: false,
      } as any);

      const { result } = renderHook(() => useIndustry(), {
        wrapper: IndustryProvider,
      });

      expect(result.current.industry).toBe(industry);
      expect(result.current.terminology.entitySingular).toBe(expectedTerminology);
      expect(result.current.features).toBeDefined();
      expect(result.current.pipelineTemplate).toBeDefined();
      expect(result.current.sidebarItems.length).toBeGreaterThan(0);
      expect(result.current.contactTypes.length).toBeGreaterThan(0);
    });
  });
});

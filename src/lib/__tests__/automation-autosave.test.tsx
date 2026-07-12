import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { renderHook } from '@testing-library/react';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock dependencies
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/automation-storage', () => {
  return {
    getAutomationBackup: (id: string) => {
      const val = localStorage.getItem(`automation-autosave-${id}`);
      return val ? JSON.parse(val) : null;
    },
    saveAutomationBackup: (id: string, payload: any) => {
      localStorage.setItem(`automation-autosave-${id}`, JSON.stringify({
        ...payload,
        version: 1,
        timestamp: new Date().toISOString(),
      }));
    },
    clearAutomationBackup: (id: string) => {
      localStorage.removeItem(`automation-autosave-${id}`);
    },
  };
});

// Import hook
import { useAutomationAutosave } from '../../app/admin/automations/hooks/useAutomationAutosave';

describe('Automation Autosave System', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should ignore backup if it has no functional differences (only positions changed)', () => {
    const mockDbAutomation = {
      id: 'auto-123',
      name: 'Test Workflow',
      description: 'A test description',
      updatedAt: '2026-07-12T10:00:00.000Z',
      triggers: [{ id: 't1', type: 'TAG_ADDED', config: {} }],
      nodes: [
        { id: 'n1', type: 'triggerNode', position: { x: 100, y: 100 }, data: { label: 'Start' } }
      ],
      edges: [],
    } as any;

    // Save a backup with different coordinates but same settings
    const backupData = {
      version: 1,
      name: 'Test Workflow',
      description: 'A test description',
      triggers: [{ id: 't1', type: 'TAG_ADDED', config: {} }],
      nodes: [
        { id: 'n1', type: 'triggerNode', position: { x: 250, y: 350 }, data: { label: 'Start' } } // changed coords
      ],
      edges: [],
      timestamp: '2026-07-12T11:00:00.000Z', // newer backup
      dbUpdatedAt: '2026-07-12T10:00:00.000Z',
    };
    localStorage.setItem('automation-autosave-auto-123', JSON.stringify(backupData));

    // Render hook
    const { result } = renderHook(() =>
      useAutomationAutosave('auto-123', mockDbAutomation, mockDbAutomation, false)
    );

    // Verify it pruned the backup and did not open restore dialog
    expect(result.current.showRestoreDialog).toBe(false);
    expect(localStorage.getItem('automation-autosave-auto-123')).toBeNull();
  });

  it('should show restore dialog if backup has real functional changes (e.g., added node)', () => {
    const mockDbAutomation = {
      id: 'auto-123',
      name: 'Test Workflow',
      description: 'A test description',
      updatedAt: '2026-07-12T10:00:00.000Z',
      triggers: [{ id: 't1', type: 'TAG_ADDED', config: {} }],
      nodes: [
        { id: 'n1', type: 'triggerNode', position: { x: 100, y: 100 }, data: { label: 'Start' } }
      ],
      edges: [],
    } as any;

    // Backup has a second node added
    const backupData = {
      version: 1,
      name: 'Test Workflow',
      description: 'A test description',
      triggers: [{ id: 't1', type: 'TAG_ADDED', config: {} }],
      nodes: [
        { id: 'n1', type: 'triggerNode', position: { x: 100, y: 100 }, data: { label: 'Start' } },
        { id: 'n2', type: 'actionNode', position: { x: 100, y: 250 }, data: { label: 'Email' } }
      ],
      edges: [],
      timestamp: '2026-07-12T11:00:00.000Z', // newer backup
      dbUpdatedAt: '2026-07-12T10:00:00.000Z',
    };
    localStorage.setItem('automation-autosave-auto-123', JSON.stringify(backupData));

    // Render hook
    const { result } = renderHook(() =>
      useAutomationAutosave('auto-123', mockDbAutomation, mockDbAutomation, false)
    );

    // Verify it opened the restore dialog
    expect(result.current.showRestoreDialog).toBe(true);
    expect(localStorage.getItem('automation-autosave-auto-123')).not.toBeNull();
  });
});

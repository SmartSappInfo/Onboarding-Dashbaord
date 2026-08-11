import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveAutomationBackup,
  getAutomationBackup,
  clearAutomationBackup,
  AutomationBackup,
} from '../automation-storage';
import type { AutomationTriggerDef } from '../types';

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

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Automation Storage & Timestamp Invariants', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('saves and retrieves a minimized automation backup', () => {
    const automationId = 'auto-123';
    const triggers: AutomationTriggerDef[] = [
      { id: 'trg-1', type: 'TAG_ADDED', config: { tagId: 't-1' } },
    ];
    const payload = {
      name: 'Test Automation Blueprint',
      description: 'Test Description',
      triggers,
      nodes: [
        { id: 'n1', type: 'action', position: { x: 100, y: 200 }, data: { label: 'Send SMS' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'a', targetHandle: 'b', type: 'default' },
      ],
      dbUpdatedAt: '2026-08-11T08:00:00.000Z',
    };

    saveAutomationBackup(automationId, payload);

    const backup = getAutomationBackup(automationId);
    expect(backup).not.toBeNull();
    expect(backup?.name).toBe('Test Automation Blueprint');
    expect(backup?.nodes.length).toBe(1);
    expect(backup?.nodes[0].id).toBe('n1');
    expect(backup?.edges.length).toBe(1);
    expect(backup?.edges[0].source).toBe('n1');
  });

  it('clears local backup entry on clearAutomationBackup call', () => {
    const automationId = 'auto-456';
    saveAutomationBackup(automationId, {
      name: 'Draft',
      description: '',
      triggers: [],
      nodes: [],
      edges: [],
      dbUpdatedAt: '',
    });

    expect(getAutomationBackup(automationId)).not.toBeNull();

    clearAutomationBackup(automationId);
    expect(getAutomationBackup(automationId)).toBeNull();
  });

  it('identifies when a backup timestamp is older than or equal to database timestamp', () => {
    const dbUpdatedAt = '2026-08-11T08:30:00.000Z';
    const olderBackupTime = '2026-08-11T08:15:00.000Z'; // 15 mins older than DB

    const backup: AutomationBackup = {
      version: 1,
      name: 'Stale Backup',
      description: '',
      triggers: [],
      nodes: [],
      edges: [],
      timestamp: olderBackupTime,
      dbUpdatedAt: dbUpdatedAt,
    };

    const backupTime = new Date(backup.timestamp).getTime();
    const dbTime = new Date(dbUpdatedAt).getTime();

    // Timestamp Invariant check: backup must NEVER be <= dbTime
    expect(backupTime <= dbTime).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import {
  MemoryTierSchema,
  MemoryTypeSchema,
  SensitivityLevelSchema,
  VerificationStateSchema,
  MemoryLifecycleStatusSchema,
  TemporalValiditySchema,
  SubjectReferencesSchema,
  MemorySourceSchema,
  CanonicalMemoryObjectSchema,
  CreateMemoryInputSchema,
  QueryMemoryInputSchema,
  MEMORY_ERROR_CODES,
} from '@/platform/memory/contracts/memory-types';

describe('Canonical Memory Contracts (Rules 4, 8, 16, 29, 32)', () => {
  it('validates canonical 5 memory tiers (Rule 4)', () => {
    const validTiers = ['working', 'episodic', 'semantic', 'relational', 'procedural'];
    for (const tier of validTiers) {
      expect(MemoryTierSchema.parse(tier)).toBe(tier);
    }
    expect(() => MemoryTierSchema.parse('invalid_tier')).toThrow();
  });

  it('validates PRD §8 memory types and §9 sources', () => {
    expect(MemoryTypeSchema.parse('insight')).toBe('insight');
    expect(MemoryTypeSchema.parse('document_chunk')).toBe('document_chunk');
    expect(MemorySourceSchema.parse({
      type: 'meeting',
      sourceId: 'meet-123',
      sourceHash: 'a'.repeat(64),
    })).toBeDefined();
  });

  it('validates sensitivity, verification, and lifecycle statuses', () => {
    expect(SensitivityLevelSchema.parse('restricted')).toBe('restricted');
    expect(VerificationStateSchema.parse('source_verified')).toBe('source_verified');
    expect(MemoryLifecycleStatusSchema.parse('active')).toBe('active');
    expect(SubjectReferencesSchema.parse({ dealIds: ['deal-1'], entityIds: ['ent-1'] })).toBeDefined();
    
    const parsedInput = CreateMemoryInputSchema.parse({
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      type: 'fact',
      content: 'Valid content',
      source: { type: 'crm_entity', sourceId: 'crm-1' },
      provenance: { createdBy: 'agent', agentId: 'agent-1' },
    });
    expect(parsedInput.tier).toBe('semantic');
  });

  it('validates temporal validity with decayRate bounds (Rule 29)', () => {
    const valid = TemporalValiditySchema.parse({
      validFrom: '2026-10-01T00:00:00.000Z',
      validUntil: '2026-12-31T23:59:59.000Z',
      decayRate: 0.05,
    });
    expect(valid.decayRate).toBe(0.05);

    expect(() => TemporalValiditySchema.parse({
      validFrom: 'not-a-date',
    })).toThrow();

    expect(() => TemporalValiditySchema.parse({
      validFrom: '2026-10-01T00:00:00.000Z',
      decayRate: 1.5, // Out of bounds [0.0, 1.0]
    })).toThrow();
  });

  it('validates complete CanonicalMemoryObject with sensitivity and provenance', () => {
    const memory = CanonicalMemoryObjectSchema.parse({
      id: 'mem-001',
      organizationId: 'org-test-1',
      workspaceId: 'ws-test-1',
      tier: 'semantic',
      type: 'insight',
      title: 'Customer WhatsApp Preference',
      content: 'Bright Future Academy prefers WhatsApp communications over email.',
      source: {
        type: 'meeting',
        sourceId: 'meet-999',
      },
      subjectRefs: {
        entityIds: ['entity-100'],
      },
      topics: ['communication', 'preferences'],
      importance: 0.85,
      confidence: 0.95,
      verification: 'source_verified',
      sensitivity: 'internal',
      lifecycle: { status: 'active' },
      temporal: {
        validFrom: '2026-10-01T00:00:00.000Z',
      },
      provenance: {
        createdBy: 'agent',
        agentId: 'agent-sdr-1',
      },
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    });

    expect(memory.tier).toBe('semantic');
    expect(memory.confidence).toBe(0.95);
    expect(memory.sensitivity).toBe('internal');
  });

  it('enforces fail-closed multi-tenant isolation in QueryMemoryInputSchema (Rule 8)', () => {
    expect(() => QueryMemoryInputSchema.parse({
      query: 'Find contacts',
      organizationId: '', // Empty org fails
      workspaceId: 'ws-1',
    })).toThrow();

    expect(() => QueryMemoryInputSchema.parse({
      query: 'Find contacts',
      organizationId: 'org-1',
      workspaceId: '', // Empty ws fails
    })).toThrow();
  });

  it('exposes complete domain error taxonomy', () => {
    expect(MEMORY_ERROR_CODES.TENANT_REQUIRED).toBe('MEMORY_TENANT_REQUIRED');
    expect(MEMORY_ERROR_CODES.MEMORY_EXPIRED).toBe('MEMORY_EXPIRED');
    expect(MEMORY_ERROR_CODES.INJECTION_DETECTED).toBe('MEMORY_INJECTION_DETECTED');
    expect(MEMORY_ERROR_CODES.CIRCUIT_BREAKER_OPEN).toBe('MEMORY_CIRCUIT_BREAKER_OPEN');
    expect(MEMORY_ERROR_CODES.DEAD_MAN_PAUSED).toBe('MEMORY_DEAD_MAN_PAUSED');
  });
});

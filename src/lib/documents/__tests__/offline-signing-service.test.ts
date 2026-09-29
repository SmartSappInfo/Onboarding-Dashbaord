/**
 * Offline PWA Signing Engine & Evidence Sync Queue Test Suite
 *
 * Verifies biometric stroke capture, entropy calculations, offline package assembly,
 * and idempotent replay with conflict quarantine (FM-P8-07, FM-P8-08, FM-P8-09).
 *
 * @maintainer Antigravity Pair Programming
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateBiometricEntropy,
  createOfflineSigningPackage,
  replayOfflineSigningPackage,
} from '@/lib/documents/offline-signing-service';
import { adminDb } from '@/lib/firebase-admin';
import type { OfflineBiometricStroke } from '@/lib/types/document-signing';

vi.mock('@/lib/firebase-admin', () => {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockDoc = vi.fn(() => ({
    get: vi.fn(),
    set: mockSet,
    update: mockUpdate,
  }));
  const mockCollection = vi.fn(() => ({
    doc: mockDoc,
    add: vi.fn().mockResolvedValue({ id: 'conf_123' }),
  }));

  return {
    adminDb: {
      collection: mockCollection,
      doc: mockDoc,
    },
  };
});

describe('OfflineSigningService', () => {
  const sampleStrokes: OfflineBiometricStroke[] = [
    {
      points: [
        { x: 10, y: 20, time: 1000, pressure: 0.5, velocity: 1.2 },
        { x: 15, y: 25, time: 1020, pressure: 0.6, velocity: 1.5 },
        { x: 25, y: 35, time: 1050, pressure: 0.7, velocity: 1.8 },
      ],
    },
    {
      points: [
        { x: 50, y: 60, time: 1100, pressure: 0.4, velocity: 0.9 },
        { x: 70, y: 80, time: 1150, pressure: 0.8, velocity: 2.1 },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateBiometricEntropy', () => {
    it('computes bounding box, duration, and non-zero entropy for multi-stroke signature', () => {
      const result = calculateBiometricEntropy(sampleStrokes);
      expect(result.pointCount).toBe(5);
      expect(result.durationMs).toBe(150); // 1150 - 1000
      expect(result.boundingBox).toEqual({
        minX: 10,
        minY: 20,
        maxX: 70,
        maxY: 80,
        width: 60,
        height: 60,
      });
      expect(result.entropyScore).toBeGreaterThan(0);
      expect(result.entropyScore).toBeLessThanOrEqual(1.0);
    });

    it('returns zero entropy and safe defaults for empty strokes', () => {
      const result = calculateBiometricEntropy([]);
      expect(result.pointCount).toBe(0);
      expect(result.durationMs).toBe(0);
      expect(result.entropyScore).toBe(0);
      expect(result.boundingBox).toEqual({
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        width: 0,
        height: 0,
      });
    });
  });

  describe('createOfflineSigningPackage', () => {
    it('assembles a validated offline package with nonce and ISO timestamp', () => {
      const pkg = createOfflineSigningPackage({
        envelopeId: 'env_offline_01',
        recipientId: 'rec_offline_02',
        strokes: sampleStrokes,
        deviceFingerprint: 'dev_ipad_pro_123',
        documentSha256: 'a'.repeat(64),
      });

      expect(pkg.envelopeId).toBe('env_offline_01');
      expect(pkg.recipientId).toBe('rec_offline_02');
      expect(pkg.deviceFingerprint).toBe('dev_ipad_pro_123');
      expect(pkg.documentSha256).toBe('a'.repeat(64));
      expect(pkg.nonce).toBeDefined();
      expect(pkg.signedAt).toBeDefined();
      expect(pkg.strokes.length).toBe(2);
    });
  });

  describe('replayOfflineSigningPackage', () => {
    const validEnvelopeData = {
      id: 'env_100',
      workspaceId: 'ws_demo',
      title: 'Consulting Contract',
      status: 'sent',
      preExecutionSha256: 'a'.repeat(64),
      routingMode: 'sequential',
      currentRoutingOrder: 1,
      recipients: [
        {
          id: 'rec_alice',
          name: 'Alice',
          email: 'alice@example.com',
          role: 'signer',
          routingOrder: 1,
          status: 'invited',
          tokenHash: 'hash...',
          tokenExpiresAt: '2026-10-29T00:00:00Z',
        },
      ],
      createdAt: '2026-09-29T10:00:00Z',
      updatedAt: '2026-09-29T10:00:00Z',
      expiresAt: '2026-10-15T00:00:00Z',
      createdBy: 'user_admin',
    };

    it('successfully replays signature onto an active envelope', async () => {
      const mockDocRef = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ ...validEnvelopeData }),
        }),
        update: vi.fn().mockResolvedValue(undefined),
        set: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef),
        add: vi.fn().mockResolvedValue({ id: 'sync_log_1' }),
      } as unknown as ReturnType<typeof adminDb.collection>);

      const payload = createOfflineSigningPackage({
        envelopeId: 'env_100',
        recipientId: 'rec_alice',
        strokes: sampleStrokes,
        deviceFingerprint: 'device_01',
        documentSha256: 'a'.repeat(64),
      });

      const result = await replayOfflineSigningPackage('ws_demo', payload);
      expect(result.success).toBe(true);
      expect(result.status).toBe('synced');
      expect(mockDocRef.set).toHaveBeenCalled();
    });

    it('quarantines payload to offline_sync_conflicts when envelope was voided during offline (FM-P8-07)', async () => {
      const voidedEnvelope = {
        ...validEnvelopeData,
        status: 'voided',
        voidReason: 'Voided by sender while signer was offline',
      };

      const mockDocRef = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => voidedEnvelope,
        }),
        update: vi.fn(),
        set: vi.fn(),
      };

      const mockConflictCollection = {
        doc: vi.fn().mockReturnValue(mockDocRef),
        add: vi.fn().mockResolvedValue({ id: 'conflict_rec_01' }),
      };

      vi.mocked(adminDb.collection).mockReturnValue(mockConflictCollection as unknown as ReturnType<typeof adminDb.collection>);

      const payload = createOfflineSigningPackage({
        envelopeId: 'env_100',
        recipientId: 'rec_alice',
        strokes: sampleStrokes,
        deviceFingerprint: 'device_01',
        documentSha256: 'a'.repeat(64),
      });

      const result = await replayOfflineSigningPackage('ws_demo', payload);
      expect(result.success).toBe(false);
      expect(result.status).toBe('conflict');
      expect(result.reason).toContain('voided');
      expect(mockConflictCollection.add).toHaveBeenCalled();
    });

    it('quarantines payload when recipient already executed document online (FM-P8-08)', async () => {
      const alreadySignedEnvelope = {
        ...validEnvelopeData,
        recipients: [
          {
            ...validEnvelopeData.recipients[0],
            status: 'signed',
            signedAt: '2026-09-29T11:00:00Z',
          },
        ],
      };

      const mockDocRef = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => alreadySignedEnvelope,
        }),
        update: vi.fn(),
        set: vi.fn(),
      };

      const mockConflictCollection = {
        doc: vi.fn().mockReturnValue(mockDocRef),
        add: vi.fn().mockResolvedValue({ id: 'conflict_rec_02' }),
      };

      vi.mocked(adminDb.collection).mockReturnValue(mockConflictCollection as unknown as ReturnType<typeof adminDb.collection>);

      const payload = createOfflineSigningPackage({
        envelopeId: 'env_100',
        recipientId: 'rec_alice',
        strokes: sampleStrokes,
        deviceFingerprint: 'device_01',
        documentSha256: 'a'.repeat(64),
      });

      const result = await replayOfflineSigningPackage('ws_demo', payload);
      expect(result.success).toBe(false);
      expect(result.status).toBe('conflict');
      expect(result.reason).toContain('already executed');
      expect(mockConflictCollection.add).toHaveBeenCalled();
    });
  });
});

/**
 * @fileOverview Capability Flag Service & Firestore Adapter (Phase 1 / PR-8)
 *
 * Implements Rule 60 (Dead-Man Controls), Rule 62 (Zero Deployments / 60s TTL),
 * Rule 64 (Precedence Hierarchy), and PRD §73.
 *
 * Provides:
 * - `FlagService`: Unified interface implementing `FlagChecker`.
 * - `InMemoryFlagService`: Fast in-memory flag service for unit tests and local dev.
 * - `FirestoreFlagService`: Production Firestore flag service with 60-second in-memory caching.
 * - `defaultFlagChecker`: Process-wide default flag checker.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { AgentPrincipal, AnyCapabilityDefinition } from '../contracts/capability-definition';
import type { InvocationSurface } from '../execution/invocation';
import type {
  CapabilityFlagRecord,
  FlagEvaluationResult,
  FlagOverride,
  GlobalAutonomousControl,
} from './capability-flags-types';
import { evaluateCapabilityFlag } from './evaluate-capability-flag';

export interface FlagCheckContext {
  capability: AnyCapabilityDefinition;
  principal: AgentPrincipal;
  surface?: InvocationSurface;
}

export interface FlagChecker {
  checkFlag(
    context: FlagCheckContext
  ): Promise<{ enabled: boolean; reason?: string }> | { enabled: boolean; reason?: string };
}

export interface FlagService extends FlagChecker {
  checkFlag(context: FlagCheckContext): Promise<FlagEvaluationResult>;
  invalidateCache(capabilityId?: string): void;
  getFlagRecord(capabilityId: string): Promise<CapabilityFlagRecord | null>;
  setFlagRecord?(record: CapabilityFlagRecord): Promise<void>;
}

export const PLATFORM_FEATURES_COLLECTION = 'platform_features';
export const AI_CONFIG_DOC_PATH = 'system_settings/ai_config';
export const DEFAULT_FLAG_CACHE_TTL_MS = 60 * 1000; // 60 seconds (Rule 62)

/**
 * In-Memory Flag Service for unit testing and offline development.
 */
export class InMemoryFlagService implements FlagService {
  private readonly flags = new Map<string, CapabilityFlagRecord>();
  private globalControl: GlobalAutonomousControl = {
    autonomousExecutionEnabled: true,
    killSwitch: false,
  };

  public setFlag(record: CapabilityFlagRecord): void {
    this.flags.set(record.capabilityId, { ...record });
  }

  public setFlagRecord = async (record: CapabilityFlagRecord): Promise<void> => {
    this.setFlag(record);
  };

  public async getFlagRecord(capabilityId: string): Promise<CapabilityFlagRecord | null> {
    return this.flags.get(capabilityId) ?? null;
  }

  public getFlag(capabilityId: string): CapabilityFlagRecord | undefined {
    return this.flags.get(capabilityId);
  }

  public setGlobalAutonomousControl(control: GlobalAutonomousControl): void {
    this.globalControl = { ...control };
  }

  public getGlobalAutonomousControl(): GlobalAutonomousControl {
    return { ...this.globalControl };
  }

  public clear(): void {
    this.flags.clear();
    this.globalControl = {
      autonomousExecutionEnabled: true,
      killSwitch: false,
    };
  }

  public invalidateCache(_capabilityId?: string): void {
    // In-memory changes reflect immediately; cache invalidation is a no-op
  }

  public async checkFlag(context: FlagCheckContext): Promise<FlagEvaluationResult> {
    const flagRecord = this.flags.get(context.capability.id) ?? null;
    return evaluateCapabilityFlag({
      flagRecord,
      principal: context.principal,
      capability: context.capability,
      surface: context.surface,
      globalAutonomousControl: this.globalControl,
    });
  }
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

function parseOverridesRecord(val: unknown): Record<string, FlagOverride> | undefined {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) {
    return undefined;
  }
  const result: Record<string, FlagOverride> = {};
  for (const [key, rawEntry] of Object.entries(val as Record<string, unknown>)) {
    if (typeof rawEntry === 'object' && rawEntry !== null) {
      const entryObj = rawEntry as Record<string, unknown>;
      result[key] = {
        enabled: typeof entryObj.enabled === 'boolean' ? entryObj.enabled : undefined,
        agentEnabled: typeof entryObj.agentEnabled === 'boolean' ? entryObj.agentEnabled : undefined,
        mcpEnabled: typeof entryObj.mcpEnabled === 'boolean' ? entryObj.mcpEnabled : undefined,
        humanEnabled: typeof entryObj.humanEnabled === 'boolean' ? entryObj.humanEnabled : undefined,
      };
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Production Firestore-backed Flag Service with 60-second TTL in-memory caching.
 */
export class FirestoreFlagService implements FlagService {
  private readonly flagCache = new Map<string, CacheEntry<CapabilityFlagRecord | null>>();
  private globalControlCache: CacheEntry<GlobalAutonomousControl> | null = null;
  private readonly ttlMs: number;

  constructor(ttlMs: number = DEFAULT_FLAG_CACHE_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  public invalidateCache(capabilityId?: string): void {
    if (capabilityId) {
      this.flagCache.delete(capabilityId);
    } else {
      this.flagCache.clear();
      this.globalControlCache = null;
    }
  }

  public async getGlobalAutonomousControl(nowMs: number = Date.now()): Promise<GlobalAutonomousControl> {
    if (this.globalControlCache && nowMs - this.globalControlCache.cachedAt < this.ttlMs) {
      return this.globalControlCache.data;
    }

    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const snap = await adminDb.doc(AI_CONFIG_DOC_PATH).get();
      let control: GlobalAutonomousControl = {
        autonomousExecutionEnabled: true,
        killSwitch: false,
      };

      if (snap.exists) {
        const data = snap.data();
        if (data) {
          control = {
            autonomousExecutionEnabled:
              typeof data.autonomousExecutionEnabled === 'boolean'
                ? data.autonomousExecutionEnabled
                : true,
            killSwitch:
              typeof data.killSwitch === 'boolean' ? data.killSwitch : false,
            reason: typeof data.reason === 'string' ? data.reason : undefined,
          };
        }
      }

      this.globalControlCache = {
        data: control,
        cachedAt: nowMs,
      };
      return control;
    } catch {
      // Return cached fallback if available, or default open to preserve human operations
      if (this.globalControlCache) {
        return this.globalControlCache.data;
      }
      return { autonomousExecutionEnabled: true, killSwitch: false };
    }
  }

  public async getFlagRecord(
    capabilityId: string,
    nowMs: number = Date.now()
  ): Promise<CapabilityFlagRecord | null> {
    const cached = this.flagCache.get(capabilityId);
    if (cached && nowMs - cached.cachedAt < this.ttlMs) {
      return cached.data;
    }

    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const docRef = adminDb.collection(PLATFORM_FEATURES_COLLECTION).doc(`capability:${capabilityId}`);
      const snap = await docRef.get();

      let record: CapabilityFlagRecord | null = null;
      if (snap.exists) {
        const raw = snap.data();
        if (raw) {
          record = {
            capabilityId,
            killSwitch: typeof raw.killSwitch === 'boolean' ? raw.killSwitch : undefined,
            defaultState: typeof raw.defaultState === 'boolean' ? raw.defaultState : undefined,
            agentEnabled: typeof raw.agentEnabled === 'boolean' ? raw.agentEnabled : undefined,
            mcpEnabled: typeof raw.mcpEnabled === 'boolean' ? raw.mcpEnabled : undefined,
            humanEnabled: typeof raw.humanEnabled === 'boolean' ? raw.humanEnabled : undefined,
            orgOverrides: parseOverridesRecord(raw.orgOverrides),
            workspaceOverrides: parseOverridesRecord(raw.workspaceOverrides),
            rolloutPercentage: typeof raw.rolloutPercentage === 'number' ? raw.rolloutPercentage : undefined,
            updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
            updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : undefined,
          };
        }
      }

      this.flagCache.set(capabilityId, {
        data: record,
        cachedAt: nowMs,
      });
      return record;
    } catch {
      // In case of error, return cached if present or fallback null (fails open to capability policies)
      if (cached) {
        return cached.data;
      }
      return null;
    }
  }

  public async setFlagRecord(record: CapabilityFlagRecord): Promise<void> {
    const { adminDb } = await import('@/lib/firebase-admin');
    const docRef = adminDb.collection(PLATFORM_FEATURES_COLLECTION).doc(`capability:${record.capabilityId}`);
    await docRef.set(record, { merge: true });
    this.invalidateCache(record.capabilityId);
  }

  public async checkFlag(context: FlagCheckContext): Promise<FlagEvaluationResult> {
    const [flagRecord, globalAutonomousControl] = await Promise.all([
      this.getFlagRecord(context.capability.id),
      this.getGlobalAutonomousControl(),
    ]);

    return evaluateCapabilityFlag({
      flagRecord,
      principal: context.principal,
      capability: context.capability,
      surface: context.surface,
      globalAutonomousControl,
    });
  }
}

export function createInMemoryFlagService(): InMemoryFlagService {
  return new InMemoryFlagService();
}

/**
 * Process-wide default flag checker.
 * Uses InMemoryFlagService in test environments or when Firebase is not configured,
 * and FirestoreFlagService in production Cloud Run environments.
 */
export const defaultFlagChecker: FlagService =
  process.env.NODE_ENV === 'test' || !process.env.FIREBASE_PROJECT_ID
    ? new InMemoryFlagService()
    : new FirestoreFlagService();

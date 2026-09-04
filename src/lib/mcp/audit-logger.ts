/**
 * @fileOverview CompanyBrain 2.0 Phase 6: MCP Audit Logger & Telemetry
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Non-Blocking Async Telemetry:
 *    - Logging does not block tool responses; uses non-blocking background write.
 * 2. Sensitive Data Redaction:
 *    - Deeply scrubs API keys, passwords, bearer tokens, and secrets from input payloads.
 * 3. Multi-Tenant Scoping:
 *    - All audit logs in `/mcp_audit_logs` are indexed by `workspaceId` and `timestamp`.
 * 4. Strict Zero-`any` & Zero-`unknown` Invariant:
 *    - Uses typed `McpAuditLog` and recursive `McpPayloadValue`.
 *
 * @testability Covered in `src/lib/mcp/__tests__/mcp-gateway.test.ts`.
 */

import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import type { McpAuditLog, McpPayloadValue } from './types';

const SENSITIVE_SUBSTRINGS = [
  'apikey',
  'password',
  'token',
  'secret',
  'authorization',
  'auth',
  'cookie',
  'accesstoken',
  'private',
  'credential',
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_SUBSTRINGS.some((s) => lower.includes(s));
}

/**
 * Recursively redacts sensitive keys from payload structures with max depth guard.
 */
function sanitizePayload(val: McpPayloadValue, depth: number = 0): McpPayloadValue {
  if (depth > 5) {
    return '[DEPTH_EXCEEDED]';
  }

  if (val === null || typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return val;
  }

  if (Array.isArray(val)) {
    return val.map((item) => sanitizePayload(item, depth + 1));
  }

  const sanitizedRecord: Record<string, McpPayloadValue> = {};
  for (const [k, v] of Object.entries(val)) {
    if (isSensitiveKey(k)) {
      sanitizedRecord[k] = '[REDACTED]';
    } else {
      sanitizedRecord[k] = sanitizePayload(v, depth + 1);
    }
  }
  return sanitizedRecord;
}

export class McpAuditLogger {
  private static readonly COLLECTION = 'mcp_audit_logs';

  /**
   * Logs a tool execution asynchronously to Firestore.
   */
  public static async logExecution(entry: {
    toolName: string;
    version: string;
    workspaceId: string;
    organizationId: string;
    callerId: string;
    callerType: 'user' | 'agent' | 'api_key';
    durationMs: number;
    status: 'success' | 'error' | 'pending_approval' | 'rejected';
    inputPayload: Record<string, McpPayloadValue>;
    outputSummary: string;
    errorMessage?: string;
  }): Promise<void> {
    try {
      const id = `mcplog_${crypto.randomUUID()}`;
      const timestamp = new Date().toISOString();

      const sanitizedInput = sanitizePayload(entry.inputPayload) as Record<string, McpPayloadValue>;

      const logRecord: McpAuditLog = {
        id,
        toolName: entry.toolName,
        version: entry.version,
        workspaceId: entry.workspaceId,
        organizationId: entry.organizationId,
        callerId: entry.callerId,
        callerType: entry.callerType,
        durationMs: entry.durationMs,
        status: entry.status,
        inputPayload: sanitizedInput,
        outputSummary: entry.outputSummary.substring(0, 500),
        errorMessage: entry.errorMessage ? entry.errorMessage.substring(0, 500) : undefined,
        timestamp,
      };

      await adminDb.collection(this.COLLECTION).doc(id).set(logRecord);
    } catch (err) {
      // Telemetry failures must never crash the parent application
      console.error('[McpAuditLogger] Failed to write audit log:', err);
    }
  }

  /**
   * Lists audit logs for a workspace with cursor/limit.
   */
  public static async listAuditLogs(
    workspaceId: string,
    limit: number = 50
  ): Promise<McpAuditLog[]> {
    try {
      const snapshot = await adminDb
        .collection(this.COLLECTION)
        .where('workspaceId', '==', workspaceId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => doc.data() as McpAuditLog);
    } catch {
      // In-memory fallback while composite index builds in cloud
      const snapshot = await adminDb
        .collection(this.COLLECTION)
        .where('workspaceId', '==', workspaceId)
        .limit(limit)
        .get();

      const items = snapshot.docs.map((doc) => doc.data() as McpAuditLog);
      return items.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
    }
  }
}

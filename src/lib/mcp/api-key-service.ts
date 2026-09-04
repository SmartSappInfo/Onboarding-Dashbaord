/**
 * @fileOverview CompanyBrain 2.0 Phase 6: MCP API Key Service
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Cryptographic Invariant:
 *    - Plaintext API keys (`sk_mcp_...`) are returned ONLY once upon creation.
 *    - Only the salted SHA-256 hash and the visual preview prefix are persisted in Firestore `/mcp_keys`.
 * 2. Multi-Tenant Scoping:
 *    - Keys are strictly bound to `workspaceId` and `organizationId`.
 * 3. Strict Zero-`any` & Zero-`unknown` Standard:
 *    - Fully typed with `McpApiKey`.
 *
 * @testability Covered in `src/lib/mcp/__tests__/mcp-gateway.test.ts`.
 */

import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import type { McpApiKey, McpCategory } from './types';

export interface CreateMcpApiKeyInput {
  workspaceId: string;
  organizationId: string;
  name: string;
  role: 'admin' | 'member' | 'agent';
  allowedCategories?: McpCategory[];
  rateLimitPerMinute?: number;
  expiresInDays?: number;
  createdBy: string;
}

export interface ValidateApiKeyResult {
  valid: boolean;
  key?: McpApiKey;
  error?: string;
}

export class McpApiKeyService {
  private static readonly COLLECTION = 'mcp_keys';

  /**
   * Hashes an MCP plaintext key with HMAC-SHA-256 and server-side pepper.
   */
  public static hashKey(plaintextKey: string): string {
    const pepper = process.env.MCP_KEY_PEPPER || 'smartsapp-mcp-v2-salt-pepper';
    return crypto.createHmac('sha256', pepper).update(plaintextKey.trim()).digest('hex');
  }

  /**
   * Generates a cryptographically random MCP API key and records its hash in Firestore.
   */
  public static async createApiKey(
    input: CreateMcpApiKeyInput
  ): Promise<{ apiKey: McpApiKey; plaintextKey: string }> {
    const rawEntropy = crypto.randomBytes(32).toString('hex');
    const plaintextKey = `sk_mcp_${rawEntropy}`;
    const keyHash = this.hashKey(plaintextKey);
    const keyPrefix = `sk_mcp_...${rawEntropy.slice(-4)}`;

    const id = `mcpkey_${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();

    let expiresAt: string | undefined;
    if (input.expiresInDays && input.expiresInDays > 0) {
      const exp = new Date();
      exp.setDate(exp.getDate() + input.expiresInDays);
      expiresAt = exp.toISOString();
    }

    const apiKey: McpApiKey = {
      id,
      keyPrefix,
      keyHash,
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
      name: input.name.trim(),
      role: input.role,
      allowedCategories: input.allowedCategories,
      rateLimitPerMinute: input.rateLimitPerMinute ?? 60,
      createdAt: timestamp,
      expiresAt,
      revoked: false,
    };

    await adminDb.collection(this.COLLECTION).doc(id).set(apiKey);

    return { apiKey, plaintextKey };
  }

  /**
   * Validates a provided plaintext API key against the stored hashes.
   */
  public static async validateApiKey(plaintextKey: string): Promise<ValidateApiKeyResult> {
    if (!plaintextKey || !plaintextKey.startsWith('sk_mcp_')) {
      return { valid: false, error: 'Malformed or missing MCP API key format.' };
    }

    const hash = this.hashKey(plaintextKey);

    const snapshot = await adminDb
      .collection(this.COLLECTION)
      .where('keyHash', '==', hash)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { valid: false, error: 'Invalid MCP API key.' };
    }

    const keyData = snapshot.docs[0].data() as McpApiKey;

    if (keyData.revoked) {
      return { valid: false, error: 'This MCP API key has been revoked.' };
    }

    if (keyData.expiresAt && new Date(keyData.expiresAt).getTime() < Date.now()) {
      return { valid: false, error: 'This MCP API key has expired.' };
    }

    return { valid: true, key: keyData };
  }

  /**
   * Revokes an existing API key immediately.
   */
  public static async revokeApiKey(keyId: string, revokedBy: string): Promise<void> {
    const ref = adminDb.collection(this.COLLECTION).doc(keyId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error(`MCP API key "${keyId}" does not exist.`);
    }

    await ref.update({
      revoked: true,
      revokedAt: new Date().toISOString(),
      revokedBy,
    });
  }

  /**
   * Lists all API keys for a specific workspace.
   */
  public static async listApiKeys(workspaceId: string): Promise<McpApiKey[]> {
    try {
      const snapshot = await adminDb
        .collection(this.COLLECTION)
        .where('workspaceId', '==', workspaceId)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map((doc) => doc.data() as McpApiKey);
    } catch {
      // In-memory fallback while composite index builds
      const snapshot = await adminDb
        .collection(this.COLLECTION)
        .where('workspaceId', '==', workspaceId)
        .get();

      const items = snapshot.docs.map((doc) => doc.data() as McpApiKey);
      return items.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    }
  }

  /**
   * Fetches a single key by ID.
   */
  public static async getApiKeyById(keyId: string): Promise<McpApiKey | null> {
    const snap = await adminDb.collection(this.COLLECTION).doc(keyId).get();
    if (!snap.exists) {
      return null;
    }
    return snap.data() as McpApiKey;
  }
}

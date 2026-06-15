/**
 * @fileOverview Server-only persistence for WhatsApp connections.
 *
 * Secrets are sealed by {@link buildConnectionRecord} (crypto-vault) before they
 * ever reach Firestore, and decrypted only here at the point of use. The
 * client-facing read path returns {@link WhatsAppConnectionPublic} exclusively
 * (spec R5) — `getCredentials`/`getAppSecret` are for server send/verify only
 * and must never be returned from a Server Action.
 */

import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { decrypt } from './crypto-vault';
import { buildConnectionRecord, toPublicConnection, type SaveConnectionInput } from './whatsapp-connection';
import type {
  WhatsAppConnection,
  WhatsAppConnectionPublic,
  WhatsAppConnectionStatus,
  WhatsAppQualityRating,
} from './whatsapp-types';
import type { MetaCredentials } from './meta-cloud-client';

const COLLECTION = 'whatsapp_connections';

/** Drop `undefined` values — Firestore rejects them. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export interface HealthPatch {
  status?: WhatsAppConnectionStatus;
  qualityRating?: WhatsAppQualityRating;
  messagingLimit?: string;
  lastError?: string | null;
}

export class WhatsAppCredentialRepository {
  /** Full record incl. encrypted secrets — SERVER ONLY. */
  static async get(organizationId: string): Promise<WhatsAppConnection | null> {
    const snap = await adminDb.collection(COLLECTION).doc(organizationId).get();
    return snap.exists ? (snap.data() as WhatsAppConnection) : null;
  }

  /** Client-safe projection — the only shape a Server Action may return. */
  static async getPublic(organizationId: string): Promise<WhatsAppConnectionPublic | null> {
    const conn = await this.get(organizationId);
    return conn ? toPublicConnection(conn) : null;
  }

  /** All connections as redacted projections — backoffice control plane only. */
  static async listAllPublic(): Promise<WhatsAppConnectionPublic[]> {
    const snap = await adminDb.collection(COLLECTION).get();
    return snap.docs.map((d) => toPublicConnection(d.data() as WhatsAppConnection));
  }

  /** Resolve the connection that owns an inbound webhook by its phone-number id. */
  static async getByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppConnection | null> {
    const snap = await adminDb
      .collection(COLLECTION)
      .where('phoneNumberId', '==', phoneNumberId)
      .limit(1)
      .get();
    return snap.empty ? null : (snap.docs[0].data() as WhatsAppConnection);
  }

  /** Find a connection by webhook verify token (GET handshake). */
  static async findByVerifyToken(token: string): Promise<WhatsAppConnection | null> {
    const snap = await adminDb
      .collection(COLLECTION)
      .where('webhookVerifyToken', '==', token)
      .limit(1)
      .get();
    return snap.empty ? null : (snap.docs[0].data() as WhatsAppConnection);
  }

  /** Create or update a connection. Returns the redacted projection. */
  static async save(input: SaveConnectionInput): Promise<WhatsAppConnectionPublic> {
    const existing = await this.get(input.organizationId);
    const record = buildConnectionRecord(input, {
      now: new Date().toISOString(),
      webhookVerifyToken: crypto.randomBytes(24).toString('hex'),
      existing,
    });
    await adminDb.collection(COLLECTION).doc(record.id).set(stripUndefined(record as unknown as Record<string, unknown>));
    return toPublicConnection(record);
  }

  /** Patch health fields after a connection test / webhook quality update. */
  static async updateHealth(organizationId: string, patch: HealthPatch): Promise<void> {
    await adminDb
      .collection(COLLECTION)
      .doc(organizationId)
      .set(
        stripUndefined({
          ...patch,
          lastHealthCheckAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Record<string, unknown>),
        { merge: true },
      );
  }

  /** Decrypt credentials for sending — SERVER ONLY, never return to a client. */
  static async getCredentials(organizationId: string): Promise<MetaCredentials | null> {
    const conn = await this.get(organizationId);
    if (!conn) return null;
    return {
      accessToken: decrypt(conn.accessToken),
      phoneNumberId: conn.phoneNumberId,
      wabaId: conn.wabaId,
    };
  }

  /** Decrypt the app secret for webhook signature validation — SERVER ONLY. */
  static async getAppSecret(organizationId: string): Promise<string | null> {
    const conn = await this.get(organizationId);
    if (!conn?.appSecret) return null;
    return decrypt(conn.appSecret);
  }

  /**
   * Replace only the access token, preserving all other config and the existing
   * (encrypted) app secret. Stamps `tokenRotatedAt`.
   */
  static async rotateToken(
    organizationId: string,
    newAccessToken: string,
  ): Promise<WhatsAppConnectionPublic> {
    const existing = await this.get(organizationId);
    if (!existing) throw new Error('No WhatsApp connection to rotate.');

    const now = new Date().toISOString();
    const record = buildConnectionRecord(
      {
        organizationId,
        connectionType: existing.connectionType,
        wabaId: existing.wabaId,
        phoneNumberId: existing.phoneNumberId,
        displayPhoneNumber: existing.displayPhoneNumber,
        businessName: existing.businessName,
        accessToken: newAccessToken,
        createdBy: existing.createdBy,
      },
      { now, webhookVerifyToken: existing.webhookVerifyToken, existing },
    );
    // Carry over the existing app-secret envelope (we don't hold its plaintext).
    if (existing.appSecret) record.appSecret = existing.appSecret;
    record.tokenRotatedAt = now;

    await adminDb
      .collection(COLLECTION)
      .doc(record.id)
      .set(stripUndefined(record as unknown as Record<string, unknown>));
    return toPublicConnection(record);
  }

  /** Remove the connection entirely (revokes stored credentials). */
  static async disconnect(organizationId: string): Promise<void> {
    await adminDb.collection(COLLECTION).doc(organizationId).delete();
  }
}

'use server';

/**
 * {{Org_name}} Experience Platform — Credentials & Learning Interoperability Server Actions
 *
 * Strongly typed Next.js Server Actions for Certificate Templates, Issuance,
 * Public Verification, Revocation, Open Badges 3.0 Export, and xAPI Statements.
 * Zero `any` or `any[]` typing.
 *
 * SECURITY (auth hotfix, agents_mcp Phase 1 §1.1a / audit F2): public endpoints.
 * - Templates, issuance, revocation, badge definitions, listings: staff (`requirePortalAdmin`);
 *   the organization is always the portal's and revoked certificates must belong to that portal.
 * - `verifyCertificateAction` / `exportOpenBadgeAction` are public by design (credential verification).
 */

import { revalidatePath } from 'next/cache';
import { CredentialService } from '@/lib/services/credential-service';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';
import { assertRecordInPortal, portalAuthErrorMessage, requirePortalAdmin } from '@/lib/auth/require-portal-access';
import type {
  CertificateTemplate,
  IssuedCertificate,
  BadgeDefinition,
  OpenBadgeCredential30,
  XApiStatement,
  CreateCertificateTemplateInput,
  IssueCertificateInput,
  BadgeCriteriaType,
} from '@/lib/types/credentials';

export type ActionResponse<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string };

function failure(err: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: portalAuthErrorMessage(err) ?? toClientErrorMessage('actions.credential-actions', err, undefined, fallback) };
}

// ── 1. Certificate Templates Actions ─────────────────────────────────────────

export async function createCertificateTemplateAction(
  input: CreateCertificateTemplateInput,
  portalSlug?: string
): Promise<ActionResponse<CertificateTemplate>> {
  try {
    const { portal } = await requirePortalAdmin(input.portalId);
    const template = await CredentialService.createCertificateTemplate({ ...input, organizationId: portal.organizationId });
    if (portalSlug) revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: template };
  } catch (err: unknown) {
    return failure(err, 'Failed to create certificate template.');
  }
}

export async function listCertificateTemplatesAction(
  portalId: string
): Promise<ActionResponse<CertificateTemplate[]>> {
  try {
    await requirePortalAdmin(portalId);
    const templates = await CredentialService.listCertificateTemplates(portalId);
    return { success: true, data: templates };
  } catch (err: unknown) {
    return failure(err, 'Failed to list certificate templates.');
  }
}

// ── 2. Certificate Issuance & Revocation Actions ─────────────────────────────

export async function issueCertificateAction(
  input: IssueCertificateInput,
  portalSlug?: string
): Promise<ActionResponse<IssuedCertificate>> {
  try {
    // Manual issuance is a staff action; learners receive certificates via course completion server-side.
    const { portal } = await requirePortalAdmin(input.portalId);
    const cert = await CredentialService.issueCertificateForCourse({ ...input, organizationId: portal.organizationId }, portalSlug);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/dashboard`);
    return { success: true, data: cert };
  } catch (err: unknown) {
    return failure(err, 'Failed to issue certificate.');
  }
}

export async function verifyCertificateAction(
  verificationCode: string
): Promise<ActionResponse<{ isValid: boolean; certificate?: IssuedCertificate; message: string }>> {
  try {
    const res = await CredentialService.verifyCertificate(verificationCode);
    return { success: true, data: res };
  } catch (err: unknown) {
    return failure(err, 'Verification check failed.');
  }
}

export async function revokeCertificateAction(
  certificateId: string,
  reason: string,
  portalId: string
): Promise<ActionResponse<{ revoked: true }>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('issued_certificates', certificateId, portalId);
    await CredentialService.revokeCertificate(certificateId, reason);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: { revoked: true } };
  } catch (err: unknown) {
    return failure(err, 'Failed to revoke certificate.');
  }
}

export async function listIssuedCertificatesAction(
  portalId: string
): Promise<ActionResponse<IssuedCertificate[]>> {
  try {
    await requirePortalAdmin(portalId);
    const certs = await CredentialService.listIssuedCertificates(portalId);
    return { success: true, data: certs };
  } catch (err: unknown) {
    return failure(err, 'Failed to list issued certificates.');
  }
}

// ── 3. Open Badges & xAPI Actions ────────────────────────────────────────────

export async function exportOpenBadgeAction(
  certificateId: string
): Promise<ActionResponse<OpenBadgeCredential30>> {
  try {
    const openBadge = await CredentialService.exportOpenBadge30(certificateId);
    return { success: true, data: openBadge };
  } catch (err: unknown) {
    return failure(err, 'Failed to export Open Badge.');
  }
}

export async function listXApiStatementsAction(
  portalId: string
): Promise<ActionResponse<XApiStatement[]>> {
  try {
    await requirePortalAdmin(portalId);
    const statements = await CredentialService.listXApiStatements(portalId, 25);
    return { success: true, data: statements };
  } catch (err: unknown) {
    return failure(err, 'Failed to list xAPI statements.');
  }
}

// ── 4. Badge Definitions Actions ────────────────────────────────────────────

export async function createBadgeDefinitionAction(
  input: {
    organizationId: string;
    portalId: string;
    title: string;
    description: string;
    icon: string;
    criteriaType: BadgeCriteriaType;
    criteriaThreshold: number;
    pointsReward: number;
  },
  portalSlug?: string
): Promise<ActionResponse<BadgeDefinition>> {
  try {
    const { portal } = await requirePortalAdmin(input.portalId);
    const badge = await CredentialService.createBadgeDefinition({ ...input, organizationId: portal.organizationId });
    if (portalSlug) revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: badge };
  } catch (err: unknown) {
    return failure(err, 'Failed to create badge definition.');
  }
}

export async function listBadgeDefinitionsAction(
  portalId: string
): Promise<ActionResponse<BadgeDefinition[]>> {
  try {
    await requirePortalAdmin(portalId);
    const badges = await CredentialService.listBadgeDefinitions(portalId);
    return { success: true, data: badges };
  } catch (err: unknown) {
    return failure(err, 'Failed to list badge definitions.');
  }
}

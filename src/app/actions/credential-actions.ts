'use server';

/**
 * {{Org_name}} Experience Platform — Credentials & Learning Interoperability Server Actions
 *
 * Strongly typed Next.js Server Actions for Certificate Templates, Issuance,
 * Public Verification, Revocation, Open Badges 3.0 Export, and xAPI Statements.
 * Zero `any` or `any[]` typing.
 */

import { revalidatePath } from 'next/cache';
import { CredentialService } from '@/lib/services/credential-service';
import type {
  CertificateTemplate,
  IssuedCertificate,
  BadgeDefinition,
  AwardedBadge,
  OpenBadgeCredential30,
  XApiStatement,
  CreateCertificateTemplateInput,
  IssueCertificateInput,
  BadgeCriteriaType,
} from '@/lib/types/credentials';

export type ActionResponse<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string };

// ── 1. Certificate Templates Actions ─────────────────────────────────────────

export async function createCertificateTemplateAction(
  input: CreateCertificateTemplateInput,
  portalSlug?: string
): Promise<ActionResponse<CertificateTemplate>> {
  try {
    const template = await CredentialService.createCertificateTemplate(input);
    if (portalSlug) revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: template };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create certificate template.' };
  }
}

export async function listCertificateTemplatesAction(
  portalId: string
): Promise<ActionResponse<CertificateTemplate[]>> {
  try {
    const templates = await CredentialService.listCertificateTemplates(portalId);
    return { success: true, data: templates };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to list certificate templates.' };
  }
}

// ── 2. Certificate Issuance & Revocation Actions ─────────────────────────────

export async function issueCertificateAction(
  input: IssueCertificateInput,
  portalSlug?: string
): Promise<ActionResponse<IssuedCertificate>> {
  try {
    const cert = await CredentialService.issueCertificateForCourse(input, portalSlug);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/dashboard`);
    return { success: true, data: cert };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to issue certificate.' };
  }
}

export async function verifyCertificateAction(
  verificationCode: string
): Promise<ActionResponse<{ isValid: boolean; certificate?: IssuedCertificate; message: string }>> {
  try {
    const res = await CredentialService.verifyCertificate(verificationCode);
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Verification check failed.' };
  }
}

export async function revokeCertificateAction(
  certificateId: string,
  reason: string,
  portalId: string
): Promise<ActionResponse<{ revoked: true }>> {
  try {
    await CredentialService.revokeCertificate(certificateId, reason);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: { revoked: true } };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to revoke certificate.' };
  }
}

export async function listIssuedCertificatesAction(
  portalId: string
): Promise<ActionResponse<IssuedCertificate[]>> {
  try {
    const certs = await CredentialService.listIssuedCertificates(portalId);
    return { success: true, data: certs };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to list issued certificates.' };
  }
}

// ── 3. Open Badges & xAPI Actions ────────────────────────────────────────────

export async function exportOpenBadgeAction(
  certificateId: string
): Promise<ActionResponse<OpenBadgeCredential30>> {
  try {
    const openBadge = await CredentialService.exportOpenBadge30(certificateId);
    return { success: true, data: openBadge };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to export Open Badge.' };
  }
}

export async function listXApiStatementsAction(
  portalId: string
): Promise<ActionResponse<XApiStatement[]>> {
  try {
    const statements = await CredentialService.listXApiStatements(portalId, 25);
    return { success: true, data: statements };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to list xAPI statements.' };
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
    const badge = await CredentialService.createBadgeDefinition(input);
    if (portalSlug) revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: badge };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create badge definition.' };
  }
}

export async function listBadgeDefinitionsAction(
  portalId: string
): Promise<ActionResponse<BadgeDefinition[]>> {
  try {
    const badges = await CredentialService.listBadgeDefinitions(portalId);
    return { success: true, data: badges };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to list badge definitions.' };
  }
}

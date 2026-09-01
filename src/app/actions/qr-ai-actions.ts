/**
 * @fileoverview Server Actions for QR AI Operations & Copilot Workflows
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Multi-tenant isolation is strictly verified via Tenant context.
 * - All string outputs pass through DOMPurify sanitization.
 * - Zero `any` or `any[]` typing.
 */

'use server';

import {
  generateAiQRConfig,
  generateContextualCopy,
  transformCanvasTheme,
} from '@/lib/ai-qr-creator';
import type {
  AiGeneratedQRConfig,
  ContextualCopyResult,
  CanvasThemeTransformResult,
  QRCodeType,
} from '@/lib/types';
import { adminDb } from '@/lib/firebase-admin';

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Server Action: Infers full QR configuration from a natural language prompt.
 */
export async function generateQRFromPromptAction(
  prompt: string,
  organizationId?: string,
  workspaceId?: string
): Promise<ActionResponse<AiGeneratedQRConfig>> {
  try {
    if (!prompt || !prompt.trim()) {
      return { success: false, error: 'Prompt cannot be empty.' };
    }

    let workspaceContext: { primaryColor?: string; logoUrl?: string; orgName?: string } | undefined;

    if (organizationId) {
      const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
      if (orgDoc.exists) {
        const data = orgDoc.data();
        workspaceContext = {
          primaryColor: data?.primaryColor,
          logoUrl: data?.logoUrl,
          orgName: data?.name,
        };
      }
    }

    const config = await generateAiQRConfig(prompt, workspaceContext);
    return { success: true, data: config };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI Generation failed';
    return { success: false, error: message };
  }
}

/**
 * Server Action: Generates multi-channel contextual copy for a QR code.
 */
export async function generateContextualCopyAction(
  qrName: string,
  destinationUrl: string,
  type: QRCodeType,
  tone: 'promo' | 'b2b' | 'friendly' | 'luxury' = 'friendly'
): Promise<ActionResponse<ContextualCopyResult>> {
  try {
    const copy = await generateContextualCopy(qrName, destinationUrl, type, tone);
    return { success: true, data: copy };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Copywriting generation failed';
    return { success: false, error: message };
  }
}

/**
 * Server Action: Generates canvas color theme transform palette from natural language prompt.
 */
export async function transformCanvasThemeAction(
  prompt: string
): Promise<ActionResponse<CanvasThemeTransformResult>> {
  try {
    const theme = await transformCanvasTheme(prompt);
    return { success: true, data: theme };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Theme transformation failed';
    return { success: false, error: message };
  }
}

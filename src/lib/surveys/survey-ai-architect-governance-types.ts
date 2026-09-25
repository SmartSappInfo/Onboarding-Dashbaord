/**
 * @fileoverview SmartSapp Survey Intelligence 2.0 — AI Survey Architect Governance Types & Schemas
 *
 * ARCHITECTURAL GUIDELINES:
 * - Pure TypeScript module safe for both Client and Server.
 * - Separated from Server Actions file ('use server') to prevent Next.js "can only export async functions, found object" errors.
 * - Strict Zero-Any Invariant: Completely typed schema interfaces.
 */

import { z } from 'zod';

export interface SystemAiArchitectGovernanceConfig {
  maxFileUploadSizeMb: number;
  maxImageUploadSizeMb: number;
  maxPdfPagesLimit: number;
  maxSpreadsheetRows: number;
  maxPresentationSlides: number;
  maxSourceCharacterLimit: number;
  defaultModelTier: 'fast' | 'flagship';
  imageVisionMode: 'multimodal' | 'ocr_fallback';
  enablePromptPolishCopilot: boolean;
  enabledArchetypeIds: string[];
  allowedFileTypes: string[];
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_AI_ARCHITECT_GOVERNANCE_CONFIG: SystemAiArchitectGovernanceConfig = {
  maxFileUploadSizeMb: 10,
  maxImageUploadSizeMb: 5,
  maxPdfPagesLimit: 20,
  maxSpreadsheetRows: 500,
  maxPresentationSlides: 30,
  maxSourceCharacterLimit: 25000,
  defaultModelTier: 'fast',
  imageVisionMode: 'multimodal',
  enablePromptPolishCopilot: true,
  enabledArchetypeIds: ['csat_nps', 'pulse_360', 'scored_quiz', 'pmf_survey', 'event_feedback', 'lead_intake'],
  allowedFileTypes: ['pdf', 'docx', 'doc', 'image', 'xlsx', 'xls', 'pptx', 'ppt', 'text', 'markdown', 'csv', 'json'],
};

/**
 * Zod validation schema for updating global architect governance parameters.
 * Prevents out-of-bounds numbers that would cause browser OOMs or LLM token burn.
 */
export const SystemAiArchitectGovernanceUpdateSchema = z.object({
  maxFileUploadSizeMb: z.number().int().min(1).max(50).optional(),
  maxImageUploadSizeMb: z.number().int().min(1).max(20).optional(),
  maxPdfPagesLimit: z.number().int().min(1).max(100).optional(),
  maxSpreadsheetRows: z.number().int().min(50).max(5000).optional(),
  maxPresentationSlides: z.number().int().min(5).max(100).optional(),
  maxSourceCharacterLimit: z.number().int().min(1000).max(100000).optional(),
  defaultModelTier: z.enum(['fast', 'flagship']).optional(),
  imageVisionMode: z.enum(['multimodal', 'ocr_fallback']).optional(),
  enablePromptPolishCopilot: z.boolean().optional(),
  enabledArchetypeIds: z.array(z.string().regex(/^[a-z0-9_-]+$/)).max(20).optional(),
  allowedFileTypes: z.array(z.string()).max(20).optional(),
});

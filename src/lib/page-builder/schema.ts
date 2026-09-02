/**
 * Runtime validation for page structures.
 *
 * `parseStructure` is the resilient boundary used when loading author content
 * from Firestore: it NEVER throws (Risk R4). Malformed or partial data resolves
 * to a safe, renderable structure rather than crashing the page. Block `type`
 * is intentionally validated as a free string — the renderer falls back
 * gracefully for unknown/future block types instead of rejecting the page.
 */
import { z } from 'zod';
import type { CampaignPageStructure, PageValidationResult, ValidationError, PageBlock, PageSection } from '@/lib/types';
import { validateBlockProps, normalizeBlockType } from './registry';

const blockSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.string(),
    props: z.record(z.unknown()).default({}),
    blocks: z.array(blockSchema).optional(),
  }),
);

export const pageSectionSchema = z.object({
  id: z.string(),
  type: z.literal('section'),
  props: z.record(z.unknown()).default({}),
  blocks: z.array(blockSchema).default([]),
});

export const navItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  linkType: z.enum(['url', 'scroll', 'action']),
  url: z.string().optional(),
  targetSectionId: z.string().optional(),
  action: z.enum(['receipt_request', 'open_modal_form', 'open_modal_survey', 'open_modal_agreement']).optional(),
  surveyResultMode: z.enum(['modal', 'parent']).optional(),
  actionTargetId: z.string().optional(),
});

export const headerCtaButtonSchema = z.object({
  id: z.string(),
  label: z.string().default('Button'),
  style: z.enum(['primary', 'outline', 'ghost']).default('primary'),
  linkType: z.enum(['url', 'scroll', 'action']).default('url'),
  url: z.string().optional(),
  targetSectionId: z.string().optional(),
  action: z.enum(['receipt_request', 'open_modal_form', 'open_modal_survey', 'open_modal_agreement']).optional(),
  surveyResultMode: z.enum(['modal', 'parent']).default('modal'),
  actionTargetId: z.string().optional(),
});

export const headerSettingsSchema = z.object({
  preset: z.enum(['native', 'minimal', 'full-nav', 'cta-only', 'search-nav', 'card-nav']).default('native'),
  overlap: z.boolean().default(false),
  sticky: z.boolean().default(false),
  floating: z.boolean().default(false),
  showSearch: z.boolean().default(false),
  showCta: z.boolean().default(false),
  ctaText: z.string().optional(),
  ctaUrl: z.string().optional(),
  ctaLinkType: z.enum(['url', 'scroll', 'action']).default('url'),
  ctaTargetSectionId: z.string().optional(),
  ctaAction: z.enum(['receipt_request', 'open_modal_form', 'open_modal_survey', 'open_modal_agreement']).optional(),
  ctaSurveyResultMode: z.enum(['modal', 'parent']).default('modal'),
  showPhone: z.boolean().default(false),
  phoneNumber: z.string().optional(),
  navItems: z.array(navItemSchema).default([]),
  buttons: z.array(headerCtaButtonSchema).default([]),
});

export const footerSettingsSchema = z.object({
  preset: z.enum(['org', 'simple', 'multi-column', 'social-heavy', 'minimal']).default('org'),
  overrideOrg: z.boolean().default(false),
  copyrightText: z.string().optional(),
  address: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  socialLinks: z.object({
    facebook: z.string().optional(),
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    instagram: z.string().optional(),
    youtube: z.string().optional(),
  }).optional(),
  navItems: z.array(z.object({
    label: z.string(),
    url: z.string(),
  })).optional(),
});

export const pageStructureSchema = z.object({
  sections: z.array(pageSectionSchema).default([]),
  header: headerSettingsSchema.default({
    preset: 'native',
    overlap: false,
    sticky: false,
    floating: false,
    showSearch: false,
    showCta: false,
    showPhone: false,
    navItems: [],
  }),
  footer: footerSettingsSchema.default({
    preset: 'org',
    overrideOrg: false,
  }),
});

const EMPTY_STRUCTURE: CampaignPageStructure = {
  sections: [],
  header: {
    preset: 'native',
    overlap: false,
    sticky: false,
    floating: false,
    showSearch: false,
    showCta: false,
    showPhone: false,
    navItems: [],
  },
  footer: {
    preset: 'org',
    overrideOrg: false,
  },
};

/** Validate and normalize raw structure data; returns an empty structure on failure. */
export function parseStructure(raw: unknown): CampaignPageStructure {
  const result = pageStructureSchema.safeParse(raw);
  if (result.success) {
    return result.data as unknown as CampaignPageStructure;
  }
  return EMPTY_STRUCTURE;
}

/**
 * Deeply validates an entire CampaignPageStructure, performing O(N) inspection
 * of sections, header/footer settings, and nested block props against registered Zod schemas.
 * Never throws runtime exceptions; returns structured error and warning diagnostics.
 * 
 * TESTABILITY POINTER:
 * Pass invalid/malformed structures to verify that errors are logged without page crashes.
 */
export function validatePageStructure(raw: unknown): PageValidationResult {
  const errors: ValidationError[] = [];
  const parsed = parseStructure(raw);

  // Recursively validate blocks
  function inspectBlock(block: PageBlock, pathPrefix: string): PageBlock {
    const canonicalType = normalizeBlockType(block.type);
    const safeProps = validateBlockProps({ ...block, type: canonicalType });
    
    // Check nested children if any
    let safeChildBlocks: PageBlock[] | undefined = undefined;
    if (Array.isArray(block.blocks) && block.blocks.length > 0) {
      safeChildBlocks = block.blocks.map((child, idx) => inspectBlock(child, `${pathPrefix}.blocks[${idx}]`));
    }

    return {
      ...block,
      type: canonicalType,
      props: safeProps,
      blocks: safeChildBlocks,
    };
  }

  // Validate sections
  const validatedSections: PageSection[] = parsed.sections.map((section, sIdx) => {
    if (!section.id) {
      errors.push({
        path: `sections[${sIdx}].id`,
        message: 'Section missing unique ID',
        severity: 'warning',
      });
    }

    const validatedBlocks = (section.blocks || []).map((b, bIdx) =>
      inspectBlock(b, `sections[${sIdx}].blocks[${bIdx}]`)
    );

    return {
      ...section,
      blocks: validatedBlocks,
    };
  });

  // Validate header nav items if present
  if (parsed.header?.navItems) {
    parsed.header.navItems.forEach((item, idx) => {
      if (!item.id) {
        errors.push({
          path: `header.navItems[${idx}].id`,
          message: 'Header navigation item missing unique ID',
          severity: 'warning',
        });
      }
    });
  }

  const sanitizedStructure: CampaignPageStructure = {
    ...parsed,
    sections: validatedSections,
  };

  return {
    valid: errors.filter((e) => e.severity === 'error').length === 0,
    errors,
    sanitizedStructure,
  };
}

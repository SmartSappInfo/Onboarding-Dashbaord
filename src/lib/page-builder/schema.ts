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
import type { CampaignPageStructure } from '@/lib/types';

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
});

export const headerSettingsSchema = z.object({
  preset: z.enum(['native', 'minimal', 'full-nav', 'cta-only', 'search-nav']).default('native'),
  overlap: z.boolean().default(false),
  sticky: z.boolean().default(false),
  floating: z.boolean().default(false),
  showSearch: z.boolean().default(false),
  showCta: z.boolean().default(false),
  ctaText: z.string().optional(),
  ctaUrl: z.string().optional(),
  showPhone: z.boolean().default(false),
  phoneNumber: z.string().optional(),
  navItems: z.array(navItemSchema).default([]),
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

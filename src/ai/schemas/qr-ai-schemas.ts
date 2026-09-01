/**
 * @fileoverview Strict Zod Schemas for QR AI Flows & Copilot Operations
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Output must strictly conform to canonical QR types.
 * - Zero `any` or `any[]` typing.
 */

import { z } from 'zod';

export const AiGeneratedQRConfigSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.enum([
    'url', 'survey', 'form', 'landing_page', 'portal', 'public_portal',
    'doc_signing', 'document', 'meeting', 'payment', 'invoice', 'vcard',
    'wifi', 'email', 'sms', 'whatsapp', 'text', 'file', 'attendance',
    'event', 'campaign', 'custom'
  ]).default('url'),
  destinationUrl: z.string().url().default('https://smartsapp.com'),
  ctaText: z.string().max(30).default('SCAN ME'),
  headline: z.string().max(80).default('Point Camera & Scan'),
  subheadline: z.string().max(120).optional(),
  frameStyle: z.enum([
    'none', 'bottom-banner', 'top-banner', 'rounded-box', 'polaroid',
    'phone-mockup', 'scan-me-badge', 'ticket-stub', 'minimalist-pill',
    'bubble-callout'
  ]).default('bottom-banner'),
  frameIcon: z.enum([
    'camera', 'arrow-down', 'sparkles', 'lock', 'link', 'phone', 'star',
    'shopping-bag', 'none'
  ]).default('camera'),
  foregroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#0F172A'),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#FFFFFF'),
  cornerSquareColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  cornerDotColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  dotStyle: z.enum(['square', 'rounded', 'dots', 'classy', 'classy-rounded', 'extra-rounded']).default('rounded'),
  cornerSquareStyle: z.enum(['square', 'dot', 'extra-rounded']).default('extra-rounded'),
  cornerDotStyle: z.enum(['square', 'dot']).default('dot'),
  errorCorrection: z.enum(['L', 'M', 'Q', 'H']).default('Q'),
  campaignTags: z.array(z.string()).default([]),
  tracking: z.object({
    utmSource: z.string().optional(),
    utmMedium: z.string().optional(),
    utmCampaign: z.string().optional(),
  }).default({}),
  reasoning: z.string().default('Generated tailored design matching prompt context and high WCAG contrast.'),
});

export const ContextualCopyResultSchema = z.object({
  headline: z.string(),
  subheadline: z.string(),
  ctaSuggestions: z.array(z.string()),
  instructions: z.string(),
  emailSnippet: z.object({
    subject: z.string(),
    body: z.string(),
  }),
  smsText: z.string(),
  whatsAppBroadcast: z.string(),
});

export const CanvasThemeTransformSchema = z.object({
  backgroundColor: z.string(),
  primaryTextColor: z.string(),
  secondaryTextColor: z.string(),
  accentColor: z.string(),
  fontFamily: z.string(),
  themeName: z.string(),
});

// @vitest-environment node
/**
 * @fileOverview Consolidated Block Schemas & Defaults Test Suite
 * Validates Zod schema parsing, field registrations, preset bundles, and backward-compatibility
 * for Divider, Image, List, ProcedureList, and Video blocks.
 *
 * Runs under Node.js environment (zero JSDOM DOM startup overhead).
 */

import { describe, it, expect } from 'vitest';
import { getBlock } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks/divider';
import '@/lib/page-builder/blocks/image';
import '@/lib/page-builder/blocks/list';
import '@/lib/page-builder/blocks/video';
import type { ListProps, ListItem } from '@/lib/page-builder/blocks/list';
import {
  procedureStepItemSchema,
  procedureBlockSchema,
  type ProcedureStepItem,
  type ProcedureBlockProps,
} from '@/lib/page-builder/blocks/procedure-list';

/* ==============================================================================
 * 1. Divider Block Schema
 * ============================================================================== */
describe('Divider Block Schema & Extended Attributes', () => {
  const dividerDef = getBlock('divider')!;

  it('registers the divider block with fields for style, width, thickness, spacing, alignment, and color', () => {
    expect(dividerDef).toBeDefined();
    expect(dividerDef.type).toBe('divider');
    const fieldKeys = dividerDef.fields.map((f) => f.key);
    expect(fieldKeys).toContain('style');
    expect(fieldKeys).toContain('width');
    expect(fieldKeys).toContain('thickness');
    expect(fieldKeys).toContain('spacing');
    expect(fieldKeys).toContain('alignment');
    expect(fieldKeys).toContain('color');
  });

  it('safely parses legacy divider block props without breaking defaults', () => {
    const legacyProps = {
      style: 'solid',
      color: '#e2e8f0',
    };

    const parsed = dividerDef.schema.safeParse(legacyProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.style).toBe('solid');
      expect(parsed.data.color).toBe('#e2e8f0');
      expect(parsed.data.width).toBe('full');
      expect(parsed.data.thickness).toBe('hairline');
      expect(parsed.data.spacing).toBe('medium');
      expect(parsed.data.alignment).toBe('center');
      expect(parsed.data.label).toBe('');
    }
  });

  it('parses extended divider styles and custom options accurately', () => {
    const extendedProps = {
      style: 'glow',
      width: 'wide',
      thickness: 'thick',
      spacing: 'relaxed',
      alignment: 'left',
      color: '#3B82F6',
      label: 'SECTION BREAK',
    };

    const parsed = dividerDef.schema.safeParse(extendedProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.style).toBe('glow');
      expect(parsed.data.width).toBe('wide');
      expect(parsed.data.thickness).toBe('thick');
      expect(parsed.data.spacing).toBe('relaxed');
      expect(parsed.data.alignment).toBe('left');
      expect(parsed.data.color).toBe('#3B82F6');
      expect(parsed.data.label).toBe('SECTION BREAK');
    }
  });
});

/* ==============================================================================
 * 2. Image Block Schema
 * ============================================================================== */
describe('Image Block Schema & Backward Compatibility', () => {
  const imageDef = getBlock('image')!;

  it('registers the image block with extended preset and framing fields', () => {
    expect(imageDef).toBeDefined();
    expect(imageDef.type).toBe('image');
    const fieldKeys = imageDef.fields.map((f) => f.key);
    expect(fieldKeys).toContain('preset');
    expect(fieldKeys).toContain('aspectRatio');
    expect(fieldKeys).toContain('elevation');
    expect(fieldKeys).toContain('hoverEffect');
    expect(fieldKeys).toContain('objectFit');
  });

  it('safely parses legacy image block props without new preset fields', () => {
    const legacyProps = {
      src: 'https://images.unsplash.com/photo-1',
      alt: 'Test Alt',
      borderRadius: 'circle',
      width: 'medium',
      alignment: 'center',
    };

    const parsed = imageDef.schema.safeParse(legacyProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.borderRadius).toBe('circle');
      expect(parsed.data.preset).toBe('circular-avatar');
      expect(parsed.data.aspectRatio).toBe('1:1');
    }
  });

  it('applies preset defaults accurately when preset is selected', () => {
    const browserMockupProps = {
      src: 'https://images.unsplash.com/photo-2',
      preset: 'browser-mockup',
    };

    const parsed = imageDef.schema.safeParse(browserMockupProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.elevation).toBe('browser');
      expect(parsed.data.borderRadius).toBe('rounded');
      expect(parsed.data.aspectRatio).toBe('16:9');
    }
  });
});

/* ==============================================================================
 * 3. List Block Schema & Intro Paragraph
 * ============================================================================== */
describe('List Block Registration & Schema', () => {
  const listDef = getBlock('list')!;

  it('registers the list block with canonical type and metadata', () => {
    expect(listDef).toBeDefined();
    expect(listDef.type).toBe('list');
    expect(listDef.category).toBe('content');
    expect(listDef.label).toMatch(/List/i);
  });

  it('exposes all key configuration fields including preset, items, columns, and spacing', () => {
    const fieldKeys = listDef.fields.map((f) => f.key);
    expect(fieldKeys).toContain('preset');
    expect(fieldKeys).toContain('items');
    expect(fieldKeys).toContain('columns');
    expect(fieldKeys).toContain('spacing');
    expect(fieldKeys).toContain('bulletColor');
    expect(fieldKeys).toContain('textColor');
    expect(fieldKeys).toContain('showDescriptions');
  });

  it('provides all 6 archetypal preset style options in the preset field', () => {
    const presetField = listDef.fields.find((f) => f.key === 'preset');
    expect(presetField).toBeDefined();
    expect(presetField?.kind).toBe('select');

    if (presetField?.kind === 'select') {
      const presetValues = presetField.options.map((o) => o.value);
      expect(presetValues).toContain('checklist');
      expect(presetValues).toContain('bullet');
      expect(presetValues).toContain('numbered');
      expect(presetValues).toContain('cards');
      expect(presetValues).toContain('minimal-dash');
      expect(presetValues).toContain('icon-pill');
    }
  });

  it('safely parses empty or default props and populates default items', () => {
    const parsed = listDef.schema.safeParse({});
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.preset).toBe('checklist');
      expect(parsed.data.columns).toBe('1');
      expect(parsed.data.spacing).toBe('normal');
      expect(parsed.data.showDescriptions).toBe(true);
      expect(Array.isArray(parsed.data.items)).toBe(true);
      const items = parsed.data.items as ListItem[];
      expect(items.length).toBeGreaterThan(0);
    }
  });

  it('parses custom items and validated attributes', () => {
    const customProps = {
      preset: 'numbered',
      columns: '2',
      spacing: 'compact',
      bulletColor: '#10b981',
      textColor: '#1f2937',
      showDescriptions: false,
      items: [
        { id: '1', title: 'Step 1: Download syllabus', description: 'Download PDF from portal' },
        { id: '2', title: 'Step 2: Sign declaration', description: '' },
      ],
    };

    const parsed = listDef.schema.safeParse(customProps);
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.preset).toBe('numbered');
      expect(parsed.data.columns).toBe('2');
      expect(parsed.data.spacing).toBe('compact');
      expect(parsed.data.bulletColor).toBe('#10b981');
      expect(parsed.data.showDescriptions).toBe(false);
      const items = parsed.data.items as ListItem[];
      expect(items).toHaveLength(2);
      expect(items[0].title).toBe('Step 1: Download syllabus');
    }
  });

  it('registers list block schema with default intro text disabled (List Only mode)', () => {
    const parsed = listDef.schema.safeParse({});
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      const data = parsed.data as ListProps;
      expect(data.showIntroText).toBe(false);
      expect(data.introTitle).toBe('');
      expect(data.introText).toBe('');
      expect(data.introAlignment).toBe('left');
      expect(data.preset).toBe('checklist');
    }
  });

  it('normalizes legacy title property to introTitle and activates showIntroText', () => {
    const legacyProps = {
      title: 'Tuition Payment Guide & Steps',
      preset: 'numbered',
    };

    const parsed = listDef.schema.safeParse(legacyProps);
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      const data = parsed.data as ListProps;
      expect(data.introTitle).toBe('Tuition Payment Guide & Steps');
      expect(data.showIntroText).toBe(true);
      expect(data.preset).toBe('numbered');
    }
  });

  it('supports explicit introTitle, multiline introText, and introAlignment', () => {
    const customProps = {
      showIntroText: true,
      introTitle: 'Program Prerequisites',
      introText: 'Please review all administrative requirements before commencing your formal course modules.',
      introAlignment: 'center',
      preset: 'stepped-gradient',
      items: [
        { id: '1', title: 'Submit Identification', description: 'National ID or Passport scan.' },
      ],
    };

    const parsed = listDef.schema.safeParse(customProps);
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      const data = parsed.data as ListProps;
      expect(data.showIntroText).toBe(true);
      expect(data.introTitle).toBe('Program Prerequisites');
      expect(data.introText).toBe('Please review all administrative requirements before commencing your formal course modules.');
      expect(data.introAlignment).toBe('center');
      expect(data.preset).toBe('stepped-gradient');
    }
  });

  it('accepts both new presets stepped-gradient and bordered-rows alongside original presets', () => {
    const steppedParsed = listDef.schema.safeParse({ preset: 'stepped-gradient' });
    expect(steppedParsed.success).toBe(true);

    const borderedParsed = listDef.schema.safeParse({ preset: 'bordered-rows' });
    expect(borderedParsed.success).toBe(true);

    const checklistParsed = listDef.schema.safeParse({ preset: 'checklist' });
    expect(checklistParsed.success).toBe(true);
  });
});

/* ==============================================================================
 * 4. Procedure List Schema
 * ============================================================================== */
describe('Procedure Block Schema & Backward Compatibility', () => {
  it('parses legacy flat string steps into normalized rich step items', () => {
    const rawLegacyData = {
      title: 'Payment Steps',
      steps: [
        'Transfer the exact amount to the account above.',
        'Use your student ID as the reference.',
        'Keep your receipt for confirmation.',
      ],
    };

    const parsed: ProcedureBlockProps = procedureBlockSchema.parse(rawLegacyData);

    expect(parsed.title).toBe('Payment Steps');
    expect(parsed.steps).toHaveLength(3);
    expect(parsed.steps[0].title).toBe('Transfer the exact amount to the account above.');
    expect(parsed.steps[0].description).toBe('');
    expect(parsed.steps[0].id).toBeDefined();
    expect(parsed.steps[1].title).toBe('Use your student ID as the reference.');
    expect(parsed.steps[2].title).toBe('Keep your receipt for confirmation.');
    expect(parsed.preset).toBe('connected-timeline');
    expect(parsed.mediaPosition).toBe('top');
  });

  it('parses rich step objects with title, description, timeEstimate, and badgeText', () => {
    const rawRichData = {
      title: 'USSD MoMo Payment',
      subtitle: 'Complete your tuition fees in under 2 minutes',
      preset: 'elevated-cards' as const,
      accentColor: '#3b82f6',
      mediaPosition: 'left' as const,
      steps: [
        {
          id: 'step-1',
          title: 'Dial Shortcode *170#',
          description: 'Open your phone dialer and enter the merchant code.',
          timeEstimate: '30s',
          badgeText: 'Required',
        },
        {
          id: 'step-2',
          title: 'Select Paybill & Enter Merchant ID',
          description: 'Enter merchant ID 948201.',
          timeEstimate: '45s',
          badgeText: 'Stage 2',
        },
      ],
    };

    const parsed: ProcedureBlockProps = procedureBlockSchema.parse(rawRichData);

    expect(parsed.title).toBe('USSD MoMo Payment');
    expect(parsed.steps).toHaveLength(2);
    expect(parsed.steps[0].timeEstimate).toBe('30s');
    expect(parsed.steps[0].badgeText).toBe('Required');
    expect(parsed.steps[1].timeEstimate).toBe('45s');
    expect(parsed.preset).toBe('elevated-cards');
    expect(parsed.mediaPosition).toBe('left');
  });

  it('safely normalizes mixed legacy strings and rich objects in the same array', () => {
    const mixedData = {
      title: 'Mixed Onboarding Steps',
      steps: [
        'Complete user profile',
        {
          id: 'step-rich',
          title: 'Upload Verification Document',
          description: 'Submit government ID or student card.',
          badgeText: 'Action Required',
        } as ProcedureStepItem,
      ],
    };

    const parsed: ProcedureBlockProps = procedureBlockSchema.parse(mixedData);

    expect(parsed.steps).toHaveLength(2);
    expect(parsed.steps[0].title).toBe('Complete user profile');
    expect(parsed.steps[0].id).toBeDefined();
    expect(parsed.steps[1].title).toBe('Upload Verification Document');
    expect(parsed.steps[1].description).toBe('Submit government ID or student card.');
    expect(parsed.steps[1].badgeText).toBe('Action Required');
  });

  it('migrates steps with missing id safely with generated UUID', () => {
    const stepMissingId = {
      title: 'Verify Details',
      description: 'Check receipt',
    };

    const validatedStep = procedureStepItemSchema.parse(stepMissingId);
    expect(validatedStep.id).toBeDefined();
    expect(typeof validatedStep.id).toBe('string');
    expect(validatedStep.id.length).toBeGreaterThan(0);
    expect(validatedStep.title).toBe('Verify Details');
  });

  it('provides sensible defaults when empty object is passed', () => {
    const parsed: ProcedureBlockProps = procedureBlockSchema.parse({});

    expect(parsed.title).toBe('Procedure Guide');
    expect(parsed.subtitle).toBe('');
    expect(parsed.preset).toBe('connected-timeline');
    expect(parsed.steps).toEqual([]);
    expect(parsed.mediaPosition).toBe('top');
    expect(parsed.accentColor).toBe('#10b981');
    expect(parsed.showStepNumbers).toBe(true);
  });
});

/* ==============================================================================
 * 5. Video Block Schema & Archetype Bundles
 * ============================================================================== */
describe('Video Block Schema & Archetype Bundles', () => {
  const videoDef = getBlock('video')!;

  it('registers the video block with extended preset, button archetype, and glow fields', () => {
    expect(videoDef).toBeDefined();
    expect(videoDef.type).toBe('video');
    const fieldKeys = videoDef.fields.map((f) => f.key);
    expect(fieldKeys).toContain('preset');
    expect(fieldKeys).toContain('aspectRatio');
    expect(fieldKeys).toContain('playButtonArchetype');
    expect(fieldKeys).toContain('ambientGlow');
    expect(fieldKeys).toContain('hoverPreview');
    expect(fieldKeys).toContain('controlsTheme');
    expect(fieldKeys).toContain('overlayTint');
  });

  it('safely parses legacy video block props without breaking defaults', () => {
    const legacyProps = {
      url: 'https://youtube.com/watch?v=12345678901',
      playMode: 'modal',
      title: 'Legacy Title',
    };

    const parsed = videoDef.schema.safeParse(legacyProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.preset).toBe('hero-walkthrough');
      expect(parsed.data.playMode).toBe('modal');
      expect(parsed.data.playButtonArchetype).toBe('pulse');
    }
  });

  it('applies ambient-loop defaults accurately', () => {
    const ambientProps = {
      url: 'https://example.com/loop.mp4',
      preset: 'ambient-loop',
    };

    const parsed = videoDef.schema.safeParse(ambientProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.autoPlay).toBe(true);
      expect(parsed.data.muted).toBe(true);
      expect(parsed.data.loop).toBe(true);
      expect(parsed.data.ambientGlow).toBe(true);
      expect(parsed.data.overlayTint).toBe('dark-30');
    }
  });

  it('merges preset bundle attributes when BlockRenderer merges def.defaults with a custom preset', () => {
    const mergedProps = {
      ...videoDef.defaults,
      preset: 'social-reel' as const,
    };
    const parsed = videoDef.schema.parse(mergedProps);
    expect(parsed.preset).toBe('social-reel');
    expect(parsed.aspectRatio).toBe('9:16');
  });

  it('preserves explicit user overrides when fine-tuning a preset', () => {
    const customProps = {
      ...videoDef.defaults,
      preset: 'social-reel' as const,
      aspectRatio: '1:1' as const,
      playButtonArchetype: 'glass-pill' as const,
    };
    const parsed = videoDef.schema.parse(customProps);
    expect(parsed.preset).toBe('social-reel');
    expect(parsed.aspectRatio).toBe('1:1');
    expect(parsed.playButtonArchetype).toBe('glass-pill');
    expect(parsed.elevation).toBe('mobile');
  });
});

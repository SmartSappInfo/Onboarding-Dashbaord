import { describe, it, expect } from 'vitest';
import { getBlock } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks/image';

describe('Image Progressive Disclosure & Field Definitions', () => {
  const imageDef = getBlock('image')!;

  it('exposes clean everyday UI English labels for all fine-tuning controls', () => {
    const fields = imageDef.fields;
    const presetField = fields.find((f) => f.key === 'preset');
    const ratioField = fields.find((f) => f.key === 'aspectRatio');
    const shapeField = fields.find((f) => f.key === 'borderRadius');
    const elevationField = fields.find((f) => f.key === 'elevation');
    const hoverField = fields.find((f) => f.key === 'hoverEffect');
    const fitField = fields.find((f) => f.key === 'objectFit');

    expect(presetField?.label).toBe('Preset Style');
    expect(ratioField?.label).toBe('Aspect Ratio');
    expect(shapeField?.label).toBe('Corner Shape & Mask');
    expect(elevationField?.label).toBe('Elevation & Frame');
    expect(hoverField?.label).toBe('Hover Animation');
    expect(fitField?.label).toBe('Image Fit Mode');
  });
});

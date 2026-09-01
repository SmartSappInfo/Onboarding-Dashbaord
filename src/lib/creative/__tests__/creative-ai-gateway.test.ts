import { describe, it, expect } from 'vitest';
import {
  clampCoordinate,
  normalizeCanvasElements,
  generateConceptCompositions,
  generateCopyVariations,
  parseAndExecuteAiCanvasCommand,
} from '../creative-ai-gateway';
import type { CreativeElement } from '../creative-types';

describe('Creative AI Gateway (Phase 3)', () => {
  it('should clamp coordinates strictly within min-max bounds', () => {
    expect(clampCoordinate(-25, 0, 100)).toBe(0);
    expect(clampCoordinate(140, 0, 100)).toBe(100);
    expect(clampCoordinate(45.6789, 0, 100)).toBe(45.68);
    expect(clampCoordinate(NaN, 0, 100)).toBe(0);
  });

  it('should normalize canvas elements and enforce 0-100% boundaries', () => {
    const raw: CreativeElement[] = [
      {
        id: 'raw-1',
        type: 'text',
        x: -15,
        y: 120,
        width: 150,
        height: 0,
        zIndex: 0,
      },
    ];

    const normalized = normalizeCanvasElements(raw);
    expect(normalized[0].x).toBe(0);
    expect(normalized[0].y).toBe(95);
    expect(normalized[0].width).toBe(100);
    expect(normalized[0].height).toBe(5);
    expect(normalized[0].zIndex).toBe(1);
  });

  it('should generate 3 distinct strategic creative concepts with complete layer trees', () => {
    const concepts = generateConceptCompositions('proj-123', 'School Enrollment Growth');
    expect(concepts).toHaveLength(3);

    const [c1, c2, c3] = concepts;
    expect(c1.angle).toBe('growth');
    expect(c2.angle).toBe('problem_pain');
    expect(c3.angle).toBe('curiosity');

    expect(c1.elements && c1.elements.length > 0).toBe(true);
    expect(c2.elements && c2.elements.length > 0).toBe(true);
    expect(c3.elements && c3.elements.length > 0).toBe(true);

    expect(c1.predictedCTRScore).toBeGreaterThanOrEqual(80);
  });

  it('should generate 5 psychological copy variations', () => {
    const copyList = generateCopyVariations('Double Admissions', 'Scale Your School');
    expect(copyList).toHaveLength(5);

    const hookTypes = copyList.map((c) => c.hookType);
    expect(hookTypes).toContain('curiosity');
    expect(hookTypes).toContain('fear_of_missing_out');
    expect(hookTypes).toContain('data_driven');
    expect(hookTypes).toContain('direct_benefit');
    expect(hookTypes).toContain('contrarian');
  });

  it('should parse natural language canvas commands and adjust layout', () => {
    const initialElements: CreativeElement[] = [
      {
        id: 'el-text',
        type: 'text',
        x: 40,
        y: 20,
        width: 40,
        height: 20,
        text: 'Headline',
        fontSize: 40,
        semanticRole: 'headline',
        zIndex: 1,
      },
      {
        id: 'el-img',
        type: 'image',
        x: 50,
        y: 50,
        width: 30,
        height: 30,
        semanticRole: 'subject',
        zIndex: 2,
      },
    ];

    // Command: Move subject left
    const leftRes = parseAndExecuteAiCanvasCommand(initialElements, 'Move subject to the left');
    expect(leftRes.modifiedElements.find((e) => e.id === 'el-img')?.x).toBeLessThan(50);

    // Command: Make headline bolder and pop
    const boldRes = parseAndExecuteAiCanvasCommand(initialElements, 'Make headline pop and bolder');
    const textEl = boldRes.modifiedElements.find((e) => e.id === 'el-text');
    expect(textEl?.fontSize).toBeGreaterThan(40);
    expect(textEl?.fontWeight).toBe('900');

    // Command: Mobile readability
    const mobileRes = parseAndExecuteAiCanvasCommand(initialElements, 'Optimize for mobile');
    expect(mobileRes.modifiedElements.find((e) => e.id === 'el-text')?.fontSize).toBeGreaterThanOrEqual(52);
  });
});

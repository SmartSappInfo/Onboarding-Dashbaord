/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Unit tests for In-Editor AI Field Detection & OCR Geometry Engine (P5.1).
 * 2. Invariants Tested:
 *    - Normalized percentage coordinate bounding (leftPct, topPct, widthPct, heightPct in [0, 100]).
 *    - Multi-party recipient role mapping ('signer', 'countersigner').
 *    - Confidence thresholding (filters candidate fields below threshold).
 *    - Zero-tolerance typing (Rule 4).
 */

import { describe, it, expect } from 'vitest';
import {
  detectTemplateFieldsFromPages,
  type DetectTemplateFieldsOptions,
} from '../template-ai-field-detector';

describe('P5.1 In-Editor AI Field Detection & Geometry Engine', () => {
  const samplePages = [
    // Page 1: Terms & Conditions
    '1. Definitions and Interpretation. 2. Services and Scope of Work. 3. Fees and Billing.',
    // Page 2: Execution Page with two signature blocks
    `IN WITNESS WHEREOF, the parties hereto have executed this Agreement as of the date first above written.

Client / Customer:
By: ___________________________
Name: John Doe
Title: Chief Executive Officer
Date: _________________________

Service Provider:
By: ___________________________
Name: Jane Smith
Title: Managing Director
Date: _________________________`,
  ];

  it('detects signatures, names, and dates on the signature page', () => {
    const fields = detectTemplateFieldsFromPages(samplePages);

    expect(fields.length).toBeGreaterThanOrEqual(4);

    const signatures = fields.filter((f) => f.fieldType === 'signature');
    expect(signatures.length).toBe(2);

    const dates = fields.filter((f) => f.fieldType === 'date');
    expect(dates.length).toBe(2);

    // All detected on page 2
    fields.forEach((f) => {
      expect(f.pageNumber).toBe(2);
    });
  });

  it('assigns normalized percentage coordinates strictly within [0, 100]', () => {
    const fields = detectTemplateFieldsFromPages(samplePages);

    fields.forEach((f) => {
      expect(f.leftPct).toBeGreaterThanOrEqual(0);
      expect(f.leftPct).toBeLessThanOrEqual(100);
      expect(f.topPct).toBeGreaterThanOrEqual(0);
      expect(f.topPct).toBeLessThanOrEqual(100);
      expect(f.widthPct).toBeGreaterThan(0);
      expect(f.widthPct).toBeLessThanOrEqual(100);
      expect(f.heightPct).toBeGreaterThan(0);
      expect(f.heightPct).toBeLessThanOrEqual(100);
      expect(f.leftPct + f.widthPct).toBeLessThanOrEqual(100);
    });
  });

  it('differentiates roles between primary signer and countersigner', () => {
    const fields = detectTemplateFieldsFromPages(samplePages);

    const primarySignerFields = fields.filter((f) => f.recipientRole === 'signer');
    const countersignerFields = fields.filter((f) => f.recipientRole === 'countersigner');

    expect(primarySignerFields.length).toBeGreaterThan(0);
    expect(countersignerFields.length).toBeGreaterThan(0);
  });

  it('respects minConfidence threshold and excludes low-confidence noise', () => {
    const options: DetectTemplateFieldsOptions = {
      minConfidence: 0.92,
    };
    const highConfidenceFields = detectTemplateFieldsFromPages(samplePages, options);

    highConfidenceFields.forEach((f) => {
      expect(f.confidence).toBeGreaterThanOrEqual(0.92);
    });
  });

  it('returns empty array when document has no signature blocks', () => {
    const textWithoutSignatures = [
      'Chapter 1: The Foundations of Modern Physics. Isaac Newton and Classical Mechanics.',
      'Chapter 2: Thermodynamics and Heat Transfer in Open Systems.',
    ];

    const fields = detectTemplateFieldsFromPages(textWithoutSignatures);
    expect(fields).toHaveLength(0);
  });
});

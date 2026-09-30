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

  it('detects student names, grades, and parent fields in tabular form layouts', () => {
    const formDocument = [
      `PARENT / GUARDIAN NAME: ________________________   CONTACT NUMBER: __________________
EMAIL ADDRESS: _________________________________   DATE OF BIRTH: ___________________

4. STUDENT NAME: ___________________________    GRADE: ____________
5. STUDENT NAME: ___________________________    GRADE: ____________

PARENT OBLIGATION
The Parent/Guardian agrees to pay all approved fees.

PARENT / GUARDIAN SIGNATURE: ___________________    DATE: _____________`,
    ];

    const fields = detectTemplateFieldsFromPages(formDocument);

    expect(fields.length).toBeGreaterThanOrEqual(7);

    // Verify student name and grade extraction
    const studentNames = fields.filter((f) => f.label.includes('Student Name'));
    expect(studentNames.length).toBe(2);
    expect(studentNames[0].label).toContain('4');
    expect(studentNames[1].label).toContain('5');

    const grades = fields.filter((f) => f.label.includes('Grade'));
    expect(grades.length).toBe(2);

    // Verify signatures and dates
    const signatures = fields.filter((f) => f.fieldType === 'signature');
    expect(signatures.length).toBeGreaterThanOrEqual(1);

    const dates = fields.filter((f) => f.fieldType === 'date');
    expect(dates.length).toBeGreaterThanOrEqual(1);

    // Verify normalized coordinates
    fields.forEach((f) => {
      expect(f.leftPct).toBeGreaterThanOrEqual(0);
      expect(f.topPct).toBeGreaterThanOrEqual(0);
      expect(f.leftPct + f.widthPct).toBeLessThanOrEqual(100);
      expect(f.topPct + f.heightPct).toBeLessThanOrEqual(100);
    });
  });

  it('uses rich page item bounding boxes when pagesData is provided', () => {
    const pages = ['STUDENT NAME: John Doe    GRADE: 5th'];
    const pagesData = [
      {
        pageNumber: 1,
        text: 'STUDENT NAME: John Doe    GRADE: 5th',
        items: [
          { str: 'STUDENT NAME:', leftPct: 10, topPct: 25, widthPct: 15, heightPct: 3 },
          { str: 'GRADE:', leftPct: 60, topPct: 25, widthPct: 10, heightPct: 3 },
        ],
      },
    ];

    const fields = detectTemplateFieldsFromPages(pages, { pagesData });

    expect(fields).toHaveLength(2);
    const nameField = fields.find((f) => f.label.includes('Student Name'));
    const gradeField = fields.find((f) => f.label.includes('Grade'));

    expect(nameField).toBeDefined();
    expect(gradeField).toBeDefined();

    // Bounding boxes should reflect item positions
    expect(nameField!.leftPct).toBeGreaterThan(15);
    expect(nameField!.leftPct).toBeLessThan(60);
    expect(gradeField!.leftPct).toBeGreaterThan(65);
  });

  it('detects both party execution blocks and tabular form fields on mixed-content pages', () => {
    const mixedPage = [
      `IN WITNESS WHEREOF, the parties have executed this Agreement.

STUDENT NAME: ___________________________    GRADE: ____________
PARENT / GUARDIAN NAME: _________________    PHONE: ____________

Client / Customer:
By: ___________________________
Name: John Doe
Date: _________________________`,
    ];

    const fields = detectTemplateFieldsFromPages(mixedPage);

    // Should detect the party block fields (signature, name, date)
    const partySignatures = fields.filter((f) => f.fieldType === 'signature');
    expect(partySignatures.length).toBeGreaterThanOrEqual(1);

    // AND should detect the form fields (Student Name, Grade, Parent Name, Phone) without suppression
    const studentNames = fields.filter((f) => f.label.includes('Student Name'));
    const grades = fields.filter((f) => f.label.includes('Grade'));
    const parentNames = fields.filter((f) => f.label.includes('Parent'));
    const phones = fields.filter((f) => f.label.includes('Phone'));

    expect(studentNames.length).toBe(1);
    expect(grades.length).toBe(1);
    expect(parentNames.length).toBe(1);
    expect(phones.length).toBe(1);
  });
});



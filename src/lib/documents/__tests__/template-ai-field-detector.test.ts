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

  it('places tabular student rows and parent details with millimeter visual precision', () => {
    const rawText = `PARENT/GUARDIAN NAME:
CONTACT No: GHANA CARD #:
1. STUDENT NAME: GRADE:
2. STUDENT NAME: GRADE:
3. STUDENT NAME: GRADE:
4. STUDENT NAME: GRADE:
5. STUDENT NAME: GRADE:
PARENT / GUARDIAN SIGNATURE: DATE:`;

    const lines = [
      {
        text: 'PARENT/GUARDIAN NAME:',
        topPct: 43.5,
        heightPct: 1.8,
        minLeftPct: 15.0,
        maxRightPct: 34.0,
        items: [
          { str: 'PARENT/GUARDIAN', leftPct: 15.0, topPct: 43.5, widthPct: 13.0, heightPct: 1.8 },
          { str: 'NAME:', leftPct: 28.5, topPct: 43.5, widthPct: 5.5, heightPct: 1.8 },
        ],
      },
      {
        text: 'CONTACT No: GHANA CARD #:',
        topPct: 47.5,
        heightPct: 1.8,
        minLeftPct: 15.0,
        maxRightPct: 63.5,
        items: [
          { str: 'CONTACT', leftPct: 15.0, topPct: 47.5, widthPct: 7.0, heightPct: 1.8 },
          { str: 'No:', leftPct: 22.5, topPct: 47.5, widthPct: 3.0, heightPct: 1.8 },
          { str: 'GHANA', leftPct: 50.0, topPct: 47.5, widthPct: 6.0, heightPct: 1.8 },
          { str: 'CARD', leftPct: 56.5, topPct: 47.5, widthPct: 4.5, heightPct: 1.8 },
          { str: '#:', leftPct: 61.5, topPct: 47.5, widthPct: 2.0, heightPct: 1.8 },
        ],
      },
      {
        text: '1. STUDENT NAME: GRADE:',
        topPct: 51.5,
        heightPct: 1.8,
        minLeftPct: 15.0,
        maxRightPct: 67.5,
        items: [
          { str: '1.', leftPct: 15.0, topPct: 51.5, widthPct: 2.0, heightPct: 1.8 },
          { str: 'STUDENT', leftPct: 17.5, topPct: 51.5, widthPct: 7.0, heightPct: 1.8 },
          { str: 'NAME:', leftPct: 25.0, topPct: 51.5, widthPct: 5.0, heightPct: 1.8 },
          { str: 'GRADE:', leftPct: 62.0, topPct: 51.5, widthPct: 5.5, heightPct: 1.8 },
        ],
      },
      {
        text: '2. STUDENT NAME: GRADE:',
        topPct: 55.5,
        heightPct: 1.8,
        minLeftPct: 15.0,
        maxRightPct: 67.5,
        items: [
          { str: '2.', leftPct: 15.0, topPct: 55.5, widthPct: 2.0, heightPct: 1.8 },
          { str: 'STUDENT', leftPct: 17.5, topPct: 55.5, widthPct: 7.0, heightPct: 1.8 },
          { str: 'NAME:', leftPct: 25.0, topPct: 55.5, widthPct: 5.0, heightPct: 1.8 },
          { str: 'GRADE:', leftPct: 62.0, topPct: 55.5, widthPct: 5.5, heightPct: 1.8 },
        ],
      },
      {
        text: '3. STUDENT NAME: GRADE:',
        topPct: 59.5,
        heightPct: 1.8,
        minLeftPct: 15.0,
        maxRightPct: 67.5,
        items: [
          { str: '3.', leftPct: 15.0, topPct: 59.5, widthPct: 2.0, heightPct: 1.8 },
          { str: 'STUDENT', leftPct: 17.5, topPct: 59.5, widthPct: 7.0, heightPct: 1.8 },
          { str: 'NAME:', leftPct: 25.0, topPct: 59.5, widthPct: 5.0, heightPct: 1.8 },
          { str: 'GRADE:', leftPct: 62.0, topPct: 59.5, widthPct: 5.5, heightPct: 1.8 },
        ],
      },
      {
        text: '4. STUDENT NAME: GRADE:',
        topPct: 63.5,
        heightPct: 1.8,
        minLeftPct: 15.0,
        maxRightPct: 67.5,
        items: [
          { str: '4.', leftPct: 15.0, topPct: 63.5, widthPct: 2.0, heightPct: 1.8 },
          { str: 'STUDENT', leftPct: 17.5, topPct: 63.5, widthPct: 7.0, heightPct: 1.8 },
          { str: 'NAME:', leftPct: 25.0, topPct: 63.5, widthPct: 5.0, heightPct: 1.8 },
          { str: 'GRADE:', leftPct: 62.0, topPct: 63.5, widthPct: 5.5, heightPct: 1.8 },
        ],
      },
      {
        text: '5. STUDENT NAME: GRADE:',
        topPct: 67.5,
        heightPct: 1.8,
        minLeftPct: 15.0,
        maxRightPct: 67.5,
        items: [
          { str: '5.', leftPct: 15.0, topPct: 67.5, widthPct: 2.0, heightPct: 1.8 },
          { str: 'STUDENT', leftPct: 17.5, topPct: 67.5, widthPct: 7.0, heightPct: 1.8 },
          { str: 'NAME:', leftPct: 25.0, topPct: 67.5, widthPct: 5.0, heightPct: 1.8 },
          { str: 'GRADE:', leftPct: 62.0, topPct: 67.5, widthPct: 5.5, heightPct: 1.8 },
        ],
      },
      {
        text: 'PARENT / GUARDIAN SIGNATURE: DATE:',
        topPct: 88.0,
        heightPct: 1.8,
        minLeftPct: 15.0,
        maxRightPct: 75.0,
        items: [
          { str: 'PARENT / GUARDIAN', leftPct: 15.0, topPct: 88.0, widthPct: 15.0, heightPct: 1.8 },
          { str: 'SIGNATURE:', leftPct: 30.5, topPct: 88.0, widthPct: 9.0, heightPct: 1.8 },
          { str: 'DATE:', leftPct: 68.0, topPct: 88.0, widthPct: 5.0, heightPct: 1.8 },
        ],
      },
    ];

    const allItems = lines.flatMap((l) => l.items);
    const pagesData = [{ pageNumber: 1, text: rawText, lines, items: allItems }];

    const fields = detectTemplateFieldsFromPages([rawText], { pagesData });

    // Expect all 15 fields detected: Parent Name, Contact No, Ghana Card, 5 Student Names, 5 Grades, Signature, Date
    expect(fields.length).toBe(15);

    // 1. Parent/Guardian Name placed inside table cell, NOT outside at 92%
    const parentName = fields.find((f) => f.label.includes('Parent/Guardian Name'));
    expect(parentName).toBeDefined();
    expect(parentName!.leftPct).toBe(34.8); // 34.0 + 0.8
    expect(parentName!.leftPct + parentName!.widthPct).toBeLessThanOrEqual(88);
    expect(parentName!.topPct).toBeCloseTo(43.1, 0.5);
    expect(parentName!.heightPct).toBeLessThanOrEqual(2.8);

    // 2. Contact Number and Ghana Card Number
    const contactNo = fields.find((f) => f.label.includes('Contact Number'));
    const ghanaCard = fields.find((f) => f.label.includes('Ghana Card'));
    expect(contactNo).toBeDefined();
    expect(ghanaCard).toBeDefined();
    expect(contactNo!.leftPct + contactNo!.widthPct).toBeLessThanOrEqual(ghanaCard!.leftPct);
    expect(ghanaCard!.leftPct + ghanaCard!.widthPct).toBeLessThanOrEqual(88);

    // 3. Student Names 1-5 strictly in Column 1 and with distinct row Y positions
    for (let i = 1; i <= 5; i++) {
      const studentField = fields.find((f) => f.label === `Student Name ${i}`);
      const gradeField = fields.find((f) => f.label === `Grade ${i}`);

      expect(studentField).toBeDefined();
      expect(gradeField).toBeDefined();

      // Student name in column 1 (starts ~30.8%, ends before grade starts at ~62%)
      expect(studentField!.leftPct).toBeCloseTo(30.8, 0.5);
      expect(studentField!.leftPct + studentField!.widthPct).toBeLessThanOrEqual(62.0);

      // Grade in column 2 (starts ~68.3%, ends within 88% table bound)
      expect(gradeField!.leftPct).toBeCloseTo(68.3, 0.5);
      expect(gradeField!.leftPct + gradeField!.widthPct).toBeLessThanOrEqual(88.0);

      // Sits vertically on its line, compact height to prevent cell border overlap
      expect(studentField!.topPct).toBeCloseTo(51.1 + (i - 1) * 4.0, 0.5);
      expect(studentField!.heightPct).toBeLessThanOrEqual(2.8);
      expect(gradeField!.heightPct).toBeLessThanOrEqual(2.8);
    }

    // 4. Signature & Date
    const signature = fields.find((f) => f.fieldType === 'signature');
    const date = fields.find((f) => f.fieldType === 'date');
    expect(signature).toBeDefined();
    expect(date).toBeDefined();
    expect(signature!.topPct).toBeCloseTo(87.5, 0.5);
    expect(date!.topPct).toBeCloseTo(87.6, 0.5);
  });
});




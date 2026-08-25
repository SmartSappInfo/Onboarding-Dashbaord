import { describe, it, expect } from 'vitest';
import {
  generateDocumentSummary,
  recommendDocumentHotspots,
  answerDocumentQuestion,
} from '../ai-document-service';

describe('AI Document Intelligence Service (Phase 12)', () => {
  const mockPageTexts = [
    'Welcome to the 2026 Admissions Prospectus for Smart Academy. We offer exceptional undergraduate and graduate programs in science, technology, and arts.',
    'Tuition and Financial Aid: The annual tuition fee is $12,500. Merit scholarships and grants are available for eligible students.',
    'How to Apply: The application deadline for the Fall 2026 semester is May 15. Apply online or contact admissions.',
    'Campus Visit: Book a tour or schedule a consultation with our advisors. Call us at +1 (555) 019-2834 or email info@smart-academy.edu.',
  ];

  const mockPages = mockPageTexts.map((text, idx) => ({
    pageNumber: idx + 1,
    text,
  }));

  describe('generateDocumentSummary', () => {
    it('generates an executive summary, key takeaways, topic taxonomy tags, and audience classification', () => {
      const summary = generateDocumentSummary('doc_123', mockPageTexts, '2026 Admissions Prospectus');

      expect(summary.documentId).toBe('doc_123');
      expect(summary.executiveSummary.length).toBeGreaterThan(20);
      expect(summary.keyTakeaways.length).toBeGreaterThan(0);
      expect(summary.topics).toContain('Education & Admissions');
      expect(summary.topics).toContain('Finance & Tuition');
      expect(summary.estimatedReadingTimeMinutes).toBeGreaterThanOrEqual(1);
      expect(summary.targetAudience).toBeDefined();
    });
  });

  describe('recommendDocumentHotspots', () => {
    it('scans page text copy and identifies actionable CTA conversion opportunities', () => {
      const recommendations = recommendDocumentHotspots('doc_123', mockPages);

      expect(recommendations.length).toBeGreaterThan(0);

      // Should detect "apply" on page 3
      const applyRec = recommendations.find((r) => r.pageNumber === 3 && r.suggestedLayerType === 'cta');
      expect(applyRec).toBeDefined();
      expect(applyRec?.buttonLabel).toBe('Apply Online');
      expect(applyRec?.confidenceScore).toBeGreaterThanOrEqual(80);

      // Should detect phone/call on page 4
      const phoneRec = recommendations.find((r) => r.pageNumber === 4 && r.suggestedLayerType === 'phone');
      expect(phoneRec).toBeDefined();
      expect(phoneRec?.suggestedAction.phoneNumber).toBe('+1 (555) 019-2834');

      // Should detect email on page 4
      const emailRec = recommendations.find((r) => r.pageNumber === 4 && r.suggestedLayerType === 'email');
      expect(emailRec).toBeDefined();
      expect(emailRec?.suggestedAction.emailAddress).toBe('info@smart-academy.edu');

      // Should detect campus tour / calendar on page 4
      const tourRec = recommendations.find((r) => r.pageNumber === 4 && r.suggestedLayerType === 'calendar');
      expect(tourRec).toBeDefined();
    });
  });

  describe('answerDocumentQuestion', () => {
    it('generates grounded answers with exact page citations', () => {
      const res = answerDocumentQuestion({
        documentId: 'doc_123',
        question: 'What is the tuition fee and scholarship policy?',
        pages: mockPages,
      });

      expect(res.answer).toBeDefined();
      expect(res.citations.length).toBeGreaterThan(0);
      // Tuition is on page 2
      expect(res.citations[0].pageNumber).toBe(2);
      expect(res.citations[0].textSnippet).toContain('Tuition');
      expect(res.suggestedFollowUps?.length).toBeGreaterThan(0);
    });

    it('handles general queries and points to publication context', () => {
      const res = answerDocumentQuestion({
        documentId: 'doc_123',
        question: 'Tell me about student housing and dormitories',
        pages: mockPages,
      });

      expect(res.answer).toBeDefined();
      expect(res.citations.length).toBeGreaterThan(0);
    });
  });
});

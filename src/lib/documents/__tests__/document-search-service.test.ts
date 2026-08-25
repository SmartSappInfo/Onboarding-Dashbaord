import { describe, it, expect } from 'vitest';
import { 
  tokenizeText, 
  buildDocumentSearchIndex, 
  searchDocumentText 
} from '../document-search-service';

describe('Document Search Engine & Indexer', () => {
  it('tokenizes text and removes common stopwords', () => {
    const raw = 'The Annual Financial Report and Strategic Goals for 2026!';
    const tokens = tokenizeText(raw);

    expect(tokens).toContain('annual');
    expect(tokens).toContain('financial');
    expect(tokens).toContain('report');
    expect(tokens).toContain('strategic');
    expect(tokens).toContain('goals');
    expect(tokens).toContain('2026');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('and');
    expect(tokens).not.toContain('for');
  });

  it('builds an inverted search index over multiple pages', () => {
    const pages = [
      { pageNumber: 1, extractedText: 'Welcome to Oxford International University Admissions Guide.' },
      { pageNumber: 2, extractedText: 'Scholarship requirements and Tuition fees breakdown.' },
      { pageNumber: 3, extractedText: 'Campus housing, dormitories, and student union life.' },
    ];

    const index = buildDocumentSearchIndex('doc_uni', 'v1', pages);

    expect(index.totalTerms).toBeGreaterThan(0);
    expect(index.invertedIndex['admissions']).toEqual([1]);
    expect(index.invertedIndex['scholarship']).toEqual([2]);
    expect(index.invertedIndex['housing']).toEqual([3]);
  });

  it('searches extracted text and returns ranked matches with contextual snippets', () => {
    const pages = [
      { 
        pageNumber: 1, 
        extractedText: 'Welcome to Oxford University. Explore undergraduate and graduate programs across science and arts.' 
      },
      { 
        pageNumber: 2, 
        extractedText: 'Undergraduate scholarships provide full tuition coverage for qualifying international candidates.' 
      },
      { 
        pageNumber: 3, 
        extractedText: 'Sports complex and student dining halls are open 24/7 throughout semester.' 
      },
    ];

    const results = searchDocumentText(pages, 'scholarships');

    expect(results).toHaveLength(1);
    expect(results[0].pageNumber).toBe(2);
    expect(results[0].snippet).toContain('scholarships');
    expect(results[0].highlightWords).toContain('scholarships');
    expect(results[0].matchScore).toBeGreaterThan(0);
  });

  it('handles empty queries or query terms with zero matches gracefully', () => {
    const pages = [
      { pageNumber: 1, extractedText: 'Introduction to Biology and Chemistry.' },
    ];

    const emptyResult = searchDocumentText(pages, '');
    expect(emptyResult).toEqual([]);

    const noMatchResult = searchDocumentText(pages, 'cryptocurrency');
    expect(noMatchResult).toEqual([]);
  });
});

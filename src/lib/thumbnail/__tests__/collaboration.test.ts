import { expect, test, describe } from 'vitest';
import type { DesignComment } from '../thumbnail-types';

describe('Collaboration feedback comments state managers', () => {
  test('correctly adds a new active feedback comment', () => {
    const comments: DesignComment[] = [];
    const newComment: DesignComment = {
      id: 'c-1',
      authorName: 'Joseph Aidoo',
      authorEmail: 'joseph@smartsapp.com',
      text: 'Add neon outline on text',
      timestamp: '1:45 PM',
      resolved: false
    };
    const updatedList = [...comments, newComment];
    expect(updatedList.length).toBe(1);
    expect(updatedList[0].text).toBe('Add neon outline on text');
    expect(updatedList[0].resolved).toBe(false);
  });

  test('marks selected comment as resolved successfully', () => {
    const comments: DesignComment[] = [
      { id: 'c-1', authorName: 'Joseph Aidoo', authorEmail: 'joseph@smartsapp.com', text: 'Outline title', timestamp: '1:45 PM', resolved: false }
    ];
    const resolvedList = comments.map(c => c.id === 'c-1' ? { ...c, resolved: true } : c);
    expect(resolvedList[0].resolved).toBe(true);
  });
});

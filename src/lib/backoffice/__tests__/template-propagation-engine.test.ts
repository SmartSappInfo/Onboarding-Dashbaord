/**
 * @fileoverview QA Unit Tests for Template Propagation Engine & Chunking Algorithm
 */

import { describe, it, expect } from 'vitest';
import { chunkArray } from '../template-propagation-engine';

describe('Template Propagation Engine QA Suite', () => {
  it('correctly chunks arrays into bounded sizes of <= 30 items', () => {
    const items = Array.from({ length: 95 }, (_, i) => ({ id: `ws_${i}`, name: `Workspace ${i}` }));
    const chunks = chunkArray(items, 30);

    expect(chunks.length).toBe(4);
    expect(chunks[0].length).toBe(30);
    expect(chunks[1].length).toBe(30);
    expect(chunks[2].length).toBe(30);
    expect(chunks[3].length).toBe(5);
  });

  it('handles empty arrays without errors', () => {
    const chunks = chunkArray([], 30);
    expect(chunks).toEqual([]);
  });

  it('handles array sizes smaller than chunk limit', () => {
    const items = [{ id: 'ws_1' }, { id: 'ws_2' }];
    const chunks = chunkArray(items, 30);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(2);
  });
});

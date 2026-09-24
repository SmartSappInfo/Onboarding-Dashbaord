import { describe, it, expect } from 'vitest';
import type { PageBlock } from '@/lib/types';

describe('Content Studio Block History Engine', () => {
  interface HistoryState {
    past: PageBlock[][];
    present: PageBlock[];
    future: PageBlock[][];
  }

  const pushSnapshot = (history: HistoryState, next: PageBlock[], max: number = 50): HistoryState => ({
    past: [...history.past.slice(-(max - 1)), history.present],
    present: next,
    future: [],
  });

  const undo = (history: HistoryState): HistoryState => {
    if (history.past.length === 0) return history;
    const previous = history.past[history.past.length - 1];
    return {
      past: history.past.slice(0, -1),
      present: previous,
      future: [history.present, ...history.future],
    };
  };

  const redo = (history: HistoryState): HistoryState => {
    if (history.future.length === 0) return history;
    const next = history.future[0];
    return {
      past: [...history.past, history.present],
      present: next,
      future: history.future.slice(1),
    };
  };

  it('records additions and undoes back to initial blocks', () => {
    let hist: HistoryState = { past: [], present: [], future: [] };
    const b1: PageBlock = { id: 'blk_1', type: 'text', props: { content: 'Hello' } };

    hist = pushSnapshot(hist, [b1]);
    expect(hist.present).toHaveLength(1);
    expect(hist.past).toHaveLength(1);

    hist = undo(hist);
    expect(hist.present).toHaveLength(0);
    expect(hist.future).toHaveLength(1);

    hist = redo(hist);
    expect(hist.present).toHaveLength(1);
    expect(hist.present[0].id).toBe('blk_1');
  });

  it('reversibly restores draft by keeping pre-restore state in history', () => {
    const original: PageBlock[] = [{ id: 'orig_1', type: 'text', props: {} }];
    const draft: PageBlock[] = [
      { id: 'draft_1', type: 'hero', props: {} },
      { id: 'draft_2', type: 'faq', props: {} },
    ];

    let hist: HistoryState = { past: [], present: original, future: [] };
    hist = pushSnapshot(hist, draft);

    expect(hist.present).toHaveLength(2);
    // User can immediately reverse the draft restoration
    hist = undo(hist);
    expect(hist.present).toHaveLength(1);
    expect(hist.present[0].id).toBe('orig_1');
  });
});

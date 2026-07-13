import { expect, test, describe, beforeEach } from 'vitest';
import { useThumbnailEditor } from '../use-thumbnail-editor';
import type { ThumbnailDesign, CanvasElement } from '../thumbnail-types';

describe('useThumbnailEditor Zustand Store', () => {
  const initialDesign: ThumbnailDesign = {
    workspaceId: 'ws-123',
    name: 'Sample Video Cover',
    backgroundColor: '#0f172a',
    elements: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    useThumbnailEditor.getState().initialize(initialDesign);
  });

  test('initializes state with enriched element properties', () => {
    const state = useThumbnailEditor.getState();
    expect(state.design.workspaceId).toBe('ws-123');
    expect(state.design.name).toBe('Sample Video Cover');
    expect(state.design.elements.length).toBe(0);
  });

  test('can add and update elements with history tracking', () => {
    const el: CanvasElement = {
      id: 'el-test-1',
      type: 'text',
      x: 10,
      y: 10,
      width: 40,
      height: 10,
      zIndex: 1,
      text: 'Original Text'
    };

    useThumbnailEditor.getState().addElement(el);
    expect(useThumbnailEditor.getState().design.elements.length).toBe(1);
    expect(useThumbnailEditor.getState().design.elements[0].text).toBe('Original Text');

    // Update text
    useThumbnailEditor.getState().updateElement('el-test-1', { text: 'Updated Text' });
    expect(useThumbnailEditor.getState().design.elements[0].text).toBe('Updated Text');

    // Undo should revert to 'Original Text'
    useThumbnailEditor.getState().undo();
    expect(useThumbnailEditor.getState().design.elements[0].text).toBe('Original Text');

    // Redo should apply 'Updated Text' again
    useThumbnailEditor.getState().redo();
    expect(useThumbnailEditor.getState().design.elements[0].text).toBe('Updated Text');
  });

  test('can select elements and delete them', () => {
    const el: CanvasElement = {
      id: 'el-test-2',
      type: 'rect',
      x: 20,
      y: 20,
      width: 20,
      height: 20,
      zIndex: 1
    };

    useThumbnailEditor.getState().addElement(el);
    useThumbnailEditor.getState().selectElement('el-test-2');
    expect(useThumbnailEditor.getState().selectedId).toBe('el-test-2');

    // Delete
    useThumbnailEditor.getState().deleteElement('el-test-2');
    expect(useThumbnailEditor.getState().design.elements.length).toBe(0);
    expect(useThumbnailEditor.getState().selectedId).toBeNull();
  });

  test('limits the past history stack size to 50 edits', () => {
    // Add 60 dummy edits
    for (let i = 0; i < 60; i++) {
      const el: CanvasElement = {
        id: `el-${i}`,
        type: 'rect',
        x: 5,
        y: 5,
        width: 10,
        height: 10,
        zIndex: i
      };
      useThumbnailEditor.getState().addElement(el);
    }
    const state = useThumbnailEditor.getState();
    expect(state.history.past.length).toBeLessThanOrEqual(50);
  });
});

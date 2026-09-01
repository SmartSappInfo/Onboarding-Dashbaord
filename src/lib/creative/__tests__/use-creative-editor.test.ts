import { describe, it, expect, beforeEach } from 'vitest';
import { useCreativeEditor } from '../use-creative-editor';
import { FORMAT_PRESETS } from '../creative-types';
import type { CreativeProject, CreativeDocument, CreativeElement } from '../creative-types';

describe('useCreativeEditor Zustand Store', () => {
  const dummyProject: CreativeProject = {
    id: 'proj-1',
    workspaceId: 'ws-1',
    name: 'Test Project',
    type: 'youtube_thumbnail',
    objective: 'traffic',
    status: 'draft',
    createdBy: 'test-user',
    createdAt: '2026-07-01T12:00:00Z',
    updatedAt: '2026-07-01T12:00:00Z',
  };

  const dummyDoc: CreativeDocument = {
    id: 'doc-1',
    projectId: 'proj-1',
    workspaceId: 'ws-1',
    name: 'Test Document',
    format: FORMAT_PRESETS.youtube_thumbnail,
    backgroundColor: '#0f172a',
    elements: [],
    status: 'draft',
    createdAt: '2026-07-01T12:00:00Z',
    updatedAt: '2026-07-01T12:00:00Z',
  };

  beforeEach(() => {
    useCreativeEditor.getState().initialize(dummyProject, dummyDoc);
  });

  it('should initialize with project and document', () => {
    const state = useCreativeEditor.getState();
    expect(state.project?.id).toBe('proj-1');
    expect(state.document.id).toBe('doc-1');
    expect(state.document.elements).toHaveLength(0);
    expect(state.history.past).toHaveLength(0);
  });

  it('should add element and update undo stack', () => {
    const el: CreativeElement = {
      id: 'el-test-1',
      type: 'text',
      x: 10,
      y: 10,
      width: 50,
      height: 20,
      zIndex: 1,
      text: 'Hello World',
    };

    useCreativeEditor.getState().addElement(el);

    const state = useCreativeEditor.getState();
    expect(state.document.elements).toHaveLength(1);
    expect(state.selectedId).toBe('el-test-1');
    expect(state.history.past).toHaveLength(1);
  });

  it('should support undo and redo', () => {
    const el: CreativeElement = {
      id: 'el-test-2',
      type: 'rect',
      x: 20,
      y: 20,
      width: 30,
      height: 30,
      zIndex: 1,
    };

    useCreativeEditor.getState().addElement(el);
    expect(useCreativeEditor.getState().document.elements).toHaveLength(1);

    useCreativeEditor.getState().undo();
    expect(useCreativeEditor.getState().document.elements).toHaveLength(0);

    useCreativeEditor.getState().redo();
    expect(useCreativeEditor.getState().document.elements).toHaveLength(1);
  });

  it('should bound undo history stack at 50 edits', () => {
    for (let i = 0; i < 60; i++) {
      const el: CreativeElement = {
        id: `el-bulk-${i}`,
        type: 'text',
        x: i,
        y: i,
        width: 10,
        height: 10,
        zIndex: i + 1,
      };
      useCreativeEditor.getState().addElement(el);
    }

    const state = useCreativeEditor.getState();
    expect(state.history.past.length).toBeLessThanOrEqual(50);
  });

  it('should perform transient drag updates without increasing history length', () => {
    const el: CreativeElement = {
      id: 'el-drag',
      type: 'circle',
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      zIndex: 1,
    };

    useCreativeEditor.getState().addElement(el);
    const historyLengthBeforeDrag = useCreativeEditor.getState().history.past.length;

    // Simulate mouse dragging with commitToHistory = false
    useCreativeEditor.getState().updateElement('el-drag', { x: 15, y: 15 }, false);
    useCreativeEditor.getState().updateElement('el-drag', { x: 20, y: 20 }, false);
    useCreativeEditor.getState().updateElement('el-drag', { x: 25, y: 25 }, false);

    expect(useCreativeEditor.getState().history.past.length).toBe(historyLengthBeforeDrag);
    expect(useCreativeEditor.getState().document.elements[0].x).toBe(25);
  });
});

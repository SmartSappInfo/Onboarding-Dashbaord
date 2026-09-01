import { describe, it, expect, beforeEach } from 'vitest';
import { useCreativeEditor } from '../use-creative-editor';
import type { CreativeProject, CreativeDocument, CreativeElement } from '../creative-types';
import { FORMAT_PRESETS } from '../creative-types';

describe('useCreativeEditor Store (Phase 2 - Professional Canvas Editor)', () => {
  const mockProject: CreativeProject = {
    id: 'proj-phase2',
    workspaceId: 'ws-123',
    name: 'Phase 2 Test Project',
    type: 'youtube_thumbnail',
    objective: 'engagement',
    status: 'draft',
    createdBy: 'test-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const el1: CreativeElement = {
    id: 'elem-1',
    type: 'text',
    x: 10,
    y: 10,
    width: 20,
    height: 10,
    text: 'Headline',
    zIndex: 1,
  };

  const el2: CreativeElement = {
    id: 'elem-2',
    type: 'image',
    x: 40,
    y: 10,
    width: 30,
    height: 30,
    zIndex: 2,
  };

  const el3: CreativeElement = {
    id: 'elem-3',
    type: 'rect',
    x: 80,
    y: 10,
    width: 10,
    height: 10,
    zIndex: 3,
  };

  const mockDoc: CreativeDocument = {
    id: 'doc-phase2',
    projectId: 'proj-phase2',
    workspaceId: 'ws-123',
    name: 'Phase 2 Test Document',
    format: FORMAT_PRESETS.youtube_thumbnail,
    backgroundColor: '#0f172a',
    elements: [el1, el2, el3],
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    useCreativeEditor.getState().initialize(mockProject, mockDoc);
  });

  it('should support single and multi-element selection', () => {
    const store = useCreativeEditor.getState();

    // Single selection
    store.selectElement('elem-1');
    expect(useCreativeEditor.getState().selectedIds).toEqual(['elem-1']);
    expect(useCreativeEditor.getState().selectedId).toBe('elem-1');

    // Multi-selection (Shift toggle)
    store.selectElement('elem-2', true);
    expect(useCreativeEditor.getState().selectedIds).toEqual(['elem-1', 'elem-2']);

    // Select All
    store.selectAll();
    expect(useCreativeEditor.getState().selectedIds).toEqual(['elem-1', 'elem-2', 'elem-3']);

    // Clear Selection
    store.clearSelection();
    expect(useCreativeEditor.getState().selectedIds).toEqual([]);
    expect(useCreativeEditor.getState().selectedId).toBeNull();
  });

  it('should group and ungroup selected elements atomically', () => {
    const store = useCreativeEditor.getState();
    store.selectMultiple(['elem-1', 'elem-2']);

    const groupId = store.groupSelected();
    expect(groupId).not.toBeNull();

    const elements = useCreativeEditor.getState().document.elements;
    const g1 = elements.find((e) => e.id === 'elem-1');
    const g2 = elements.find((e) => e.id === 'elem-2');
    const g3 = elements.find((e) => e.id === 'elem-3');

    expect(g1?.groupId).toBe(groupId);
    expect(g2?.groupId).toBe(groupId);
    expect(g3?.groupId).toBeUndefined();

    // Ungroup
    store.ungroupSelected();
    const updatedElements = useCreativeEditor.getState().document.elements;
    expect(updatedElements.find((e) => e.id === 'elem-1')?.groupId).toBeUndefined();
    expect(updatedElements.find((e) => e.id === 'elem-2')?.groupId).toBeUndefined();
  });

  it('should toggle group lock and visibility', () => {
    const store = useCreativeEditor.getState();
    store.selectMultiple(['elem-1', 'elem-2']);
    const groupId = store.groupSelected()!;

    // Toggle Lock
    store.toggleGroupLock(groupId);
    let elements = useCreativeEditor.getState().document.elements;
    expect(elements.find((e) => e.id === 'elem-1')?.isLocked).toBe(true);
    expect(elements.find((e) => e.id === 'elem-2')?.isLocked).toBe(true);

    // Toggle Visibility
    store.toggleGroupVisibility(groupId);
    elements = useCreativeEditor.getState().document.elements;
    expect(elements.find((e) => e.id === 'elem-1')?.isHidden).toBe(true);
    expect(elements.find((e) => e.id === 'elem-2')?.isHidden).toBe(true);
  });

  it('should batch align selected elements', () => {
    const store = useCreativeEditor.getState();
    store.selectMultiple(['elem-1', 'elem-2']);

    store.alignSelected('left');
    const elements = useCreativeEditor.getState().document.elements;
    expect(elements.find((e) => e.id === 'elem-1')?.x).toBe(10);
    expect(elements.find((e) => e.id === 'elem-2')?.x).toBe(10);
  });

  it('should nudge selected elements position', () => {
    const store = useCreativeEditor.getState();
    store.selectElement('elem-1');

    store.nudgeSelected(2, 3);
    const element = useCreativeEditor.getState().document.elements.find((e) => e.id === 'elem-1');
    expect(element?.x).toBe(12);
    expect(element?.y).toBe(13);
  });

  it('should undo and redo batch operations cleanly', () => {
    const store = useCreativeEditor.getState();
    store.selectMultiple(['elem-1', 'elem-2']);
    store.alignSelected('left');

    expect(useCreativeEditor.getState().document.elements.find((e) => e.id === 'elem-2')?.x).toBe(10);

    // Undo
    store.undo();
    expect(useCreativeEditor.getState().document.elements.find((e) => e.id === 'elem-2')?.x).toBe(40);

    // Redo
    store.redo();
    expect(useCreativeEditor.getState().document.elements.find((e) => e.id === 'elem-2')?.x).toBe(10);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { useCreativeEditor } from '../use-creative-editor';
import { generateConceptCompositions, parseAndExecuteAiCanvasCommand } from '../creative-ai-gateway';
import type { CreativeProject, CreativeDocument, CreativeElement } from '../creative-types';
import { FORMAT_PRESETS } from '../creative-types';

describe('useCreativeEditor Store (Phase 3 - AI Creative Director Integration)', () => {
  const mockProject: CreativeProject = {
    id: 'proj-phase3',
    workspaceId: 'ws-123',
    name: 'Phase 3 AI Test Project',
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
    x: 20,
    y: 20,
    width: 60,
    height: 15,
    text: 'Original Headline',
    fontSize: 40,
    semanticRole: 'headline',
    zIndex: 1,
  };

  const mockDoc: CreativeDocument = {
    id: 'doc-phase3',
    projectId: 'proj-phase3',
    workspaceId: 'ws-123',
    name: 'Phase 3 Test Document',
    format: FORMAT_PRESETS.youtube_thumbnail,
    backgroundColor: '#0f172a',
    elements: [el1],
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    useCreativeEditor.getState().initialize(mockProject, mockDoc);
  });

  it('should apply an AI generated concept to the canvas', () => {
    const concepts = generateConceptCompositions('proj-phase3', 'AI Automation Secrets');
    const conceptToApply = concepts[0];

    // Apply concept
    useCreativeEditor.getState().updateBackground({
      backgroundColor: conceptToApply.backgroundColor,
      backgroundGradient: conceptToApply.backgroundGradient,
    });

    useCreativeEditor.setState((s) => ({
      document: {
        ...s.document,
        elements: conceptToApply.elements || [],
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    }));

    const state = useCreativeEditor.getState();
    expect(state.document.backgroundColor).toBe(conceptToApply.backgroundColor);
    expect(state.document.elements.length).toBeGreaterThanOrEqual(2);
    expect(state.isDirty).toBe(true);
  });

  it('should apply AI NLP transformed elements and support atomic undo', () => {
    const store = useCreativeEditor.getState();
    const currentElements = store.document.elements;

    const result = parseAndExecuteAiCanvasCommand(currentElements, 'Make headline pop and bolder');

    const prevDoc = store.document;
    const nextDoc: CreativeDocument = {
      ...prevDoc,
      elements: result.modifiedElements,
      updatedAt: new Date().toISOString(),
    };

    useCreativeEditor.setState((s) => ({
      document: nextDoc,
      isDirty: true,
      history: {
        past: [...s.history.past, s.history.present],
        present: nextDoc,
        future: [],
      },
    }));

    // Verify modified elements
    const updatedHeadline = useCreativeEditor.getState().document.elements.find((e) => e.id === 'elem-1');
    expect(updatedHeadline?.fontWeight).toBe('900');

    // Test Undo
    useCreativeEditor.getState().undo();
    const restoredHeadline = useCreativeEditor.getState().document.elements.find((e) => e.id === 'elem-1');
    expect(restoredHeadline?.fontWeight).toBeUndefined();
  });
});

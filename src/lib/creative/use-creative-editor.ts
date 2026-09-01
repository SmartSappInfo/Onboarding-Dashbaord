/**
 * ARCHITECTURE:
 * Zustand State Store for SmartSapp Creative Studio 2.0 (Phase 1)
 * 
 * Manages active CreativeProject, CreativeDocument, and CreativeElements
 * with transient drag vs committed undo/redo history separation.
 * 
 * CAUTION:
 * - History stack is capped at 50 edits to prevent memory leaks during long design sessions.
 * - Mid-drag updates must specify `commitToHistory = false`.
 * - 0% any/any[] strictly enforced.
 * 
 * TESTABILITY:
 * Verified via unit tests in src/lib/creative/__tests__/use-creative-editor.test.ts
 */

import { create } from 'zustand';
import type {
  CreativeProject,
  CreativeDocument,
  CreativeElement,
  GradientConfig,
} from './creative-types';
import { FORMAT_PRESETS, makeUniqueId } from './creative-types';

export interface CreativeHistoryState {
  past: CreativeDocument[];
  present: CreativeDocument;
  future: CreativeDocument[];
}

export interface CreativeEditorStore {
  project: CreativeProject | null;
  document: CreativeDocument;
  selectedId: string | null;
  history: CreativeHistoryState;
  isDirty: boolean;
  isSaving: boolean;

  // Actions
  initialize: (project: CreativeProject, document: CreativeDocument) => void;
  selectElement: (id: string | null) => void;
  addElement: (element: CreativeElement) => void;
  updateElement: (id: string, patch: Partial<CreativeElement>, commitToHistory?: boolean) => void;
  deleteElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  reorderElement: (id: string, direction: 'up' | 'down' | 'front' | 'back') => void;
  updateBackground: (patch: {
    backgroundColor?: string;
    backgroundGradient?: GradientConfig;
    backgroundImage?: string;
  }) => void;
  undo: () => void;
  redo: () => void;
  setSaving: (saving: boolean) => void;
  markSaved: () => void;
}

const DEFAULT_DOC: CreativeDocument = {
  id: 'doc-initial',
  projectId: 'proj-initial',
  workspaceId: 'default-workspace',
  name: 'Untitled Creative',
  format: FORMAT_PRESETS.youtube_thumbnail,
  backgroundColor: '#0f172a',
  backgroundGradient: {
    type: 'linear',
    angle: 135,
    colors: ['#0f172a', '#1e1b4b'],
  },
  elements: [],
  status: 'draft',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const useCreativeEditor = create<CreativeEditorStore>((set, get) => ({
  project: null,
  document: DEFAULT_DOC,
  selectedId: null,
  history: {
    past: [],
    present: DEFAULT_DOC,
    future: [],
  },
  isDirty: false,
  isSaving: false,

  initialize: (project: CreativeProject, document: CreativeDocument) => {
    set({
      project,
      document,
      selectedId: null,
      history: {
        past: [],
        present: document,
        future: [],
      },
      isDirty: false,
    });
  },

  selectElement: (id: string | null) => {
    set({ selectedId: id });
  },

  addElement: (element: CreativeElement) => {
    const { document, history } = get();
    const newDoc: CreativeDocument = {
      ...document,
      elements: [...document.elements, element],
      updatedAt: new Date().toISOString(),
    };

    set({
      document: newDoc,
      selectedId: element.id,
      isDirty: true,
      history: {
        past: [...history.past, history.present].slice(-50),
        present: newDoc,
        future: [],
      },
    });
  },

  updateElement: (id: string, patch: Partial<CreativeElement>, commitToHistory = true) => {
    const { document, history } = get();
    const newElements = document.elements.map((el) =>
      el.id === id ? { ...el, ...patch } : el
    );

    const newDoc: CreativeDocument = {
      ...document,
      elements: newElements,
      updatedAt: new Date().toISOString(),
    };

    if (commitToHistory) {
      set({
        document: newDoc,
        isDirty: true,
        history: {
          past: [...history.past, history.present].slice(-50),
          present: newDoc,
          future: [],
        },
      });
    } else {
      // Transient drag update: does not bloat history stack
      set({
        document: newDoc,
        isDirty: true,
      });
    }
  },

  deleteElement: (id: string) => {
    const { document, history, selectedId } = get();
    const newElements = document.elements.filter((el) => el.id !== id);
    const newDoc: CreativeDocument = {
      ...document,
      elements: newElements,
      updatedAt: new Date().toISOString(),
    };

    set({
      document: newDoc,
      selectedId: selectedId === id ? null : selectedId,
      isDirty: true,
      history: {
        past: [...history.past, history.present].slice(-50),
        present: newDoc,
        future: [],
      },
    });
  },

  duplicateElement: (id: string) => {
    const { document, history } = get();
    const target = document.elements.find((el) => el.id === id);
    if (!target) return;

    const duplicated: CreativeElement = {
      ...target,
      id: makeUniqueId(),
      x: Math.min(target.x + 3, 90),
      y: Math.min(target.y + 3, 90),
      zIndex: document.elements.length + 1,
    };

    const newDoc: CreativeDocument = {
      ...document,
      elements: [...document.elements, duplicated],
      updatedAt: new Date().toISOString(),
    };

    set({
      document: newDoc,
      selectedId: duplicated.id,
      isDirty: true,
      history: {
        past: [...history.past, history.present].slice(-50),
        present: newDoc,
        future: [],
      },
    });
  },

  reorderElement: (id: string, direction: 'up' | 'down' | 'front' | 'back') => {
    const { document, history } = get();
    const index = document.elements.findIndex((el) => el.id === id);
    if (index === -1) return;

    const elements = [...document.elements];
    const [target] = elements.splice(index, 1);

    if (direction === 'back') {
      elements.unshift(target);
    } else if (direction === 'front') {
      elements.push(target);
    } else if (direction === 'down') {
      const newIndex = Math.max(0, index - 1);
      elements.splice(newIndex, 0, target);
    } else if (direction === 'up') {
      const newIndex = Math.min(elements.length, index + 1);
      elements.splice(newIndex, 0, target);
    }

    // Re-assign z-indices cleanly
    const reIndexed = elements.map((el, idx) => ({ ...el, zIndex: idx + 1 }));

    const newDoc: CreativeDocument = {
      ...document,
      elements: reIndexed,
      updatedAt: new Date().toISOString(),
    };

    set({
      document: newDoc,
      isDirty: true,
      history: {
        past: [...history.past, history.present].slice(-50),
        present: newDoc,
        future: [],
      },
    });
  },

  updateBackground: (patch) => {
    const { document, history } = get();
    const newDoc: CreativeDocument = {
      ...document,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    set({
      document: newDoc,
      isDirty: true,
      history: {
        past: [...history.past, history.present].slice(-50),
        present: newDoc,
        future: [],
      },
    });
  },

  undo: () => {
    const { history } = get();
    if (history.past.length === 0) return;

    const previous = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, history.past.length - 1);

    set({
      document: previous,
      isDirty: true,
      history: {
        past: newPast,
        present: previous,
        future: [history.present, ...history.future].slice(0, 50),
      },
    });
  },

  redo: () => {
    const { history } = get();
    if (history.future.length === 0) return;

    const next = history.future[0];
    const newFuture = history.future.slice(1);

    set({
      document: next,
      isDirty: true,
      history: {
        past: [...history.past, history.present].slice(-50),
        present: next,
        future: newFuture,
      },
    });
  },

  setSaving: (saving: boolean) => {
    set({ isSaving: saving });
  },

  markSaved: () => {
    set({ isDirty: false, isSaving: false });
  },
}));

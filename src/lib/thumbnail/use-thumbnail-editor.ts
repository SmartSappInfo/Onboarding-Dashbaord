import { create } from 'zustand';
import type { ThumbnailDesign, CanvasElement } from './thumbnail-types';

interface EditorHistory {
  past: ThumbnailDesign[];
  present: ThumbnailDesign;
  future: ThumbnailDesign[];
}

export interface EditorState {
  design: ThumbnailDesign;
  selectedId: string | null;
  history: EditorHistory;
  
  // Actions
  initialize: (design: ThumbnailDesign) => void;
  selectElement: (id: string | null) => void;
  addElement: (element: CanvasElement) => void;
  updateElement: (id: string, patch: Partial<CanvasElement>, commitToHistory?: boolean) => void;
  deleteElement: (id: string) => void;
  undo: () => void;
  redo: () => void;
}

export const useThumbnailEditor = create<EditorState>((set, get) => ({
  design: {
    workspaceId: '',
    name: 'Untitled',
    backgroundColor: '#000000',
    elements: [],
    createdAt: '',
    updatedAt: '',
  },
  selectedId: null,
  history: { 
    past: [], 
    present: { workspaceId: '', name: '', backgroundColor: '', elements: [], createdAt: '', updatedAt: '' }, 
    future: [] 
  },

  initialize: (design) => {
    // Enrich design defaults (Fetch, Enrich & Restore protocol)
    const enriched: ThumbnailDesign = {
      ...design,
      elements: design.elements.map(el => ({
        ...el,
        isLocked: el.isLocked ?? false,
        isHidden: el.isHidden ?? false,
        opacity: el.opacity ?? 1,
      }))
    };
    set({
      design: enriched,
      selectedId: null,
      history: { past: [], present: enriched, future: [] }
    });
  },

  selectElement: (id) => set({ selectedId: id }),

  addElement: (el) => {
    const { design, history } = get();
    const updated = {
      ...design,
      elements: [...design.elements, el],
      updatedAt: new Date().toISOString()
    };
    set({
      design: updated,
      selectedId: el.id,
      history: {
        past: [...history.past, history.present],
        present: updated,
        future: []
      }
    });
  },

  updateElement: (id, patch, commitToHistory = true) => {
    const { design, history } = get();
    const updatedElements = design.elements.map((el) => {
      if (el.id !== id) return el;
      return { ...el, ...patch };
    });
    const updated = { ...design, elements: updatedElements, updatedAt: new Date().toISOString() };

    if (commitToHistory) {
      set({
        design: updated,
        history: {
          past: [...history.past, history.present],
          present: updated,
          future: []
        }
      });
    } else {
      // Transient updates (e.g. while actively dragging coordinates)
      set({ design: updated });
    }
  },

  deleteElement: (id) => {
    const { design, history, selectedId } = get();
    const updated = {
      ...design,
      elements: design.elements.filter((el) => el.id !== id),
      updatedAt: new Date().toISOString()
    };
    set({
      design: updated,
      selectedId: selectedId === id ? null : selectedId,
      history: {
        past: [...history.past, history.present],
        present: updated,
        future: []
      }
    });
  },

  undo: () => {
    const { history } = get();
    if (history.past.length === 0) return;
    const previous = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, history.past.length - 1);
    set({
      design: previous,
      selectedId: null,
      history: {
        past: newPast,
        present: previous,
        future: [history.present, ...history.future]
      }
    });
  },

  redo: () => {
    const { history } = get();
    if (history.future.length === 0) return;
    const next = history.future[0];
    const newFuture = history.future.slice(1);
    set({
      design: next,
      selectedId: null,
      history: {
        past: [...history.past, history.present],
        present: next,
        future: newFuture
      }
    });
  }
}));

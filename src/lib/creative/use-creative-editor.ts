/**
 * ARCHITECTURE:
 * Zustand State Store for SmartSapp Creative Studio 2.0 (Phase 2 - Professional Canvas Editor)
 * 
 * Manages active CreativeProject, CreativeDocument, and CreativeElements with
 * multi-element selection, hierarchical grouping, batch alignment/distribution,
 * transient pointer drag transforms, and bounded 50-item undo/redo history.
 * 
 * CAUTION:
 * - History stack is strictly capped at 50 snapshots to prevent memory leaks.
 * - Pointer drag operations must pass `commitToHistory = false`.
 * - 0% any/any[] strictly enforced.
 * 
 * TESTABILITY:
 * Verified via unit tests in src/lib/creative/__tests__/use-creative-editor-phase2.test.ts
 */

import { create } from 'zustand';
import type {
  CreativeProject,
  CreativeDocument,
  CreativeElement,
  GradientConfig,
  AlignmentType,
  DistributionType,
} from './creative-types';
import { FORMAT_PRESETS, makeUniqueId } from './creative-types';
import { calculateAlignment, calculateDistribution } from './smart-guides';

export interface CreativeHistoryState {
  past: CreativeDocument[];
  present: CreativeDocument;
  future: CreativeDocument[];
}

export interface CreativeEditorStore {
  project: CreativeProject | null;
  document: CreativeDocument;
  selectedIds: string[];
  selectedId: string | null; // Backward-compatible single selection helper
  history: CreativeHistoryState;
  isDirty: boolean;
  isSaving: boolean;

  // Initialization & Selection Actions
  initialize: (project: CreativeProject, document: CreativeDocument) => void;
  selectElement: (id: string | null, multi?: boolean) => void;
  selectMultiple: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // Element CRUD
  addElement: (element: CreativeElement) => void;
  updateElement: (id: string, patch: Partial<CreativeElement>, commitToHistory?: boolean) => void;
  updateElementsBatch: (
    patches: { id: string; patch: Partial<CreativeElement> }[],
    commitToHistory?: boolean
  ) => void;
  deleteElement: (id: string) => void;
  deleteSelected: () => void;
  duplicateElement: (id: string) => void;
  duplicateSelected: () => void;
  reorderElement: (id: string, direction: 'up' | 'down' | 'front' | 'back') => void;
  moveElementToPosition: (id: string, newIndex: number) => void;

  // Grouping Operations
  groupSelected: () => string | null;
  ungroupSelected: () => void;
  toggleGroupLock: (groupId: string) => void;
  toggleGroupVisibility: (groupId: string) => void;

  // Alignment & Distribution
  alignSelected: (alignment: AlignmentType) => void;
  distributeSelected: (axis: DistributionType) => void;
  nudgeSelected: (dx: number, dy: number, commitToHistory?: boolean) => void;

  // Canvas Properties & History
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
  selectedIds: [],
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
      selectedIds: [],
      selectedId: null,
      history: {
        past: [],
        present: document,
        future: [],
      },
      isDirty: false,
    });
  },

  selectElement: (id: string | null, multi = false) => {
    if (!id) {
      set({ selectedIds: [], selectedId: null });
      return;
    }

    const { selectedIds, document } = get();
    const target = document.elements.find((el) => el.id === id);

    // If part of a group and not multi-selecting, select entire group
    if (target?.groupId && !multi) {
      const groupElements = document.elements.filter((el) => el.groupId === target.groupId);
      const ids = groupElements.map((el) => el.id);
      set({ selectedIds: ids, selectedId: ids[0] ?? null });
      return;
    }

    if (multi) {
      const nextIds = selectedIds.includes(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id];
      set({ selectedIds: nextIds, selectedId: nextIds[0] ?? null });
    } else {
      set({ selectedIds: [id], selectedId: id });
    }
  },

  selectMultiple: (ids: string[]) => {
    set({ selectedIds: ids, selectedId: ids[0] ?? null });
  },

  selectAll: () => {
    const { document } = get();
    const ids = document.elements.map((el) => el.id);
    set({ selectedIds: ids, selectedId: ids[0] ?? null });
  },

  clearSelection: () => {
    set({ selectedIds: [], selectedId: null });
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
      selectedIds: [element.id],
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
      set({ document: newDoc, isDirty: true });
    }
  },

  updateElementsBatch: (
    patches: { id: string; patch: Partial<CreativeElement> }[],
    commitToHistory = true
  ) => {
    const { document, history } = get();
    const patchMap = new Map(patches.map((p) => [p.id, p.patch]));

    const newElements = document.elements.map((el) => {
      const patch = patchMap.get(el.id);
      return patch ? { ...el, ...patch } : el;
    });

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
      set({ document: newDoc, isDirty: true });
    }
  },

  deleteElement: (id: string) => {
    const { document, history, selectedIds } = get();
    const newElements = document.elements.filter((el) => el.id !== id);
    const remainingIds = selectedIds.filter((item) => item !== id);
    const newDoc: CreativeDocument = {
      ...document,
      elements: newElements,
      updatedAt: new Date().toISOString(),
    };

    set({
      document: newDoc,
      selectedIds: remainingIds,
      selectedId: remainingIds[0] ?? null,
      isDirty: true,
      history: {
        past: [...history.past, history.present].slice(-50),
        present: newDoc,
        future: [],
      },
    });
  },

  deleteSelected: () => {
    const { document, history, selectedIds } = get();
    if (selectedIds.length === 0) return;

    const selectedSet = new Set(selectedIds);
    const newElements = document.elements.filter((el) => !selectedSet.has(el.id));

    const newDoc: CreativeDocument = {
      ...document,
      elements: newElements,
      updatedAt: new Date().toISOString(),
    };

    set({
      document: newDoc,
      selectedIds: [],
      selectedId: null,
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
      selectedIds: [duplicated.id],
      selectedId: duplicated.id,
      isDirty: true,
      history: {
        past: [...history.past, history.present].slice(-50),
        present: newDoc,
        future: [],
      },
    });
  },

  duplicateSelected: () => {
    const { document, history, selectedIds } = get();
    if (selectedIds.length === 0) return;

    const selectedSet = new Set(selectedIds);
    const targets = document.elements.filter((el) => selectedSet.has(el.id));
    if (targets.length === 0) return;

    const newDuplicates: CreativeElement[] = targets.map((target, idx) => ({
      ...target,
      id: makeUniqueId(),
      x: Math.min(target.x + 3, 90),
      y: Math.min(target.y + 3, 90),
      zIndex: document.elements.length + 1 + idx,
    }));

    const newDoc: CreativeDocument = {
      ...document,
      elements: [...document.elements, ...newDuplicates],
      updatedAt: new Date().toISOString(),
    };

    const dupIds = newDuplicates.map((d) => d.id);
    set({
      document: newDoc,
      selectedIds: dupIds,
      selectedId: dupIds[0] ?? null,
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

  moveElementToPosition: (id: string, newIndex: number) => {
    const { document, history } = get();
    const currentIndex = document.elements.findIndex((el) => el.id === id);
    if (currentIndex === -1 || newIndex < 0 || newIndex >= document.elements.length) return;

    const elements = [...document.elements];
    const [target] = elements.splice(currentIndex, 1);
    elements.splice(newIndex, 0, target);

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

  groupSelected: () => {
    const { document, history, selectedIds } = get();
    if (selectedIds.length < 2) return null;

    const newGroupId = `group-${makeUniqueId()}`;
    const selectedSet = new Set(selectedIds);

    const newElements = document.elements.map((el) =>
      selectedSet.has(el.id) ? { ...el, groupId: newGroupId } : el
    );

    const newDoc: CreativeDocument = {
      ...document,
      elements: newElements,
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

    return newGroupId;
  },

  ungroupSelected: () => {
    const { document, history, selectedIds } = get();
    if (selectedIds.length === 0) return;

    const selectedSet = new Set(selectedIds);
    const newElements = document.elements.map((el) =>
      selectedSet.has(el.id) ? { ...el, groupId: undefined } : el
    );

    const newDoc: CreativeDocument = {
      ...document,
      elements: newElements,
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

  toggleGroupLock: (groupId: string) => {
    const { document, history } = get();
    const groupElements = document.elements.filter((el) => el.groupId === groupId);
    if (groupElements.length === 0) return;

    const anyUnlocked = groupElements.some((el) => !el.isLocked);
    const newElements = document.elements.map((el) =>
      el.groupId === groupId ? { ...el, isLocked: anyUnlocked } : el
    );

    const newDoc: CreativeDocument = {
      ...document,
      elements: newElements,
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

  toggleGroupVisibility: (groupId: string) => {
    const { document, history } = get();
    const groupElements = document.elements.filter((el) => el.groupId === groupId);
    if (groupElements.length === 0) return;

    const anyVisible = groupElements.some((el) => !el.isHidden);
    const newElements = document.elements.map((el) =>
      el.groupId === groupId ? { ...el, isHidden: anyVisible } : el
    );

    const newDoc: CreativeDocument = {
      ...document,
      elements: newElements,
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

  alignSelected: (alignment: AlignmentType) => {
    const { document, selectedIds, updateElementsBatch } = get();
    if (selectedIds.length < 2) return;

    const selectedSet = new Set(selectedIds);
    const selectedElements = document.elements.filter((el) => selectedSet.has(el.id));
    const patches = calculateAlignment(selectedElements, alignment);

    updateElementsBatch(patches, true);
  },

  distributeSelected: (axis: DistributionType) => {
    const { document, selectedIds, updateElementsBatch } = get();
    if (selectedIds.length < 3) return;

    const selectedSet = new Set(selectedIds);
    const selectedElements = document.elements.filter((el) => selectedSet.has(el.id));
    const patches = calculateDistribution(selectedElements, axis);

    updateElementsBatch(patches, true);
  },

  nudgeSelected: (dx: number, dy: number, commitToHistory = true) => {
    const { document, selectedIds, updateElementsBatch } = get();
    if (selectedIds.length === 0) return;

    const selectedSet = new Set(selectedIds);
    const patches = document.elements
      .filter((el) => selectedSet.has(el.id))
      .map((el) => ({
        id: el.id,
        patch: {
          x: Math.max(0, Math.min(100 - el.width, Number((el.x + dx).toFixed(2)))),
          y: Math.max(0, Math.min(100 - el.height, Number((el.y + dy).toFixed(2)))),
        },
      }));

    updateElementsBatch(patches, commitToHistory);
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

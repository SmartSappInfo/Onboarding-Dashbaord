'use client';

import { useReducer, useCallback, useEffect } from 'react';
import type {
    CampaignPage,
    CampaignPageVersion,
    CampaignPageStructure,
    PageSection,
    PageBlockType,
    PageTrigger,
    PageTriggerAction
} from '@/lib/types';
import * as tree from '@/lib/page-builder/tree-operations';

// ─── History Stack for Undo/Redo ─────────────────────────────────────────
const MAX_HISTORY = 50;

interface HistoryState {
    past: CampaignPageStructure[];
    present: CampaignPageStructure;
    future: CampaignPageStructure[];
}

function pushHistory(history: HistoryState, next: CampaignPageStructure): HistoryState {
    return {
        past: [...history.past.slice(-MAX_HISTORY), history.present],
        present: next,
        future: [],
    };
}// ─── Builder State ───────────────────────────────────────────────────────
interface BuilderState {
    page: CampaignPage | null;
    version: CampaignPageVersion | null;
    history: HistoryState | null;
    selectedBlockId: string | null;
    selectedSectionId: string | null;
    selectedColumnIndex: number | null;
    viewport: 'desktop' | 'tablet' | 'mobile';
    activeTab: BuilderTab;
    saving: boolean;
    publishing: boolean;
    loading: boolean;
    isRestoring: boolean;
    variantPickerType: PageBlockType | null;
    canvasMode: 'edit' | 'preview';
    editMode: 'columns' | 'components';
}

export type BuilderTab = 'add' | 'layers' | 'variables' | 'edit' | 'settings' | 'triggers' | 'theme' | 'library' | 'history' | 'ai';

type BuilderAction =
    | { type: 'SET_PAGE'; payload: CampaignPage }
    | { type: 'SET_VERSION'; payload: CampaignPageVersion }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_SAVING'; payload: boolean }
    | { type: 'SET_PUBLISHING'; payload: boolean }
    | { type: 'SET_RESTORING'; payload: boolean }
    | { type: 'SET_VIEWPORT'; payload: 'desktop' | 'tablet' | 'mobile' }
    | { type: 'SET_TAB'; payload: BuilderTab }
    | { type: 'SELECT_BLOCK'; payload: string | null }
    | { type: 'SELECT_SECTION'; payload: string | null; columnIndex?: number | null }
    | { type: 'UPDATE_STRUCTURE'; payload: CampaignPageStructure }
    | { type: 'UPDATE_PAGE_SETTINGS'; payload: Partial<CampaignPage['settings']> }
    | { type: 'UPDATE_PAGE_SEO'; payload: Partial<CampaignPage['seo']> }
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'RESTORE_VERSION'; payload: CampaignPageVersion }
    | { type: 'OPEN_VARIANT_PICKER'; payload: PageBlockType }
    | { type: 'CLOSE_VARIANT_PICKER' }
    | { type: 'SET_CANVAS_MODE'; payload: 'edit' | 'preview' }
    | { type: 'SET_EDIT_MODE'; payload: 'columns' | 'components' };

function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
    switch (action.type) {
        case 'SET_PAGE':
            return { ...state, page: action.payload };
        case 'SET_VERSION': {
            const structure = action.payload.structureJson;
            return {
                ...state,
                version: action.payload,
                history: { past: [], present: structure, future: [] },
            };
        }
        case 'SET_LOADING':
            return { ...state, loading: action.payload };
        case 'SET_SAVING':
            return { ...state, saving: action.payload };
        case 'SET_PUBLISHING':
            return { ...state, publishing: action.payload };
        case 'SET_RESTORING':
            return { ...state, isRestoring: action.payload };
        case 'SET_VIEWPORT':
            return { ...state, viewport: action.payload };
        case 'SET_TAB':
            return { ...state, activeTab: action.payload };
        case 'SELECT_BLOCK':
            return {
                ...state,
                selectedBlockId: action.payload,
                selectedSectionId: action.payload ? null : state.selectedSectionId,
                selectedColumnIndex: action.payload ? null : state.selectedColumnIndex
            };
        case 'SELECT_SECTION':
            return {
                ...state,
                selectedSectionId: action.payload,
                selectedBlockId: action.payload ? null : state.selectedBlockId,
                selectedColumnIndex: action.payload ? (action.columnIndex ?? 0) : null
            };

        case 'UPDATE_STRUCTURE': {
            if (!state.version || !state.history) return state;
            const newHistory = pushHistory(state.history, action.payload);
            return {
                ...state,
                version: { ...state.version, structureJson: action.payload },
                history: newHistory,
            };
        }

        case 'UPDATE_PAGE_SETTINGS': {
            if (!state.page) return state;
            return {
                ...state,
                page: { ...state.page, settings: { ...state.page.settings, ...action.payload } },
            };
        }

        case 'UPDATE_PAGE_SEO': {
            if (!state.page) return state;
            return {
                ...state,
                page: { ...state.page, seo: { ...state.page.seo, ...action.payload } },
            };
        }

        case 'UNDO': {
            if (!state.history || state.history.past.length === 0 || !state.version) return state;
            const previous = state.history.past[state.history.past.length - 1];
            const newPast = state.history.past.slice(0, -1);
            return {
                ...state,
                version: { ...state.version, structureJson: previous },
                history: {
                    past: newPast,
                    present: previous,
                    future: [state.history.present, ...state.history.future],
                },
            };
        }

        case 'REDO': {
            if (!state.history || state.history.future.length === 0 || !state.version) return state;
            const next = state.history.future[0];
            const newFuture = state.history.future.slice(1);
            return {
                ...state,
                version: { ...state.version, structureJson: next },
                history: {
                    past: [...state.history.past, state.history.present],
                    present: next,
                    future: newFuture,
                },
            };
        }

        case 'RESTORE_VERSION': {
            if (!state.version || !state.history) return state;
            const restored = action.payload.structureJson;
            const newHistory = pushHistory(state.history, restored);
            return {
                ...state,
                version: { ...state.version, structureJson: restored },
                history: newHistory,
                activeTab: 'edit' as BuilderTab,
            };
        }

        case 'OPEN_VARIANT_PICKER':
            return { ...state, variantPickerType: action.payload };

        case 'CLOSE_VARIANT_PICKER':
            return { ...state, variantPickerType: null };

        case 'SET_CANVAS_MODE':
            return { ...state, canvasMode: action.payload };

        case 'SET_EDIT_MODE':
            return { ...state, editMode: action.payload };

        default:
            return state;
    }
}

const initialState: BuilderState = {
    page: null,
    version: null,
    history: null,
    selectedBlockId: null,
    selectedSectionId: null,
    selectedColumnIndex: null,
    viewport: 'desktop',
    activeTab: 'add',
    saving: false,
    publishing: false,
    loading: true,
    isRestoring: false,
    variantPickerType: null,
    canvasMode: 'edit',
    editMode: 'components',
};

// ─── Hook ────────────────────────────────────────────────────────────────
export function useBuilderState() {
    const [state, dispatch] = useReducer(builderReducer, initialState);

    // ─── Keyboard Shortcuts (Undo/Redo, Escape, Delete, Duplicate) ───
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const activeTag = document.activeElement?.tagName.toLowerCase();
            const isEditing = activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.hasAttribute('contenteditable');
            if (isEditing) return;

            // Undo & Redo
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    dispatch({ type: 'REDO' });
                } else {
                    dispatch({ type: 'UNDO' });
                }
            }
            // Delete or Backspace
            if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedBlockId) {
                e.preventDefault();
                const current = state.version?.structureJson;
                if (current) {
                    dispatch({ type: 'UPDATE_STRUCTURE', payload: tree.removeBlock(current, state.selectedBlockId) });
                    dispatch({ type: 'SELECT_BLOCK', payload: null });
                }
            }
            // Escape (Deselect)
            if (e.key === 'Escape') {
                e.preventDefault();
                dispatch({ type: 'SELECT_BLOCK', payload: null });
            }
            // Duplicate (Ctrl+D / Cmd+D)
            if ((e.metaKey || e.ctrlKey) && e.key === 'd' && state.selectedBlockId) {
                e.preventDefault();
                const current = state.version?.structureJson;
                if (current) {
                    dispatch({ type: 'UPDATE_STRUCTURE', payload: tree.duplicateBlock(current, state.selectedBlockId) });
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [state.selectedBlockId, state.version?.structureJson]);

    // ─── Structure Helpers ───────────────────────────────────────────
    const getStructure = useCallback((): CampaignPageStructure | null => {
        return state.version?.structureJson ?? null;
    }, [state.version]);

    const updateStructure = useCallback((updater: (prev: CampaignPageStructure) => CampaignPageStructure) => {
        const current = state.version?.structureJson;
        if (!current) return;
        dispatch({ type: 'UPDATE_STRUCTURE', payload: updater(current) });
    }, [state.version]);

    // ─── Section Operations (delegate to pure tree-operations) ───────
    const addSection = useCallback((template?: { structure: PageSection }) => {
        updateStructure(s => tree.addSection(s, template));
    }, [updateStructure]);

    const insertSection = useCallback((index: number, template?: { structure: PageSection }) => {
        updateStructure(s => tree.insertSection(s, index, template));
    }, [updateStructure]);
    const removeSection = useCallback((sectionId: string) => {
        updateStructure(s => tree.removeSection(s, sectionId));
    }, [updateStructure]);

    const moveSection = useCallback((sectionId: string, direction: 'up' | 'down') => {
        updateStructure(s => tree.moveSection(s, sectionId, direction));
    }, [updateStructure]);

    const updateSectionProps = useCallback((sectionId: string, newProps: Record<string, unknown>) => {
        updateStructure(s => tree.updateSectionProps(s, sectionId, newProps));
    }, [updateStructure]);

    const reorderSections = useCallback((fromIndex: number, toIndex: number) => {
        updateStructure(s => tree.reorderSections(s, fromIndex, toIndex));
    }, [updateStructure]);

    // ─── Block Operations (delegate to pure tree-operations) ─────────
    const addBlock = useCallback((type: PageBlockType, sectionIndex?: number, overrideDefaults?: Record<string, unknown>) => {
        const block = tree.createBlock(type, overrideDefaults);
        
        updateStructure(structure => {
            const sections = [...structure.sections];
            if (sections.length === 0) {
                return {
                    ...structure,
                    sections: [{ id: `sec-${Date.now()}`, type: 'section', props: {}, blocks: [block] }]
                };
            }

            // 1. Check if there is an active block
            if (state.selectedBlockId) {
                let targetSecIdx = -1;
                let targetBlockIdx = -1;
                let activeBlockCol = 0;

                for (let sI = 0; sI < sections.length; sI++) {
                    const bI = sections[sI].blocks.findIndex(b => b.id === state.selectedBlockId);
                    if (bI !== -1) {
                        targetSecIdx = sI;
                        targetBlockIdx = bI;
                        activeBlockCol = (sections[sI].blocks[bI].props as { column?: number })?.column ?? 0;
                        break;
                    }
                }

                if (targetSecIdx !== -1 && targetBlockIdx !== -1) {
                    block.props = {
                        ...(block.props || {}),
                        column: activeBlockCol
                    };

                    const newBlocks = [...sections[targetSecIdx].blocks];
                    newBlocks.splice(targetBlockIdx + 1, 0, block);

                    sections[targetSecIdx] = {
                        ...sections[targetSecIdx],
                        blocks: newBlocks
                    };

                    return { ...structure, sections };
                }
            }

            // 2. If no active block, check if there is an active section
            if (state.selectedSectionId) {
                const targetSecIdx = sections.findIndex(s => s.id === state.selectedSectionId);
                if (targetSecIdx !== -1) {
                    const activeCol = state.selectedColumnIndex ?? 0;
                    block.props = {
                        ...(block.props || {}),
                        column: activeCol
                    };

                    sections[targetSecIdx] = {
                        ...sections[targetSecIdx],
                        blocks: [...sections[targetSecIdx].blocks, block]
                    };

                    return { ...structure, sections };
                }
            }

            // 3. Fallback: If sectionIndex is provided, append to that section. Otherwise, append to the first section.
            const fallbackSecIdx = sectionIndex !== undefined
                ? Math.min(Math.max(sectionIndex, 0), sections.length - 1)
                : 0;

            const fallbackCol = state.selectedColumnIndex ?? 0;
            block.props = {
                ...(block.props || {}),
                column: fallbackCol
            };

            sections[fallbackSecIdx] = {
                ...sections[fallbackSecIdx],
                blocks: [...sections[fallbackSecIdx].blocks, block]
            };

            return { ...structure, sections };
        });

        dispatch({ type: 'SELECT_BLOCK', payload: block.id });
        dispatch({ type: 'SET_TAB', payload: 'edit' });
        dispatch({ type: 'CLOSE_VARIANT_PICKER' });
    }, [updateStructure, state.selectedBlockId, state.selectedSectionId, state.selectedColumnIndex]);

    const removeBlock = useCallback((blockId: string) => {
        updateStructure(s => tree.removeBlock(s, blockId));
        if (state.selectedBlockId === blockId) {
            dispatch({ type: 'SELECT_BLOCK', payload: null });
        }
    }, [updateStructure, state.selectedBlockId]);

    const updateBlockProps = useCallback((blockId: string, newProps: Record<string, unknown>) => {
        updateStructure(s => tree.updateBlockProps(s, blockId, newProps));
    }, [updateStructure]);

    const moveBlock = useCallback((blockId: string, direction: 'up' | 'down') => {
        updateStructure(s => tree.moveBlock(s, blockId, direction));
    }, [updateStructure]);

    const reorderBlocks = useCallback((sectionId: string, fromIndex: number, toIndex: number) => {
        updateStructure(s => tree.reorderBlocks(s, sectionId, fromIndex, toIndex));
    }, [updateStructure]);

    const moveBlockToSection = useCallback((blockId: string, fromSectionId: string, toSectionId: string, toIndex: number) => {
        updateStructure(s => tree.moveBlockToSection(s, blockId, fromSectionId, toSectionId, toIndex));
    }, [updateStructure]);

    const moveBlockToColumn = useCallback((blockId: string, targetSectionId: string, targetColumnIndex: number, targetIndex: number) => {
        updateStructure(s => tree.moveBlockToColumn(s, blockId, targetSectionId, targetColumnIndex, targetIndex));
    }, [updateStructure]);

    // ─── Block Finder ────────────────────────────────────────────────
    const findBlock = useCallback((blockId: string) => {
        if (!state.version) return null;
        return tree.findBlock(state.version.structureJson, blockId);
    }, [state.version]);

    // ─── Block Duplication ───────────────────────────────────────────
    const duplicateBlock = useCallback((blockId: string) => {
        updateStructure(s => tree.duplicateBlock(s, blockId));
    }, [updateStructure]);

    // ─── Column Operations ───────────────────────────────────────────
    const swapColumns = useCallback((sectionId: string, fromColumnIndex: number, toColumnIndex: number) => {
        updateStructure(s => tree.swapColumns(s, sectionId, fromColumnIndex, toColumnIndex));
    }, [updateStructure]);

    // ─── Trigger Operations ──────────────────────────────────────────
    const addTrigger = useCallback(() => {
        if (!state.page) return;
        const newTrigger: PageTrigger = {
            id: `trig_${Date.now()}`,
            name: `Trigger ${(state.page.settings.triggers?.length || 0) + 1}`,
            event: 'page_load',
            actions: [{
                id: `act_${Date.now()}`,
                type: 'open_modal',
                config: {}
            }]
        };
        const triggers = [...(state.page.settings.triggers || []), newTrigger];
        dispatch({ type: 'UPDATE_PAGE_SETTINGS', payload: { triggers } });
    }, [state.page]);

    const updateTrigger = useCallback((id: string, updates: Partial<PageTrigger>) => {
        if (!state.page?.settings.triggers) return;
        const triggers = state.page.settings.triggers.map(t => t.id === id ? { ...t, ...updates } : t);
        dispatch({ type: 'UPDATE_PAGE_SETTINGS', payload: { triggers } });
    }, [state.page]);

    const removeTrigger = useCallback((id: string) => {
        if (!state.page?.settings.triggers) return;
        const triggers = state.page.settings.triggers.filter(t => t.id !== id);
        dispatch({ type: 'UPDATE_PAGE_SETTINGS', payload: { triggers } });
    }, [state.page]);

    const addActionToTrigger = useCallback((triggerId: string) => {
        if (!state.page?.settings.triggers) return;
        const triggers = state.page.settings.triggers.map(t => {
            if (t.id !== triggerId) return t;
            return { ...t, actions: [...t.actions, { id: `act_${Date.now()}`, type: 'open_modal' as const, config: {} }] };
        });
        dispatch({ type: 'UPDATE_PAGE_SETTINGS', payload: { triggers } });
    }, [state.page]);

    const updateAction = useCallback((triggerId: string, actionId: string, updates: Partial<PageTriggerAction>) => {
        if (!state.page?.settings.triggers) return;
        const triggers = state.page.settings.triggers.map(t => {
            if (t.id !== triggerId) return t;
            return { ...t, actions: t.actions.map(a => a.id === actionId ? { ...a, ...updates } : a) };
        });
        dispatch({ type: 'UPDATE_PAGE_SETTINGS', payload: { triggers } });
    }, [state.page]);

    const removeAction = useCallback((triggerId: string, actionId: string) => {
        if (!state.page?.settings.triggers) return;
        const triggers = state.page.settings.triggers.map(t => {
            if (t.id !== triggerId) return t;
            return { ...t, actions: t.actions.filter(a => a.id !== actionId) };
        });
        dispatch({ type: 'UPDATE_PAGE_SETTINGS', payload: { triggers } });
    }, [state.page]);

    // ─── Derived State ───────────────────────────────────────────────
    const canUndo = (state.history?.past.length ?? 0) > 0;
    const canRedo = (state.history?.future.length ?? 0) > 0;

    return {
        // State
        ...state,
        canUndo,
        canRedo,

        // Dispatch
        dispatch,

        // Structure
        getStructure,
        updateStructure,

        // Sections
        addSection,
        insertSection,
        removeSection,
        moveSection,
        updateSectionProps,
        reorderSections,

        // Blocks
        addBlock,
        removeBlock,
        updateBlockProps,
        moveBlock,
        reorderBlocks,
        moveBlockToSection,
        moveBlockToColumn,
        findBlock,
        duplicateBlock,
        swapColumns,

        // Triggers
        addTrigger,
        updateTrigger,
        removeTrigger,
        addActionToTrigger,
        updateAction,
        removeAction,

        // Canvas Mode
        setCanvasMode: (mode: 'edit' | 'preview') => dispatch({ type: 'SET_CANVAS_MODE', payload: mode }),

        // Edit Mode
        setEditMode: (mode: 'columns' | 'components') => dispatch({ type: 'SET_EDIT_MODE', payload: mode }),

        // Undo/Redo
        undo: () => dispatch({ type: 'UNDO' }),
        redo: () => dispatch({ type: 'REDO' }),
    };
}

export type BuilderStateReturn = ReturnType<typeof useBuilderState>;

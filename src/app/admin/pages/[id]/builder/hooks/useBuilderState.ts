'use client';

import { useReducer, useCallback, useEffect } from 'react';
import type { 
    CampaignPage, 
    CampaignPageVersion, 
    CampaignPageStructure, 
    PageSection, 
    PageBlock, 
    PageBlockType,
    PageTrigger,
    PageTriggerAction
} from '@/lib/types';

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
}

// ─── Builder State ───────────────────────────────────────────────────────
interface BuilderState {
    page: CampaignPage | null;
    version: CampaignPageVersion | null;
    history: HistoryState | null;
    selectedBlockId: string | null;
    selectedSectionId: string | null;
    viewport: 'desktop' | 'mobile';
    activeTab: BuilderTab;
    saving: boolean;
    publishing: boolean;
    loading: boolean;
    isRestoring: boolean;
}

export type BuilderTab = 'add' | 'edit' | 'settings' | 'triggers' | 'theme' | 'library' | 'history';

type BuilderAction =
    | { type: 'SET_PAGE'; payload: CampaignPage }
    | { type: 'SET_VERSION'; payload: CampaignPageVersion }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_SAVING'; payload: boolean }
    | { type: 'SET_PUBLISHING'; payload: boolean }
    | { type: 'SET_RESTORING'; payload: boolean }
    | { type: 'SET_VIEWPORT'; payload: 'desktop' | 'mobile' }
    | { type: 'SET_TAB'; payload: BuilderTab }
    | { type: 'SELECT_BLOCK'; payload: string | null }
    | { type: 'SELECT_SECTION'; payload: string | null }
    | { type: 'UPDATE_STRUCTURE'; payload: CampaignPageStructure }
    | { type: 'UPDATE_PAGE_SETTINGS'; payload: Partial<CampaignPage['settings']> }
    | { type: 'UPDATE_PAGE_SEO'; payload: Partial<CampaignPage['seo']> }
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'RESTORE_VERSION'; payload: CampaignPageVersion };

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
            return { ...state, selectedBlockId: action.payload };
        case 'SELECT_SECTION':
            return { ...state, selectedSectionId: action.payload };

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
    viewport: 'desktop',
    activeTab: 'add',
    saving: false,
    publishing: false,
    loading: true,
    isRestoring: false,
};

// ─── Hook ────────────────────────────────────────────────────────────────
export function useBuilderState() {
    const [state, dispatch] = useReducer(builderReducer, initialState);

    // ─── Keyboard Shortcuts (Undo/Redo) ──────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    dispatch({ type: 'REDO' });
                } else {
                    dispatch({ type: 'UNDO' });
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // ─── Structure Helpers ───────────────────────────────────────────
    const getStructure = useCallback((): CampaignPageStructure | null => {
        return state.version?.structureJson ?? null;
    }, [state.version]);

    const updateStructure = useCallback((updater: (prev: CampaignPageStructure) => CampaignPageStructure) => {
        const current = state.version?.structureJson;
        if (!current) return;
        dispatch({ type: 'UPDATE_STRUCTURE', payload: updater(current) });
    }, [state.version]);

    // ─── Section Operations ──────────────────────────────────────────
    const addSection = useCallback((template?: { structure: PageSection }) => {
        updateStructure(s => {
            const newSection: PageSection = template ? {
                ...template.structure,
                id: `sec_${Date.now()}`
            } : {
                id: `sec_${Date.now()}`,
                type: 'section',
                props: { background: 'default' },
                blocks: []
            };
            return { ...s, sections: [...s.sections, newSection] };
        });
    }, [updateStructure]);

    const removeSection = useCallback((sectionId: string) => {
        updateStructure(s => ({
            ...s,
            sections: s.sections.filter(sec => sec.id !== sectionId)
        }));
    }, [updateStructure]);

    const moveSection = useCallback((sectionId: string, direction: 'up' | 'down') => {
        updateStructure(s => {
            const sections = [...s.sections];
            const index = sections.findIndex(sec => sec.id === sectionId);
            if (index === -1) return s;
            if (direction === 'up' && index === 0) return s;
            if (direction === 'down' && index === sections.length - 1) return s;
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];
            return { ...s, sections };
        });
    }, [updateStructure]);

    const updateSectionProps = useCallback((sectionId: string, newProps: Record<string, any>) => {
        updateStructure(s => ({
            ...s,
            sections: s.sections.map(sec =>
                sec.id === sectionId ? { ...sec, props: { ...sec.props, ...newProps } } : sec
            )
        }));
    }, [updateStructure]);

    const reorderSections = useCallback((fromIndex: number, toIndex: number) => {
        updateStructure(s => {
            const sections = [...s.sections];
            const [moved] = sections.splice(fromIndex, 1);
            sections.splice(toIndex, 0, moved);
            return { ...s, sections };
        });
    }, [updateStructure]);

    // ─── Block Operations ────────────────────────────────────────────
    const addBlock = useCallback((type: PageBlockType, sectionIndex?: number) => {
        const defaultProps: Record<string, Record<string, any>> = {
            hero: { title: 'New Hero', subtitle: 'Describe your campaign here.' },
            text: { content: '<p>Start writing your content here...</p>' },
            cta: { label: 'Click Here', url: '', variant: 'primary' },
            image: { src: '', alt: '', caption: '' },
            video: { url: '', provider: 'youtube' },
            spacer: { height: 48 },
            divider: { style: 'solid', color: '#e2e8f0' },
            faq: { items: [] },
            testimonial: { author: '', role: '', quote: '', avatarUrl: '' },
            stats: { items: [] },
            logo_grid: { logos: [] },
        };

        const newBlock: PageBlock = {
            id: `${type}_${Date.now()}`,
            type,
            props: defaultProps[type] || {}
        };

        updateStructure(s => {
            const sections = [...s.sections];
            if (sections.length === 0) {
                sections.push({
                    id: `sec_${Date.now()}`,
                    type: 'section',
                    props: { background: 'default' },
                    blocks: [newBlock]
                });
            } else {
                const targetIdx = sectionIndex ?? 0;
                const idx = Math.min(targetIdx, sections.length - 1);
                sections[idx] = {
                    ...sections[idx],
                    blocks: [...sections[idx].blocks, newBlock]
                };
            }
            return { ...s, sections };
        });

        dispatch({ type: 'SELECT_BLOCK', payload: newBlock.id });
        dispatch({ type: 'SET_TAB', payload: 'edit' });
    }, [updateStructure]);

    const removeBlock = useCallback((blockId: string) => {
        updateStructure(s => ({
            ...s,
            sections: s.sections.map(sec => ({
                ...sec,
                blocks: sec.blocks.filter(b => b.id !== blockId)
            }))
        }));
        if (state.selectedBlockId === blockId) {
            dispatch({ type: 'SELECT_BLOCK', payload: null });
        }
    }, [updateStructure, state.selectedBlockId]);

    const updateBlockProps = useCallback((blockId: string, newProps: Record<string, any>) => {
        updateStructure(s => ({
            ...s,
            sections: s.sections.map(sec => ({
                ...sec,
                blocks: sec.blocks.map(b =>
                    b.id === blockId ? { ...b, props: { ...b.props, ...newProps } } : b
                )
            }))
        }));
    }, [updateStructure]);

    const moveBlock = useCallback((blockId: string, direction: 'up' | 'down') => {
        updateStructure(s => ({
            ...s,
            sections: s.sections.map(sec => {
                const blocks = [...sec.blocks];
                const index = blocks.findIndex(b => b.id === blockId);
                if (index === -1) return sec;
                if (direction === 'up' && index === 0) return sec;
                if (direction === 'down' && index === blocks.length - 1) return sec;
                const newIndex = direction === 'up' ? index - 1 : index + 1;
                [blocks[index], blocks[newIndex]] = [blocks[newIndex], blocks[index]];
                return { ...sec, blocks };
            })
        }));
    }, [updateStructure]);

    const reorderBlocks = useCallback((sectionId: string, fromIndex: number, toIndex: number) => {
        updateStructure(s => ({
            ...s,
            sections: s.sections.map(sec => {
                if (sec.id !== sectionId) return sec;
                const blocks = [...sec.blocks];
                const [moved] = blocks.splice(fromIndex, 1);
                blocks.splice(toIndex, 0, moved);
                return { ...sec, blocks };
            })
        }));
    }, [updateStructure]);

    const moveBlockToSection = useCallback((blockId: string, fromSectionId: string, toSectionId: string, toIndex: number) => {
        updateStructure(s => {
            let movedBlock: PageBlock | null = null;
            const sections = s.sections.map(sec => {
                if (sec.id === fromSectionId) {
                    const block = sec.blocks.find(b => b.id === blockId);
                    if (block) movedBlock = block;
                    return { ...sec, blocks: sec.blocks.filter(b => b.id !== blockId) };
                }
                return sec;
            });
            if (!movedBlock) return s;
            return {
                ...s,
                sections: sections.map(sec => {
                    if (sec.id === toSectionId) {
                        const blocks = [...sec.blocks];
                        blocks.splice(toIndex, 0, movedBlock!);
                        return { ...sec, blocks };
                    }
                    return sec;
                })
            };
        });
    }, [updateStructure]);

    // ─── Block Finder ────────────────────────────────────────────────
    const findBlock = useCallback((blockId: string) => {
        if (!state.version) return null;
        for (const section of state.version.structureJson.sections) {
            const block = section.blocks.find(b => b.id === blockId);
            if (block) return { block, section };
        }
        return null;
    }, [state.version]);

    // ─── Block Duplication ───────────────────────────────────────────
    const duplicateBlock = useCallback((blockId: string) => {
        updateStructure(s => ({
            ...s,
            sections: s.sections.map(sec => {
                const idx = sec.blocks.findIndex(b => b.id === blockId);
                if (idx === -1) return sec;
                const original = sec.blocks[idx];
                const clone: PageBlock = {
                    ...JSON.parse(JSON.stringify(original)),
                    id: `${original.type}_${Date.now()}`
                };
                const blocks = [...sec.blocks];
                blocks.splice(idx + 1, 0, clone);
                return { ...sec, blocks };
            })
        }));
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
        findBlock,
        duplicateBlock,

        // Triggers
        addTrigger,
        updateTrigger,
        removeTrigger,
        addActionToTrigger,
        updateAction,
        removeAction,

        // Undo/Redo
        undo: () => dispatch({ type: 'UNDO' }),
        redo: () => dispatch({ type: 'REDO' }),
    };
}

export type BuilderStateReturn = ReturnType<typeof useBuilderState>;

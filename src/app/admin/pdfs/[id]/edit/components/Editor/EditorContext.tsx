'use client';

import * as React from 'react';
import type { PDFForm, PDFFormField, School } from '@/lib/types';
import type { LocalPDFFormField, AlignmentType, DistributionType, MarqueeState, EditorViewMode } from './types';
import { calculateAlignment, calculateDistribution } from './utils/alignment';

export type SidebarTab = 'blocks' | 'tags' | 'properties';

interface EditorContextType {
  // State
  pdf: PDFForm;
  school?: School;
  fields: LocalPDFFormField[];
  selectedFieldIds: string[];
  zoom: number;
  numPages: number;
  activePageNumber: number;
  isSidebarCollapsed: boolean;
  sidebarTab: SidebarTab;
  isFullScreen: boolean;
  viewMode: EditorViewMode;
  namingFieldId: string | null;
  marquee: MarqueeState | null;
  isDetecting: boolean;
  isFieldDeleteConfirmOpen: boolean;
  
  // External settings managed by page but synced here for UI convenience
  password?: string;
  passwordProtected?: boolean;
  isStatusChanging?: boolean;
  isSaving?: boolean;
  
  // Actions
  setFields: React.Dispatch<React.SetStateAction<LocalPDFFormField[]>>;
  setSelectedFieldIds: React.Dispatch<React.SetStateAction<string[]>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setNumPages: React.Dispatch<React.SetStateAction<number>>;
  setActivePageNumber: React.Dispatch<React.SetStateAction<number>>;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setSidebarTab: React.Dispatch<React.SetStateAction<SidebarTab>>;
  setIsFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
  setViewMode: React.Dispatch<React.SetStateAction<EditorViewMode>>;
  setNamingFieldId: (id: string | null) => void;
  setMarquee: React.Dispatch<React.SetStateAction<MarqueeState | null>>;
  setIsFieldDeleteConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Callbacks
  onDetect: () => void;
  onStatusChange: (status: PDFForm['status']) => void;
  onSave: () => void;
  onPreview: () => void;
  setPassword: (val: string) => void;
  setPasswordProtected: (val: boolean) => void;
  
  // High-level Handlers
  addField: (type: LocalPDFFormField['type'], pageNumber?: number, position?: { x: number, y: number }) => void;
  updateField: (id: string, props: Partial<LocalPDFFormField>) => void;
  removeField: (id: string) => void;
  duplicateFields: (ids: string[]) => void;
  alignFields: (type: AlignmentType) => void;
  distributeFields: (type: DistributionType) => void;
  selectField: (id: string, multi?: boolean, toggle?: boolean) => void;
  
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const EditorContext = React.createContext<EditorContextType | undefined>(undefined);

export function EditorProvider({ 
  children, 
  pdf, 
  school,
  fields, 
  setFields, 
  namingFieldId, 
  setNamingFieldId,
  undo,
  redo,
  canUndo,
  canRedo,
  isDetecting,
  onDetect,
  onStatusChange,
  onSave,
  onPreview,
  isStatusChanging,
  isSaving,
  password,
  setPassword,
  passwordProtected,
  setPasswordProtected
}: { 
  children: React.ReactNode; 
  pdf: PDFForm;
  school?: School;
  fields: LocalPDFFormField[];
  setFields: React.Dispatch<React.SetStateAction<LocalPDFFormField[]>>;
  namingFieldId: string | null;
  setNamingFieldId: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isDetecting: boolean;
  onDetect: () => void;
  onStatusChange: (status: PDFForm['status']) => void;
  onSave: () => void;
  onPreview: () => void;
  isStatusChanging: boolean;
  isSaving?: boolean;
  password?: string;
  setPassword: (val: string) => void;
  passwordProtected?: boolean;
  setPasswordProtected: (val: boolean) => void;
}) {
  const [selectedFieldIds, setSelectedFieldIds] = React.useState<string[]>([]);
  const [zoom, setZoom] = React.useState(1.0);
  const [numPages, setNumPages] = React.useState(0);
  const [activePageNumber, setActivePageNumber] = React.useState(1);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [sidebarTab, setSidebarTab] = React.useState<SidebarTab>('blocks');
  const [isFullScreen, setIsFullScreen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<EditorViewMode>('design');
  const [marquee, setMarquee] = React.useState<MarqueeState | null>(null);
  const [isFieldDeleteConfirmOpen, setIsFieldDeleteConfirmOpen] = React.useState(false);

  const addField = React.useCallback((type: LocalPDFFormField['type'], pageNumber?: number, position?: { x: number, y: number }) => {
    const targetPage = pageNumber || activePageNumber;
    // Standard default dimensions
    const width = type === 'signature' ? 25 : type === 'photo' ? 15 : 20;
    const height = type === 'signature' ? 10 : type === 'photo' ? 15 : 4;

    const newField: LocalPDFFormField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      label: type === 'static-text' ? 'Label Text' : `New ${type}`,
      type,
      pageNumber: targetPage,
      position: position || { x: (100 - width) / 2, y: 45 }, // Default to horizontal center
      dimensions: { width, height },
      required: false,
      alignment: 'center', 
      verticalAlignment: 'center', 
      fontSize: 11,
      staticText: type === 'static-text' ? 'Double-click to edit Label' : undefined,
      options: type === 'dropdown' ? ['Option 1', 'Option 2'] : undefined
    };
    setFields(prev => [...prev, newField]);
    setSelectedFieldIds([newField.id]);
  }, [activePageNumber, setFields]);

  const updateField = React.useCallback((id: string, props: Partial<LocalPDFFormField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...props } : f));
  }, [setFields]);

  const removeField = React.useCallback((id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    setSelectedFieldIds(prev => prev.filter(i => i !== id));
  }, [setFields]);

  const selectField = React.useCallback((id: string, multi: boolean = false, toggle: boolean = false) => {
    if (viewMode === 'preview') return;
    setSelectedFieldIds(prev => {
      if (toggle) return prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
      if (multi) return prev.includes(id) ? prev : [...prev, id];
      return [id];
    });
  }, [viewMode]);

  const duplicateFields = React.useCallback((ids: string[]) => {
    const toDuplicate = fields.filter(f => ids.includes(f.id));
    const newFields = toDuplicate.map(f => ({
      ...JSON.parse(JSON.stringify(f)),
      id: `f_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      position: { x: f.position.x + 2, y: f.position.y + 2 },
      isSuggestion: false
    }));
    setFields(prev => [...prev, ...newFields]);
    setSelectedFieldIds(newFields.map(n => n.id));
  }, [fields, setFields]);

  const alignFields = React.useCallback((type: AlignmentType) => {
    const selected = fields.filter(f => selectedFieldIds.includes(f.id));
    const updates = calculateAlignment(selected, type);
    setFields(prev => prev.map(f => updates[f.id] ? { ...f, position: updates[f.id] } : f));
  }, [fields, selectedFieldIds, setFields]);

  const distributeFields = React.useCallback((type: DistributionType) => {
    const selected = fields.filter(f => selectedFieldIds.includes(f.id));
    const updates = calculateDistribution(selected, type);
    setFields(prev => prev.map(f => updates[f.id] ? { ...f, position: updates[f.id] } : f));
  }, [fields, selectedFieldIds, setFields]);

  // Keyboard Nudge & Delete Logic
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedFieldIds.length === 0 || viewMode === 'preview') return;

      const activeEl = document.activeElement;
      const isTyping = 
        activeEl instanceof HTMLInputElement || 
        activeEl instanceof HTMLTextAreaElement || 
        (activeEl as HTMLElement)?.isContentEditable;

      if (isTyping) return;

      // Nudge Logic
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        let nudgeAmount = 0.5;
        if (e.shiftKey) nudgeAmount = 2.0;
        if (e.ctrlKey || e.metaKey) nudgeAmount = 0.1;

        const dx = e.key === 'ArrowLeft' ? -nudgeAmount : e.key === 'ArrowRight' ? nudgeAmount : 0;
        const dy = e.key === 'ArrowUp' ? -nudgeAmount : e.key === 'ArrowDown' ? nudgeAmount : 0;

        setFields(prev => prev.map(f => {
          if (selectedFieldIds.includes(f.id)) {
            return {
              ...f,
              position: {
                x: Math.max(0, Math.min(100 - f.dimensions.width, f.position.x + dx)),
                y: Math.max(0, Math.min(100 - f.dimensions.height, f.position.y + dy)),
              },
              isSuggestion: false
            };
          }
          return f;
        }));
      }

      // Delete Logic
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setIsFieldDeleteConfirmOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFieldIds, setFields, viewMode]);

  const value = React.useMemo(() => ({
    pdf, school, fields, selectedFieldIds, zoom, numPages, activePageNumber, isSidebarCollapsed, sidebarTab, isFullScreen, viewMode, namingFieldId, marquee, isDetecting,
    password, passwordProtected, isStatusChanging, isSaving, isFieldDeleteConfirmOpen,
    setFields, setSelectedFieldIds, setZoom, setNumPages, setActivePageNumber, setIsSidebarCollapsed, setSidebarTab, setIsFullScreen, setViewMode, setNamingFieldId, setMarquee,
    setIsFieldDeleteConfirmOpen,
    onDetect, onStatusChange, onSave, onPreview, setPassword, setPasswordProtected,
    addField, updateField, removeField, duplicateFields, alignFields, distributeFields, selectField,
    undo, redo, canUndo, canRedo
  }), [
    pdf, school, fields, selectedFieldIds, zoom, numPages, activePageNumber, isSidebarCollapsed, sidebarTab, isFullScreen, viewMode, namingFieldId, marquee, isDetecting,
    password, passwordProtected, isStatusChanging, isSaving, isFieldDeleteConfirmOpen,
    setFields, setNamingFieldId, setNumPages, setActivePageNumber, setIsFieldDeleteConfirmOpen, setSidebarTab,
    onDetect, onStatusChange, onSave, onPreview, setPassword, setPasswordProtected,
    addField, updateField, removeField, duplicateFields, alignFields, distributeFields, selectField,
    undo, redo, canUndo, canRedo
  ]);

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const context = React.useContext(EditorContext);
  if (!context) throw new Error('useEditor must be used within a EditorProvider');
  return context;
}

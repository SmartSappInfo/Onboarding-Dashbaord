'use client';

import * as React from 'react';
import type { PDFForm, PDFFormField } from '@/lib/types';
import type { LocalPDFFormField, AlignmentType, DistributionType, MarqueeState } from './types';
import { calculateAlignment, calculateDistribution } from './utils/alignment';

interface EditorContextType {
  // State
  pdf: PDFForm;
  fields: LocalPDFFormField[];
  selectedFieldIds: string[];
  zoom: number;
  isSidebarCollapsed: boolean;
  namingFieldId: string | null;
  marquee: MarqueeState | null;
  isDetecting: boolean;
  
  // External settings managed by page but synced here for UI convenience
  password?: string;
  passwordProtected?: boolean;
  isStatusChanging?: boolean;
  
  // Actions
  setFields: React.Dispatch<React.SetStateAction<LocalPDFFormField[]>>;
  setSelectedFieldIds: React.Dispatch<React.SetStateAction<string[]>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setNamingFieldId: (id: string | null) => void;
  setMarquee: React.Dispatch<React.SetStateAction<MarqueeState | null>>;
  
  // Callbacks
  onDetect: () => void;
  onStatusChange: (status: PDFForm['status']) => void;
  onSave: () => void;
  onPreview: () => void;
  setPassword: (val: string) => void;
  setPasswordProtected: (val: boolean) => void;
  
  // High-level Handlers
  addField: (type: LocalPDFFormField['type']) => void;
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
  password,
  setPassword,
  passwordProtected,
  setPasswordProtected
}: { 
  children: React.ReactNode; 
  pdf: PDFForm;
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
  password?: string;
  setPassword: (val: string) => void;
  passwordProtected?: boolean;
  setPasswordProtected: (val: boolean) => void;
}) {
  const [selectedFieldIds, setSelectedFieldIds] = React.useState<string[]>([]);
  const [zoom, setZoom] = React.useState(1.0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [marquee, setMarquee] = React.useState<MarqueeState | null>(null);

  const addField = React.useCallback((type: LocalPDFFormField['type']) => {
    const newField: LocalPDFFormField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      label: `New ${type}`,
      type,
      pageNumber: 1,
      position: { x: 10, y: 10 },
      dimensions: { width: 20, height: 5 },
      required: false,
      options: type === 'dropdown' ? ['Option 1', 'Option 2'] : undefined
    };
    setFields(prev => [...prev, newField]);
    setSelectedFieldIds([newField.id]);
  }, [setFields]);

  const updateField = React.useCallback((id: string, props: Partial<LocalPDFFormField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...props } : f));
  }, [setFields]);

  const removeField = React.useCallback((id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    setSelectedFieldIds(prev => prev.filter(i => i !== id));
  }, [setFields]);

  const selectField = React.useCallback((id: string, multi: boolean = false, toggle: boolean = false) => {
    setSelectedFieldIds(prev => {
      if (toggle) return prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
      if (multi) return prev.includes(id) ? prev : [...prev, id];
      return [id];
    });
  }, []);

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

  const value = React.useMemo(() => ({
    pdf, fields, selectedFieldIds, zoom, isSidebarCollapsed, namingFieldId, marquee, isDetecting,
    password, passwordProtected, isStatusChanging,
    setFields, setSelectedFieldIds, setZoom, setIsSidebarCollapsed, setNamingFieldId, setMarquee,
    onDetect, onStatusChange, onSave, onPreview, setPassword, setPasswordProtected,
    addField, updateField, removeField, duplicateFields, alignFields, distributeFields, selectField,
    undo, redo, canUndo, canRedo
  }), [
    pdf, fields, selectedFieldIds, zoom, isSidebarCollapsed, namingFieldId, marquee, isDetecting,
    password, passwordProtected, isStatusChanging, setFields, setNamingFieldId,
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
  if (!context) throw new Error('useEditor must be used within an EditorProvider');
  return context;
}

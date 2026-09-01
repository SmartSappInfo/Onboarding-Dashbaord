'use client';

/**
 * ARCHITECTURE:
 * Keyboard Shortcuts Dispatcher & Help Modal (Phase 2 - Professional Canvas Editor)
 * 
 * Provides global keyboard accelerators for canvas operations with strict
 * text-input focus shields to prevent typing collisions.
 * 
 * CAUTION:
 * Never capture keys when active element is an input, textarea, or contenteditable.
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface UseKeyboardShortcutsProps {
  onSelectAll: () => void;
  onClearSelection: () => void;
  onGroupSelected: () => void;
  onUngroupSelected: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onNudgeSelected: (dx: number, dy: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenShortcutsHelp?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onSelectAll,
  onClearSelection,
  onGroupSelected,
  onUngroupSelected,
  onDuplicateSelected,
  onDeleteSelected,
  onNudgeSelected,
  onUndo,
  onRedo,
  onOpenShortcutsHelp,
  enabled = true,
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Text-Input Focus Shield: Do not capture if user is typing
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMeta = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      // Select All: Cmd + A
      if (isMeta && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        onSelectAll();
        return;
      }

      // Group / Ungroup: Cmd + G / Cmd + Shift + G
      if (isMeta && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        if (isShift) {
          onUngroupSelected();
        } else {
          onGroupSelected();
        }
        return;
      }

      // Duplicate: Cmd + D
      if (isMeta && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        onDuplicateSelected();
        return;
      }

      // Undo / Redo: Cmd + Z / Cmd + Shift + Z
      if (isMeta && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (isShift) {
          onRedo();
        } else {
          onUndo();
        }
        return;
      }

      // Delete: Backspace / Delete
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        onDeleteSelected();
        return;
      }

      // Escape: Clear Selection
      if (e.key === 'Escape') {
        e.preventDefault();
        onClearSelection();
        return;
      }

      // Arrow Nudges: 0.2% step (or 1.0% with Shift)
      const step = isShift ? 1.0 : 0.2;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onNudgeSelected(0, -step);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        onNudgeSelected(0, step);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onNudgeSelected(-step, 0);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNudgeSelected(step, 0);
        return;
      }

      // Help Modal: ? key
      if (e.key === '?' && onOpenShortcutsHelp) {
        e.preventDefault();
        onOpenShortcutsHelp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    onSelectAll,
    onClearSelection,
    onGroupSelected,
    onUngroupSelected,
    onDuplicateSelected,
    onDeleteSelected,
    onNudgeSelected,
    onUndo,
    onRedo,
    onOpenShortcutsHelp,
  ]);
}

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const SHORTCUTS = [
    { key: 'Cmd / Ctrl + A', label: 'Select all canvas elements' },
    { key: 'Cmd / Ctrl + G', label: 'Group selected elements' },
    { key: 'Cmd / Ctrl + Shift + G', label: 'Ungroup selected elements' },
    { key: 'Cmd / Ctrl + D', label: 'Duplicate selected elements' },
    { key: 'Delete / Backspace', label: 'Delete selected elements' },
    { key: 'Arrow Keys', label: 'Nudge position by 0.2%' },
    { key: 'Shift + Arrow Keys', label: 'Nudge position by 1.0%' },
    { key: 'Cmd / Ctrl + Z', label: 'Undo previous edit' },
    { key: 'Cmd / Ctrl + Shift + Z', label: 'Redo previously undone edit' },
    { key: 'Escape', label: 'Deselect all elements' },
    { key: 'Shift + Drag', label: 'Multi-select or constrain aspect ratio' },
    { key: 'Shift + Rotate', label: 'Snap rotation to 15° increments' },
    { key: '?', label: 'Open this keyboard shortcuts reference' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-slate-100 p-6 rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black flex items-center gap-2 text-white">
            <Keyboard className="w-5 h-5 text-emerald-400" /> Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 pt-3 max-h-[60vh] overflow-y-auto pr-1">
          {SHORTCUTS.map((s, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs"
            >
              <span className="text-slate-300 font-medium">{s.label}</span>
              <kbd className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-[11px] font-mono font-bold text-emerald-400 whitespace-nowrap">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

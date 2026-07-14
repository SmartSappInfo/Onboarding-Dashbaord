'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface FallbackEditorModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly variableKey: string;
  readonly currentFallback: string;
  readonly onSave: (fallback: string) => void;
}

export function FallbackEditorModal({
  isOpen,
  onClose,
  variableKey,
  currentFallback,
  onSave,
}: FallbackEditorModalProps) {
  const [value, setValue] = React.useState(currentFallback);

  React.useEffect(() => {
    setValue(currentFallback);
  }, [currentFallback, isOpen]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(value);
    onClose();
  };

  // Convert the technical variable key into a human-friendly format for the UI
  const friendlyName = React.useMemo(() => {
    return variableKey
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }, [variableKey]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[90%] sm:max-w-[425px] bg-slate-900/95 border-slate-800 text-slate-100 backdrop-blur-xl shadow-2xl rounded-2xl p-6 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 mx-auto">
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            Configure Variable Fallback
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400 font-medium">
            Define a backup value to display if the system is unable to automatically resolve the variable info.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-4">
          <div className="space-y-1">
            <Label htmlFor="variableName" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Selected Variable
            </Label>
            <div className="px-3 py-2 bg-slate-850 rounded-xl text-xs font-semibold text-emerald-400 border border-slate-800/80">
              {friendlyName}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="fallbackInput" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Backup Value
            </Label>
            <Input
              id="fallbackInput"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. Valued Guest"
              className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200 focus:border-emerald-500/50"
              autoComplete="off"
            />
          </div>

          <DialogFooter className="flex flex-row gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border-slate-700 bg-transparent text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all duration-200 active:scale-[0.97]"
            >
              Apply Backup
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

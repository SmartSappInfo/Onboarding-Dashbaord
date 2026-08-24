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

import { Checkbox } from '@/components/ui/checkbox';
import { Link as LinkIcon, ShieldCheck } from 'lucide-react';

interface FallbackEditorModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly variableKey: string;
  readonly currentFallback: string;
  readonly isUrl?: boolean;
  readonly initialTrackVisitor?: boolean;
  readonly onSave: (fallback: string, trackVisitor?: boolean) => void;
}

// ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
// Variable Fallback Local Storage Persistence & Prepopulation:
// 1. Storage Key Format: 'smartsapp_var_fallback_' + variableKey
// 2. Pre-population: When opening FallbackEditorModal, if explicit currentFallback is empty,
//    automatically read from browser localStorage to pre-fill the backup value input field.
// 3. Persistence: Upon handleSave, persist non-empty values into localStorage and purge on empty strings.
//    Wrapped in self-healing try/catch to safely handle storage quota errors or restricted iframe contexts.
const STORAGE_PREFIX = 'smartsapp_var_fallback_';
const TRACKING_STORAGE_PREFIX = 'smartsapp_var_track_';

/**
 * Helper to determine if a variable key or value represents a URL variable.
 */
export function isLikelyUrlVariable(key: string, value?: string): boolean {
  if (!key) return false;
  const lowerKey = key.toLowerCase();
  if (
    lowerKey.endsWith('_url') ||
    lowerKey.endsWith('_link') ||
    lowerKey.endsWith('_report') ||
    lowerKey.endsWith('_uri') ||
    lowerKey.endsWith('_href') ||
    lowerKey === 'visibility_report' ||
    lowerKey === 'survey_link' ||
    lowerKey === 'dashboard_link' ||
    lowerKey === 'form_link' ||
    lowerKey === 'contract_link' ||
    lowerKey === 'meeting_link' ||
    lowerKey === 'calendar_link' ||
    lowerKey === 'entity_link' ||
    lowerKey === 'entity_console_link' ||
    lowerKey === 'result_url'
  ) {
    return true;
  }
  if (value && (/^https?:\/\//i.test(value.trim()) || value.trim().startsWith('/'))) {
    return true;
  }
  return false;
}

export function FallbackEditorModal({
  isOpen,
  onClose,
  variableKey,
  currentFallback,
  isUrl: explicitIsUrl,
  initialTrackVisitor = false,
  onSave,
}: FallbackEditorModalProps) {
  const [value, setValue] = React.useState(currentFallback);
  const [trackVisitor, setTrackVisitor] = React.useState<boolean>(initialTrackVisitor);

  // Dynamic detection: explicit flag OR variable naming convention OR URL-formatted fallback
  const isUrl = React.useMemo(() => {
    if (explicitIsUrl !== undefined) return explicitIsUrl;
    return isLikelyUrlVariable(variableKey, value);
  }, [explicitIsUrl, variableKey, value]);

  React.useEffect(() => {
    if (!isOpen) return;

    // Reset tracking state to initial or check localStorage
    if (initialTrackVisitor !== undefined) {
      setTrackVisitor(initialTrackVisitor);
    } else if (typeof window !== 'undefined' && variableKey) {
      try {
        const storedTrack = localStorage.getItem(`${TRACKING_STORAGE_PREFIX}${variableKey}`);
        if (storedTrack !== null) {
          setTrackVisitor(storedTrack === 'true');
        }
      } catch {
        // Self-healing fallback if localStorage access is blocked
      }
    }

    // 1. Prioritize explicit currentFallback if provided on the token
    if (currentFallback) {
      setValue(currentFallback);
      return;
    }

    // 2. Otherwise auto-prepopulate from browser localStorage if previously configured for this variable
    if (typeof window !== 'undefined' && variableKey) {
      try {
        const stored = localStorage.getItem(`${STORAGE_PREFIX}${variableKey}`);
        if (stored !== null && stored !== undefined) {
          setValue(stored);
          return;
        }
      } catch {
        // Self-healing fallback if localStorage access is blocked
      }
    }

    setValue('');
  }, [currentFallback, initialTrackVisitor, isOpen, variableKey]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanValue = value.trim();

    // Persist configured backup value & tracking state in browser localStorage
    if (typeof window !== 'undefined' && variableKey) {
      try {
        const key = `${STORAGE_PREFIX}${variableKey}`;
        const trackKey = `${TRACKING_STORAGE_PREFIX}${variableKey}`;
        if (cleanValue) {
          localStorage.setItem(key, cleanValue);
        } else {
          localStorage.removeItem(key);
        }
        if (isUrl) {
          localStorage.setItem(trackKey, String(trackVisitor));
        }
      } catch {
        // Self-healing fallback if localStorage quota exceeded
      }
    }

    onSave(value, isUrl ? trackVisitor : false);
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
      <DialogContent className="w-[90%] sm:max-w-[440px] bg-slate-900/95 border-slate-800 text-slate-100 backdrop-blur-xl shadow-2xl rounded-2xl p-6 transition-all duration-300 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 mx-auto">
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            {isUrl ? <LinkIcon className="h-5 w-5 text-emerald-400" /> : null}
            {isUrl ? 'Configure Link & Fallback' : 'Configure Variable Fallback'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400 font-medium leading-relaxed">
            {isUrl
              ? 'Define a default URL and enable visitor tracking to personalize landing pages and decrypt recipient identity.'
              : 'Define a backup value to display if the system is unable to automatically resolve the variable info.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="variableName" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Selected Variable
            </Label>
            <div className="px-3 py-2 bg-slate-850 rounded-xl text-xs font-semibold text-emerald-400 border border-slate-800/80 flex items-center justify-between">
              <span className="font-mono">{`{{${variableKey}}}`}</span>
              <span className="text-[10px] text-slate-400 font-sans font-normal">{friendlyName}</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="fallbackInput" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isUrl ? 'Default Target URL' : 'Backup Value'}
            </Label>
            <Input
              id="fallbackInput"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={isUrl ? 'https://smartsapp.com' : 'e.g. Valued Guest'}
              className="h-10 rounded-xl bg-slate-800 border-slate-700 text-xs font-semibold text-slate-200 focus:border-emerald-500/50 font-mono"
              autoComplete="off"
            />
          </div>

          {/* Visitor Identity & Link Tracking Toggle for URL Variables */}
          {isUrl && (
            <div className="p-3 rounded-xl bg-slate-850/80 border border-slate-800 space-y-2 transition-all">
              <div className="flex items-start space-x-2.5">
                <Checkbox
                  id="modal-track-visitor"
                  checked={trackVisitor}
                  onCheckedChange={(checked) => setTrackVisitor(Boolean(checked))}
                  className="mt-0.5 rounded-md border-slate-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                />
                <div className="space-y-1 select-none cursor-pointer" onClick={() => setTrackVisitor(prev => !prev)}>
                  <label
                    htmlFor="modal-track-visitor"
                    className="text-xs font-semibold text-slate-200 cursor-pointer block leading-snug"
                  >
                    Track Visitor Identity (Encrypt Recipient Details)
                  </label>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Appends encrypted recipient reference token (<code className="text-emerald-400 font-mono text-[9px]">?ref=...</code>) to automatically personalize and record visits.
                  </p>
                </div>
              </div>
              {trackVisitor && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-[10px] text-emerald-300 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Encrypted with AES-256-GCM prior to message dispatch.</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-row gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border-slate-700 bg-transparent text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white min-h-[44px] sm:min-h-0"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all duration-200 active:scale-[0.97] min-h-[44px] sm:min-h-0"
            >
              Apply Settings
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
      <DialogContent className="w-[90%] sm:max-w-[440px] bg-card border border-border/80 text-card-foreground shadow-2xl rounded-2xl p-6 transition-all duration-300 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 mx-auto">
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            {isUrl ? <LinkIcon className="h-5 w-5 text-emerald-500" /> : null}
            {isUrl ? 'Configure Link & Fallback' : 'Configure Variable Fallback'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-medium leading-relaxed">
            {isUrl
              ? 'Define a default URL and enable visitor tracking to personalize landing pages and decrypt recipient identity.'
              : 'Define a backup value to display if the system is unable to automatically resolve the variable info.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="variableName" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Selected Variable
            </Label>
            <div className="px-3 py-2 bg-muted/30 rounded-xl text-xs font-semibold text-primary border border-border/70 flex items-center justify-between">
              <span className="font-mono">{`{{${variableKey}}}`}</span>
              <span className="text-[10px] text-muted-foreground font-sans font-normal">{friendlyName}</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="fallbackInput" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {isUrl ? 'Default Target URL' : 'Backup Value'}
            </Label>
            <Input
              id="fallbackInput"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={isUrl ? 'https://smartsapp.com' : 'e.g. Valued Guest'}
              className="h-10 rounded-xl bg-background border-border text-xs font-semibold text-foreground focus-visible:ring-1 focus-visible:ring-ring font-mono"
              autoComplete="off"
            />
          </div>

          {/* Visitor Identity & Link Tracking Toggle for URL Variables */}
          {isUrl && (
            <div className="p-3 rounded-xl bg-muted/20 border border-border/70 space-y-2 transition-all">
              <div className="flex items-start space-x-2.5">
                <Checkbox
                  id="modal-track-visitor"
                  checked={trackVisitor}
                  onCheckedChange={(checked) => setTrackVisitor(Boolean(checked))}
                  className="mt-0.5 rounded-md"
                />
                <div className="space-y-1 select-none cursor-pointer" onClick={() => setTrackVisitor(prev => !prev)}>
                  <label
                    htmlFor="modal-track-visitor"
                    className="text-xs font-semibold text-foreground cursor-pointer block leading-snug"
                  >
                    Track Visitor Identity (Encrypt Recipient Details)
                  </label>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Appends encrypted recipient reference token (<code className="text-primary font-mono text-[9px]">?ref=...</code>) to automatically personalize and record visits.
                  </p>
                </div>
              </div>
              {trackVisitor && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
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
              className="h-9 px-4 rounded-xl border-border text-xs font-bold text-muted-foreground hover:bg-muted/80 hover:text-foreground min-h-[44px] sm:min-h-0 active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground hover:opacity-90 text-xs font-bold transition-all duration-200 active:scale-[0.97] min-h-[44px] sm:min-h-0"
            >
              Apply Settings
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

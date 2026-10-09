'use client';

/**
 * @fileOverview SmartSapp Bulk Import — Append Note to Lead Component.
 *
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Renders a dedicated configuration card on the Bulk Import Mapping page.
 * - Allows the user to select an incoming spreadsheet column (e.g. "Personal Notes", "Remarks")
 *   to be automatically created and appended as an authentic CRM EntityNote in Firestore
 *   (`entity_notes` collection) upon entity creation.
 * - Provides live preview of first 3 non-empty row values for visual verification.
 * - Provides note category configuration ('general', 'call', 'meeting', 'escalation', 'followup'),
 *   prefix formatting, and pin-to-top toggle.
 * - Conforms to Modal & Card standards in theme.md and Rule 4 (Strict Zero-Any Typing).
 * - Touch-first layout with min-h-[44px] touch targets and tactile active:scale-[0.97] feedback.
 */

import * as React from 'react';
import { StickyNote, Sparkles, Pin, Tag, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import type { NoteImportConfig } from '@/lib/import-types';
import { detectNoteColumn, isValidNoteText } from '@/lib/import-export/note-import-helpers';

export interface AppendNoteCardProps {
  /** Available column headers from the uploaded spreadsheet */
  headers: string[];
  /** Raw preview rows to extract live data previews */
  rawData: Record<string, unknown>[];
  /** Current note configuration or null if disabled */
  noteConfig: NoteImportConfig | null;
  /** Callback fired when note configuration changes */
  onNoteConfigChange: (config: NoteImportConfig | null) => void;
}

const NONE_COLUMN_VALUE = '__none__';

const NOTE_TYPE_OPTIONS: Array<{
  value: NonNullable<NoteImportConfig['noteType']>;
  label: string;
}> = [
  { value: 'general', label: 'General Note' },
  { value: 'call', label: 'Call Log' },
  { value: 'meeting', label: 'Meeting Note' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'escalation', label: 'Escalation' },
];

export function AppendNoteCard({
  headers,
  rawData,
  noteConfig,
  onNoteConfigChange,
}: AppendNoteCardProps) {
  // Detect if any header matches note patterns
  const suggestedHeader = React.useMemo(() => {
    return detectNoteColumn(headers);
  }, [headers]);

  const selectedColumn = noteConfig?.columnHeader || '';

  // Extract up to 3 non-empty preview values for the selected column
  const sampleValues = React.useMemo(() => {
    if (!selectedColumn) return [];
    const samples: Array<{ rowIdx: number; text: string }> = [];
    for (let i = 0; i < rawData.length && samples.length < 3; i++) {
      const val = rawData[i]?.[selectedColumn];
      if (isValidNoteText(val)) {
        samples.push({
          rowIdx: i + 1,
          text: String(val).trim(),
        });
      }
    }
    return samples;
  }, [rawData, selectedColumn]);

  const handleColumnChange = React.useCallback(
    (col: string) => {
      if (col === NONE_COLUMN_VALUE || !col) {
        onNoteConfigChange(null);
        return;
      }
      onNoteConfigChange({
        columnHeader: col,
        noteType: noteConfig?.noteType || 'general',
        isPinned: noteConfig?.isPinned || false,
        prefix: noteConfig?.prefix || '',
      });
    },
    [noteConfig, onNoteConfigChange]
  );

  const handleNoteTypeChange = React.useCallback(
    (type: string) => {
      if (!noteConfig) return;
      onNoteConfigChange({
        ...noteConfig,
        noteType: type as NoteImportConfig['noteType'],
      });
    },
    [noteConfig, onNoteConfigChange]
  );

  const handlePinToggle = React.useCallback(
    (pinned: boolean) => {
      if (!noteConfig) return;
      onNoteConfigChange({
        ...noteConfig,
        isPinned: pinned,
      });
    },
    [noteConfig, onNoteConfigChange]
  );

  const handlePrefixChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!noteConfig) return;
      onNoteConfigChange({
        ...noteConfig,
        prefix: e.target.value,
      });
    },
    [noteConfig, onNoteConfigChange]
  );

  return (
    <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-card overflow-hidden">
      <CardHeader className="border-b p-6 sm:p-8 flex flex-row items-center justify-between space-y-0 bg-muted/10">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
            <StickyNote size={20} />
          </div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base sm:text-lg font-bold">
              Append Note to Lead
            </CardTitle>
            <CardInfoTooltip text="Choose a column from your spreadsheet to automatically create and attach as an authentic CRM note for each newly created lead." />
          </div>
        </div>

        {suggestedHeader && !selectedColumn && (
          <Badge
            variant="outline"
            className="hidden sm:inline-flex items-center gap-1.5 border-amber-300/60 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700 text-xs font-semibold py-1 px-2.5 rounded-lg"
          >
            <Sparkles size={12} className="text-amber-500 animate-pulse" />
            Detected &ldquo;{suggestedHeader}&rdquo;
          </Badge>
        )}
      </CardHeader>

      <CardContent className="p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="append-note-column-select"
              className="text-sm font-semibold text-foreground"
            >
              Spreadsheet Column for Note
            </Label>
            {suggestedHeader && suggestedHeader !== selectedColumn && (
              <button
                type="button"
                onClick={() => handleColumnChange(suggestedHeader)}
                className="text-xs text-amber-600 hover:text-amber-700 font-semibold inline-flex items-center gap-1 active:scale-[0.97] transition-transform min-h-[44px] sm:min-h-0 py-1"
              >
                <Sparkles size={12} />
                Use &ldquo;{suggestedHeader}&rdquo;
              </button>
            )}
          </div>

          <Select
            value={selectedColumn || NONE_COLUMN_VALUE}
            onValueChange={handleColumnChange}
          >
            <SelectTrigger
              id="append-note-column-select"
              className="h-11 rounded-xl bg-background border-input text-sm font-medium focus:ring-2 focus:ring-primary/20 min-h-[44px]"
            >
              <SelectValue placeholder="-- Do not append a note --" />
            </SelectTrigger>
            <SelectContent className="rounded-xl max-h-[300px]">
              <SelectItem value={NONE_COLUMN_VALUE} className="text-muted-foreground font-normal">
                -- Do not append a note --
              </SelectItem>
              {headers.map((h) => (
                <SelectItem key={h} value={h} className="font-medium">
                  {h}
                  {h === suggestedHeader && (
                    <span className="ml-2 text-[10px] uppercase font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                      Suggested
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {selectedColumn
              ? `Rows with non-empty text in "${selectedColumn}" will create a note doc in the lead's timeline.`
              : 'Leave unselected if your import does not contain freeform remarks or call notes.'}
          </p>
        </div>

        {/* Note Configuration Options (Shown when a column is selected) */}
        {selectedColumn && (
          <div className="space-y-6 pt-4 border-t border-border/60">
            {/* Live Data Preview */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider inline-flex items-center gap-1.5">
                  <Eye size={14} /> Live Sample Preview ({selectedColumn})
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {sampleValues.length > 0
                    ? `Showing ${sampleValues.length} non-empty sample${sampleValues.length > 1 ? 's' : ''}`
                    : 'No non-empty text found in initial rows'}
                </span>
              </div>

              {sampleValues.length > 0 ? (
                <div className="space-y-1.5">
                  {sampleValues.map((sample) => (
                    <div
                      key={sample.rowIdx}
                      className="text-xs bg-background/80 dark:bg-background/40 border border-border/50 rounded-lg p-2.5 font-mono text-foreground flex items-start gap-2"
                    >
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 font-sans">
                        Row {sample.rowIdx}
                      </Badge>
                      <span className="break-words line-clamp-2">
                        {noteConfig?.prefix ? `[${noteConfig.prefix.trim()}] ` : ''}
                        {sample.text}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No sample note text detected in the first preview records. Rows with empty note cells will simply be skipped.
                </p>
              )}
            </div>

            {/* Note Category & Optional Prefix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="append-note-type-select" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Tag size={13} className="text-muted-foreground" />
                  Note Category
                </Label>
                <Select
                  value={noteConfig?.noteType || 'general'}
                  onValueChange={handleNoteTypeChange}
                >
                  <SelectTrigger
                    id="append-note-type-select"
                    className="h-11 rounded-xl bg-background border-input text-sm min-h-[44px]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {NOTE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="font-medium">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="append-note-prefix-input" className="text-xs font-semibold text-foreground">
                  Optional Prefix Tag
                </Label>
                <Input
                  id="append-note-prefix-input"
                  value={noteConfig?.prefix || ''}
                  onChange={handlePrefixChange}
                  placeholder="e.g. Lead Qualification"
                  className="h-11 rounded-xl bg-background border-input text-sm min-h-[44px]"
                />
              </div>
            </div>

            {/* Pin Note Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-background border border-border/70 min-h-[44px]">
              <div className="space-y-0.5">
                <Label
                  htmlFor="append-note-pin-switch"
                  className="text-sm font-semibold text-foreground flex items-center gap-1.5 cursor-pointer"
                >
                  <Pin size={14} className={noteConfig?.isPinned ? 'text-amber-500 rotate-45 transition-transform' : 'text-muted-foreground'} />
                  Pin Note to Top
                </Label>
                <p className="text-xs text-muted-foreground">
                  Pinned notes remain permanently at the top of the lead&apos;s activity timeline.
                </p>
              </div>
              <Switch
                id="append-note-pin-switch"
                checked={Boolean(noteConfig?.isPinned)}
                onCheckedChange={handlePinToggle}
                className="active:scale-[0.97] transition-transform"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

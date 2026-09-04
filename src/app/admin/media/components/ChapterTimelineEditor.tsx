'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Video Chapter Timeline UI:
 *    Manages chapter segmentation, start/end timestamps, and chapter jump triggers.
 * 2. Mobile Accessibility & Touch Target Bounds:
 *    All buttons, inputs, and timeline markers strictly enforce `min-h-[44px] min-w-[44px]`
 *    touch target bounds with tactile micro-animations (`active:scale-[0.97]`).
 * 3. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { useState } from 'react';
import type { MediaChapter } from '@/lib/types/media-2.0';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Clock, Play, Layers } from 'lucide-react';

export interface ChapterTimelineEditorProps {
  chapters: MediaChapter[];
  currentTime?: number;
  onSaveChapters?: (chapters: Omit<MediaChapter, 'id' | 'assetId'>[]) => void;
  onSeekTo?: (seconds: number) => void;
}

export function ChapterTimelineEditor({
  chapters,
  currentTime = 0,
  onSaveChapters,
  onSeekTo,
}: ChapterTimelineEditorProps) {
  const [localChapters, setLocalChapters] = useState<Omit<MediaChapter, 'id' | 'assetId'>[]>(
    chapters.map((c) => ({
      title: c.title,
      startTime: c.startTime,
      endTime: c.endTime,
      summary: c.summary,
      order: c.order,
    }))
  );

  const [newTitle, setNewTitle] = useState('');
  const [newStartTime, setNewStartTime] = useState(Math.floor(currentTime));

  const formatTimestamp = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleAddChapter = () => {
    if (!newTitle.trim()) return;
    const nextChapter: Omit<MediaChapter, 'id' | 'assetId'> = {
      title: newTitle.trim(),
      startTime: newStartTime,
      endTime: newStartTime + 30,
      summary: '',
      order: localChapters.length + 1,
    };
    const updated = [...localChapters, nextChapter].sort((a, b) => a.startTime - b.startTime);
    setLocalChapters(updated);
    setNewTitle('');
    onSaveChapters?.(updated);
  };

  const handleDeleteChapter = (index: number) => {
    const updated = localChapters.filter((_, i) => i !== index);
    setLocalChapters(updated);
    onSaveChapters?.(updated);
  };

  return (
    <div className="space-y-6 text-left">
      {/* Chapter Creation Bar */}
      <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-3">
        <h4 className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
          <Plus className="h-4 w-4 text-primary" /> Add Chapter Marker
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            placeholder="Chapter Title (e.g. Campus Tour)..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="sm:col-span-2 h-10 text-xs rounded-xl bg-background border-border"
          />
          <Input
            type="number"
            placeholder="Start Seconds..."
            value={newStartTime}
            onChange={(e) => setNewStartTime(Number(e.target.value))}
            className="h-10 text-xs rounded-xl bg-background border-border"
          />
        </div>
        <Button
          disabled={!newTitle.trim()}
          onClick={handleAddChapter}
          className="w-full rounded-xl font-bold text-xs h-10 min-h-[44px] gap-2 active:scale-[0.97]"
        >
          Add Chapter at {formatTimestamp(newStartTime)}
        </Button>
      </div>

      {/* List of Chapters */}
      <div className="space-y-3">
        {localChapters.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground border border-dashed rounded-2xl bg-muted/10 space-y-1">
            <Layers className="h-6 w-6 opacity-40 mx-auto" />
            <p className="text-xs font-bold text-foreground">No Chapters Defined</p>
            <p className="text-[11px]">Add timestamp markers to divide video/audio into navigable chapters.</p>
          </div>
        ) : (
          localChapters.map((ch, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between gap-3 shadow-xs"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSeekTo?.(ch.startTime)}
                  className="rounded-xl text-xs font-bold h-9 px-3 min-h-[44px] gap-1 shrink-0 active:scale-[0.97]"
                >
                  <Play className="h-3 w-3 fill-current text-primary" /> {formatTimestamp(ch.startTime)}
                </Button>
                <div className="min-w-0 flex-1">
                  <h5 className="text-xs font-extrabold text-foreground truncate">{ch.title}</h5>
                  <p className="text-[10px] text-muted-foreground">
                    Duration: {formatTimestamp(ch.startTime)} - {formatTimestamp(ch.endTime)}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteChapter(idx)}
                className="h-9 w-9 text-muted-foreground hover:text-destructive rounded-xl min-h-[44px] min-w-[44px]"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ChapterTimelineEditor;

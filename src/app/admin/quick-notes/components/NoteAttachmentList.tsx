'use client';

import * as React from 'react';
import Image from 'next/image';
import { X, FileText, Video, LinkIcon, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasRenderableThumbnail } from '@/lib/quick-notes-domain';
import type { QuickNoteAttachment } from '@/lib/quick-notes-types';

export interface PendingUpload {
  id: string;
  name: string;
  progress: number;
}

export interface NoteAttachmentListProps {
  attachments: QuickNoteAttachment[];
  pending?: PendingUpload[];
  onRemove?: (attachment: QuickNoteAttachment) => void;
  /** Read-only mode (cards / previews) hides remove controls. */
  readOnly?: boolean;
  className?: string;
}

function AttachmentIcon({ type }: { type: QuickNoteAttachment['type'] }) {
  if (type === 'video') return <Video className="h-4 w-4" />;
  if (type === 'link') return <LinkIcon className="h-4 w-4" />;
  if (type === 'file') return <FileText className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export default function NoteAttachmentList({
  attachments,
  pending = [],
  onRemove,
  readOnly = false,
  className,
}: NoteAttachmentListProps) {
  if (attachments.length === 0 && pending.length === 0) return null;

  return (
    <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3', className)}>
      {attachments.map((att) => {
        const thumb = hasRenderableThumbnail(att);
        return (
          <div
            key={att.id}
            className="group relative flex items-center gap-2 overflow-hidden rounded-lg border border-border bg-card p-2"
          >
            {thumb ? (
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                <Image
                  src={att.thumbnailUrl as string}
                  alt={att.title || 'attachment thumbnail'}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <AttachmentIcon type={att.type} />
              </div>
            )}

            <a
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1"
              title={att.title || att.url}
            >
              <p className="truncate text-xs font-medium text-foreground">
                {att.title || att.url}
              </p>
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                {att.type} <ExternalLink className="h-2.5 w-2.5" />
              </span>
            </a>

            {!readOnly && onRemove && (
              <button
                type="button"
                aria-label="Remove attachment"
                onClick={() => onRemove(att)}
                className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}

      {pending.map((p) => (
        <div key={p.id} className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-2">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{p.name}</p>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${p.progress}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

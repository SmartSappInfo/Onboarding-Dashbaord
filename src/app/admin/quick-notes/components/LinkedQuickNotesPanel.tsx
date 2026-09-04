'use client';

import * as React from 'react';
import Link from 'next/link';
import { Brain, ArrowRight, Pin, Network, Share2, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLinkedQuickNotes } from '@/lib/quick-notes-hooks';
import { formatNoteDate } from './quick-notes-ui';
import { KNOWLEDGE_TYPE_META, normalizeKnowledgeType, getRelationDisplayLabel } from '@/lib/quick-notes-domain';
import { getBacklinksAction } from '@/lib/quick-notes-graph-actions';
import type { BacklinkItem } from '@/lib/quick-notes-types';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';

export interface LinkedQuickNotesPanelProps {
  workspaceId: string | null | undefined;
  organizationId?: string | null;
  /** Which link field to match on. */
  by: 'entity' | 'contact' | 'lead' | 'deal' | 'task';
  /** The entity, contact, lead, deal or task id this record is keyed by. */
  recordId: string;
  recordName?: string;
  /** Optional heading override. */
  title?: string;
}

/**
 * Reverse panel: Company Brain knowledge linked to this entity/task + Knowledge Graph Backlinks.
 */
export default function LinkedQuickNotesPanel({
  workspaceId,
  by,
  recordId,
  title = 'Company Brain',
}: LinkedQuickNotesPanelProps) {
  const { user } = useUser();
  const { data: notes, isLoading } = useLinkedQuickNotes(workspaceId, by, recordId);
  const [backlinks, setBacklinks] = React.useState<BacklinkItem[]>([]);
  const [, setLoadingBacklinks] = React.useState(false);

  React.useEffect(() => {
    if (!workspaceId || !recordId || !user?.uid) return;
    let isMounted = true;
    setLoadingBacklinks(true);

    getBacklinksAction(workspaceId, user.uid, recordId)
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setBacklinks(res.data);
        }
      })
      .catch((err) => console.warn('[LinkedQuickNotesPanel] Backlinks error:', err))
      .finally(() => {
        if (isMounted) setLoadingBacklinks(false);
      });

    return () => {
      isMounted = false;
    };
  }, [workspaceId, recordId, user?.uid]);

  const items = notes ?? [];
  const totalConnected = items.length + backlinks.length;

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <header className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Brain className="h-4 w-4 text-primary" />
          {title}
          {totalConnected > 0 && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {totalConnected}
            </Badge>
          )}
        </h3>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/quick-notes/graph?focus=${encodeURIComponent(recordId)}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline active:scale-[0.97] transition-transform"
            title="Inspect Ego-Network in Knowledge Graph"
          >
            <Network className="h-3.5 w-3.5" />
            Graph Cockpit
          </Link>
          <Link
            href="/admin/quick-notes"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline active:scale-[0.97] transition-transform"
          >
            All Brain
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </header>

      {/* Direct Attached Notes */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 && backlinks.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          No knowledge linked yet. Link one from the Company Brain editor.
        </p>
      ) : (
        <div className="space-y-3">
          {items.length > 0 && (
            <ul className="space-y-2">
              {items.map((note) => {
                const typeMeta = KNOWLEDGE_TYPE_META[normalizeKnowledgeType(note.knowledgeType)];
                return (
                  <li
                    key={note.id}
                    className="rounded-lg border border-border/60 p-2.5 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      {note.isPinned && <Pin className="h-3 w-3 text-primary fill-primary/20" />}
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold border',
                          typeMeta.badgeColor
                        )}
                      >
                        <span className={cn('h-1 w-1 rounded-full', typeMeta.dotColor)} />
                        {typeMeta.label}
                      </span>
                      <span className="truncate text-sm font-medium text-foreground">
                        {note.title || 'Untitled'}
                      </span>
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                        {formatNoteDate(note.updatedAt || note.createdAt)}
                      </span>
                    </div>
                    {note.plainText && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{note.plainText}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Incoming Graph Backlinks */}
          {backlinks.length > 0 && (
            <div className="pt-2 border-t border-border/50 space-y-1.5">
              <h4 className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Share2 className="w-3 h-3 text-indigo-500" />
                <span>Knowledge Graph Citations ({backlinks.length}):</span>
              </h4>
              <ul className="space-y-1.5">
                {backlinks.map((b) => (
                  <li
                    key={b.relationId}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/60 text-xs gap-2"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 uppercase">
                        {getRelationDisplayLabel(b.relationType)}
                      </Badge>
                      <span className="font-medium text-foreground truncate">{b.sourceTitle}</span>
                    </div>
                    {b.originHref && (
                      <Link
                        href={b.originHref}
                        className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline shrink-0 active:scale-[0.97] transition-transform"
                      >
                        <span>View</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

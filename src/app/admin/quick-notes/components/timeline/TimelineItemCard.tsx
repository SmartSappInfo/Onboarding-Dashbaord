'use client';

import * as React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  Brain,
  MessageSquare,
  Phone,
  Users,
  CheckSquare,
  Activity as ActivityIcon,
  Pin,
  PinOff,
  Trash2,
  Edit2,
  Reply,
  Check,
  X,
  ExternalLink,
  Sparkles,
  PlusCircle,
  Loader2,
  Briefcase,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  MessageSquareQuote,
  Eye,
  BookOpen,
  Compass,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import {
  KNOWLEDGE_TYPE_META,
  normalizeKnowledgeType,
} from '@/lib/quick-notes-domain';
import type { CRMKnowledgeTimelineItem, TimelineItemSource } from '@/lib/quick-notes-types';

export interface TimelineItemCardProps {
  item: CRMKnowledgeTimelineItem;
  currentUserId?: string;
  onTogglePin?: (item: CRMKnowledgeTimelineItem) => void;
  onDelete?: (item: CRMKnowledgeTimelineItem) => void;
  onUpdateContent?: (item: CRMKnowledgeTimelineItem, newContent: string) => Promise<boolean>;
  onCreateTask?: (item: CRMKnowledgeTimelineItem, actionText: string) => Promise<boolean>;
  onReply?: (item: CRMKnowledgeTimelineItem) => void;
}

const SOURCE_ICONS: Record<TimelineItemSource, React.ElementType> = {
  quick_note: Brain,
  entity_note: MessageSquare,
  call: Phone,
  call_note: Phone,
  meeting: Users,
  task: CheckSquare,
  task_note: CheckSquare,
  activity: ActivityIcon,
};

const KNOWLEDGE_ICONS: Record<string, React.ElementType> = {
  note: MessageSquare,
  idea: Lightbulb,
  insight: Sparkles,
  decision: CheckCircle2,
  feedback: MessageSquareQuote,
  observation: Eye,
  action: CheckSquare,
  research: BookOpen,
  strategy: Compass,
};

export const TimelineItemCard = React.memo(function TimelineItemCard({
  item,
  currentUserId,
  onTogglePin,
  onDelete,
  onUpdateContent,
  onCreateTask,
  onReply,
}: TimelineItemCardProps) {
  const confirm = useConfirm();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(item.content);
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);
  const [creatingTaskIndex, setCreatingTaskIndex] = React.useState<number | null>(null);

  const typeMeta = KNOWLEDGE_TYPE_META[normalizeKnowledgeType(item.knowledgeType)];
  const SourceIcon = SOURCE_ICONS[item.source] || MessageSquare;
  const KnowledgeIcon = KNOWLEDGE_ICONS[item.knowledgeType] || Brain;

  const isAuthor = currentUserId && item.authorId === currentUserId;

  const formattedDate = React.useMemo(() => {
    try {
      const d = new Date(item.timestamp);
      return isNaN(d.getTime()) ? item.timestamp : format(d, 'MMM d, yyyy h:mm a');
    } catch {
      return item.timestamp;
    }
  }, [item.timestamp]);

  const handleSaveEdit = async () => {
    if (!editContent.trim() || !onUpdateContent) return;
    setIsSavingEdit(true);
    try {
      const ok = await onUpdateContent(item, editContent);
      if (ok) setIsEditing(false);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const ok = await confirm({
      title: 'Delete this item?',
      description: 'This will permanently remove this record from the timeline.',
      confirmText: 'Delete',
      variant: 'destructive',
    });
    if (ok) onDelete(item);
  };

  const handleCreateTask = async (actionText: string, index: number) => {
    if (!onCreateTask) return;
    setCreatingTaskIndex(index);
    try {
      await onCreateTask(item, actionText);
    } finally {
      setCreatingTaskIndex(null);
    }
  };

  return (
    <div
      className={cn(
        'group relative rounded-2xl border bg-card p-4 sm:p-5 transition-all duration-200 shadow-sm hover:shadow-md',
        item.isPinned ? 'border-amber-500/40 ring-1 ring-amber-500/20 bg-amber-500/[0.02]' : 'border-border/60 hover:border-border',
        item.sentiment === 'urgent' && 'border-l-4 border-l-rose-500',
        item.sentiment === 'negative' && 'border-l-4 border-l-amber-500',
        item.sentiment === 'positive' && 'border-l-4 border-l-emerald-500'
      )}
    >
      {/* Pinned Marker */}
      {item.isPinned && (
        <div
          className="absolute -top-2.5 -left-1 flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-md z-10 select-none"
          title="Pinned to top of timeline"
        >
          <Pin className="h-3 w-3 fill-current" />
          <span>PINNED</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Knowledge Type Pill */}
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs',
              typeMeta.badgeColor
            )}
          >
            <KnowledgeIcon className="h-3 w-3" />
            {typeMeta.label}
          </span>

          {/* Source Badge */}
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <SourceIcon className="h-3 w-3 opacity-70" />
            {item.source.replace('_', ' ')}
          </span>

          {/* Sentiment Badge */}
          {item.sentiment && (
            <Badge
              variant="outline"
              className={cn(
                'text-[9px] h-5 px-1.5 font-bold uppercase',
                item.sentiment === 'positive' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400',
                item.sentiment === 'negative' && 'bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400',
                item.sentiment === 'urgent' && 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400 animate-pulse',
                item.sentiment === 'neutral' && 'bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-400'
              )}
            >
              {item.sentiment}
            </Badge>
          )}

          {/* Deal Association Badge */}
          {item.links.dealName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              <Briefcase className="h-2.5 w-2.5" />
              <span className="truncate max-w-[120px]">{item.links.dealName}</span>
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onTogglePin && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-lg transition-colors',
                item.isPinned ? 'text-amber-500 hover:bg-amber-500/10' : 'text-muted-foreground hover:text-amber-500'
              )}
              onClick={() => onTogglePin(item)}
              title={item.isPinned ? 'Unpin item' : 'Pin to top'}
              aria-label="Toggle pin"
            >
              {item.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </Button>
          )}

          {item.editable && isAuthor && !isEditing && onUpdateContent && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => {
                setEditContent(item.content);
                setIsEditing(true);
              }}
              title="Edit note"
              aria-label="Edit note"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}

          {onDelete && isAuthor && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
              title="Delete item"
              aria-label="Delete item"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}

          {item.originHref && (
            <Link
              href={item.originHref}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-primary transition-colors"
              title="Open full record in Company Brain"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Title */}
      {item.title && item.title !== item.content && (
        <h4 className="text-sm font-semibold text-foreground mb-1 leading-snug">
          {item.title}
        </h4>
      )}

      {/* Body Content */}
      {isEditing ? (
        <div className="space-y-3 mt-2">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[100px] text-xs resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg h-8 text-xs"
              onClick={() => setIsEditing(false)}
              disabled={isSavingEdit}
            >
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              className="rounded-lg h-8 text-xs bg-primary text-primary-foreground"
              onClick={handleSaveEdit}
              disabled={!editContent.trim() || isSavingEdit}
            >
              {isSavingEdit ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-foreground/85 whitespace-pre-wrap leading-relaxed">
          {item.content}
        </p>
      )}

      {/* Extracted Action Items */}
      {item.actionItems && item.actionItems.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-border/40 space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <CheckSquare className="h-3 w-3 text-rose-500" /> Action Items & Tasks
          </p>
          <div className="space-y-1.5">
            {item.actionItems.map((action, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs text-foreground/90 border border-border/30"
              >
                <div className="flex items-center gap-2 truncate">
                  <div className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="truncate">{action}</span>
                </div>
                {onCreateTask && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md shrink-0 gap-1 active:scale-[0.97]"
                    onClick={() => handleCreateTask(action, idx)}
                    disabled={creatingTaskIndex === idx}
                  >
                    {creatingTaskIndex === idx ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <PlusCircle className="h-2.5 w-2.5" />
                    )}
                    Convert to Task
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          {item.tags.map((t, idx) => (
            <span
              key={idx}
              className="rounded-md bg-muted/60 px-2 py-0.5 text-[9px] font-medium text-muted-foreground border border-border/30"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-3.5 flex items-center justify-between text-[10px] text-muted-foreground pt-2.5 border-t border-border/30">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center font-bold text-[9px] text-muted-foreground">
            {item.authorName ? item.authorName.charAt(0).toUpperCase() : '?'}
          </div>
          <span>{item.authorName || 'Team Member'}</span>
        </div>
        <span>{formattedDate}</span>
      </div>
    </div>
  );
});

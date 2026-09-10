'use client';

import * as React from 'react';
import {
  Brain,
  Sparkles,
  Search,
  Plus,
  Loader2,
  ChevronDown,
  Pin,
  TrendingUp,
  ListChecks,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { useUnifiedEntityTimeline, type EntityTimelineScope } from '@/lib/hooks/use-unified-entity-timeline';
import { TimelineItemCard } from './TimelineItemCard';
import { VoiceCaptureButton } from '@/components/shared/VoiceCaptureButton';
import {
  KNOWLEDGE_TYPE_META,
} from '@/lib/quick-notes-domain';
import {
  KNOWLEDGE_TYPES,
  type KnowledgeType,
  type CRMKnowledgeTimelineItem,
} from '@/lib/quick-notes-types';

export interface KnowledgeTimelineProps {
  workspaceId: string | null | undefined;
  organizationId?: string | null;
  by: EntityTimelineScope;
  recordId: string;
  recordName?: string;
  entityId?: string; // Optional parent entity ID (e.g. for deals)
  className?: string;
  compact?: boolean;
}

export default function KnowledgeTimeline({
  workspaceId,
  organizationId,
  by,
  recordId,
  recordName,
  entityId,
  className,
  compact = false,
}: KnowledgeTimelineProps) {
  const { user } = useUser();
  const [showComposer, setShowComposer] = React.useState(!compact);
  const [newNoteText, setNewNoteText] = React.useState('');
  const [selectedType, setSelectedType] = React.useState<KnowledgeType>('note');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showAiBrief, setShowAiBrief] = React.useState(true);
  const [typeDropdownOpen, setTypeDropdownOpen] = React.useState(false);

  const {
    items,
    filteredItems,
    groupedItems,
    isLoading,
    filter,
    setFilter,
    aiBrief,
    isGeneratingBrief,
    generateAiBrief,
    addNote,
    togglePin,
    deleteItem,
    updateNoteContent,
    createTaskFromActionItem,
  } = useUnifiedEntityTimeline({
    workspaceId,
    organizationId,
    by,
    recordId,
    recordName,
    entityId,
  });

  const handleCreateNote = async () => {
    if (!newNoteText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const ok = await addNote(newNoteText, selectedType);
      if (ok) {
        setNewNoteText('');
        if (compact) setShowComposer(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoiceTranscript = (transcript: string) => {
    setNewNoteText((prev) => (prev ? `${prev} ${transcript}` : transcript));
  };

  return (
    <div className={cn('space-y-5 text-left', className)}>
      {/* Top Search & Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/50 p-3 backdrop-blur-md">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
          <input
            type="text"
            placeholder={`Search knowledge for ${recordName || 'this record'}...`}
            value={filter.searchQuery}
            onChange={(e) => setFilter((prev) => ({ ...prev, searchQuery: e.target.value }))}
            className="w-full bg-background border border-border/40 text-foreground placeholder:text-muted-foreground/60 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
          {/* Pinned filter toggle */}
          <button
            onClick={() => setFilter((prev) => ({ ...prev, onlyPinned: !prev.onlyPinned }))}
            className={cn(
              'inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border transition-all select-none shrink-0 min-h-[36px]',
              filter.onlyPinned
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                : 'border-border/40 bg-background text-muted-foreground hover:text-foreground'
            )}
            title="Show only pinned knowledge"
          >
            <Pin className="h-3.5 w-3.5" />
            <span>Pinned</span>
          </button>

          {/* AI Brief Trigger */}
          <Button
            variant="outline"
            size="sm"
            onClick={generateAiBrief}
            disabled={isGeneratingBrief || items.length === 0}
            className="h-9 px-3 rounded-xl border-primary/30 text-primary hover:bg-primary/10 gap-1.5 text-xs font-bold shrink-0 min-h-[36px]"
          >
            {isGeneratingBrief ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {aiBrief ? 'Refresh Brief' : 'AI Brief'}
          </Button>

          {/* Contextual Composer Toggle */}
          <Button
            onClick={() => setShowComposer(!showComposer)}
            className={cn(
              'rounded-xl text-xs font-bold h-9 px-4 shadow-sm gap-1.5 transition-all select-none shrink-0 min-h-[36px]',
              showComposer
                ? 'bg-muted text-foreground border border-border hover:bg-muted/80'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            <Plus className={cn('h-3.5 w-3.5 transition-transform', showComposer && 'rotate-45')} />
            {showComposer ? 'Close' : 'Add Knowledge'}
          </Button>
        </div>
      </div>

      {/* Semantic Knowledge Type Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        <button
          onClick={() => setFilter((prev) => ({ ...prev, type: 'all' }))}
          className={cn(
            'px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors shrink-0 select-none border',
            filter.type === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted/50 border-border/40 text-muted-foreground hover:text-foreground'
          )}
        >
          All ({items.length})
        </button>

        {KNOWLEDGE_TYPES.map((kt: KnowledgeType) => {
          const meta = KNOWLEDGE_TYPE_META[kt];
          const count = items.filter((i) => i.knowledgeType === kt).length;
          if (count === 0 && filter.type !== kt) return null;

          return (
            <button
              key={kt}
              onClick={() => setFilter((prev) => ({ ...prev, type: kt }))}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors shrink-0 select-none border',
                filter.type === kt
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/40 border-border/40 text-muted-foreground hover:text-foreground'
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', meta.dotColor)} />
              {meta.label} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Contextual Composer Accordion */}
      {showComposer && (
        <div className="rounded-2xl border border-primary/25 bg-card p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
          <div className="flex items-center justify-between border-b border-border/30 pb-2">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground">
                Capture Knowledge for {recordName || 'this record'}
              </span>
            </div>
            <VoiceCaptureButton
              onTranscript={handleVoiceTranscript}
              className="h-7 px-2.5 text-[11px]"
            />
          </div>

          <Textarea
            placeholder="Type observations, customer statements, decisions, ideas, or action items..."
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            className="min-h-[90px] text-xs resize-none"
            autoFocus={compact}
          />

          <div className="flex items-center justify-between pt-1 relative">
            {/* Knowledge Type Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border border-border/60 bg-muted hover:bg-muted/80 text-foreground transition-all select-none min-h-[32px]"
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', KNOWLEDGE_TYPE_META[selectedType].dotColor)} />
                <span>{KNOWLEDGE_TYPE_META[selectedType].label}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>

              {typeDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-44 bg-popover border border-border rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1">
                  {KNOWLEDGE_TYPES.map((kt: KnowledgeType) => {
                    const meta = KNOWLEDGE_TYPE_META[kt];
                    return (
                      <button
                        key={kt}
                        type="button"
                        onClick={() => {
                          setSelectedType(kt);
                          setTypeDropdownOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs font-medium hover:bg-muted transition-colors',
                          selectedType === kt ? 'text-primary font-bold bg-muted/40' : 'text-foreground/80'
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', meta.dotColor)} />
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <Button
              onClick={handleCreateNote}
              disabled={!newNoteText.trim() || isSubmitting}
              className="rounded-xl h-8 px-4 font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm active:scale-[0.98]"
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Save Knowledge
            </Button>
          </div>
        </div>
      )}

      {/* AI Intelligence Brief Section */}
      {aiBrief && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 shadow-sm relative overflow-hidden space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">AI Intelligence Brief</h4>
                <p className="text-[10px] text-muted-foreground">Synthesized from {aiBrief.itemCount} timeline records</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'text-[9px] h-5 px-1.5 font-bold uppercase',
                  aiBrief.recentSentiment === 'positive' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
                  aiBrief.recentSentiment === 'negative' && 'bg-rose-500/10 text-rose-600 border-rose-500/30',
                  aiBrief.recentSentiment === 'urgent' && 'bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse',
                  aiBrief.recentSentiment === 'neutral' && 'bg-slate-500/10 text-slate-600 border-slate-500/30'
                )}
              >
                Sentiment: {aiBrief.recentSentiment}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAiBrief(!showAiBrief)}
                className="h-7 px-2 text-[10px] font-bold text-muted-foreground"
              >
                {showAiBrief ? 'Collapse' : 'Expand'}
              </Button>
            </div>
          </div>

          {showAiBrief && (
            <div className="space-y-4 pt-1">
              <p className="text-xs text-foreground/90 italic font-medium border-l-2 border-primary/50 pl-3 py-0.5 leading-relaxed">
                &quot;{aiBrief.executiveSummary}&quot;
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {aiBrief.keyThemes?.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="h-3 w-3" /> Key Themes
                    </h5>
                    <ul className="space-y-1">
                      {aiBrief.keyThemes.map((theme, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="text-primary mt-1">•</span>
                          <span>{theme}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiBrief.actionItems?.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <ListChecks className="h-3 w-3" /> Recommended Actions
                    </h5>
                    <ul className="space-y-1">
                      {aiBrief.actionItems.map((action, idx) => (
                        <li key={idx} className="text-xs text-foreground/85 font-medium flex items-start gap-1.5">
                          <span className="text-rose-500 mt-1">✓</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline Stream */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-card p-5 space-y-2.5">
                <Skeleton className="h-4 w-1/4 rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-3/4 rounded" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border/50 bg-card/20 py-12 px-4 text-center space-y-3">
            <div className="h-10 w-10 rounded-full bg-muted/60 mx-auto flex items-center justify-center text-muted-foreground">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No knowledge entries found</p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm mx-auto">
                {filter.searchQuery || filter.type !== 'all' || filter.onlyPinned
                  ? 'Try clearing your search query or filters to view all entries.'
                  : `Start recording notes, decisions, feedback, or meetings for ${recordName || 'this record'}.`}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowComposer(true)}
              className="rounded-xl h-8 px-3 text-xs font-bold gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add First Note
            </Button>
          </div>
        ) : (
          groupedItems.map((group) => (
            <div key={group.period} className="space-y-3">
              {/* Period Date Header */}
              <div className="sticky top-0 z-10 flex items-center gap-2 py-1 bg-background/80 backdrop-blur-md">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  {group.period}
                </span>
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {group.items.length} {group.items.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>

              {/* Items */}
              <div className="space-y-3 pl-1 sm:pl-2">
                {group.items.map((item: CRMKnowledgeTimelineItem) => (
                  <TimelineItemCard
                    key={item.id}
                    item={item}
                    currentUserId={user?.uid}
                    onTogglePin={togglePin}
                    onDelete={deleteItem}
                    onUpdateContent={updateNoteContent}
                    onCreateTask={createTaskFromActionItem}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

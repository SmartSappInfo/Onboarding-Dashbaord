'use client';

import * as React from 'react';
import { 
  X, 
  Minus, 
  Brain, 
  Loader2, 
  Notebook,
  Lightbulb,
  Sparkles,
  CheckCircle2,
  MessageSquareQuote,
  Eye,
  CheckSquare,
  BookOpen,
  Compass,
  ChevronDown,
  FolderClosed,
  Check,
  LayoutTemplate,
  Wand2,
  XCircle,
  Link2
} from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useFloatingNotes } from '@/context/FloatingNotesContext';
import { 
  createQuickNote, 
  useNoteCategories,
  useKnowledgeTemplates 
} from '@/lib/quick-notes-hooks';
import { 
  plainTextToTipTap, 
  deriveTitleFromText, 
  KNOWLEDGE_TYPE_META,
  normalizeKnowledgeType,
  extractPlainText 
} from '@/lib/quick-notes-domain';
import type { KnowledgeType, KnowledgeClassificationResult, NoteDocument } from '@/lib/quick-notes-types';
import { classifyDraftKnowledgeAction } from '@/lib/quick-notes-ai-actions';
import { DEFAULT_TEMPLATE_PRESETS } from '@/lib/knowledge-template-presets';
import { VoiceCaptureButton } from '@/components/shared/VoiceCaptureButton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { categorySwatch } from '@/app/admin/quick-notes/components/quick-notes-ui';

// Semantic knowledge type configuration with icons
const KNOWLEDGE_OPTIONS: Array<{ id: KnowledgeType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'note', label: 'Note', icon: Notebook },
  { id: 'idea', label: 'Idea', icon: Lightbulb },
  { id: 'insight', label: 'Insight', icon: Sparkles },
  { id: 'decision', label: 'Decision', icon: CheckCircle2 },
  { id: 'feedback', label: 'Feedback', icon: MessageSquareQuote },
  { id: 'observation', label: 'Observation', icon: Eye },
  { id: 'action', label: 'Action', icon: CheckSquare },
  { id: 'research', label: 'Research', icon: BookOpen },
  { id: 'strategy', label: 'Strategy', icon: Compass },
];

export default function FloatingNotesHUD() {
  const { 
    isOpen, 
    isMinimized, 
    draftText, 
    activeEntityId,
    activeEntityName,
    close, 
    minimize, 
    restore, 
    setDraftText,
    setEntityContext 
  } = useFloatingNotes();

  const { user } = useUser();
  const firestore = useFirestore();
  const { activeOrganizationId, activeWorkspaceId } = useTenant();
  const { toast } = useToast();

  // Lazy-fetch workspace note categories & templates only when HUD is active
  const { data: rawCategories } = useNoteCategories(isOpen ? activeWorkspaceId : null);
  const categories = React.useMemo(() => rawCategories ?? [], [rawCategories]);

  const { data: rawTemplates } = useKnowledgeTemplates(isOpen ? activeWorkspaceId : null);
  const templates = React.useMemo(() => rawTemplates ?? [], [rawTemplates]);

  // Knowledge type state (default to 'note')
  const [knowledgeType, setKnowledgeType] = React.useState<KnowledgeType>('note');
  const [categoryId, setCategoryId] = React.useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isClassifying, setIsClassifying] = React.useState(false);
  const [aiSuggestion, setAiSuggestion] = React.useState<KnowledgeClassificationResult | null>(null);
  const [isMobile, setIsMobile] = React.useState(false);
  const [isSavingDraft, setIsSavingDraft] = React.useState(false);

  // Selected category resolution
  const selectedCategory = React.useMemo(
    () => (categoryId ? categories.find((c) => c.id === categoryId) : undefined),
    [categories, categoryId]
  );

  // Position coordinates refs for non-re-rendering dragging
  const panelRef = React.useRef<HTMLDivElement>(null);
  const positionRef = React.useRef({ x: 100, y: 100 });
  const isDraggingRef = React.useRef(false);
  const dragStartRef = React.useRef({ x: 0, y: 0 });
  const initialOffsetRef = React.useRef({ x: 0, y: 0 });
  const saveTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Keyboard accessibility: Escape key closes the HUD
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isMinimized) {
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMinimized, close]);

  // Responsive boundary checking on resize
  React.useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && panelRef.current) {
        panelRef.current.style.transform = 'none';
      } else if (panelRef.current) {
        const rightPos = window.innerWidth - 380 - 24;
        const bottomPos = window.innerHeight - 360 - 24;
        positionRef.current = { x: rightPos, y: bottomPos };
        panelRef.current.style.transform = `translate3d(${rightPos}px, ${bottomPos}px, 0)`;
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [isOpen]);

  // Flash saving indicator briefly on keydown
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftText(e.target.value);
    setIsSavingDraft(true);
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      setIsSavingDraft(false);
    }, 500);
  };

  // Voice transcript append
  const handleVoiceTranscript = (text: string) => {
    setDraftText(draftText ? `${draftText} ${text}` : text);
  };

  // AI Auto-Classify
  const handleAutoClassify = async () => {
    if (!draftText.trim()) {
      toast({ title: 'Enter some content first to auto-classify', variant: 'destructive' });
      return;
    }
    if (!activeWorkspaceId || !user?.uid) return;

    setIsClassifying(true);
    try {
      const res = await classifyDraftKnowledgeAction({
        text: draftText,
        contextHint: activeEntityName ? `Linked to entity: ${activeEntityName}` : undefined,
        workspaceId: activeWorkspaceId,
        userId: user.uid,
      });

      if (res.success && res.data) {
        setAiSuggestion(res.data);
        toast({ title: `AI detected: ${KNOWLEDGE_TYPE_META[res.data.suggestedType]?.label ?? res.data.suggestedType}` });
      } else {
        const errMsg = !res.success ? res.error : undefined;
        toast({ title: 'Classification unavailable', description: errMsg, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to classify draft', variant: 'destructive' });
    } finally {
      setIsClassifying(false);
    }
  };

  const handleApplyAiSuggestion = () => {
    if (!aiSuggestion) return;
    setKnowledgeType(aiSuggestion.suggestedType);
    if (aiSuggestion.suggestedTitle && !draftText.startsWith('#')) {
      setDraftText(`# ${aiSuggestion.suggestedTitle}\n\n${draftText}`);
    }
    setAiSuggestion(null);
    toast({ title: 'Applied AI suggestion ✓' });
  };

  const handleApplyTemplate = (templateContent: NoteDocument) => {
    const text = extractPlainText(templateContent);
    setDraftText(draftText ? `${draftText}\n\n${text}` : text);
    toast({ title: 'Template inserted ✓' });
  };

  // Draggable Pointer events
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMobile || isMinimized) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('textarea')) return;

    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialOffsetRef.current = { ...positionRef.current };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || isMobile || !panelRef.current) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    const newX = Math.max(10, Math.min(window.innerWidth - 390, initialOffsetRef.current.x + dx));
    const newY = Math.max(60, Math.min(window.innerHeight - 370, initialOffsetRef.current.y + dy));

    positionRef.current = { x: newX, y: newY };
    panelRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleSaveNote = async () => {
    if (!draftText.trim()) {
      toast({ title: 'Please enter content', variant: 'destructive' });
      return;
    }
    if (!firestore || !user || !activeWorkspaceId || !activeOrganizationId) {
      toast({ title: 'Authentication context missing — please reload', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await createQuickNote(firestore, {
        organizationId: activeOrganizationId,
        workspaceId:    activeWorkspaceId,
        createdBy:      user.uid,
        createdByName:  user.displayName ?? undefined,
        title:          deriveTitleFromText(draftText),
        content:        plainTextToTipTap(draftText),
        knowledgeType:  knowledgeType,
        categoryId:     categoryId || undefined,
        tags:           knowledgeType !== 'note' ? [knowledgeType] : [],
        links:          activeEntityId
          ? {
              entityId: activeEntityId,
              entityName: activeEntityName ?? undefined,
            }
          : {},
      });

      toast({ title: 'Captured in Company Brain ✓' });
      setDraftText('');
      setCategoryId(undefined);
      setAiSuggestion(null);
      close();
    } catch (err) {
      console.error('[FloatingNotesHUD] createQuickNote failed:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Failed to capture in Company Brain', description: message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Minimized state rendering
  if (isMinimized) {
    return (
      <div 
        onClick={restore}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[999] bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-full shadow-2xl cursor-pointer flex items-center gap-2.5 animate-in slide-in-from-bottom-8 duration-300 font-bold text-xs border border-violet-500/30 scale-95 hover:scale-100 transition-all select-none min-h-[44px]"
      >
        <Brain className="h-4 w-4 animate-pulse text-white" />
        <span>Open Company Brain ({draftText ? 'Draft active' : 'Empty'})</span>
      </div>
    );
  }

  const activeOption = KNOWLEDGE_OPTIONS.find(t => t.id === knowledgeType) || KNOWLEDGE_OPTIONS[0];
  const ActiveIcon = activeOption.icon;

  return (
    <div
      ref={panelRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={cn(
        "fixed z-[999] flex flex-col w-[380px] h-[360px] bg-popover border border-border shadow-2xl backdrop-blur-2xl transition-shadow select-none overflow-visible",
        isMobile 
          ? "bottom-0 inset-x-0 w-full h-[65vh] rounded-t-3xl border-t border-x-0 border-b-0 animate-in slide-in-from-bottom duration-300"
          : "rounded-2xl"
      )}
    >
      {/* Draggable Header */}
      <div
        onPointerDown={handlePointerDown}
        className={cn(
          "flex items-center justify-between px-4 py-2.5 bg-muted/60 border-b border-border cursor-grab active:cursor-grabbing select-none",
          isMobile ? "rounded-t-3xl" : "rounded-t-2xl"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="h-4 w-4 text-violet-500 shrink-0" />
          <span className="text-xs font-black uppercase tracking-wider text-foreground/80 truncate">Company Brain</span>
          {activeEntityName && (
            <div className="inline-flex items-center gap-1 text-[10px] text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded truncate max-w-[120px]">
              <span className="truncate">{activeEntityName}</span>
              <button
                type="button"
                onClick={() => setEntityContext(null, null)}
                className="hover:text-destructive shrink-0 ml-0.5"
                title="Detach entity context"
              >
                <XCircle className="h-3 w-3" />
              </button>
            </div>
          )}
          {isSavingDraft && (
            <span className="text-[9px] text-emerald-500 font-bold animate-pulse">Saved</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isMobile && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={minimize}
              className="h-8 w-8 md:h-7 md:w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted min-h-[32px] md:min-h-[28px]"
              aria-label="Minimize Company Brain"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={close}
            className="h-8 w-8 md:h-7 md:w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 min-h-[32px] md:min-h-[28px]"
            aria-label="Close Company Brain"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* AI Suggestion Banner */}
      {aiSuggestion && (
        <div className="bg-primary/10 border-b border-primary/20 px-3 py-1.5 flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5 truncate text-[11px] font-medium text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 animate-pulse" />
            <span className="truncate">
              Detected: <strong>{KNOWLEDGE_TYPE_META[aiSuggestion.suggestedType]?.label}</strong>
              {aiSuggestion.suggestedTitle && ` • "${aiSuggestion.suggestedTitle}"`}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleApplyAiSuggestion}
              className="text-[10px] font-bold text-primary hover:underline px-1.5 py-0.5 bg-background rounded shadow-xs"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setAiSuggestion(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Panel Body */}
      <div className="flex-1 p-3 flex flex-col justify-between text-left overflow-visible min-h-0">
        {/* Text Editor Area */}
        <div className="flex-1 flex flex-col min-h-0 relative mb-2">
          <Textarea
            placeholder="Capture knowledge, ideas, decisions, or speak with microphone..."
            value={draftText}
            onChange={handleTextChange}
            className="w-full h-full flex-1 min-h-0 text-xs resize-none focus-visible:ring-1 focus-visible:ring-violet-500 focus-visible:ring-offset-0 font-sans"
          />
        </div>

        {/* Toolbar & Actions */}
        <div className="space-y-2 pt-2 border-t border-border/40 overflow-visible">
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Knowledge Type dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer bg-muted border-border text-foreground hover:bg-muted/80 min-h-[32px]"
                  >
                    <ActiveIcon className="h-3.5 w-3.5 text-violet-500" />
                    <span>{activeOption.label}</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-36 z-[1000]">
                  {KNOWLEDGE_OPTIONS.map((t) => {
                    const Icon = t.icon;
                    return (
                      <DropdownMenuItem
                        key={t.id}
                        onClick={() => setKnowledgeType(t.id)}
                        className={cn(
                          "flex items-center gap-2 text-xs font-semibold cursor-pointer",
                          knowledgeType === t.id && "text-violet-500 bg-muted/60"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{t.label}</span>
                        {knowledgeType === t.id && <Check className="h-3.5 w-3.5 ml-auto text-violet-500" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Template selector dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer bg-muted border-border text-foreground hover:bg-muted/80 min-h-[32px]"
                    title="Insert structured template"
                  >
                    <LayoutTemplate className="h-3 w-3 text-muted-foreground" />
                    <span className="hidden sm:inline">Template</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 z-[1000] max-h-60 overflow-y-auto">
                  <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                    Preset Templates
                  </DropdownMenuLabel>
                  {DEFAULT_TEMPLATE_PRESETS.map((p) => (
                    <DropdownMenuItem
                      key={p.name}
                      onClick={() => handleApplyTemplate(p.content)}
                      className="text-xs flex flex-col items-start cursor-pointer"
                    >
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground line-clamp-1">{p.description}</span>
                    </DropdownMenuItem>
                  ))}

                  {templates.filter((t) => !t.isSystem).length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                        Custom Templates
                      </DropdownMenuLabel>
                      {templates.filter((t) => !t.isSystem).map((t) => (
                        <DropdownMenuItem
                          key={t.id}
                          onClick={() => handleApplyTemplate(t.content)}
                          className="text-xs font-semibold cursor-pointer"
                        >
                          {t.name}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Category selector */}
              {categories.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer bg-muted border-border text-foreground hover:bg-muted/80 max-w-[110px] min-h-[32px]"
                    >
                      <FolderClosed className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">
                        {selectedCategory ? selectedCategory.name : 'Category'}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44 z-[1000]">
                    <DropdownMenuItem onClick={() => setCategoryId(undefined)} className="text-xs cursor-pointer">
                      No category
                    </DropdownMenuItem>
                    {categories.map((c) => (
                      <DropdownMenuItem
                        key={c.id}
                        onClick={() => setCategoryId(c.id)}
                        className="text-xs flex items-center justify-between cursor-pointer"
                      >
                        <span className="truncate">{c.name}</span>
                        {categoryId === c.id && <Check className="h-3.5 w-3.5 text-primary" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Right Tools: Voice & AI Classify */}
            <div className="flex items-center gap-1">
              <VoiceCaptureButton onTranscript={handleVoiceTranscript} size="sm" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAutoClassify}
                disabled={isClassifying || !draftText.trim()}
                className="h-8 px-2 text-xs font-semibold gap-1 text-primary hover:bg-primary/10 min-h-[32px]"
                title="AI Auto-Classify"
              >
                {isClassifying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Classify</span>
              </Button>
            </div>
          </div>

          {/* Submit Capture Button */}
          <Button
            type="button"
            onClick={handleSaveNote}
            disabled={isSubmitting || !draftText.trim()}
            className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5 shadow-md min-h-[36px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Capturing…</span>
              </>
            ) : (
              <span>Capture to Company Brain</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

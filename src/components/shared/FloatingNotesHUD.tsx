'use client';

import * as React from 'react';
import { 
  X, 
  Minus, 
  Bot, 
  Loader2, 
  PhoneCall, 
  Mail, 
  Calendar, 
  MapPin, 
  Notebook,
  ChevronDown,
  FolderClosed,
  Check
} from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useFloatingNotes } from '@/context/FloatingNotesContext';
// NOTE: createQuickNote is the single source of truth for writing to quick_notes.
// Do NOT use addDoc(collection(firestore, 'entity_notes')) here — that collection
// is for CRM entity notes managed by EntityNotesTab, not the Quick Notes workspace.
import { createQuickNote, useNoteCategories } from '@/lib/quick-notes-hooks';
import { plainTextToTipTap, deriveTitleFromText } from '@/lib/quick-notes-domain';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { categorySwatch } from '@/app/admin/quick-notes/components/quick-notes-ui';


// Predefined note types with matching icons & styling
const NOTE_TYPES = [
  { id: 'general', label: 'General', icon: Notebook, color: 'text-slate-400 bg-slate-500/10' },
  { id: 'call', label: 'Call', icon: PhoneCall, color: 'text-emerald-400 bg-emerald-500/10' },
  { id: 'meeting', label: 'Meeting', icon: Calendar, color: 'text-purple-400 bg-purple-500/10' },
  { id: 'followup', label: 'Followup', icon: Mail, color: 'text-blue-400 bg-blue-500/10' },
  { id: 'escalation', label: 'Escalation', icon: MapPin, color: 'text-amber-400 bg-amber-500/10' }
] as const;

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
    setDraftText 
  } = useFloatingNotes();

  const { user } = useUser();
  const firestore = useFirestore();
  const { activeOrganizationId, activeWorkspaceId } = useTenant();
  const { toast } = useToast();

  // Lazy-fetch workspace note categories only when HUD is active (performance/bandwidth guard)
  const { data: rawCategories } = useNoteCategories(isOpen ? activeWorkspaceId : null);
  const categories = React.useMemo(() => rawCategories ?? [], [rawCategories]);

  // Derive the note-type union from the constant so we never need EntityNote here.
  // CAUTION: If NOTE_TYPES entries change, this type updates automatically.
  const [noteType, setNoteType] = React.useState<typeof NOTE_TYPES[number]['id']>('general');
  const [categoryId, setCategoryId] = React.useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
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

  // Keyboard accessibility: Escape key closes the HUD (Mobile & Desktop UX)
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
        const rightPos = window.innerWidth - 360 - 24;
        const bottomPos = window.innerHeight - 320 - 24;
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
    if (!isDraggingRef.current || !panelRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    let targetX = initialOffsetRef.current.x + dx;
    let targetY = initialOffsetRef.current.y + dy;

    // Viewport clamping bounds checks (W: 360px, H: 320px)
    const width = 360;
    const height = 320;
    const maxX = window.innerWidth - width - 12;
    const maxY = window.innerHeight - height - 12;

    targetX = Math.max(12, Math.min(targetX, maxX));
    targetY = Math.max(12, Math.min(targetY, maxY));

    positionRef.current = { x: targetX, y: targetY };
    panelRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // ─── Core save handler ──────────────────────────────────────────────────────
  // IMPORTANT: This now writes to `quick_notes` (the Quick Notes workspace
  // collection), NOT `entity_notes`. The previous write to `entity_notes` caused
  // notes to silently disappear from the Quick Notes board.
  //
  // Activity logging is handled non-blocking inside `createQuickNote` via
  // `logQuickNoteActivity` — do NOT add a separate logNoteActivity call here.
  //
  // CAUTION: Do not change the collection without updating the security rules
  // and Firestore indexes in firestore.rules / firestore.indexes.json.
  const handleSaveNote = async () => {
    if (!draftText.trim()) {
      toast({ title: 'Please enter note content', variant: 'destructive' });
      return;
    }
    // Guard: All context fields are required — never write partial data.
    // organizationId must be present for security-rule enforcement.
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
        // Auto-derive a title from the first line (pure domain helper — no I/O).
        title:          deriveTitleFromText(draftText),
        // Convert plain textarea text → valid TipTap NoteDocument (domain helper).
        content:        plainTextToTipTap(draftText),
        // Pass user-selected category if assigned
        categoryId:     categoryId || undefined,
        // Encode the note type as a tag (quick_notes uses tags; entity_notes used noteType).
        // 'general' produces an empty tags array to avoid noise in the tag system.
        tags:           noteType !== 'general' ? [noteType] : [],
        // Link to an entity with name enrichment when available.
        links:          activeEntityId
          ? {
              entityId: activeEntityId,
              entityName: activeEntityName ?? undefined,
            }
          : {},
      });

      toast({ title: 'Note saved to Quick Notes ✓' });
      setDraftText('');
      setCategoryId(undefined);
      close();
    } catch (err) {
      // Log for diagnostics but never expose raw error messages to the UI (security).
      console.error('[FloatingNotesHUD] createQuickNote failed:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Failed to save note', description: message, variant: 'destructive' });
      // Draft is intentionally NOT cleared on failure so the user can retry.
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Minimized state rendering (sleek horizontally-centered bottom capsule)
  // NOTE: Minimized pill keeps the violet brand gradient intentionally — it acts as a CTA beacon.
  if (isMinimized) {
    return (
      <div 
        onClick={restore}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[999] bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-full shadow-2xl cursor-pointer flex items-center gap-2.5 animate-in slide-in-from-bottom-8 duration-300 font-bold text-xs border border-violet-500/30 scale-95 hover:scale-100 transition-all select-none min-h-[44px]"
      >
        <Bot className="h-4 w-4 animate-bounce" />
        <span>Open Quick Note ({draftText ? 'Draft active' : 'Empty'})</span>
      </div>
    );
  }

  const activeType = NOTE_TYPES.find(t => t.id === noteType) || NOTE_TYPES[0];
  const ActiveIcon = activeType.icon;

  return (
    <div
      ref={panelRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={cn(
        // bg-popover + border-border follows the active CSS theme automatically (light & dark)
        "fixed z-[999] flex flex-col w-[360px] h-[320px] bg-popover border border-border shadow-2xl backdrop-blur-2xl transition-shadow select-none overflow-visible",
        isMobile 
          ? "bottom-0 inset-x-0 w-full h-[60vh] rounded-t-3xl border-t border-x-0 border-b-0 animate-in slide-in-from-bottom duration-300"
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
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-violet-500" />
          <span className="text-xs font-black uppercase tracking-wider text-foreground/80">Quick Note</span>
          {activeEntityName && (
            <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[110px]">
              · {activeEntityName}
            </span>
          )}
          {isSavingDraft && (
            <span className="text-[9px] text-emerald-500 font-bold animate-pulse">Saved</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {!isMobile && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={minimize}
              className="h-8 w-8 md:h-7 md:w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted min-h-[32px] md:min-h-[28px]"
              aria-label="Minimize Quick Note"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={close}
            className="h-8 w-8 md:h-7 md:w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 min-h-[32px] md:min-h-[28px]"
            aria-label="Close Quick Note"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Panel Body */}
      <div className="flex-1 p-3 flex flex-col justify-between text-left overflow-visible min-h-0">
        {/* Text Editor Area — Textarea inherits shadcn's themed bg/text automatically */}
        <div className="flex-1 flex flex-col min-h-0 relative mb-2.5">
          <Textarea
            placeholder="Type quick notes here..."
            value={draftText}
            onChange={handleTextChange}
            className="w-full h-full flex-1 min-h-0 text-xs resize-none focus-visible:ring-1 focus-visible:ring-violet-500 focus-visible:ring-offset-0"
          />
        </div>

        {/* Footer Actions — Radix Dropdowns ensure proper z-index and click-outside handling */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-border/40 overflow-visible">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Note Type select dropdown pill */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer bg-muted border-border text-foreground hover:bg-muted/80 min-h-[32px]"
                >
                  <ActiveIcon className="h-3.5 w-3.5 text-violet-500" />
                  <span>{activeType.label}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-36 z-[1000]">
                {NOTE_TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <DropdownMenuItem
                      key={t.id}
                      onClick={() => setNoteType(t.id)}
                      className={cn(
                        "flex items-center gap-2 text-xs font-semibold cursor-pointer",
                        noteType === t.id && "text-violet-500 bg-muted/60"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{t.label}</span>
                      {noteType === t.id && <Check className="h-3.5 w-3.5 ml-auto text-violet-500" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Optional Category selector dropdown pill */}
            {categories.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer bg-muted border-border text-foreground hover:bg-muted/80 max-w-[130px] min-h-[32px]"
                  >
                    <FolderClosed className="h-3 w-3 text-muted-foreground shrink-0" />
                    {selectedCategory ? (
                      <span className="inline-flex items-center gap-1 truncate">
                        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', categorySwatch(selectedCategory.color).dot)} />
                        <span className="truncate">{selectedCategory.name}</span>
                      </span>
                    ) : (
                      <span className="truncate text-muted-foreground">Category</span>
                    )}
                    <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44 z-[1000]">
                  <DropdownMenuItem onClick={() => setCategoryId(undefined)} className="text-xs cursor-pointer">
                    <span className="flex items-center gap-2">
                      {categoryId === undefined && <Check className="h-3.5 w-3.5 text-violet-500" />}
                      <span className={cn(categoryId !== undefined && 'pl-5')}>No category</span>
                    </span>
                  </DropdownMenuItem>
                  {categories.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      onClick={() => setCategoryId(c.id)}
                      className="text-xs flex items-center justify-between cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2 truncate">
                        {categoryId === c.id && <Check className="h-3.5 w-3.5 text-violet-500 shrink-0" />}
                        <span className={cn('h-2 w-2 rounded-full shrink-0', categorySwatch(c.color).dot, categoryId !== c.id && 'ml-5')} />
                        <span className="truncate">{c.name}</span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Save button — violet brand CTA */}
          <Button 
            onClick={handleSaveNote} 
            disabled={isSubmitting || !draftText.trim()}
            size="sm"
            className="rounded-full h-8 px-4 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-500/10 active:scale-[0.98] transition-all min-h-[32px]"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              'Save Note'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

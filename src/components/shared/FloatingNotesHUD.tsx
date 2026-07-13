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
  ChevronDown
} from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useFloatingNotes } from '@/context/FloatingNotesContext';
import { collection, addDoc } from 'firebase/firestore';
import { logNoteActivity } from '@/lib/note-actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { EntityNote } from '@/lib/types';

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
    close, 
    minimize, 
    restore, 
    setDraftText 
  } = useFloatingNotes();

  const { user } = useUser();
  const firestore = useFirestore();
  const { activeOrganizationId, activeWorkspaceId } = useTenant();
  const { toast } = useToast();

  const [noteType, setNoteType] = React.useState<NonNullable<EntityNote['noteType']>>('general');
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [isSavingDraft, setIsSavingDraft] = React.useState(false);

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

  // Note save operation
  const handleSaveNote = async () => {
    if (!draftText.trim()) {
      toast({ title: 'Please enter note content', variant: 'destructive' });
      return;
    }
    if (!firestore || !user || !activeWorkspaceId) {
      toast({ title: 'Authentication context missing', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const noteData = {
        entityId: activeEntityId || activeWorkspaceId || 'general',
        workspaceId: activeWorkspaceId,
        content: draftText.trim(),
        noteType,
        isPinned: false,
        createdBy: user.uid,
        createdByName: user.displayName || 'Unknown User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addDoc(collection(firestore, 'entity_notes'), noteData);

      // Trigger non-blocking feed activity logging
      await logNoteActivity(noteData as any, activeOrganizationId || 'default');

      toast({ title: 'Floating note added successfully' });
      setDraftText('');
      close();
    } catch (err: any) {
      console.error('Error saving floating note:', err);
      toast({ title: 'Failed to save note', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Minimized state rendering (sleek horizontally-centered bottom capsule)
  if (isMinimized) {
    return (
      <div 
        onClick={restore}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[999] bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-full shadow-2xl cursor-pointer flex items-center gap-2.5 animate-in slide-in-from-bottom-8 duration-300 font-bold text-xs border border-violet-500/30 scale-95 hover:scale-100 transition-all select-none"
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
        "fixed z-[999] flex flex-col w-[360px] h-[320px] bg-slate-950/95 border border-slate-800 shadow-2xl backdrop-blur-2xl transition-shadow select-none overflow-visible",
        isMobile 
          ? "bottom-0 inset-x-0 w-full h-[60vh] rounded-t-3xl border-t border-x-0 border-b-0 animate-in slide-in-from-bottom duration-300"
          : "rounded-2xl"
      )}
      style={{
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px 1px rgba(99, 102, 241, 0.05)'
      }}
    >
      {/* Draggable Header */}
      <div
        onPointerDown={handlePointerDown}
        className={cn(
          "flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800/80 cursor-grab active:cursor-grabbing select-none",
          isMobile ? "rounded-t-3xl" : "rounded-t-2xl"
        )}
      >
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-violet-400" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-300">Quick Note</span>
          {isSavingDraft && (
            <span className="text-[9px] text-emerald-400 font-bold animate-pulse">Saved</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {!isMobile && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={minimize}
              className="h-6 w-6 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={close}
            className="h-6 w-6 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Panel Body */}
      <div className="flex-1 p-3 flex flex-col justify-between text-left overflow-visible">
        {/* Text Editor Area (Largest component) */}
        <div className="flex-1 flex flex-col min-h-0 relative mb-3">
          <Textarea
            placeholder="Type quick notes here..."
            value={draftText}
            onChange={handleTextChange}
            className="w-full h-full flex-1 bg-slate-900/60 border-slate-850 rounded-xl text-xs p-3 text-slate-200 placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-violet-500 focus-visible:ring-offset-0 resize-none"
          />
        </div>

        {/* Footer Actions (Select Type Pill and smaller Save button) */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-850/50 overflow-visible">
          {/* Note Type select dropdown pill */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer bg-slate-900 border-slate-800 text-slate-300 hover:text-slate-100 hover:border-slate-700"
              )}
            >
              <ActiveIcon className="h-3.5 w-3.5" />
              <span>{activeType.label}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {dropdownOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-36 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-[999] animate-in fade-in slide-in-from-bottom-2 duration-200">
                {NOTE_TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setNoteType(t.id);
                        setDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] font-bold hover:bg-slate-800 transition-colors",
                        noteType === t.id ? "text-violet-400 bg-slate-800/40" : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Smaller, compact save button */}
          <Button 
            onClick={handleSaveNote} 
            disabled={isSubmitting || !draftText.trim()}
            size="sm"
            className="rounded-full h-8 px-4 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-500/10 active:scale-[0.98] transition-all"
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

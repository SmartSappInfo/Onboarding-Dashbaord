'use client';

import * as React from 'react';
import { 
  X, 
  Minus, 
  Bot, 
  Loader2, 
  CheckSquare, 
  PhoneCall, 
  Mail, 
  Calendar, 
  MapPin, 
  Notebook,
  ChevronsUpDown,
  Check
} from 'lucide-react';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useFloatingNotes } from '@/context/FloatingNotesContext';
import { collection, query, where, getDocs, getDoc, doc, addDoc, limit } from 'firebase/firestore';
import { logNoteActivity } from '@/lib/note-actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  const [entities, setEntities] = React.useState<{ id: string; name: string }[]>([]);
  const [selectedEntityId, setSelectedEntityId] = React.useState<string>('');
  const [selectedEntityName, setSelectedEntityName] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [isSavingDraft, setIsSavingDraft] = React.useState(false);

  // Position coordinates refs for non-re-rendering dragging
  const panelRef = React.useRef<HTMLDivElement>(null);
  const positionRef = React.useRef({ x: 100, y: 100 }); // Default relative offsets
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

  // Responsive boundary checking on mount & resize
  React.useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && panelRef.current) {
        panelRef.current.style.transform = 'none';
      } else if (panelRef.current) {
        // Place initial coordinates in viewport bottom-right
        const rightPos = window.innerWidth - 380 - 24;
        const bottomPos = window.innerHeight - 440 - 24;
        positionRef.current = { x: rightPos, y: bottomPos };
        panelRef.current.style.transform = `translate3d(${rightPos}px, ${bottomPos}px, 0)`;
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch recent entities list for linking
  React.useEffect(() => {
    const loadEntities = async () => {
      if (!firestore || !activeOrganizationId) return;
      try {
        const q = query(
          collection(firestore, 'schools'),
          where('organizationId', '==', activeOrganizationId),
          limit(15)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name as string || 'Unnamed School'
        }));
        setEntities(list);
      } catch (err) {
        console.error('Error loading HUD entities:', err);
      }
    };
    if (isOpen) loadEntities();
  }, [firestore, activeOrganizationId, isOpen]);

  // Sync selected entity context when path-parsed entity ID changes
  React.useEffect(() => {
    const loadSelectedEntity = async () => {
      if (!firestore) return;
      if (activeEntityId) {
        try {
          const snap = await getDoc(doc(firestore, 'schools', activeEntityId));
          if (snap.exists()) {
            setSelectedEntityName(snap.data().name as string || 'Unnamed School');
            setSelectedEntityId(activeEntityId);
          }
        } catch (err) {
          console.error('Error fetching target entity metadata:', err);
        }
      } else {
        setSelectedEntityName('');
        setSelectedEntityId('');
      }
    };
    loadSelectedEntity();
  }, [activeEntityId, firestore]);

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
    // Do not trigger drag on buttons or form fields
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

    // Viewport clamping bounds checks
    const width = 380;
    const height = 400;
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
    if (!selectedEntityId) {
      toast({ title: 'Please select an entity to link this note', variant: 'destructive' });
      return;
    }
    if (!firestore || !user || !activeWorkspaceId) {
      toast({ title: 'Authentication context missing', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const noteData = {
        entityId: selectedEntityId,
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

  // Minimized state rendering (sleek bottom capsule)
  if (isMinimized) {
    return (
      <div 
        onClick={restore}
        className="fixed bottom-6 right-6 z-[999] bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-full shadow-2xl cursor-pointer flex items-center gap-2.5 animate-in slide-in-from-bottom-8 duration-300 font-bold text-xs border border-violet-500/30 scale-95 hover:scale-100 transition-all select-none"
      >
        <Bot className="h-4 w-4 animate-bounce" />
        <span>Open Quick Note ({draftText ? 'Draft active' : 'Empty'})</span>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={cn(
        "fixed z-[999] flex flex-col w-[380px] h-[420px] bg-slate-950/95 border border-slate-800 shadow-2xl backdrop-blur-2xl transition-shadow select-none",
        isMobile 
          ? "bottom-0 inset-x-0 w-full h-[85vh] rounded-t-3xl border-t border-x-0 border-b-0 animate-in slide-in-from-bottom duration-300"
          : "rounded-2xl select-none"
      )}
      style={{
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px 1px rgba(99, 102, 241, 0.05)'
      }}
    >
      {/* Draggable Header */}
      <div
        onPointerDown={handlePointerDown}
        className={cn(
          "flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800/80 cursor-grab active:cursor-grabbing select-none",
          isMobile ? "rounded-t-3xl" : "rounded-t-2xl"
        )}
      >
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-violet-400" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-300">Quick Note</span>
          {isSavingDraft && (
            <span className="text-[9px] text-emerald-400 font-bold animate-pulse">Autosaving...</span>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col justify-between text-left">
        <div className="space-y-4 flex-1 flex flex-col">
          {/* Note Type Badges */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Note Type</span>
            <div className="flex flex-wrap gap-1.5">
              {NOTE_TYPES.map((t) => {
                const Icon = t.icon;
                const active = noteType === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setNoteType(t.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer",
                      active 
                        ? cn(t.color, "border-current ring-1 ring-current/20 scale-[0.97]") 
                        : "border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 bg-transparent"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Linked Entity Dropdown */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Linked Account</span>
            {activeEntityId ? (
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800/80 px-3 py-2 rounded-xl text-xs text-slate-200">
                <Check className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold truncate">{selectedEntityName || 'Loading linked context...'}</span>
                <span className="ml-auto text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-black uppercase">Active Path</span>
              </div>
            ) : (
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="">-- Link to an account --</option>
                {entities.map(ent => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Text Editor Area */}
          <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Note Content</span>
            <Textarea
              placeholder="Start drafting quick notes..."
              value={draftText}
              onChange={handleTextChange}
              className="flex-1 bg-slate-900 border-slate-800/80 rounded-xl text-xs p-3 text-slate-200 placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-violet-500 focus-visible:ring-offset-0 resize-none min-h-[100px]"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-850 flex gap-2">
          <Button 
            variant="outline" 
            onClick={close} 
            className="flex-1 rounded-xl h-10 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900 font-bold text-xs"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveNote} 
            disabled={isSubmitting || !draftText.trim() || !selectedEntityId}
            className="flex-1 rounded-xl h-10 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-lg shadow-violet-500/10 scale-100 hover:scale-[1.01] active:scale-[0.98] transition-all"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Save Note'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

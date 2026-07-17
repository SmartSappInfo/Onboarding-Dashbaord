'use client';

import * as React from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, addDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { EntityNote } from '@/lib/types';
import { MessageSquare, Send, Loader2, ArrowRight, Pin, Phone, Users, AlertTriangle, Clock, ChevronDown, Plus } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { logNoteActivity } from '@/lib/note-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface EntityNotesWidgetProps {
    entityId: string;
    onViewAll: () => void;
}

export default function EntityNotesWidget({ entityId, onViewAll }: EntityNotesWidgetProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
    const { toast } = useToast();

    const [newNote, setNewNote] = React.useState('');
    const [noteType, setNoteType] = React.useState<EntityNote['noteType']>('general');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
    const [composerDropdownOpen, setComposerDropdownOpen] = React.useState(false);

    const noteTypes = [
        { id: 'general', icon: MessageSquare, color: 'text-primary' },
        { id: 'call', icon: Phone, color: 'text-blue-500' },
        { id: 'meeting', icon: Users, color: 'text-purple-500' },
        { id: 'escalation', icon: AlertTriangle, color: 'text-destructive' },
        { id: 'followup', icon: Clock, color: 'text-amber-500' },
    ];

    // Fetch latest 3 Notes
    const notesQuery = useMemoFirebase(() => {
        if (!firestore || !entityId || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'entity_notes'),
            where('entityId', '==', entityId),
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('createdAt', 'desc'),
            limit(10) // Fetch more to allow for pinning logic on the latest set
        );
    }, [firestore, entityId, activeWorkspaceId]);

    const { data: notes, isLoading } = useCollection<EntityNote>(notesQuery);

    const handleAddNote = async () => {
        if (!newNote.trim() || !firestore || !user || !activeWorkspaceId) return;
        
        // Escape HTML / Script tags to prevent XSS payloads
        const sanitizedContent = newNote.trim()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        setIsSubmitting(true);
        try {
            const noteData = {
                entityId,
                workspaceId: activeWorkspaceId,
                content: sanitizedContent,
                noteType,
                isPinned: false,
                createdBy: user.uid,
                createdByName: user.displayName || 'Unknown User',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await addDoc(collection(firestore, 'entity_notes'), noteData);
            
            // Log to activity feed (non-blocking server action)
            logNoteActivity(noteData, activeOrganizationId);

            setNewNote('');
            setNoteType('general');
            setIsAddModalOpen(false);
            toast({ title: 'Note added successfully' });
        } catch (error: any) {
            console.error('Error adding note:', error);
            toast({ title: 'Failed to add note', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const displayNotes = React.useMemo(() => {
        if (!notes) return [];
        // Only show top-level notes in the quick widget
        const result = notes.filter(n => !n.parentNoteId);
        
        result.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        return result.slice(0, 3);
    }, [notes]);

    return (
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden text-left flex flex-col relative overflow-visible">
            <div className="p-5 border-b border-border/30 bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-left">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold tracking-tight">Recent Notes</h3>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-[10px] font-bold px-2 rounded-lg text-primary hover:bg-primary/10 transition-all active:scale-[0.97]" 
                        onClick={() => setIsAddModalOpen(true)}
                    >
                        <Plus className="h-3 w-3 mr-1" /> Add Note
                    </Button>
                    {notes && notes.length > 0 && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-[10px] font-bold px-2 rounded-lg text-primary hover:bg-primary/10 transition-all active:scale-[0.97]" 
                            onClick={onViewAll}
                        >
                            View All <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                    )}
                </div>
            </div>

            <div className="p-4 space-y-4 text-left">
                {/* List */}
                <div className="space-y-3">
                    {isLoading ? (
                        Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-3 w-1/3" />
                                <Skeleton className="h-3 w-full" />
                            </div>
                        ))
                    ) : displayNotes && displayNotes.length > 0 ? (
                        displayNotes.map(note => (
                            <div key={note.id} className={cn(
                                "p-3 rounded-xl transition-shadow duration-200 border border-slate-800/60 bg-slate-900/30 hover:bg-slate-900/50 relative",
                                note.noteType === 'call' ? "border-l-2 border-l-blue-500/70" :
                                note.noteType === 'meeting' ? "border-l-2 border-l-purple-500/70" :
                                note.noteType === 'escalation' ? "border-l-2 border-l-red-500/70" :
                                note.noteType === 'followup' ? "border-l-2 border-l-amber-500/70" :
                                "border-l-2 border-l-slate-600/40",
                                note.isPinned && "shadow-md ring-1 ring-amber-500/10"
                            )}>
                                {note.isPinned && (
                                    <Pin className="absolute -top-1.5 -right-1.5 h-3 w-3 text-amber-500 fill-current" />
                                )}
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <div className="h-4 w-4 rounded-full bg-slate-850 flex items-center justify-center text-[8px] font-bold text-slate-350">
                                        {note.createdByName ? note.createdByName.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-400 truncate max-w-[80px]">{note.createdByName || 'Unknown User'}</span>
                                    {note.noteType && note.noteType !== 'general' && (
                                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                                            • {note.noteType}
                                        </span>
                                    )}
                                    <span className="text-[8px] text-slate-500 ml-auto">
                                        {format(new Date(note.createdAt), 'MMM d')}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-300 line-clamp-3 leading-tight whitespace-pre-wrap font-normal">{note.content}</p>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-xs text-muted-foreground font-medium italic">No notes yet.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Note Modal Dialog */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent className="w-[90%] sm:max-w-[425px] bg-slate-950 border border-slate-800 text-slate-100 backdrop-blur-xl shadow-2xl rounded-2xl p-6 transition-all duration-300 mx-auto overflow-visible">
                    <DialogHeader className="space-y-1.5 text-left">
                        <DialogTitle className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                            Add Note
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-3 overflow-visible">
                        <div className="space-y-1.5">
                            <Textarea 
                                placeholder={noteType === 'call' ? "Call outcome details…" : "Type your note content here…"}
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                className="min-h-[100px] text-xs resize-none rounded-xl bg-slate-900 border-slate-800 placeholder:text-slate-650 focus-visible:ring-1 focus-visible:ring-primary/20"
                                autoFocus
                            />
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-850 overflow-visible">
                            {/* Note Type select dropdown pill */}
                            <div className="relative">
                                <button
                                    onClick={() => setComposerDropdownOpen(!composerDropdownOpen)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border border-border/50 bg-slate-900/60 text-slate-300 hover:text-slate-100 transition-all select-none"
                                >
                                    {React.createElement(noteTypes.find(t => t.id === noteType)?.icon || MessageSquare, { className: "h-3.5 w-3.5 opacity-60" })}
                                    <span>{(noteType || 'general').charAt(0).toUpperCase() + (noteType || 'general').slice(1)}</span>
                                    <ChevronDown className="h-3 w-3 opacity-65" />
                                </button>

                                {composerDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1.5 w-36 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {noteTypes.map((t) => {
                                            const Icon = t.icon;
                                            return (
                                                <button
                                                    key={t.id}
                                                    onClick={() => {
                                                        setNoteType(t.id as EntityNote['noteType']);
                                                        setComposerDropdownOpen(false);
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] font-bold hover:bg-slate-800 transition-colors",
                                                        noteType === t.id ? "text-primary bg-slate-800/40" : "text-slate-400 hover:text-slate-200"
                                                    )}
                                                >
                                                    <Icon className="h-3.5 w-3.5" />
                                                    <span>{t.id.charAt(0).toUpperCase() + t.id.slice(1)}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={() => setIsAddModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button 
                                    onClick={handleAddNote} 
                                    disabled={!newNote.trim() || isSubmitting}
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
                </DialogContent>
            </Dialog>
        </div>
    );
}

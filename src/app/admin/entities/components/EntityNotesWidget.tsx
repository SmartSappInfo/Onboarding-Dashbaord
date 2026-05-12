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
import { MessageSquare, Send, Loader2, ArrowRight, Pin, Phone, Users, AlertTriangle, Clock } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { logNoteActivity } from '@/lib/note-actions';

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
    const [showAddNote, setShowAddNote] = React.useState(false);

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
        
        setIsSubmitting(true);
        try {
            const noteData = {
                entityId,
                workspaceId: activeWorkspaceId,
                content: newNote.trim(),
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
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden text-left flex flex-col">
            <div className="p-5 border-b border-border/30 bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-left">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold tracking-tight">Recent Notes</h3>
                </div>
                {notes && notes.length > 0 && (
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold px-2 rounded-lg text-primary hover:bg-primary/10" onClick={() => setShowAddNote(!showAddNote)}>
                            {showAddNote ? 'Cancel' : 'Add Note'}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold px-2 rounded-lg text-primary hover:bg-primary/10" onClick={onViewAll}>
                            View All <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                    </div>
                )}
            </div>

            <div className="p-4 space-y-4 text-left">
                {/* Quick Add */}
                {showAddNote && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex gap-1">
                            {noteTypes.map((type) => (
                                <Button
                                    key={type.id}
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setNoteType(type.id as EntityNote['noteType'])}
                                    className={cn(
                                        "h-6 w-6 rounded-md transition-all",
                                        noteType === type.id ? "bg-primary/10 " + type.color : "text-muted-foreground opacity-50 hover:opacity-100"
                                    )}
                                    title={type.id.charAt(0).toUpperCase() + type.id.slice(1)}
                                >
                                    <type.icon className="h-3.5 w-3.5" />
                                </Button>
                            ))}
                        </div>
                        <div className="relative">
                            <Textarea 
                                placeholder={noteType === 'call' ? "Call outcome…" : "Quick note…"}
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                className="min-h-[60px] text-xs resize-none rounded-xl border-border/50 bg-background focus-visible:ring-1 focus-visible:ring-primary/20 pr-10"
                            />
                            <Button 
                                size="icon"
                                variant="ghost"
                                onClick={() => { handleAddNote(); setShowAddNote(false); }} 
                                disabled={!newNote.trim() || isSubmitting}
                                className="absolute bottom-2 right-2 h-6 w-6 rounded-lg text-primary hover:bg-primary/10"
                            >
                                {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            </Button>
                        </div>
                    </div>
                )}

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
                                "p-3 rounded-xl border-l-4 border-amber-400 bg-amber-50/50 transition-all relative border-t-0 border-r-0 border-b-0",
                                note.isPinned ? "shadow-md ring-1 ring-amber-500/10" : "shadow-sm hover:shadow-md"
                            )}>
                                {note.isPinned && (
                                    <Pin className="absolute -top-1.5 -right-1.5 h-3 w-3 text-amber-500 fill-current" />
                                )}
                                <div className="flex items-center gap-1.5 mb-1.5 opacity-60">
                                    <div className="h-4 w-4 rounded-full bg-amber-200/50 flex items-center justify-center text-[8px] font-medium text-amber-700">
                                        {note.createdByName ? note.createdByName.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <span className="text-[9px] font-medium text-amber-900/70 truncate max-w-[80px]">{note.createdByName || 'Unknown User'}</span>
                                    {note.noteType && note.noteType !== 'general' && (
                                        <span className="text-[8px] font-medium text-amber-900/50 uppercase tracking-tighter">
                                            • {note.noteType}
                                        </span>
                                    )}
                                    <span className="text-[8px] text-amber-900/40 ml-auto">
                                        {format(new Date(note.createdAt), 'MMM d')}
                                    </span>
                                </div>
                                <p className="text-xs text-amber-950/80 line-clamp-3 leading-tight whitespace-pre-wrap font-normal">{note.content}</p>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-xs text-muted-foreground font-medium italic">No notes yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

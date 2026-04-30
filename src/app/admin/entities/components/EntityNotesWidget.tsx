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
import { MessageSquare, Send, Loader2, ArrowRight } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';

interface EntityNotesWidgetProps {
    entityId: string;
    onViewAll: () => void;
}

export default function EntityNotesWidget({ entityId, onViewAll }: EntityNotesWidgetProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { activeWorkspaceId } = useWorkspace();
    const { toast } = useToast();

    const [newNote, setNewNote] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Fetch latest 3 Notes
    const notesQuery = useMemoFirebase(() => {
        if (!firestore || !entityId || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'entity_notes'),
            where('entityId', '==', entityId),
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('createdAt', 'desc'),
            limit(3)
        );
    }, [firestore, entityId, activeWorkspaceId]);

    const { data: notes, isLoading } = useCollection<EntityNote>(notesQuery);

    const handleAddNote = async () => {
        if (!newNote.trim() || !firestore || !user || !activeWorkspaceId) return;
        
        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'entity_notes'), {
                entityId,
                workspaceId: activeWorkspaceId,
                content: newNote.trim(),
                createdBy: user.uid,
                createdByName: user.displayName || 'Unknown User',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            setNewNote('');
            toast({ title: 'Note added successfully' });
        } catch (error: any) {
            console.error('Error adding note:', error);
            toast({ title: 'Failed to add note', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden text-left flex flex-col">
            <div className="p-5 border-b border-border/30 bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-left">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold tracking-tight">Recent Notes</h3>
                </div>
                {notes && notes.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold px-2 rounded-lg text-primary hover:bg-primary/10" onClick={onViewAll}>
                        View All <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                )}
            </div>

            <div className="p-4 space-y-4 text-left">
                {/* Quick Add */}
                <div className="relative">
                    <Textarea 
                        placeholder="Quick note..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="min-h-[60px] text-xs resize-none rounded-xl border-border/50 bg-background focus-visible:ring-1 focus-visible:ring-primary/20 pr-10"
                    />
                    <Button 
                        size="icon"
                        variant="ghost"
                        onClick={handleAddNote} 
                        disabled={!newNote.trim() || isSubmitting}
                        className="absolute bottom-2 right-2 h-6 w-6 rounded-lg text-primary hover:bg-primary/10"
                    >
                        {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    </Button>
                </div>

                {/* List */}
                <div className="space-y-3">
                    {isLoading ? (
                        Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-3 w-1/3" />
                                <Skeleton className="h-3 w-full" />
                            </div>
                        ))
                    ) : notes && notes.length > 0 ? (
                        notes.map(note => (
                            <div key={note.id} className="p-3 bg-muted/30 rounded-xl border border-border/30">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">
                                        {note.createdByName ? note.createdByName.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <span className="text-[10px] font-bold">{note.createdByName || 'Unknown User'}</span>
                                    <span className="text-[9px] text-muted-foreground ml-auto">
                                        {format(new Date(note.createdAt), 'MMM d')}
                                    </span>
                                </div>
                                <p className="text-xs text-foreground/80 line-clamp-3">{note.content}</p>
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

'use client';

import * as React from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { EntityNote } from '@/lib/types';
import { MessageSquare, Trash2, Edit2, Check, X, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';

interface EntityNotesTabProps {
    entityId: string;
}

export default function EntityNotesTab({ entityId }: EntityNotesTabProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { activeWorkspaceId } = useWorkspace();
    const { toast } = useToast();

    const [newNote, setNewNote] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    
    const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
    const [editContent, setEditContent] = React.useState('');

    // Fetch Notes
    const notesQuery = useMemoFirebase(() => {
        if (!firestore || !entityId || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'entity_notes'),
            where('entityId', '==', entityId),
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('createdAt', 'desc')
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

    const handleUpdateNote = async (noteId: string) => {
        if (!editContent.trim() || !firestore) return;
        
        try {
            await updateDoc(doc(firestore, 'entity_notes', noteId), {
                content: editContent.trim(),
                updatedAt: new Date().toISOString()
            });
            setEditingNoteId(null);
            setEditContent('');
            toast({ title: 'Note updated successfully' });
        } catch (error: any) {
            console.error('Error updating note:', error);
            toast({ title: 'Failed to update note', description: error.message, variant: 'destructive' });
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!firestore || !confirm('Are you sure you want to delete this note?')) return;
        
        try {
            await deleteDoc(doc(firestore, 'entity_notes', noteId));
            toast({ title: 'Note deleted' });
        } catch (error: any) {
            console.error('Error deleting note:', error);
            toast({ title: 'Failed to delete note', description: error.message, variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-6 text-left">
            <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl shrink-0">
                        <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 space-y-3">
                        <Textarea 
                            placeholder="Type a new note..."
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            className="min-h-[100px] resize-y rounded-xl border-border/50 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/20"
                        />
                        <div className="flex justify-end">
                            <Button 
                                onClick={handleAddNote} 
                                disabled={!newNote.trim() || isSubmitting}
                                className="rounded-xl shadow-sm gap-2 font-bold"
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Add Note
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-card rounded-2xl p-6 border border-border/50 space-y-3">
                            <Skeleton className="h-4 w-1/4" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                        </div>
                    ))
                ) : notes && notes.length > 0 ? (
                    notes.map(note => (
                        <div key={note.id} className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm hover:shadow-md transition-shadow group">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                        {note.createdByName ? note.createdByName.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold leading-none">{note.createdByName || 'Unknown User'}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            {format(new Date(note.createdAt), 'MMM d, yyyy h:mm a')}
                                            {note.updatedAt !== note.createdAt && ' (edited)'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {user?.uid === note.createdBy && editingNoteId !== note.id && (
                                        <>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg" onClick={() => { setEditingNoteId(note.id); setEditContent(note.content); }}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg" onClick={() => handleDeleteNote(note.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            {editingNoteId === note.id ? (
                                <div className="space-y-3 mt-2">
                                    <Textarea 
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="min-h-[80px] text-sm resize-none rounded-xl"
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="outline" className="rounded-lg h-8" onClick={() => setEditingNoteId(null)}>
                                            <X className="h-3 w-3 mr-1" /> Cancel
                                        </Button>
                                        <Button size="sm" className="rounded-lg h-8" onClick={() => handleUpdateNote(note.id)}>
                                            <Check className="h-3 w-3 mr-1" /> Save
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{note.content}</p>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="py-16 text-center border-2 border-dashed rounded-2xl bg-background/20 opacity-50 flex flex-col items-center gap-3">
                        <MessageSquare className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-semibold text-muted-foreground">No notes added yet</p>
                    </div>
                )}
            </div>
        </div>
    );
}

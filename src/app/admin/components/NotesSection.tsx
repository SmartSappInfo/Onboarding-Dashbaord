'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import type { Activity, UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from '@/lib/activity-logger';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import NoteItem from './NoteItem';
import { useTenant } from '@/context/TenantContext';

interface NotesSectionProps {
  entityId: string;
}

export default function NotesSection({ entityId }: NotesSectionProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const { activeOrganizationId } = useTenant();
    
    const [newNoteContent, setNewNoteContent] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [showAddNote, setShowAddNote] = React.useState(false);

    // Fetch notes for the current school
    const notesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'activities'),
            where('entityId', '==', entityId),
            where('type', '==', 'note'),
            orderBy('timestamp', 'desc')
        );
    }, [firestore, entityId]);
    const { data: notes, isLoading: isLoadingNotes } = useCollection<Activity>(notesQuery);
    
    // Fetch all users within the organization to map user IDs to profiles
    const usersQuery = useMemoFirebase(() => 
        firestore && activeOrganizationId ? query(
            collection(firestore, 'users'),
            where('organizationId', '==', activeOrganizationId)
        ) : null, 
    [firestore, activeOrganizationId]);
    
    const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);
    
    const usersMap = React.useMemo(() => {
        if (!users) return new Map<string, UserProfile>();
        return new Map(users.map(u => [u.id, u]));
    }, [users]);

    const handleAddNote = async () => {
        if (!newNoteContent.trim() || !user) {
            toast({ variant: 'destructive', title: 'Note cannot be empty.' });
            return;
        }
        setIsSubmitting(true);
        try {
            await logActivity({
                organizationId: activeOrganizationId,
                entityId: entityId,
                userId: user.uid,
                type: 'note',
                workspaceId: activeOrganizationId,
                source: 'manual',
                description: `added a note.`,
                metadata: { content: newNoteContent.trim() }
            });
            setNewNoteContent('');
            toast({ title: 'Note added successfully!' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Failed to add note.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    const isLoading = isLoadingNotes || isLoadingUsers;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-base font-bold">Internal Notes</CardTitle>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowAddNote(!showAddNote)}
                    className="h-8 rounded-lg font-bold text-primary hover:bg-primary/10"
                >
                    {showAddNote ? 'Cancel' : 'Add Note'}
                </Button>
            </CardHeader>
            <CardContent>
 <div className="space-y-4">
                    {/* Add Note Form */}
                    {showAddNote && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300 bg-muted/20 p-4 rounded-xl border border-border/50">
                            <Textarea
                                placeholder="Add a new note..."
                                value={newNoteContent}
                                onChange={(e) => setNewNoteContent(e.target.value)}
                                disabled={isSubmitting}
                                className="min-h-[100px] bg-background border-border/50 rounded-xl resize-none text-sm"
                            />
                            <div className="flex justify-end">
                                <Button 
                                    onClick={() => { handleAddNote(); setShowAddNote(false); }} 
                                    disabled={isSubmitting || !newNoteContent.trim()}
                                    className="rounded-xl font-bold h-9 px-4"
                                >
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Note
                                </Button>
                            </div>
                        </div>
                    )}
                    
                    {/* Notes List */}
                    <div className="relative space-y-4 pt-2">
                        {isLoading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-24 w-full rounded-xl" />
                                <Skeleton className="h-24 w-full rounded-xl" />
                            </div>
                        ) : notes && notes.length > 0 ? (
                            <div className="space-y-4">
                               {notes.map(note => (
 <div key={note.id} className="group relative">
                                        <NoteItem
                                            note={note}
                                            userProfile={note.userId ? usersMap.get(note.userId) : undefined}
                                        />
                                   </div>
                               ))}
                            </div>
                        ) : (
 <div className="text-center py-10 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                                <p>No notes have been added for this school yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}


'use client';

import * as React from 'react';
import type { Activity, UserProfile } from '@/lib/types';
import { format, formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { Loader2, Trash2, Pencil, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { updateNote, deleteNote } from '@/lib/activity-actions';

interface NoteItemProps {
  note: Activity;
  userProfile?: UserProfile;
}

const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '?';

export default function NoteItem({ note, userProfile }: NoteItemProps) {
    const { user } = useUser();
    const { toast } = useToast();

    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [editedContent, setEditedContent] = React.useState(note.metadata?.content || '');

    const canEdit = user?.uid === note.userId;

    const handleSave = async () => {
        if (editedContent === note.metadata?.content) {
            setIsEditing(false);
            return;
        }
        setIsSaving(true);
        const result = await updateNote(note.id, editedContent);
        if (result.success) {
            toast({ title: 'Note updated' });
            setIsEditing(false);
        } else {
            toast({ variant: 'destructive', title: 'Failed to update note', description: result.error });
        }
        setIsSaving(false);
    }

    const handleDelete = async () => {
        setIsDeleting(true);
        const result = await deleteNote(note.id);
        if (result.success) {
            toast({ title: 'Note deleted' });
            // The component will be removed from the list by the parent.
        } else {
            toast({ variant: 'destructive', title: 'Failed to delete note', description: result.error });
        }
        setIsDeleting(false);
        setIsDeleteDialogOpen(false);
    }
    
    return (
        <div className="relative pl-10 pt-2 pb-4">
            <div className="absolute -left-1 top-3 transform">
                <Avatar className="h-8 w-8">
                    {userProfile?.photoURL ? (
                        <>
                            <AvatarImage src={userProfile.photoURL} alt={userProfile.name} />
                            <AvatarFallback>{getInitials(userProfile.name)}</AvatarFallback>
                        </>
                    ) : (
                         <AvatarFallback><Bot size={16}/></AvatarFallback>
                    )}
                </Avatar>
            </div>
            
            <div className="ml-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{userProfile?.name || 'System'}</span>
                    <span>&middot;</span>
                    <time
                        dateTime={note.timestamp}
                        title={format(new Date(note.timestamp), "PPP p")}
                        className="whitespace-nowrap"
                    >
                        {formatDistanceToNow(new Date(note.timestamp), { addSuffix: true })}
                    </time>
                </div>
                <div className="mt-2 text-sm text-foreground/90">
                    {isEditing ? (
                        <div className="space-y-2">
                             <Textarea
                                value={editedContent}
                                onChange={(e) => setEditedContent(e.target.value)}
                                className="min-h-[100px]"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</Button>
                                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="whitespace-pre-wrap">{note.metadata?.content}</p>
                    )}
                </div>
                 {canEdit && !isEditing && (
                    <div className="absolute top-1 right-1 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditing(true)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to delete this note?</AlertDialogTitle>
                    <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the note.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}



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
import { cn } from '@/lib/utils';
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
        <div className="group relative">
            <div className={cn(
                "rounded-xl p-4 border-l-4 border-amber-400 bg-amber-50/50 transition-all border-t-0 border-r-0 border-b-0 shadow-sm hover:shadow-md",
                isEditing && "ring-1 ring-amber-500/20"
            )}>
                <div className="flex items-center justify-between mb-2 opacity-60">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-amber-200/50 flex items-center justify-center text-[8px] font-medium text-amber-700">
                            {userProfile?.photoURL ? (
                                <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full rounded-full object-cover" />
                            ) : getInitials(userProfile?.name)}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-[10px] font-medium text-amber-900/70 leading-none">{userProfile?.name || 'System'}</p>
                            </div>
                            <p className="text-[9px] text-amber-900/40 mt-0.5">
                                {format(new Date(note.timestamp), 'MMM d, yyyy h:mm a')}
                            </p>
                        </div>
                    </div>
                    {canEdit && !isEditing && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-900/40 hover:text-amber-900" onClick={() => setIsEditing(true)}>
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-900/40 hover:text-destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}
                </div>

                <div className="text-sm text-amber-950/80 leading-relaxed font-normal">
                    {isEditing ? (
                        <div className="space-y-2 mt-2 animate-in zoom-in-95 duration-200">
                            <Textarea
                                value={editedContent}
                                onChange={(e) => setEditedContent(e.target.value)}
                                className="min-h-[100px] text-sm resize-none rounded-xl bg-background/50 border-amber-500/20"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs" onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</Button>
                                <Button size="sm" className="h-8 rounded-lg text-xs font-bold" onClick={handleSave} disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                    Save
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="whitespace-pre-wrap">{note.metadata?.content}</p>
                    )}
                </div>
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


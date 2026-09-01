'use client';

/**
 * SmartSapp Forms 2.0: Internal Staff Notes & Activity Thread
 * 
 * Enables team members to collaborate on submissions by adding internal notes.
 */

import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/firebase';
import { addSubmissionNoteAction, getSubmissionNotesAction } from '@/lib/forms/form-response-actions';
import type { SubmissionNote } from '@/lib/forms/form-response-types';
import { useToast } from '@/hooks/use-toast';

interface SubmissionNotesSectionProps {
  submissionId: string;
  workspaceId: string;
}

export default function SubmissionNotesSection({
  submissionId,
  workspaceId,
}: SubmissionNotesSectionProps) {
  const { user } = useUser();
  const { toast } = useToast();

  const [notes, setNotes] = useState<SubmissionNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const res = await getSubmissionNotesAction(submissionId);
        if (isMounted && res.success) {
          setNotes(res.notes);
        }
      } catch (err) {
        console.error('Error loading notes:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [submissionId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const authorName = user?.displayName || user?.email?.split('@')[0] || 'Team Member';
      const authorId = user?.uid || 'user_anon';

      const res = await addSubmissionNoteAction(
        submissionId,
        workspaceId,
        authorId,
        authorName,
        newNoteText.trim()
      );

      if (res.success && res.note) {
        setNotes(prev => [res.note!, ...prev]);
        setNewNoteText('');
        toast({
          title: 'Note Added',
          description: 'Internal staff note recorded successfully.',
        });
      } else {
        toast({
          title: 'Failed to Add Note',
          description: res.error || 'Could not save note.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Internal Staff Notes ({notes.length})
        </h3>
      </div>

      {/* Add Note Form */}
      <form onSubmit={handleAddNote} className="space-y-2">
        <Textarea
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
          placeholder="Add an internal follow-up note or qualification summary..."
          className="min-h-[70px] text-xs rounded-xl bg-background border-border/60 focus-visible:ring-primary/20"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={!newNoteText.trim() || isSubmitting}
            className="h-8 px-4 rounded-xl text-xs font-bold gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Post Note
          </Button>
        </div>
      </form>

      {/* Notes List */}
      <div className="space-y-2.5 pt-1">
        {isLoading ? (
          <div className="text-center py-4 text-xs text-muted-foreground">Loading notes...</div>
        ) : notes.length === 0 ? (
          <div className="text-center py-4 text-xs text-muted-foreground italic bg-muted/10 rounded-xl border border-dashed border-border/40">
            No internal staff notes yet.
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="p-3 rounded-2xl bg-muted/20 border border-border/40 space-y-1.5"
            >
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span>{note.authorName}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(note.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {note.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

'use client';

import * as React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Loader2, Tag as TagIcon, FolderClosed, Check, Paperclip, Link2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TagInput } from '@/components/ui/tag-input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Firestore } from 'firebase/firestore';
import type { 
  NoteDocument, 
  QuickNote, 
  QuickNoteAttachment, 
  QuickNoteCategory, 
  QuickNoteLinks,
  KnowledgeType 
} from '@/lib/quick-notes-types';
import { createQuickNote, updateQuickNote } from '@/lib/quick-notes-hooks';
import { uploadNoteAttachment, deleteAttachmentObject } from '@/lib/quick-notes-attachments';
import { enrichNoteLink } from '@/lib/quick-notes-actions';
import { classifyDraftKnowledgeAction } from '@/lib/quick-notes-ai-actions';
import { categorySwatch } from './quick-notes-ui';
import { KNOWLEDGE_TYPE_META, normalizeKnowledgeType, extractPlainText } from '@/lib/quick-notes-domain';
import { VoiceCaptureButton } from '@/components/shared/VoiceCaptureButton';
import NoteAttachmentList, { type PendingUpload } from './NoteAttachmentList';
import LinkRecordPicker from './LinkRecordPicker';
import AiInsightsPanel from './AiInsightsPanel';
import { Wand2 } from 'lucide-react';

// Heavy TipTap editor is split out of the board bundle (design spec R11).
const NoteBlockEditor = dynamic(() => import('./editor/NoteBlockEditor'), {
  ssr: false,
  loading: () => <Skeleton className="h-[320px] w-full rounded-lg" />,
});

export interface NoteEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing note to edit, or null to create a new one. */
  note: QuickNote | null;
  categories: QuickNoteCategory[];
  firestore: Firestore;
  organizationId: string;
  workspaceId: string;
  userId: string;
  userName?: string;
  initialType?: KnowledgeType;
}

export default function NoteEditorDialog({
  open,
  onOpenChange,
  note,
  categories,
  firestore,
  organizationId,
  workspaceId,
  userId,
  userName,
  initialType = 'note',
}: NoteEditorDialogProps) {
  const { toast } = useToast();
  const isEdit = !!note;

  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState<NoteDocument | null>(null);
  const [knowledgeType, setKnowledgeType] = React.useState<KnowledgeType>('note');
  const [tags, setTags] = React.useState<string[]>([]);
  const [categoryId, setCategoryId] = React.useState<string | undefined>(undefined);
  const [attachments, setAttachments] = React.useState<QuickNoteAttachment[]>([]);
  const [links, setLinks] = React.useState<QuickNoteLinks>({});
  const [pending, setPending] = React.useState<PendingUpload[]>([]);
  const [isAddingLink, setIsAddingLink] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isClassifying, setIsClassifying] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const sessionUploadsRef = React.useRef<Set<string>>(new Set());

  // Re-seed local state whenever the dialog opens for a (different) note.
  React.useEffect(() => {
    if (!open) return;
    setTitle(note?.title ?? '');
    setContent(note?.content ?? null);
    setKnowledgeType(note ? normalizeKnowledgeType(note.knowledgeType) : initialType);
    setTags(note?.tags ?? []);
    setCategoryId(note?.categoryId);
    setAttachments(note?.attachments ?? []);
    setLinks(note?.links ?? {});
    setPending([]);
    sessionUploadsRef.current = new Set();
  }, [open, note, initialType]);

  const handleVoiceTranscript = (text: string) => {
    setTitle((prev) => (prev ? prev : text.slice(0, 60)));
  };

  const handleAutoClassify = async () => {
    const plain = extractPlainText(content);
    if (!plain && !title) {
      toast({ title: 'Enter a title or note body first', variant: 'destructive' });
      return;
    }
    setIsClassifying(true);
    try {
      const res = await classifyDraftKnowledgeAction({
        text: `${title}\n\n${plain}`,
        workspaceId,
        userId,
      });
      if (res.success && res.data) {
        setKnowledgeType(res.data.suggestedType);
        if (!title.trim() && res.data.suggestedTitle) {
          setTitle(res.data.suggestedTitle);
        }
        if (res.data.suggestedTags && res.data.suggestedTags.length > 0) {
          setTags((prev) => Array.from(new Set([...prev, ...res.data.suggestedTags])));
        }
        toast({ title: `AI detected: ${KNOWLEDGE_TYPE_META[res.data.suggestedType]?.label ?? res.data.suggestedType} ✓` });
      } else {
        toast({ title: 'AI classification notice', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'AI classification failed', variant: 'destructive' });
    } finally {
      setIsClassifying(false);
    }
  };

  // Clean up any session uploads that were never persisted (cancel / close).
  const handleOpenChange = (next: boolean) => {
    if (!next && sessionUploadsRef.current.size > 0) {
      for (const path of sessionUploadsRef.current) void deleteAttachmentObject(path);
      sessionUploadsRef.current.clear();
    }
    onOpenChange(next);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const pendingId = crypto.randomUUID();
      setPending((p) => [...p, { id: pendingId, name: file.name, progress: 0 }]);
      try {
        const attachment = await uploadNoteAttachment({
          file,
          workspaceId,
          onProgress: (percent) =>
            setPending((p) => p.map((u) => (u.id === pendingId ? { ...u, progress: percent } : u))),
        });
        if (attachment.storagePath) sessionUploadsRef.current.add(attachment.storagePath);
        setAttachments((a) => [...a, attachment]);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        toast({ title: `Couldn't upload ${file.name}`, description: message, variant: 'destructive' });
      } finally {
        setPending((p) => p.filter((u) => u.id !== pendingId));
      }
    }
  };

  const handleAddLink = async () => {
    const url = window.prompt('Paste a link URL:');
    if (!url) return;
    setIsAddingLink(true);
    try {
      const attachment = await enrichNoteLink({ url: url.trim(), workspaceId });
      if (attachment.storagePath) sessionUploadsRef.current.add(attachment.storagePath);
      setAttachments((a) => [...a, attachment]);
    } catch {
      toast({ title: "Couldn't add link", variant: 'destructive' });
    } finally {
      setIsAddingLink(false);
    }
  };

  const handleRemoveAttachment = (attachment: QuickNoteAttachment) => {
    setAttachments((a) => a.filter((x) => x.id !== attachment.id));
    if (attachment.storagePath) {
      // Best-effort cleanup of the just-removed object (R13).
      void deleteAttachmentObject(attachment.storagePath);
      sessionUploadsRef.current.delete(attachment.storagePath);
    }
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      toast({ title: 'A title is required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const safeContent: NoteDocument = content ?? { type: 'doc', content: [{ type: 'paragraph' }] };
      if (isEdit && note) {
        await updateQuickNote(firestore, note, {
          title: trimmed,
          content: safeContent,
          knowledgeType,
          tags,
          categoryId: categoryId ?? null,
          attachments,
          links,
        });
        toast({ title: 'Saved to Company Brain' });
      } else {
        await createQuickNote(firestore, {
          organizationId,
          workspaceId,
          createdBy: userId,
          createdByName: userName,
          title: trimmed,
          content: safeContent,
          knowledgeType,
          tags,
          categoryId,
          attachments,
          links,
        });
        toast({ title: 'Captured in Company Brain' });
      }
      // Persisted — these uploads are now owned by the note; don't clean them up.
      sessionUploadsRef.current.clear();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Failed to save', description: message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const typeMeta = KNOWLEDGE_TYPE_META[knowledgeType];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <DialogTitle className="font-serif text-xl tracking-tight">
              {isEdit ? `Edit ${typeMeta.label}` : `New ${typeMeta.label}`}
            </DialogTitle>
          </div>

          <div className="flex items-center gap-2 pr-6">
            <VoiceCaptureButton onTranscript={handleVoiceTranscript} size="sm" variant="ghost" />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoClassify}
              disabled={isClassifying}
              className="h-7 px-2 text-xs font-semibold gap-1 text-primary hover:bg-primary/10"
              title="AI Auto-Classify"
            >
              {isClassifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Auto-Classify</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-all cursor-pointer',
                    typeMeta.badgeColor
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', typeMeta.dotColor)} />
                  <span>{typeMeta.label}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {(Object.keys(KNOWLEDGE_TYPE_META) as KnowledgeType[]).map((tKey) => {
                  const meta = KNOWLEDGE_TYPE_META[tKey];
                  return (
                    <DropdownMenuItem
                      key={tKey}
                      onClick={() => setKnowledgeType(tKey)}
                      className={cn(
                        'flex items-center gap-2 text-xs font-semibold cursor-pointer',
                        knowledgeType === tKey && 'bg-muted'
                      )}
                    >
                      <span className={cn('h-2 w-2 rounded-full', meta.dotColor)} />
                      <span>{meta.label}</span>
                      {knowledgeType === tKey && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled note"
            className="font-serif text-lg h-11 border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
            autoFocus
          />

          {open && (
            <NoteBlockEditor
              initialContent={note?.content ?? null}
              onChange={setContent}
              placeholder="Start writing your note… use the toolbar for headings, lists, quotes, and links."
              workspaceId={workspaceId}
              userId={userId}
              noteId={note?.id}
              links={links}
            />
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
                Attach file
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleAddLink}
                disabled={isAddingLink}
              >
                {isAddingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Add link
              </Button>
            </div>
            <NoteAttachmentList
              attachments={attachments}
              pending={pending}
              onRemove={handleRemoveAttachment}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
              Linked records
            </span>
            <LinkRecordPicker workspaceId={workspaceId} links={links} onChange={setLinks} />
          </div>

          {isEdit && note && (
            <div className="space-y-2 pt-1 border-t border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1.5">
                  <Link2 className="w-3 h-3 text-blue-500" />
                  Knowledge Graph & Ideas
                </span>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/admin/quick-notes/ideas`}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    Develop into Idea 💡 →
                  </Link>
                  <Link
                    href={`/admin/quick-notes/graph?focus=${encodeURIComponent(note.id)}`}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    Explore in Graph →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {isEdit && note && (
            <AiInsightsPanel
              noteId={note.id}
              title={title}
              content={content}
              userId={userId}
              workspaceId={workspaceId}
              organizationId={organizationId}
              links={links}
              cached={note.ai}
              onApplyTags={(suggested) => setTags((prev) => Array.from(new Set([...prev, ...suggested])))}
            />
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 min-w-[200px] flex-1">
              <TagIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <TagInput value={tags} onChange={setTags} placeholder="Add tags…" className="flex-1" />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-2">
                  <FolderClosed className="h-4 w-4" />
                  {selectedCategory ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn('h-2 w-2 rounded-full', categorySwatch(selectedCategory.color).dot)} />
                      {selectedCategory.name}
                    </span>
                  ) : (
                    'No category'
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCategoryId(undefined)}>
                  <span className="flex items-center gap-2">
                    {categoryId === undefined && <Check className="h-3.5 w-3.5" />}
                    <span className={cn(categoryId !== undefined && 'pl-[22px]')}>No category</span>
                  </span>
                </DropdownMenuItem>
                {categories.map((c) => (
                  <DropdownMenuItem key={c.id} onClick={() => setCategoryId(c.id)}>
                    <span className="flex items-center gap-2">
                      {categoryId === c.id ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <span className={cn('h-2 w-2 rounded-full', categorySwatch(c.color).dot)} />
                      )}
                      {c.name}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

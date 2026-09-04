'use client';

import * as React from 'react';
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Link as LinkIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  Highlighter,
  Undo2,
  Redo2,
  RemoveFormatting,
  Sparkles,
  LayoutTemplate,
  CheckSquare,
  Minus,
  Loader2,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import LinkNext from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Network, Share2 } from 'lucide-react';
import type { NoteDocument, BacklinkItem, QuickNoteLinks } from '@/lib/quick-notes-types';
import { extractPlainText, calculateReadingStats, getRelationDisplayLabel } from '@/lib/quick-notes-domain';
import { DEFAULT_TEMPLATE_PRESETS } from '@/lib/knowledge-template-presets';
import { aiAssistEditorAction, type EditorAiAssistType } from '@/lib/quick-notes-ai-actions';
import { getBacklinksAction } from '@/lib/quick-notes-graph-actions';

export interface NoteBlockEditorProps {
  initialContent?: NoteDocument | null;
  onChange: (json: NoteDocument) => void;
  placeholder?: string;
  editable?: boolean;
  workspaceId?: string;
  userId?: string;
  noteId?: string;
  links?: QuickNoteLinks;
}

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        'h-7 w-7 rounded-md flex items-center justify-center transition-colors min-h-[28px] min-w-[28px]',
        active
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-1" />;
}

const EMPTY_DOC: NoteDocument = { type: 'doc', content: [{ type: 'paragraph' }] };

export default function NoteBlockEditor({
  initialContent,
  onChange,
  placeholder = 'Start writing your note… type "/" for commands',
  editable = true,
  workspaceId,
  userId,
  noteId,
  links,
}: NoteBlockEditorProps) {
  const { toast } = useToast();
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [backlinks, setBacklinks] = React.useState<BacklinkItem[]>([]);

  React.useEffect(() => {
    if (!workspaceId || !userId || !noteId) return;
    let isMounted = true;
    getBacklinksAction(workspaceId, userId, noteId)
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setBacklinks(res.data);
        }
      })
      .catch((err) => console.warn('[NoteBlockEditor] Backlinks error:', err));

    return () => {
      isMounted = false;
    };
  }, [workspaceId, userId, noteId]);

  const extensions = React.useMemo(
    () => [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: 'text-primary underline underline-offset-2 cursor-pointer' },
      }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      Highlight.configure({ multicolor: false }),
    ],
    [placeholder]
  );

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions,
    content: (initialContent as JSONContent) ?? EMPTY_DOC,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON() as NoteDocument);
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none px-4 py-4 min-h-[300px] outline-none focus:outline-none',
      },
    },
  });

  const readingStats = React.useMemo(() => {
    if (!editor) return { words: 0, characters: 0, readingTimeMinutes: 1 };
    const doc = editor.getJSON() as NoteDocument;
    const text = extractPlainText(doc);
    return calculateReadingStats(text);
  }, [editor?.state.doc]);

  if (!editor) {
    return <div className="min-h-[300px] animate-pulse rounded-md bg-muted/40" aria-hidden />;
  }

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Enter URL:', previous || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const handleInsertTemplate = (templateContent: NoteDocument) => {
    editor.chain().focus().insertContent(templateContent as JSONContent).run();
    toast({ title: 'Template inserted into note ✓' });
  };

  const handleAiAssist = async (action: EditorAiAssistType) => {
    if (!workspaceId || !userId) {
      toast({ title: 'Authentication context required for AI Assist', variant: 'destructive' });
      return;
    }

    const currentDoc = editor.getJSON() as NoteDocument;
    const plain = extractPlainText(currentDoc);
    if (!plain.trim()) {
      toast({ title: 'Write some content first to use AI assist', variant: 'destructive' });
      return;
    }

    setIsAiLoading(true);
    try {
      const res = await aiAssistEditorAction({
        text: plain,
        action,
        workspaceId,
        userId,
      });

      if (res.success && res.data.resultText) {
        // Append result as a new blockquote / section
        editor.chain().focus().insertContent(`\n\n> **AI ${action.replace('_', ' ').toUpperCase()}**:\n${res.data.resultText}\n\n`).run();
        toast({ title: 'AI response inserted ✓' });
      } else {
        toast({ title: 'AI assist failed', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'AI request error', variant: 'destructive' });
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!editable) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
      {/* Editor Top Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/40 sticky top-0 z-10">
        <ToolbarButton title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Highlight" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}>
          <Highlighter className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton title="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton title="Bullet List" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Ordered List" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Task Checklist" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
          <CheckSquare className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Code Block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Horizontal Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton title="Link" active={editor.isActive('link')} onClick={setLink}>
          <LinkIcon className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Clear Formatting" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
          <RemoveFormatting className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="flex-1" />

        {/* Templates Insert Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground">
              <LayoutTemplate className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Templates</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">
              Insert Template
            </DropdownMenuLabel>
            {DEFAULT_TEMPLATE_PRESETS.map((p) => (
              <DropdownMenuItem
                key={p.name}
                onClick={() => handleInsertTemplate(p.content)}
                className="text-xs cursor-pointer"
              >
                {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* AI Assist Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isAiLoading}
              className="h-7 px-2 text-xs font-semibold gap-1 text-primary hover:bg-primary/10"
            >
              {isAiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>AI Assist</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => handleAiAssist('summarize')} className="text-xs gap-2 cursor-pointer">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Summarize Key Points</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAiAssist('extract_actions')} className="text-xs gap-2 cursor-pointer">
              <CheckSquare className="h-3.5 w-3.5 text-rose-500" />
              <span>Extract Action Items</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAiAssist('improve_clarity')} className="text-xs gap-2 cursor-pointer">
              <Wand2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>Improve Clarity & Tone</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAiAssist('expand_idea')} className="text-xs gap-2 cursor-pointer">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Expand & Test Hypotheses</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolbarDivider />

        <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor Content Area */}
      <EditorContent editor={editor} />

      {/* Reading Statistics Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/60 bg-muted/20 text-[11px] text-muted-foreground select-none">
        <div className="flex items-center gap-3">
          <span>{readingStats.words} {readingStats.words === 1 ? 'word' : 'words'}</span>
          <span>•</span>
          <span>{readingStats.characters} characters</span>
          <span>•</span>
          <span>~{readingStats.readingTimeMinutes} min read</span>
        </div>
        <div className="text-[10px] opacity-70">
          Tip: Type <kbd className="px-1 py-0.5 bg-muted border rounded font-mono text-[9px]">/</kbd> for quick shortcuts
        </div>
      </div>

      {/* Connected Knowledge & Relationships Footer */}
      {((links && (links.entityName || links.contactName || links.dealName)) || backlinks.length > 0) && (
        <div className="px-3 py-2 border-t border-border/70 bg-muted/30 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Share2 className="w-3.5 h-3.5 text-indigo-500" />
              Connected Knowledge:
            </span>

            {/* Direct CRM links */}
            {links?.entityName && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-background">
                <span className="font-semibold text-slate-600 dark:text-slate-400">School:</span>
                <span className="text-foreground">{links.entityName}</span>
              </Badge>
            )}
            {links?.contactName && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-background">
                <span className="font-semibold text-slate-600 dark:text-slate-400">Contact:</span>
                <span className="text-foreground">{links.contactName}</span>
              </Badge>
            )}
            {links?.dealName && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-background">
                <span className="font-semibold text-slate-600 dark:text-slate-400">Deal:</span>
                <span className="text-foreground">{links.dealName}</span>
              </Badge>
            )}

            {/* Graph backlinks */}
            {backlinks.slice(0, 4).map((b) => (
              <Badge key={b.relationId} variant="secondary" className="text-[10px] gap-1">
                <span className="opacity-70">{getRelationDisplayLabel(b.relationType)}</span>
                <span className="max-w-[120px] truncate">{b.sourceTitle}</span>
              </Badge>
            ))}

            {backlinks.length > 4 && (
              <span className="text-[10px] text-muted-foreground">+{backlinks.length - 4} more</span>
            )}
          </div>

          {noteId && (
            <LinkNext
              href={`/admin/quick-notes/graph?focus=${encodeURIComponent(noteId)}`}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline active:scale-[0.97] transition-transform"
            >
              <Network className="w-3 h-3" />
              <span>Explore Ego-Network</span>
            </LinkNext>
          )}
        </div>
      )}
    </div>
  );
}

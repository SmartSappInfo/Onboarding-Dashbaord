'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  LayoutTemplate,
  Plus,
  Sparkles,
  Check,
  Pencil,
  Trash2,
  Lock,
  PhoneCall,
  Users,
  CheckCircle2,
  Lightbulb,
  School,
  Compass,
  FileText,
  Loader2,
} from 'lucide-react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useFirestore, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { cn } from '@/lib/utils';
import type { KnowledgeTemplate, KnowledgeType, NoteDocument } from '@/lib/quick-notes-types';
import {
  KNOWLEDGE_TYPE_META,
  normalizeKnowledgeType,
  plainTextToTipTap,
  extractPlainText,
} from '@/lib/quick-notes-domain';
import {
  useKnowledgeTemplates,
  createKnowledgeTemplate,
  updateKnowledgeTemplate,
  deleteKnowledgeTemplate,
} from '@/lib/quick-notes-hooks';
import { seedDefaultKnowledgeTemplates } from '@/lib/knowledge-template-presets';
import { useFloatingNotes } from '@/context/FloatingNotesContext';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  PhoneCall,
  Users,
  CheckCircle2,
  Lightbulb,
  School,
  Compass,
  FileText,
  LayoutTemplate,
};

export default function KnowledgeTemplatesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { openWithDraft } = useFloatingNotes();

  const { data: templates, isLoading } = useKnowledgeTemplates(activeWorkspaceId);
  const allTemplates = React.useMemo(() => templates ?? [], [templates]);

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<KnowledgeTemplate | null>(null);

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [knowledgeType, setKnowledgeType] = React.useState<KnowledgeType>('note');
  const [bodyText, setBodyText] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSeeding, setIsSeeding] = React.useState(false);

  const handleOpenNew = () => {
    setEditingTemplate(null);
    setName('');
    setDescription('');
    setKnowledgeType('note');
    setBodyText('### Key Points\n- Point 1\n- Point 2\n\n### Next Steps\n- [ ] Follow-up task');
    setEditorOpen(true);
  };

  const handleOpenEdit = (tmpl: KnowledgeTemplate) => {
    setEditingTemplate(tmpl);
    setName(tmpl.name);
    setDescription(tmpl.description || '');
    setKnowledgeType(normalizeKnowledgeType(tmpl.knowledgeType));
    setBodyText(extractPlainText(tmpl.content));
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Template name is required', variant: 'destructive' });
      return;
    }
    if (!firestore || !activeWorkspaceId || !activeOrganizationId || !user) {
      toast({ title: 'Workspace authentication missing', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const contentDoc = plainTextToTipTap(bodyText);

      if (editingTemplate) {
        await updateKnowledgeTemplate(firestore, editingTemplate.id, {
          name: name.trim(),
          description: description.trim(),
          knowledgeType,
          content: contentDoc,
        });
        toast({ title: 'Template updated ✓' });
      } else {
        await createKnowledgeTemplate(firestore, {
          organizationId: activeOrganizationId,
          workspaceId: activeWorkspaceId,
          createdBy: user.uid,
          name: name.trim(),
          description: description.trim(),
          knowledgeType,
          icon: 'FileText',
          color: 'blue',
          content: contentDoc,
          order: allTemplates.length,
          isSystem: false,
        });
        toast({ title: 'Custom template created ✓' });
      }
      setEditorOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save template';
      toast({ title: 'Error saving template', description: msg, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (tmpl: KnowledgeTemplate) => {
    if (tmpl.isSystem) {
      toast({ title: 'System presets cannot be deleted', variant: 'destructive' });
      return;
    }
    if (!firestore) return;

    const ok = await confirm({
      title: 'Delete template?',
      description: `This will permanently remove the "${tmpl.name}" template from this workspace. Existing notes created with it will not be affected.`,
      confirmText: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await deleteKnowledgeTemplate(firestore, tmpl.id);
      toast({ title: 'Template deleted' });
    } catch {
      toast({ title: 'Failed to delete template', variant: 'destructive' });
    }
  };

  const handleSeedDefaults = async () => {
    if (!firestore || !activeWorkspaceId || !activeOrganizationId || !user) return;
    setIsSeeding(true);
    try {
      const count = await seedDefaultKnowledgeTemplates(
        firestore,
        activeWorkspaceId,
        activeOrganizationId,
        user.uid
      );
      if (count > 0) {
        toast({ title: `Seeded ${count} foundational templates ✓` });
      } else {
        toast({ title: 'Templates already exist for this workspace.' });
      }
    } catch (err) {
      toast({ title: 'Failed to seed templates', variant: 'destructive' });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleUseTemplate = (tmpl: KnowledgeTemplate) => {
    const text = extractPlainText(tmpl.content);
    openWithDraft(text, {
      title: tmpl.name,
    });
    toast({ title: `Loaded "${tmpl.name}" into Company Brain Quick Capture` });
  };

  return (
    <PageContainerFluid>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/quick-notes">
            <Button variant="ghost" size="icon" className="h-9 w-9 min-h-[36px] min-w-[36px]" aria-label="Back to Company Brain">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">Knowledge Templates</h1>
              <Badge variant="outline" className="text-xs font-mono font-medium">
                {allTemplates.length} {allTemplates.length === 1 ? 'template' : 'templates'}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Standardized capture formats for calls, decisions, feedback, research, and ideas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {allTemplates.length === 0 && (
            <Button
              variant="outline"
              onClick={handleSeedDefaults}
              disabled={isSeeding}
              className="gap-2 shadow-sm font-semibold min-h-[44px] md:min-h-[36px]"
            >
              {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
              Seed System Presets
            </Button>
          )}
          <Button onClick={handleOpenNew} className="gap-2 shadow-sm font-semibold min-h-[44px] md:min-h-[36px]">
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : allTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <LayoutTemplate className="h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-4 font-serif text-lg font-medium text-foreground">No knowledge templates yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Seed standard templates or create custom boilerplate for your organization.
          </p>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSeedDefaults} disabled={isSeeding} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Seed 6 Default Presets
            </Button>
            <Button variant="outline" onClick={handleOpenNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Custom Template
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allTemplates.map((tmpl) => {
            const typeMeta = KNOWLEDGE_TYPE_META[normalizeKnowledgeType(tmpl.knowledgeType)];
            const IconComp = ICON_MAP[tmpl.icon] || FileText;
            const previewText = extractPlainText(tmpl.content);

            return (
              <div
                key={tmpl.id}
                className="group relative flex flex-col justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all text-left"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', typeMeta.badgeColor)}>
                        <IconComp className="h-4 w-4" />
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border',
                          typeMeta.badgeColor
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', typeMeta.dotColor)} />
                        {typeMeta.label}
                      </span>
                    </div>

                    {tmpl.isSystem ? (
                      <Badge variant="secondary" className="gap-1 text-[10px] font-medium h-5">
                        <Lock className="h-2.5 w-2.5 opacity-60" />
                        System
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-medium h-5">
                        Custom
                      </Badge>
                    )}
                  </div>

                  <h3 className="font-serif text-base font-semibold text-foreground tracking-tight">
                    {tmpl.name}
                  </h3>
                  {tmpl.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {tmpl.description}
                    </p>
                  )}

                  {previewText && (
                    <div className="mt-3 p-2 rounded-lg bg-muted/40 border border-border/40 text-[11px] font-mono text-muted-foreground line-clamp-3 select-none">
                      {previewText}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUseTemplate(tmpl)}
                    className="h-8 text-xs font-semibold gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
                  >
                    Use in Capture
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 min-h-[32px] min-w-[32px]"
                      title="Edit template"
                      onClick={() => handleOpenEdit(tmpl)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!tmpl.isSystem && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 min-h-[32px] min-w-[32px] text-muted-foreground hover:text-destructive"
                        title="Delete template"
                        onClick={() => handleDelete(tmpl)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Template Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {editingTemplate ? `Edit "${editingTemplate.name}"` : 'New Custom Knowledge Template'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-left">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Template Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sales Discovery Call"
                className="text-sm font-medium"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of when to use this template…"
                className="text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Knowledge Type</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between text-xs h-9">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-full', KNOWLEDGE_TYPE_META[knowledgeType].dotColor)} />
                      <span>{KNOWLEDGE_TYPE_META[knowledgeType].label}</span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {(Object.keys(KNOWLEDGE_TYPE_META) as KnowledgeType[]).map((tKey) => {
                    const meta = KNOWLEDGE_TYPE_META[tKey];
                    return (
                      <DropdownMenuItem
                        key={tKey}
                        onClick={() => setKnowledgeType(tKey)}
                        className="flex items-center gap-2 text-xs font-medium cursor-pointer"
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

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Structured Boilerplate Content *
              </label>
              <Textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={8}
                placeholder="### Section 1&#10;Key questions...&#10;&#10;### Section 2&#10;Action items..."
                className="font-mono text-xs leading-relaxed"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Tip: Use Markdown headings (###) and bullet lists (- item) to structure sections.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainerFluid>
  );
}

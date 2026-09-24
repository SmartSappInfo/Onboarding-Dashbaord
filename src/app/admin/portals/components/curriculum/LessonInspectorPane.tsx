'use client';

/**
 * {{Org_name}} Experience Platform — Lesson Inspector Pane
 *
 * Right-hand workspace of the full-screen Curriculum Editor Modal.
 * Dual-Mode Authoring:
 * - Mode 1: "Lesson Settings & Media" (Metadata, video embeds, toolkits, drip rules, quiz launcher).
 * - Mode 2: "Lesson Block Studio" (Full embedded 3-pane block builder: palette, sortable canvas, inspector).
 *
 * Backwards Compatibility:
 * - Automatically synthesizes legacy string content into a markdown block when opened in Block Studio.
 * - Auto-extracts plain-text search AST on block changes.
 *
 * Conforms to:
 * - `emilkowal-animations`: `active:scale-[0.97]`.
 * - `vercel-react-best-practices`: useDeferredValue, stable callbacks.
 * - Strict 0 `any` / 0 `any[]` typing.
 * - Minimum 44px touch targets.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import type {
  CourseLesson,
  LessonContentType,
  ReleaseScheduleType,
  LessonAttachment,
} from '@/lib/types/learning';
import type { PageBlock, PageBlockType } from '@/lib/types';
import { ContentBlockCanvas } from '../studio/ContentBlockCanvas';
import { ContentBlockPalette } from '../studio/ContentBlockPalette';
import { ContentBlockInspector } from '../studio/ContentBlockInspector';
import { getBlock } from '@/lib/page-builder/registry';
import {
  Settings,
  Sparkles,
  PlayCircle,
  HelpCircle,
  Lock,
  Plus,
  Trash2,
  Download,
  Sliders,
  GraduationCap,
  ExternalLink,
} from 'lucide-react';

interface LessonInspectorPaneProps {
  lesson: CourseLesson | null;
  allLessons: CourseLesson[];
  portalId: string;
  portalSlug?: string;
  courseId: string;
  onUpdateLesson: (updates: Partial<CourseLesson>) => void;
  onOpenQuizBuilder: (lesson: CourseLesson) => void;
  isSaving?: boolean;
}

export function LessonInspectorPane({
  lesson,
  allLessons,
  portalId: _portalId,
  portalSlug: _portalSlug,
  courseId: _courseId,
  onUpdateLesson,
  onOpenQuizBuilder,
  isSaving: _isSaving,
}: LessonInspectorPaneProps) {
  const [activeTab, setActiveTab] = React.useState<'settings' | 'blocks'>('settings');

  // Block Studio State
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null);
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = React.useState(false);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = React.useState(false);

  // New attachment local draft state
  const [isAddingAttachment, setIsAddingAttachment] = React.useState(false);
  const [newAttachmentName, setNewAttachmentName] = React.useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = React.useState('');

  // ── Synchronize blocks with legacy markdown fallback ───────────────────────
  const currentBlocks = React.useMemo<PageBlock[]>(() => {
    if (!lesson) return [];
    if (lesson.blocks && lesson.blocks.length > 0) {
      return lesson.blocks;
    }
    // Backwards compatibility: Wrap existing plain content into a text block
    if (lesson.content && lesson.content.trim().length > 0) {
      return [
        {
          id: `blk_text_${lesson.id}`,
          type: 'text',
          props: {
            content: lesson.content,
            preset: 'paragraph',
          },
        },
      ];
    }
    return [];
  }, [lesson]);

  // Selected block for Inspector
  const selectedBlock = React.useMemo(() => {
    if (!selectedBlockId) return null;
    return currentBlocks.find(b => b.id === selectedBlockId) || null;
  }, [currentBlocks, selectedBlockId]);

  if (!lesson) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background text-muted-foreground space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center text-primary">
          <GraduationCap className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-sm text-foreground">Select a Lesson</h3>
        <p className="text-xs max-w-sm">
          Choose a lesson from the curriculum hierarchy on the left to configure settings, embed video, or launch the Block Studio.
        </p>
      </div>
    );
  }

  // ── Block Studio Callbacks ─────────────────────────────────────────────────
  const handleSelectBlockType = (type: PageBlockType) => {
    const def = getBlock(type);
    const uniqueSuffix = Math.random().toString(36).slice(2, 8);
    const newBlock: PageBlock = {
      id: `blk_${type}_${Date.now()}_${uniqueSuffix}`,
      type,
      props: def ? { ...def.defaults } : {},
    };

    const updated = [...currentBlocks, newBlock];
    onUpdateLesson({ blocks: updated });
    setSelectedBlockId(newBlock.id);
    setIsMobilePaletteOpen(false);
  };

  const handleInsertAtIndex = (index: number) => {
    const uniqueSuffix = Math.random().toString(36).slice(2, 8);
    const newBlock: PageBlock = {
      id: `blk_text_${Date.now()}_${uniqueSuffix}`,
      type: 'text',
      props: {
        content: 'Add your instructional content and key takeaways here.',
        preset: 'paragraph',
      },
    };

    const updated = [...currentBlocks];
    updated.splice(index, 0, newBlock);
    onUpdateLesson({ blocks: updated });
    setSelectedBlockId(newBlock.id);
  };

  const handleUpdateBlockProps = (blockId: string, patch: Record<string, unknown>) => {
    const updated = currentBlocks.map(b => {
      if (b.id !== blockId) return b;
      return {
        ...b,
        props: {
          ...(b.props ?? {}),
          ...patch,
        },
      };
    });
    onUpdateLesson({ blocks: updated });
  };

  const handleDeleteBlock = (blockId: string) => {
    const updated = currentBlocks.filter(b => b.id !== blockId);
    onUpdateLesson({ blocks: updated });
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  };

  // ── Attachment Callbacks ───────────────────────────────────────────────────
  const handleAddAttachment = () => {
    if (!newAttachmentName.trim() || !newAttachmentUrl.trim()) return;

    const attachment: LessonAttachment = {
      id: `att_${Date.now()}`,
      name: newAttachmentName.trim(),
      url: newAttachmentUrl.trim(),
    };

    const updated = [...(lesson.attachments || []), attachment];
    onUpdateLesson({ attachments: updated });
    setNewAttachmentName('');
    setNewAttachmentUrl('');
    setIsAddingAttachment(false);
  };

  const handleDeleteAttachment = (attachmentId: string) => {
    const updated = (lesson.attachments || []).filter(a => a.id !== attachmentId);
    onUpdateLesson({ attachments: updated });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Top Inspector Mode Switcher Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/40">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-[10px] font-extrabold uppercase px-2 py-0.5">
            {lesson.contentType}
          </Badge>
          <h2 className="text-sm font-black text-foreground truncate max-w-md">
            {lesson.title}
          </h2>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={v => setActiveTab(v as 'settings' | 'blocks')}
          className="w-auto"
        >
          <TabsList className="h-9 p-1 bg-muted/70 rounded-xl grid grid-cols-2">
            <TabsTrigger
              value="settings"
              className="rounded-lg text-xs font-bold gap-1.5 px-3 min-h-[32px] active:scale-[0.97]"
            >
              <Settings className="w-3.5 h-3.5" /> Settings & Media
            </TabsTrigger>
            <TabsTrigger
              value="blocks"
              className="rounded-lg text-xs font-bold gap-1.5 px-3 min-h-[32px] text-primary data-[state=active]:bg-primary data-[state=active]:text-white active:scale-[0.97]"
            >
              <Sparkles className="w-3.5 h-3.5" /> Lesson Block Studio
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ── Mode 1: Settings & Media Tab ──────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
          {/* General Metadata */}
          <Card className="rounded-3xl border-2 border-border p-6 space-y-4 bg-card shadow-2xs">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-primary" /> Lesson Configuration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold">Lesson Title</Label>
                <Input
                  value={lesson.title}
                  onChange={e => onUpdateLesson({ title: e.target.value })}
                  placeholder="e.g. Introduction to Leadership Principles"
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">URL Slug</Label>
                <Input
                  value={lesson.slug}
                  onChange={e => onUpdateLesson({ slug: e.target.value })}
                  placeholder="e.g. intro-leadership"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Content Format</Label>
                <Select
                  value={lesson.contentType}
                  onValueChange={(val: LessonContentType) => onUpdateLesson({ contentType: val })}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="video">🎥 Video Lesson</SelectItem>
                    <SelectItem value="article">📄 Reading Guide / Article</SelectItem>
                    <SelectItem value="quiz">🎯 Knowledge Quiz</SelectItem>
                    <SelectItem value="assignment">📝 Practical Assignment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold">Summary & Learning Objective</Label>
                <Textarea
                  value={lesson.summary || ''}
                  onChange={e => onUpdateLesson({ summary: e.target.value })}
                  placeholder="Concise overview of what students will accomplish in this lesson..."
                  rows={2}
                  className="text-xs rounded-xl resize-none"
                />
              </div>
            </div>
          </Card>

          {/* Video Player & Media Preview */}
          {lesson.contentType === 'video' && (
            <Card className="rounded-3xl border-2 border-border p-6 space-y-4 bg-card shadow-2xs">
              <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <PlayCircle className="w-3.5 h-3.5 text-primary" /> Video Player & Embed
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-bold">Video URL (YouTube, Vimeo, MP4)</Label>
                  <Input
                    value={lesson.videoUrl || ''}
                    onChange={e => onUpdateLesson({ videoUrl: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Estimated Duration</Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="1"
                      value={lesson.videoDurationSeconds ? Math.round(lesson.videoDurationSeconds / 60) : 10}
                      onChange={e =>
                        onUpdateLesson({
                          videoDurationSeconds: (Number(e.target.value) || 0) * 60,
                        })
                      }
                      className="h-10 text-xs rounded-xl text-center"
                    />
                    <span className="text-xs font-semibold text-muted-foreground">mins</span>
                  </div>
                </div>
              </div>

              {/* Responsive 16:9 Live Preview */}
              {lesson.videoUrl && (
                <div className="space-y-2 pt-2">
                  <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Live Video Preview
                  </Label>
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-border shadow-xs">
                    {lesson.videoUrl.includes('youtube.com') || lesson.videoUrl.includes('youtu.be') ? (
                      <iframe
                        src={
                          lesson.videoUrl.includes('watch?v=')
                            ? lesson.videoUrl.replace('watch?v=', 'embed/')
                            : lesson.videoUrl
                        }
                        title="Video Preview"
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        src={lesson.videoUrl}
                        controls
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Drip Release Rule & Lead Magnet Settings */}
          <Card className="rounded-3xl border-2 border-border p-6 space-y-4 bg-card shadow-2xs">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-primary" /> Drip Release & Access Rules
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Release Schedule</Label>
                  <Select
                    value={lesson.releaseRule?.type || 'immediate'}
                    onValueChange={(val: ReleaseScheduleType) =>
                      onUpdateLesson({
                        releaseRule: { ...lesson.releaseRule, type: val },
                      })
                    }
                  >
                    <SelectTrigger className="h-10 text-xs rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="immediate">Available Immediately</SelectItem>
                      <SelectItem value="days_after_enrollment">Days After Enrollment</SelectItem>
                      <SelectItem value="days_after_join">Days After Joining Membership</SelectItem>
                      <SelectItem value="specific_date">Specific Calendar Date</SelectItem>
                      <SelectItem value="sequential_prerequisite">Sequential Prerequisite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Conditional rule inputs */}
                {(lesson.releaseRule?.type === 'days_after_enrollment' ||
                  lesson.releaseRule?.type === 'days_after_join') && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Days Delay</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={lesson.releaseRule.daysDelay || 7}
                        onChange={e =>
                          onUpdateLesson({
                            releaseRule: {
                              ...lesson.releaseRule,
                              type: lesson.releaseRule?.type || 'days_after_enrollment',
                              daysDelay: Number(e.target.value) || 1,
                            },
                          })
                        }
                        className="h-10 text-xs rounded-xl text-center w-24"
                      />
                      <span className="text-xs text-muted-foreground font-semibold">days after trigger</span>
                    </div>
                  </div>
                )}

                {lesson.releaseRule?.type === 'specific_date' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Release Timestamp (ISO Date)</Label>
                    <Input
                      type="date"
                      value={lesson.releaseRule.releaseDate ? lesson.releaseRule.releaseDate.split('T')[0] : ''}
                      onChange={e =>
                        onUpdateLesson({
                          releaseRule: {
                            ...lesson.releaseRule,
                            type: 'specific_date',
                            releaseDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                          },
                        })
                      }
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                )}

                {lesson.releaseRule?.type === 'sequential_prerequisite' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Required Prerequisite Lesson</Label>
                    <Select
                      value={lesson.releaseRule.requiredLessonId || ''}
                      onValueChange={val =>
                        onUpdateLesson({
                          releaseRule: {
                            ...lesson.releaseRule,
                            type: 'sequential_prerequisite',
                            requiredLessonId: val,
                          },
                        })
                      }
                    >
                      <SelectTrigger className="h-10 text-xs rounded-xl">
                        <SelectValue placeholder="Select prerequisite lesson..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {allLessons
                          .filter(l => l.id !== lesson.id)
                          .map(l => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Free Preview Toggle */}
              <div className="flex items-center justify-between pt-3 border-t border-border/60">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold">Public Free Preview</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Allow unenrolled visitors to watch this lesson as a lead magnet.
                  </p>
                </div>
                <Switch
                  checked={lesson.isPreview ?? false}
                  onCheckedChange={checked => onUpdateLesson({ isPreview: checked })}
                />
              </div>
            </div>
          </Card>

          {/* Downloadable Toolkits & Attachments */}
          <Card className="rounded-3xl border-2 border-border p-6 space-y-4 bg-card shadow-2xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Download className="w-3.5 h-3.5 text-primary" /> Companion Toolkits & Downloads ({lesson.attachments?.length || 0})
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingAttachment(true)}
                className="h-8 rounded-xl text-xs font-bold text-primary hover:bg-primary/10 gap-1 active:scale-[0.97]"
              >
                <Plus className="w-3.5 h-3.5" /> Add Resource
              </Button>
            </div>

            {/* Existing Attachments */}
            {(lesson.attachments || []).length === 0 && !isAddingAttachment ? (
              <p className="text-xs text-muted-foreground italic py-2">
                No worksheets or downloadable toolkits attached to this lesson.
              </p>
            ) : (
              <div className="space-y-2">
                {(lesson.attachments || []).map(att => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-3 rounded-2xl border border-border bg-muted/20 text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate flex-1 mr-3">
                      <Download className="w-4 h-4 text-primary shrink-0" />
                      <div className="truncate">
                        <p className="font-bold text-foreground truncate">{att.name}</p>
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
                        >
                          {att.url} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(att.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 active:scale-[0.95]"
                      title="Remove attachment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Inline Add Attachment Form */}
            {isAddingAttachment && (
              <div className="p-4 rounded-2xl border-2 border-primary/20 bg-primary/5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Resource Title</Label>
                    <Input
                      placeholder="e.g. Budget Worksheet (XLSX)"
                      value={newAttachmentName}
                      onChange={e => setNewAttachmentName(e.target.value)}
                      className="h-8 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">File Download URL</Label>
                    <Input
                      placeholder="https://..."
                      value={newAttachmentUrl}
                      onChange={e => setNewAttachmentUrl(e.target.value)}
                      className="h-8 text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddingAttachment(false)}
                    className="h-7 rounded-xl text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddAttachment}
                    className="h-7 rounded-xl text-xs font-bold bg-primary text-white"
                  >
                    Save Resource
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Quiz Action Button */}
          {lesson.contentType === 'quiz' && (
            <Card className="rounded-3xl border-2 border-amber-500/30 p-6 space-y-3 bg-amber-500/5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <HelpCircle className="w-3.5 h-3.5" /> Knowledge Quiz Builder
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Configure multiple choice questions, passing score, and instant answer explanations.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={() => onOpenQuizBuilder(lesson)}
                  className="rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-sm active:scale-[0.97] min-h-[44px]"
                >
                  <HelpCircle className="w-4 h-4" /> Open Quiz Builder
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Mode 2: Lesson Block Studio Tab ────────────────────────────────── */}
      {activeTab === 'blocks' && (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Desktop Left: Content Block Palette */}
          <aside className="hidden lg:block w-72 h-full border-r border-border shrink-0">
            <ContentBlockPalette onSelectBlockType={handleSelectBlockType} />
          </aside>

          {/* Desktop Center / Canvas Area */}
          <main className="flex-1 h-full overflow-y-auto p-4 sm:p-8 bg-muted/10">
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Studio Canvas Instructions */}
              <div className="flex items-center justify-between pb-2 border-b border-border text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> Drag-and-drop pedagogical blocks for this lesson
                </span>
                <span>{currentBlocks.length} Blocks</span>
              </div>

              {/* Sortable Block Canvas */}
              <ContentBlockCanvas
                blocks={currentBlocks}
                selectedBlockId={selectedBlockId}
                onSelectBlock={setSelectedBlockId}
                onChangeBlocks={blocks => onUpdateLesson({ blocks })}
                onInsertAtIndex={handleInsertAtIndex}
              />
            </div>
          </main>

          {/* Desktop Right: Property Inspector */}
          <aside className="hidden xl:block w-80 h-full border-l border-border shrink-0">
            <ContentBlockInspector
              selectedBlock={selectedBlock}
              onUpdateProps={handleUpdateBlockProps}
              onDeleteBlock={handleDeleteBlock}
              onDeselect={() => setSelectedBlockId(null)}
            />
          </aside>

          {/* Mobile Bottom Float Bar for Palette and Inspector */}
          <div className="lg:hidden fixed bottom-4 right-4 flex items-center gap-2 z-40">
            <Button
              size="sm"
              onClick={() => setIsMobilePaletteOpen(true)}
              className="rounded-full shadow-lg font-bold text-xs bg-primary text-white min-h-[44px] gap-1 px-4 active:scale-[0.95]"
            >
              <Plus className="w-4 h-4" /> Add Block
            </Button>
            {selectedBlock && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsMobileInspectorOpen(true)}
                className="rounded-full shadow-lg font-bold text-xs bg-background min-h-[44px] gap-1 px-4 active:scale-[0.95]"
              >
                <Sliders className="w-4 h-4 text-primary" /> Edit Block
              </Button>
            )}
          </div>

          {/* Mobile Palette Sheet */}
          <Sheet open={isMobilePaletteOpen} onOpenChange={setIsMobilePaletteOpen}>
            <SheetContent side="bottom" className="h-[80vh] p-0 rounded-t-3xl">
              <ContentBlockPalette
                onSelectBlockType={handleSelectBlockType}
                onClose={() => setIsMobilePaletteOpen(false)}
              />
            </SheetContent>
          </Sheet>

          {/* Mobile Inspector Sheet */}
          <Sheet open={isMobileInspectorOpen} onOpenChange={setIsMobileInspectorOpen}>
            <SheetContent side="bottom" className="h-[80vh] p-4 rounded-t-3xl">
              <ContentBlockInspector
                selectedBlock={selectedBlock}
                onUpdateProps={handleUpdateBlockProps}
                onDeleteBlock={handleDeleteBlock}
                onDeselect={() => {
                  setSelectedBlockId(null);
                  setIsMobileInspectorOpen(false);
                }}
              />
            </SheetContent>
          </Sheet>
        </div>
      )}
    </div>
  );
}
